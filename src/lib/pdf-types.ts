/**
 * PDF types and lightweight validation.
 *
 * Split out of `pdf-utils.ts` so a tool page can validate a file selection and
 * render its interface without pulling in `pdf-lib`. The full processing
 * module statically imports `pdf-lib`, which is roughly 430 kB of the bundle;
 * previously every one of the twenty-seven PDF tool pages paid that cost at
 * first paint even though nothing is processed until the user picks a file.
 *
 * Nothing here touches `pdf-lib`, the DOM or any Node API, so it is safe to
 * import from a server component.
 */

export interface ProcessingProgress {
  stage: string;
  progress: number;
  total: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;
export type CompressionLevel = "low" | "medium" | "high";

export const MAX_PDF_SIZE = 100 * 1024 * 1024;

/**
 * Cheap checks that need only the `File` metadata.
 *
 * Runs synchronously on selection so an obviously wrong file is rejected
 * before the heavy parser is even fetched.
 */
export function validatePDFSelection(
  file: File,
  maxSize = MAX_PDF_SIZE
): { valid: boolean; error?: string } {
  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfMime =
    !file.type ||
    file.type === "application/pdf" ||
    file.type === "application/x-pdf";

  if (!hasPdfExtension && !hasPdfMime) {
    return { valid: false, error: `${file.name} is not a PDF file` };
  }
  if (!file.size) return { valid: false, error: `${file.name} is empty` };
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `${file.name} exceeds the ${Math.round(maxSize / 1024 / 1024)}MB file limit`,
    };
  }
  return { valid: true };
}

/**
 * Expands a page selection such as `1-3, 7, 9-11` into page numbers.
 *
 * Pure string parsing, so it stays out of the heavy module.
 */
export function parsePageSelection(selection: string, pageCount: number): number[] {
  const pages = new Set<number>();

  for (const part of selection.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      const [startText, endText] = trimmed.split("-");
      const start = parseInt(startText, 10);
      const end = parseInt(endText, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let page = Math.max(1, start); page <= Math.min(pageCount, end); page++) {
        pages.add(page);
      }
    } else {
      const page = parseInt(trimmed, 10);
      if (!Number.isNaN(page) && page >= 1 && page <= pageCount) pages.add(page);
    }
  }

  return [...pages].sort((a, b) => a - b);
}
