/**
 * OfficePilot public surface.
 *
 * Components import from this file rather than the underlying modules, so
 * the engine can move pieces between files without breaking every caller.
 */

export * from "./types";
export * from "./editors";
export * from "./templates";
export * from "./engine";
export {
  STORAGE_DATABASE,
  STORAGE_STORE,
  STORAGE_VERSION,
  MAX_DOCUMENT_BYTES,
  MAX_LOCAL_AGE_DAYS,
  MAX_LOCAL_DOCUMENTS,
} from "./storage";
export type { ListDocumentsOptions, ListDocumentsResult, SaveResult } from "./storage";

/** Word editor public surface. */
export {
  asWordBody,
  DEFAULT_WORD_BODY,
  DEFAULT_SETTINGS,
  DEFAULT_PAGE,
  isWordBody,
} from "./word/schema";
export type {
  WordAlignment,
  WordBlock,
  WordBody,
  WordCodeBlock,
  WordDocumentSettings,
  WordHeading,
  WordImage,
  WordLineSpacing,
  WordList,
  WordListKind,
  WordMark,
  WordPageBreak,
  WordPageSettings,
  WordParagraph,
  WordQuote,
  WordRun,
  WordStats,
  WordTable,
} from "./word/schema";
export { computeWordStats, runsToText } from "./word/stats";
export { exportWordToDocx } from "./word/exporters";
export {
  exportWordToHtml,
  exportWordToText,
  printWordDocument,
} from "./word/text-exporters";
export {
  importWordFromDocx,
  importWordFromHtml,
  importWordFromText,
  readWordXml,
} from "./word/importers";

/** Spreadsheet editor public surface. */
export {
  asSheetBody,
  DEFAULT_SHEET_BODY,
  DEFAULT_SHEET_VIEW,
  DEFAULT_WORKBOOK_SETTINGS,
  cellKey,
  columnLetter,
  columnIndex,
  fromA1,
  getCell,
  isSheetBody,
  parseCellKey,
  toA1,
} from "./spreadsheet/schema";
export type {
  CellAddress,
  CellAlignment,
  CellBorder,
  CellBorderSide,
  CellBorderStyle,
  CellBorders,
  CellNumberFormat,
  CellStyle,
  CellValidation,
  CellValueType,
  ConditionalFormatRule,
  Sheet,
  SheetBody,
  SheetCell,
  SheetColumnInfo,
  SheetRowInfo,
  SheetStats,
  SheetView,
  SheetWorkbookSettings,
} from "./spreadsheet/schema";
export {
  addSheet,
  clearCell,
  clearRange,
  deleteColumns,
  deleteRows,
  getActiveSheet,
  hideColumns,
  hideRows,
  insertColumns,
  insertRows,
  mergeAt,
  normaliseRange,
  readRange,
  removeSheet,
  renameSheet,
  replaceSheet,
  setActiveSheet,
  setCellBorders,
  setCellStyle,
  setCellValidation,
  setCellValue,
  setColumnHidden,
  setColumnWidth,
  setConditionalFormat,
  removeConditionalFormat,
  setRowHeight,
  setRowHidden,
  setSheetView,
  showColumns,
  showRows,
  sortRange,
  writeRange,
  cellText,
} from "./spreadsheet/cells";
export { evaluate, evaluateBody, evaluateSheet, formatDisplay, FormulaError } from "./spreadsheet/formulas";
export { computeSheetStats } from "./spreadsheet/stats";
export { exportSheetToCsv, exportSheetToHtml, exportSheetToText, exportSheetToTsv, printSheetDocument } from "./spreadsheet/text-exporters";
export { exportSheetToXlsx } from "./spreadsheet/xlsx-export";
export { importSheetFromText } from "./spreadsheet/csv-import";
export { importSheetFromXlsx } from "./spreadsheet/xlsx-import";
export {
  buildBlankSheetBody,
  buildBudgetSheetBody,
  buildChecklistSheetBody,
  buildInvoiceSheetBody,
  buildMonthlyPlannerSheetBody,
  buildPlannerSheetBody,
} from "./spreadsheet/starter";
export {
  asPresentationBody,
  DEFAULT_PRESENTATION_BODY,
  DEFAULT_DECK_SETTINGS,
  PRESENTATION_THEMES,
  createDefaultSlide,
  isPresentationBody,
  type PresentationBackground,
  type PresentationBlock,
  type PresentationBody,
  type PresentationDeckSettings,
  type PresentationImage,
  type PresentationRun,
  type PresentationShape,
  type PresentationShapeKind,
  type PresentationSlide,
  type PresentationStats,
  type PresentationTable,
  type PresentationTheme,
  type PresentationTransition,
} from "./presentation/schema";
export {
  addBlock,
  addSlide,
  countWords,
  duplicateSlide,
  makeBlockId,
  makeSlideId,
  removeBlock,
  removeSlide,
  reorderSlide,
  replaceBlock,
  setDeckAspect,
  setDeckBackground,
  setDeckFontFamily,
  setDeckSettings,
  setSlideBackground,
  setSlideNotes,
  setSlideTitle,
  setSlideTransition,
  setTheme,
  updateSlide,
} from "./presentation/blocks";
export { computePresentationStats } from "./presentation/stats";
export {
  exportPresentationToHtml,
  exportPresentationToText,
  printPresentationDocument,
} from "./presentation/text-exporters";
export { exportPresentationToPptx } from "./presentation/pptx-export";
export { importPresentationFromPptx } from "./presentation/pptx-import";
export {
  buildBlankDeck,
  buildPitchDeck,
  buildReportDeck,
} from "./presentation/starter";
export {
  buildBusinessLetterBody,
  buildCoverLetterBody,
} from "./word/starter";
