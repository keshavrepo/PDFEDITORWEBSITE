/**
 * PDF -> JPG / PNG rendering.
 *
 * Pages are rasterised with pdf.js at a caller-chosen DPI. Rendering needs a
 * real canvas, so this module is browser-only; the callers are client
 * components.
 */

import JSZip from "jszip";
import { loadPdfJs } from "./pdf/pdf-loader";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback } from "./types";

export type PageImageFormat = "png" | "jpeg";

export interface PdfToImageOptions {
  format?: PageImageFormat;
  /** Output resolution. 150 is screen quality, 300 is print quality. */
  dpi?: number;
  /** JPEG quality between 0 and 1. Ignored for PNG. */
  quality?: number;
  signal?: AbortSignal;
}

export interface RenderedPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

/** PDF user space is 72 units per inch. */
const PDF_DPI = 72;
const DEFAULT_DPI = 150;
/**
 * Canvas dimensions are capped by the browser. Staying under this keeps very
 * large pages from failing outright at high DPI.
 */
const MAX_CANVAS_PIXELS = 40_000_000;

/** Renders every page of a PDF to image blobs. */
export async function renderPdfPages(
  data: Uint8Array,
  options: PdfToImageOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<RenderedPage[]> {
  if (typeof document === "undefined") {
    throw conversionErrors.processingFailed("Page rendering requires a browser environment");
  }

  const format = options.format || "png";
  const dpi = Math.max(72, Math.min(options.dpi || DEFAULT_DPI, 600));
  const quality = options.quality ?? 0.92;

  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data,
    // Font faces must render, so unlike text extraction this keeps them on.
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });

  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("password")) throw conversionErrors.encrypted();
    throw conversionErrors.corrupted("PDF", error);
  }

  try {
    const pageCount = pdf.numPages;
    if (!pageCount) throw conversionErrors.noContent("PDF");

    const pages: RenderedPage[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      if (options.signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");

      onProgress?.({
        stage: `Rendering page ${pageNumber} of ${pageCount}`,
        progress: pageNumber - 1,
        total: pageCount,
      });

      const page = await pdf.getPage(pageNumber);
      try {
        let scale = dpi / PDF_DPI;
        const base = page.getViewport({ scale: 1 });
        // Reduce scale rather than fail when a page would exceed canvas limits.
        const pixels = base.width * scale * base.height * scale;
        if (pixels > MAX_CANVAS_PIXELS) {
          scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        }

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));

        const context = canvas.getContext("2d", { alpha: format === "png" });
        if (!context) throw conversionErrors.processingFailed("Canvas rendering is unavailable");

        // JPEG has no alpha channel, so flatten onto white first.
        if (format === "jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvas, canvasContext: context, viewport }).promise;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) =>
              result ? resolve(result) : reject(conversionErrors.processingFailed("Encoding failed")),
            format === "png" ? "image/png" : "image/jpeg",
            format === "jpeg" ? quality : undefined
          );
        });

        pages.push({ pageNumber, blob, width: canvas.width, height: canvas.height });

        // Free the backing store immediately; large documents add up fast.
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        page.cleanup();
      }
    }

    onProgress?.({ stage: "Rendering complete", progress: pageCount, total: pageCount });
    return pages;
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

/** Bundles rendered pages into a ZIP archive. */
export async function zipRenderedPages(
  pages: RenderedPage[],
  baseName: string,
  format: PageImageFormat,
  onProgress?: ConversionProgressCallback
): Promise<Blob> {
  const zip = new JSZip();
  const extension = format === "jpeg" ? "jpg" : "png";
  // Zero-pad so archive order matches page order in file managers.
  const width = String(pages.length).length;

  for (const page of pages) {
    // Bytes rather than the Blob itself: JSZip reads Blobs through the
    // browser's FileReader, which does not exist in every runtime.
    const bytes = new Uint8Array(await page.blob.arrayBuffer());
    zip.file(`${baseName}-page-${String(page.pageNumber).padStart(width, "0")}.${extension}`, bytes);
  }

  return zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (metadata) =>
      onProgress?.({
        stage: "Packaging archive",
        progress: Math.round(metadata.percent),
        total: 100,
      })
  );
}
