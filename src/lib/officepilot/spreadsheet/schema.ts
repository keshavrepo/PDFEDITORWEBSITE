/**
 * OfficePilot Spreadsheet document schema.
 *
 * A workbook contains one or more sheets. Each sheet is a fixed-size grid
 * of cells addressed by `A1`-style coordinates. Cells can hold raw values,
 * formulas, and per-cell styling. A sheet can freeze rows and columns
 * and hide individual rows or columns. The schema is intentionally close
 * to the OOXML spreadsheet model so the XLSX exporter can map sheets
 * one-to-one onto OOXML structures.
 *
 * Everything is JSON-serialisable. Formulae are stored as text; the
 * formula engine resolves them on demand and caches the result on the
 * cell. The cache is invalidated whenever a dependent cell changes.
 */

/** A1-style column letter helper, e.g. 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function columnLetter(column: number): string {
  if (column < 0) return "";
  let letter = "";
  let n = column;
  while (true) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return letter;
}

/** Converts a column letter to a zero-based index. "A" -> 0, "AA" -> 26. */
export function columnIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 65 + 1);
  }
  return n - 1;
}

/** A1-style cell address. */
export interface CellAddress {
  row: number;
  column: number;
}

/** Encodes a cell address as A1. */
export function toA1(address: CellAddress): string {
  return `${columnLetter(address.column)}${address.row + 1}`;
}

/** Decodes a single A1 reference (no ranges, no quoted sheet names). */
export function fromA1(reference: string): CellAddress | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(reference);
  if (!match) return null;
  const column = columnIndex(match[1]!.toUpperCase());
  const row = Number(match[2]!) - 1;
  if (column < 0 || row < 0) return null;
  return { row, column };
}

/** Text alignment. */
export type CellAlignment = "left" | "center" | "right";

/** Border style. */
export type CellBorderStyle = "thin" | "medium" | "thick" | "dashed" | "dotted" | "double";

/** Border sides. */
export type CellBorderSide = "top" | "right" | "bottom" | "left";

/** Per-side border. */
export interface CellBorder {
  style: CellBorderStyle;
  color?: string;
}

/** A border specification for a cell. */
export interface CellBorders {
  top?: CellBorder;
  right?: CellBorder;
  bottom?: CellBorder;
  left?: CellBorder;
}

/** Number format. */
export type CellNumberFormat =
  | "general"
  | "number"
  | "number-2dp"
  | "number-4dp"
  | "currency"
  | "currency-eur"
  | "currency-gbp"
  | "percentage"
  | "percentage-2dp"
  | "scientific"
  | "date"
  | "time"
  | "datetime"
  | "integer"
  | "thousands";

/** Cell value type. */
export type CellValueType = "empty" | "text" | "number" | "boolean" | "date" | "error";

/** Per-cell styling. */
export interface CellStyle {
  /** Font family. */
  fontFamily?: string;
  /** Font size in points. */
  fontSize?: number;
  /** Font color, hex. */
  fontColor?: string;
  /** Background colour, hex. */
  backgroundColor?: string;
  /** Bold. */
  bold?: boolean;
  /** Italic. */
  italic?: boolean;
  /** Underline. */
  underline?: boolean;
  /** Strikethrough. */
  strikethrough?: boolean;
  /** Alignment. */
  alignment?: CellAlignment;
  /** Number format. */
  numberFormat?: CellNumberFormat;
  /** Wraps text. */
  wrapText?: boolean;
  /** Borders. */
  borders?: CellBorders;
}

/** A single cell. */
export interface SheetCell {
  /** Optional raw value the user typed. */
  raw?: string;
  /** Optional formula the user typed. */
  formula?: string;
  /** Resolved value (cached). */
  value?: string | number | boolean | null;
  /** Resolved value type. */
  valueType?: CellValueType;
  /** Resolved display text. */
  display?: string;
  /** Per-cell styling. */
  style?: CellStyle;
  /** Validation rule. */
  validation?: CellValidation;
  /** Optional comment. */
  comment?: string;
}

/** Cell validation. */
export interface CellValidation {
  kind: "list" | "number" | "text" | "date";
  /** List of allowed values (for `list`). */
  options?: string[];
  /** Operator for `number`/`text`/`date`. */
  operator?: "between" | "not-between" | "equal" | "not-equal" | "greater" | "less";
  /** First operand. */
  value1?: string;
  /** Second operand (for between / not-between). */
  value2?: string;
  /** Whether to reject input. */
  reject?: boolean;
  /** Message shown on rejection. */
  message?: string;
}

/** Column sizing. */
export interface SheetColumnInfo {
  /** Column index. */
  index: number;
  /** Width in characters (matches Excel's default). */
  width?: number;
  /** Hidden. */
  hidden?: boolean;
}

/** Row sizing. */
export interface SheetRowInfo {
  /** Row index. */
  index: number;
  /** Height in points. */
  height?: number;
  /** Hidden. */
  hidden?: boolean;
}

/** A sheet view configuration. */
export interface SheetView {
  /** Number of frozen rows. */
  frozenRows: number;
  /** Number of frozen columns. */
  frozenColumns: number;
  /** Whether gridlines are visible. */
  showGridlines: boolean;
  /** Whether headers are visible. */
  showHeaders: boolean;
}

/** Conditional formatting rule. */
export interface ConditionalFormatRule {
  /** Rule id. */
  id: string;
  /** A1 range. */
  range: string;
  /** Type. */
  type: "cell-value" | "duplicate" | "unique" | "top" | "bottom";
  /** Operator (for cell-value). */
  operator?: "equal" | "not-equal" | "greater" | "less" | "between";
  /** Value (for cell-value). */
  value?: string;
  /** Second value (for between). */
  value2?: string;
  /** Style applied when matched. */
  style: CellStyle;
  /** Priority, lower runs first. */
  priority: number;
}

/** A workbook sheet. */
export interface Sheet {
  id: string;
  name: string;
  /** Default row count. */
  rowCount: number;
  /** Default column count. */
  columnCount: number;
  /** Cells, indexed by `row:column`. Sparse. */
  cells: Record<string, SheetCell>;
  /** Row info overrides. */
  rows: Record<number, SheetRowInfo>;
  /** Column info overrides. */
  columns: Record<number, SheetColumnInfo>;
  /** Merged cells. */
  merges: Array<{
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  }>;
  /** Sheet view. */
  view: SheetView;
  /** Conditional formatting rules. */
  conditionalFormats: ConditionalFormatRule[];
}

/** Workbook settings. */
export interface SheetWorkbookSettings {
  /** Default font family. */
  fontFamily: string;
  /** Default font size in points. */
  fontSize: number;
  /** Default cell padding in points. */
  cellPadding: number;
  /** Locale for number/date formats. */
  locale: string;
  /** Active sheet id. */
  activeSheetId: string;
}

/** The body of a spreadsheet document. */
export interface SheetBody {
  format: "spreadsheet";
  sheets: Sheet[];
  settings: SheetWorkbookSettings;
}

/** Document-wide statistics. */
export interface SheetStats {
  sheetCount: number;
  totalCells: number;
  filledCells: number;
  emptyCells: number;
  formulaCells: number;
  numericCells: number;
  textCells: number;
  rows: number;
  columns: number;
}

/** Type guard. */
export function isSheetBody(body: unknown): body is SheetBody {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as { format?: unknown; sheets?: unknown; settings?: unknown };
  if (candidate.format !== "spreadsheet") return false;
  if (!Array.isArray(candidate.sheets)) return false;
  if (typeof candidate.settings !== "object" || candidate.settings === null) return false;
  return true;
}

/** Default workbook settings. */
export const DEFAULT_WORKBOOK_SETTINGS: SheetWorkbookSettings = {
  fontFamily: "Inter",
  fontSize: 11,
  cellPadding: 4,
  locale: "en-US",
  activeSheetId: "sheet-1",
};

/** Default sheet view. */
export const DEFAULT_SHEET_VIEW: SheetView = {
  frozenRows: 0,
  frozenColumns: 0,
  showGridlines: true,
  showHeaders: true,
};

/** A default sheet. */
export function createDefaultSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: "sheet-1",
    name: "Sheet 1",
    rowCount: 100,
    columnCount: 26,
    cells: {},
    rows: {},
    columns: {},
    merges: [],
    view: { ...DEFAULT_SHEET_VIEW },
    conditionalFormats: [],
    ...overrides,
  };
}

/** A default empty body. */
export const DEFAULT_SHEET_BODY: SheetBody = {
  format: "spreadsheet",
  sheets: [createDefaultSheet()],
  settings: { ...DEFAULT_WORKBOOK_SETTINGS },
};

/** Coerces an unknown body into a SheetBody. */
export function asSheetBody(body: unknown): SheetBody {
  if (isSheetBody(body)) return body;
  return {
    format: "spreadsheet",
    sheets: [createDefaultSheet()],
    settings: { ...DEFAULT_WORKBOOK_SETTINGS },
  };
}

/** The key used in the cells map for a given address. */
export function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/** Splits a cells-map key back into a row/column pair. */
export function parseCellKey(key: string): CellAddress | null {
  const [r, c] = key.split(":").map(Number);
  if (typeof r !== "number" || typeof c !== "number" || Number.isNaN(r) || Number.isNaN(c)) {
    return null;
  }
  return { row: r, column: c };
}

/** A typed lookup helper. */
export function getCell(sheet: Sheet, row: number, column: number): SheetCell | null {
  return sheet.cells[cellKey(row, column)] ?? null;
}
