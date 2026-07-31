/**
 * SpreadsheetML (.xlsx) reader.
 *
 * Built on the existing OPC helpers rather than a spreadsheet library: the
 * repository already parses OOXML for Word and PowerPoint, and the subset of
 * SpreadsheetML needed for faithful PDF output (values, shared strings,
 * styles, merges, column widths, number formats) is small and well defined.
 */

import {
  OpcPackage,
  attr,
  children,
  findAll,
  findFirst,
  nodeName,
  numAttr,
  textContent,
  type XmlNode,
  type XmlNodes,
} from "../ooxml/opc";
import { conversionErrors } from "../errors";
import { formatCellValue, isDateFormat } from "./number-format";
import type {
  CellStyle,
  MergedRange,
  SheetCell,
  SheetHorizontalAlignment,
  SheetModel,
  SheetVerticalAlignment,
  WorkbookModel,
} from "./types";

/** Converts an A1-style reference into zero-based row/column indices. */
export function parseCellReference(reference: string): { row: number; column: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(reference.trim());
  if (!match) return null;

  let column = 0;
  for (const character of match[1].toUpperCase()) {
    column = column * 26 + (character.charCodeAt(0) - 64);
  }
  return { row: Number(match[2]) - 1, column: column - 1 };
}

/** Built-in Excel number formats that matter for display. */
const BUILTIN_FORMATS: Record<number, string> = {
  0: "General",
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  12: "# ?/?",
  13: "# ??/??",
  14: "mm-dd-yy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM",
  20: "h:mm",
  21: "h:mm:ss",
  22: "m/d/yy h:mm",
  37: "#,##0 ;(#,##0)",
  38: "#,##0 ;[Red](#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;[Red](#,##0.00)",
  45: "mm:ss",
  46: "[h]:mm:ss",
  47: "mmss.0",
  48: "##0.0E+0",
  49: "@",
};

interface StyleTable {
  /** Resolved style for each `cellXfs` index. */
  formats: Array<{ style: CellStyle; numberFormat: string }>;
}

const HORIZONTAL: Record<string, SheetHorizontalAlignment> = {
  left: "left",
  center: "center",
  centerContinuous: "center",
  right: "right",
  justify: "left",
  distributed: "center",
  general: "left",
};

const VERTICAL: Record<string, SheetVerticalAlignment> = {
  top: "top",
  center: "middle",
  bottom: "bottom",
  justify: "middle",
  distributed: "middle",
};

/** Reads an ARGB or RGB colour attribute into uppercase RRGGBB. */
function readColor(node: XmlNode | undefined): string | undefined {
  if (!node) return undefined;
  const rgb = attr(node, "rgb");
  if (rgb && /^[0-9a-f]{6,8}$/i.test(rgb)) {
    // ARGB values carry a leading alpha byte.
    return rgb.length === 8 ? rgb.slice(2).toUpperCase() : rgb.toUpperCase();
  }
  return undefined;
}

async function readStyles(pkg: OpcPackage): Promise<StyleTable> {
  const table: StyleTable = { formats: [] };
  const xml = await pkg.readXml("xl/styles.xml");
  if (!xml) return table;

  const root = findFirst(xml, "styleSheet");
  if (!root) return table;
  const kids = children(root);

  // Custom number formats.
  const numberFormats = new Map<number, string>();
  const numFmts = findFirst(kids, "numFmts");
  if (numFmts) {
    for (const format of findAll(children(numFmts), "numFmt")) {
      const id = numAttr(format, "numFmtId");
      const code = attr(format, "formatCode");
      if (id !== undefined && code) numberFormats.set(id, code);
    }
  }

  // Fonts.
  const fonts: CellStyle[] = [];
  const fontsNode = findFirst(kids, "fonts");
  if (fontsNode) {
    for (const font of findAll(children(fontsNode), "font")) {
      const fontKids = children(font);
      const size = findFirst(fontKids, "sz");
      const name = findFirst(fontKids, "name");
      fonts.push({
        bold: Boolean(findFirst(fontKids, "b")),
        italic: Boolean(findFirst(fontKids, "i")),
        underline: Boolean(findFirst(fontKids, "u")),
        fontSize: size ? numAttr(size, "val") : undefined,
        fontFamily: name ? attr(name, "val") : undefined,
        color: readColor(findFirst(fontKids, "color")),
      });
    }
  }

  // Fills. Index 0/1 are the reserved none/gray125 patterns.
  const fills: Array<string | undefined> = [];
  const fillsNode = findFirst(kids, "fills");
  if (fillsNode) {
    for (const fill of findAll(children(fillsNode), "fill")) {
      const pattern = findFirst(children(fill), "patternFill");
      const type = pattern ? attr(pattern, "patternType") : undefined;
      if (!pattern || !type || type === "none") {
        fills.push(undefined);
        continue;
      }
      fills.push(readColor(findFirst(children(pattern), "fgColor")));
    }
  }

  // Cell formats reference the tables above by index.
  const cellXfs = findFirst(kids, "cellXfs");
  if (cellXfs) {
    for (const xf of findAll(children(cellXfs), "xf")) {
      const fontId = numAttr(xf, "fontId") ?? 0;
      const fillId = numAttr(xf, "fillId") ?? 0;
      const numFmtId = numAttr(xf, "numFmtId") ?? 0;
      const alignment = findFirst(children(xf), "alignment");

      const horizontalRaw = alignment ? attr(alignment, "horizontal") : undefined;
      const verticalRaw = alignment ? attr(alignment, "vertical") : undefined;

      const style: CellStyle = {
        ...(fonts[fontId] || {}),
        // `applyFill` is frequently omitted, so trust a real pattern instead.
        fill: fills[fillId],
        horizontal: horizontalRaw ? HORIZONTAL[horizontalRaw] : undefined,
        vertical: verticalRaw ? VERTICAL[verticalRaw] : undefined,
        wrapText: alignment ? attr(alignment, "wrapText") === "1" : undefined,
      };

      table.formats.push({
        style,
        numberFormat: numberFormats.get(numFmtId) || BUILTIN_FORMATS[numFmtId] || "General",
      });
    }
  }

  return table;
}

/** Shared strings may be plain `t` or rich text split across `r` runs. */
async function readSharedStrings(pkg: OpcPackage): Promise<string[]> {
  const xml = await pkg.readXml("xl/sharedStrings.xml");
  if (!xml) return [];

  const root = findFirst(xml, "sst");
  if (!root) return [];

  return findAll(children(root), "si").map((item) => {
    const kids = children(item);
    const direct = findFirst(kids, "t");
    if (direct) return textContent([direct]);
    // Rich text: concatenate every run.
    return findAll(kids, "r")
      .map((run) => {
        const runText = findFirst(children(run), "t");
        return runText ? textContent([runText]) : "";
      })
      .join("");
  });
}

interface SheetEntry {
  name: string;
  path: string;
}

/** Resolves sheet order and part paths from the workbook relationships. */
async function readSheetIndex(pkg: OpcPackage): Promise<SheetEntry[]> {
  const workbook = await pkg.readXml("xl/workbook.xml");
  if (!workbook) throw conversionErrors.corrupted("Excel");

  const root = findFirst(workbook, "workbook");
  const sheetsNode = root ? findFirst(children(root), "sheets") : undefined;
  if (!sheetsNode) return [];

  const relationships = await pkg.relationships("xl/workbook.xml");
  const entries: SheetEntry[] = [];

  for (const sheet of findAll(children(sheetsNode), "sheet")) {
    // Hidden sheets are skipped; they are not part of a printed workbook.
    const state = attr(sheet, "state");
    if (state === "hidden" || state === "veryHidden") continue;

    const name = attr(sheet, "name") || `Sheet ${entries.length + 1}`;
    const relationshipId = attr(sheet, "r:id") || attr(sheet, "id");
    const relationship = relationshipId ? relationships.get(relationshipId) : undefined;

    const target = relationship?.target;
    const path = target
      ? target.startsWith("/")
        ? target.slice(1)
        : `xl/${target.replace(/^\.\//, "")}`
      : `xl/worksheets/sheet${entries.length + 1}.xml`;

    entries.push({ name, path });
  }

  return entries;
}

function readSheetCells(
  sheetXml: XmlNodes,
  sharedStrings: string[],
  styles: StyleTable
): {
  cells: SheetCell[];
  merges: MergedRange[];
  columnWidths: Map<number, number>;
  rowHeights: Map<number, number>;
  landscape?: boolean;
} {
  const root = findFirst(sheetXml, "worksheet");
  const kids = root ? children(root) : [];

  const cells: SheetCell[] = [];
  const merges: MergedRange[] = [];
  const columnWidths = new Map<number, number>();
  const rowHeights = new Map<number, number>();

  // Column widths.
  const cols = findFirst(kids, "cols");
  if (cols) {
    for (const col of findAll(children(cols), "col")) {
      const min = numAttr(col, "min");
      const max = numAttr(col, "max");
      const width = numAttr(col, "width");
      if (min === undefined || width === undefined) continue;
      for (let index = min; index <= (max ?? min); index++) {
        columnWidths.set(index - 1, width);
      }
    }
  }

  // Page setup.
  const pageSetup = findFirst(kids, "pageSetup");
  const landscape = pageSetup ? attr(pageSetup, "orientation") === "landscape" : undefined;

  // Cell data.
  const sheetData = findFirst(kids, "sheetData");
  if (sheetData) {
    for (const row of findAll(children(sheetData), "row")) {
      const rowNumber = numAttr(row, "r");
      const height = numAttr(row, "ht");
      const rowIndex = rowNumber !== undefined ? rowNumber - 1 : cells.length;
      if (height !== undefined) rowHeights.set(rowIndex, height);

      for (const cell of findAll(children(row), "c")) {
        const parsed = readCell(cell, rowIndex, sharedStrings, styles);
        if (parsed) cells.push(parsed);
      }
    }
  }

  // Merged regions.
  const mergeCells = findFirst(kids, "mergeCells");
  if (mergeCells) {
    for (const merge of findAll(children(mergeCells), "mergeCell")) {
      const reference = attr(merge, "ref");
      if (!reference) continue;
      const [start, end] = reference.split(":");
      const from = parseCellReference(start);
      const to = end ? parseCellReference(end) : from;
      if (!from || !to) continue;
      merges.push({
        firstRow: Math.min(from.row, to.row),
        lastRow: Math.max(from.row, to.row),
        firstColumn: Math.min(from.column, to.column),
        lastColumn: Math.max(from.column, to.column),
      });
    }
  }

  return { cells, merges, columnWidths, rowHeights, landscape };
}

function readCell(
  cell: XmlNode,
  fallbackRow: number,
  sharedStrings: string[],
  styles: StyleTable
): SheetCell | null {
  const reference = attr(cell, "r");
  const position = reference ? parseCellReference(reference) : null;
  const row = position?.row ?? fallbackRow;
  const column = position?.column;
  if (column === undefined) return null;

  const type = attr(cell, "t");
  const styleIndex = numAttr(cell, "s");
  const format = styleIndex !== undefined ? styles.formats[styleIndex] : undefined;

  const kids = children(cell);
  const valueNode = findFirst(kids, "v");
  const inlineString = findFirst(kids, "is");

  let raw: string | number | boolean | Date | null = null;
  let text = "";
  let valueType: SheetCell["type"] = "empty";

  if (inlineString) {
    text = textContent([inlineString]);
    raw = text;
    valueType = "string";
  } else if (valueNode) {
    const value = textContent([valueNode]);

    if (type === "s") {
      // Shared string index.
      const index = Number(value);
      text = sharedStrings[index] ?? "";
      raw = text;
      valueType = "string";
    } else if (type === "str" || type === "e") {
      // Formula result cached as a string, or an error value.
      text = value;
      raw = value;
      valueType = "string";
    } else if (type === "b") {
      const boolean = value === "1";
      raw = boolean;
      text = boolean ? "TRUE" : "FALSE";
      valueType = "boolean";
    } else {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        const numberFormat = format?.numberFormat || "General";
        if (isDateFormat(numberFormat)) {
          const date = excelSerialToDate(numeric);
          raw = date;
          text = formatCellValue(numeric, numberFormat);
          valueType = "date";
        } else {
          raw = numeric;
          text = formatCellValue(numeric, numberFormat);
          valueType = "number";
        }
      } else {
        text = value;
        raw = value;
        valueType = "string";
      }
    }
  }

  if (!text && !format?.style?.fill) return null;

  return {
    row,
    column,
    text,
    value: raw,
    type: valueType,
    style: format ? { ...format.style, numberFormat: format.numberFormat } : undefined,
  };
}

/**
 * Converts an Excel serial date to a JS Date.
 *
 * Excel's 1900 system deliberately treats 1900 as a leap year, so serials from
 * 61 onward are offset by one day relative to a naive calculation.
 */
export function excelSerialToDate(serial: number): Date {
  const wholeDays = Math.floor(serial);
  const milliseconds = Math.round((serial - wholeDays) * 86_400_000);
  // Day 1 is 1900-01-01; the epoch below already accounts for the phantom day.
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + wholeDays * 86_400_000 + milliseconds);
}

/** Parses an .xlsx workbook into the shared spreadsheet model. */
export async function readXlsx(data: Uint8Array): Promise<WorkbookModel> {
  const pkg = await OpcPackage.open(data);
  if (!pkg.has("xl/workbook.xml")) throw conversionErrors.corrupted("Excel (.xlsx)");

  const [sharedStrings, styles, sheetIndex] = await Promise.all([
    readSharedStrings(pkg),
    readStyles(pkg),
    readSheetIndex(pkg),
  ]);

  const sheets: SheetModel[] = [];

  for (const entry of sheetIndex) {
    const xml = await pkg.readXml(entry.path);
    if (!xml) continue;

    const { cells, merges, columnWidths, rowHeights, landscape } = readSheetCells(
      xml,
      sharedStrings,
      styles
    );

    sheets.push({
      name: entry.name,
      cells,
      merges,
      columnWidths,
      rowHeights,
      rowCount: cells.reduce((max, cell) => Math.max(max, cell.row + 1), 0),
      columnCount: cells.reduce((max, cell) => Math.max(max, cell.column + 1), 0),
      landscape,
    });
  }

  if (!sheets.length) throw conversionErrors.noContent("Excel (.xlsx)");

  const core = await pkg.readXml("docProps/core.xml");
  const coreRoot = core ? findFirst(core, "cp:coreProperties") : undefined;
  const coreKids = coreRoot ? children(coreRoot) : [];
  const readCore = (name: string) => {
    const node = coreKids.find((child) => nodeName(child) === name);
    const value = node ? textContent([node]).trim() : "";
    return value || undefined;
  };

  return { sheets, title: readCore("dc:title"), author: readCore("dc:creator") };
}
