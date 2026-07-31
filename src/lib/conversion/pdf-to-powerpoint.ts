/**
 * PDF -> PowerPoint (.pptx) conversion.
 *
 * Each PDF page becomes one slide of matching dimensions, and every text block
 * becomes a real, editable text box positioned where it appeared on the page.
 * Images and detected tables are placed as native PowerPoint shapes, so the
 * result is an editable deck rather than a set of page pictures.
 */

import PptxGenJS from "pptxgenjs";
import { extractPdf, type ExtractedImage } from "./pdf/pdf-extractor";
import {
  analyzePage,
  lineToRuns,
  type AnalyzedParagraph,
  type AnalyzedTable,
} from "./pdf/layout-analyzer";
import { pointsToInches } from "./constants";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback, HorizontalAlignment, TextRunModel } from "./types";

export interface PdfToPowerPointOptions {
  /** Embed images found in the PDF. Enabled by default. */
  includeImages?: boolean;
  signal?: AbortSignal;
}

/** A single styled run, matching pptxgenjs's `TextProps` shape. */
type PptxTextRun = Parameters<
  ReturnType<PptxGenJS["addSlide"]>["addText"]
>[0] extends string | (infer Item)[]
  ? Item
  : never;

const ALIGN_MAP: Record<HorizontalAlignment, "left" | "center" | "right" | "justify"> = {
  left: "left",
  center: "center",
  right: "right",
  justify: "justify",
};

function toPptxRun(run: TextRunModel, breakLine: boolean): PptxTextRun {
  return {
    text: run.text,
    options: {
      fontFace: run.fontFamily,
      fontSize: Math.max(6, Math.round(run.fontSize * 10) / 10),
      bold: run.bold,
      italic: run.italic,
      color: run.color,
      underline: run.underline ? { style: "sng" as const } : undefined,
      superscript: run.superscript || undefined,
      subscript: run.subscript || undefined,
      breakLine,
    },
  };
}

/**
 * Builds the runs for a paragraph, marking line breaks so multi-line blocks
 * keep their original structure inside a single text box.
 */
function paragraphRuns(paragraph: AnalyzedParagraph): PptxTextRun[] {
  const runs: PptxTextRun[] = [];
  const isList = Boolean(paragraph.list);

  paragraph.lines.forEach((line, lineIndex) => {
    const lineRuns = lineToRuns(line, isList && lineIndex === 0);
    const isLastLine = lineIndex === paragraph.lines.length - 1;

    lineRuns.forEach((run, runIndex) => {
      const isLastRun = runIndex === lineRuns.length - 1;
      runs.push(toPptxRun(run, isLastRun && !isLastLine));
    });
  });

  return runs;
}

/** Converts PDF bytes into a PowerPoint presentation. */
export async function convertPdfToPowerPoint(
  data: Uint8Array,
  options: PdfToPowerPointOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  const includeImages = options.includeImages !== false;

  const extracted = await extractPdf(
    data,
    { includeImages, signal: options.signal, maxImagePixels: 1600 },
    (progress) =>
      onProgress?.({
        stage: progress.stage,
        progress: progress.progress,
        total: progress.total * 2,
      })
  );

  const pageCount = extracted.pages.length;
  const hasContent = extracted.pages.some(
    (page) => page.items.length > 0 || page.images.length > 0
  );
  if (!hasContent) throw conversionErrors.noContent("PDF");

  const presentation = new PptxGenJS();
  presentation.author = extracted.metadata.author || "PDFPilot";
  presentation.company = "PDFPilot";
  presentation.title = extracted.metadata.title || "Converted presentation";
  presentation.subject = extracted.metadata.subject || "";

  // Every PDF page can differ in size; use the first page for the deck layout
  // and give each slide its own explicit geometry where needed.
  const first = extracted.pages[0];
  presentation.defineLayout({
    name: "PDFPILOT",
    width: pointsToInches(first.width),
    height: pointsToInches(first.height),
  });
  presentation.layout = "PDFPILOT";

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    if (options.signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");

    const page = extracted.pages[pageIndex];
    onProgress?.({
      stage: `Building slide ${pageIndex + 1} of ${pageCount}`,
      progress: pageCount + pageIndex,
      total: pageCount * 2,
    });

    const slide = presentation.addSlide();
    const { blocks } = analyzePage(page);

    // Images first so text boxes layer above them.
    for (const image of page.images) {
      addImage(slide, image);
    }

    for (const block of blocks) {
      if (block.kind === "table") addTable(slide, block, page.width);
      else addParagraph(slide, block, page.width);
    }
  }

  onProgress?.({
    stage: "Writing PowerPoint file",
    progress: pageCount * 2 - 1,
    total: pageCount * 2,
  });

  // `arraybuffer` keeps the implementation isomorphic; pptxgenjs would
  // otherwise try to use Node's fs or a browser download.
  const output = (await presentation.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  onProgress?.({ stage: "Completed", progress: pageCount * 2, total: pageCount * 2 });
  return new Uint8Array(output);
}

type Slide = ReturnType<PptxGenJS["addSlide"]>;

function addImage(slide: Slide, image: ExtractedImage): void {
  const base64 = bytesToBase64(image.image.data);
  slide.addImage({
    data: `data:image/${image.image.format};base64,${base64}`,
    x: pointsToInches(image.x),
    y: pointsToInches(image.y),
    w: pointsToInches(image.width),
    h: pointsToInches(image.height),
  });
}

function addParagraph(slide: Slide, paragraph: AnalyzedParagraph, pageWidth: number): void {
  const runs = paragraphRuns(paragraph);
  if (!runs.length) return;

  const fontSize = paragraph.lines[0]?.fontSize || 12;
  const width = Math.max(paragraph.right - paragraph.left, fontSize * 2);
  const height = Math.max(paragraph.bottom - paragraph.top, fontSize * 1.3);

  // A small horizontal allowance prevents PowerPoint from re-wrapping text
  // that exactly filled its measured width in the PDF.
  const padding = fontSize * 0.6;

  slide.addText(runs, {
    x: pointsToInches(Math.max(0, paragraph.left - padding / 2)),
    y: pointsToInches(Math.max(0, paragraph.top - fontSize * 0.25)),
    w: pointsToInches(Math.min(width + padding, pageWidth)),
    h: pointsToInches(height + fontSize * 0.4),
    align: ALIGN_MAP[paragraph.align],
    valign: "top",
    margin: 0,
    wrap: true,
    isTextBox: true,
    bullet: paragraph.list
      ? paragraph.list.ordered
        ? { type: "number" }
        : { type: "bullet" }
      : false,
  });
}

function addTable(slide: Slide, table: AnalyzedTable, pageWidth: number): void {
  const columnCount = Math.max(1, table.columnEdges.length - 1);
  const columnWidths = Array.from({ length: columnCount }, (_, index) =>
    pointsToInches(Math.max(12, table.columnEdges[index + 1] - table.columnEdges[index]))
  );

  const rows = table.rows.map((cells) =>
    Array.from({ length: columnCount }, (_, index) => {
      const cellLines = cells[index] || [];
      const text = cellLines.map((line) => line.text).join(" ");
      const firstRun = cellLines[0] ? lineToRuns(cellLines[0])[0] : undefined;

      return {
        text,
        options: {
          fontFace: firstRun?.fontFamily || "Arial",
          fontSize: Math.max(6, Math.round((firstRun?.fontSize || 11) * 10) / 10),
          bold: firstRun?.bold || false,
          italic: firstRun?.italic || false,
          color: firstRun?.color || "000000",
          valign: "middle" as const,
        },
      };
    })
  );

  if (!rows.length) return;

  slide.addTable(rows, {
    x: pointsToInches(Math.max(0, table.left)),
    y: pointsToInches(Math.max(0, table.top)),
    w: pointsToInches(Math.min(table.right - table.left, pageWidth)),
    colW: columnWidths,
    border: { type: "solid", pt: 0.5, color: "999999" },
    autoPage: false,
  });
}

/** Chunked base64 encoding that avoids call-stack limits on large images. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  if (typeof btoa === "function") return btoa(binary);
  // Node fallback used by the conversion test suite.
  return Buffer.from(binary, "binary").toString("base64");
}
