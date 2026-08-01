export interface ProcessingProgress {
  stage: string;
  progress: number;
  total: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;
export type CompressionLevel = 'low' | 'medium' | 'high';

export const MAX_PDF_SIZE = 100 * 1024 * 1024;

export function validatePDFSelection(
  file: File,
  maxSize = MAX_PDF_SIZE
): { valid: boolean; error?: string } {
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  const hasPdfMime =
    !file.type ||
    file.type === 'application/pdf' ||
    file.type === 'application/x-pdf';

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
