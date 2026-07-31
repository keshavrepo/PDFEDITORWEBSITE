/**
 * Browser raster store and canvas plumbing.
 *
 * Bitmaps are kept out of the document model and held here instead, keyed by
 * `sourceId`. History snapshots therefore stay small (a few kilobytes of JSON)
 * no matter how many megapixels the user has imported, and undo never has to
 * copy pixel data.
 *
 * This is the only module in the editor core that assumes a browser.
 */

import { MAX_IMAGE_BYTES, SUPPORTED_IMPORT_TYPES } from "./constants";
import type { CanvasFactory } from "./renderer";
import type { RasterLookup, RasterSource } from "./types";

/* -------------------------------------------------------------------------- */
/* Canvas factory                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Offscreen buffers for the renderer.
 *
 * `OffscreenCanvas` is preferred where available because it avoids touching
 * the DOM; the `<canvas>` fallback keeps Safari and older browsers working.
 */
export const browserCanvasFactory: CanvasFactory = {
  create(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));

    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Could not create a drawing surface.");
      return {
        canvas: canvas as unknown as CanvasImageSource,
        ctx: ctx as unknown as CanvasRenderingContext2D,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create a drawing surface.");
    return { canvas, ctx };
  },
};

/* -------------------------------------------------------------------------- */
/* Raster store                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Reference-free bitmap store.
 *
 * Sources are retained until explicitly released rather than reference
 * counted, because undo can bring a deleted layer back and its pixels have to
 * still be there when it does.
 */
export class RasterStore implements RasterLookup {
  private readonly sources = new Map<string, RasterSource>();

  get(id: string): RasterSource | undefined {
    return this.sources.get(id);
  }

  set(source: RasterSource): void {
    this.sources.set(source.id, source);
  }

  has(id: string): boolean {
    return this.sources.has(id);
  }

  /** Frees GPU-backed bitmaps that are no longer referenced by any layer. */
  prune(activeIds: Set<string>): void {
    for (const [id, source] of this.sources) {
      if (activeIds.has(id)) continue;
      if (typeof ImageBitmap !== "undefined" && source.image instanceof ImageBitmap) {
        source.image.close();
      }
      this.sources.delete(id);
    }
  }

  clear(): void {
    this.prune(new Set());
  }

  get size(): number {
    return this.sources.size;
  }
}

/* -------------------------------------------------------------------------- */
/* Image decoding                                                             */
/* -------------------------------------------------------------------------- */

export interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** Human-readable validation failure, or null when the file is acceptable. */
export function validateImageFile(file: File): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is larger than ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`;
  }
  // Some browsers report an empty type for files dragged from other apps, so
  // the extension is accepted as a fallback rather than rejecting outright.
  if (file.type && !SUPPORTED_IMPORT_TYPES.includes(file.type)) {
    return `${file.name} is not a supported image format.`;
  }
  if (!file.type && !/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(file.name)) {
    return `${file.name} is not a supported image format.`;
  }
  return null;
}

/**
 * Decodes a blob into something drawable.
 *
 * `createImageBitmap` is used where possible because it decodes off the main
 * thread. SVG is deliberately routed through `<img>`: several browsers refuse
 * to rasterise SVG through `createImageBitmap`, and an `<img>` also resolves
 * the intrinsic size the way a browser would when rendering the file.
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  const isSvg = blob.type === "image/svg+xml";

  if (!isSvg && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Fall through to the <img> path, which handles formats the bitmap
      // decoder rejects.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImageElement(url);
    // An SVG with only a viewBox reports zero intrinsic size; give it a
    // sensible default rather than creating a zero-area layer.
    const width = image.naturalWidth || image.width || 512;
    const height = image.naturalHeight || image.height || 512;

    if (isSvg) {
      // Bake the vector to pixels at its natural size so later edits, blend
      // modes and adjustments behave like any other layer.
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(image, 0, 0, width, height);
        return { image: canvas, width, height };
      }
    }

    return { image, width, height };
  } finally {
    // Revoking immediately is safe: decoding has completed and, for the SVG
    // path, the pixels have already been copied into a canvas.
    URL.revokeObjectURL(url);
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be decoded."));
    image.src = url;
  });
}

/* -------------------------------------------------------------------------- */
/* Encoding                                                                   */
/* -------------------------------------------------------------------------- */

/** Encodes a canvas, working with both `OffscreenCanvas` and `<canvas>`. */
export async function canvasToBlob(
  canvas: CanvasImageSource,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  const element = canvas as HTMLCanvasElement;
  const blob = await new Promise<Blob | null>((resolve) => {
    element.toBlob(resolve, mimeType, quality);
  });
  if (!blob) throw new Error("The image could not be encoded.");
  return blob;
}

/** Data URI for a canvas, used when embedding bitmaps into SVG output. */
export async function canvasToDataUrl(
  canvas: CanvasImageSource,
  mimeType: string,
  quality?: number
): Promise<string> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: mimeType, quality });
    return blobToDataUrl(blob);
  }
  return (canvas as HTMLCanvasElement).toDataURL(mimeType, quality);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

/* -------------------------------------------------------------------------- */
/* Downloads                                                                  */
/* -------------------------------------------------------------------------- */

/** Triggers a browser download without leaking the object URL. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* -------------------------------------------------------------------------- */
/* Clipboard                                                                  */
/* -------------------------------------------------------------------------- */

/** Extracts image files from a paste or drop event. */
export function imagesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];

  if (data.files?.length) {
    for (const file of Array.from(data.files)) {
      if (file.type.startsWith("image/")) files.push(file);
    }
  }

  if (!files.length && data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  return files;
}

/**
 * Reads an image from the system clipboard.
 *
 * Returns null rather than throwing when permission is denied or the clipboard
 * holds no image, so the caller can fall back to the paste event.
 */
export async function readClipboardImage(): Promise<Blob | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((candidate) => candidate.startsWith("image/"));
      if (type) return await item.getType(type);
    }
  } catch {
    // Permission denied or an unsupported browser; the paste handler covers it.
  }
  return null;
}

/** Writes a PNG to the system clipboard. Returns false when unsupported. */
export async function writeClipboardImage(blob: Blob): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) return false;
  if (typeof ClipboardItem === "undefined") return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}
