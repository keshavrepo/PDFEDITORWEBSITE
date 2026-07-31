/**
 * Image metadata inspection and removal.
 *
 * Works on the encoded bytes directly rather than going through a canvas.
 * That matters for two reasons: re-encoding through a canvas would recompress
 * a JPEG and lose quality, and it would also silently discard metadata without
 * ever telling the user what was in there. This module reads the container
 * structure, reports exactly what it found, and rewrites the file with the
 * chosen segments removed and the pixel data untouched.
 *
 * Formats handled:
 *
 * - **JPEG** — APPn marker segments (EXIF, XMP, Photoshop IRB, ICC, comments)
 * - **PNG**  — ancillary chunks (tEXt, iTXt, zTXt, eXIf, tIME)
 * - **WEBP** — RIFF chunks (EXIF, XMP, ICCP)
 *
 * Only metadata segments are dropped; the compressed image data is copied over
 * byte for byte, so removal is genuinely lossless.
 */

export type MetadataCategory =
  | "location"
  | "camera"
  | "author"
  | "software"
  | "timestamp"
  | "thumbnail"
  | "color-profile"
  | "other";

export interface MetadataEntry {
  /** Human-readable label, e.g. "GPS position". */
  label: string;
  /** The value when it could be decoded, otherwise a size summary. */
  value: string;
  category: MetadataCategory;
  /** Bytes this entry's containing segment occupies. */
  bytes: number;
}

export interface MetadataReport {
  format: "jpeg" | "png" | "webp" | "unknown";
  entries: MetadataEntry[];
  /** Total bytes occupied by removable metadata. */
  metadataBytes: number;
  totalBytes: number;
  /** True when the file carries GPS coordinates. */
  hasLocation: boolean;
}

export interface CleanOptions {
  removeLocation: boolean;
  removeCamera: boolean;
  removeAuthor: boolean;
  removeSoftware: boolean;
  removeTimestamp: boolean;
  removeThumbnail: boolean;
  /**
   * Colour profiles are metadata but dropping one changes how the image is
   * displayed, so it is opt-in and off by default.
   */
  removeColorProfile: boolean;
}

export const defaultCleanOptions: CleanOptions = {
  removeLocation: true,
  removeCamera: true,
  removeAuthor: true,
  removeSoftware: true,
  removeTimestamp: true,
  removeThumbnail: true,
  removeColorProfile: false,
};

/** Every category the cleaner can act on, with UI copy. */
export const METADATA_CATEGORIES: Array<{
  key: keyof CleanOptions;
  category: MetadataCategory;
  label: string;
  description: string;
}> = [
  {
    key: "removeLocation",
    category: "location",
    label: "GPS location",
    description: "Where the photo was taken, often accurate to a few metres",
  },
  {
    key: "removeCamera",
    category: "camera",
    label: "Camera and settings",
    description: "Make, model, lens, exposure, ISO and serial numbers",
  },
  {
    key: "removeAuthor",
    category: "author",
    label: "Author and copyright",
    description: "Artist, copyright notice, description and keywords",
  },
  {
    key: "removeSoftware",
    category: "software",
    label: "Software",
    description: "The application and version that produced the file",
  },
  {
    key: "removeTimestamp",
    category: "timestamp",
    label: "Date and time",
    description: "When the photo was captured and last modified",
  },
  {
    key: "removeThumbnail",
    category: "thumbnail",
    label: "Embedded thumbnail",
    description: "A small preview that can survive edits to the main image",
  },
  {
    key: "removeColorProfile",
    category: "color-profile",
    label: "Colour profile",
    description: "ICC profile — removing it may shift how colours display",
  },
];

/* -------------------------------------------------------------------------- */
/* Byte helpers                                                               */
/* -------------------------------------------------------------------------- */

function readUint16(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint16(offset, littleEndian);
}

function readUint32(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint32(offset, littleEndian);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const code = bytes[offset + i];
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

export function detectFormat(bytes: Uint8Array): MetadataReport["format"] {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length > 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  return "unknown";
}

/* -------------------------------------------------------------------------- */
/* EXIF (TIFF IFD) parsing                                                    */
/* -------------------------------------------------------------------------- */

/** Tags worth surfacing, mapped to a label and a category. */
const EXIF_TAGS: Record<number, { label: string; category: MetadataCategory }> = {
  0x010f: { label: "Camera make", category: "camera" },
  0x0110: { label: "Camera model", category: "camera" },
  0x0131: { label: "Software", category: "software" },
  0x0132: { label: "Modified", category: "timestamp" },
  0x013b: { label: "Artist", category: "author" },
  0x8298: { label: "Copyright", category: "author" },
  0x010e: { label: "Description", category: "author" },
  0x9003: { label: "Captured", category: "timestamp" },
  0x9004: { label: "Digitised", category: "timestamp" },
  0x829a: { label: "Exposure time", category: "camera" },
  0x829d: { label: "Aperture", category: "camera" },
  0x8827: { label: "ISO", category: "camera" },
  0x920a: { label: "Focal length", category: "camera" },
  0xa434: { label: "Lens model", category: "camera" },
  0xa431: { label: "Body serial number", category: "camera" },
  0xa435: { label: "Lens serial number", category: "camera" },
};

const GPS_TAGS: Record<number, string> = {
  0x0001: "GPS latitude ref",
  0x0002: "GPS latitude",
  0x0003: "GPS longitude ref",
  0x0004: "GPS longitude",
  0x0006: "GPS altitude",
  0x0012: "GPS map datum",
};

/** Byte width of each TIFF field type, indexed by type id. */
const TYPE_SIZES: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8,
};

/**
 * Reads one IFD and appends what it finds.
 *
 * Deliberately tolerant: a malformed offset returns what has been read so far
 * rather than throwing, because a partially damaged EXIF block must not stop
 * the file being cleaned.
 */
function readIfd(
  view: DataView,
  bytes: Uint8Array,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
  entries: MetadataEntry[],
  isGps: boolean,
  depth = 0
): void {
  if (depth > 3) return;
  const base = tiffStart + ifdOffset;
  if (base + 2 > view.byteLength) return;

  const count = readUint16(view, base, littleEndian);
  // A plausible IFD has a handful of entries; thousands means we are lost.
  if (count > 512) return;

  for (let i = 0; i < count; i++) {
    const entryOffset = base + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) return;

    const tag = readUint16(view, entryOffset, littleEndian);
    const type = readUint16(view, entryOffset + 2, littleEndian);
    const valueCount = readUint32(view, entryOffset + 4, littleEndian);
    const typeSize = TYPE_SIZES[type] ?? 0;
    if (!typeSize) continue;

    const byteLength = typeSize * valueCount;
    // Values of four bytes or fewer are stored inline in the entry itself.
    const valueOffset =
      byteLength <= 4
        ? entryOffset + 8
        : tiffStart + readUint32(view, entryOffset + 8, littleEndian);

    // Sub-IFD pointers.
    if (!isGps && tag === 0x8769) {
      readIfd(view, bytes, tiffStart, readUint32(view, valueOffset, littleEndian), littleEndian, entries, false, depth + 1);
      continue;
    }
    if (!isGps && tag === 0x8825) {
      readIfd(view, bytes, tiffStart, readUint32(view, valueOffset, littleEndian), littleEndian, entries, true, depth + 1);
      continue;
    }

    const known = isGps
      ? GPS_TAGS[tag]
        ? { label: GPS_TAGS[tag], category: "location" as MetadataCategory }
        : null
      : EXIF_TAGS[tag];
    if (!known) continue;
    if (valueOffset + byteLength > view.byteLength || valueOffset < 0) continue;

    let value = "";
    if (type === 2) {
      value = readAscii(bytes, valueOffset, Math.min(byteLength, 120)).trim();
    } else if (type === 5 || type === 10) {
      // Rationals: numerator / denominator pairs.
      const parts: string[] = [];
      for (let n = 0; n < Math.min(valueCount, 3); n++) {
        const numerator = readUint32(view, valueOffset + n * 8, littleEndian);
        const denominator = readUint32(view, valueOffset + n * 8 + 4, littleEndian);
        parts.push(denominator ? String(Math.round((numerator / denominator) * 1e6) / 1e6) : "0");
      }
      value = parts.join(", ");
    } else if (type === 3) {
      value = String(readUint16(view, valueOffset, littleEndian));
    } else if (type === 4) {
      value = String(readUint32(view, valueOffset, littleEndian));
    }

    if (!value) continue;
    entries.push({ label: known.label, value, category: known.category, bytes: byteLength });
  }
}

/** Parses an EXIF payload (the bytes after the "Exif\0\0" header). */
function parseExif(payload: Uint8Array): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  if (payload.length < 8) return entries;

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const byteOrder = readAscii(payload, 0, 2);
  if (byteOrder !== "II" && byteOrder !== "MM") return entries;
  const littleEndian = byteOrder === "II";

  // Magic number 42 confirms a valid TIFF header.
  if (readUint16(view, 2, littleEndian) !== 42) return entries;

  const firstIfd = readUint32(view, 4, littleEndian);
  readIfd(view, payload, 0, firstIfd, littleEndian, entries, false);
  return entries;
}

/* -------------------------------------------------------------------------- */
/* JPEG                                                                       */
/* -------------------------------------------------------------------------- */

interface Segment {
  marker: number;
  start: number;
  end: number;
  category: MetadataCategory | null;
  label: string;
  entries: MetadataEntry[];
}

/**
 * Walks a JPEG's marker segments.
 *
 * Stops at start-of-scan: everything after it is entropy-coded image data with
 * no further metadata, and scanning it for markers would produce false hits.
 */
function scanJpeg(bytes: Uint8Array): Segment[] {
  const segments: Segment[] = [];
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) break;
    const start = offset;
    const end = offset + 2 + length;
    if (end > bytes.length) break;

    const payload = bytes.subarray(offset + 4, end);
    let category: MetadataCategory | null = null;
    let label = "";
    let entries: MetadataEntry[] = [];

    if (marker === 0xe1) {
      const header = readAscii(payload, 0, 6);
      if (header.startsWith("Exif")) {
        label = "EXIF";
        // Skip the six-byte "Exif\0\0" identifier.
        entries = parseExif(payload.subarray(6));
        // Categorise the whole segment by its most sensitive content.
        category = entries.some((entry) => entry.category === "location")
          ? "location"
          : "camera";
      } else if (readAscii(payload, 0, 28).includes("ns.adobe.com/xap")) {
        label = "XMP";
        category = "author";
      } else {
        label = "APP1";
        category = "other";
      }
    } else if (marker === 0xe2 && readAscii(payload, 0, 11) === "ICC_PROFILE") {
      label = "ICC colour profile";
      category = "color-profile";
    } else if (marker === 0xed) {
      label = "Photoshop metadata";
      category = "author";
    } else if (marker === 0xee) {
      label = "Adobe marker";
      category = "software";
    } else if (marker === 0xfe) {
      label = "Comment";
      category = "other";
      const text = readAscii(payload, 0, Math.min(payload.length, 80)).trim();
      if (text) {
        entries = [{ label: "Comment", value: text, category: "other", bytes: payload.length }];
      }
    } else if (marker >= 0xe0 && marker <= 0xef) {
      // APP0 is the JFIF density header, which is structural rather than
      // personal, so it is preserved.
      if (marker !== 0xe0) {
        label = `APP${marker - 0xe0}`;
        category = "other";
      }
    }

    segments.push({ marker, start, end, category, label, entries });
    offset = end;
  }

  return segments;
}

/* -------------------------------------------------------------------------- */
/* PNG                                                                        */
/* -------------------------------------------------------------------------- */

interface PngChunk {
  type: string;
  start: number;
  end: number;
  category: MetadataCategory | null;
  entries: MetadataEntry[];
}

function scanPng(bytes: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = readAscii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) break;

    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    let category: MetadataCategory | null = null;
    const entries: MetadataEntry[] = [];

    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      category = "author";
      // Keyword and value are separated by a NUL.
      const separator = payload.indexOf(0);
      const keyword = readAscii(payload, 0, separator < 0 ? Math.min(length, 40) : separator);
      // Only tEXt stores its value as plain readable bytes.
      const value =
        type === "tEXt" && separator >= 0
          ? readAscii(payload, separator + 1, Math.min(120, length - separator - 1))
          : `${length} bytes`;
      if (keyword) {
        const lowered = keyword.toLowerCase();
        if (lowered.includes("software") || lowered.includes("source")) category = "software";
        else if (lowered.includes("creation") || lowered.includes("date")) category = "timestamp";
        entries.push({ label: keyword, value, category, bytes: length });
      }
    } else if (type === "eXIf") {
      const exifEntries = parseExif(payload);
      entries.push(...exifEntries);
      category = exifEntries.some((entry) => entry.category === "location") ? "location" : "camera";
    } else if (type === "tIME") {
      category = "timestamp";
      if (length >= 7) {
        const year = view.getUint16(offset + 8, false);
        entries.push({
          label: "Last modified",
          value: `${year}-${String(payload[2]).padStart(2, "0")}-${String(payload[3]).padStart(2, "0")}`,
          category: "timestamp",
          bytes: length,
        });
      }
    } else if (type === "iCCP") {
      category = "color-profile";
      entries.push({
        label: "ICC colour profile",
        value: `${length} bytes`,
        category: "color-profile",
        bytes: length,
      });
    }

    chunks.push({ type, start: offset, end, category, entries });
    if (type === "IEND") break;
    offset = end;
  }

  return chunks;
}

/* -------------------------------------------------------------------------- */
/* WEBP                                                                       */
/* -------------------------------------------------------------------------- */

interface RiffChunk {
  type: string;
  start: number;
  end: number;
  category: MetadataCategory | null;
  entries: MetadataEntry[];
}

function scanWebp(bytes: Uint8Array): RiffChunk[] {
  const chunks: RiffChunk[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const type = readAscii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    // RIFF chunks are padded to an even length.
    const end = offset + 8 + length + (length % 2);
    if (end > bytes.length + 1) break;

    const payload = bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + length));
    let category: MetadataCategory | null = null;
    const entries: MetadataEntry[] = [];

    if (type === "EXIF") {
      const exifEntries = parseExif(
        readAscii(payload, 0, 4) === "Exif" ? payload.subarray(6) : payload
      );
      entries.push(...exifEntries);
      category = exifEntries.some((entry) => entry.category === "location") ? "location" : "camera";
    } else if (type === "XMP ") {
      category = "author";
      entries.push({ label: "XMP metadata", value: `${length} bytes`, category: "author", bytes: length });
    } else if (type === "ICCP") {
      category = "color-profile";
      entries.push({
        label: "ICC colour profile",
        value: `${length} bytes`,
        category: "color-profile",
        bytes: length,
      });
    }

    chunks.push({ type, start: offset, end, category, entries });
    offset = end;
  }

  return chunks;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Inspects a file and reports the metadata it carries. */
export function inspectMetadata(bytes: Uint8Array): MetadataReport {
  const format = detectFormat(bytes);
  const entries: MetadataEntry[] = [];
  let metadataBytes = 0;

  if (format === "jpeg") {
    for (const segment of scanJpeg(bytes)) {
      if (!segment.category) continue;
      metadataBytes += segment.end - segment.start;
      if (segment.entries.length) {
        entries.push(...segment.entries);
      } else if (segment.label) {
        entries.push({
          label: segment.label,
          value: `${segment.end - segment.start} bytes`,
          category: segment.category,
          bytes: segment.end - segment.start,
        });
      }
    }
  } else if (format === "png") {
    for (const chunk of scanPng(bytes)) {
      if (!chunk.category) continue;
      metadataBytes += chunk.end - chunk.start;
      if (chunk.entries.length) {
        entries.push(...chunk.entries);
      } else {
        entries.push({
          label: chunk.type,
          value: `${chunk.end - chunk.start} bytes`,
          category: chunk.category,
          bytes: chunk.end - chunk.start,
        });
      }
    }
  } else if (format === "webp") {
    for (const chunk of scanWebp(bytes)) {
      if (!chunk.category) continue;
      metadataBytes += chunk.end - chunk.start;
      if (chunk.entries.length) {
        entries.push(...chunk.entries);
      } else {
        entries.push({
          label: chunk.type.trim(),
          value: `${chunk.end - chunk.start} bytes`,
          category: chunk.category,
          bytes: chunk.end - chunk.start,
        });
      }
    }
  }

  return {
    format,
    entries,
    metadataBytes,
    totalBytes: bytes.length,
    hasLocation: entries.some((entry) => entry.category === "location"),
  };
}

/** True when a category is selected for removal. */
function shouldRemove(category: MetadataCategory, options: CleanOptions): boolean {
  switch (category) {
    case "location":
      return options.removeLocation;
    case "camera":
      return options.removeCamera;
    case "author":
      return options.removeAuthor;
    case "software":
      return options.removeSoftware;
    case "timestamp":
      return options.removeTimestamp;
    case "thumbnail":
      return options.removeThumbnail;
    case "color-profile":
      return options.removeColorProfile;
    default:
      // "other" covers comments and unrecognised APPn blocks. These are
      // stripped whenever the user is removing author data, since that is the
      // intent behind clearing free-text fields.
      return options.removeAuthor;
  }
}

/** CRC-32 table for rebuilding PNG chunk checksums. */
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

export interface CleanResult {
  bytes: Uint8Array;
  /** Bytes removed. */
  removedBytes: number;
  /** Entries that were dropped. */
  removed: MetadataEntry[];
  /** Entries deliberately kept. */
  kept: MetadataEntry[];
}

/**
 * Rewrites a file with the selected metadata removed.
 *
 * The pixel data is copied verbatim, so this is lossless: a JPEG cleaned this
 * way is bit-identical in its scan data to the original.
 */
export function cleanMetadata(bytes: Uint8Array, options: CleanOptions): CleanResult {
  const format = detectFormat(bytes);
  const removed: MetadataEntry[] = [];
  const kept: MetadataEntry[] = [];

  if (format === "jpeg") {
    const segments = scanJpeg(bytes);
    const parts: Uint8Array[] = [bytes.subarray(0, 2)];
    let cursor = 2;

    for (const segment of segments) {
      const drop = segment.category !== null && shouldRemove(segment.category, options);

      // Copy anything between the previous segment and this one.
      if (segment.start > cursor) parts.push(bytes.subarray(cursor, segment.start));

      if (drop) {
        removed.push(
          ...(segment.entries.length
            ? segment.entries
            : [
                {
                  label: segment.label || "Metadata",
                  value: `${segment.end - segment.start} bytes`,
                  category: segment.category!,
                  bytes: segment.end - segment.start,
                },
              ])
        );
      } else {
        parts.push(bytes.subarray(segment.start, segment.end));
        kept.push(...segment.entries);
      }

      cursor = segment.end;
    }

    // Everything from start-of-scan onward is image data.
    if (cursor < bytes.length) parts.push(bytes.subarray(cursor));

    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }

    return { bytes: out, removedBytes: bytes.length - out.length, removed, kept };
  }

  if (format === "png") {
    const chunks = scanPng(bytes);
    const parts: Uint8Array[] = [bytes.subarray(0, 8)];

    for (const chunk of chunks) {
      const drop = chunk.category !== null && shouldRemove(chunk.category, options);
      if (drop) {
        removed.push(
          ...(chunk.entries.length
            ? chunk.entries
            : [
                {
                  label: chunk.type,
                  value: `${chunk.end - chunk.start} bytes`,
                  category: chunk.category!,
                  bytes: chunk.end - chunk.start,
                },
              ])
        );
        continue;
      }
      parts.push(bytes.subarray(chunk.start, chunk.end));
      kept.push(...chunk.entries);
    }

    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }

    return { bytes: out, removedBytes: bytes.length - out.length, removed, kept };
  }

  if (format === "webp") {
    const chunks = scanWebp(bytes);
    const parts: Uint8Array[] = [];

    for (const chunk of chunks) {
      const drop = chunk.category !== null && shouldRemove(chunk.category, options);
      if (drop) {
        removed.push(
          ...(chunk.entries.length
            ? chunk.entries
            : [
                {
                  label: chunk.type.trim(),
                  value: `${chunk.end - chunk.start} bytes`,
                  category: chunk.category!,
                  bytes: chunk.end - chunk.start,
                },
              ])
        );
        continue;
      }
      parts.push(bytes.subarray(chunk.start, Math.min(bytes.length, chunk.end)));
      kept.push(...chunk.entries);
    }

    const payloadLength = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(12 + payloadLength);
    out.set(bytes.subarray(0, 12), 0);
    // The RIFF header carries the total size, which has to be rewritten.
    new DataView(out.buffer).setUint32(4, 4 + payloadLength, true);
    let offset = 12;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }

    return { bytes: out, removedBytes: bytes.length - out.length, removed, kept };
  }

  // Unknown container: return it untouched rather than risk corrupting it.
  return { bytes, removedBytes: 0, removed, kept };
}

/** Rebuilds a PNG chunk with a correct CRC. Exposed for tests. */
export function buildPngChunk(type: string, payload: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + payload.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length, false);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(chunk.subarray(4, 8 + payload.length)), false);
  return chunk;
}

/** Groups entries by category for display. */
export function groupByCategory(
  entries: MetadataEntry[]
): Array<{ category: MetadataCategory; label: string; entries: MetadataEntry[] }> {
  const labels: Record<MetadataCategory, string> = {
    location: "Location",
    camera: "Camera",
    author: "Author and description",
    software: "Software",
    timestamp: "Date and time",
    thumbnail: "Thumbnail",
    "color-profile": "Colour profile",
    other: "Other",
  };

  const grouped = new Map<MetadataCategory, MetadataEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.category);
    if (list) list.push(entry);
    else grouped.set(entry.category, [entry]);
  }

  // Location first: it is the entry users most often care about.
  const order: MetadataCategory[] = [
    "location", "camera", "author", "software", "timestamp", "thumbnail", "color-profile", "other",
  ];

  return order
    .filter((category) => grouped.has(category))
    .map((category) => ({
      category,
      label: labels[category],
      entries: grouped.get(category)!,
    }));
}
