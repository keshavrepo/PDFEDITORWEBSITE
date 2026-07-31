/**
 * Public entry point for PDFPilot's document conversion core.
 *
 * Everything exported here is isomorphic: it runs in the browser for real
 * conversions and in Node for the conversion test suite.
 */

export { convertPdfToWord, type PdfToWordOptions } from "./pdf-to-word";
export { convertWordToPdf, type WordToPdfOptions } from "./word-to-pdf";
export {
  convertPdfToPowerPoint,
  type PdfToPowerPointOptions,
} from "./pdf-to-powerpoint";
export {
  convertPowerPointToPdf,
  type PowerPointToPdfOptions,
} from "./powerpoint-to-pdf";

export {
  MAX_CONVERSION_SIZE,
  DOCX_ACCEPT,
  PDF_ACCEPT,
  PPTX_ACCEPT,
} from "./constants";

export {
  ConversionError,
  conversionErrors,
  toConversionMessage,
  type ConversionErrorCode,
} from "./errors";

export {
  assertFormat,
  formatLabel,
  validateConversionInput,
  validateSelection,
  type ConversionFormat,
  type ValidationResult,
} from "./validation";

export {
  detectImageFormat,
  encodePng,
  readImageSize,
} from "./image-codec";

export type {
  ConversionProgress,
  ConversionProgressCallback,
  DocumentMetadata,
  FlowBlock,
  FlowDocument,
  FlowSection,
  PositionedDocument,
  PositionedPage,
  RasterImage,
} from "./types";
