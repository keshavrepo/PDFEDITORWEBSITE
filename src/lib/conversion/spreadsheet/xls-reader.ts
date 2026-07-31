/**
 * Legacy Excel 97-2003 (.xls / BIFF8) reader.
 *
 * A .xls file is an OLE2 compound document containing a "Workbook" stream of
 * BIFF records. Only the records needed to reproduce a printable sheet are
 * decoded: dimensions, cell values, shared strings, merges, column widths and
 * enough of the style tables to keep bold headers and alignment.
 *
 * This is intentionally a focused reader, not a full BIFF implementation.
 */

import { conversionErrors } from "../errors";
import { formatCellValue, isDateFormat } from "./number-format";
import { excelSerialToDate } from "./xlsx-reader";
import type {
  CellStyle,
  MergedRange,
  SheetCell,
  SheetModel,
  WorkbookModel,
} from "./types";

/* -------------------------------------------------------------------------- */
/* OLE2 compound document                                                     */
/* -------------------------------------------------------------------------- */

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;

interface DirectoryEntry {
  name: string;
  type: number;
  startSector: number;
  size: number;
}

/**
 * Extracts a named stream from an OLE2 container.
 *
 * Streams are stored either in the main FAT (large streams) or the mini FAT
 * (streams below the mini-stream cutoff), so both paths are implemented.
 */
function readOleStream(data: Uint8Array, streamName: string): Uint8Array | null {
  if (data.length < 512) return null;
  for (let index = 0; index < OLE_SIGNATURE.length; index++) {
    if (data[index] !== OLE_SIGNATURE[index]) return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sectorShift = view.getUint16(30, true);
  const miniSectorShift = view.getUint16(32, true);
  const sectorSize = 1 << sectorShift;
  const miniSectorSize = 1 << miniSectorShift;
  const directoryStart = view.getUint32(48, true);
  const miniCutoff = view.getUint32(56, true);
  const miniFatStart = view.getUint32(60, true);
  const difatStart = view.getUint32(68, true);
  const difatCount = view.getUint32(72, true);

  const sectorOffset = (sector: number) => (sector + 1) * sectorSize;
  const readSector = (sector: number): Uint8Array | null => {
    const offset = sectorOffset(sector);
    if (offset + sectorSize > data.length) return null;
    return data.subarray(offset, offset + sectorSize);
  };

  // Assemble the FAT sector list from the header DIFAT plus any DIFAT chain.
  const fatSectors: number[] = [];
  for (let index = 0; index < 109; index++) {
    const sector = view.getUint32(76 + index * 4, true);
    if (sector === FREE_SECTOR) break;
    fatSectors.push(sector);
  }
  let difatSector = difatStart;
  for (let visited = 0; visited < difatCount && difatSector !== END_OF_CHAIN && difatSector !== FREE_SECTOR; visited++) {
    const sector = readSector(difatSector);
    if (!sector) break;
    const sectorView = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
    const entries = sectorSize / 4 - 1;
    for (let index = 0; index < entries; index++) {
      const value = sectorView.getUint32(index * 4, true);
      if (value !== FREE_SECTOR) fatSectors.push(value);
    }
    difatSector = sectorView.getUint32(sectorSize - 4, true);
  }

  // Flatten the FAT.
  const fat: number[] = [];
  for (const fatSector of fatSectors) {
    const sector = readSector(fatSector);
    if (!sector) continue;
    const sectorView = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
    for (let index = 0; index < sectorSize / 4; index++) {
      fat.push(sectorView.getUint32(index * 4, true));
    }
  }
  if (!fat.length) return null;

  const followChain = (start: number, limit: number): number[] => {
    const chain: number[] = [];
    let sector = start;
    const guard = new Set<number>();
    while (sector !== END_OF_CHAIN && sector !== FREE_SECTOR && chain.length < limit) {
      if (guard.has(sector) || sector >= fat.length) break;
      guard.add(sector);
      chain.push(sector);
      sector = fat[sector];
    }
    return chain;
  };

  const readChain = (start: number, size: number): Uint8Array => {
    const sectors = followChain(start, Math.ceil(size / sectorSize) + 1);
    const output = new Uint8Array(sectors.length * sectorSize);
    let offset = 0;
    for (const sector of sectors) {
      const bytes = readSector(sector);
      if (!bytes) break;
      output.set(bytes, offset);
      offset += sectorSize;
    }
    return output.subarray(0, size || offset);
  };

  // Directory entries describe the streams.
  const directorySectors = followChain(directoryStart, 4096);
  const entries: DirectoryEntry[] = [];
  for (const sector of directorySectors) {
    const bytes = readSector(sector);
    if (!bytes) continue;
    const entryView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 0; offset + 128 <= bytes.length; offset += 128) {
      const nameLength = entryView.getUint16(offset + 64, true);
      if (nameLength < 2) continue;
      let name = "";
      for (let index = 0; index < nameLength / 2 - 1; index++) {
        name += String.fromCharCode(entryView.getUint16(offset + index * 2, true));
      }
      entries.push({
        name,
        type: bytes[offset + 66],
        startSector: entryView.getUint32(offset + 116, true),
        size: entryView.getUint32(offset + 120, true),
      });
    }
  }

  const target = entries.find((entry) => entry.name === streamName && entry.type === 2);
  if (!target) return null;

  // Large streams live in the FAT; small ones in the mini FAT.
  if (target.size >= miniCutoff) return readChain(target.startSector, target.size);

  const root = entries.find((entry) => entry.type === 5);
  if (!root) return null;

  const miniStream = readChain(root.startSector, root.size);
  const miniFatSectors = followChain(miniFatStart, 4096);
  const miniFat: number[] = [];
  for (const sector of miniFatSectors) {
    const bytes = readSector(sector);
    if (!bytes) continue;
    const miniView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < sectorSize / 4; index++) {
      miniFat.push(miniView.getUint32(index * 4, true));
    }
  }

  const output = new Uint8Array(target.size);
  let sector = target.startSector;
  let offset = 0;
  const guard = new Set<number>();
  while (sector !== END_OF_CHAIN && sector !== FREE_SECTOR && offset < target.size) {
    if (guard.has(sector) || sector >= miniFat.length) break;
    guard.add(sector);
    const start = sector * miniSectorSize;
    const chunk = miniStream.subarray(start, start + miniSectorSize);
    output.set(chunk.subarray(0, Math.min(chunk.length, target.size - offset)), offset);
    offset += miniSectorSize;
    sector = miniFat[sector];
  }
  return output;
}

/* -------------------------------------------------------------------------- */
/* BIFF records                                                               */
/* -------------------------------------------------------------------------- */

const RECORD = {
  FORMULA: 0x0006,
  EOF: 0x000a,
  CONTINUE: 0x003c,
  BOUNDSHEET: 0x0085,
  MULRK: 0x00bd,
  BLANK: 0x0201,
  NUMBER: 0x0203,
  LABEL: 0x0204,
  BOOLERR: 0x0205,
  STRING: 0x0207,
  ROW: 0x0208,
  BOF: 0x0809,
  RK: 0x027e,
  MERGEDCELLS: 0x00e5,
  COLINFO: 0x007d,
  SST: 0x00fc,
  LABELSST: 0x00fd,
  XF: 0x00e0,
  FORMAT: 0x041e,
  FONT: 0x0031,
  SETUP: 0x00a1,
  DIMENSIONS: 0x0200,
} as const;

interface BiffRecord {
  id: number;
  data: Uint8Array;
}

function readRecords(stream: Uint8Array): BiffRecord[] {
  const records: BiffRecord[] = [];
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let offset = 0;

  while (offset + 4 <= stream.length) {
    const id = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    if (offset + 4 + length > stream.length) break;
    records.push({ id, data: stream.subarray(offset + 4, offset + 4 + length) });
    offset += 4 + length;
  }
  return records;
}

/** Decodes a BIFF8 unicode string, handling both 8-bit and 16-bit encodings. */
function readUnicodeString(
  data: Uint8Array,
  offset: number,
  lengthBytes: 1 | 2
): { text: string; next: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (offset + lengthBytes > data.length) return { text: "", next: data.length };

  const characterCount = lengthBytes === 2 ? view.getUint16(offset, true) : data[offset];
  let cursor = offset + lengthBytes;
  if (cursor >= data.length) return { text: "", next: data.length };

  const flags = data[cursor];
  cursor++;
  const wide = (flags & 0x01) !== 0;
  const hasFarEast = (flags & 0x04) !== 0;
  const hasRichText = (flags & 0x08) !== 0;

  let runCount = 0;
  let farEastSize = 0;
  if (hasRichText && cursor + 2 <= data.length) {
    runCount = view.getUint16(cursor, true);
    cursor += 2;
  }
  if (hasFarEast && cursor + 4 <= data.length) {
    farEastSize = view.getUint32(cursor, true);
    cursor += 4;
  }

  let text = "";
  for (let index = 0; index < characterCount; index++) {
    if (wide) {
      if (cursor + 2 > data.length) break;
      text += String.fromCharCode(view.getUint16(cursor, true));
      cursor += 2;
    } else {
      if (cursor >= data.length) break;
      text += String.fromCharCode(data[cursor]);
      cursor += 1;
    }
  }

  cursor += runCount * 4 + farEastSize;
  return { text, next: Math.min(cursor, data.length) };
}

/** RK values pack a float or scaled integer into 32 bits. */
function decodeRk(value: number): number {
  const isInteger = (value & 0x02) !== 0;
  const isDivided = (value & 0x01) !== 0;

  let result: number;
  if (isInteger) {
    // Arithmetic shift keeps the sign of negative integers.
    result = value >> 2;
  } else {
    const buffer = new ArrayBuffer(8);
    const bufferView = new DataView(buffer);
    // The 30 significant bits are the top of an IEEE-754 double.
    bufferView.setUint32(4, value & 0xfffffffc);
    result = bufferView.getFloat64(0);
  }
  return isDivided ? result / 100 : result;
}

/** Reads the shared string table, following CONTINUE records. */
function readSst(records: BiffRecord[], startIndex: number): string[] {
  const chunks: Uint8Array[] = [records[startIndex].data];
  for (let index = startIndex + 1; index < records.length; index++) {
    if (records[index].id !== RECORD.CONTINUE) break;
    chunks.push(records[index].data);
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const view = new DataView(merged.buffer, merged.byteOffset, merged.byteLength);
  if (merged.length < 8) return [];
  const uniqueCount = view.getUint32(4, true);

  const strings: string[] = [];
  let cursor = 8;
  for (let index = 0; index < uniqueCount && cursor < merged.length; index++) {
    const { text, next } = readUnicodeString(merged, cursor, 2);
    strings.push(text);
    if (next <= cursor) break;
    cursor = next;
  }
  return strings;
}

interface XfEntry {
  fontIndex: number;
  formatIndex: number;
  horizontal?: CellStyle["horizontal"];
  vertical?: CellStyle["vertical"];
  wrapText?: boolean;
}

const XLS_HORIZONTAL: Record<number, CellStyle["horizontal"]> = {
  1: "left",
  2: "center",
  3: "right",
  5: "center",
  6: "center",
};
const XLS_VERTICAL: Record<number, CellStyle["vertical"]> = {
  0: "top",
  1: "middle",
  2: "bottom",
};

/** Parses a legacy .xls workbook into the shared spreadsheet model. */
export async function readXls(data: Uint8Array): Promise<WorkbookModel> {
  const stream = readOleStream(data, "Workbook") || readOleStream(data, "Book");
  if (!stream) throw conversionErrors.corrupted("Excel (.xls)");

  const records = readRecords(stream);
  if (!records.length) throw conversionErrors.corrupted("Excel (.xls)");

  /* --- Globals: shared strings, sheet index, styles --- */

  let sharedStrings: string[] = [];
  const boundSheets: Array<{ name: string; position: number }> = [];
  const fonts: Array<{ bold: boolean; italic: boolean; size: number; name?: string }> = [];
  const formats = new Map<number, string>();
  const xfs: XfEntry[] = [];

  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const view = new DataView(record.data.buffer, record.data.byteOffset, record.data.byteLength);

    if (record.id === RECORD.SST) {
      sharedStrings = readSst(records, index);
    } else if (record.id === RECORD.BOUNDSHEET && record.data.length >= 6) {
      const position = view.getUint32(0, true);
      const visibility = record.data[4] & 0x03;
      const { text } = readUnicodeString(record.data, 6, 1);
      // Skip hidden sheets, matching the .xlsx reader.
      if (visibility === 0) boundSheets.push({ name: text, position });
    } else if (record.id === RECORD.FONT && record.data.length >= 14) {
      const size = view.getUint16(0, true) / 20;
      const attributes = view.getUint16(2, true);
      const weight = view.getUint16(6, true);
      const { text } = readUnicodeString(record.data, 14, 1);
      fonts.push({
        bold: weight >= 700 || (attributes & 0x01) !== 0,
        italic: (attributes & 0x02) !== 0,
        size,
        name: text || undefined,
      });
    } else if (record.id === RECORD.FORMAT && record.data.length >= 2) {
      const formatIndex = view.getUint16(0, true);
      const { text } = readUnicodeString(record.data, 2, 2);
      formats.set(formatIndex, text);
    } else if (record.id === RECORD.XF && record.data.length >= 10) {
      const fontIndex = view.getUint16(0, true);
      const formatIndex = view.getUint16(2, true);
      const alignment = record.data[6];
      xfs.push({
        fontIndex,
        formatIndex,
        horizontal: XLS_HORIZONTAL[alignment & 0x07],
        vertical: XLS_VERTICAL[(alignment >> 4) & 0x07],
        wrapText: (alignment & 0x08) !== 0,
      });
    }
  }

  if (!boundSheets.length) throw conversionErrors.noContent("Excel (.xls)");

  /* --- Per-sheet records, located by BOUNDSHEET stream positions --- */

  const styleFor = (xfIndex: number): CellStyle | undefined => {
    const xf = xfs[xfIndex];
    if (!xf) return undefined;
    const font = fonts[xf.fontIndex];
    return {
      bold: font?.bold,
      italic: font?.italic,
      fontSize: font?.size,
      fontFamily: font?.name,
      horizontal: xf.horizontal,
      vertical: xf.vertical,
      wrapText: xf.wrapText,
      numberFormat: formats.get(xf.formatIndex) || builtinXlsFormat(xf.formatIndex),
    };
  };

  const sheets: SheetModel[] = [];

  for (const boundSheet of boundSheets) {
    const sheetRecords = readRecords(stream.subarray(boundSheet.position));
    const cells: SheetCell[] = [];
    const merges: MergedRange[] = [];
    const columnWidths = new Map<number, number>();
    const rowHeights = new Map<number, number>();
    let landscape: boolean | undefined;

    const push = (
      row: number,
      column: number,
      text: string,
      value: SheetCell["value"],
      type: SheetCell["type"],
      xfIndex: number
    ) => {
      if (!text) return;
      cells.push({ row, column, text, value, type, style: styleFor(xfIndex) });
    };

    for (let index = 0; index < sheetRecords.length; index++) {
      const record = sheetRecords[index];
      const data = record.data;
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (record.id === RECORD.EOF && index > 0) break;

      switch (record.id) {
        case RECORD.LABELSST: {
          if (data.length < 10) break;
          const stringIndex = view.getUint32(6, true);
          const text = sharedStrings[stringIndex] ?? "";
          push(view.getUint16(0, true), view.getUint16(2, true), text, text, "string", view.getUint16(4, true));
          break;
        }
        case RECORD.LABEL: {
          if (data.length < 8) break;
          const { text } = readUnicodeString(data, 6, 2);
          push(view.getUint16(0, true), view.getUint16(2, true), text, text, "string", view.getUint16(4, true));
          break;
        }
        case RECORD.NUMBER: {
          if (data.length < 14) break;
          const numeric = view.getFloat64(6, true);
          const xfIndex = view.getUint16(4, true);
          pushNumeric(view.getUint16(0, true), view.getUint16(2, true), numeric, xfIndex);
          break;
        }
        case RECORD.RK: {
          if (data.length < 10) break;
          const numeric = decodeRk(view.getUint32(6, true));
          pushNumeric(view.getUint16(0, true), view.getUint16(2, true), numeric, view.getUint16(4, true));
          break;
        }
        case RECORD.MULRK: {
          if (data.length < 6) break;
          const row = view.getUint16(0, true);
          const firstColumn = view.getUint16(2, true);
          const count = Math.floor((data.length - 6) / 6);
          for (let entry = 0; entry < count; entry++) {
            const offset = 4 + entry * 6;
            const xfIndex = view.getUint16(offset, true);
            const numeric = decodeRk(view.getUint32(offset + 2, true));
            pushNumeric(row, firstColumn + entry, numeric, xfIndex);
          }
          break;
        }
        case RECORD.BOOLERR: {
          if (data.length < 8) break;
          const isError = data[7] === 1;
          const text = isError ? "#ERR" : data[6] === 1 ? "TRUE" : "FALSE";
          push(
            view.getUint16(0, true),
            view.getUint16(2, true),
            text,
            isError ? text : data[6] === 1,
            isError ? "string" : "boolean",
            view.getUint16(4, true)
          );
          break;
        }
        case RECORD.FORMULA: {
          // Cached results: a number here, or a following STRING record.
          if (data.length < 20) break;
          const row = view.getUint16(0, true);
          const column = view.getUint16(2, true);
          const xfIndex = view.getUint16(4, true);
          const isString = data[12] === 0xff && data[13] === 0xff && data[6] === 0x00;
          if (isString) {
            const next = sheetRecords[index + 1];
            if (next && next.id === RECORD.STRING) {
              const { text } = readUnicodeString(next.data, 0, 2);
              push(row, column, text, text, "string", xfIndex);
            }
          } else {
            pushNumeric(row, column, view.getFloat64(6, true), xfIndex);
          }
          break;
        }
        case RECORD.MERGEDCELLS: {
          if (data.length < 2) break;
          const count = view.getUint16(0, true);
          for (let entry = 0; entry < count; entry++) {
            const offset = 2 + entry * 8;
            if (offset + 8 > data.length) break;
            merges.push({
              firstRow: view.getUint16(offset, true),
              lastRow: view.getUint16(offset + 2, true),
              firstColumn: view.getUint16(offset + 4, true),
              lastColumn: view.getUint16(offset + 6, true),
            });
          }
          break;
        }
        case RECORD.COLINFO: {
          if (data.length < 10) break;
          const first = view.getUint16(0, true);
          const last = view.getUint16(2, true);
          // Width is in 1/256 of a character.
          const width = view.getUint16(4, true) / 256;
          for (let column = first; column <= last && column < 16384; column++) {
            columnWidths.set(column, width);
          }
          break;
        }
        case RECORD.ROW: {
          if (data.length < 8) break;
          const row = view.getUint16(0, true);
          const height = view.getUint16(6, true) & 0x7fff;
          if (height) rowHeights.set(row, height / 20);
          break;
        }
        case RECORD.SETUP: {
          if (data.length < 12) break;
          const options = view.getUint16(10, true);
          // Bit 1 clear means landscape.
          landscape = (options & 0x02) === 0;
          break;
        }
        default:
          break;
      }
    }

    function pushNumeric(row: number, column: number, numeric: number, xfIndex: number) {
      const style = styleFor(xfIndex);
      const format = style?.numberFormat || "General";
      if (isDateFormat(format)) {
        cells.push({
          row,
          column,
          text: formatCellValue(numeric, format),
          value: excelSerialToDate(numeric),
          type: "date",
          style,
        });
      } else {
        cells.push({
          row,
          column,
          text: formatCellValue(numeric, format),
          value: numeric,
          type: "number",
          style,
        });
      }
    }

    sheets.push({
      name: boundSheet.name || `Sheet ${sheets.length + 1}`,
      cells,
      merges,
      columnWidths,
      rowHeights,
      rowCount: cells.reduce((max, cell) => Math.max(max, cell.row + 1), 0),
      columnCount: cells.reduce((max, cell) => Math.max(max, cell.column + 1), 0),
      landscape,
    });
  }

  if (!sheets.some((sheet) => sheet.cells.length)) {
    throw conversionErrors.noContent("Excel (.xls)");
  }
  return { sheets };
}

/** The handful of built-in formats a .xls file references by index. */
function builtinXlsFormat(index: number): string {
  const builtins: Record<number, string> = {
    0: "General",
    1: "0",
    2: "0.00",
    3: "#,##0",
    4: "#,##0.00",
    9: "0%",
    10: "0.00%",
    14: "m/d/yy",
    15: "d-mmm-yy",
    16: "d-mmm",
    17: "mmm-yy",
    18: "h:mm AM/PM",
    19: "h:mm:ss AM/PM",
    20: "h:mm",
    21: "h:mm:ss",
    22: "m/d/yy h:mm",
    49: "@",
  };
  return builtins[index] || "General";
}
