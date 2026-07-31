/**
 * Region obscuring for the Object Blur Studio.
 *
 * Regions are stored as geometry on the document rather than being burned into
 * pixels while editing, so they can be moved, resized, restyled and undone
 * like anything else. They are only rasterised at export.
 *
 * Two obscuring modes are offered and the difference is not cosmetic:
 *
 * - **Pixelate** averages each cell to a single value. The original detail is
 *   destroyed and cannot be recovered.
 * - **Blur** convolves neighbouring pixels. It looks smoother, but a
 *   sufficiently strong deconvolution can partially recover what was under a
 *   light blur, which is why the UI recommends pixelation for anything
 *   genuinely sensitive.
 *
 * There is no face or plate *detection* here — no model can be fetched in an
 * offline, privacy-first product. What the presets do instead is configure the
 * region shape and strength appropriately for each job, so "blur a face" is
 * one drag with the right settings rather than a manual fiddle.
 */

import { gaussianBlur, pixelate } from "./adjustments";
import type { Rect } from "./types";

export type ObscureMode = "pixelate" | "blur" | "fill";
export type RegionShape = "rectangle" | "ellipse";

export interface ObscureRegion {
  id: string;
  /** Document coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  shape: RegionShape;
  mode: ObscureMode;
  /** 1..100. Cell size for pixelation, radius for blur. */
  strength: number;
  /** Solid colour used by the `fill` mode. */
  color: string;
  /** Softens the region boundary so it does not read as a pasted rectangle. */
  feather: number;
}

/** Presets sized and tuned for the jobs people actually bring to the tool. */
export interface RegionPreset {
  id: string;
  label: string;
  hint: string;
  shape: RegionShape;
  mode: ObscureMode;
  strength: number;
  feather: number;
  /** Suggested aspect ratio when dragging, null for free. */
  ratio: number | null;
  /**
   * Extra coverage added around the drag, as a fraction of its size.
   *
   * People drag approximately, and stopping a pixel short of a licence plate
   * or a chin leaves the very thing they were hiding legible. Erring outward
   * costs a few obscured background pixels; erring inward defeats the tool.
   * An ellipse needs more than a rectangle because its corners fall inside the
   * box the user dragged.
   */
  padding: number;
}

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: "face",
    label: "Face",
    hint: "Oval region with strong pixelation — detail cannot be recovered",
    shape: "ellipse",
    mode: "pixelate",
    strength: 60,
    feather: 6,
    // Faces are taller than wide.
    ratio: 0.78,
    // An oval's corners fall inside the dragged box, so it needs the most.
    padding: 0.18,
  },
  {
    id: "plate",
    label: "Licence plate",
    hint: "Wide rectangle sized for a number plate",
    shape: "rectangle",
    mode: "pixelate",
    strength: 75,
    feather: 2,
    // Most plates sit between 2:1 and 5:1; 4:1 suits common European and
    // Indian formats without being wrong for a US plate.
    ratio: 4,
    padding: 0.1,
  },
  {
    id: "text",
    label: "Text or ID",
    hint: "Rectangle with maximum pixelation for documents and screens",
    shape: "rectangle",
    mode: "pixelate",
    strength: 90,
    feather: 0,
    ratio: null,
    padding: 0.06,
  },
  {
    id: "soft",
    label: "Soft blur",
    hint: "Gentle blur for backgrounds and bystanders",
    shape: "ellipse",
    mode: "blur",
    strength: 50,
    feather: 12,
    ratio: null,
    padding: 0.1,
  },
  {
    id: "block",
    label: "Solid block",
    hint: "Opaque fill — the most absolute option",
    shape: "rectangle",
    mode: "fill",
    strength: 100,
    feather: 0,
    ratio: null,
    padding: 0.04,
  },
];

export function getPreset(id: string): RegionPreset {
  return REGION_PRESETS.find((preset) => preset.id === id) ?? REGION_PRESETS[0];
}

/* -------------------------------------------------------------------------- */
/* Rasterisation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Coverage mask for a region, 0..1 per pixel, including the feathered rim.
 *
 * Computed against the region's own bounding box rather than the whole image
 * so the cost stays proportional to the area being obscured.
 */
function regionMask(region: ObscureRegion, boxWidth: number, boxHeight: number): Float32Array {
  const mask = new Float32Array(boxWidth * boxHeight);
  const feather = Math.max(0, region.feather);
  const centreX = boxWidth / 2;
  const centreY = boxHeight / 2;

  for (let y = 0; y < boxHeight; y++) {
    for (let x = 0; x < boxWidth; x++) {
      let coverage: number;

      if (region.shape === "ellipse") {
        const radiusX = Math.max(0.5, boxWidth / 2);
        const radiusY = Math.max(0.5, boxHeight / 2);
        const normalised = Math.hypot((x - centreX) / radiusX, (y - centreY) / radiusY);
        if (feather <= 0) {
          coverage = normalised <= 1 ? 1 : 0;
        } else {
          // Convert the feather from pixels into normalised radius units.
          const band = feather / Math.min(radiusX, radiusY);
          coverage = 1 - (normalised - (1 - band)) / Math.max(1e-6, band);
        }
      } else {
        const distanceToEdge = Math.min(x, y, boxWidth - 1 - x, boxHeight - 1 - y);
        coverage = feather <= 0 ? 1 : distanceToEdge / feather;
      }

      mask[y * boxWidth + x] = Math.min(1, Math.max(0, coverage));
    }
  }

  return mask;
}

/**
 * Obscures one region of an RGBA buffer, in place.
 *
 * The region is extracted, processed, then blended back through its mask so
 * the effect respects the shape and its feathered edge. Working on a copy is
 * necessary for blur: convolving in place would feed already-blurred pixels
 * back into the kernel.
 */
export function applyRegion(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  region: ObscureRegion,
  scale = 1
): void {
  // Clamp to the image; a region dragged past the edge must not read out of
  // bounds.
  const left = Math.max(0, Math.floor(region.x * scale));
  const top = Math.max(0, Math.floor(region.y * scale));
  const right = Math.min(imageWidth, Math.ceil((region.x + region.width) * scale));
  const bottom = Math.min(imageHeight, Math.ceil((region.y + region.height) * scale));

  const boxWidth = right - left;
  const boxHeight = bottom - top;
  if (boxWidth < 1 || boxHeight < 1) return;

  const box = new Uint8ClampedArray(boxWidth * boxHeight * 4);
  for (let y = 0; y < boxHeight; y++) {
    const sourceStart = ((top + y) * imageWidth + left) * 4;
    box.set(data.subarray(sourceStart, sourceStart + boxWidth * 4), y * boxWidth * 4);
  }

  switch (region.mode) {
    case "pixelate": {
      // Scale the cell with the region so a small face and a large one are
      // obscured to a comparable degree rather than by an absolute cell size.
      const shorter = Math.min(boxWidth, boxHeight);
      const cell = Math.max(2, Math.round((region.strength / 100) * shorter * 0.32));
      pixelate(box, boxWidth, boxHeight, cell);
      break;
    }
    case "blur": {
      const shorter = Math.min(boxWidth, boxHeight);
      const sigma = Math.max(1, (region.strength / 100) * shorter * 0.18);
      gaussianBlur(box, boxWidth, boxHeight, sigma);
      break;
    }
    case "fill": {
      const [r, g, b] = parseColor(region.color);
      for (let i = 0; i < box.length; i += 4) {
        box[i] = r;
        box[i + 1] = g;
        box[i + 2] = b;
      }
      break;
    }
  }

  const mask = regionMask(
    { ...region, feather: region.feather * scale },
    boxWidth,
    boxHeight
  );

  for (let y = 0; y < boxHeight; y++) {
    for (let x = 0; x < boxWidth; x++) {
      const coverage = mask[y * boxWidth + x];
      if (coverage <= 0) continue;

      const boxOffset = (y * boxWidth + x) * 4;
      const imageOffset = ((top + y) * imageWidth + (left + x)) * 4;

      for (let channel = 0; channel < 3; channel++) {
        data[imageOffset + channel] =
          data[imageOffset + channel] * (1 - coverage) + box[boxOffset + channel] * coverage;
      }
    }
  }
}

/** Applies every region, in order. */
export function applyRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  regions: ObscureRegion[],
  scale = 1
): void {
  for (const region of regions) {
    applyRegion(data, width, height, region, scale);
  }
}

/** Parses `#rgb`, `#rrggbb` or `rgb()` into a byte triple. */
export function parseColor(value: string): [number, number, number] {
  const trimmed = value.trim();

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }

  const match = trimmed.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(",").map((part) => parseFloat(part));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }

  return [0, 0, 0];
}

/** Normalises a drag into a region, enforcing a preset's aspect ratio. */
export function regionFromDrag(
  rect: Rect,
  preset: RegionPreset,
  id: string,
  color = "#111111"
): ObscureRegion {
  let { width, height } = rect;
  let { x, y } = rect;

  // Grow the drag outward first, so the thing being hidden is comfortably
  // inside the region even when the drag stopped a little short.
  if (preset.padding > 0) {
    const padX = width * preset.padding;
    const padY = height * preset.padding;
    x -= padX;
    y -= padY;
    width += padX * 2;
    height += padY * 2;
  }

  if (preset.ratio) {
    // Reshape to the preset's proportions, but only ever by *growing*.
    //
    // This is a redaction tool: a region that ends up smaller than the box the
    // user dragged would leave part of the thing they were hiding visible.
    // Fitting the ratio around the drag guarantees the dragged area is always
    // fully covered, at the cost of a little overspill on one axis.
    const centreX = x + width / 2;
    const centreY = y + height / 2;
    const ratioWidth = Math.max(width, height * preset.ratio);
    const ratioHeight = Math.max(height, ratioWidth / preset.ratio);

    width = ratioHeight * preset.ratio;
    height = ratioHeight;
    x = centreX - width / 2;
    y = centreY - height / 2;
  }

  return {
    id,
    x,
    y,
    width: Math.max(4, width),
    height: Math.max(4, height),
    shape: preset.shape,
    mode: preset.mode,
    strength: preset.strength,
    color,
    feather: preset.feather,
  };
}
