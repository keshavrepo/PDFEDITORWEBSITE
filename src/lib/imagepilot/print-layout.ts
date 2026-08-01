/**
 * General-purpose print layout studio.
 *
 * The passport studio already lays out copies of a single image on a sheet of
 * paper; this module is the same idea, generalised. The user picks a paper
 * size, a margin, a gap and a target number of copies; the planner produces
 * the grid that fits the most copies without overlap, and the exporter turns
 * the grid into a printable PDF or image.
 *
 * Reuses the passport studio's `planPrintSheet` for the geometry: a sheet
 * can be tried in both orientations and the one that fits more copies wins.
 * Adding "general print layout" is a matter of exposing that engine to
 * different inputs (any photo, any paper, any spacing) rather than writing a
 * second planner.
 */

import { mmToPx, planPrintSheet, type PrintSheetSpec, type SheetLayout } from "./passport";

/* -------------------------------------------------------------------------- */
/* Paper catalogue                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every common paper size, in portrait orientation. The planner also tries
 * landscape and picks the orientation that fits more copies.
 */
export const PAPER_SIZES: PrintSheetSpec[] = [
  { id: "a3", label: "A3 — 297 × 420 mm", widthMm: 297, heightMm: 420 },
  { id: "a4", label: "A4 — 210 × 297 mm", widthMm: 210, heightMm: 297 },
  { id: "a5", label: "A5 — 148 × 210 mm", widthMm: 148, heightMm: 210 },
  { id: "letter", label: "US Letter — 8.5 × 11 in", widthMm: 215.9, heightMm: 279.4 },
  { id: "legal", label: "US Legal — 8.5 × 14 in", widthMm: 215.9, heightMm: 355.6 },
  { id: "tabloid", label: "Tabloid — 11 × 17 in", widthMm: 279.4, heightMm: 431.8 },
  { id: "4x6", label: "4 × 6 in photo paper", widthMm: 152.4, heightMm: 101.6 },
  { id: "5x7", label: "5 × 7 in photo paper", widthMm: 177.8, heightMm: 127 },
  { id: "8x10", label: "8 × 10 in photo paper", widthMm: 203.2, heightMm: 254 },
  { id: "11x14", label: "11 × 14 in poster", widthMm: 279.4, heightMm: 355.6 },
];

export function getPaper(id: string): PrintSheetSpec | undefined {
  return PAPER_SIZES.find((entry) => entry.id === id);
}

/* -------------------------------------------------------------------------- */
/* Cell spec                                                                  */
/* -------------------------------------------------------------------------- */

/** Describes a single cell on the print sheet. */
export interface CellSpec {
  id: string;
  label: string;
  /** Cell width in millimetres. */
  widthMm: number;
  /** Cell height in millimetres. */
  heightMm: number;
  /**
   * Optional padding inside the cell, in millimetres, so content never sits
   * flush against the cut line.
   */
  paddingMm: number;
  /** Optional background colour, or null for transparent. */
  background: string | null;
  /** Optional border drawn around the cell. */
  border: boolean;
}

export const commonCellPresets: Array<{
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  description: string;
}> = [
  { id: "business-card", label: "Business card", widthMm: 85, heightMm: 55, description: "Standard 3.5 × 2 in" },
  { id: "postcard", label: "Postcard", widthMm: 148, heightMm: 105, description: "A6 landscape" },
  { id: "greeting-card", label: "Greeting card", widthMm: 105, heightMm: 148, description: "A6 portrait" },
  { id: "square-2x2", label: "Square 2 in", widthMm: 50.8, heightMm: 50.8, description: "Inch-square photo" },
  { id: "square-3x3", label: "Square 3 in", widthMm: 76.2, heightMm: 76.2, description: "Inch-square photo" },
  { id: "square-4x4", label: "Square 4 in", widthMm: 101.6, heightMm: 101.6, description: "Inch-square photo" },
  { id: "wallet", label: "Wallet 2.5 × 3.5 in", widthMm: 63.5, heightMm: 88.9, description: "US wallet photo" },
  { id: "4x6-photo", label: "4 × 6 photo", widthMm: 101.6, heightMm: 152.4, description: "Standard photo print" },
  { id: "5x7-photo", label: "5 × 7 photo", widthMm: 127, heightMm: 177.8, description: "Mid-size photo" },
  { id: "8x10-photo", label: "8 × 10 photo", widthMm: 203.2, heightMm: 254, description: "Large photo" },
  { id: "a7", label: "A7 card", widthMm: 105, heightMm: 74, description: "Greeting-card A7" },
  { id: "a6", label: "A6 card", widthMm: 148, heightMm: 105, description: "Greeting-card A6" },
  { id: "cd", label: "CD / DVD label", widthMm: 120, heightMm: 120, description: "Optical media label" },
];

export const defaultCellSpec: CellSpec = {
  id: "custom",
  label: "Custom",
  widthMm: 85,
  heightMm: 55,
  paddingMm: 2,
  background: null,
  border: true,
};

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export type DuplicateMode = "fixed" | "fill" | "grid";

export interface PrintLayoutSettings {
  paper: string;
  cell: CellSpec;
  /** Gap between cells, in millimetres. */
  gapMm: number;
  /** Sheet margin on every side, in millimetres. */
  marginMm: number;
  /** Print resolution. */
  dpi: number;
  /** How the cell count is decided. */
  duplicateMode: DuplicateMode;
  /** "fixed": this many copies, clamped to capacity. */
  fixedCopies: number;
  /** "grid": this many columns and rows, regardless of paper. */
  gridColumns: number;
  gridRows: number;
  /** Bleed in millimetres — extra image extended past the cell edge. */
  bleedMm: number;
  /** Cut marks drawn around every cell. */
  cutMarks: boolean;
  /** Crop marks at the sheet corners. */
  registrationMarks: boolean;
}

export const defaultPrintLayoutSettings: PrintLayoutSettings = {
  paper: "a4",
  cell: { ...defaultCellSpec },
  gapMm: 2,
  marginMm: 5,
  dpi: 300,
  duplicateMode: "fill",
  fixedCopies: 8,
  gridColumns: 3,
  gridRows: 3,
  bleedMm: 0,
  cutMarks: true,
  registrationMarks: false,
};

/* -------------------------------------------------------------------------- */
/* Layout planner                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Result of laying out cells on a sheet.
 *
 * Distinct from `SheetLayout` because general printing has more options: a
 * fixed grid, a fill-everything mode, a bleed region around each cell and
 * a different mark convention.
 */
export interface PrintLayoutPlan {
  paper: PrintSheetSpec;
  /** Sheet size in pixels. */
  width: number;
  height: number;
  /** Cell placement, in pixels, on the rendered sheet. */
  cells: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    /** Cell index, 0..count-1. */
    index: number;
  }>;
  /** Total cells produced. */
  count: number;
  /** Total cells that fit on the sheet. */
  capacity: number;
  columns: number;
  rows: number;
  /** True when the planner chose landscape over portrait. */
  landscape: boolean;
  /** The cell spec used, after bleed was added. */
  cell: CellSpec;
  /** Bleed added to each cell, in pixels. */
  bleed: number;
}

/**
 * Plans a print layout.
 *
 * The three duplication modes are intentionally orthogonal: "fill" packs as
 * many cells as possible, "fixed" takes a target count and clamps, "grid"
 * forces a specific columns × rows regardless of paper size. The grid mode
 * is the one printers often use when the user wants every cell to be
 * identical, even on a too-small sheet.
 */
export function planPrintLayout(
  settings: PrintLayoutSettings,
  source: { widthMm: number; heightMm: number }
): PrintLayoutPlan {
  const paper = getPaper(settings.paper) ?? PAPER_SIZES[1];
  const cellSpec: CellSpec = { ...settings.cell };

  // Build a faux passport spec for `planPrintSheet`. That function expects a
  // single image with a width and height; here every cell is a copy of the
  // source, so the same numbers are used.
  const spec = {
    id: "print-cell",
    country: "",
    label: cellSpec.label,
    widthMm: cellSpec.widthMm,
    heightMm: cellSpec.heightMm,
    headMin: 0,
    headMax: 0,
    crownGap: 0,
    backgrounds: [],
    notes: "",
  };

  let capacity = 0;
  let columns = 0;
  let rows = 0;
  let landscape = false;

  if (settings.duplicateMode === "grid") {
    columns = Math.max(1, settings.gridColumns);
    rows = Math.max(1, settings.gridRows);
    capacity = columns * rows;
    landscape = false;
  } else {
    const requested = settings.duplicateMode === "fixed" ? settings.fixedCopies : Number.MAX_SAFE_INTEGER;
    const layout = planPrintSheet(spec, paper, settings.dpi, requested, settings.gapMm, settings.marginMm);
    capacity = layout.capacity;
    columns = layout.columns;
    rows = layout.rows;
    // The passport planner tries both orientations and returns the chosen
    // one's pixel dimensions. Landscape picks a sheet width that matches
    // the paper's portrait *height*, so the chosen width being smaller
    // than the portrait *width* is the signal that landscape won.
    const portraitWidth = mmToPx(paper.widthMm, settings.dpi);
    landscape = layout.width !== portraitWidth;
  }

  // Cell dimensions in the chosen orientation. In landscape mode the cell
  // is rotated 90° so the photo fits more naturally across the long side.
  const cellWidthMm = landscape ? cellSpec.heightMm : cellSpec.widthMm;
  const cellHeightMm = landscape ? cellSpec.widthMm : cellSpec.heightMm;
  const cellPx = mmToPx(cellWidthMm, settings.dpi);
  const cellPy = mmToPx(cellHeightMm, settings.dpi);
  const gap = mmToPx(settings.gapMm, settings.dpi);
  const margin = mmToPx(settings.marginMm, settings.dpi);
  const bleed = mmToPx(settings.bleedMm, settings.dpi);

  // Sheet pixel dimensions in the chosen orientation.
  const paperWidthMm = landscape ? paper.heightMm : paper.widthMm;
  const paperHeightMm = landscape ? paper.widthMm : paper.heightMm;
  const sheetWidth = mmToPx(paperWidthMm, settings.dpi);
  const sheetHeight = mmToPx(paperHeightMm, settings.dpi);

  // Cells. For the grid mode we honour the requested grid even if it
  // overflows the sheet, because a user picking "3 × 3" on A6 explicitly
  // asked for 3 × 3 and the planner should not silently shrink it.
  let cells: PrintLayoutPlan["cells"];
  if (settings.duplicateMode === "grid") {
    cells = [];
    const totalWidth = columns * cellPx + (columns - 1) * gap;
    const totalHeight = rows * cellPy + (rows - 1) * gap;
    const originX = Math.max(margin, (sheetWidth - totalWidth) / 2);
    const originY = Math.max(margin, (sheetHeight - totalHeight) / 2);
    for (let index = 0; index < columns * rows; index++) {
      const c = index % columns;
      const r = Math.floor(index / columns);
      cells.push({
        x: originX + c * (cellPx + gap),
        y: originY + r * (cellPy + gap),
        width: cellPx,
        height: cellPy,
        index,
      });
    }
  } else {
    const usableWidth = sheetWidth - margin * 2;
    const usableHeight = sheetHeight - margin * 2;
    const colsForFill = Math.max(1, Math.floor((usableWidth + gap) / (cellPx + gap)));
    const rowsForFill = Math.max(1, Math.floor((usableHeight + gap) / (cellPy + gap)));
    const totalCount = settings.duplicateMode === "fixed"
      ? Math.min(settings.fixedCopies, colsForFill * rowsForFill)
      : colsForFill * rowsForFill;
    const totalWidth = colsForFill * cellPx + (colsForFill - 1) * gap;
    const totalHeight = rowsForFill * cellPy + (rowsForFill - 1) * gap;
    const originX = margin + Math.max(0, (usableWidth - totalWidth) / 2);
    const originY = margin + Math.max(0, (usableHeight - totalHeight) / 2);
    cells = [];
    for (let index = 0; index < totalCount; index++) {
      const c = index % colsForFill;
      const r = Math.floor(index / colsForFill);
      cells.push({
        x: originX + c * (cellPx + gap),
        y: originY + r * (cellPy + gap),
        width: cellPx,
        height: cellPy,
        index,
      });
    }
    columns = colsForFill;
    rows = rowsForFill;
    capacity = colsForFill * rowsForFill;
  }

  return {
    paper,
    width: sheetWidth,
    height: sheetHeight,
    cells,
    count: cells.length,
    capacity,
    columns,
    rows,
    landscape,
    cell: cellSpec,
    bleed,
  };
}

/* -------------------------------------------------------------------------- */
/* Sheet rendering                                                            */
/* -------------------------------------------------------------------------- */

export interface RenderedSheet {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  count: number;
}

/**
 * Renders a single sheet of paper to a PNG blob.
 *
 * The image is fit into every cell using cover scaling, which is the right
 * choice for "this photo, repeated on a sheet" jobs: a portrait orientation
 * phone photo on a landscape business card will fill the card top and
 * bottom, rather than letterboxing, which is what a print shop would do.
 */
export async function renderPrintSheet(
  plan: PrintLayoutPlan,
  source: { width: number; height: number; image: CanvasImageSource },
  factory: { create: (w: number, h: number) => { canvas: CanvasImageSource; ctx: CanvasRenderingContext2D } },
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>,
  options: { cutMarks?: boolean; registrationMarks?: boolean; cellBorder?: boolean } = {}
): Promise<RenderedSheet> {
  const cutMarks = options.cutMarks ?? true;
  const registrationMarks = options.registrationMarks ?? false;
  const cellBorder = options.cellBorder ?? true;
  const { canvas, ctx } = factory.create(plan.width, plan.height);
  // White background so blank cells look like paper.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, plan.width, plan.height);

  for (const cell of plan.cells) {
    // Cover-fit the image into the cell, with bleed if requested.
    const targetWidth = cell.width + plan.bleed * 2;
    const targetHeight = cell.height + plan.bleed * 2;
    const scale = Math.max(targetWidth / source.width, targetHeight / source.height);
    const drawWidth = source.width * scale;
    const drawHeight = source.height * scale;
    const drawX = cell.x - plan.bleed + (targetWidth - drawWidth) / 2;
    const drawY = cell.y - plan.bleed + (targetHeight - drawHeight) / 2;

    // Cell background, if any.
    if (plan.cell.background) {
      ctx.fillStyle = plan.cell.background;
      ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
    }

    ctx.drawImage(source.image, drawX, drawY, drawWidth, drawHeight);

    // Cut marks, in the print-shop convention: short lines outside the cell
    // edges, with a 3 mm gap from the corner.
    if (cutMarks) {
      const markLength = Math.max(8, Math.round(plan.width * 0.005));
      const inset = Math.max(2, Math.round(plan.width * 0.0015));
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = Math.max(1, Math.round(plan.width * 0.0006));
      const drawMark = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      // Top-left.
      drawMark(cell.x - inset - markLength, cell.y, cell.x - inset, cell.y);
      drawMark(cell.x, cell.y - inset - markLength, cell.x, cell.y - inset);
      // Top-right.
      drawMark(cell.x + cell.width + inset, cell.y, cell.x + cell.width + inset + markLength, cell.y);
      drawMark(cell.x + cell.width, cell.y - inset - markLength, cell.x + cell.width, cell.y - inset);
      // Bottom-left.
      drawMark(cell.x - inset - markLength, cell.y + cell.height, cell.x - inset, cell.y + cell.height);
      drawMark(cell.x, cell.y + cell.height + inset, cell.x, cell.y + cell.height + inset + markLength);
      // Bottom-right.
      drawMark(cell.x + cell.width + inset, cell.y + cell.height, cell.x + cell.width + inset + markLength, cell.y + cell.height);
      drawMark(cell.x + cell.width, cell.y + cell.height + inset, cell.x + cell.width, cell.y + cell.height + inset + markLength);
    }

    // Optional cell border (for the cell preview).
    if (cellBorder && plan.cell.border) {
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = Math.max(1, Math.round(plan.width * 0.0006));
      ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.width - 1, cell.height - 1);
    }
  }

  // Registration marks at the sheet corners — the small targets that print
  // shops use to align plates on a press. Skipped by default because home
  // printers do not need them.
  if (registrationMarks) {
    const size = Math.max(8, Math.round(plan.width * 0.006));
    const inset = Math.max(8, Math.round(plan.width * 0.005));
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = Math.max(1, Math.round(plan.width * 0.0006));
    const drawCross = (cx: number, cy: number) => {
      ctx.beginPath();
      ctx.moveTo(cx - size, cy);
      ctx.lineTo(cx + size, cy);
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx, cy + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    };
    drawCross(inset, inset);
    drawCross(plan.width - inset, inset);
    drawCross(inset, plan.height - inset);
    drawCross(plan.width - inset, plan.height - inset);
  }

  const blob = await toBlob(canvas, "image/png");
  return { blob, width: plan.width, height: plan.height, bytes: blob.size, count: plan.cells.length };
}

/* -------------------------------------------------------------------------- */
/* Multi-page output                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Produces a single ZIP-ready map of pages for a large run.
 *
 * When a fixed number of copies does not fit on one sheet, the planner
 * produces more pages rather than overflowing the paper. The caller is
 * expected to hand each `page.blob` to its own download or to a ZIP.
 */
export interface PagedRun {
  pages: RenderedSheet[];
  totalCells: number;
  totalBytes: number;
}

export async function planPages(
  plan: PrintLayoutPlan,
  totalCopies: number,
  source: { width: number; height: number; image: CanvasImageSource },
  factory: { create: (w: number, h: number) => { canvas: CanvasImageSource; ctx: CanvasRenderingContext2D } },
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>
): Promise<PagedRun> {
  const cellsPerSheet = plan.capacity;
  if (cellsPerSheet <= 0) {
    return { pages: [], totalCells: 0, totalBytes: 0 };
  }
  const sheetCount = Math.ceil(totalCopies / cellsPerSheet);
  const pages: RenderedSheet[] = [];
  for (let i = 0; i < sheetCount; i++) {
    const remaining = totalCopies - i * cellsPerSheet;
    const pagePlan: PrintLayoutPlan = {
      ...plan,
      cells: plan.cells.slice(0, Math.min(remaining, cellsPerSheet)),
      count: Math.min(remaining, cellsPerSheet),
    };
    pages.push(await renderPrintSheet(pagePlan, source, factory, toBlob));
  }
  return {
    pages,
    totalCells: totalCopies,
    totalBytes: pages.reduce((sum, page) => sum + page.bytes, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

export interface LayoutSummary {
  paper: string;
  cellsPerSheet: number;
  totalCopies: number;
  sheetCount: number;
  cellSizeMm: string;
  totalPaperMm: string;
  cellSizePx: string;
  totalPaperPx: string;
}

export function summariseLayout(plan: PrintLayoutPlan, totalCopies: number): LayoutSummary {
  const cellsPerSheet = plan.capacity;
  const sheetCount = cellsPerSheet > 0 ? Math.ceil(totalCopies / cellsPerSheet) : 0;
  return {
    paper: `${plan.paper.label}${plan.landscape ? " (landscape)" : ""}`,
    cellsPerSheet,
    totalCopies,
    sheetCount,
    cellSizeMm: `${plan.cell.widthMm} × ${plan.cell.heightMm} mm`,
    totalPaperMm: `${plan.paper.widthMm} × ${plan.paper.heightMm} mm`,
    cellSizePx: `${plan.cells[0]?.width ?? 0} × ${plan.cells[0]?.height ?? 0} px`,
    totalPaperPx: `${plan.width} × ${plan.height} px`,
  };
}
