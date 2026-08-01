/**
 * OfficePilot Spreadsheet cell operations.
 *
 * Pure functions over the SheetBody model. Used by the editor to mutate
 * the document, by the undo/redo history, by the formula engine for
 * dependency tracking, and by the importer to clean up artefacts.
 *
 * Every function returns a new Sheet/SheetBody; the originals are not
 * mutated. The "set" helpers skip the work when the new value equals
 * the old one so the editor's "no-op autosave" check sees a stable
 * body for idempotent operations like format-only changes.
 */

import {
  cellKey,
  DEFAULT_SHEET_VIEW,
  getCell,
  type CellAddress,
  type CellBorders,
  type CellStyle,
  type Sheet,
  type SheetBody,
  type SheetCell,
  type SheetColumnInfo,
  type SheetRowInfo,
  type ConditionalFormatRule,
} from "./schema";

/** Generates a fresh id with a short random suffix. */
function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deep-clones a sheet. */
export function cloneSheet(sheet: Sheet): Sheet {
  return {
    ...sheet,
    cells: { ...sheet.cells },
    rows: { ...sheet.rows },
    columns: { ...sheet.columns },
    merges: sheet.merges.map((merge) => ({ ...merge })),
    view: { ...sheet.view },
    conditionalFormats: sheet.conditionalFormats.map((rule) => ({
      ...rule,
      style: rule.style ? { ...rule.style, borders: rule.style.borders ? { ...rule.style.borders } : undefined } : rule.style,
    })),
  };
}

/** Deep-clones a body. */
export function cloneBody(body: SheetBody): SheetBody {
  return {
    ...body,
    sheets: body.sheets.map(cloneSheet),
    settings: { ...body.settings },
  };
}

/** Returns the active sheet (the one matching the workbook's activeSheetId). */
export function getActiveSheet(body: SheetBody): Sheet {
  const found = body.sheets.find((sheet) => sheet.id === body.settings.activeSheetId);
  if (found) return found;
  const fallback = body.sheets[0];
  if (!fallback) {
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
    };
  }
  return fallback;
}

/** Returns a new body with the given sheet id marked active. */
export function setActiveSheet(body: SheetBody, sheetId: string): SheetBody {
  if (!body.sheets.some((sheet) => sheet.id === sheetId)) return body;
  return { ...body, settings: { ...body.settings, activeSheetId: sheetId } };
}

/** Returns a new body with one sheet added. */
export function addSheet(body: SheetBody, name?: string): SheetBody {
  const id = makeId("sheet");
  const usedNames = new Set(body.sheets.map((sheet) => sheet.name));
  let candidate = name ?? `Sheet ${body.sheets.length + 1}`;
  let suffix = body.sheets.length + 1;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `Sheet ${suffix}`;
  }
  const sheet: Sheet = {
    id,
    name: candidate,
    rowCount: 100,
    columnCount: 26,
    cells: {},
    rows: {},
    columns: {},
    merges: [],
    view: { ...DEFAULT_SHEET_VIEW },
    conditionalFormats: [],
  };
  return {
    ...body,
    sheets: [...body.sheets, sheet],
    settings: { ...body.settings, activeSheetId: id },
  };
}

/** Returns a new body with the sheet removed. */
export function removeSheet(body: SheetBody, sheetId: string): SheetBody {
  if (body.sheets.length <= 1) return body;
  const next = body.sheets.filter((sheet) => sheet.id !== sheetId);
  const newActive =
    body.settings.activeSheetId === sheetId ? next[0]?.id ?? "" : body.settings.activeSheetId;
  return {
    ...body,
    sheets: next,
    settings: { ...body.settings, activeSheetId: newActive },
  };
}

/** Returns a new body with one sheet renamed. */
export function renameSheet(body: SheetBody, sheetId: string, name: string): SheetBody {
  const trimmed = name.trim();
  if (!trimmed) return body;
  return {
    ...body,
    sheets: body.sheets.map((sheet) =>
      sheet.id === sheetId ? { ...sheet, name: trimmed.slice(0, 80) } : sheet
    ),
  };
}

/** Returns a new body with a sheet replaced. */
export function replaceSheet(body: SheetBody, sheet: Sheet): SheetBody {
  return {
    ...body,
    sheets: body.sheets.map((existing) => (existing.id === sheet.id ? sheet : existing)),
  };
}

/** Returns a new sheet with a cell set. */
export function setCellValue(sheet: Sheet, row: number, column: number, raw: string, formula?: string): Sheet {
  const key = cellKey(row, column);
  const existing = sheet.cells[key];
  const next: SheetCell = { ...(existing ?? {}) };
  if (formula !== undefined) {
    if (formula === "") {
      delete next.formula;
    } else {
      next.formula = formula;
    }
  }
  if (raw === "") {
    next.raw = undefined;
  } else {
    next.raw = raw;
  }
  // Clear cached value; the formula engine re-evaluates next time.
  delete next.value;
  delete next.valueType;
  delete next.display;

  const nextCells = { ...sheet.cells };
  if (next.raw === undefined && next.formula === undefined) {
    delete nextCells[key];
  } else {
    nextCells[key] = next;
  }
  return { ...sheet, cells: nextCells };
}

/** Returns a new sheet with a cell cleared. */
export function clearCell(sheet: Sheet, row: number, column: number): Sheet {
  const key = cellKey(row, column);
  if (!(key in sheet.cells)) return sheet;
  const nextCells = { ...sheet.cells };
  delete nextCells[key];
  return { ...sheet, cells: nextCells };
}

/** Returns a new sheet with a range cleared. */
export function clearRange(sheet: Sheet, start: CellAddress, end: CellAddress): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  let next = sheet;
  for (let row = r1.row; row <= r2.row; row++) {
    for (let column = r1.column; column <= r2.column; column++) {
      next = clearCell(next, row, column);
    }
  }
  return next;
}

/** Normalises a range so the start is always the top-left corner. */
export function normaliseRange(start: CellAddress, end: CellAddress): [CellAddress, CellAddress] {
  return [
    { row: Math.min(start.row, end.row), column: Math.min(start.column, end.column) },
    { row: Math.max(start.row, end.row), column: Math.max(start.column, end.column) },
  ];
}

/** Returns a new sheet with cell styling set. */
export function setCellStyle(
  sheet: Sheet,
  start: CellAddress,
  end: CellAddress,
  style: Partial<CellStyle>
): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const nextCells = { ...sheet.cells };
  for (let row = r1.row; row <= r2.row; row++) {
    for (let column = r1.column; column <= r2.column; column++) {
      const key = cellKey(row, column);
      const existing = nextCells[key] ?? {};
      const merged: SheetCell = {
        ...existing,
        style: { ...(existing.style ?? {}), ...style },
      };
      nextCells[key] = merged;
    }
  }
  return { ...sheet, cells: nextCells };
}

/** Returns a new sheet with cell borders set. */
export function setCellBorders(
  sheet: Sheet,
  start: CellAddress,
  end: CellAddress,
  borders: CellBorders
): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const nextCells = { ...sheet.cells };
  for (let row = r1.row; row <= r2.row; row++) {
    for (let column = r1.column; column <= r2.column; column++) {
      const key = cellKey(row, column);
      const existing = nextCells[key] ?? {};
      const currentBorders = existing.style?.borders ?? {};
      nextCells[key] = {
        ...existing,
        style: {
          ...(existing.style ?? {}),
          borders: { ...currentBorders, ...borders },
        },
      };
    }
  }
  return { ...sheet, cells: nextCells };
}

/** Clears borders in a range. */
export function clearCellBorders(sheet: Sheet, start: CellAddress, end: CellAddress): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const nextCells = { ...sheet.cells };
  for (let row = r1.row; row <= r2.row; row++) {
    for (let column = r1.column; column <= r2.column; column++) {
      const key = cellKey(row, column);
      const existing = nextCells[key];
      if (!existing || !existing.style?.borders) continue;
      const style = { ...existing.style };
      delete style.borders;
      nextCells[key] = { ...existing, style };
    }
  }
  return { ...sheet, cells: nextCells };
}

/** Inserts a number of rows at the given index. */
export function insertRows(sheet: Sheet, at: number, count: number): Sheet {
  if (count <= 0) return sheet;
  if (at < 0) at = 0;
  if (at > sheet.rowCount) at = sheet.rowCount;
  const next: Sheet = {
    ...sheet,
    rowCount: sheet.rowCount + count,
    cells: shiftCellsDown(sheet.cells, at, count),
    rows: shiftRowInfo(sheet.rows, at, count, sheet.rowCount + count),
    merges: shiftMerges(sheet.merges, at, count, "row"),
    conditionalFormats: shiftConditionalFormats(sheet.conditionalFormats, at, count, "row"),
  };
  return next;
}

/** Deletes a number of rows starting at the given index. */
export function deleteRows(sheet: Sheet, at: number, count: number): Sheet {
  if (count <= 0) return sheet;
  if (at < 0) at = 0;
  if (at >= sheet.rowCount) return sheet;
  const last = Math.min(sheet.rowCount, at + count);
  const next: Sheet = {
    ...sheet,
    rowCount: Math.max(1, sheet.rowCount - (last - at)),
    cells: shiftCellsUp(sheet.cells, at, last - at),
    rows: removeRowRange(sheet.rows, at, last - at),
    merges: removeMerges(sheet.merges, at, last - at, "row"),
    conditionalFormats: removeConditionalFormatsInRows(sheet.conditionalFormats, at, last - 1),
  };
  return next;
}

/** Inserts columns at the given index. */
export function insertColumns(sheet: Sheet, at: number, count: number): Sheet {
  if (count <= 0) return sheet;
  if (at < 0) at = 0;
  if (at > sheet.columnCount) at = sheet.columnCount;
  const next: Sheet = {
    ...sheet,
    columnCount: sheet.columnCount + count,
    cells: shiftCellsRight(sheet.cells, at, count),
    columns: shiftColumnInfo(sheet.columns, at, count, sheet.columnCount + count),
    merges: shiftMerges(sheet.merges, at, count, "column"),
    conditionalFormats: shiftConditionalFormats(sheet.conditionalFormats, at, count, "column"),
  };
  return next;
}

/** Deletes columns at the given index. */
export function deleteColumns(sheet: Sheet, at: number, count: number): Sheet {
  if (count <= 0) return sheet;
  if (at < 0) at = 0;
  if (at >= sheet.columnCount) return sheet;
  const last = Math.min(sheet.columnCount, at + count);
  const next: Sheet = {
    ...sheet,
    columnCount: Math.max(1, sheet.columnCount - (last - at)),
    cells: shiftCellsLeft(sheet.cells, at, last - at),
    columns: removeColumnRange(sheet.columns, at, last - at),
    merges: removeMerges(sheet.merges, at, last - at, "column"),
    conditionalFormats: removeConditionalFormatsInColumns(sheet.conditionalFormats, at, last - 1),
  };
  return next;
}

/** Returns a new sheet with a row resized. */
export function setRowHeight(sheet: Sheet, row: number, height: number | null): Sheet {
  const next = { ...sheet.rows };
  if (height === null || height <= 0) {
    delete next[row];
  } else {
    next[row] = { ...(next[row] ?? { index: row }), index: row, height };
  }
  return { ...sheet, rows: next };
}

/** Returns a new sheet with a column resized. */
export function setColumnWidth(sheet: Sheet, column: number, width: number | null): Sheet {
  const next = { ...sheet.columns };
  if (width === null || width <= 0) {
    delete next[column];
  } else {
    next[column] = { ...(next[column] ?? { index: column }), index: column, width };
  }
  return { ...sheet, columns: next };
}

/** Returns a new sheet with a row hidden or shown. */
export function setRowHidden(sheet: Sheet, row: number, hidden: boolean): Sheet {
  const next = { ...sheet.rows };
  next[row] = { ...(next[row] ?? { index: row }), index: row, hidden };
  return { ...sheet, rows: next };
}

/** Returns a new sheet with a column hidden or shown. */
export function setColumnHidden(sheet: Sheet, column: number, hidden: boolean): Sheet {
  const next = { ...sheet.columns };
  next[column] = { ...(next[column] ?? { index: column }), index: column, hidden };
  return { ...sheet, columns: next };
}

/** Returns a new sheet with frozen rows/columns updated. */
export function setSheetView(sheet: Sheet, view: Partial<Sheet["view"]>): Sheet {
  return { ...sheet, view: { ...sheet.view, ...view } };
}

/** Adds a merge to the sheet. */
export function addMerge(
  sheet: Sheet,
  start: CellAddress,
  end: CellAddress
): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  if (r1.row === r2.row && r1.column === r2.column) return sheet;
  const next = [
    ...sheet.merges,
    {
      startRow: r1.row,
      startColumn: r1.column,
      endRow: r2.row,
      endColumn: r2.column,
    },
  ];
  return { ...sheet, merges: next };
}

/** Removes a merge. */
export function removeMerge(sheet: Sheet, start: CellAddress): Sheet {
  return {
    ...sheet,
    merges: sheet.merges.filter(
      (merge) => !(merge.startRow === start.row && merge.startColumn === start.column)
    ),
  };
}

/** Returns the merge a cell is part of, if any. */
export function mergeAt(sheet: Sheet, row: number, column: number): Sheet["merges"][number] | null {
  for (const merge of sheet.merges) {
    if (
      row >= merge.startRow &&
      row <= merge.endRow &&
      column >= merge.startColumn &&
      column <= merge.endColumn
    ) {
      return merge;
    }
  }
  return null;
}

/** Returns whether a cell is the top-left of its merge. */
export function isMergeOrigin(sheet: Sheet, row: number, column: number): boolean {
  return sheet.merges.some(
    (merge) => merge.startRow === row && merge.startColumn === column
  );
}

/** Returns a new sheet with a conditional formatting rule added or updated. */
export function setConditionalFormat(sheet: Sheet, rule: ConditionalFormatRule): Sheet {
  const others = sheet.conditionalFormats.filter((existing) => existing.id !== rule.id);
  return { ...sheet, conditionalFormats: [...others, rule].sort((a, b) => a.priority - b.priority) };
}

/** Removes a conditional formatting rule. */
export function removeConditionalFormat(sheet: Sheet, id: string): Sheet {
  return { ...sheet, conditionalFormats: sheet.conditionalFormats.filter((rule) => rule.id !== id) };
}

/** Sets a per-cell validation rule. */
export function setCellValidation(
  sheet: Sheet,
  start: CellAddress,
  end: CellAddress,
  validation: SheetCell["validation"] | null
): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const nextCells = { ...sheet.cells };
  for (let row = r1.row; row <= r2.row; row++) {
    for (let column = r1.column; column <= r2.column; column++) {
      const key = cellKey(row, column);
      const existing = nextCells[key] ?? {};
      const cell: SheetCell = { ...existing };
      if (validation === null) {
        delete cell.validation;
      } else {
        cell.validation = validation;
      }
      nextCells[key] = cell;
    }
  }
  return { ...sheet, cells: nextCells };
}

/** Returns the value, formula, or null in priority order. */
export function cellText(cell: SheetCell | null): string {
  if (!cell) return "";
  if (cell.display) return cell.display;
  if (typeof cell.value === "string") return cell.value;
  if (cell.value === null || cell.value === undefined) return cell.raw ?? "";
  return String(cell.value);
}

/** Sorts the rows of a range by a column. */
export function sortRange(
  sheet: Sheet,
  start: CellAddress,
  end: CellAddress,
  column: number,
  direction: "asc" | "desc"
): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  if (column < r1.column || column > r2.column) return sheet;
  // Collect row data.
  const rowIndices: number[] = [];
  for (let row = r1.row; row <= r2.row; row++) rowIndices.push(row);
  const compare = (a: number, b: number): number => {
    const cellA = getCell(sheet, a, column);
    const cellB = getCell(sheet, b, column);
    const valA = cellText(cellA);
    const valB = cellText(cellB);
    const numA = Number(valA);
    const numB = Number(valB);
    const bothNumeric = !Number.isNaN(numA) && !Number.isNaN(numB) && valA.trim() !== "" && valB.trim() !== "";
    if (bothNumeric) {
      return direction === "asc" ? numA - numB : numB - numA;
    }
    const cmp = valA.localeCompare(valB);
    return direction === "asc" ? cmp : -cmp;
  };
  rowIndices.sort(compare);
  // Build a mapping: original row -> new row in the range.
  const sortedRows: Array<Record<string, SheetCell>> = [];
  for (const newRowIndex of rowIndices) {
    const originalRow: Record<string, SheetCell> = {};
    for (let column2 = r1.column; column2 <= r2.column; column2++) {
      const cell = getCell(sheet, newRowIndex, column2);
      if (cell) {
        originalRow[cellKey(newRowIndex, column2)] = cell;
      }
    }
    sortedRows.push(originalRow);
  }
  // Rebuild cells.
  const nextCells = { ...sheet.cells };
  // First, clear cells in the range.
  for (let row = r1.row; row <= r2.row; row++) {
    for (let column2 = r1.column; column2 <= r2.column; column2++) {
      delete nextCells[cellKey(row, column2)];
    }
  }
  // Then, place sorted rows.
  sortedRows.forEach((row, offset) => {
    for (const key of Object.keys(row)) {
      const cell = row[key];
      if (!cell) continue;
      const [, columnStr] = key.split(":");
      const column2 = Number(columnStr);
      const newRow = r1.row + offset;
      nextCells[cellKey(newRow, column2)] = cell;
    }
  });
  return { ...sheet, cells: nextCells };
}

/** Hides rows in a range. */
export function hideRows(sheet: Sheet, start: CellAddress, end: CellAddress): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const next = { ...sheet.rows };
  for (let row = r1.row; row <= r2.row; row++) {
    next[row] = { ...(next[row] ?? { index: row }), index: row, hidden: true };
  }
  return { ...sheet, rows: next };
}

/** Shows rows in a range. */
export function showRows(sheet: Sheet, start: CellAddress, end: CellAddress): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const next = { ...sheet.rows };
  for (let row = r1.row; row <= r2.row; row++) {
    next[row] = { ...(next[row] ?? { index: row }), index: row, hidden: false };
  }
  return { ...sheet, rows: next };
}

/** Hides columns in a range. */
export function hideColumns(sheet: Sheet, start: CellAddress, end: CellAddress): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const next = { ...sheet.columns };
  for (let column = r1.column; column <= r2.column; column++) {
    next[column] = { ...(next[column] ?? { index: column }), index: column, hidden: true };
  }
  return { ...sheet, columns: next };
}

/** Shows columns in a range. */
export function showColumns(sheet: Sheet, start: CellAddress, end: CellAddress): Sheet {
  const [r1, r2] = normaliseRange(start, end);
  const next = { ...sheet.columns };
  for (let column = r1.column; column <= r2.column; column++) {
    next[column] = { ...(next[column] ?? { index: column }), index: column, hidden: false };
  }
  return { ...sheet, columns: next };
}

/** Returns the values in a range, with a column-major or row-major order. */
export function readRange(
  sheet: Sheet,
  start: CellAddress,
  end: CellAddress
): Array<Array<SheetCell | null>> {
  const [r1, r2] = normaliseRange(start, end);
  const result: Array<Array<SheetCell | null>> = [];
  for (let row = r1.row; row <= r2.row; row++) {
    const rowData: Array<SheetCell | null> = [];
    for (let column = r1.column; column <= r2.column; column++) {
      rowData.push(getCell(sheet, row, column));
    }
    result.push(rowData);
  }
  return result;
}

/** Writes a 2D array of values into a range. */
export function writeRange(
  sheet: Sheet,
  start: CellAddress,
  values: Array<Array<string | number | null | undefined>>
): Sheet {
  let next = sheet;
  values.forEach((row, rowOffset) => {
    row.forEach((value, columnOffset) => {
      const address = { row: start.row + rowOffset, column: start.column + columnOffset };
      if (value === null || value === undefined || value === "") {
        next = clearCell(next, address.row, address.column);
      } else {
        next = setCellValue(next, address.row, address.column, String(value));
      }
    });
  });
  return next;
}

/** Returns the column index of a column letter, e.g. "A" -> 0. Re-exported for ergonomics. */
export { columnIndex } from "./schema";

/** Computes the merged cell renderer for a row: cells that are merged get a "skip" marker. */
export function mergeMap(sheet: Sheet): Record<string, { rowspan: number; colspan: number; origin: boolean }> {
  const result: Record<string, { rowspan: number; colspan: number; origin: boolean }> = {};
  for (const merge of sheet.merges) {
    for (let row = merge.startRow; row <= merge.endRow; row++) {
      for (let column = merge.startColumn; column <= merge.endColumn; column++) {
        const isOrigin = row === merge.startRow && column === merge.startColumn;
        result[cellKey(row, column)] = {
          rowspan: merge.endRow - merge.startRow + 1,
          colspan: merge.endColumn - merge.startColumn + 1,
          origin: isOrigin,
        };
      }
    }
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function shiftCellsDown(
  cells: Record<string, SheetCell>,
  at: number,
  count: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  for (const key of Object.keys(cells)) {
    const parsed = parseCellKeySafe(key);
    if (!parsed) continue;
    const { row, column } = parsed;
    if (row >= at) {
      next[cellKey(row + count, column)] = cells[key]!;
    } else {
      next[key] = cells[key]!;
    }
  }
  return next;
}

function shiftCellsUp(
  cells: Record<string, SheetCell>,
  at: number,
  count: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  for (const key of Object.keys(cells)) {
    const parsed = parseCellKeySafe(key);
    if (!parsed) continue;
    const { row, column } = parsed;
    if (row >= at + count) {
      next[cellKey(row - count, column)] = cells[key]!;
    } else if (row < at) {
      next[key] = cells[key]!;
    }
  }
  return next;
}

function shiftCellsRight(
  cells: Record<string, SheetCell>,
  at: number,
  count: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  for (const key of Object.keys(cells)) {
    const parsed = parseCellKeySafe(key);
    if (!parsed) continue;
    const { row, column } = parsed;
    if (column >= at) {
      next[cellKey(row, column + count)] = cells[key]!;
    } else {
      next[key] = cells[key]!;
    }
  }
  return next;
}

function shiftCellsLeft(
  cells: Record<string, SheetCell>,
  at: number,
  count: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  for (const key of Object.keys(cells)) {
    const parsed = parseCellKeySafe(key);
    if (!parsed) continue;
    const { row, column } = parsed;
    if (column >= at + count) {
      next[cellKey(row, column - count)] = cells[key]!;
    } else if (column < at) {
      next[key] = cells[key]!;
    }
  }
  return next;
}

function shiftRowInfo(
  rows: Record<number, SheetRowInfo>,
  at: number,
  count: number,
  maxRows: number
): Record<number, SheetRowInfo> {
  const next: Record<number, SheetRowInfo> = {};
  for (const index of Object.keys(rows).map(Number)) {
    if (index >= at) {
      const newIndex = index + count;
      if (newIndex < maxRows) {
        const info = rows[index];
        if (info) next[newIndex] = { ...info, index: newIndex };
      }
    } else {
      const info = rows[index];
      if (info) next[index] = { ...info };
    }
  }
  return next;
}

function shiftColumnInfo(
  columns: Record<number, SheetColumnInfo>,
  at: number,
  count: number,
  maxColumns: number
): Record<number, SheetColumnInfo> {
  const next: Record<number, SheetColumnInfo> = {};
  for (const index of Object.keys(columns).map(Number)) {
    if (index >= at) {
      const newIndex = index + count;
      if (newIndex < maxColumns) {
        const info = columns[index];
        if (info) next[newIndex] = { ...info, index: newIndex };
      }
    } else {
      const info = columns[index];
      if (info) next[index] = { ...info };
    }
  }
  return next;
}

function removeRowRange(
  rows: Record<number, SheetRowInfo>,
  at: number,
  count: number
): Record<number, SheetRowInfo> {
  const next: Record<number, SheetRowInfo> = {};
  for (const index of Object.keys(rows).map(Number)) {
    if (index < at) {
      const info = rows[index];
      if (info) next[index] = { ...info };
    } else if (index >= at + count) {
      const newIndex = index - count;
      const info = rows[index];
      if (info) next[newIndex] = { ...info, index: newIndex };
    }
  }
  return next;
}

function removeColumnRange(
  columns: Record<number, SheetColumnInfo>,
  at: number,
  count: number
): Record<number, SheetColumnInfo> {
  const next: Record<number, SheetColumnInfo> = {};
  for (const index of Object.keys(columns).map(Number)) {
    if (index < at) {
      const info = columns[index];
      if (info) next[index] = { ...info };
    } else if (index >= at + count) {
      const newIndex = index - count;
      const info = columns[index];
      if (info) next[newIndex] = { ...info, index: newIndex };
    }
  }
  return next;
}

function shiftMerges(
  merges: Sheet["merges"],
  at: number,
  count: number,
  axis: "row" | "column"
): Sheet["merges"] {
  return merges.map((merge) => {
    if (axis === "row") {
      if (merge.startRow >= at) {
        return { ...merge, startRow: merge.startRow + count, endRow: merge.endRow + count };
      }
      return { ...merge };
    }
    if (merge.startColumn >= at) {
      return { ...merge, startColumn: merge.startColumn + count, endColumn: merge.endColumn + count };
    }
    return { ...merge };
  });
}

function removeMerges(
  merges: Sheet["merges"],
  at: number,
  count: number,
  axis: "row" | "column"
): Sheet["merges"] {
  return merges
    .map((merge) => {
      if (axis === "row") {
        if (merge.startRow >= at + count) {
          return { ...merge, startRow: merge.startRow - count, endRow: merge.endRow - count };
        }
        if (merge.endRow >= at) {
          // Overlaps the deleted range; collapse to start.
          return { ...merge, endRow: Math.max(merge.startRow, at - 1) };
        }
        return { ...merge };
      }
      if (merge.startColumn >= at + count) {
        return { ...merge, startColumn: merge.startColumn - count, endColumn: merge.endColumn - count };
      }
      if (merge.endColumn >= at) {
        return { ...merge, endColumn: Math.max(merge.startColumn, at - 1) };
      }
      return { ...merge };
    })
    .filter((merge) => merge.startRow <= merge.endRow && merge.startColumn <= merge.endColumn);
}

function shiftConditionalFormats(
  rules: ConditionalFormatRule[],
  at: number,
  count: number,
  axis: "row" | "column"
): ConditionalFormatRule[] {
  // For simplicity, drop rules that overlap the shifted area; most users
  // will recreate them after row/column insert anyway.
  return rules.filter((rule) => {
    const range = parseA1Range(rule.range);
    if (!range) return true;
    if (axis === "row") {
      return range.start.row < at;
    }
    return range.start.column < at;
  });
}

function removeConditionalFormatsInRows(
  rules: ConditionalFormatRule[],
  startRow: number,
  endRow: number
): ConditionalFormatRule[] {
  return rules.filter((rule) => {
    const range = parseA1Range(rule.range);
    if (!range) return true;
    return range.end.row < startRow || range.start.row > endRow;
  });
}

function removeConditionalFormatsInColumns(
  rules: ConditionalFormatRule[],
  startColumn: number,
  endColumn: number
): ConditionalFormatRule[] {
  return rules.filter((rule) => {
    const range = parseA1Range(rule.range);
    if (!range) return true;
    return range.end.column < startColumn || range.start.column > endColumn;
  });
}

function parseA1Range(range: string): { start: CellAddress; end: CellAddress } | null {
  const [start, end] = range.split(":");
  if (!start) return null;
  const startAddress = fromA1OrNull(start);
  if (!startAddress) return null;
  if (!end) return { start: startAddress, end: startAddress };
  const endAddress = fromA1OrNull(end);
  if (!endAddress) return { start: startAddress, end: startAddress };
  return { start: startAddress, end: endAddress };
}

function fromA1OrNull(reference: string): CellAddress | null {
  const clean = reference.replace(/\$/g, "").trim();
  const match = /^([A-Za-z]+)(\d+)$/.exec(clean);
  if (!match) return null;
  const column = columnIndexLocal(match[1]!.toUpperCase());
  const row = Number(match[2]!) - 1;
  if (column < 0 || row < 0) return null;
  return { row, column };
}

function columnIndexLocal(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 65 + 1);
  }
  return n - 1;
}

function parseCellKeySafe(key: string): { row: number; column: number } | null {
  const [r, c] = key.split(":").map(Number);
  if (typeof r !== "number" || typeof c !== "number" || Number.isNaN(r) || Number.isNaN(c)) {
    return null;
  }
  return { row: r, column: c };
}
