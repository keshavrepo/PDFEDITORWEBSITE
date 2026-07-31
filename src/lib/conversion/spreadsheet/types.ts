/**
 * Shared spreadsheet model used by the Excel converters.
 *
 * Both directions (PDF -> Excel, Excel -> PDF) work against this one model so
 * the readers and writers stay independent of each other.
 */

export type CellValueType = "string" | "number" | "boolean" | "date" | "empty";

export type SheetHorizontalAlignment = "left" | "center" | "right";
export type SheetVerticalAlignment = "top" | "middle" | "bottom";

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Uppercase RRGGBB without `#`. */
  color?: string;
  /** Uppercase RRGGBB background fill. */
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  horizontal?: SheetHorizontalAlignment;
  vertical?: SheetVerticalAlignment;
  wrapText?: boolean;
  /** Excel number format code, when the cell declared one. */
  numberFormat?: string;
}

export interface SheetCell {
  /** Zero-based row index within the sheet. */
  row: number;
  /** Zero-based column index within the sheet. */
  column: number;
  /** Display text, already formatted for presentation. */
  text: string;
  /** Raw value, kept so Excel output stays numeric where the source was. */
  value: string | number | boolean | Date | null;
  type: CellValueType;
  style?: CellStyle;
}

/** A merged region, expressed with inclusive zero-based bounds. */
export interface MergedRange {
  firstRow: number;
  lastRow: number;
  firstColumn: number;
  lastColumn: number;
}

export interface SheetModel {
  name: string;
  cells: SheetCell[];
  merges: MergedRange[];
  /** Column widths in Excel character units; sparse by column index. */
  columnWidths: Map<number, number>;
  /** Row heights in points; sparse by row index. */
  rowHeights: Map<number, number>;
  rowCount: number;
  columnCount: number;
  /** Print orientation declared by the sheet, when present. */
  landscape?: boolean;
}

export interface WorkbookModel {
  sheets: SheetModel[];
  title?: string;
  author?: string;
}
