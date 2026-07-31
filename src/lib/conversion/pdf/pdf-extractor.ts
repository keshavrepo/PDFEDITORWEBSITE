/**
 * Extracts positioned text, images and page geometry from a PDF.
 *
 * pdf.js is used for parsing because it implements the full text-showing model
 * (text matrices, character/word spacing, horizontal scaling, Type3 fonts and
 * CMap decoding). Reimplementing that would be both large and less accurate.
 *
 * Two passes are made over each page:
 *  1. `getOperatorList()` — required before font objects resolve, and the only
 *     source of fill colours and image placement.
 *  2. `getTextContent()` — correctly positioned and merged text runs.
 *
 * All output uses points with a **top-left origin**.
 */

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { loadPdfJs, openPdf } from "./pdf-loader";
import { resolvePdfFont, type ResolvedFont } from "./font-mapping";
import {
  downscaleRgba,
  encodePng,
  flattenOntoWhite,
  hasTransparency,
  pdfImageToRgba,
} from "../image-codec";
import type {
  ConversionProgressCallback,
  DocumentMetadata,
  RasterImage,
} from "../types";
import { conversionErrors } from "../errors";

/** A single positioned text fragment straight from pdf.js. */
export interface ExtractedTextItem {
  text: string;
  /** Left edge in points from the page's left edge. */
  x: number;
  /** Baseline in points from the page's top edge. */
  baseline: number;
  width: number;
  fontSize: number;
  font: ResolvedFont;
  color: string;
  ascent: number;
  descent: number;
  /** True when the source explicitly ended the line after this item. */
  endsLine: boolean;
}

export interface ExtractedImage {
  image: RasterImage;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedPage {
  width: number;
  height: number;
  items: ExtractedTextItem[];
  images: ExtractedImage[];
}

export interface ExtractedPdf {
  pages: ExtractedPage[];
  metadata: DocumentMetadata;
}

export interface PdfExtractionOptions {
  /** Skip image extraction entirely (faster, text-only output). */
  includeImages?: boolean;
  /** Longest edge, in pixels, for embedded images. Larger images are downscaled. */
  maxImagePixels?: number;
  signal?: AbortSignal;
}

const DEFAULT_MAX_IMAGE_PIXELS = 1600;
/** Images below this size are almost always rules, bullets or spacers. */
const MIN_IMAGE_POINTS = 8;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
}

/** Converts a pdf.js RGB string (`#rrggbb`) to uppercase `RRGGBB`. */
function normalizeColor(value: unknown): string {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
    return value.slice(1).toUpperCase();
  }
  if (Array.isArray(value) && value.length >= 3) {
    return value
      .slice(0, 3)
      .map((channel) => {
        const scaled = typeof channel === "number" && channel <= 1 ? channel * 255 : Number(channel);
        return Math.max(0, Math.min(255, Math.round(scaled)))
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
      .toUpperCase();
  }
  return "000000";
}

/** 3x3 affine multiply using pdf.js's 6-element [a,b,c,d,e,f] convention. */
function multiplyTransform(first: number[], second: number[]): number[] {
  return [
    first[0] * second[0] + first[2] * second[1],
    first[1] * second[0] + first[3] * second[1],
    first[0] * second[2] + first[2] * second[3],
    first[1] * second[2] + first[3] * second[3],
    first[0] * second[4] + first[2] * second[5] + first[4],
    first[1] * second[4] + first[3] * second[5] + first[5],
  ];
}

interface FontDescriptor {
  name?: string;
  bold?: boolean;
  italic?: boolean;
  fallbackName?: string;
  ascent?: number;
  descent?: number;
}

/**
 * Walks the operator list to recover fill colours per text-showing operation
 * and the placement of every painted image.
 *
 * Colours are collected as an ordered list. pdf.js emits one `showText` per
 * text-showing operator, and `getTextContent()` emits its items in the same
 * order, which lets the two be aligned by index when the counts agree.
 */
async function readOperatorList(
  page: PDFPageProxy,
  pageHeight: number,
  options: PdfExtractionOptions
): Promise<{ colors: string[]; images: ExtractedImage[] }> {
  const pdfjs = await loadPdfJs();
  const { OPS } = pdfjs;
  const operators = await page.getOperatorList();

  const colors: string[] = [];
  const images: ExtractedImage[] = [];

  let currentColor = "000000";
  let transform = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const includeImages = options.includeImages !== false;

  for (let index = 0; index < operators.fnArray.length; index++) {
    const fn = operators.fnArray[index];
    const args = operators.argsArray[index] as unknown[];

    switch (fn) {
      case OPS.save:
        stack.push([...transform]);
        break;
      case OPS.restore:
        transform = stack.pop() || [1, 0, 0, 1, 0, 0];
        break;
      case OPS.transform:
        transform = multiplyTransform(transform, args as number[]);
        break;
      case OPS.setFillRGBColor:
        currentColor = normalizeColor(args[0]);
        break;
      case OPS.setFillGray:
      case OPS.setFillCMYKColor:
      case OPS.setFillColorN:
      case OPS.setFillColor:
        currentColor = normalizeColor(args[0]);
        break;
      case OPS.showText:
      case OPS.showSpacedText:
        colors.push(currentColor);
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject: {
        if (!includeImages) break;
        const placement = imagePlacement(transform, pageHeight);
        if (!placement) break;
        const objectId = typeof args[0] === "string" ? (args[0] as string) : null;
        const inlineData = fn === OPS.paintInlineImageXObject ? args[0] : null;
        const extracted = await resolveImage(
          page,
          objectId,
          inlineData,
          fn === OPS.paintImageMaskXObject,
          options
        );
        if (extracted) images.push({ image: extracted, ...placement });
        break;
      }
      default:
        break;
    }
  }

  return { colors, images };
}

/**
 * Converts an image CTM into a top-left rectangle.
 * Returns null for degenerate or rotated/skewed placements, which cannot be
 * represented as an axis-aligned Office picture frame.
 */
function imagePlacement(
  transform: number[],
  pageHeight: number
): { x: number; y: number; width: number; height: number } | null {
  const [a, b, c, d, e, f] = transform;
  // Reject sheared placements; a small tolerance absorbs float noise.
  if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) return null;

  const width = Math.abs(a);
  const height = Math.abs(d);
  if (width < MIN_IMAGE_POINTS || height < MIN_IMAGE_POINTS) return null;

  // The unit square maps to [e, e+a] x [f, f+d] in PDF space (bottom-left
  // origin). Negative scales flip the image, so normalise the origin.
  const left = a >= 0 ? e : e + a;
  const bottom = d >= 0 ? f : f + d;
  return {
    x: left,
    y: pageHeight - (bottom + height),
    width,
    height,
  };
}

/** Retrieves and re-encodes a painted image as PNG. */
async function resolveImage(
  page: PDFPageProxy,
  objectId: string | null,
  inlineData: unknown,
  isMask: boolean,
  options: PdfExtractionOptions
): Promise<RasterImage | null> {
  try {
    const raw = objectId ? await getPageObject(page, objectId) : inlineData;
    if (!raw || typeof raw !== "object") return null;

    const source = raw as {
      width?: number;
      height?: number;
      kind?: number;
      data?: Uint8Array | Uint8ClampedArray;
      bitmap?: unknown;
    };
    const width = source.width || 0;
    const height = source.height || 0;
    if (!width || !height || !source.data) return null;

    // Guard against pathological allocations from malformed documents.
    if (width * height > 40_000_000) return null;

    let rgba = isMask
      ? maskToRgba(source.data, width, height)
      : pdfImageToRgba({ width, height, kind: source.kind || 3, data: source.data });

    let outputWidth = width;
    let outputHeight = height;
    const maxPixels = options.maxImagePixels || DEFAULT_MAX_IMAGE_PIXELS;
    const longestEdge = Math.max(width, height);
    if (longestEdge > maxPixels) {
      const scale = maxPixels / longestEdge;
      outputWidth = Math.max(1, Math.round(width * scale));
      outputHeight = Math.max(1, Math.round(height * scale));
      rgba = downscaleRgba(rgba, width, height, outputWidth, outputHeight);
    }

    // Office renders transparent PNGs correctly, but flattening opaque images
    // keeps files smaller and avoids halos on masks.
    if (!isMask && !hasTransparency(rgba)) {
      rgba = flattenOntoWhite(rgba);
    }

    return {
      data: await encodePng(rgba, outputWidth, outputHeight),
      format: "png",
      pixelWidth: outputWidth,
      pixelHeight: outputHeight,
    };
  } catch {
    // A single unreadable image must never abort the whole conversion.
    return null;
  }
}

/** Expands a 1bpp stencil mask into black pixels with transparent gaps. */
function maskToRgba(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  const rowBytes = (width + 7) >> 3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // In PDF image masks a 0 bit paints, a 1 bit is masked out.
      const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      const target = (y * width + x) * 4;
      rgba[target + 3] = bit ? 0 : 255;
    }
  }
  return rgba;
}

/** `page.objs.get` resolves asynchronously for images decoded in the worker. */
function getPageObject(page: PDFPageProxy, id: string): Promise<unknown> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 15_000);
    try {
      page.objs.get(id, (value: unknown) => {
        clearTimeout(timeout);
        resolve(value);
      });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

/** Reads a resolved font descriptor, tolerating unresolved entries. */
function readFontDescriptor(page: PDFPageProxy, fontName: string): FontDescriptor | null {
  try {
    const commonObjs = page.commonObjs as unknown as {
      has: (id: string) => boolean;
      get: (id: string) => FontDescriptor;
    };
    if (!commonObjs.has(fontName)) return null;
    return commonObjs.get(fontName);
  } catch {
    return null;
  }
}

async function extractPage(
  page: PDFPageProxy,
  options: PdfExtractionOptions
): Promise<ExtractedPage> {
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;
  const rotation = ((viewport.rotation % 360) + 360) % 360;

  // Must run before font objects can be read, and supplies colours + images.
  const { colors, images } = await readOperatorList(page, page.view[3] - page.view[1], options);

  const textContent = await page.getTextContent();
  const styles = textContent.styles as Record<
    string,
    { fontFamily?: string; ascent?: number; descent?: number; vertical?: boolean }
  >;

  const items: ExtractedTextItem[] = [];
  let showTextIndex = 0;

  // pdf.js synthesises whitespace-only items for inter-chunk gaps; those have
  // no corresponding text-showing operator. Only items with visible glyphs map
  // one-to-one onto the operator list, so alignment is tested against those.
  const glyphItems = textContent.items.filter(
    (item) => "str" in item && item.str.trim().length > 0
  ).length;
  const colorsAligned = colors.length === glyphItems;
  const fallbackColor = dominantColor(colors);

  for (const raw of textContent.items) {
    if (!("str" in raw)) continue;
    const item = raw as {
      str: string;
      transform: number[];
      width: number;
      height: number;
      fontName: string;
      hasEOL: boolean;
    };
    // Preserve inter-word gaps in layout, but never emit whitespace-only runs.
    if (!item.str.trim()) continue;

    const color = colorsAligned ? colors[showTextIndex] || fallbackColor : fallbackColor;
    showTextIndex++;

    const [a, b, , d, e, f] = item.transform;
    // Font size is the vertical scale of the text matrix.
    const fontSize = Math.hypot(b, d) || Math.abs(d) || Math.abs(a) || 1;

    const descriptor = readFontDescriptor(page, item.fontName);
    const style = styles?.[item.fontName];
    const font = resolvePdfFont(descriptor?.name || item.fontName, {
      bold: descriptor?.bold,
      italic: descriptor?.italic,
      fallback: style?.fontFamily || descriptor?.fallbackName,
    });

    const ascent = (descriptor?.ascent ?? style?.ascent ?? 0.75) * fontSize;
    const descent = Math.abs(descriptor?.descent ?? style?.descent ?? -0.25) * fontSize;

    const position = rotatePoint(e, f, pageWidth, pageHeight, rotation);
    items.push({
      text: item.str,
      x: position.x,
      baseline: position.y,
      width: item.width,
      fontSize,
      font,
      color,
      ascent,
      descent,
      endsLine: item.hasEOL,
    });
  }

  return {
    width: pageWidth,
    height: pageHeight,
    items,
    images: rotation === 0 ? images : images.map((image) => rotateImage(image, pageWidth, pageHeight, rotation)),
  };
}

/**
 * Maps a PDF-space point (bottom-left origin) into top-left page coordinates,
 * honouring the page's `/Rotate` entry.
 */
function rotatePoint(
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number,
  rotation: number
): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: y, y: x };
    case 180:
      return { x: pageWidth - x, y: y };
    case 270:
      return { x: pageWidth - y, y: pageHeight - x };
    default:
      // Unrotated: flip the vertical axis only.
      return { x, y: pageHeight - y };
  }
}

function rotateImage(
  image: ExtractedImage,
  pageWidth: number,
  pageHeight: number,
  rotation: number
): ExtractedImage {
  if (rotation === 180) {
    return {
      ...image,
      x: pageWidth - image.x - image.width,
      y: pageHeight - image.y - image.height,
    };
  }
  // 90/270 swap axes; keep the frame inside the page.
  const width = rotation === 90 || rotation === 270 ? image.height : image.width;
  const height = rotation === 90 || rotation === 270 ? image.width : image.height;
  const x = rotation === 90 ? pageWidth - image.y - width : image.y;
  const y = rotation === 90 ? image.x : pageHeight - image.x - height;
  return {
    ...image,
    x: Math.max(0, Math.min(x, pageWidth - width)),
    y: Math.max(0, Math.min(y, pageHeight - height)),
    width,
    height,
  };
}

function dominantColor(colors: string[]): string {
  if (!colors.length) return "000000";
  const counts = new Map<string, number>();
  for (const color of colors) counts.set(color, (counts.get(color) || 0) + 1);
  let best = "000000";
  let bestCount = -1;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

/** Reads document-level metadata, tolerating missing or malformed entries. */
async function readMetadata(document: PDFDocumentProxy): Promise<DocumentMetadata> {
  try {
    const { info } = await document.getMetadata();
    // pdf.js types `info` as `Object`; the entries are producer-controlled.
    const entries = (info || {}) as Record<string, unknown>;
    const read = (key: string) => {
      const value = entries[key];
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    const keywords = read("Keywords");
    return {
      title: read("Title"),
      author: read("Author"),
      subject: read("Subject"),
      creator: read("Creator"),
      keywords: keywords ? keywords.split(/[,;]\s*/).filter(Boolean) : undefined,
    };
  } catch {
    return {};
  }
}

/** Extracts every page of a PDF into positioned content. */
export async function extractPdf(
  data: Uint8Array,
  options: PdfExtractionOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<ExtractedPdf> {
  const { document, destroy } = await openPdf(data);

  try {
    const pageCount = document.numPages;
    if (!pageCount) throw conversionErrors.noContent("PDF");

    const metadata = await readMetadata(document);
    const pages: ExtractedPage[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      throwIfAborted(options.signal);
      onProgress?.({
        stage: `Reading page ${pageNumber} of ${pageCount}`,
        progress: pageNumber - 1,
        total: pageCount,
      });

      const page = await document.getPage(pageNumber);
      try {
        pages.push(await extractPage(page, options));
      } finally {
        page.cleanup();
      }
    }

    onProgress?.({ stage: "Pages read", progress: pageCount, total: pageCount });
    return { pages, metadata };
  } finally {
    await destroy();
  }
}
