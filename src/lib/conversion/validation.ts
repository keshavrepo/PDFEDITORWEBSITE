/**
 * Content-based input validation.
 *
 * Browser-reported MIME types and file extensions are both trivially wrong, so
 * every check reads magic bytes from the file itself. PDFs must carry `%PDF-`
 * near the start; DOCX/PPTX are ZIP containers that must expose the expected
 * OOXML part.
 */

import {
  DOCX_MIME_TYPES,
  MAX_CONVERSION_SIZE,
  PDF_MIME_TYPES,
  PPTX_MIME_TYPES,
} from "./constants";
import { ConversionError, conversionErrors } from "./errors";

export type ConversionFormat = "pdf" | "docx" | "pptx";

const FORMAT_LABEL: Record<ConversionFormat, string> = {
  pdf: "PDF",
  docx: "Word (.docx)",
  pptx: "PowerPoint (.pptx)",
};

const FORMAT_EXTENSION: Record<ConversionFormat, string> = {
  pdf: ".pdf",
  docx: ".docx",
  pptx: ".pptx",
};

const FORMAT_MIME: Record<ConversionFormat, readonly string[]> = {
  pdf: PDF_MIME_TYPES,
  docx: DOCX_MIME_TYPES,
  pptx: PPTX_MIME_TYPES,
};

/** Legacy binary formats we can detect precisely enough to explain the failure. */
const LEGACY_OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Synchronous pre-flight used the instant a file is picked, so the UI can
 * reject obvious mistakes without reading the file body.
 */
export function validateSelection(
  file: File,
  format: ConversionFormat,
  maxSize = MAX_CONVERSION_SIZE
): ValidationResult {
  const extension = FORMAT_EXTENSION[format];
  const label = FORMAT_LABEL[format];
  const hasExtension = file.name.toLowerCase().endsWith(extension);
  const hasMime = !file.type || FORMAT_MIME[format].includes(file.type);

  // Accept when either signal matches; the byte-level check is authoritative.
  if (!hasExtension && !hasMime) {
    return { valid: false, error: conversionErrors.invalidFile(file.name, label).message };
  }
  if (file.size === 0) {
    return { valid: false, error: conversionErrors.emptyFile(file.name).message };
  }
  if (file.size > maxSize) {
    return { valid: false, error: conversionErrors.tooLarge(file.name, maxSize).message };
  }
  return { valid: true };
}

function bytesMatch(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Reads the head of a file without loading the whole document into memory. */
async function readHead(file: File, length: number): Promise<Uint8Array> {
  const slice = file.slice(0, Math.min(length, file.size));
  return new Uint8Array(await slice.arrayBuffer());
}

/**
 * Verifies the file body really is the requested format.
 *
 * Throws {@link ConversionError} so callers can surface an accurate message
 * instead of a generic failure later in the pipeline.
 */
export async function assertFormat(file: File, format: ConversionFormat): Promise<void> {
  const label = FORMAT_LABEL[format];
  const selection = validateSelection(file, format);
  if (!selection.valid) {
    throw new ConversionError(
      file.size === 0 ? "empty-file" : file.size > MAX_CONVERSION_SIZE ? "too-large" : "invalid-file",
      selection.error || conversionErrors.invalidFile(file.name, label).message
    );
  }

  const head = await readHead(file, 4096);

  if (format === "pdf") {
    // Producers occasionally emit a BOM or junk before the header, so scan the
    // first bytes rather than requiring offset 0.
    const prefix = new TextDecoder("latin1").decode(head);
    if (!prefix.includes("%PDF-")) {
      throw conversionErrors.invalidFile(file.name, label);
    }
    return;
  }

  // DOCX and PPTX are ZIP (PK\x03\x04) containers.
  if (bytesMatch(head, LEGACY_OLE_SIGNATURE)) {
    throw new ConversionError(
      "unsupported-format",
      `${file.name} is a legacy ${format === "docx" ? "Word 97-2003 (.doc)" : "PowerPoint 97-2003 (.ppt)"} file. Save it as ${FORMAT_EXTENSION[format]} and try again.`
    );
  }
  if (!bytesMatch(head, [0x50, 0x4b, 0x03, 0x04]) && !bytesMatch(head, [0x50, 0x4b, 0x05, 0x06])) {
    throw conversionErrors.invalidFile(file.name, label);
  }
  if (bytesMatch(head, [0x50, 0x4b, 0x05, 0x06])) {
    // An empty ZIP central directory means there are no parts at all.
    throw conversionErrors.emptyFile(file.name);
  }
}

/**
 * Full asynchronous validation used by the UI before enabling conversion.
 * Never throws: failures are returned so the caller can render them inline.
 */
export async function validateConversionInput(
  file: File,
  format: ConversionFormat
): Promise<ValidationResult> {
  try {
    await assertFormat(file, format);
    return { valid: true };
  } catch (error) {
    if (error instanceof ConversionError) return { valid: false, error: error.message };
    return { valid: false, error: conversionErrors.corrupted(FORMAT_LABEL[format], error).message };
  }
}

export function formatLabel(format: ConversionFormat): string {
  return FORMAT_LABEL[format];
}
