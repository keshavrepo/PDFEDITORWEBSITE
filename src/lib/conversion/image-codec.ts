/**
 * Dependency-free raster helpers shared by every converter.
 *
 * Conversions run in the browser, but the same code is exercised by the
 * Node-based conversion tests. Both runtimes expose `CompressionStream`, so PNG
 * encoding is implemented directly instead of relying on `<canvas>` (which is
 * unavailable in workers on some browsers and absent in Node).
 */

import type { RasterImage } from "./types";

/* -------------------------------------------------------------------------- */
/* PNG encoding                                                               */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  // `bytes` may be a view over a larger buffer; copy so the writer sees exactly
  // the intended range.
  void writer.write(new Uint8Array(bytes));
  void writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/**
 * Encodes 8-bit RGBA pixels as a PNG.
 *
 * Uses the "Up" filter on rows that benefit from it, which meaningfully shrinks
 * screenshots and flat-colour graphics at negligible CPU cost.
 */
export async function encodePng(
  rgba: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  // Typed as ArrayBufferLike because it is reassigned to subarray views of the
  // caller's buffer, which may itself be backed by any ArrayBufferLike.
  let previous: Uint8Array<ArrayBufferLike> = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    const target = (stride + 1) * y;

    // Choose between None and Up with a cheap sum-of-absolute-differences
    // heuristic, the standard approach from the PNG specification.
    let noneScore = 0;
    let upScore = 0;
    for (let i = 0; i < stride; i += 4) {
      noneScore += row[i] + row[i + 1] + row[i + 2];
      upScore +=
        Math.abs(row[i] - previous[i]) +
        Math.abs(row[i + 1] - previous[i + 1]) +
        Math.abs(row[i + 2] - previous[i + 2]);
    }

    if (upScore < noneScore) {
      raw[target] = 2;
      for (let i = 0; i < stride; i++) raw[target + 1 + i] = (row[i] - previous[i]) & 0xff;
    } else {
      raw[target] = 0;
      raw.set(row, target + 1);
    }
    previous = row;
  }

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  return concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", await deflate(raw)),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Format detection                                                           */
/* -------------------------------------------------------------------------- */

export type DetectedImageFormat = "png" | "jpeg" | "gif" | "bmp" | "webp" | "tiff" | "emf" | "unknown";

export function detectImageFormat(bytes: Uint8Array): DetectedImageFormat {
  if (bytes.length < 12) return "unknown";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00)) {
    return "tiff";
  }
  if (bytes[0] === 0x01 && bytes[1] === 0x00 && bytes[2] === 0x00 && bytes[3] === 0x00) return "emf";
  return "unknown";
}

/** Reads intrinsic pixel dimensions without decoding pixel data. */
export function readImageSize(
  bytes: Uint8Array,
  format: DetectedImageFormat
): { width: number; height: number } | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (format === "png") {
      // IHDR is always the first chunk: 8-byte signature + 8-byte chunk header.
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }

    if (format === "jpeg") {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = bytes[offset + 1];
        // SOF0-SOF15, excluding DHT (c4), JPG (c8) and DAC (cc).
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
        }
        offset += 2 + view.getUint16(offset + 2);
      }
      return null;
    }

    if (format === "gif") {
      return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }

    if (format === "bmp") {
      return { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)) };
    }

    if (format === "webp") {
      const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (chunk === "VP8X") {
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        return { width, height };
      }
      if (chunk === "VP8 ") {
        return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      }
      if (chunk === "VP8L") {
        const bits = view.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Pixel conversion                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Converts a pdf.js image object into RGBA pixels.
 *
 * pdf.js exposes three kinds: 1bpp grayscale (bit-packed), 24bpp RGB and 32bpp
 * RGBA. Rows are padded to byte boundaries for the 1bpp kind.
 */
export function pdfImageToRgba(image: {
  width: number;
  height: number;
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
}): Uint8Array {
  const { width, height, kind, data } = image;
  const rgba = new Uint8Array(width * height * 4);

  if (kind === 1) {
    // GRAYSCALE_1BPP: 1 = white, 0 = black, rows padded to whole bytes.
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const value = bit ? 255 : 0;
        const target = (y * width + x) * 4;
        rgba[target] = value;
        rgba[target + 1] = value;
        rgba[target + 2] = value;
        rgba[target + 3] = 255;
      }
    }
    return rgba;
  }

  if (kind === 2) {
    // RGB_24BPP
    for (let i = 0, source = 0; i < rgba.length; i += 4, source += 3) {
      rgba[i] = data[source];
      rgba[i + 1] = data[source + 1];
      rgba[i + 2] = data[source + 2];
      rgba[i + 3] = 255;
    }
    return rgba;
  }

  // RGBA_32BPP
  rgba.set(data.subarray(0, rgba.length));
  return rgba;
}

/** Composites RGBA pixels onto an opaque white background. */
export function flattenOntoWhite(rgba: Uint8Array): Uint8Array {
  const output = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    const inverse = 1 - alpha;
    output[i] = Math.round(rgba[i] * alpha + 255 * inverse);
    output[i + 1] = Math.round(rgba[i + 1] * alpha + 255 * inverse);
    output[i + 2] = Math.round(rgba[i + 2] * alpha + 255 * inverse);
    output[i + 3] = 255;
  }
  return output;
}

/** True when any pixel is not fully opaque. */
export function hasTransparency(rgba: Uint8Array): boolean {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 255) return true;
  }
  return false;
}

/**
 * Box-filter downscale used to cap embedded image resolution.
 * Averaging (rather than nearest neighbour) avoids visible aliasing on text
 * rendered inside screenshots.
 */
export function downscaleRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number
): Uint8Array {
  const output = new Uint8Array(targetWidth * targetHeight * 4);
  const xRatio = width / targetWidth;
  const yRatio = height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    const startY = Math.floor(y * yRatio);
    const endY = Math.min(height, Math.max(startY + 1, Math.ceil((y + 1) * yRatio)));
    for (let x = 0; x < targetWidth; x++) {
      const startX = Math.floor(x * xRatio);
      const endX = Math.min(width, Math.max(startX + 1, Math.ceil((x + 1) * xRatio)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = startY; sy < endY; sy++) {
        for (let sx = startX; sx < endX; sx++) {
          const index = (sy * width + sx) * 4;
          r += rgba[index];
          g += rgba[index + 1];
          b += rgba[index + 2];
          a += rgba[index + 3];
          count++;
        }
      }
      const target = (y * targetWidth + x) * 4;
      output[target] = Math.round(r / count);
      output[target + 1] = Math.round(g / count);
      output[target + 2] = Math.round(b / count);
      output[target + 3] = Math.round(a / count);
    }
  }
  return output;
}

/** Builds a {@link RasterImage} from already-encoded bytes. */
export function rasterFromEncoded(
  data: Uint8Array,
  fallbackWidth: number,
  fallbackHeight: number
): RasterImage | null {
  const format = detectImageFormat(data);
  if (format !== "png" && format !== "jpeg") return null;
  const size = readImageSize(data, format);
  return {
    data,
    format,
    pixelWidth: size?.width || fallbackWidth,
    pixelHeight: size?.height || fallbackHeight,
  };
}
