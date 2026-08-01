/**
 * PowerPoint (.pptx) -> PDF conversion.
 *
 * Slides are fixed-layout, so each slide maps to one PDF page of exactly the
 * same dimensions. Shape positions are preserved; text is re-wrapped inside its
 * own shape frame because PresentationML stores paragraphs, not lines.
 */

import { PDFDocument, rgb, type PDFPage, type RGB } from "pdf-lib";
import { parsePptx } from "./ooxml/pptx-parser";
import { FontRegistry } from "./pdf/font-registry";
import {
  baselineOffset,
  effectiveFontSize,
  layoutLines,
  measureText,
  type LaidOutLine,
} from "./pdf/layout-engine";
import { conversionErrors } from "./errors";
import type {
  ConversionProgressCallback,
  HorizontalAlignment,
  PositionedImageBlock,
  PositionedPage,
  PositionedTableBlock,
  PositionedTextBlock,
  RasterImage,
  TextRunModel,
} from "./types";

export interface PowerPointToPdfOptions {
  signal?: AbortSignal;
}

const CELL_PADDING = 4;

function hexToRgb(hex: string): RGB {
  const value = /^[0-9a-f]{6}$/i.test(hex) ? hex : "000000";
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  );
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

/**
 * Draws a laid-out line at an absolute position.
 * `top` is measured from the top of the page, matching the slide model.
 */
function drawLine(
  page: PDFPage,
  line: LaidOutLine,
  x: number,
  baselineFromTop: number,
  availableWidth: number,
  align: HorizontalAlignment,
  pageHeight: number
): void {
  let cursor = x + alignmentOffset(align, line.width, availableWidth);
  const baseline = pageHeight - baselineFromTop;

  for (const run of line.runs) {
    if (!run.safeText) continue;
    const size = effectiveFontSize(run);
    const y = baseline + baselineOffset(run);
    const color = hexToRgb(run.color);

    try {
      page.drawText(run.safeText, { x: cursor, y, size, font: run.font, color });
    } catch {
      // Unencodable residue must not abort the slide.
    }

    if (run.underline) {
      page.drawLine({
        start: { x: cursor, y: y - size * 0.12 },
        end: { x: cursor + run.width, y: y - size * 0.12 },
        thickness: Math.max(0.4, size * 0.05),
        color,
      });
    }
    if (run.strike) {
      page.drawLine({
        start: { x: cursor, y: y + size * 0.26 },
        end: { x: cursor + run.width, y: y + size * 0.26 },
        thickness: Math.max(0.4, size * 0.05),
        color,
      });
    }
    cursor += run.width;
  }
}

async function renderTextBlock(
  page: PDFPage,
  block: PositionedTextBlock,
  fonts: FontRegistry,
  pageHeight: number
): Promise<void> {
  const resolveFont = (run: TextRunModel) => fonts.get(run.fontFamily, run.bold, run.italic);
  let cursorTop = block.y;

  for (const line of block.lines) {
    const availableWidth = Math.max(12, line.width || block.width);
    // Each source paragraph may wrap into several rendered lines.
    const wrapped = await layoutLines(line.runs, availableWidth, resolveFont);

    for (const rendered of wrapped) {
      const baselineFromTop = cursorTop + rendered.ascent;
      // Skip content that overflows the slide entirely.
      if (baselineFromTop > pageHeight + 24) return;

      drawLine(
        page,
        rendered,
        line.x,
        baselineFromTop,
        availableWidth,
        block.align,
        pageHeight
      );
      cursorTop += Math.max(rendered.height, line.height);
    }

    if (!wrapped.length) cursorTop += line.height;
  }
}

async function renderImageBlock(
  page: PDFPage,
  block: PositionedImageBlock,
  document: PDFDocument,
  cache: Map<RasterImage, Awaited<ReturnType<PDFDocument["embedPng"]>>>,
  pageHeight: number
): Promise<void> {
  let embedded = cache.get(block.image);
  if (!embedded) {
    try {
      embedded =
        block.image.format === "png"
          ? await document.embedPng(block.image.data)
          : await document.embedJpg(block.image.data);
      cache.set(block.image, embedded);
    } catch {
      return;
    }
  }

  page.drawImage(embedded, {
    x: block.x,
    // PDF places images by their bottom-left corner.
    y: pageHeight - block.y - block.height,
    width: block.width,
    height: block.height,
  });
}

async function renderTableBlock(
  page: PDFPage,
  block: PositionedTableBlock,
  fonts: FontRegistry,
  pageHeight: number
): Promise<void> {
  const columnCount = Math.max(
    1,
    ...block.rows.map((row) => row.reduce((sum, cell) => sum + Math.max(1, cell.colSpan || 1), 0))
  );
  const declared = block.columnWidths.filter((width) => width > 0);
  const columnWidths =
    declared.length === columnCount
      ? declared
      : Array.from({ length: columnCount }, () => block.width / columnCount);

  let top = block.y;

  for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex++) {
    const row = block.rows[rowIndex];
    const rowHeight = block.rowHeights[rowIndex] || 20;
    let column = 0;
    let x = block.x;

    for (const cell of row) {
      const colSpan = Math.max(1, cell.colSpan || 1);
      const width = columnWidths
        .slice(column, column + colSpan)
        .reduce((sum, value) => sum + value, 0);
      column += colSpan;

      if (cell.fill) {
        page.drawRectangle({
          x,
          y: pageHeight - top - rowHeight,
          width,
          height: rowHeight,
          color: hexToRgb(cell.fill),
        });
      }

      page.drawRectangle({
        x,
        y: pageHeight - top - rowHeight,
        width,
        height: rowHeight,
        borderColor: rgb(0.55, 0.55, 0.55),
        borderWidth: 0.5,
      });

      let textTop = top + CELL_PADDING;
      for (const line of cell.lines) {
        const wrapped = await layoutLines(line.runs, Math.max(10, width - CELL_PADDING * 2), (run) =>
          fonts.get(run.fontFamily, run.bold, run.italic)
        );
        for (const rendered of wrapped) {
          drawLine(
            page,
            rendered,
            x + CELL_PADDING,
            textTop + rendered.ascent,
            width - CELL_PADDING * 2,
            cell.align === "justify" ? "left" : cell.align,
            pageHeight
          );
          textTop += rendered.height;
        }
      }

      x += width;
    }

    top += rowHeight;
  }
}

async function renderSlide(
  document: PDFDocument,
  slide: PositionedPage,
  fonts: FontRegistry,
  cache: Map<RasterImage, Awaited<ReturnType<PDFDocument["embedPng"]>>>
): Promise<void> {
  const page = document.addPage([slide.width, slide.height]);

  if (slide.background) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: slide.width,
      height: slide.height,
      color: hexToRgb(slide.background),
    });
  }

  // Images first so text and tables stay legible above them.
  for (const block of slide.blocks) {
    if (block.kind === "image") {
      await renderImageBlock(page, block, document, cache, slide.height);
    }
  }
  for (const block of slide.blocks) {
    if (block.kind === "text") {
      await renderTextBlock(page, block, fonts, slide.height);
    } else if (block.kind === "table") {
      await renderTableBlock(page, block, fonts, slide.height);
    }
  }
}

/** Converts .pptx bytes into a PDF, one page per slide. */
export async function convertPowerPointToPdf(
  data: Uint8Array,
  options: PowerPointToPdfOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  onProgress?.({ stage: "Reading presentation", progress: 0, total: 100 });
  const presentation = await parsePptx(data);

  const slideCount = presentation.pages.length;
  if (!slideCount) throw conversionErrors.noContent("PowerPoint (.pptx)");

  const document = await PDFDocument.create();
  const fonts = new FontRegistry(document);
  const cache = new Map<RasterImage, Awaited<ReturnType<PDFDocument["embedPng"]>>>();

  for (let index = 0; index < slideCount; index++) {
    if (options.signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");

    onProgress?.({
      stage: `Rendering slide ${index + 1} of ${slideCount}`,
      progress: Math.round(((index + 1) / slideCount) * 90),
      total: 100,
    });
    await renderSlide(document, presentation.pages[index], fonts, cache);
  }

  if (presentation.metadata.title) document.setTitle(presentation.metadata.title);
  if (presentation.metadata.author) document.setAuthor(presentation.metadata.author);
  if (presentation.metadata.subject) document.setSubject(presentation.metadata.subject);
  document.setProducer("PDFPilot");
  document.setCreator("PDFPilot");

  onProgress?.({ stage: "Writing PDF", progress: 95, total: 100 });
  const bytes = await document.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return bytes;
}
