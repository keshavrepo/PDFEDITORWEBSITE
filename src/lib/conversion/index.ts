/**
 * Public entry point for PDFPilot's document conversion core.
 *
 * Everything exported here is isomorphic: it runs in the browser for real
 * conversions and in Node for the conversion test suite.
 */

export { convertPdfToWord, type PdfToWordOptions } from "./pdf-to-word";
export { convertExcelToPdf, type ExcelToPdfOptions } from "./excel-to-pdf";
export { convertPdfToExcel, type PdfToExcelOptions } from "./pdf-to-excel";
export { writeXlsx, columnName } from "./spreadsheet/xlsx-writer";
export { readXlsx } from "./spreadsheet/xlsx-reader";
export { readXls } from "./spreadsheet/xls-reader";
export {
  renderPdfPages,
  zipRenderedPages,
  type PageImageFormat,
  type PdfToImageOptions,
  type RenderedPage,
} from "./pdf-to-image";
export {
  convertImagesToPdf,
  type ImageFitMode,
  type ImageInput,
  type ImageToPdfOptions,
  type MarginSize,
  type PageOrientation,
  type PageSizeId,
} from "./image-to-pdf";
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
  EXCEL_ACCEPT,
  IMAGE_ACCEPT,
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

export {
  OCR_REQUIRED_MESSAGE,
  analyzePdfForConversion,
  type AnalyzePdfOptions,
  type ConversionBadge,
  type PdfAnalysis,
} from "./analyze-pdf";

export {
  analyzeTextQuality,
  buildFontSignals,
  isLegacyEncodedFont,
  normalizeFontName,
  scoreGlyphGarbage,
  scoreInvalidUnicode,
  type ConversionStrategy,
  type FontQualitySignal,
  type QualityIssue,
  type TextQualityReport,
} from "./text-quality";

export {
  getEngine,
  listEngines,
  registerEngine,
  selectEngine,
  type EngineSelection,
} from "./engines/registry";

export { nativePdfEngine } from "./engines/native-engine";

export type {
  ConversionEngine,
  EngineCapabilities,
  EngineConversionRequest,
  EngineConversionResult,
  EngineId,
  ExecutionEnvironment,
  OutputFormat,
} from "./engines/types";

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
