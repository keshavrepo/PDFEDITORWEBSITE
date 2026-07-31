/** Shared limits, MIME types and unit conversions for document conversion. */

/** Upload ceiling for every conversion input, matching the PDF tools. */
export const MAX_CONVERSION_SIZE = 100 * 1024 * 1024;

export const PDF_MIME_TYPES = ["application/pdf", "application/x-pdf"] as const;

export const DOCX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const PPTX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const DOCX_ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PPTX_ACCEPT = ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const PDF_ACCEPT = "application/pdf,.pdf";

/* Unit conversions. Points (1/72 inch) are the internal unit everywhere. */
export const EMU_PER_INCH = 914_400;
export const EMU_PER_POINT = EMU_PER_INCH / 72;
export const TWIPS_PER_POINT = 20;
export const POINTS_PER_INCH = 72;
/** OOXML measures raster images in pixels at 96 DPI. */
export const PIXELS_PER_POINT = 96 / 72;

export const emuToPoints = (emu: number): number => emu / EMU_PER_POINT;
export const pointsToEmu = (points: number): number => Math.round(points * EMU_PER_POINT);
export const twipsToPoints = (twips: number): number => twips / TWIPS_PER_POINT;
export const pointsToTwips = (points: number): number => Math.round(points * TWIPS_PER_POINT);
export const pointsToInches = (points: number): number => points / POINTS_PER_INCH;
export const pointsToPixels = (points: number): number => points * PIXELS_PER_POINT;
export const halfPointsToPoints = (halfPoints: number): number => halfPoints / 2;
export const pointsToHalfPoints = (points: number): number => Math.round(points * 2);

/** A4 portrait, used whenever a source document omits page geometry. */
export const DEFAULT_PAGE_WIDTH = 595.276;
export const DEFAULT_PAGE_HEIGHT = 841.89;
export const DEFAULT_PAGE_MARGIN = 72;

/** Widescreen 16:9 slide, the PowerPoint default since 2013. */
export const DEFAULT_SLIDE_WIDTH = 960;
export const DEFAULT_SLIDE_HEIGHT = 540;

export const DEFAULT_FONT_SIZE = 11;
export const DEFAULT_FONT_FAMILY = "Calibri";
