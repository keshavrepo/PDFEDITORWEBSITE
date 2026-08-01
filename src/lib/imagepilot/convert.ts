/**
 * Batch image conversion.
 *
 * Encoding runs through the browser's own codecs via a canvas, which is what
 * keeps the whole operation local and dependency-free. Support for the newer
 * formats varies by browser, so rather than promising everything and failing
 * at download time, {@link probeFormatSupport} asks the browser what it can
 * actually produce and the UI only offers those.
 *
 * BMP and TIFF are not encodable by any browser canvas. BMP is simple enough
 * to write directly — it is an uncompressed header plus rows of pixels — so it
 * is implemented here. TIFF is a container format with dozens of compression
 * schemes and no browser support; writing a credible encoder is out of
 * proportion to its usefulness, so it is offered as *input* only and the UI
 * says so plainly rather than shipping something that produces files real TIFF
 * readers reject.
 */

import type { CanvasFactory } from "./renderer";

export type ConvertFormat = "jpeg" | "png" | "webp" | "avif" | "bmp";

export interface FormatDescriptor {
  value: ConvertFormat;
  label: string;
  extension: string;
  mimeType: string;
  supportsAlpha: boolean;
  supportsQuality: boolean;
  /** True when this module writes the bytes rather than the canvas. */
  manual: boolean;
  description: string;
}

export const CONVERT_FORMATS: FormatDescriptor[] = [
  {
    value: "jpeg",
    label: "JPG",
    extension: "jpg",
    mimeType: "image/jpeg",
    supportsAlpha: false,
    supportsQuality: true,
    manual: false,
    description: "Universal and small for photographs. No transparency.",
  },
  {
    value: "png",
    label: "PNG",
    extension: "png",
    mimeType: "image/png",
    supportsAlpha: true,
    supportsQuality: false,
    manual: false,
    description: "Lossless with transparency. Best for graphics and screenshots.",
  },
  {
    value: "webp",
    label: "WEBP",
    extension: "webp",
    mimeType: "image/webp",
    supportsAlpha: true,
    supportsQuality: true,
    manual: false,
    description: "Modern, transparent, and much smaller than PNG.",
  },
  {
    value: "avif",
    label: "AVIF",
    extension: "avif",
    mimeType: "image/avif",
    supportsAlpha: true,
    supportsQuality: true,
    manual: false,
    description: "Smallest files at the same quality. Newer browsers only.",
  },
  {
    value: "bmp",
    label: "BMP",
    extension: "bmp",
    mimeType: "image/bmp",
    supportsAlpha: false,
    supportsQuality: false,
    manual: true,
    description: "Uncompressed bitmap for legacy software. Large files.",
  },
];

export function convertDescriptor(format: ConvertFormat): FormatDescriptor {
  return CONVERT_FORMATS.find((entry) => entry.value === format) ?? CONVERT_FORMATS[0];
}

/** Formats accepted as input, including those we cannot write. */
export const CONVERT_INPUT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/tiff,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.tif,.tiff,.svg";

/* -------------------------------------------------------------------------- */
/* Capability probing                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Asks the browser which formats it can actually encode.
 *
 * `canvas.toBlob` silently falls back to PNG for a type it does not support,
 * so the only reliable test is to encode a pixel and inspect the MIME type
 * that comes back.
 */
export async function probeFormatSupport(
  factory: CanvasFactory,
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>
): Promise<Set<ConvertFormat>> {
  const supported = new Set<ConvertFormat>(["png", "jpeg", "bmp"]);

  for (const format of ["webp", "avif"] as const) {
    try {
      const { canvas, ctx } = factory.create(2, 2);
      ctx.fillStyle = "#123456";
      ctx.fillRect(0, 0, 2, 2);
      const blob = await toBlob(canvas, convertDescriptor(format).mimeType, 0.8);
      if (blob.type === convertDescriptor(format).mimeType) supported.add(format);
    } catch {
      // Unsupported; leave it out of the set.
    }
  }

  return supported;
}

/* -------------------------------------------------------------------------- */
/* BMP encoding                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Writes a 24-bit uncompressed BMP.
 *
 * The format stores rows bottom-up and pads each to a four-byte boundary.
 * Alpha is composited onto white first, because 24-bit BMP has no alpha
 * channel and leaving it out would render transparent areas as black.
 */
export function encodeBmp(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const offset = fileHeaderSize + infoHeaderSize;
  const out = new Uint8Array(offset + pixelArraySize);
  const view = new DataView(out.buffer);

  // BITMAPFILEHEADER
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, out.length, true);
  view.setUint32(10, offset, true);

  // BITMAPINFOHEADER
  view.setUint32(14, infoHeaderSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true); // colour planes
  view.setUint16(28, 24, true); // bits per pixel
  view.setUint32(34, pixelArraySize, true);
  // 2835 px/m is 72 dpi, the conventional default.
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);

  for (let y = 0; y < height; y++) {
    // Bottom-up row order.
    const sourceRow = height - 1 - y;
    let target = offset + y * rowSize;

    for (let x = 0; x < width; x++) {
      const source = (sourceRow * width + x) * 4;
      const alpha = rgba[source + 3] / 255;
      // Composite onto white; BMP has no alpha channel.
      const r = Math.round(rgba[source] * alpha + 255 * (1 - alpha));
      const g = Math.round(rgba[source + 1] * alpha + 255 * (1 - alpha));
      const b = Math.round(rgba[source + 2] * alpha + 255 * (1 - alpha));
      // BMP stores BGR.
      out[target++] = b;
      out[target++] = g;
      out[target++] = r;
    }
    // Remaining bytes in the row are already zero padding.
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Conversion                                                                 */
/* -------------------------------------------------------------------------- */

export type ResizeMode = "none" | "longest" | "exact" | "percent";

export interface ConvertSettings {
  format: ConvertFormat;
  /** 1..100, honoured by JPEG, WEBP and AVIF. */
  quality: number;
  resizeMode: ResizeMode;
  /** Longest edge in pixels, for `longest`. */
  longestEdge: number;
  /** Explicit dimensions, for `exact`. */
  exactWidth: number;
  exactHeight: number;
  /** 1..400, for `percent`. */
  percent: number;
  /** Letterbox rather than crop when both dimensions are fixed. */
  preserveAspect: boolean;
  /** Matte for formats without an alpha channel. */
  background: string;
  /** Rename pattern; see {@link buildFileName}. */
  namePattern: string;
  /** Starting index for the `{n}` token. */
  startIndex: number;
}

export const defaultConvertSettings: ConvertSettings = {
  format: "webp",
  quality: 85,
  resizeMode: "none",
  longestEdge: 1920,
  exactWidth: 1920,
  exactHeight: 1080,
  percent: 100,
  preserveAspect: true,
  background: "#ffffff",
  namePattern: "{name}",
  startIndex: 1,
};

/** Resize presets offered in the UI. */
export const RESIZE_PRESETS: Array<{ label: string; value: number }> = [
  { label: "4K — 3840 px", value: 3840 },
  { label: "2K — 2560 px", value: 2560 },
  { label: "Full HD — 1920 px", value: 1920 },
  { label: "HD — 1280 px", value: 1280 },
  { label: "Web — 1024 px", value: 1024 },
  { label: "Thumbnail — 512 px", value: 512 },
];

/** Output dimensions for one image under the current settings. */
export function targetSize(
  settings: ConvertSettings,
  width: number,
  height: number
): { width: number; height: number } {
  switch (settings.resizeMode) {
    case "longest": {
      const longest = Math.max(width, height);
      if (longest <= settings.longestEdge) return { width, height };
      const scale = settings.longestEdge / longest;
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      };
    }
    case "percent": {
      const scale = Math.max(0.01, settings.percent / 100);
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      };
    }
    case "exact": {
      const targetWidth = Math.max(1, Math.round(settings.exactWidth));
      const targetHeight = Math.max(1, Math.round(settings.exactHeight));
      if (!settings.preserveAspect) return { width: targetWidth, height: targetHeight };
      // Fit inside the box without distorting.
      const scale = Math.min(targetWidth / width, targetHeight / height);
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      };
    }
    default:
      return { width, height };
  }
}

/**
 * Expands a rename pattern.
 *
 * Supported tokens: `{name}` original name without extension, `{n}` sequence
 * number, `{nn}`/`{nnn}` zero-padded, `{w}`/`{h}` output dimensions, `{date}`
 * today in ISO form, `{ext}` the new extension.
 */
export function buildFileName(
  pattern: string,
  context: {
    originalName: string;
    index: number;
    width: number;
    height: number;
    extension: string;
  }
): string {
  const base = context.originalName.replace(/\.[^.]+$/, "");
  const date = new Date().toISOString().slice(0, 10);

  const expanded = (pattern || "{name}")
    .replace(/\{name\}/gi, base)
    .replace(/\{nnn\}/gi, String(context.index).padStart(3, "0"))
    .replace(/\{nn\}/gi, String(context.index).padStart(2, "0"))
    .replace(/\{n\}/gi, String(context.index))
    .replace(/\{w\}/gi, String(context.width))
    .replace(/\{h\}/gi, String(context.height))
    .replace(/\{date\}/gi, date)
    .replace(/\{ext\}/gi, context.extension);

  // Strip characters filesystems reject, and any extension the user typed so
  // it cannot conflict with the real one.
  const safe = expanded
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(new RegExp(`\\.${context.extension}$`, "i"), "");

  return `${safe || base || "image"}.${context.extension}`;
}

export interface ConversionOutcome {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  originalBytes: number;
}

/**
 * Converts one decoded image.
 *
 * Drawing happens once into a correctly sized buffer; for formats without
 * alpha the matte is painted first so transparency flattens predictably
 * instead of turning black.
 */
export async function convertImage(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  settings: ConvertSettings,
  factory: CanvasFactory,
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>,
  context: { originalName: string; index: number; originalBytes: number }
): Promise<ConversionOutcome> {
  const descriptor = convertDescriptor(settings.format);
  const size = targetSize(settings, naturalWidth, naturalHeight);

  const { canvas, ctx } = factory.create(size.width, size.height);
  if (!descriptor.supportsAlpha) {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size.width, size.height);

  let blob: Blob;
  if (descriptor.manual) {
    // BMP is written by hand; the canvas cannot produce it.
    const imageData = ctx.getImageData(0, 0, size.width, size.height);
    const bytes = encodeBmp(imageData.data, size.width, size.height);
    blob = new Blob([bytes as unknown as BlobPart], { type: descriptor.mimeType });
  } else {
    blob = await toBlob(
      canvas,
      descriptor.mimeType,
      descriptor.supportsQuality ? settings.quality / 100 : undefined
    );
  }

  return {
    blob,
    fileName: buildFileName(settings.namePattern, {
      originalName: context.originalName,
      index: context.index,
      width: size.width,
      height: size.height,
      extension: descriptor.extension,
    }),
    width: size.width,
    height: size.height,
    originalBytes: context.originalBytes,
  };
}

/* -------------------------------------------------------------------------- */
/* Packaging                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Packs results into a ZIP.
 *
 * Stored without further compression: the images are already compressed, so
 * deflating them again costs time and saves almost nothing. Duplicate names
 * are de-duplicated because a rename pattern can easily produce collisions.
 */
export async function packageZip(
  outcomes: ConversionOutcome[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  // Imported on demand. JSZip is ~100 kB and only the Batch Converter ever
  // packages an archive, so a static import would put it in the bundle of
  // every page that touches the editor core.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Map<string, number>();

  for (const outcome of outcomes) {
    let name = outcome.fileName;
    const seen = used.get(name);
    if (seen !== undefined) {
      const next = seen + 1;
      used.set(name, next);
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)} (${next})${name.slice(dot)}` : `${name} (${next})`;
    } else {
      used.set(name, 0);
    }
    // Blobs are read through `FileReader`, which does not exist outside a
    // browser. Passing the bytes directly works in every runtime and skips a
    // redundant async read even in the browser.
    zip.file(name, await outcome.blob.arrayBuffer());
  }

  return zip.generateAsync(
    { type: "blob", compression: "STORE" },
    (metadata) => onProgress?.(metadata.percent)
  );
}

/** Total bytes across a set of outcomes. */
export function totalBytes(outcomes: ConversionOutcome[]): number {
  return outcomes.reduce((sum, outcome) => sum + outcome.blob.size, 0);
}
