/**
 * Tesseract worker management.
 *
 * The engine, its WebAssembly core and every language model are served from
 * `public/tesseract`, so recognition runs completely offline and no page image
 * is ever sent to a third party. That matters here more than usual: OCR is
 * applied to exactly the documents users are least willing to upload.
 */

import type { ConversionProgressCallback } from "../types";
import { conversionErrors } from "../errors";

/** Languages whose models are vendored with the app. */
export const OCR_LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "hin", label: "Hindi" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "spa", label: "Spanish" },
] as const;

export type OcrLanguageCode = (typeof OCR_LANGUAGES)[number]["code"];

export const DEFAULT_OCR_LANGUAGE: OcrLanguageCode = "eng";

/** One recognised word with its position in the source image. */
export interface OcrWord {
  text: string;
  confidence: number;
  /** Pixel bounds within the rendered page image. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrPageResult {
  text: string;
  confidence: number;
  words: OcrWord[];
}

/** Only the parts of the Tesseract API this module relies on. */
interface TesseractWorker {
  recognize: (
    image: unknown,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>
  ) => Promise<{ data: TesseractData }>;
  terminate: () => Promise<void>;
}

interface TesseractBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TesseractData {
  text: string;
  confidence: number;
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{
        words?: Array<{ text: string; confidence: number; bbox: TesseractBox }>;
      }>;
    }>;
  }>;
}

/**
 * Validates a language selection against the vendored models.
 * Unknown codes fall back to English rather than failing the whole job.
 */
export function normalizeLanguages(languages: string[] | undefined): string {
  const supported = new Set<string>(OCR_LANGUAGES.map((entry) => entry.code));
  const selected = (languages ?? []).filter((code) => supported.has(code));
  // Tesseract accepts several models joined with `+`, which lets a page mix
  // scripts (a Hindi form with English numerals, for example).
  return selected.length ? selected.join("+") : DEFAULT_OCR_LANGUAGE;
}

/** Locations of the vendored engine assets, served from this app's origin. */
export interface OcrAssetPaths {
  workerPath: string;
  langPath: string;
  corePath: string;
}

const BROWSER_ASSETS: OcrAssetPaths = {
  workerPath: "/tesseract/worker.min.js",
  langPath: "/tesseract/lang",
  corePath: "/tesseract/core",
};

/**
 * Creates a worker configured to load everything from our own origin.
 *
 * `assets` exists so the conversion test suite can point at the same files on
 * disk; production always uses the served paths above.
 */
export async function createOcrWorker(
  languages: string[] | undefined,
  onProgress?: (ratio: number, status: string) => void,
  assets: OcrAssetPaths = BROWSER_ASSETS
): Promise<TesseractWorker> {
  const { createWorker } = await import("tesseract.js");
  const language = normalizeLanguages(languages);

  try {
    const worker = await createWorker(language, 1, {
      // Everything below is served by this app; nothing is fetched remotely.
      workerPath: assets.workerPath,
      langPath: assets.langPath,
      corePath: assets.corePath,
      gzip: true,
      logger: onProgress
        ? (message: { status?: string; progress?: number }) => {
            onProgress(message.progress ?? 0, message.status ?? "");
          }
        : undefined,
    });
    return worker as unknown as TesseractWorker;
  } catch (error) {
    throw conversionErrors.processingFailed(
      error instanceof Error ? error.message : "The OCR engine could not start"
    );
  }
}

/** Runs recognition on one page image and flattens the word hierarchy. */
export async function recognizePage(
  worker: TesseractWorker,
  image: Blob | string
): Promise<OcrPageResult> {
  // `blocks` is required for word positions; without it only plain text comes
  // back, which is not enough to build a searchable text layer.
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true });

  const words: OcrWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text?.trim();
          if (!text) continue;
          words.push({
            text,
            confidence: word.confidence,
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1,
          });
        }
      }
    }
  }

  return {
    text: data.text ?? "",
    confidence: data.confidence ?? 0,
    words,
  };
}

export type { ConversionProgressCallback };
