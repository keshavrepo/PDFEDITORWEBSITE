/**
 * Excel (.xlsx / .xls) -> PDF conversion.
 *
 * Sheets are laid out as printable pages: column widths, merged regions,
 * alignment, fonts, fills and number formatting are carried across, and wide
 * sheets are split across pages horizontally the way Excel's own print engine
 * does.
 */

import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { readXlsx } from "./spreadsheet/xlsx-reader";
import { readXls } from "./spreadsheet/xls-reader";
import { FontRegistry } from "./pdf/font-registry";
import { sanitizeForPdf } from "./pdf/font-registry";
import { measureText } from "./pdf/layout-engine";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback } from "./types";
import type { CellStyle, MergedRange, SheetCell, SheetModel } from "./spreadsheet/types";

export interface ExcelToPdfOptions {
  /** Force an orientation; otherwise the sheet's own print setup is used. */
  orientation?: "portrait" | "landscape" | "auto";
  signal?: AbortSignal;
}

const PAGE_WIDTH = 595.276; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CELL_PADDING = 4;
const MIN_ROW_HEIGHT = 16;
const GRID_COLOR = rgb(0.78, 0.78, 0.78);
const DEFAULT_FONT_SIZE = 10;

/** Excel's default column width is 8.43 characters (~64px at 96dpi). */
const DEFAULT_COLUMN_CHARS = 8.43;
/** Approximate points per character unit for the default 11pt Calibri. */
const POINTS_PER_CHAR = 5.25;

function hexToRgb(hex: string | undefined, fallback: RGB): RGB {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255
  );
}

/** Builds a dense lookup so cell rendering stays O(1) per position. */
function indexCells(sheet: SheetModel): Map<string, SheetCell> {
  const map = new Map<string, SheetCell>();
  for (const cell of sheet.cells) map.set(`${cell.row}:${cell.column}`, cell);
  return map;
}

/**
 * Maps every covered position to the merge that owns it, so continuation
 * cells are skipped and the anchor spans the full region.
 */
function indexMerges(merges: MergedRange[]): Map<string, MergedRange> {
  const map = new Map<string, MergedRange>();
  for (const merge of merges) {
    for (let row = merge.firstRow; row <= merge.lastRow; row++) {
      for (let column = merge.firstColumn; column <= merge.lastColumn; column++) {
        map.set(`${row}:${column}`, merge);
      }
    }
  }
  return map;
}

function columnWidthPoints(sheet: SheetModel, column: number): number {
  const chars = sheet.columnWidths.get(column) ?? DEFAULT_COLUMN_CHARS;
  // Clamp so a single absurd column cannot make the page unusable.
  return Math.max(24, Math.min(chars * POINTS_PER_CHAR, 320));
}

function rowHeightPoints(sheet: SheetModel, row: number): number {
  return Math.max(MIN_ROW_HEIGHT, sheet.rowHeights.get(row) ?? MIN_ROW_HEIGHT);
}

/** Splits columns into horizontal page bands that fit the printable width. */
function planColumnBands(sheet: SheetModel, availableWidth: number): Array<{ start: number; end: number }> {
  const bands: Array<{ start: number; end: number }> = [];
  let start = 0;

  while (start < sheet.columnCount) {
    let width = 0;
    let end = start;
    while (end < sheet.columnCount) {
      const next = columnWidthPoints(sheet, end);
      // Always place at least one column, even if it overflows on its own.
      if (width + next > availableWidth && end > start) break;
      width += next;
      end++;
    }
    bands.push({ start, end });
    start = end;
  }

  return bands.length ? bands : [{ start: 0, end: 1 }];
}

interface RenderContext {
  document: PDFDocument;
  fonts: FontRegistry;
  pageWidth: number;
  pageHeight: number;
}

async function resolveFont(fonts: FontRegistry, style: CellStyle | undefined): Promise<PDFFont> {
  return fonts.get(style?.fontFamily || "Calibri", Boolean(style?.bold), Boolean(style?.italic));
}

/** Draws text clipped to its cell, with alignment and simple wrapping. */
function drawCellText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  color: RGB,
  x: number,
  top: number,
  width: number,
  height: number,
  style: CellStyle | undefined,
  numericDefaultRight: boolean
): void {
  const safe = sanitizeForPdf(text);
  if (!safe.trim()) return;

  const innerWidth = Math.max(4, width - CELL_PADDING * 2);
  const lines: string[] = [];

  if (style?.wrapText) {
    // Greedy word wrap; spreadsheets rarely need more than a few lines.
    let current = "";
    for (const word of safe.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureText(font, candidate, size) <= innerWidth || !current) current = candidate;
      else {
        lines.push(current);
        current = word;
      }
      if (lines.length >= 6) break;
    }
    if (current) lines.push(current);
  } else {
    // Truncate with an ellipsis so text never bleeds into the next column.
    let candidate = safe;
    if (measureText(font, candidate, size) > innerWidth) {
      while (candidate.length > 1 && measureText(font, `${candidate}…`, size) > innerWidth) {
        candidate = candidate.slice(0, -1);
      }
      candidate = candidate.length > 1 ? `${candidate}…` : candidate;
    }
    lines.push(candidate);
  }

  const lineHeight = size * 1.18;
  const blockHeight = lines.length * lineHeight;

  // Vertical placement inside the cell.
  const vertical = style?.vertical || "bottom";
  let cursorTop: number;
  if (vertical === "top") cursorTop = top - CELL_PADDING;
  else if (vertical === "middle") cursorTop = top - (height - blockHeight) / 2;
  else cursorTop = top - height + blockHeight + CELL_PADDING * 0.5;

  const horizontal = style?.horizontal || (numericDefaultRight ? "right" : "left");

  for (const line of lines) {
    const lineWidth = measureText(font, line, size);
    let textX = x + CELL_PADDING;
    if (horizontal === "center") textX = x + (width - lineWidth) / 2;
    else if (horizontal === "right") textX = x + width - lineWidth - CELL_PADDING;

    const baseline = cursorTop - size * 0.82;
    try {
      page.drawText(line, { x: textX, y: baseline, size, font, color });
    } catch {
      // A residual encoding problem must not abort the sheet.
    }
    cursorTop -= lineHeight;
  }
}

async function renderSheet(
  context: RenderContext,
  sheet: SheetModel,
  onPage: () => void
): Promise<void> {
  const cellIndex = indexCells(sheet);
  const mergeIndex = indexMerges(sheet.merges);

  const availableWidth = context.pageWidth - MARGIN * 2;
  const availableHeight = context.pageHeight - MARGIN * 2;
  const bands = planColumnBands(sheet, availableWidth);

  for (const band of bands) {
    let row = 0;

    while (row < sheet.rowCount) {
      const page = context.document.addPage([context.pageWidth, context.pageHeight]);
      onPage();

      // Sheet name header, so multi-sheet PDFs stay navigable.
      const headerFont = await context.fonts.get("Calibri", true, false);
      page.drawText(sanitizeForPdf(sheet.name), {
        x: MARGIN,
        y: context.pageHeight - MARGIN + 6,
        size: 9,
        font: headerFont,
        color: rgb(0.42, 0.42, 0.42),
      });

      let top = context.pageHeight - MARGIN;
      const rowsOnPage: number[] = [];

      // Fill the page with as many rows as fit.
      while (row < sheet.rowCount) {
        const height = rowHeightPoints(sheet, row);
        if (top - height < context.pageHeight - MARGIN - availableHeight) break;
        rowsOnPage.push(row);
        top -= height;
        row++;
        if (top <= MARGIN) break;
      }
      if (!rowsOnPage.length) break;

      // Pass 1: fills, so text is never painted over.
      let y = context.pageHeight - MARGIN;
      for (const rowIndex of rowsOnPage) {
        const height = rowHeightPoints(sheet, rowIndex);
        let x = MARGIN;
        for (let column = band.start; column < band.end; column++) {
          const width = columnWidthPoints(sheet, column);
          const key = `${rowIndex}:${column}`;
          const merge = mergeIndex.get(key);
          const cell = cellIndex.get(key);

          // Only the merge anchor paints; continuations are skipped.
          const isContinuation =
            merge && (merge.firstRow !== rowIndex || merge.firstColumn !== column);

          if (!isContinuation && cell?.style?.fill) {
            const spanWidth = merge
              ? sumColumnWidths(sheet, merge.firstColumn, Math.min(merge.lastColumn + 1, band.end))
              : width;
            const spanHeight = merge
              ? sumRowHeights(sheet, merge.firstRow, merge.lastRow + 1)
              : height;
            page.drawRectangle({
              x,
              y: y - spanHeight,
              width: spanWidth,
              height: spanHeight,
              color: hexToRgb(cell.style.fill, rgb(1, 1, 1)),
            });
          }
          x += width;
        }
        y -= height;
      }

      // Pass 2: gridlines.
      y = context.pageHeight - MARGIN;
      const bandWidth = sumColumnWidths(sheet, band.start, band.end);
      for (const rowIndex of rowsOnPage) {
        const height = rowHeightPoints(sheet, rowIndex);
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: MARGIN + bandWidth, y },
          thickness: 0.4,
          color: GRID_COLOR,
        });
        y -= height;
      }
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + bandWidth, y },
        thickness: 0.4,
        color: GRID_COLOR,
      });

      const bottom = y;
      let verticalX = MARGIN;
      for (let column = band.start; column <= band.end; column++) {
        page.drawLine({
          start: { x: verticalX, y: context.pageHeight - MARGIN },
          end: { x: verticalX, y: bottom },
          thickness: 0.4,
          color: GRID_COLOR,
        });
        if (column < band.end) verticalX += columnWidthPoints(sheet, column);
      }

      // Pass 3: text.
      y = context.pageHeight - MARGIN;
      for (const rowIndex of rowsOnPage) {
        const height = rowHeightPoints(sheet, rowIndex);
        let x = MARGIN;
        for (let column = band.start; column < band.end; column++) {
          const width = columnWidthPoints(sheet, column);
          const key = `${rowIndex}:${column}`;
          const merge = mergeIndex.get(key);
          const cell = cellIndex.get(key);

          const isContinuation =
            merge && (merge.firstRow !== rowIndex || merge.firstColumn !== column);

          if (cell && !isContinuation) {
            const spanWidth = merge
              ? sumColumnWidths(sheet, merge.firstColumn, Math.min(merge.lastColumn + 1, band.end))
              : width;
            const spanHeight = merge
              ? sumRowHeights(sheet, merge.firstRow, merge.lastRow + 1)
              : height;

            const font = await resolveFont(context.fonts, cell.style);
            const size = Math.min(cell.style?.fontSize || DEFAULT_FONT_SIZE, 18);
            drawCellText(
              page,
              cell.text,
              font,
              size,
              hexToRgb(cell.style?.color, rgb(0, 0, 0)),
              x,
              y,
              spanWidth,
              spanHeight,
              cell.style,
              cell.type === "number" || cell.type === "date"
            );
          }
          x += width;
        }
        y -= height;
      }
    }
  }
}

function sumColumnWidths(sheet: SheetModel, start: number, end: number): number {
  let total = 0;
  for (let column = start; column < end; column++) total += columnWidthPoints(sheet, column);
  return total;
}

function sumRowHeights(sheet: SheetModel, start: number, end: number): number {
  let total = 0;
  for (let row = start; row < end; row++) total += rowHeightPoints(sheet, row);
  return total;
}

/** Detects the workbook format from its magic bytes. */
function isZipContainer(data: Uint8Array): boolean {
  return data.length > 4 && data[0] === 0x50 && data[1] === 0x4b;
}

/** Converts .xlsx or .xls bytes into a printable PDF. */
export async function convertExcelToPdf(
  data: Uint8Array,
  options: ExcelToPdfOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  onProgress?.({ stage: "Reading workbook", progress: 5, total: 100 });

  const workbook = isZipContainer(data) ? await readXlsx(data) : await readXls(data);
  const sheetsWithContent = workbook.sheets.filter((sheet) => sheet.cells.length > 0);
  if (!sheetsWithContent.length) throw conversionErrors.noContent("Excel");

  const document = await PDFDocument.create();
  const fonts = new FontRegistry(document);

  let pagesRendered = 0;
  for (let index = 0; index < sheetsWithContent.length; index++) {
    if (options.signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");

    const sheet = sheetsWithContent[index];
    onProgress?.({
      stage: `Rendering sheet ${index + 1} of ${sheetsWithContent.length}`,
      progress: 10 + Math.round((index / sheetsWithContent.length) * 80),
      total: 100,
    });

    // Orientation: explicit option wins, else the sheet's own print setup.
    const landscape =
      options.orientation === "landscape" ||
      (options.orientation !== "portrait" && sheet.landscape === true);

    await renderSheet(
      {
        document,
        fonts,
        pageWidth: landscape ? PAGE_HEIGHT : PAGE_WIDTH,
        pageHeight: landscape ? PAGE_WIDTH : PAGE_HEIGHT,
      },
      sheet,
      () => {
        pagesRendered++;
      }
    );
  }

  if (!pagesRendered) throw conversionErrors.noContent("Excel");

  if (workbook.title) document.setTitle(workbook.title);
  if (workbook.author) document.setAuthor(workbook.author);
  document.setProducer("PDFPilot");
  document.setCreator("PDFPilot");

  onProgress?.({ stage: "Writing PDF", progress: 95, total: 100 });
  const bytes = await document.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return bytes;
}
