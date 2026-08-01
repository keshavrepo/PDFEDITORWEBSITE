/**
 * Lightweight entry point for conversion UI.
 *
 * The main `@/lib/conversion` barrel re-exports every converter, which
 * transitively pulls in `pdf-lib`, `pdfjs-dist`, `docx` and `pptxgenjs` —
 * roughly 1.8 MB. A tool page needs none of that to render: it only needs to
 * validate a file selection, size a limit and turn an error into a message.
 * Importing the barrel for those few helpers meant every conversion page
 * downloaded the whole engine before the user had chosen a file.
 *
 * This module re-exports only the parts that are free of heavy dependencies.
 * The engine itself stays behind the existing `await import("@/lib/conversion")`
 * calls in each component's submit handler.
 *
 * Rule of thumb: if a component imports it at module scope, it belongs here;
 * if it is called after the user acts, import it lazily from the barrel.
 */

export {
  MAX_CONVERSION_SIZE,
  DOCX_ACCEPT,
  EXCEL_ACCEPT,
  PDF_ACCEPT,
  PPTX_ACCEPT,
  IMAGE_ACCEPT,
} from "./constants";

export { toConversionMessage } from "./errors";

export {
  validateConversionInput,
  validateSelection,
  type ConversionFormat,
} from "./validation";

export type { ConversionProgress } from "./types";

// Type-only: erased at compile time, so it costs nothing at runtime even
// though `analyze-pdf` itself is heavy.
export type { PdfAnalysis } from "./analyze-pdf";

/**
 * Expands a page-number template such as `Page {n} of {total}`.
 *
 * Pure string formatting, kept here so the page-numbering UI can preview a
 * label without pulling in the PDF writer.
 */
export function formatPageLabel(template: string, current: number, total: number): string {
  return (template || "{n}")
    .replace(/\{n\}/g, String(current))
    .replace(/\{total\}/g, String(total))
    .replace(/\{page\}/g, String(current));
}

// The OCR language table is a plain list of codes and labels; the recognition
// engine behind it is loaded separately and on demand.
export {
  DEFAULT_OCR_LANGUAGE,
  OCR_LANGUAGES,
  normalizeLanguages,
  type OcrLanguageCode,
} from "./ocr/tesseract-runner";
