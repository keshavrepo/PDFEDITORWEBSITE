"use client";

/**
 * OfficePilot Spreadsheet document model hook.
 *
 * Bridges the document body in IndexedDB with the React editor. Owns the
 * undo/redo history, the autosave hook and the body-level commands the
 * toolbar wires into.
 *
 * The surface itself receives the body through the workspace shell's
 * `document` prop. This hook reads and writes that body through
 * `onChange`, so the shell's autosave, save, rename, duplicate, delete,
 * tab management and the file manager all keep working without any
 * change.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfficeDocument } from "@/lib/officepilot";
import {
  asSheetBody,
  cellKey,
  columnLetter,
  toA1,
  type CellAddress,
  type CellStyle,
  type CellValueType,
  type Sheet,
  type SheetBody,
  type SheetCell,
} from "@/lib/officepilot/spreadsheet/schema";
import {
  addMerge,
  addSheet,
  cellText as cellTextOp,
  clearCell,
  clearRange,
  cloneSheet,
  deleteColumns,
  deleteRows,
  getActiveSheet,
  hideColumns,
  hideRows,
  insertColumns,
  insertRows,
  isMergeOrigin,
  mergeAt,
  normaliseRange,
  removeConditionalFormat as removeConditionalFormatOp,
  removeMerge,
  removeSheet,
  renameSheet,
  replaceSheet,
  setActiveSheet,
  setCellBorders,
  setCellStyle,
  setCellValue,
  setColumnHidden,
  setColumnWidth,
  setConditionalFormat as setConditionalFormatOp,
  setRowHeight,
  setRowHidden,
  setSheetView,
  showColumns,
  showRows,
  sortRange,
  writeRange,
} from "@/lib/officepilot/spreadsheet/cells";
import { evaluateBody } from "@/lib/officepilot/spreadsheet/formulas";
import { exportSheetToText } from "@/lib/officepilot/spreadsheet/text-exporters";
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "@/lib/officepilot/spreadsheet/history";

/** A selection in the grid. */
export interface SheetSelection {
  /** Active cell anchor. */
  anchor: CellAddress;
  /** Cell at the focus of the selection (last clicked). */
  focus: CellAddress;
}

export interface SpreadsheetEditorCommands {
  getBody: () => SheetBody;
  getActiveSheet: () => Sheet;
  getSelection: () => SheetSelection | null;
  setSelection: (next: SheetSelection | null) => void;
  setBody: (next: SheetBody, label: string) => void;
  /** Sets a cell's raw value or formula. */
  setCell: (row: number, column: number, raw: string, formula?: string) => void;
  /** Clears a cell. */
  clearCellAt: (row: number, column: number) => void;
  /** Clears a range. */
  clearRange: (start: CellAddress, end: CellAddress) => void;
  /** Applies a style to a range. */
  applyStyle: (start: CellAddress, end: CellAddress, style: Partial<CellStyle>) => void;
  /** Sets a border on the outside of a range. */
  applyBorder: (start: CellAddress, end: CellAddress, sides: Array<"top" | "right" | "bottom" | "left">) => void;
  /** Clears borders. */
  clearBorders: (start: CellAddress, end: CellAddress) => void;
  /** Sets alignment. */
  setAlignment: (start: CellAddress, end: CellAddress, alignment: "left" | "center" | "right") => void;
  /** Sets number format. */
  setNumberFormat: (start: CellAddress, end: CellAddress, format: CellStyle["numberFormat"]) => void;
  /** Sets font family. */
  setFontFamily: (start: CellAddress, end: CellAddress, family: string) => void;
  /** Sets font size. */
  setFontSize: (start: CellAddress, end: CellAddress, size: number) => void;
  /** Sets font color. */
  setFontColor: (start: CellAddress, end: CellAddress, color: string | undefined) => void;
  /** Sets background color. */
  setBackgroundColor: (start: CellAddress, end: CellAddress, color: string | undefined) => void;
  /** Toggles a boolean mark. */
  toggleMark: (start: CellAddress, end: CellAddress, mark: "bold" | "italic" | "underline" | "strikethrough") => void;
  /** Insert rows. */
  insertRows: (at: number, count?: number) => void;
  /** Insert columns. */
  insertColumns: (at: number, count?: number) => void;
  /** Delete rows. */
  deleteRows: (at: number, count?: number) => void;
  /** Delete columns. */
  deleteColumns: (at: number, count?: number) => void;
  /** Set row height. */
  setRowHeight: (row: number, height: number | null) => void;
  /** Set column width. */
  setColumnWidth: (column: number, width: number | null) => void;
  /** Hide rows. */
  hideRows: (start: CellAddress, end: CellAddress) => void;
  /** Show rows. */
  showRows: (start: CellAddress, end: CellAddress) => void;
  /** Hide columns. */
  hideColumns: (start: CellAddress, end: CellAddress) => void;
  /** Show columns. */
  showColumns: (start: CellAddress, end: CellAddress) => void;
  /** Toggle frozen rows. */
  setFrozenRows: (count: number) => void;
  /** Toggle frozen columns. */
  setFrozenColumns: (count: number) => void;
  /** Merge cells. */
  mergeCells: (start: CellAddress, end: CellAddress) => void;
  /** Unmerge cells. */
  unmergeCells: (start: CellAddress) => void;
  /** Add a new sheet. */
  addSheet: (name?: string) => void;
  /** Remove a sheet. */
  removeSheet: (id: string) => void;
  /** Rename a sheet. */
  renameSheet: (id: string, name: string) => void;
  /** Switch active sheet. */
  selectSheet: (id: string) => void;
  /** Sort a range by a column. */
  sortRange: (start: CellAddress, end: CellAddress, column: number, direction: "asc" | "desc") => void;
  /** Replace text in a range. */
  replaceInRange: (search: string, replacement: string, caseSensitive: boolean) => number;
  /** Duplicate the active row by inserting a copy below. */
  duplicateRow: (row: number) => void;
  /** Write a 2D array of values into a range. */
  pasteValues: (start: CellAddress, values: Array<Array<string>>) => void;
  /** Returns the current cell text. */
  getCellText: (row: number, column: number) => string;
  /** Undo. */
  undo: () => void;
  /** Redo. */
  redo: () => void;
  /** Can undo. */
  canUndo: () => boolean;
  /** Can redo. */
  canRedo: () => boolean;
  /** Returns the active sheet name. */
  exportText: () => string;
}

interface UseSpreadsheetEditorModelOptions {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

export function useSpreadsheetEditorModel({
  document,
  onChange,
}: UseSpreadsheetEditorModelOptions) {
  const [body, setBodyState] = useState<SheetBody>(() => asSheetBody(document.body));
  const [history, setHistory] = useState<HistoryState>(() => createHistory());
  const [selection, setSelection] = useState<SheetSelection | null>(null);

  // Resync when the shell hands us a new document.
  const lastSeenId = useRef<string | null>(null);
  const lastWrittenId = useRef<string | null>(null);
  useEffect(() => {
    if (lastWrittenId.current === document.meta.id) {
      lastWrittenId.current = null;
      return;
    }
    if (lastSeenId.current === document.meta.id) return;
    lastSeenId.current = document.meta.id;
    setBodyState(asSheetBody(document.body));
    setHistory(createHistory());
  }, [document.meta.id, document.body]);

  const writeBody = useCallback(
    (next: SheetBody) => {
      lastWrittenId.current = document.meta.id;
      setBodyState(next);
      onChange({ ...document, body: next });
    },
    [document, onChange]
  );

  const commitBody = useCallback(
    (next: SheetBody, label: string, coalesce: boolean) => {
      setHistory((current) => pushHistory(current, next, { label, coalesce }));
      writeBody(next);
    },
    [writeBody]
  );

  const setBody = useCallback(
    (next: SheetBody, label: string) => {
      commitBody(next, label, false);
    },
    [commitBody]
  );

  const applyToSheet = useCallback(
    (
      sheetId: string,
      transformer: (sheet: Sheet) => Sheet,
      label: string,
      coalesce: boolean
    ) => {
      const sheet = body.sheets.find((s) => s.id === sheetId);
      if (!sheet) return;
      const nextSheet = transformer(sheet);
      if (nextSheet === sheet) return;
      const nextBody: SheetBody = {
        ...body,
        sheets: body.sheets.map((s) => (s.id === sheetId ? nextSheet : s)),
      };
      const evaluated = evaluateBody(nextBody);
      commitBody(evaluated, label, coalesce);
    },
    [body, commitBody]
  );

  const commands = useMemo<SpreadsheetEditorCommands>(() => {
    const activeSheetId = () => body.settings.activeSheetId;
    return {
      getBody: () => body,
      getActiveSheet: () => getActiveSheet(body),
      getSelection: () => selection,
      setSelection: (next) => setSelection(next),
      setBody: (next, label) => setBody(next, label),
      setCell: (row, column, raw, formula) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setCellValue(sheet, row, column, raw, formula),
          "Edit",
          true
        );
      },
      clearCellAt: (row, column) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => clearCell(sheet, row, column),
          "Clear",
          false
        );
      },
      clearRange: (start, end) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => clearRange(sheet, start, end),
          "Clear",
          false
        );
      },
      applyStyle: (start, end, style) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setCellStyle(sheet, start, end, style),
          "Style",
          false
        );
      },
      applyBorder: (start, end, sides) => {
        const borders: { top?: { style: "thin"; color: string }; right?: { style: "thin"; color: string }; bottom?: { style: "thin"; color: string }; left?: { style: "thin"; color: string } } = {};
        for (const side of sides) {
          borders[side] = { style: "thin", color: "#0a0a0a" };
        }
        applyToSheet(
          activeSheetId(),
          (sheet) => setCellBorders(sheet, start, end, borders),
          "Border",
          false
        );
      },
      clearBorders: (start, end) => {
        const [r1, r2] = normaliseRange(start, end);
        applyToSheet(
          activeSheetId(),
          (sheet) => {
            const nextCells = { ...sheet.cells };
            for (let row = r1.row; row <= r2.row; row++) {
              for (let column = r1.column; column <= r2.column; column++) {
                const key = cellKey(row, column);
                const cell = nextCells[key];
                if (!cell?.style?.borders) continue;
                const style = { ...cell.style };
                delete style.borders;
                nextCells[key] = { ...cell, style };
              }
            }
            return { ...sheet, cells: nextCells };
          },
          "Border",
          false
        );
      },
      setAlignment: (start, end, alignment) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setCellStyle(sheet, start, end, { alignment }),
          "Align",
          false
        );
      },
      setNumberFormat: (start, end, format) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setCellStyle(sheet, start, end, { numberFormat: format }),
          "Format",
          false
        );
      },
      setFontFamily: (start, end, family) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setCellStyle(sheet, start, end, { fontFamily: family }),
          "Font",
          false
        );
      },
      setFontSize: (start, end, size) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setCellStyle(sheet, start, end, { fontSize: size }),
          "Size",
          false
        );
      },
      setFontColor: (start, end, color) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => {
            const [r1, r2] = normaliseRange(start, end);
            const nextCells = { ...sheet.cells };
            for (let row = r1.row; row <= r2.row; row++) {
              for (let column = r1.column; column <= r2.column; column++) {
                const key = cellKey(row, column);
                const cell = nextCells[key] ?? {};
                const style = { ...(cell.style ?? {}) };
                if (color) style.fontColor = color;
                else delete style.fontColor;
                nextCells[key] = { ...cell, style };
              }
            }
            return { ...sheet, cells: nextCells };
          },
          "Color",
          false
        );
      },
      setBackgroundColor: (start, end, color) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => {
            const [r1, r2] = normaliseRange(start, end);
            const nextCells = { ...sheet.cells };
            for (let row = r1.row; row <= r2.row; row++) {
              for (let column = r1.column; column <= r2.column; column++) {
                const key = cellKey(row, column);
                const cell = nextCells[key] ?? {};
                const style = { ...(cell.style ?? {}) };
                if (color) style.backgroundColor = color;
                else delete style.backgroundColor;
                nextCells[key] = { ...cell, style };
              }
            }
            return { ...sheet, cells: nextCells };
          },
          "Color",
          false
        );
      },
      toggleMark: (start, end, mark) => {
        const sheet = getActiveSheet(body);
        const [r1, r2] = normaliseRange(start, end);
        // Determine new value from the first cell in the range.
        const firstCell = sheet.cells[cellKey(r1.row, r1.column)];
        const currentValue = firstCell?.style?.[mark] === true;
        const newValue = !currentValue;
        applyToSheet(
          activeSheetId(),
          (sheet) => {
            const nextCells = { ...sheet.cells };
            for (let row = r1.row; row <= r2.row; row++) {
              for (let column = r1.column; column <= r2.column; column++) {
                const key = cellKey(row, column);
                const cell = nextCells[key] ?? {};
                const style = { ...(cell.style ?? {}) };
                if (newValue) {
                  (style as Record<string, unknown>)[mark] = true;
                } else {
                  delete (style as Record<string, unknown>)[mark];
                }
                nextCells[key] = { ...cell, style };
              }
            }
            return { ...sheet, cells: nextCells };
          },
          mark,
          true
        );
      },
      insertRows: (at, count = 1) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => insertRows(sheet, at, count),
          "Insert",
          false
        );
      },
      insertColumns: (at, count = 1) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => insertColumns(sheet, at, count),
          "Insert",
          false
        );
      },
      deleteRows: (at, count = 1) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => deleteRows(sheet, at, count),
          "Delete",
          false
        );
      },
      deleteColumns: (at, count = 1) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => deleteColumns(sheet, at, count),
          "Delete",
          false
        );
      },
      setRowHeight: (row, height) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setRowHeight(sheet, row, height),
          "Resize",
          false
        );
      },
      setColumnWidth: (column, width) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setColumnWidth(sheet, column, width),
          "Resize",
          false
        );
      },
      hideRows: (start, end) => {
        applyToSheet(activeSheetId(), (sheet) => hideRows(sheet, start, end), "Hide", false);
      },
      showRows: (start, end) => {
        applyToSheet(activeSheetId(), (sheet) => showRows(sheet, start, end), "Show", false);
      },
      hideColumns: (start, end) => {
        applyToSheet(activeSheetId(), (sheet) => hideColumns(sheet, start, end), "Hide", false);
      },
      showColumns: (start, end) => {
        applyToSheet(activeSheetId(), (sheet) => showColumns(sheet, start, end), "Show", false);
      },
      setFrozenRows: (count) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setSheetView(sheet, { frozenRows: count }),
          "Freeze",
          false
        );
      },
      setFrozenColumns: (count) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => setSheetView(sheet, { frozenColumns: count }),
          "Freeze",
          false
        );
      },
      mergeCells: (start, end) => {
        applyToSheet(activeSheetId(), (sheet) => addMerge(sheet, start, end), "Merge", false);
      },
      unmergeCells: (start) => {
        applyToSheet(activeSheetId(), (sheet) => removeMerge(sheet, start), "Merge", false);
      },
      addSheet: (name) => {
        const nextBody = addSheet(body, name);
        commitBody(evaluateBody(nextBody), "Sheet", false);
      },
      removeSheet: (id) => {
        const nextBody = removeSheet(body, id);
        if (nextBody === body) return;
        commitBody(evaluateBody(nextBody), "Sheet", false);
      },
      renameSheet: (id, name) => {
        const nextBody = renameSheet(body, id, name);
        if (nextBody === body) return;
        commitBody(evaluateBody(nextBody), "Sheet", false);
      },
      selectSheet: (id) => {
        const nextBody = setActiveSheet(body, id);
        if (nextBody === body) return;
        commitBody(evaluateBody(nextBody), "Sheet", false);
      },
      sortRange: (start, end, column, direction) => {
        applyToSheet(activeSheetId(), (sheet) => sortRange(sheet, start, end, column, direction), "Sort", false);
      },
      replaceInRange: (search, replacement, caseSensitive) => {
        if (!search) return 0;
        const sheet = getActiveSheet(body);
        let count = 0;
        const nextCells = { ...sheet.cells };
        const compare = (a: string) =>
          caseSensitive ? a.includes(search) : a.toLowerCase().includes(search.toLowerCase());
        for (const key of Object.keys(nextCells)) {
          const cell = nextCells[key];
          if (!cell) continue;
          if (cell.formula) continue; // Do not touch formulas; they are expressions.
          if (cell.raw && compare(cell.raw)) {
            const re = new RegExp(escapeRegExp(search), caseSensitive ? "g" : "gi");
            const next = cell.raw.replace(re, () => {
              count += 1;
              return replacement;
            });
            // Preserve the cell's value type: a boolean cell whose raw
            // representation changed should still resolve to a boolean if
            // the new raw is exactly "TRUE" or "FALSE" (case-insensitive);
            // otherwise fall back to text.
            const upper = next.trim().toUpperCase();
            if (cell.valueType === "boolean" && (upper === "TRUE" || upper === "FALSE")) {
              const bool = upper === "TRUE";
              nextCells[key] = { ...cell, raw: next, value: bool, valueType: "boolean", display: bool ? "TRUE" : "FALSE" };
            } else {
              nextCells[key] = { ...cell, raw: next, value: next, valueType: "text", display: next };
            }
          }
        }
        const nextSheet = { ...sheet, cells: nextCells };
        const nextBody: SheetBody = {
          ...body,
          sheets: body.sheets.map((s) => (s.id === sheet.id ? nextSheet : s)),
        };
        commitBody(nextBody, "Replace", false);
        return count;
      },
      duplicateRow: (row) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => {
            const next = { ...sheet.cells };
            for (const key of Object.keys(sheet.cells)) {
              const [r, c] = key.split(":").map(Number);
              if (typeof r !== "number" || typeof c !== "number") continue;
              if (r === row) {
                const newKey = cellKey(row + 1, c);
                next[newKey] = cloneCellForDuplicate(sheet.cells[key]!);
              }
            }
            return { ...sheet, cells: next };
          },
          "Duplicate",
          false
        );
      },
      pasteValues: (start, values) => {
        applyToSheet(
          activeSheetId(),
          (sheet) => writeRange(sheet, start, values as Array<Array<string | number | null | undefined>>),
          "Paste",
          false
        );
      },
      getCellText: (row, column) => {
        const sheet = getActiveSheet(body);
        const cell = sheet.cells[cellKey(row, column)];
        if (!cell) return "";
        return cell.display ?? (typeof cell.value === "string" ? cell.value : cell.raw ?? "");
      },
      undo: () => {
        const result = undoHistory(history, body);
        if (!result) return;
        setHistory(result.history);
        writeBody(result.body);
        setSelection(null);
      },
      redo: () => {
        const result = redoHistory(history, body);
        if (!result) return;
        setHistory(result.history);
        writeBody(result.body);
        setSelection(null);
      },
      canUndo: () => canUndo(history),
      canRedo: () => canRedo(history),
  exportText: () => {
    const sheet = getActiveSheet(body);
    let maxRow = 0;
    let maxColumn = 0;
    for (const key of Object.keys(sheet.cells)) {
      const [r, c] = key.split(":").map(Number);
      if (typeof r === "number" && r + 1 > maxRow) maxRow = r + 1;
      if (typeof c === "number" && c + 1 > maxColumn) maxColumn = c + 1;
    }
    const lines: string[] = [];
    for (let row = 0; row < maxRow; row++) {
      const cells: string[] = [];
      for (let column = 0; column < maxColumn; column++) {
        const cell = sheet.cells[`${row}:${column}`];
        cells.push(cell ? cellTextOp(cell) : "");
      }
      lines.push(cells.join("\t"));
    }
    return lines.join("\n");
  },
};
    // `commands` references itself for chaining. The linter cannot follow
    // the indirection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, commitBody, history, selection, writeBody, applyToSheet]);

  return { body, setBody, selection, setSelection, commands };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function cloneCellForDuplicate(cell: SheetCell): SheetCell {
  return {
    raw: cell.raw,
    formula: cell.formula,
    value: cell.value,
    valueType: cell.valueType,
    display: cell.display,
    style: cell.style ? { ...cell.style } : undefined,
  };
}

export { columnLetter, toA1, isMergeOrigin, mergeAt, setConditionalFormatOp, removeConditionalFormatOp };
export type { CellAddress, CellStyle, CellValueType, Sheet, SheetBody, SheetCell };
