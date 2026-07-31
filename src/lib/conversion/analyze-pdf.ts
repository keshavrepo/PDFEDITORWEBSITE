/**
 * Pre-flight analysis for PDF conversions.
 *
 * Runs before any output is generated so the user is told up front whether a
 * document can be converted natively, instead of receiving a Word file full of
 * garbage. The result drives both the badge in the UI and the engine choice.
 */

import { extractPdf } from "./pdf/pdf-extractor";
import { analyzeTextQuality, buildFontSignals, type TextQualityReport } from "./text-quality";
import { selectEngine } from "./engines/registry";
import type { ConversionEngine, OutputFormat } from "./engines/types";
import type { ConversionProgressCallback } from "./types";

/** Message shown whenever a document's text layer cannot be trusted. */
export const OCR_REQUIRED_MESSAGE =
  "This PDF uses embedded or legacy fonts that cannot be converted directly into editable text. OCR is required for accurate conversion.";

export type ConversionBadge = "native" | "ocr-required";

export interface PdfAnalysis {
  quality: TextQualityReport;
  badge: ConversionBadge;
  /** True when native conversion is safe to run. */
  canConvertNatively: boolean;
  /** Engine chosen for this document, or null when none can handle it. */
  engine: ConversionEngine | null;
  /** User-facing explanation, present only when conversion is blocked. */
  blockedReason?: string;
  /** Secondary detail line shown under the blocking message. */
  detail?: string;
}

export interface AnalyzePdfOptions {
  output?: OutputFormat;
  signal?: AbortSignal;
}

/**
 * Analyses a PDF and decides how (or whether) it can be converted.
 *
 * Images are skipped during analysis because only the text layer matters here,
 * which keeps the check fast even for large documents. Page geometry is still
 * read so scanned pages can be recognised.
 */
export async function analyzePdfForConversion(
  data: Uint8Array,
  options: AnalyzePdfOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<PdfAnalysis> {
  const output = options.output || "docx";

  const extracted = await extractPdf(
    data,
    // Image *placement* is needed to spot scanned pages, but the pixel data is
    // not. Geometry-only extraction avoids decoding full-page scans, which
    // keeps the pre-flight check fast even on large scanned documents.
    { includeImages: true, imageGeometryOnly: true, signal: options.signal },
    (progress) =>
      onProgress?.({
        stage: "Checking text quality",
        progress: progress.progress,
        total: progress.total,
      })
  );

  const items = extracted.pages.flatMap((page) => page.items);
  const quality = analyzeTextQuality({
    pages: extracted.pages,
    fontSignals: buildFontSignals(items, extracted.fontEncodings),
  });

  const selection = await selectEngine(output, quality);
  const canConvertNatively = selection.engine?.id === "native-pdf";

  return {
    quality,
    badge: quality.strategy === "native" ? "native" : "ocr-required",
    canConvertNatively,
    engine: selection.engine,
    blockedReason: selection.engine ? undefined : OCR_REQUIRED_MESSAGE,
    detail: selection.engine ? undefined : quality.summary,
  };
}
