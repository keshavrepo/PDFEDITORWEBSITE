import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';

export interface ProcessingProgress {
  stage: string;
  progress: number;
  total: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;
export type CompressionLevel = 'low' | 'medium' | 'high';

export const MAX_PDF_SIZE = 100 * 1024 * 1024;

// Helper to convert Uint8Array to Blob properly
function createPDFBlob(pdfBytes: Uint8Array): Blob {
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
}

// Merge multiple PDFs into one
export async function mergePDFs(
  files: File[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const mergedPdf = await PDFDocument.create();
  
  for (let i = 0; i < files.length; i++) {
    onProgress?.({ stage: 'Loading', progress: i, total: files.length });
    
    const arrayBuffer = await files[i].arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }
  
  onProgress?.({ stage: 'Finalizing', progress: files.length, total: files.length });
  const pdfBytes = await mergedPdf.save();
  return createPDFBlob(pdfBytes);
}

// Split PDF into separate pages
export async function splitPDF(
  file: File,
  onProgress?: ProgressCallback
): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pageCount = pdf.getPageCount();
  const splitPdfs: Blob[] = [];
  
  for (let i = 0; i < pageCount; i++) {
    onProgress?.({ stage: 'Splitting', progress: i + 1, total: pageCount });
    
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdf, [i]);
    newPdf.addPage(copiedPage);
    
    const pdfBytes = await newPdf.save();
    splitPdfs.push(createPDFBlob(pdfBytes));
  }
  
  return splitPdfs;
}

// Extract specific pages
export async function extractPages(
  file: File,
  pageNumbers: number[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  
  for (let i = 0; i < pageNumbers.length; i++) {
    onProgress?.({ stage: 'Extracting', progress: i + 1, total: pageNumbers.length });
    
    const pageIndex = pageNumbers[i] - 1;
    const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
    newPdf.addPage(copiedPage);
  }
  
  const pdfBytes = await newPdf.save();
  return createPDFBlob(pdfBytes);
}

// Delete pages from PDF
export async function deletePages(
  file: File,
  pageNumbers: number[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const totalPages = pdf.getPageCount();
  
  const pagesToKeep = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(page => !pageNumbers.includes(page));
  
  return extractPages(file, pagesToKeep, onProgress);
}

// Rotate pages
export async function rotatePages(
  file: File,
  pageNumbers: number[],
  rotation: 90 | 180 | 270,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  
  for (let i = 0; i < pageNumbers.length; i++) {
    onProgress?.({ stage: 'Rotating', progress: i + 1, total: pageNumbers.length });
    
    const pageIndex = pageNumbers[i] - 1;
    const page = pdf.getPage(pageIndex);
    page.setRotation(degrees(rotation));
  }
  
  const pdfBytes = await pdf.save();
  return createPDFBlob(pdfBytes);
}

async function runQpdf(
  file: File,
  args: string[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('This operation is only available in the browser');
  }

  onProgress?.({ stage: 'Loading processor', progress: 20, total: 100 });
  const { createQpdfRunner } = await import('qpdf-run');
  const runner = await createQpdfRunner({
    workerUrl: '/qpdf/worker.js',
    qpdfJsUrl: '/qpdf/qpdf.js',
    wasmUrl: '/qpdf/qpdf.wasm',
    timeoutMs: 120_000,
  });

  try {
    onProgress?.({ stage: 'Processing', progress: 55, total: 100 });
    const output = await runner.runOne({
      input: new Uint8Array(await file.arrayBuffer()),
      inputName: 'input.pdf',
      outputName: 'output.pdf',
      args,
    });
    onProgress?.({ stage: 'Finalizing', progress: 100, total: 100 });
    return createPDFBlob(output);
  } catch (error) {
    const qpdfError = error as { stderr?: string[]; message?: string };
    const detail = qpdfError.stderr?.find(Boolean);
    throw new Error(detail || qpdfError.message || 'PDF processing failed');
  } finally {
    await runner.destroy();
  }
}

// Losslessly compress PDF streams and object structure with qpdf.
export async function compressPDF(
  file: File,
  level: CompressionLevel = 'medium',
  onProgress?: ProgressCallback
): Promise<Blob> {
  const levelArguments: Record<CompressionLevel, string[]> = {
    low: ['--object-streams=preserve', '--stream-data=compress'],
    medium: [
      '--object-streams=generate',
      '--recompress-flate',
      '--compression-level=7',
    ],
    high: [
      '--object-streams=generate',
      '--recompress-flate',
      '--compression-level=9',
      '--linearize',
    ],
  };

  const compressed = await runQpdf(
    file,
    [...levelArguments[level], '--', 'input.pdf', 'output.pdf'],
    onProgress
  );

  // Structural optimization can make an already optimized PDF slightly larger.
  // In that case, return the original rather than claiming a false reduction.
  if (compressed.size >= file.size) {
    return new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
  }
  return compressed;
}

export function repairPDF(file: File, onProgress?: ProgressCallback): Promise<Blob> {
  return runQpdf(
    file,
    ['--object-streams=generate', '--', 'input.pdf', 'output.pdf'],
    onProgress
  );
}

export function protectPDF(
  file: File,
  password: string,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const randomOwnerPassword = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return runQpdf(
    file,
    [
      '--encrypt',
      password,
      randomOwnerPassword,
      '256',
      '--',
      'input.pdf',
      'output.pdf',
    ],
    onProgress
  );
}

export function unlockPDF(
  file: File,
  password: string,
  onProgress?: ProgressCallback
): Promise<Blob> {
  return runQpdf(
    file,
    [
      `--password=${password}`,
      '--decrypt',
      '--',
      'input.pdf',
      'output.pdf',
    ],
    onProgress
  );
}

// Add watermark to PDF
export async function addWatermark(
  file: File,
  watermarkText: string,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  
  for (let i = 0; i < pages.length; i++) {
    onProgress?.({ stage: 'Adding watermark', progress: i + 1, total: pages.length });
    
    const page = pages[i];
    const { width, height } = page.getSize();
    
    page.drawText(watermarkText, {
      x: width / 2 - (watermarkText.length * 10),
      y: height / 2,
      size: 50,
      font: font,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.3,
      rotate: degrees(-45),
    });
  }
  
  const pdfBytes = await pdf.save();
  return createPDFBlob(pdfBytes);
}

// Add page numbers
export async function addPageNumbers(
  file: File,
  position: 'bottom-center' | 'bottom-right' | 'bottom-left',
  onProgress?: ProgressCallback
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  
  for (let i = 0; i < pages.length; i++) {
    onProgress?.({ stage: 'Adding page numbers', progress: i + 1, total: pages.length });
    
    const page = pages[i];
    const { width, height } = page.getSize();
    const pageNumber = `${i + 1}`;
    
    let x = width / 2 - 10;
    if (position === 'bottom-right') x = width - 40;
    if (position === 'bottom-left') x = 30;
    
    page.drawText(pageNumber, {
      x,
      y: 20,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
  }
  
  const pdfBytes = await pdf.save();
  return createPDFBlob(pdfBytes);
}

// Reorder pages
export async function reorderPages(
  file: File,
  newOrder: number[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  
  for (let i = 0; i < newOrder.length; i++) {
    onProgress?.({ stage: 'Reordering', progress: i + 1, total: newOrder.length });
    
    const pageIndex = newOrder[i] - 1;
    const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
    newPdf.addPage(copiedPage);
  }
  
  const pdfBytes = await newPdf.save();
  return createPDFBlob(pdfBytes);
}

// Download helper
export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename);
}

// Get PDF metadata
export async function getPDFMetadata(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  
  return {
    pageCount: pdf.getPageCount(),
    title: pdf.getTitle() || '',
    author: pdf.getAuthor() || '',
    subject: pdf.getSubject() || '',
    creator: pdf.getCreator() || '',
    producer: pdf.getProducer() || '',
    creationDate: pdf.getCreationDate(),
    modificationDate: pdf.getModificationDate(),
  };
}

// Update PDF metadata
export async function updatePDFMetadata(
  file: File,
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
  }
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  
  if (metadata.title) pdf.setTitle(metadata.title);
  if (metadata.author) pdf.setAuthor(metadata.author);
  if (metadata.subject) pdf.setSubject(metadata.subject);
  if (metadata.keywords) pdf.setKeywords(metadata.keywords);
  
  const pdfBytes = await pdf.save();
  return createPDFBlob(pdfBytes);
}

export type TextPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export async function addTextToPDF(
  file: File,
  text: string,
  pageNumber: number,
  position: TextPosition,
  fontSize = 18,
  italic = false,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  if (pageNumber < 1 || pageNumber > pdf.getPageCount()) {
    throw new Error(`Page must be between 1 and ${pdf.getPageCount()}`);
  }

  onProgress?.({ stage: 'Adding text', progress: 50, total: 100 });
  const page = pdf.getPage(pageNumber - 1);
  const font = await pdf.embedFont(
    italic ? StandardFonts.TimesRomanItalic : StandardFonts.Helvetica
  );
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const margin = 36;
  const horizontal = position.split('-').at(-1);
  const x =
    horizontal === 'left'
      ? margin
      : horizontal === 'right'
        ? Math.max(margin, width - textWidth - margin)
        : Math.max(margin, (width - textWidth) / 2);
  const y = position.startsWith('top')
    ? height - fontSize - margin
    : position.startsWith('bottom')
      ? margin
      : (height - fontSize) / 2;

  page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
  onProgress?.({ stage: 'Finalizing', progress: 100, total: 100 });
  return createPDFBlob(await pdf.save());
}

export async function imagesToPDF(
  files: File[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const pdf = await PDFDocument.create();

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const bytes = await file.arrayBuffer();
    const image =
      file.type === 'image/png'
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);
    const { width, height } = image.scale(1);
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
    onProgress?.({
      stage: 'Adding images',
      progress: index + 1,
      total: files.length,
    });
  }

  return createPDFBlob(await pdf.save());
}

export async function renderPDFToImages(
  file: File,
  format: 'png' | 'jpeg' = 'png',
  onProgress?: ProgressCallback
): Promise<Blob[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const pdfDocument = await loadingTask.promise;
  const images: Blob[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is not supported');

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('Unable to encode page image')),
        format === 'png' ? 'image/png' : 'image/jpeg',
        format === 'jpeg' ? 0.92 : undefined
      );
    });
    images.push(blob);
    page.cleanup();
    onProgress?.({
      stage: 'Rendering pages',
      progress: pageNumber,
      total: pdfDocument.numPages,
    });
  }

  await loadingTask.destroy();
  return images;
}

export function parsePageSelection(selection: string, pageCount: number): number[] {
  const pages = new Set<number>();
  const normalized = selection.trim();
  if (!normalized) throw new Error('Enter at least one page');

  for (const part of normalized.split(',')) {
    const range = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!range) throw new Error(`Invalid page range: ${part.trim()}`);
    const start = Number(range[1]);
    const end = Number(range[2] || range[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Pages must be between 1 and ${pageCount}`);
    }
    for (let page = start; page <= end; page++) pages.add(page);
  }

  return [...pages].sort((a, b) => a - b);
}

// Validate PDF file contents, not only the browser-provided MIME type.
export async function validatePDF(
  file: File,
  options: { allowEncrypted?: boolean; maxSize?: number } = {}
): Promise<{ valid: boolean; error?: string }> {
  try {
    const isPdfName = file.name.toLowerCase().endsWith('.pdf');
    if (file.type && file.type !== 'application/pdf' && !isPdfName) {
      return { valid: false, error: 'File is not a PDF' };
    }
    if (!file.size) return { valid: false, error: 'The file is empty' };
    if (file.size > (options.maxSize || MAX_PDF_SIZE)) {
      return { valid: false, error: 'PDF exceeds the 100MB file limit' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const header = new TextDecoder('ascii').decode(arrayBuffer.slice(0, 5));
    if (header !== '%PDF-') {
      return { valid: false, error: 'File does not contain valid PDF data' };
    }
    if (!options.allowEncrypted) await PDFDocument.load(arrayBuffer);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return {
      valid: false,
      error: message.includes('encrypted')
        ? 'PDF is password protected. Unlock it first.'
        : 'Invalid or corrupted PDF file',
    };
  }
}

// Get page dimensions
export async function getPageDimensions(file: File): Promise<Array<{ width: number; height: number }>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  
  return pages.map(page => {
    const { width, height } = page.getSize();
    return { width, height };
  });
}
