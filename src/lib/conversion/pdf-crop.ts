/**
 * PDF cropping.
 *
 * Cropping sets each page's `/CropBox`, which is how the PDF specification
 * expresses a visible region. Content outside the box is hidden by every
 * conformant viewer, and the underlying page objects stay intact so nothing is
 * corrupted.
 */

import { PDFDocument } from "pdf-lib";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback } from "./types";

/** Margins to remove from each edge, in points. */
export interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropOptions {
  /** Pages to crop, zero-based. Omit to crop every page. */
  pageIndices?: number[];
  signal?: AbortSignal;
}

export interface DetectedMargins {
  pageIndex: number;
  margins: CropMargins;
}

/** Page geometry, used by the preview overlay. */
export interface CropPageInfo {
  width: number;
  height: number;
  /** Existing crop box relative to the media box, in top-left space. */
  crop: CropMargins;
}

async function load(data: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(data, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted") || message.includes("password")) {
      throw conversionErrors.encrypted();
    }
    throw conversionErrors.corrupted("PDF", error);
  }
}

/** Reads page sizes and any crop already applied. */
export async function readCropInfo(data: Uint8Array): Promise<CropPageInfo[]> {
  const pdf = await load(data);
  const pages = pdf.getPages();
  if (!pages.length) throw conversionErrors.noContent("PDF");

  return pages.map((page) => {
    const media = page.getMediaBox();
    const crop = page.getCropBox();
    return {
      width: media.width,
      height: media.height,
      crop: {
        left: crop.x - media.x,
        bottom: crop.y - media.y,
        right: media.x + media.width - (crop.x + crop.width),
        top: media.y + media.height - (crop.y + crop.height),
      },
    };
  });
}

/**
 * Applies margins to the chosen pages.
 *
 * Margins are clamped so a page can never collapse to zero, which would make
 * the output unopenable.
 */
export async function cropPdf(
  data: Uint8Array,
  margins: CropMargins | DetectedMargins[],
  options: CropOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  onProgress?.({ stage: "Reading PDF", progress: 5, total: 100 });

  const pdf = await load(data);
  const pages = pdf.getPages();
  if (!pages.length) throw conversionErrors.noContent("PDF");

  const perPage = Array.isArray(margins);
  const targets = options.pageIndices?.length
    ? options.pageIndices.filter((index) => index >= 0 && index < pages.length)
    : pages.map((_, index) => index);

  if (!targets.length) {
    throw conversionErrors.invalidRequest("Select at least one page to crop");
  }

  const byIndex = perPage
    ? new Map((margins as DetectedMargins[]).map((entry) => [entry.pageIndex, entry.margins]))
    : null;

  let applied = 0;
  for (const pageIndex of targets) {
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    const page = pages[pageIndex];
    const media = page.getMediaBox();
    const requested = byIndex ? byIndex.get(pageIndex) : (margins as CropMargins);
    if (!requested) continue;

    // Keep at least a 20x20 point visible area.
    const maxHorizontal = Math.max(0, media.width - 20);
    const maxVertical = Math.max(0, media.height - 20);

    let left = Math.max(0, requested.left || 0);
    let right = Math.max(0, requested.right || 0);
    let top = Math.max(0, requested.top || 0);
    let bottom = Math.max(0, requested.bottom || 0);

    if (left + right > maxHorizontal) {
      const scale = maxHorizontal / (left + right);
      left *= scale;
      right *= scale;
    }
    if (top + bottom > maxVertical) {
      const scale = maxVertical / (top + bottom);
      top *= scale;
      bottom *= scale;
    }

    page.setCropBox(
      media.x + left,
      media.y + bottom,
      Math.max(20, media.width - left - right),
      Math.max(20, media.height - top - bottom)
    );

    applied++;
    if (applied % 10 === 0) {
      onProgress?.({
        stage: `Cropping page ${applied} of ${targets.length}`,
        progress: 10 + Math.round((applied / targets.length) * 80),
        total: 100,
      });
    }
  }

  onProgress?.({ stage: "Saving PDF", progress: 95, total: 100 });
  const bytes = await pdf.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return bytes;
}

/* -------------------------------------------------------------------------- */
/* White-margin detection                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Scans rendered page pixels for the tight bounding box of non-white content.
 *
 * Rendering happens in the browser, so this takes already-rasterised pixel data
 * and stays free of DOM APIs.
 */
export function detectContentBounds(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: { threshold?: number; padding?: number } = {}
): { left: number; right: number; top: number; bottom: number } | null {
  // Pixels brighter than the threshold on every channel count as background.
  const threshold = options.threshold ?? 247;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const alpha = rgba[index + 3];
      // Fully transparent pixels are background too.
      if (alpha < 8) continue;
      if (rgba[index] >= threshold && rgba[index + 1] >= threshold && rgba[index + 2] >= threshold) {
        continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // A completely blank page has no content to crop to.
  if (maxX < 0 || maxY < 0) return null;

  const padding = Math.max(0, options.padding ?? 0);
  return {
    left: Math.max(0, minX - padding),
    top: Math.max(0, minY - padding),
    right: Math.max(0, width - 1 - maxX - padding),
    bottom: Math.max(0, height - 1 - maxY - padding),
  };
}

/** Converts pixel-space bounds into point-space margins. */
export function boundsToMargins(
  bounds: { left: number; right: number; top: number; bottom: number },
  pixelWidth: number,
  pixelHeight: number,
  pageWidth: number,
  pageHeight: number
): CropMargins {
  const scaleX = pageWidth / Math.max(1, pixelWidth);
  const scaleY = pageHeight / Math.max(1, pixelHeight);
  return {
    left: bounds.left * scaleX,
    right: bounds.right * scaleX,
    top: bounds.top * scaleY,
    bottom: bounds.bottom * scaleY,
  };
}
