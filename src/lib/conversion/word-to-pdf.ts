/**
 * Word (.docx) -> PDF conversion.
 *
 * The .docx is parsed into the shared flow model, then laid out and rendered
 * with pdf-lib. Because a Word file stores no page images, the converter
 * performs real pagination: measuring text, breaking lines, splitting tables
 * across pages and honouring section geometry.
 */

import { PDFDocument, rgb, type PDFPage, type RGB } from "pdf-lib";
import { parseDocx } from "./ooxml/docx-parser";
import { FontRegistry } from "./pdf/font-registry";
import {
  baselineOffset,
  effectiveFontSize,
  layoutLines,
  measureText,
  type LaidOutLine,
  type MeasuredRun,
} from "./pdf/layout-engine";
import { conversionErrors } from "./errors";
import type {
  ConversionProgressCallback,
  FlowBlock,
  FlowParagraph,
  FlowSection,
  FlowTable,
  FlowTableCell,
  HorizontalAlignment,
  RasterImage,
  TextRunModel,
} from "./types";

export interface WordToPdfOptions {
  signal?: AbortSignal;
}

/** Extra leading applied to headings so they breathe like Word's defaults. */
const HEADING_SPACE_BEFORE = [16, 14, 12, 10, 8, 6];
const HEADING_SPACE_AFTER = [8, 7, 6, 5, 4, 4];
const CELL_PADDING = 4;
const TABLE_BORDER_WIDTH = 0.5;
const MIN_CONTENT_HEIGHT = 24;

function hexToRgb(hex: string): RGB {
  const value = hex.length === 6 ? hex : "000000";
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  );
}

/** Mutable pagination state shared by the drawing routines. */
class PageCursor {
  page: PDFPage;
  y: number;
  pageCount = 1;

  constructor(
    private readonly document: PDFDocument,
    private section: FlowSection
  ) {
    this.page = document.addPage([section.pageWidth, section.pageHeight]);
    this.y = section.pageHeight - section.margins.top;
  }

  get contentLeft(): number {
    return this.section.margins.left;
  }

  get contentWidth(): number {
    return Math.max(
      36,
      this.section.pageWidth - this.section.margins.left - this.section.margins.right
    );
  }

  get contentBottom(): number {
    return this.section.margins.bottom;
  }

  get remaining(): number {
    return this.y - this.contentBottom;
  }

  /** Starts a new page, preserving the current section geometry. */
  newPage(): void {
    this.page = this.document.addPage([this.section.pageWidth, this.section.pageHeight]);
    this.y = this.section.pageHeight - this.section.margins.top;
    this.pageCount++;
  }

  /** Switches to a new section, which always starts a page. */
  startSection(section: FlowSection): void {
    this.section = section;
    this.newPage();
  }

  /** True when nothing has been drawn on the current page yet. */
  get atPageTop(): boolean {
    return this.y >= this.section.pageHeight - this.section.margins.top - 0.01;
  }

  /** Starts a new page when `height` will not fit, unless the page is empty. */
  ensure(height: number): void {
    if (this.remaining < height && !this.atPageTop) this.newPage();
  }
}

function alignmentOffset(
  align: HorizontalAlignment,
  lineWidth: number,
  availableWidth: number
): number {
  if (align === "center") return Math.max(0, (availableWidth - lineWidth) / 2);
  if (align === "right") return Math.max(0, availableWidth - lineWidth);
  return 0;
}

/** Draws one laid-out line, applying justification and text decorations. */
function drawLine(
  page: PDFPage,
  line: LaidOutLine,
  x: number,
  baseline: number,
  availableWidth: number,
  align: HorizontalAlignment,
  isLastLine: boolean
): void {
  let cursor = x + alignmentOffset(align, line.width, availableWidth);

  // Justification distributes slack across inter-word gaps only.
  let extraPerGap = 0;
  if (align === "justify" && !isLastLine && line.runs.length) {
    const gaps = line.runs.reduce(
      (count, run) => count + (run.safeText.match(/ /g) || []).length,
      0
    );
    if (gaps > 0) {
      const slack = availableWidth - line.width;
      // Ignore negative or absurd slack from overflowing content.
      if (slack > 0 && slack < availableWidth * 0.4) extraPerGap = slack / gaps;
    }
  }

  for (const run of line.runs) {
    if (!run.safeText) continue;
    const size = effectiveFontSize(run);
    const y = baseline + baselineOffset(run);
    const color = hexToRgb(run.color);

    if (extraPerGap > 0 && run.safeText.includes(" ")) {
      // Draw word-by-word so the extra space lands between words.
      let segmentX = cursor;
      const segments = run.safeText.split(" ");
      segments.forEach((segment, index) => {
        if (segment) {
          drawRunText(page, run, segment, segmentX, y, size, color);
          segmentX += measureText(run.font, segment, size);
        }
        if (index < segments.length - 1) {
          segmentX += measureText(run.font, " ", size) + extraPerGap;
        }
      });
      decorate(page, run, cursor, y, segmentX - cursor, size, color);
      cursor = segmentX;
    } else {
      drawRunText(page, run, run.safeText, cursor, y, size, color);
      decorate(page, run, cursor, y, run.width, size, color);
      cursor += run.width;
    }
  }
}

function drawRunText(
  page: PDFPage,
  run: MeasuredRun,
  text: string,
  x: number,
  y: number,
  size: number,
  color: RGB
): void {
  try {
    page.drawText(text, { x, y, size, font: run.font, color });
  } catch {
    // Any residual encoding issue must not abort the document.
  }
}

function decorate(
  page: PDFPage,
  run: MeasuredRun,
  x: number,
  baseline: number,
  width: number,
  size: number,
  color: RGB
): void {
  if (width <= 0) return;
  if (run.underline) {
    page.drawLine({
      start: { x, y: baseline - size * 0.12 },
      end: { x: x + width, y: baseline - size * 0.12 },
      thickness: Math.max(0.4, size * 0.05),
      color,
    });
  }
  if (run.strike) {
    page.drawLine({
      start: { x, y: baseline + size * 0.26 },
      end: { x: x + width, y: baseline + size * 0.26 },
      thickness: Math.max(0.4, size * 0.05),
      color,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Block rendering                                                            */
/* -------------------------------------------------------------------------- */

async function renderParagraph(
  cursor: PageCursor,
  paragraph: FlowParagraph,
  fonts: FontRegistry
): Promise<void> {
  const resolveFont = (run: TextRunModel) => fonts.get(run.fontFamily, run.bold, run.italic);

  const headingIndex = paragraph.headingLevel ? paragraph.headingLevel - 1 : -1;
  const spaceBefore =
    paragraph.spaceBefore || (headingIndex >= 0 ? HEADING_SPACE_BEFORE[headingIndex] || 6 : 0);
  const spaceAfter =
    paragraph.spaceAfter || (headingIndex >= 0 ? HEADING_SPACE_AFTER[headingIndex] || 4 : 4);

  const indentLeft = Math.max(0, Math.min(paragraph.indentLeft, cursor.contentWidth - 36));
  const availableWidth = Math.max(36, cursor.contentWidth - indentLeft);

  // List markers are rendered in the hanging indent.
  let markerWidth = 0;
  let markerRun: TextRunModel | null = null;
  if (paragraph.list) {
    markerRun = {
      ...(paragraph.runs[0] || { fontFamily: "Calibri", fontSize: 11, bold: false, italic: false, color: "000000", text: "" }),
      text: `${paragraph.list.marker} `,
    };
    const markerFont = await resolveFont(markerRun);
    markerWidth = measureText(markerFont, markerRun.text, markerRun.fontSize) + 2;
  }

  const textWidth = Math.max(24, availableWidth - markerWidth);
  const lines = await layoutLines(
    paragraph.runs,
    textWidth,
    resolveFont,
    paragraph.list ? 0 : paragraph.indentFirstLine
  );

  if (!lines.length) {
    // Preserve empty paragraphs as vertical space, like Word does.
    const height = (paragraph.runs[0]?.fontSize || 11) * paragraph.lineHeight;
    cursor.ensure(height);
    cursor.y -= height;
    return;
  }

  cursor.y -= spaceBefore;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineHeight = Math.max(line.height, line.height * paragraph.lineHeight);

    // Never break onto a fresh page for a line that could not fit anywhere.
    if (cursor.remaining < lineHeight && !cursor.atPageTop) cursor.newPage();

    const baseline = cursor.y - line.ascent * paragraph.lineHeight;
    const firstLineOffset = index === 0 && !paragraph.list ? Math.max(0, paragraph.indentFirstLine) : 0;
    const x = cursor.contentLeft + indentLeft + markerWidth + firstLineOffset;

    if (index === 0 && markerRun) {
      const markerFont = await resolveFont(markerRun);
      try {
        cursor.page.drawText(markerRun.text.trimEnd(), {
          x: cursor.contentLeft + indentLeft,
          y: baseline,
          size: markerRun.fontSize,
          font: markerFont,
          color: hexToRgb(markerRun.color),
        });
      } catch {
        // A missing bullet glyph must not break the list.
      }
    }

    drawLine(
      cursor.page,
      line,
      x,
      baseline,
      textWidth - firstLineOffset,
      paragraph.align,
      index === lines.length - 1
    );
    cursor.y -= lineHeight;
  }

  cursor.y -= spaceAfter;
}

async function renderImage(
  cursor: PageCursor,
  block: Extract<FlowBlock, { kind: "image" }>,
  document: PDFDocument,
  embedCache: Map<RasterImage, Awaited<ReturnType<PDFDocument["embedPng"]>>>
): Promise<void> {
  let embedded = embedCache.get(block.image);
  if (!embedded) {
    try {
      embedded =
        block.image.format === "png"
          ? await document.embedPng(block.image.data)
          : await document.embedJpg(block.image.data);
      embedCache.set(block.image, embedded);
    } catch {
      // Unsupported or damaged image data: skip rather than fail the document.
      return;
    }
  }

  // Fit within the text column, preserving the aspect ratio.
  const maxWidth = cursor.contentWidth;
  const scale = Math.min(1, maxWidth / block.width);
  let width = block.width * scale;
  let height = block.height * scale;

  const maxHeight = cursor.page.getHeight() - cursor.contentBottom - 36;
  if (height > maxHeight) {
    const heightScale = maxHeight / height;
    width *= heightScale;
    height *= heightScale;
  }

  if (cursor.remaining < height + 6 && !cursor.atPageTop) cursor.newPage();

  const x = cursor.contentLeft + alignmentOffset(block.align, width, cursor.contentWidth);
  cursor.y -= height;
  cursor.page.drawImage(embedded, { x, y: cursor.y, width, height });
  cursor.y -= 6;
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

interface PreparedCell {
  lines: LaidOutLine[];
  paragraphs: FlowParagraph[];
  colSpan: number;
  fill?: string;
  height: number;
  skip: boolean;
  /** Absolute width in points, resolved from the grid. */
  width: number;
  /** Horizontal offset from the table's left edge. */
  offset: number;
}

/**
 * Resolves grid columns to absolute widths.
 *
 * Word stores either absolute widths (`w:tblW type="dxa"`) or bare proportions
 * (`pct`/`auto`, where the grid values are only ratios). Treating proportions
 * as points collapses the table, so the two cases are handled separately.
 */
function resolveColumnWidths(table: FlowTable, availableWidth: number): number[] {
  const columnCount = Math.max(
    1,
    ...table.rows.map((row) => row.reduce((sum, cell) => sum + Math.max(1, cell.colSpan), 0))
  );

  const targetWidth = table.widthPercent
    ? availableWidth * (table.widthPercent / 100)
    : availableWidth;

  const declared = table.columnWidths.filter((width) => width > 0);
  if (declared.length !== columnCount) {
    return Array.from({ length: columnCount }, () => targetWidth / columnCount);
  }

  const total = declared.reduce((sum, width) => sum + width, 0);
  if (total <= 0) {
    return Array.from({ length: columnCount }, () => targetWidth / columnCount);
  }

  if (table.proportionalColumns) {
    // Ratios: always fill the target width.
    return declared.map((width) => (width / total) * targetWidth);
  }

  // Absolute widths: keep them unless the table would overflow the page.
  const scale = total > availableWidth ? availableWidth / total : 1;
  return declared.map((width) => width * scale);
}

async function prepareRow(
  row: FlowTableCell[],
  columnWidths: number[],
  fonts: FontRegistry
): Promise<PreparedCell[]> {
  const prepared: PreparedCell[] = [];
  let column = 0;
  let offset = 0;

  for (const cell of row) {
    const colSpan = Math.max(1, cell.colSpan);
    const width =
      columnWidths.slice(column, column + colSpan).reduce((sum, value) => sum + value, 0) ||
      columnWidths[Math.min(column, columnWidths.length - 1)] ||
      0;
    const cellOffset = offset;
    column += colSpan;
    offset += width;

    const paragraphs = cell.blocks.filter(
      (block): block is FlowParagraph => block.kind === "paragraph"
    );

    const lines: LaidOutLine[] = [];
    for (const paragraph of paragraphs) {
      const paragraphLines = await layoutLines(
        paragraph.runs,
        Math.max(12, width - CELL_PADDING * 2),
        (run) => fonts.get(run.fontFamily, run.bold, run.italic)
      );
      lines.push(...paragraphLines);
    }

    const height =
      lines.reduce((sum, line) => sum + line.height * 1.15, 0) + CELL_PADDING * 2;

    prepared.push({
      lines,
      paragraphs,
      colSpan,
      fill: cell.fill,
      height: Math.max(height, 16),
      skip: cell.verticalMerge === "continue",
      width,
      offset: cellOffset,
    });
  }

  return prepared;
}

async function renderTable(
  cursor: PageCursor,
  table: FlowTable,
  fonts: FontRegistry
): Promise<void> {
  const columnWidths = resolveColumnWidths(table, cursor.contentWidth);

  for (const row of table.rows) {
    const prepared = await prepareRow(row, columnWidths, fonts);
    const rowHeight = Math.max(...prepared.map((cell) => cell.height), 16);

    // Start a new page when the row cannot fit, keeping rows intact.
    if (cursor.remaining < rowHeight) {
      // A row taller than a whole page can never fit, so drawing it on a fresh
      // page (rather than paging forever) is the only terminating choice.
      const fitsOnAPage = rowHeight <= cursor.page.getHeight() - cursor.contentBottom - 36;
      if (fitsOnAPage) {
        if (!cursor.atPageTop) cursor.newPage();
      } else if (cursor.remaining < MIN_CONTENT_HEIGHT && !cursor.atPageTop) {
        cursor.newPage();
      }
    }

    const top = cursor.y;

    for (const cell of prepared) {
      const x = cursor.contentLeft + cell.offset;
      const cellWidth = cell.width;
      if (cellWidth <= 0) continue;

      if (cell.fill) {
        cursor.page.drawRectangle({
          x,
          y: top - rowHeight,
          width: cellWidth,
          height: rowHeight,
          color: hexToRgb(cell.fill),
        });
      }

      if (table.hasBorders) {
        cursor.page.drawRectangle({
          x,
          y: top - rowHeight,
          width: cellWidth,
          height: rowHeight,
          borderColor: rgb(0.4, 0.4, 0.4),
          borderWidth: TABLE_BORDER_WIDTH,
        });
      }

      if (!cell.skip) {
        let textY = top - CELL_PADDING;
        for (const line of cell.lines) {
          textY -= line.ascent;
          const align = cell.paragraphs[0]?.align || "left";
          drawLine(
            cursor.page,
            line,
            x + CELL_PADDING,
            textY,
            cellWidth - CELL_PADDING * 2,
            align === "justify" ? "left" : align,
            true
          );
          textY -= line.descent + line.height * 0.15;
        }
      }

    }

    cursor.y -= rowHeight;
  }

  cursor.y -= 6;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Converts .docx bytes into a PDF. */
export async function convertWordToPdf(
  data: Uint8Array,
  options: WordToPdfOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  onProgress?.({ stage: "Reading Word document", progress: 0, total: 100 });
  const flow = await parseDocx(data);

  const document = await PDFDocument.create();
  const fonts = new FontRegistry(document);
  const embedCache = new Map<RasterImage, Awaited<ReturnType<PDFDocument["embedPng"]>>>();

  const totalBlocks = flow.sections.reduce((sum, section) => sum + section.blocks.length, 0) || 1;
  let processed = 0;

  let cursor: PageCursor | null = null;

  for (let sectionIndex = 0; sectionIndex < flow.sections.length; sectionIndex++) {
    const section = flow.sections[sectionIndex];
    if (!cursor) cursor = new PageCursor(document, section);
    else if (section.blocks.length) cursor.startSection(section);

    for (const block of section.blocks) {
      if (options.signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");

      processed++;
      if (processed % 8 === 0) {
        onProgress?.({
          stage: "Laying out pages",
          progress: Math.round((processed / totalBlocks) * 90),
          total: 100,
        });
      }

      switch (block.kind) {
        case "paragraph":
          await renderParagraph(cursor, block, fonts);
          break;
        case "image":
          await renderImage(cursor, block, document, embedCache);
          break;
        case "table":
          await renderTable(cursor, block, fonts);
          break;
        case "page-break":
          cursor.newPage();
          break;
      }
    }
  }

  if (!cursor || document.getPageCount() === 0) {
    throw conversionErrors.noContent("Word (.docx)");
  }

  if (flow.metadata.title) document.setTitle(flow.metadata.title);
  if (flow.metadata.author) document.setAuthor(flow.metadata.author);
  if (flow.metadata.subject) document.setSubject(flow.metadata.subject);
  if (flow.metadata.keywords?.length) document.setKeywords(flow.metadata.keywords);
  document.setProducer("PDFPilot");
  document.setCreator("PDFPilot");

  onProgress?.({ stage: "Writing PDF", progress: 95, total: 100 });
  const bytes = await document.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return bytes;
}
