/**
 * Page numbering, headers and footers.
 *
 * Numbers are drawn as real text into each page's content stream, so they stay
 * selectable and searchable in the output.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";
import { conversionErrors } from "./errors";
import { sanitizeForPdf } from "./pdf/font-registry";
import type { ConversionProgressCallback } from "./types";

export type NumberPosition = "top" | "bottom";
export type NumberAlignment = "left" | "center" | "right";
export type NumberFontFamily = "helvetica" | "times" | "courier";

export interface PageNumberOptions {
  position?: NumberPosition;
  alignment?: NumberAlignment;
  fontFamily?: NumberFontFamily;
  fontSize?: number;
  /** Uppercase RRGGBB without `#`. */
  color?: string;
  /**
   * Template for the label. `{n}` is the printed number and `{total}` the
   * count of numbered pages. Defaults to just the number.
   */
  format?: string;
  /** First number to print. */
  startNumber?: number;
  /** Zero-based index of the first page that receives a number. */
  startPage?: number;
  /** Convenience flag equivalent to starting on the second page. */
  skipFirstPage?: boolean;
  /** Distance from the page edge in points. */
  margin?: number;
  signal?: AbortSignal;
}

const FONTS: Record<NumberFontFamily, StandardFonts> = {
  helvetica: StandardFonts.Helvetica,
  times: StandardFonts.TimesRoman,
  courier: StandardFonts.Courier,
};

const DEFAULT_MARGIN = 32;
const DEFAULT_FONT_SIZE = 11;

function hexToRgb(hex: string | undefined): RGB {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return rgb(0, 0, 0);
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255
  );
}

/** Renders the label for one page. */
export function formatPageLabel(template: string, current: number, total: number): string {
  return (template || "{n}")
    .replace(/\{n\}/g, String(current))
    .replace(/\{total\}/g, String(total))
    .replace(/\{page\}/g, String(current));
}

function measure(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.5;
  }
}

/** Stamps page numbers onto a PDF. */
export async function addPageNumbers(
  data: Uint8Array,
  options: PageNumberOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  onProgress?.({ stage: "Reading PDF", progress: 5, total: 100 });

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(data, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted") || message.includes("password")) {
      throw conversionErrors.encrypted();
    }
    throw conversionErrors.corrupted("PDF", error);
  }

  const pages = pdf.getPages();
  if (!pages.length) throw conversionErrors.noContent("PDF");

  const position = options.position || "bottom";
  const alignment = options.alignment || "center";
  const fontSize = Math.max(6, Math.min(options.fontSize || DEFAULT_FONT_SIZE, 48));
  const margin = Math.max(8, Math.min(options.margin ?? DEFAULT_MARGIN, 200));
  const color = hexToRgb(options.color);
  const template = options.format || "{n}";
  const startNumber = Math.max(1, Math.floor(options.startNumber ?? 1));

  // `skipFirstPage` is a shortcut for starting on page two; an explicit
  // `startPage` always wins so the two options cannot disagree. An out-of-range
  // value is rejected rather than clamped, because silently numbering a
  // different page than the user asked for is worse than an error.
  if (options.startPage !== undefined) {
    const requested = Math.floor(options.startPage);
    if (requested < 0 || requested >= pages.length) {
      throw conversionErrors.invalidRequest(
        `No pages are left to number with these settings. This PDF has ${pages.length} ${pages.length === 1 ? "page" : "pages"}.`
      );
    }
  }
  const startPage =
    options.startPage !== undefined
      ? Math.floor(options.startPage)
      : options.skipFirstPage
        ? 1
        : 0;

  const font = await pdf.embedFont(FONTS[options.fontFamily || "helvetica"]);
  const numberedCount = pages.length - startPage;
  if (numberedCount <= 0) {
    throw conversionErrors.invalidRequest("No pages are left to number with these settings");
  }

  for (let index = startPage; index < pages.length; index++) {
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    if ((index - startPage) % 10 === 0) {
      onProgress?.({
        stage: `Numbering page ${index + 1} of ${pages.length}`,
        progress: 10 + Math.round(((index - startPage) / numberedCount) * 80),
        total: 100,
      });
    }

    const page = pages[index];
    const { width, height } = page.getSize();
    const label = sanitizeForPdf(
      formatPageLabel(template, startNumber + index - startPage, numberedCount)
    );
    if (!label) continue;

    const textWidth = measure(font, label, fontSize);

    let x = margin;
    if (alignment === "center") x = Math.max(margin, (width - textWidth) / 2);
    else if (alignment === "right") x = Math.max(margin, width - textWidth - margin);

    // Baseline sits a descender clear of the page edge.
    const y = position === "top" ? height - margin - fontSize * 0.8 : margin;

    try {
      page.drawText(label, { x, y, size: fontSize, font, color });
    } catch {
      // A single unrenderable label must not fail the document.
    }
  }

  onProgress?.({ stage: "Saving PDF", progress: 95, total: 100 });
  const bytes = await pdf.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return bytes;
}
