/**
 * Typed conversion failures.
 *
 * Every message here is shown directly to users, so each one states what went
 * wrong and what to do next. Internal details stay in `cause`.
 */

export type ConversionErrorCode =
  | "invalid-file"
  | "empty-file"
  | "too-large"
  | "corrupted"
  | "encrypted"
  | "unsupported-format"
  | "no-content"
  | "processing-failed";

export class ConversionError extends Error {
  readonly code: ConversionErrorCode;

  constructor(code: ConversionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConversionError";
    this.code = code;
  }
}

export const conversionErrors = {
  invalidFile: (fileName: string, expected: string) =>
    new ConversionError(
      "invalid-file",
      `${fileName} is not a ${expected} file. Choose a valid ${expected} document.`
    ),
  emptyFile: (fileName: string) =>
    new ConversionError("empty-file", `${fileName} is empty. Choose a file that contains content.`),
  tooLarge: (fileName: string, maxBytes: number) =>
    new ConversionError(
      "too-large",
      `${fileName} exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB limit. Split the document and try again.`
    ),
  corrupted: (expected: string, cause?: unknown) =>
    new ConversionError(
      "corrupted",
      `This ${expected} file is damaged and cannot be read. Repair the file and try again.`,
      { cause }
    ),
  encrypted: () =>
    new ConversionError(
      "encrypted",
      "This document is password protected. Unlock it first, then convert it."
    ),
  noContent: (expected: string) =>
    new ConversionError(
      "no-content",
      `This ${expected} file contains no readable content to convert.`
    ),
  processingFailed: (cause?: unknown) =>
    new ConversionError(
      "processing-failed",
      "The document could not be converted. Try again, or use a different file.",
      { cause }
    ),
} as const;

/** Normalises any thrown value into a user-safe message. */
export function toConversionMessage(error: unknown): string {
  if (error instanceof ConversionError) return error.message;

  const raw = error instanceof Error ? error.message : "";
  const normalized = raw.toLowerCase();

  if (normalized.includes("password") || normalized.includes("encrypted")) {
    return conversionErrors.encrypted().message;
  }
  if (
    normalized.includes("invalid pdf") ||
    normalized.includes("invalid xref") ||
    normalized.includes("corrupt") ||
    normalized.includes("end of central directory")
  ) {
    return "This file is damaged and cannot be read. Repair the file and try again.";
  }
  if (normalized.includes("out of memory") || normalized.includes("allocation")) {
    return "This document is too complex to convert in the browser. Try a smaller file.";
  }
  return conversionErrors.processingFailed(error).message;
}
