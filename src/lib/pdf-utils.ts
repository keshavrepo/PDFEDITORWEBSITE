import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';

export interface ProcessingProgress {
  stage: string;
  progress: number;
  total: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

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

// Compress PDF
export async function compressPDF(
  file: File,
  onProgress?: ProgressCallback
): Promise<Blob> {
  onProgress?.({ stage: 'Compressing', progress: 50, total: 100 });
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  
  const pdfBytes = await pdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
  
  onProgress?.({ stage: 'Finalizing', progress: 100, total: 100 });
  return createPDFBlob(pdfBytes);
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

// Validate PDF file
export async function validatePDF(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'File is not a PDF' };
    }
    
    const arrayBuffer = await file.arrayBuffer();
    await PDFDocument.load(arrayBuffer);
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid or corrupted PDF file' };
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
