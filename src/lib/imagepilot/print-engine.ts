export interface PrintSheet {
  format: 'A4' | 'Letter' | '4x6';
  orientation: 'portrait' | 'landscape';
  marginsMm: number;
  gapMm: number;
  cutMarks?: boolean;
}

export function planPrintSheet(sheet: PrintSheet): { widthMm: number; heightMm: number; cellsPerRow: number; cellsPerCol: number } {
  const dims: Record<string, { w: number; h: number }> = {
    'A4': { w: 210, h: 297 }, 'Letter': { w: 216, h: 279 }, '4x6': { w: 102, h: 152 },
  };
  const d = dims[sheet.format] || dims['A4'];
  const w = sheet.orientation === 'landscape' ? d.h : d.w;
  const h = sheet.orientation === 'landscape' ? d.w : d.h;
  const contentW = w - sheet.marginsMm * 2;
  const contentH = h - sheet.marginsMm * 2;
  const cellW = (contentW - sheet.gapMm) / 2;
  const cellH = (contentH - sheet.gapMm) / 2;
  return { widthMm: w, heightMm: h, cellsPerRow: 2, cellsPerCol: 2 };
}
