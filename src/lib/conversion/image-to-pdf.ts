/**
 * JPG / PNG -> PDF conversion.
 *
 * Images are embedded at full resolution (no re-encoding, so no quality is
 * lost) and positioned according to the chosen page size, orientation, margin
 * and fit mode.
 */

import { PDFDocument, rgb } from "pdf-lib";
import { conversionErrors } from "./errors";
import { detectImageFormat, readImageSize } from "./image-codec";
import type { ConversionProgressCallback } from "./types";

export type PageOrientation = "portrait" | "landscape" | "auto";
export type PageSizeId = "a4" | "letter" | "fit";
export type ImageFitMode = "fit" | "fill";
export type MarginSize = "none" | "small" | "medium" | "large";

export interface ImageToPdfOptions {
  pageSize?: PageSizeId;
  orientation?: PageOrientation;
  fit?: ImageFitMode;
  margin?: MarginSize;
  signal?: AbortSignal;
}

export interface ImageInput {
  name: string;
  data: Uint8Array;
}

/** Page dimensions in points, portrait. */
const PAGE_SIZES: Record<Exclude<PageSizeId, "fit">, { width: number; height: number }> = {
  a4: { width: 595.276, height: 841.89 },
  letter: { width: 612, height: 792 },
};

const MARGINS: Record<MarginSize, number> = {
  none: 0,
  small: 18,
  medium: 36,
  large: 72,
};

/** Images are stored at 96 DPI by convention, so convert pixels to points. */
const PIXELS_TO_POINTS = 72 / 96;

/** Converts images into a single PDF, one page per image, in the given order. */
export async function convertImagesToPdf(
  images: ImageInput[],
  options: ImageToPdfOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  if (!images.length) throw conversionErrors.noContent("image");

  const pageSize = options.pageSize || "a4";
  const orientation = options.orientation || "auto";
  const fitMode = options.fit || "fit";
  const margin = MARGINS[options.margin || "small"];

  const document = await PDFDocument.create();
  let embedded = 0;

  for (let index = 0; index < images.length; index++) {
    if (options.signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");

    const image = images[index];
    onProgress?.({
      stage: `Adding image ${index + 1} of ${images.length}`,
      progress: index,
      total: images.length,
    });

    const format = detectImageFormat(image.data);
    if (format !== "png" && format !== "jpeg") {
      // Skip unsupported formats rather than failing the whole batch.
      continue;
    }

    let source;
    try {
      source =
        format === "png"
          ? await document.embedPng(image.data)
          : await document.embedJpg(image.data);
    } catch {
      // A single damaged image must not abort the document.
      continue;
    }

    const intrinsic = readImageSize(image.data, format);
    const imageWidth = source.width || intrinsic?.width || 1;
    const imageHeight = source.height || intrinsic?.height || 1;

    // Page geometry.
    let pageWidth: number;
    let pageHeight: number;

    if (pageSize === "fit") {
      // Page matches the image exactly, plus any margin.
      pageWidth = imageWidth * PIXELS_TO_POINTS + margin * 2;
      pageHeight = imageHeight * PIXELS_TO_POINTS + margin * 2;
    } else {
      const base = PAGE_SIZES[pageSize];
      const landscape =
        orientation === "landscape" ||
        // `auto` follows each image's own aspect ratio.
        (orientation === "auto" && imageWidth > imageHeight);
      pageWidth = landscape ? base.height : base.width;
      pageHeight = landscape ? base.width : base.height;
    }

    const page = document.addPage([pageWidth, pageHeight]);

    const availableWidth = Math.max(1, pageWidth - margin * 2);
    const availableHeight = Math.max(1, pageHeight - margin * 2);

    // `fit` shows the whole image; `fill` covers the area and crops the excess.
    const scale =
      fitMode === "fill"
        ? Math.max(availableWidth / imageWidth, availableHeight / imageHeight)
        : Math.min(availableWidth / imageWidth, availableHeight / imageHeight);

    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const x = margin + (availableWidth - drawWidth) / 2;
    const y = margin + (availableHeight - drawHeight) / 2;

    if (fitMode === "fill") {
      // Clip overflow to the content box so neighbouring margins stay clean.
      page.drawRectangle({
        x: margin,
        y: margin,
        width: availableWidth,
        height: availableHeight,
        color: rgb(1, 1, 1),
      });
    }

    page.drawImage(source, { x, y, width: drawWidth, height: drawHeight });
    embedded++;
  }

  if (!embedded) {
    throw conversionErrors.invalidFile(
      images.length === 1 ? images[0].name : "The selected files",
      "JPG or PNG image"
    );
  }

  document.setProducer("PDFPilot");
  document.setCreator("PDFPilot");
  document.setTitle(images.length === 1 ? images[0].name.replace(/\.[^.]+$/, "") : "Converted images");

  onProgress?.({ stage: "Writing PDF", progress: images.length, total: images.length });
  return document.save();
}
