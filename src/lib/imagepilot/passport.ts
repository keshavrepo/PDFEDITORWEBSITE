/**
 * Passport and ID photo specifications.
 *
 * Sizes and head-height ratios follow each authority's published guidance.
 * Everything is stored in millimetres and converted to pixels at the chosen
 * print resolution, because that is how the specifications themselves are
 * written and it keeps the print sheet dimensionally correct.
 *
 * The guides this produces are advisory: they position the head correctly for
 * the specification, but whether a given photo is *accepted* also depends on
 * expression, lighting and background, which no cropping tool can judge.
 */

import { clampDimension, createId } from "./document";
import { createAdjustments } from "./adjustments";
import type { EditorDocument, Layer, Rect, ShapeLayer } from "./types";

export interface PassportSpec {
  id: string;
  country: string;
  label: string;
  /** Photo width in millimetres. */
  widthMm: number;
  /** Photo height in millimetres. */
  heightMm: number;
  /**
   * Head height (chin to crown) as a fraction of the photo height.
   * Specifications usually give a range; the midpoint is used for the guide
   * and the range drives the tolerance band.
   */
  headMin: number;
  headMax: number;
  /**
   * Distance from the top of the photo to the crown, as a fraction of the
   * photo height. Several authorities specify this explicitly.
   */
  crownGap: number;
  /** Background colours the authority accepts, as CSS hex. */
  backgrounds: string[];
  /** Free-text notes shown beside the specification. */
  notes: string;
}

/**
 * Specifications for widely requested documents.
 *
 * Head-height fractions are derived from each authority's stated millimetre
 * ranges divided by the photo height, so the guides scale correctly at any
 * output resolution.
 */
export const PASSPORT_SPECS: PassportSpec[] = [
  {
    id: "us-passport",
    country: "United States",
    label: "US Passport / Visa — 2×2 in",
    widthMm: 51,
    heightMm: 51,
    // 25–35 mm head height on a 51 mm photo.
    headMin: 25 / 51,
    headMax: 35 / 51,
    crownGap: 0.11,
    backgrounds: ["#ffffff", "#f5f5f5"],
    notes: "Plain white or off-white background. Head 25–35 mm, eyes 56–69% up from the bottom.",
  },
  {
    id: "uk-passport",
    country: "United Kingdom",
    label: "UK Passport — 35×45 mm",
    widthMm: 35,
    heightMm: 45,
    // 29–34 mm head height on a 45 mm photo.
    headMin: 29 / 45,
    headMax: 34 / 45,
    crownGap: 0.06,
    backgrounds: ["#f0f0f0", "#ffffff", "#e8e8e8"],
    notes: "Plain light grey or cream background. Head 29–34 mm from chin to crown.",
  },
  {
    id: "schengen",
    country: "European Union",
    label: "Schengen Visa — 35×45 mm",
    widthMm: 35,
    heightMm: 45,
    headMin: 31 / 45,
    headMax: 36 / 45,
    crownGap: 0.05,
    backgrounds: ["#ffffff", "#f0f0f0"],
    notes: "Light plain background. Face must cover 70–80% of the frame.",
  },
  {
    id: "india-passport",
    country: "India",
    label: "India Passport — 35×45 mm",
    widthMm: 35,
    heightMm: 45,
    headMin: 25 / 45,
    headMax: 35 / 45,
    crownGap: 0.08,
    backgrounds: ["#ffffff"],
    notes: "Plain white background with the face centred and clearly visible.",
  },
  {
    id: "india-ration",
    country: "India",
    label: "India Photo — 51×51 mm",
    widthMm: 51,
    heightMm: 51,
    headMin: 25 / 51,
    headMax: 35 / 51,
    crownGap: 0.11,
    backgrounds: ["#ffffff"],
    notes: "Square format used for several Indian applications.",
  },
  {
    id: "canada-passport",
    country: "Canada",
    label: "Canada Passport — 50×70 mm",
    widthMm: 50,
    heightMm: 70,
    // 31–36 mm head height on a 70 mm photo.
    headMin: 31 / 70,
    headMax: 36 / 70,
    crownGap: 0.08,
    backgrounds: ["#ffffff"],
    notes: "Plain white background. Head 31–36 mm measured chin to crown.",
  },
  {
    id: "australia-passport",
    country: "Australia",
    label: "Australia Passport — 35×45 mm",
    widthMm: 35,
    heightMm: 45,
    headMin: 32 / 45,
    headMax: 36 / 45,
    crownGap: 0.05,
    backgrounds: ["#ffffff", "#f0f0f0"],
    notes: "Plain light background with even lighting and no shadows.",
  },
  {
    id: "china-visa",
    country: "China",
    label: "China Visa — 33×48 mm",
    widthMm: 33,
    heightMm: 48,
    headMin: 28 / 48,
    headMax: 33 / 48,
    crownGap: 0.06,
    backgrounds: ["#ffffff"],
    notes: "Plain white background. Head 28–33 mm, width 15–22 mm.",
  },
  {
    id: "japan-passport",
    country: "Japan",
    label: "Japan Passport — 35×45 mm",
    widthMm: 35,
    heightMm: 45,
    headMin: 32 / 45,
    headMax: 36 / 45,
    crownGap: 0.09,
    backgrounds: ["#ffffff", "#f0f0f0"],
    notes: "Plain background. 4 mm from the crown to the top edge.",
  },
  {
    id: "germany-id",
    country: "Germany",
    label: "Germany ID — 35×45 mm",
    widthMm: 35,
    heightMm: 45,
    headMin: 32 / 45,
    headMax: 36 / 45,
    crownGap: 0.06,
    backgrounds: ["#f0f0f0", "#ffffff"],
    notes: "Light grey background preferred. Biometric specification.",
  },
];

/** Print resolutions offered, in dots per inch. */
export const PRINT_DPI = [300, 600] as const;
export type PrintDpi = (typeof PRINT_DPI)[number];

const MM_PER_INCH = 25.4;

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

/** Pixel dimensions of a single photo at the given resolution. */
export function specPixelSize(spec: PassportSpec, dpi: number): { width: number; height: number } {
  return {
    width: clampDimension(mmToPx(spec.widthMm, dpi)),
    height: clampDimension(mmToPx(spec.heightMm, dpi)),
  };
}

/* -------------------------------------------------------------------------- */
/* Head guides                                                                */
/* -------------------------------------------------------------------------- */

export interface HeadGuide {
  /** Ideal crown line, as a fraction of photo height from the top. */
  crownY: number;
  /** Ideal chin line, as a fraction of photo height from the top. */
  chinY: number;
  /** Acceptable crown range. */
  crownMinY: number;
  crownMaxY: number;
  /** Acceptable chin range. */
  chinMinY: number;
  chinMaxY: number;
  /** Eye line, as a fraction from the top. */
  eyeY: number;
  /** Head height used for the ideal guide, as a fraction of photo height. */
  headHeight: number;
}

/**
 * Derives the guide lines for a specification.
 *
 * The ideal head uses the midpoint of the permitted range so a user aiming at
 * the solid line has the most tolerance in either direction.
 */
export function headGuide(spec: PassportSpec): HeadGuide {
  const headHeight = (spec.headMin + spec.headMax) / 2;
  const crownY = spec.crownGap;
  const chinY = crownY + headHeight;

  // The permitted band: the crown stays put while the chin moves with the
  // allowed head height.
  const chinMinY = crownY + spec.headMin;
  const chinMaxY = crownY + spec.headMax;

  return {
    crownY,
    chinY,
    crownMinY: Math.max(0, crownY - 0.03),
    crownMaxY: crownY + 0.03,
    chinMinY,
    chinMaxY,
    // Eyes sit roughly 45% of the way down the head from the crown.
    eyeY: crownY + headHeight * 0.45,
    headHeight,
  };
}

/* -------------------------------------------------------------------------- */
/* Auto crop                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Places an imported portrait inside a specification.
 *
 * Without face detection the safest assumption is that the subject is roughly
 * centred and fills a normal portrait framing, so the image is scaled to put a
 * typical head into the guide band and centred horizontally. The user then
 * nudges it against the visible guides, which is both honest about what the
 * tool knows and faster than starting from an arbitrary position.
 */
export function fitPortrait(
  spec: PassportSpec,
  photoWidth: number,
  photoHeight: number,
  targetWidth: number,
  targetHeight: number
): Rect {
  const guide = headGuide(spec);

  // Assume the head occupies about 42% of a typical portrait's height. Scaling
  // so that region matches the specification's head band puts most photos
  // close to correct on import.
  const assumedHeadFraction = 0.42;
  const requiredScale = (guide.headHeight * targetHeight) / (assumedHeadFraction * photoHeight);

  // Never scale below "cover", or the background would show through.
  const coverScale = Math.max(targetWidth / photoWidth, targetHeight / photoHeight);
  const scale = Math.max(coverScale, requiredScale);

  const width = photoWidth * scale;
  const height = photoHeight * scale;

  // Centre horizontally; vertically, line the assumed crown up with the guide.
  const assumedCrownFraction = 0.14;
  const crownInPhoto = assumedCrownFraction * height;
  const targetCrown = guide.crownY * targetHeight;

  return {
    x: (targetWidth - width) / 2,
    y: targetCrown - crownInPhoto,
    width,
    height,
  };
}

/* -------------------------------------------------------------------------- */
/* Print sheets                                                               */
/* -------------------------------------------------------------------------- */

export interface PrintSheetSpec {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PRINT_SHEETS: PrintSheetSpec[] = [
  { id: "4x6", label: "4×6 in photo paper", widthMm: 152.4, heightMm: 101.6 },
  { id: "5x7", label: "5×7 in photo paper", widthMm: 177.8, heightMm: 127 },
  { id: "a4", label: "A4 paper", widthMm: 210, heightMm: 297 },
  { id: "letter", label: "US Letter", widthMm: 215.9, heightMm: 279.4 },
];

export interface SheetLayout {
  /** Sheet size in pixels. */
  width: number;
  height: number;
  /** Where each copy goes, in pixels. */
  cells: Rect[];
  columns: number;
  rows: number;
  /** How many copies actually fit. */
  capacity: number;
}

/**
 * Lays out repeated copies on a print sheet.
 *
 * Both orientations of the sheet are tried and whichever fits more copies
 * wins, because a 35×45 photo fits very differently on portrait and landscape
 * paper and users care about the number of copies, not the paper's rotation.
 */
export function planPrintSheet(
  spec: PassportSpec,
  sheet: PrintSheetSpec,
  dpi: number,
  requestedCopies: number,
  gapMm = 2,
  marginMm = 5
): SheetLayout {
  const photo = specPixelSize(spec, dpi);
  const gap = mmToPx(gapMm, dpi);
  const margin = mmToPx(marginMm, dpi);

  const orientations = [
    { width: mmToPx(sheet.widthMm, dpi), height: mmToPx(sheet.heightMm, dpi) },
    { width: mmToPx(sheet.heightMm, dpi), height: mmToPx(sheet.widthMm, dpi) },
  ];

  let best: SheetLayout | null = null;

  for (const orientation of orientations) {
    const usableWidth = orientation.width - margin * 2;
    const usableHeight = orientation.height - margin * 2;
    if (usableWidth < photo.width || usableHeight < photo.height) continue;

    const columns = Math.max(1, Math.floor((usableWidth + gap) / (photo.width + gap)));
    const rows = Math.max(1, Math.floor((usableHeight + gap) / (photo.height + gap)));
    const capacity = columns * rows;

    if (best && capacity <= best.capacity) continue;

    const count = Math.min(requestedCopies, capacity);
    const gridWidth = columns * photo.width + (columns - 1) * gap;
    const gridHeight = rows * photo.height + (rows - 1) * gap;
    // Centre the whole grid so the offcuts are even on both sides.
    const originX = (orientation.width - gridWidth) / 2;
    const originY = (orientation.height - gridHeight) / 2;

    const cells: Rect[] = [];
    for (let index = 0; index < count; index++) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      cells.push({
        x: originX + column * (photo.width + gap),
        y: originY + row * (photo.height + gap),
        width: photo.width,
        height: photo.height,
      });
    }

    best = {
      width: clampDimension(orientation.width),
      height: clampDimension(orientation.height),
      cells,
      columns,
      rows,
      capacity,
    };
  }

  // Fallback for a photo larger than the paper: a single full-bleed cell.
  return (
    best ?? {
      width: clampDimension(photo.width),
      height: clampDimension(photo.height),
      cells: [{ x: 0, y: 0, width: photo.width, height: photo.height }],
      columns: 1,
      rows: 1,
      capacity: 1,
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Guide overlay                                                              */
/* -------------------------------------------------------------------------- */

/** Marks guide layers so they can be removed before export. */
export const GUIDE_LAYER_PREFIX = "__guide";

export function isGuideLayer(layer: Layer): boolean {
  return layer.name.startsWith(GUIDE_LAYER_PREFIX);
}

/** Removes every guide layer, used before exporting a finished photo. */
export function stripGuides(doc: EditorDocument): EditorDocument {
  const layers = doc.layers.filter((layer) => !isGuideLayer(layer));
  return layers.length === doc.layers.length ? doc : { ...doc, layers };
}

function guideLine(
  name: string,
  rect: Rect,
  color: string,
  opacity: number
): ShapeLayer {
  return {
    id: createId("guide"),
    name: `${GUIDE_LAYER_PREFIX} ${name}`,
    type: "shape",
    visible: true,
    // Guides must never be selected or dragged by accident.
    locked: true,
    opacity,
    blendMode: "normal",
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: 0,
    flipX: false,
    flipY: false,
    adjustments: createAdjustments(),
    shape: "rectangle",
    fill: color,
    fillEnabled: true,
    strokeColor: color,
    strokeWidth: 0,
    cornerRadius: 0,
    sides: 4,
    innerRadius: 0.45,
    arrowHeadSize: 0.25,
  };
}

/**
 * Builds the head-position overlay.
 *
 * Rendered as ordinary locked layers so the existing renderer draws them with
 * no special-casing, and so they participate in undo like anything else.
 */
export function buildGuideLayers(spec: PassportSpec, width: number, height: number): Layer[] {
  const guide = headGuide(spec);
  const thickness = Math.max(1, Math.round(height * 0.004));
  const layers: Layer[] = [];

  // Tolerance band for the chin, drawn as a translucent fill.
  layers.push(
    guideLine(
      "chin-band",
      {
        x: 0,
        y: guide.chinMinY * height,
        width,
        height: Math.max(thickness, (guide.chinMaxY - guide.chinMinY) * height),
      },
      "#22c55e",
      0.16
    )
  );

  // Solid ideal lines.
  layers.push(
    guideLine("crown", { x: 0, y: guide.crownY * height, width, height: thickness }, "#2563eb", 0.85)
  );
  layers.push(
    guideLine("chin", { x: 0, y: guide.chinY * height, width, height: thickness }, "#2563eb", 0.85)
  );
  layers.push(
    guideLine("eyes", { x: 0, y: guide.eyeY * height, width, height: thickness }, "#f59e0b", 0.7)
  );

  // Vertical centre line for symmetry.
  layers.push(
    guideLine(
      "centre",
      { x: width / 2 - thickness / 2, y: 0, width: thickness, height },
      "#2563eb",
      0.4
    )
  );

  return layers;
}
