/**
 * Shared document models used by every PDFPilot document converter.
 *
 * Two complementary models are used because PDF/PPTX and DOCX describe pages
 * in fundamentally different ways:
 *
 * - `PositionedDocument` mirrors fixed-layout formats (PDF pages, PPTX slides).
 *   Every block carries absolute coordinates.
 * - `FlowDocument` mirrors reflowable formats (DOCX). Content is an ordered
 *   stream of blocks that a layout engine paginates.
 *
 * Both models use **points** (1/72 inch) with a **top-left origin**, matching
 * OOXML conventions. PDF's bottom-left origin is normalised at the boundary.
 */

export interface ConversionProgress {
  stage: string;
  progress: number;
  total: number;
}

export type ConversionProgressCallback = (progress: ConversionProgress) => void;

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  keywords?: string[];
}

/** Raster image bytes plus the intrinsic pixel dimensions. */
export interface RasterImage {
  data: Uint8Array;
  format: "png" | "jpeg";
  pixelWidth: number;
  pixelHeight: number;
}

export type HorizontalAlignment = "left" | "center" | "right" | "justify";

/** A styled span of text. Colour is an uppercase RRGGBB string without `#`. */
export interface TextRunModel {
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
  underline?: boolean;
  strike?: boolean;
  superscript?: boolean;
  subscript?: boolean;
}

/** A single visual line of text with a resolved baseline. */
export interface TextLineModel {
  runs: TextRunModel[];
  /** Left edge of the line, in points from the page's left edge. */
  x: number;
  /** Baseline position, in points from the page's top edge. */
  baseline: number;
  /** Distance from the baseline to the top of the line box. */
  ascent: number;
  /** Total line height in points. */
  height: number;
  width: number;
}

/* -------------------------------------------------------------------------- */
/* Positioned (fixed-layout) model                                            */
/* -------------------------------------------------------------------------- */

export interface PositionedTextBlock {
  kind: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  align: HorizontalAlignment;
  lines: TextLineModel[];
}

export interface PositionedImageBlock {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  image: RasterImage;
}

export interface PositionedTableBlock {
  kind: "table";
  x: number;
  y: number;
  width: number;
  height: number;
  columnWidths: number[];
  rowHeights: number[];
  rows: PositionedTableCell[][];
}

export interface PositionedTableCell {
  lines: TextLineModel[];
  align: HorizontalAlignment;
  colSpan?: number;
  rowSpan?: number;
  /** Uppercase RRGGBB fill, when the source declared one. */
  fill?: string;
}

export type PositionedBlock =
  | PositionedTextBlock
  | PositionedImageBlock
  | PositionedTableBlock;

export interface PositionedPage {
  width: number;
  height: number;
  blocks: PositionedBlock[];
  /** Uppercase RRGGBB background fill, when the source declared one. */
  background?: string;
}

export interface PositionedDocument {
  pages: PositionedPage[];
  metadata: DocumentMetadata;
}

/* -------------------------------------------------------------------------- */
/* Flow (reflowable) model                                                    */
/* -------------------------------------------------------------------------- */

export interface FlowParagraph {
  kind: "paragraph";
  runs: TextRunModel[];
  align: HorizontalAlignment;
  /** Outline level 1-6 when the paragraph is a heading, otherwise undefined. */
  headingLevel?: number;
  /** Left indent in points. */
  indentLeft: number;
  /** First-line indent in points, relative to `indentLeft`. */
  indentFirstLine: number;
  spaceBefore: number;
  spaceAfter: number;
  /** Multiplier applied to the natural line height. */
  lineHeight: number;
  list?: FlowListInfo;
}

export interface FlowListInfo {
  ordered: boolean;
  level: number;
  /** Pre-resolved marker such as "1." or "•". */
  marker: string;
}

export interface FlowImage {
  kind: "image";
  image: RasterImage;
  /** Display size in points. */
  width: number;
  height: number;
  align: HorizontalAlignment;
}

export interface FlowTableCell {
  blocks: FlowBlock[];
  colSpan: number;
  rowSpan: number;
  fill?: string;
  verticalMerge?: "restart" | "continue";
}

export interface FlowTable {
  kind: "table";
  rows: FlowTableCell[][];
  /**
   * Grid column widths. Absolute points when `proportionalColumns` is false,
   * otherwise relative weights to be distributed across the available width.
   */
  columnWidths: number[];
  hasBorders: boolean;
  /** True when the source sized the table by percentage or automatically. */
  proportionalColumns: boolean;
  /** Table width as a percentage of the text column, when declared. */
  widthPercent?: number;
}

export interface FlowPageBreak {
  kind: "page-break";
}

export type FlowBlock = FlowParagraph | FlowImage | FlowTable | FlowPageBreak;

export interface FlowSection {
  pageWidth: number;
  pageHeight: number;
  margins: { top: number; right: number; bottom: number; left: number };
  blocks: FlowBlock[];
}

export interface FlowDocument {
  sections: FlowSection[];
  metadata: DocumentMetadata;
}
