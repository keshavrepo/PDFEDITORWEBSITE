/**
 * Centralised pdf.js bootstrap.
 *
 * The worker is configured once and only in the browser. The same module is
 * imported by the Node conversion tests, where pdf.js runs on the main thread,
 * so worker setup is guarded rather than assumed.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import { conversionErrors } from "../errors";

type PdfJsModule = typeof import("pdfjs-dist");

let modulePromise: Promise<PdfJsModule> | null = null;

export async function loadPdfJs(): Promise<PdfJsModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        // Served from `public/`, matching the existing PDF tools.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return pdfjs;
    })();
  }
  return modulePromise;
}

export interface LoadedPdf {
  document: PDFDocumentProxy;
  destroy: () => Promise<void>;
}

/**
 * Opens a PDF for reading.
 *
 * Font data is required for accurate glyph widths and style detection, so the
 * standard font pack is resolved from the pdf.js package rather than disabled.
 */
export async function openPdf(data: Uint8Array): Promise<LoadedPdf> {
  const pdfjs = await loadPdfJs();

  try {
    const task = pdfjs.getDocument({
      data,
      // Style/width fidelity depends on real font programs being available.
      useSystemFonts: false,
      disableFontFace: true,
      // pdf.js resolves these relative to its own module URL when omitted,
      // which breaks under bundlers.
      standardFontDataUrl: resolveStandardFontUrl(),
      cMapUrl: resolveCMapUrl(),
      cMapPacked: true,
    });

    const document = await task.promise;
    return {
      document,
      // Destroying the loading task tears down the worker and its transport;
      // the document proxy itself only exposes `cleanup()`.
      destroy: async () => {
        try {
          await task.destroy();
        } catch {
          // A document that failed mid-parse may already be torn down.
        }
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("password")) throw conversionErrors.encrypted();
    throw conversionErrors.corrupted("PDF", error);
  }
}

function resolveStandardFontUrl(): string | undefined {
  if (typeof window !== "undefined") return "/pdfjs/standard_fonts/";
  return undefined;
}

function resolveCMapUrl(): string | undefined {
  if (typeof window !== "undefined") return "/pdfjs/cmaps/";
  return undefined;
}
