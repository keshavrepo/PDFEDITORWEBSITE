/**
 * PDF -> Excel (.xlsx) conversion.
 *
 * Reuses the existing PDF extraction and layout analysis: tables detected from
 * whitespace corridors become real rows and columns, and any remaining text is
 * placed on the sheet so nothing from the page is lost.
 *
 * One worksheet is produced per PDF page, which keeps multi-page documents
 * navigable and preserves page order.
 */

import { extractPdf } from "./pdf/pdf-extractor";
import {
  analyzePage,
  buildLines,
  type AnalyzedLine,
  type AnalyzedTable,
} from "./pdf/layout-analyzer";
import { analyzeTextQuality, buildFontSignals } from "./text-quality";
import { writeXlsx } from "./spreadsheet/xlsx-writer";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback } from "./types";
import type { MergedRange, SheetCell, SheetModel } from "./spreadsheet/types";

export interface PdfToExcelOptions {
  /** Skip the text-quality gate. Diagnostics only. */
  skipQualityCheck?: boolean;
  signal?: AbortSignal;
}

/** Excel character units per point, used to turn PDF widths into columns. */
const CHARS_PER_POINT = 1 / 5.25;
const MIN_COLUMN_CHARS = 6;
const MAX_COLUMN_CHARS = 60;

/**
 * Parses a cell's text into a typed value.
 *
 * Numbers must survive the round trip so the workbook stays computable, but
 * strings that merely look numeric (IDs, phone numbers, codes with leading
 * zeros) must not be silently converted.
 */
function toTypedCell(text: string): Pick<SheetCell, "text" | "value" | "type"> {
  const trimmed = text.trim();
  if (!trimmed) return { text: "", value: null, type: "empty" };

  // Currency and thousands separators are common in PDF tables.
  const numericCandidate = trimmed
    .replace(/^[$£€¥₹]\s?/, "")
    .replace(/,/g, "")
    .replace(/%$/, "")
    .replace(/^\((.*)\)$/, "-$1");

  const isNumeric =
    /^-?\d+(\.\d+)?$/.test(numericCandidate) &&
    // Preserve leading zeros; they carry meaning.
    !/^0\d/.test(numericCandidate.replace(/^-/, ""));

  if (isNumeric) {
    const value = Number(numericCandidate);
    if (Number.isFinite(value)) {
      // Percentages keep their display text but store the numeric value.
      return { text: trimmed, value: trimmed.endsWith("%") ? value / 100 : value, type: "number" };
    }
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return { text: trimmed, value: /^true$/i.test(trimmed), type: "boolean" };
  }

  return { text: trimmed, value: trimmed, type: "string" };
}

/** Converts a detected table into sheet rows starting at `startRow`. */
function appendTable(
  table: AnalyzedTable,
  startRow: number,
  cells: SheetCell[],
  columnWidths: Map<number, number>
): { nextRow: number; headerRow: number | null; columnCount: number } {
  const columnCount = Math.max(1, table.columnEdges.length - 1);

  // Column widths come from the detected corridor geometry.
  for (let column = 0; column < columnCount; column++) {
    const points = table.columnEdges[column + 1] - table.columnEdges[column];
    const chars = Math.max(MIN_COLUMN_CHARS, Math.min(points * CHARS_PER_POINT, MAX_COLUMN_CHARS));
    const existing = columnWidths.get(column) ?? 0;
    columnWidths.set(column, Math.max(existing, chars));
  }

  table.rows.forEach((row, rowIndex) => {
    for (let column = 0; column < columnCount; column++) {
      const lines = row[column] || [];
      const text = lines.map((line) => line.text).join(" ").trim();
      if (!text) continue;

      const typed = toTypedCell(text);
      const isBold = lines[0]?.items.every((item) => item.font.bold) ?? false;
      cells.push({
        row: startRow + rowIndex,
        column,
        ...typed,
        style: isBold ? { bold: true } : undefined,
      });
    }
  });

  // Treat an all-bold first row as the header.
  const firstRow = table.rows[0];
  const headerIsBold =
    firstRow &&
    firstRow.some((cell) => cell.length > 0) &&
    firstRow.every((cell) => !cell.length || cell[0].items.every((item) => item.font.bold));

  return {
    nextRow: startRow + table.rows.length,
    headerRow: headerIsBold ? startRow : null,
    columnCount,
  };
}

/** Places non-tabular text so page content is never dropped. */
function appendTextLine(
  line: AnalyzedLine,
  row: number,
  cells: SheetCell[]
): void {
  const text = line.text.trim();
  if (!text) return;
  const typed = toTypedCell(text);
  const isBold = line.items.every((item) => item.font.bold);
  cells.push({ row, column: 0, ...typed, style: isBold ? { bold: true } : undefined });
}

/** Converts PDF bytes into an editable Excel workbook. */
export async function convertPdfToExcel(
  data: Uint8Array,
  options: PdfToExcelOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  const extracted = await extractPdf(
    data,
    // Image pixels cannot be placed in a spreadsheet grid, but their geometry
    // is still needed so scanned pages are recognised by the quality gate.
    { includeImages: true, imageGeometryOnly: true, signal: options.signal },
    (progress) =>
      onProgress?.({
        stage: progress.stage,
        progress: progress.progress,
        total: progress.total * 2,
      })
  );

  const pageCount = extracted.pages.length;

  // Same guard as the other PDF converters: never emit a workbook of garbage.
  // This runs before the empty check so scanned pages report that OCR is
  // needed rather than a generic "no content" error.
  if (!options.skipQualityCheck) {
    const items = extracted.pages.flatMap((page) => page.items);
    const quality = analyzeTextQuality({
      pages: extracted.pages,
      fontSignals: buildFontSignals(items, extracted.fontEncodings),
    });
    if (quality.strategy !== "native") throw conversionErrors.ocrRequired(quality.summary);
  }

  const hasText = extracted.pages.some((page) => page.items.length > 0);
  if (!hasText) throw conversionErrors.noContent("PDF");

  const sheets: SheetModel[] = [];
  const headerRows: Array<number | null> = [];

  extracted.pages.forEach((page, pageIndex) => {
    if (options.signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");

    onProgress?.({
      stage: `Building sheet ${pageIndex + 1} of ${pageCount}`,
      progress: pageCount + pageIndex,
      total: pageCount * 2,
    });

    const { blocks } = analyzePage(page);
    const cells: SheetCell[] = [];
    const merges: MergedRange[] = [];
    const columnWidths = new Map<number, number>();

    let row = 0;
    let headerRow: number | null = null;
    let columnCount = 1;

    for (const block of blocks) {
      if (block.kind === "table") {
        const result = appendTable(block, row, cells, columnWidths);
        row = result.nextRow;
        columnCount = Math.max(columnCount, result.columnCount);
        // The first table's header row is the one worth freezing.
        if (headerRow === null) headerRow = result.headerRow;
        // Blank spacer row between blocks keeps the sheet readable.
        row += 1;
      } else {
        for (const line of block.lines) {
          appendTextLine(line, row, cells);
          row++;
        }
        row += 1;
      }
    }

    // Pages that yielded nothing still get a sheet so page order is preserved.
    if (!cells.length) {
      sheets.push({
        name: `Page ${pageIndex + 1}`,
        cells: [],
        merges: [],
        columnWidths: new Map(),
        rowHeights: new Map(),
        rowCount: 0,
        columnCount: 0,
      });
      headerRows.push(null);
      return;
    }

    // Give the free-text column a usable default width.
    if (!columnWidths.has(0)) columnWidths.set(0, 40);

    sheets.push({
      name: `Page ${pageIndex + 1}`,
      cells,
      merges,
      columnWidths,
      rowHeights: new Map(),
      rowCount: cells.reduce((max, cell) => Math.max(max, cell.row + 1), 0),
      columnCount: Math.max(
        columnCount,
        cells.reduce((max, cell) => Math.max(max, cell.column + 1), 0)
      ),
    });
    headerRows.push(headerRow);
  });

  onProgress?.({ stage: "Writing workbook", progress: pageCount * 2 - 1, total: pageCount * 2 });
  const bytes = await writeXlsx(sheets, {
    title: extracted.metadata.title || "Converted from PDF",
    author: extracted.metadata.author || "PDFPilot",
    headerRows,
  });
  onProgress?.({ stage: "Completed", progress: pageCount * 2, total: pageCount * 2 });
  return bytes;
}

export { buildLines };
