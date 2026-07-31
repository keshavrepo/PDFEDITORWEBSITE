/**
 * Image compression.
 *
 * Encoding is delegated to the browser's own codecs through the same canvas
 * the editor already uses, so no extra dependency is pulled in and the output
 * is a normal, universally readable JPEG, PNG or WEBP.
 *
 * The interesting part is hitting a *target file size*. Quality and size are
 * related monotonically but not linearly and the curve differs per image, so
 * the only reliable approach is to encode, measure and adjust. A binary search
 * converges in around eight encodes, which is fast enough to feel instant on a
 * typical photo while being far more accurate than a guessed quality value.
 */

import type { CanvasFactory } from "./renderer";

export type CompressFormat = "jpeg" | "png" | "webp";

export interface CompressionSettings {
  format: CompressFormat;
  /** 1..100. Ignored by PNG, which is always lossless. */
  quality: number;
  /** When set, quality is searched to land under this many bytes. */
  targetBytes: number | null;
  /**
   * Longest-edge cap in pixels. Downscaling is often the single most
   * effective compression available, so it is offered alongside quality.
   */
  maxDimension: number | null;
  /**
   * Keeps the original format rather than converting. Useful for batches of
   * mixed types where the user only wants them smaller.
   */
  keepFormat: boolean;
}

export const defaultCompressionSettings: CompressionSettings = {
  format: "jpeg",
  quality: 80,
  targetBytes: null,
  maxDimension: null,
  keepFormat: false,
};

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  /** Quality actually used, after any target-size search. */
  quality: number;
  /** Encodes performed, exposed so the UI can explain a slow run. */
  attempts: number;
  /** True when the target could not be met even at the lowest quality. */
  missedTarget: boolean;
}

export const MIME_BY_FORMAT: Record<CompressFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const EXTENSION_BY_FORMAT: Record<CompressFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/** Maps a MIME type onto a supported format, defaulting to JPEG. */
export function formatFromMime(mime: string): CompressFormat {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpeg";
}

/** PNG is lossless; the others are not. */
export function isLossless(format: CompressFormat): boolean {
  return format === "png";
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : Math.round(value * 10) / 10} ${units[index]}`;
}

/** Dimensions after applying a longest-edge cap. */
export function scaledSize(
  width: number,
  height: number,
  maxDimension: number | null
): { width: number; height: number } {
  if (!maxDimension || maxDimension <= 0) return { width, height };
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Encoder supplied by the host, so this module stays free of browser APIs. */
export type Encoder = (
  source: CanvasImageSource,
  width: number,
  height: number,
  mimeType: string,
  quality?: number
) => Promise<Blob>;

/**
 * Compresses a decoded image.
 *
 * With no target size this is a single encode. With one, quality is binary
 * searched: each step halves the remaining range, keeping the best result that
 * fits, so the answer is the highest quality that still meets the budget
 * rather than merely *a* result that fits.
 */
export async function compressImage(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  settings: CompressionSettings,
  encode: Encoder
): Promise<CompressionResult> {
  const { width, height } = scaledSize(naturalWidth, naturalHeight, settings.maxDimension);
  const mimeType = MIME_BY_FORMAT[settings.format];
  const lossless = isLossless(settings.format);

  // PNG ignores the quality argument entirely, so there is nothing to search.
  if (lossless || !settings.targetBytes) {
    const quality = lossless ? 100 : settings.quality;
    const blob = await encode(
      source,
      width,
      height,
      mimeType,
      lossless ? undefined : quality / 100
    );
    return {
      blob,
      width,
      height,
      quality,
      attempts: 1,
      missedTarget: settings.targetBytes ? blob.size > settings.targetBytes : false,
    };
  }

  const target = settings.targetBytes;
  let low = 1;
  let high = 100;
  let attempts = 0;
  let best: { blob: Blob; quality: number } | null = null;

  // Eight steps resolve a 1..100 range to within one quality point.
  const MAX_ATTEMPTS = 8;

  while (low <= high && attempts < MAX_ATTEMPTS) {
    const mid = Math.floor((low + high) / 2);
    const blob = await encode(source, width, height, mimeType, mid / 100);
    attempts++;

    if (blob.size <= target) {
      // Fits: remember it and try to spend the remaining budget on quality.
      if (!best || mid > best.quality) best = { blob, quality: mid };
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best) {
    return {
      blob: best.blob,
      width,
      height,
      quality: best.quality,
      attempts,
      missedTarget: false,
    };
  }

  // Nothing fit. Return the smallest achievable output and say so plainly
  // rather than silently handing back something over budget.
  const fallback = await encode(source, width, height, mimeType, 0.01);
  return {
    blob: fallback,
    width,
    height,
    quality: 1,
    attempts: attempts + 1,
    missedTarget: fallback.size > target,
  };
}

/** Percentage saved, clamped so a larger output reads as 0% rather than negative. */
export function savingsPercent(originalBytes: number, compressedBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.max(0, Math.round((1 - compressedBytes / originalBytes) * 100));
}

/** Target-size presets offered in the UI, in bytes. */
export const TARGET_SIZE_PRESETS = [
  { label: "50 KB", bytes: 50 * 1024 },
  { label: "100 KB", bytes: 100 * 1024 },
  { label: "200 KB", bytes: 200 * 1024 },
  { label: "500 KB", bytes: 500 * 1024 },
  { label: "1 MB", bytes: 1024 * 1024 },
  { label: "2 MB", bytes: 2 * 1024 * 1024 },
];

/** Longest-edge presets, `null` meaning no downscaling. */
export const DIMENSION_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "Original", value: null },
  { label: "4K — 3840 px", value: 3840 },
  { label: "2K — 2560 px", value: 2560 },
  { label: "Full HD — 1920 px", value: 1920 },
  { label: "HD — 1280 px", value: 1280 },
  { label: "Web — 1024 px", value: 1024 },
  { label: "Thumbnail — 512 px", value: 512 },
];

/**
 * Canvas-backed encoder used by the browser.
 *
 * Kept here rather than in the UI so the batch runner and the single-image
 * path share one implementation.
 */
export function createCanvasEncoder(
  factory: CanvasFactory,
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>
): Encoder {
  return async (source, width, height, mimeType, quality) => {
    const { canvas, ctx } = factory.create(width, height);
    // JPEG has no alpha channel; without a white matte transparent areas would
    // encode as black.
    if (mimeType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, width, height);
    return toBlob(canvas, mimeType, quality);
  };
}
