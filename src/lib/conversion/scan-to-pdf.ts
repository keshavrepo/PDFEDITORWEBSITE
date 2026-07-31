/**
 * Camera captures to PDF.
 *
 * Photographs of documents differ from scans: they are skewed, unevenly lit
 * and surrounded by whatever was on the desk. This module cleans them up
 * before assembling the PDF:
 *
 *  - edge detection finds the sheet within the photo,
 *  - auto-crop removes the background,
 *  - auto-rotate corrects sideways captures,
 *  - an optional enhancement flattens lighting so the page reads as white.
 *
 * All analysis works on raw pixels, so the module stays isomorphic and is
 * covered by the Node test suite.
 */

import { PDFDocument } from "pdf-lib";
import { conversionErrors } from "./errors";
import { detectImageFormat, encodePng, readImageSize } from "./image-codec";
import type { ConversionProgressCallback } from "./types";

export interface ScanPageInput {
  name: string;
  /** RGBA pixels of the captured image. */
  rgba: Uint8Array;
  width: number;
  height: number;
}

export type ScanPageSize = "a4" | "letter" | "fit";

export interface ScanToPdfOptions {
  pageSize?: ScanPageSize;
  /** Trim the detected background around the document. Defaults to true. */
  autoCrop?: boolean;
  /** Rotate landscape captures to portrait. Defaults to true. */
  autoRotate?: boolean;
  /** Flatten lighting and lift the background to white. Defaults to true. */
  enhance?: boolean;
  /** Page margin in points. */
  margin?: number;
  signal?: AbortSignal;
}

/** Bounds of the detected document within the source image. */
export interface DetectedEdges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const PAGE_SIZES = {
  a4: { width: 595.276, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;

/* -------------------------------------------------------------------------- */
/* Image analysis                                                             */
/* -------------------------------------------------------------------------- */

/** Perceptual luminance, used by every analysis step below. */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Finds the document within a photograph.
 *
 * A camera capture puts a bright sheet against a darker background, so the
 * page is located by scanning rows and columns for a sustained run of bright
 * pixels. Row/column profiling is used rather than a full contour trace: it is
 * dramatically cheaper and handles the axis-aligned case that dominates in
 * practice.
 */
export function detectDocumentEdges(
  rgba: Uint8Array,
  width: number,
  height: number,
  options: { brightnessThreshold?: number; coverage?: number } = {}
): DetectedEdges | null {
  if (width < 8 || height < 8) return null;

  // Sample the border to estimate the background, then treat anything
  // meaningfully brighter as part of the sheet.
  let borderTotal = 0;
  let borderCount = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 64));
  for (let x = 0; x < width; x += step) {
    for (const y of [0, height - 1]) {
      const index = (y * width + x) * 4;
      borderTotal += luminance(rgba[index], rgba[index + 1], rgba[index + 2]);
      borderCount++;
    }
  }
  for (let y = 0; y < height; y += step) {
    for (const x of [0, width - 1]) {
      const index = (y * width + x) * 4;
      borderTotal += luminance(rgba[index], rgba[index + 1], rgba[index + 2]);
      borderCount++;
    }
  }
  const background = borderCount ? borderTotal / borderCount : 0;

  // The page must be clearly brighter than the surround for detection to be
  // trustworthy; otherwise the caller keeps the full frame.
  const threshold = options.brightnessThreshold ?? Math.min(235, background + 45);
  const coverage = options.coverage ?? 0.45;

  const rowBright = new Uint32Array(height);
  const columnBright = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (luminance(rgba[index], rgba[index + 1], rgba[index + 2]) >= threshold) {
        rowBright[y]++;
        columnBright[x]++;
      }
    }
  }

  const rowNeeded = width * coverage;
  const columnNeeded = height * coverage;

  let top = 0;
  while (top < height && rowBright[top] < rowNeeded) top++;
  let bottom = height - 1;
  while (bottom > top && rowBright[bottom] < rowNeeded) bottom--;
  let left = 0;
  while (left < width && columnBright[left] < columnNeeded) left++;
  let right = width - 1;
  while (right > left && columnBright[right] < columnNeeded) right--;

  // Reject implausible detections rather than cropping away real content.
  const detectedWidth = right - left + 1;
  const detectedHeight = bottom - top + 1;
  if (detectedWidth < width * 0.2 || detectedHeight < height * 0.2) return null;
  if (detectedWidth === width && detectedHeight === height) return null;

  return { left, top, right, bottom };
}

/** Returns the sub-rectangle of an image as fresh RGBA pixels. */
export function cropRgba(
  rgba: Uint8Array,
  width: number,
  edges: DetectedEdges
): { rgba: Uint8Array; width: number; height: number } {
  const cropWidth = edges.right - edges.left + 1;
  const cropHeight = edges.bottom - edges.top + 1;
  const output = new Uint8Array(cropWidth * cropHeight * 4);

  for (let y = 0; y < cropHeight; y++) {
    const sourceStart = ((edges.top + y) * width + edges.left) * 4;
    output.set(rgba.subarray(sourceStart, sourceStart + cropWidth * 4), y * cropWidth * 4);
  }
  return { rgba: output, width: cropWidth, height: cropHeight };
}

/** Rotates pixels a quarter turn clockwise. */
export function rotateRgba90(
  rgba: Uint8Array,
  width: number,
  height: number
): { rgba: Uint8Array; width: number; height: number } {
  const output = new Uint8Array(rgba.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      // (x, y) -> (height - 1 - y, x) in the rotated frame.
      const target = (x * height + (height - 1 - y)) * 4;
      output[target] = rgba[source];
      output[target + 1] = rgba[source + 1];
      output[target + 2] = rgba[source + 2];
      output[target + 3] = rgba[source + 3];
    }
  }
  return { rgba: output, width: height, height: width };
}

/**
 * Normalises lighting so the paper reads as white and the ink as black.
 *
 * A photograph is rarely evenly lit, so a fixed threshold would blow out one
 * side of the page. Instead the histogram is stretched between robust
 * percentiles, which preserves mid-tones such as stamps and signatures.
 */
export function enhanceScan(rgba: Uint8Array): Uint8Array {
  const histogram = new Uint32Array(256);
  for (let index = 0; index < rgba.length; index += 4) {
    histogram[Math.round(luminance(rgba[index], rgba[index + 1], rgba[index + 2]))]++;
  }

  const total = rgba.length / 4;
  // Ignore the darkest 2% and brightest 15%: ink is sparse, paper is not.
  const darkTarget = total * 0.02;
  const lightTarget = total * 0.85;

  let cumulative = 0;
  let black = 0;
  let white = 255;
  for (let level = 0; level < 256; level++) {
    cumulative += histogram[level];
    if (black === 0 && cumulative >= darkTarget) black = level;
    if (cumulative >= lightTarget) {
      white = level;
      break;
    }
  }
  if (white <= black) return rgba;

  const range = white - black;
  const lookup = new Uint8Array(256);
  for (let level = 0; level < 256; level++) {
    lookup[level] = Math.max(0, Math.min(255, Math.round(((level - black) / range) * 255)));
  }

  const output = new Uint8Array(rgba.length);
  for (let index = 0; index < rgba.length; index += 4) {
    output[index] = lookup[rgba[index]];
    output[index + 1] = lookup[rgba[index + 1]];
    output[index + 2] = lookup[rgba[index + 2]];
    output[index + 3] = 255;
  }
  return output;
}

/** True when a capture is landscape and should be turned upright. */
export function shouldAutoRotate(width: number, height: number): boolean {
  return width > height;
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

/** Cleans up each capture and assembles them into a multi-page PDF. */
export async function scanToPdf(
  pages: ScanPageInput[],
  options: ScanToPdfOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  if (!pages.length) {
    throw conversionErrors.invalidRequest("Add at least one page to scan");
  }

  const pageSize = options.pageSize || "a4";
  const margin = Math.max(0, Math.min(options.margin ?? 18, 144));
  const autoCrop = options.autoCrop !== false;
  const autoRotate = options.autoRotate !== false;
  const enhance = options.enhance !== false;

  const pdf = await PDFDocument.create();
  let added = 0;

  for (let index = 0; index < pages.length; index++) {
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    onProgress?.({
      stage: `Processing page ${index + 1} of ${pages.length}`,
      progress: Math.round((index / pages.length) * 85),
      total: 100,
    });

    const input = pages[index];
    let { rgba, width, height } = input;
    if (!width || !height || rgba.length < width * height * 4) continue;

    if (autoCrop) {
      const edges = detectDocumentEdges(rgba, width, height);
      if (edges) {
        const cropped = cropRgba(rgba, width, edges);
        rgba = cropped.rgba;
        width = cropped.width;
        height = cropped.height;
      }
    }

    if (autoRotate && shouldAutoRotate(width, height)) {
      const rotated = rotateRgba90(rgba, width, height);
      rgba = rotated.rgba;
      width = rotated.width;
      height = rotated.height;
    }

    if (enhance) rgba = enhanceScan(rgba);

    const png = await encodePng(rgba, width, height);
    let embedded;
    try {
      embedded = await pdf.embedPng(png);
    } catch {
      // A single unreadable capture must not fail the whole batch.
      continue;
    }

    const geometry =
      pageSize === "fit"
        ? {
            // Photographs are stored at 96 DPI by convention.
            width: (width * 72) / 96 + margin * 2,
            height: (height * 72) / 96 + margin * 2,
          }
        : PAGE_SIZES[pageSize];

    const page = pdf.addPage([geometry.width, geometry.height]);
    const availableWidth = Math.max(1, geometry.width - margin * 2);
    const availableHeight = Math.max(1, geometry.height - margin * 2);
    const scale = Math.min(availableWidth / width, availableHeight / height);

    const drawWidth = width * scale;
    const drawHeight = height * scale;
    page.drawImage(embedded, {
      x: margin + (availableWidth - drawWidth) / 2,
      y: margin + (availableHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
    added++;
  }

  if (!added) {
    throw conversionErrors.invalidRequest("None of the selected images could be read");
  }

  pdf.setProducer("PDFPilot");
  pdf.setCreator("PDFPilot Scan");
  pdf.setTitle("Scanned document");

  onProgress?.({ stage: "Saving PDF", progress: 95, total: 100 });
  const bytes = await pdf.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return bytes;
}

/** Decodes an encoded image so callers can hand raw pixels to {@link scanToPdf}. */
export function readEncodedImageSize(data: Uint8Array): { width: number; height: number } | null {
  const format = detectImageFormat(data);
  if (format !== "png" && format !== "jpeg") return null;
  return readImageSize(data, format);
}
