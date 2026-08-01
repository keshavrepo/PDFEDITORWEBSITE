/**
 * OCR for scanned PDFs.
 *
 * Produces two things from the same recognition pass:
 *
 *  - a **searchable PDF**, where the original page image is kept and an
 *    invisible text layer is placed exactly over the recognised words, so the
 *    document looks identical but can be searched, selected and copied;
 *  - the **plain text**, for users who just want the content.
 *
 * The invisible layer is the standard approach (PDF text render mode 3): the
 * glyphs are positioned and sized to match the image, but never painted.
 */

import {
  PDFDocument,
  StandardFonts,
  TextRenderingMode,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
} from "pdf-lib";
import { conversionErrors } from "./errors";
import { sanitizeForPdf } from "./pdf/font-registry";
import {
  createOcrWorker,
  recognizePage,
  type OcrAssetPaths,
  type OcrPageResult,
  type OcrWord,
} from "./ocr/tesseract-runner";
import type { ConversionProgressCallback } from "./types";

export interface OcrOptions {
  /** Language models to use. Defaults to English. */
  languages?: string[];
  /**
   * Rendering resolution. 200 DPI is the sweet spot: high enough for accurate
   * recognition, low enough to stay responsive on long documents.
   */
  dpi?: number;
  /** Skip words Tesseract is unsure about, keeping the text layer clean. */
  minConfidence?: number;
  /** Overrides the engine asset locations. Used by the test suite only. */
  assets?: OcrAssetPaths;
  signal?: AbortSignal;
}

export interface OcrPageSummary {
  pageNumber: number;
  text: string;
  confidence: number;
  wordCount: number;
}

export interface OcrResult {
  /** The original PDF with an invisible, searchable text layer added. */
  searchablePdf: Uint8Array;
  /** All recognised text, in page order. */
  text: string;
  pages: OcrPageSummary[];
  /** Mean confidence across every recognised word, 0-100. */
  averageConfidence: number;
  language: string;
}

const DEFAULT_DPI = 200;
const PDF_DPI = 72;
const DEFAULT_MIN_CONFIDENCE = 40;
/** Guards against a single enormous page exhausting browser canvas limits. */
const MAX_CANVAS_PIXELS = 40_000_000;

/**
 * Renders one page to a PNG blob for recognition.
 * Kept separate so the OCR path never depends on the image tool.
 */
async function renderPageImage(
  page: import("pdfjs-dist").PDFPageProxy,
  dpi: number
): Promise<{ blob: Blob; pixelWidth: number; pixelHeight: number }> {
  let scale = dpi / PDF_DPI;
  const base = page.getViewport({ scale: 1 });
  const projected = base.width * scale * base.height * scale;
  if (projected > MAX_CANVAS_PIXELS) {
    scale *= Math.sqrt(MAX_CANVAS_PIXELS / projected);
  }

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));

  const context = canvas.getContext("2d", { willReadFrequently: false });
  if (!context) throw conversionErrors.processingFailed("Canvas rendering is unavailable");

  // Recognition is far more reliable against a solid white background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(conversionErrors.processingFailed("Page encoding failed")),
      "image/png"
    );
  });

  const pixelWidth = canvas.width;
  const pixelHeight = canvas.height;
  // Release the backing store straight away; scanned documents are large.
  canvas.width = 0;
  canvas.height = 0;

  return { blob, pixelWidth, pixelHeight };
}

/**
 * Draws recognised words as invisible text positioned over the page image.
 *
 * pdf-lib's `drawText` cannot express an invisible render mode or per-word
 * horizontal scaling, so the operators are emitted directly. The text matrix
 * carries the horizontal scale, which stretches each word to exactly the width
 * Tesseract measured — that is what makes selection line up with the image.
 */
function drawInvisibleText(
  page: import("pdf-lib").PDFPage,
  font: import("pdf-lib").PDFFont,
  fontKey: import("pdf-lib").PDFName,
  words: OcrWord[],
  pixelWidth: number,
  pixelHeight: number,
  minConfidence: number
): number {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const scaleX = pageWidth / pixelWidth;
  const scaleY = pageHeight / pixelHeight;
  let drawn = 0;

  for (const word of words) {
    if (word.confidence < minConfidence) continue;
    const text = sanitizeForPdf(word.text);
    if (!text.trim()) continue;

    const boxWidth = (word.x1 - word.x0) * scaleX;
    const boxHeight = (word.y1 - word.y0) * scaleY;
    if (boxWidth <= 0.5 || boxHeight <= 0.5) continue;

    // Size the glyphs to the recognised box, then stretch to its exact width.
    const fontSize = Math.max(1, boxHeight * 0.85);
    let naturalWidth: number;
    let encoded;
    try {
      naturalWidth = font.widthOfTextAtSize(text, fontSize);
      encoded = font.encodeText(text);
    } catch {
      // Characters outside the font's encoding are skipped rather than
      // corrupting the content stream.
      continue;
    }
    if (naturalWidth <= 0) continue;

    const horizontalScale = Math.max(0.05, Math.min(boxWidth / naturalWidth, 10));

    page.pushOperators(
      pushGraphicsState(),
      beginText(),
      setTextRenderingMode(TextRenderingMode.Invisible),
      setFontAndSize(fontKey, fontSize),
      // [a b c d e f]: `a` applies the horizontal stretch, e/f position the
      // baseline. PDF measures from the bottom, Tesseract from the top.
      setTextMatrix(
        horizontalScale,
        0,
        0,
        1,
        word.x0 * scaleX,
        pageHeight - word.y1 * scaleY + boxHeight * 0.18
      ),
      showText(encoded),
      endText(),
      popGraphicsState()
    );
    drawn++;
  }

  return drawn;
}

/** Recognises a scanned PDF and returns both text and a searchable PDF. */
export async function ocrPdf(
  data: Uint8Array,
  options: OcrOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<OcrResult> {
  if (typeof document === "undefined") {
    throw conversionErrors.processingFailed("OCR requires a browser environment");
  }

  const dpi = Math.max(120, Math.min(options.dpi || DEFAULT_DPI, 400));
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  onProgress?.({ stage: "Loading OCR engine", progress: 2, total: 100 });

  const { loadPdfJs } = await import("./pdf/pdf-loader");
  const pdfjs = await loadPdfJs();

  // Font and CMap packs are served from this app in the browser; in other
  // runtimes pdf.js resolves them itself, so the entries are omitted.
  const inBrowser = typeof window !== "undefined";
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    cMapPacked: true,
    ...(inBrowser
      ? { cMapUrl: "/pdfjs/cmaps/", standardFontDataUrl: "/pdfjs/standard_fonts/" }
      : {}),
  });

  let source;
  try {
    source = await task.promise;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("password")) throw conversionErrors.encrypted();
    throw conversionErrors.corrupted("PDF", error);
  }

  // The worker is started once and reused for every page; initialising it per
  // page would dominate the runtime of a long document.
  const worker = await createOcrWorker(
    options.languages,
    (ratio, status) => {
      if (status === "loading language traineddata" || status === "initializing tesseract") {
        onProgress?.({
          stage: "Loading language model",
          progress: 2 + Math.round(ratio * 6),
          total: 100,
        });
      }
    },
    options.assets
  );

  // pdf-lib rebuilds the output so the invisible layer can be added.
  let output: PDFDocument;
  try {
    output = await PDFDocument.load(data, { updateMetadata: false });
  } catch (error) {
    await worker.terminate();
    await task.destroy().catch(() => undefined);
    throw conversionErrors.corrupted("PDF", error);
  }

  const font = await output.embedFont(StandardFonts.Helvetica);
  const outputPages = output.getPages();
  // Each page needs the font in its own resource dictionary before the
  // operators above can reference it.
  const fontKeys = outputPages.map((page) => page.node.newFontDictionary(font.name, font.ref));

  const pages: OcrPageSummary[] = [];
  let confidenceTotal = 0;
  let confidenceCount = 0;

  try {
    const pageCount = source.numPages;
    if (!pageCount) throw conversionErrors.noContent("PDF");

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

      onProgress?.({
        stage: `Recognising page ${pageNumber} of ${pageCount}`,
        progress: 10 + Math.round(((pageNumber - 1) / pageCount) * 85),
        total: 100,
      });

      const page = await source.getPage(pageNumber);
      let recognised: OcrPageResult;
      let pixelWidth = 0;
      let pixelHeight = 0;

      try {
        const rendered = await renderPageImage(page, dpi);
        pixelWidth = rendered.pixelWidth;
        pixelHeight = rendered.pixelHeight;
        recognised = await recognizePage(worker, rendered.blob);
      } finally {
        page.cleanup();
      }

      const target = outputPages[pageNumber - 1];
      if (target && recognised.words.length) {
        drawInvisibleText(
          target,
          font,
          fontKeys[pageNumber - 1],
          recognised.words,
          pixelWidth,
          pixelHeight,
          minConfidence
        );
      }

      for (const word of recognised.words) {
        if (word.confidence >= minConfidence) {
          confidenceTotal += word.confidence;
          confidenceCount++;
        }
      }

      pages.push({
        pageNumber,
        text: recognised.text.trim(),
        confidence: Math.round(recognised.confidence),
        wordCount: recognised.words.length,
      });
    }
  } finally {
    await worker.terminate().catch(() => undefined);
    await task.destroy().catch(() => undefined);
  }

  const text = pages.map((page) => page.text).join("\n\n").trim();
  if (!text) {
    throw conversionErrors.invalidRequest(
      "No text could be recognised in this document. Check that the scan is legible and try a higher resolution."
    );
  }

  output.setProducer("PDFPilot");
  output.setCreator("PDFPilot OCR");

  onProgress?.({ stage: "Building searchable PDF", progress: 96, total: 100 });
  const searchablePdf = await output.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });

  return {
    searchablePdf,
    text,
    pages,
    averageConfidence: confidenceCount ? Math.round(confidenceTotal / confidenceCount) : 0,
    language: (options.languages ?? ["eng"]).join("+"),
  };
}
