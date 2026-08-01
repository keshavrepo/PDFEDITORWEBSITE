"use client";

/**
 * OfficePilot Spreadsheet editor.
 *
 * Renders a virtualised cell grid (column headers across the top, row
 * headers down the left, scrollable cells in the middle) with cell
 * selection, keyboard navigation, in-place editing, formula bar, sheet
 * tabs, frozen panes, hidden rows/columns and the shared toolbar.
 *
 * The grid is built with absolute positioning so the editor can render
 * thousands of rows and columns without bringing the DOM to its knees.
 * The visible window is determined by a scroll container that updates
 * `scrollTop`/`scrollLeft` and feeds the visible row/column range into
 * the grid.
 *
 * Selection, copy/paste, keyboard navigation and in-place editing all
 * work against the body through the editor model hook.
 */

import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { OfficeDocument } from "@/lib/officepilot";
import {
  columnLetter,
  toA1,
  type CellAddress,
  type Sheet,
} from "@/lib/officepilot/spreadsheet/schema";
import { useSpreadsheetEditorModel, type SheetSelection } from "./document-model";
import { SpreadsheetToolbar, FindReplaceDialog } from "./toolbar";
// import { isMergeOrigin, mergeAt } from "./document-model";

/** Default row height in pixels. */
const ROW_HEIGHT = 26;
/** Row header width. */
const ROW_HEADER_WIDTH = 48;
/** Column header height. */
const COLUMN_HEADER_HEIGHT = 24;

/** Returns a range of integers from start to end (inclusive). */
function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) result.push(i);
  return result;
}

/**
 * Walks the sheet's columns and returns the index of the column that
 * contains the given pixel offset. Hidden columns are skipped.
 */
function columnFromOffset(sheet: Sheet, offset: number, zoom: number): number {
  let x = 0;
  for (let column = 0; column < sheet.columnCount; column++) {
    if (sheet.columns[column]?.hidden) continue;
    const width = (sheet.columns[column]?.width ?? 9) * 8 * zoom;
    if (x + width > offset) return column;
    x += width;
  }
  return Math.max(0, sheet.columnCount - 1);
}

interface SpreadsheetEditorProps {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

export function SpreadsheetEditor({ document, onChange }: SpreadsheetEditorProps) {
  const model = useSpreadsheetEditorModel({ document, onChange });
  const [zoom, setZoom] = useState(1);
  const [findOpen, setFindOpen] = useState(false);
  const [editing, setEditing] = useState<{ address: CellAddress; value: string; isFormula: boolean } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 480 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeSheet = model.commands.getActiveSheet();

  // Visible window: determine rows/cols to render based on scroll position.
  // The width estimator walks per-column widths so a custom-sized column
  // does not produce a wrong "skip a column" boundary.
  const { visibleRows, visibleColumns } = useMemo(() => {
    const rowHeight = ROW_HEIGHT * zoom;
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
    const endRow = Math.min(
      activeSheet.rowCount - 1,
      Math.ceil((scrollTop + containerSize.height) / rowHeight) + 2
    );
    // Walk columns in order, summing the actual rendered width of each
    // (skipping hidden ones), until we have covered the viewport plus a
    // 2-cell buffer on each side.
    const startCol = Math.max(0, columnFromOffset(activeSheet, scrollLeft, zoom) - 2);
    const endCol = Math.min(
      activeSheet.columnCount - 1,
      columnFromOffset(activeSheet, scrollLeft + containerSize.width, zoom) + 2
    );
    return {
      visibleRows: range(startRow, endRow),
      visibleColumns: range(startCol, endCol),
    };
  }, [scrollTop, scrollLeft, containerSize, activeSheet, zoom]);

  // Frozen pane splits.
  const frozenRows = activeSheet.view.frozenRows;
  const frozenColumns = activeSheet.view.frozenColumns;

  // Resize observer.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setContainerSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    });
    observer.observe(element);
    setContainerSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  /** Returns the merged-cell origin for a given address, if any. */
  const mergeOrigin = useCallback(
    (address: CellAddress): CellAddress | null => {
      const merge = activeSheet.merges.find(
        (m) =>
          address.row >= m.startRow &&
          address.row <= m.endRow &&
          address.column >= m.startColumn &&
          address.column <= m.endColumn
      );
      if (!merge) return null;
      return { row: merge.startRow, column: merge.startColumn };
    },
    [activeSheet.merges]
  );

  /** Returns the displayed cell value at an address. */
  const getDisplayedValue = useCallback(
    (address: CellAddress): string => {
      const key = `${address.row}:${address.column}`;
      const cell = activeSheet.cells[key];
      if (!cell) return "";
      if (cell.display) return cell.display;
      if (typeof cell.value === "string") return cell.value;
      if (typeof cell.value === "number") return String(cell.value);
      if (typeof cell.value === "boolean") return cell.value ? "TRUE" : "FALSE";
      if (cell.raw !== undefined) return cell.raw;
      return "";
    },
    [activeSheet.cells]
  );

  /** Returns the raw input at an address (formula if formula, raw otherwise). */
  const getRawInput = useCallback(
    (address: CellAddress): { value: string; isFormula: boolean } => {
      const key = `${address.row}:${address.column}`;
      const cell = activeSheet.cells[key];
      if (!cell) return { value: "", isFormula: false };
      if (cell.formula) return { value: cell.formula, isFormula: true };
      if (cell.raw !== undefined) return { value: cell.raw, isFormula: false };
      return { value: "", isFormula: false };
    },
    [activeSheet.cells]
  );

  /** Commits the editing cell. */
  const commitEdit = useCallback(() => {
    if (!editing) return;
    const { address, value, isFormula } = editing;
    if (value === "") {
      model.commands.clearCellAt(address.row, address.column);
    } else if (isFormula || value.startsWith("=")) {
      // Both the explicit "started with =" state and a value the user
      // typed that begins with "=" land here. `setCellValue` will promote
      // the value to the formula slot and clear the raw.
      const formula = value.startsWith("=") ? value : `=${value}`;
      model.commands.setCell(address.row, address.column, "", formula);
    } else {
      model.commands.setCell(address.row, address.column, value);
    }
    setEditing(null);
  }, [editing, model.commands]);

  /** Cancels the editing cell. */
  const cancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  /** Begins editing the current selection. */
  const beginEdit = useCallback(
    (initial?: string) => {
      const selection = model.selection ?? { anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 } };
      const focus = mergeOrigin(selection.focus) ?? selection.focus;
      const { value, isFormula } = getRawInput(focus);
      setEditing({
        address: focus,
        value: initial ?? value,
        isFormula: isFormula || (initial ?? "").startsWith("="),
      });
    },
    [model.selection, getRawInput, mergeOrigin]
  );

  /** Moves the selection. */
  const moveSelection = useCallback(
    (rowDelta: number, columnDelta: number, extend: boolean) => {
      const current = model.selection ?? { anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 } };
      const focus = current.focus;
      const newFocus = {
        row: Math.max(0, Math.min(activeSheet.rowCount - 1, focus.row + rowDelta)),
        column: Math.max(0, Math.min(activeSheet.columnCount - 1, focus.column + columnDelta)),
      };
      if (extend) {
        model.setSelection({ anchor: current.anchor, focus: newFocus });
      } else {
        model.setSelection({ anchor: newFocus, focus: newFocus });
      }
    },
    [activeSheet.rowCount, activeSheet.columnCount, model]
  );

  /** Computes a normalised range from a selection. */
  const getSelectionRange = useCallback((): [CellAddress, CellAddress] | null => {
    const selection = model.selection;
    if (!selection) return null;
    return [
      { row: Math.min(selection.anchor.row, selection.focus.row), column: Math.min(selection.anchor.column, selection.focus.column) },
      { row: Math.max(selection.anchor.row, selection.focus.row), column: Math.max(selection.anchor.column, selection.focus.column) },
    ];
  }, [model.selection]);

  /** Copies the current selection to the clipboard as TSV. */
  const copySelectionToClipboard = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    const range = getSelectionRange();
    if (!range) return;
    const [start, end] = range;
    const lines: string[] = [];
    for (let row = start.row; row <= end.row; row++) {
      const cells: string[] = [];
      for (let column = start.column; column <= end.column; column++) {
        cells.push(getDisplayedValue({ row, column }));
      }
      lines.push(cells.join("\t"));
    }
    void navigator.clipboard.writeText(lines.join("\n"));
  }, [getDisplayedValue, getSelectionRange]);

  /** Pastes the clipboard as TSV. */
  const pasteFromClipboard = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.readText().then((text) => {
      const lines = text.split(/\r?\n/);
      const values: Array<Array<string>> = [];
      for (const line of lines) {
        if (line === "") {
          values.push([]);
          continue;
        }
        values.push(line.split("\t"));
      }
      const focus = model.selection?.focus ?? { row: 0, column: 0 };
      model.commands.pasteValues(focus, values);
    });
  }, [model.commands, model.selection]);

  /** Keyboard handler at the grid level. */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (editing) {
        if (event.key === "Enter") {
          event.preventDefault();
          commitEdit();
          // Shift+Enter moves up, Enter moves down — matches Excel.
          moveSelection(event.shiftKey ? -1 : 1, 0, false);
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelEdit();
        } else if (event.key === "Tab") {
          event.preventDefault();
          commitEdit();
          moveSelection(0, event.shiftKey ? -1 : 1, false);
        }
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        model.commands.undo();
        return;
      }
      if (mod && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
        event.preventDefault();
        model.commands.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        const range = getSelectionRange();
        if (range) model.commands.toggleMark(range[0], range[1], "bold");
        return;
      }
      if (mod && event.key.toLowerCase() === "i") {
        event.preventDefault();
        const range = getSelectionRange();
        if (range) model.commands.toggleMark(range[0], range[1], "italic");
        return;
      }
      if (mod && event.key.toLowerCase() === "u") {
        event.preventDefault();
        const range = getSelectionRange();
        if (range) model.commands.toggleMark(range[0], range[1], "underline");
        return;
      }
      if (mod && event.key === "Delete") {
        event.preventDefault();
        const range = getSelectionRange();
        if (range) model.commands.clearRange(range[0], range[1]);
        return;
      }
      if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        // Select the whole sheet, like Excel's Ctrl+A.
        model.setSelection({
          anchor: { row: 0, column: 0 },
          focus: {
            row: Math.max(0, activeSheet.rowCount - 1),
            column: Math.max(0, activeSheet.columnCount - 1),
          },
        });
        return;
      }
      if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectionToClipboard();
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteFromClipboard();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1, 0, event.shiftKey);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1, 0, event.shiftKey);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelection(0, -1, event.shiftKey);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelection(0, 1, event.shiftKey);
      } else if (event.key === "Tab") {
        event.preventDefault();
        moveSelection(0, event.shiftKey ? -1 : 1, false);
      } else if (event.key === "Enter") {
        event.preventDefault();
        beginEdit();
      } else if (event.key === "F2") {
        event.preventDefault();
        beginEdit();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const range = getSelectionRange();
        if (range) model.commands.clearRange(range[0], range[1]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        // Drop the selection so the user can quickly deselect without
        // reaching for the mouse.
        model.setSelection(null);
      } else if (event.key === "Home") {
        event.preventDefault();
        const current = model.selection?.focus ?? { row: 0, column: 0 };
        if (mod) {
          model.setSelection({ anchor: { row: 0, column: 0 }, focus: { row: current.row, column: 0 } });
        } else {
          model.setSelection({ anchor: { row: current.row, column: 0 }, focus: { row: current.row, column: 0 } });
        }
      } else if (event.key === "End") {
        event.preventDefault();
        const current = model.selection?.focus ?? { row: 0, column: 0 };
        if (mod) {
          model.setSelection({ anchor: { row: 0, column: 0 }, focus: { row: activeSheet.rowCount - 1, column: activeSheet.columnCount - 1 } });
        } else {
          model.setSelection({ anchor: { row: current.row, column: activeSheet.columnCount - 1 }, focus: { row: current.row, column: activeSheet.columnCount - 1 } });
        }
      } else if (event.key === "PageUp") {
        event.preventDefault();
        const pageRows = Math.max(
          1,
          Math.floor(containerSize.height / (ROW_HEIGHT * zoom))
        );
        moveSelection(-pageRows, 0, event.shiftKey);
      } else if (event.key === "PageDown") {
        event.preventDefault();
        const pageRows = Math.max(
          1,
          Math.floor(containerSize.height / (ROW_HEIGHT * zoom))
        );
        moveSelection(pageRows, 0, event.shiftKey);
      } else if (event.key.length === 1 && !mod && !event.altKey) {
        // Begin editing with this character.
        event.preventDefault();
        beginEdit(event.key);
      }
    },
    [editing, commitEdit, cancelEdit, beginEdit, model, moveSelection, getSelectionRange, copySelectionToClipboard, pasteFromClipboard, activeSheet.rowCount, activeSheet.columnCount, containerSize.height, zoom]
  );

  /** Handles scroll events. */
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setScrollLeft(target.scrollLeft);
  }, []);

  /** Resizes a column. */
  const resizeColumn = useCallback(
    (column: number, delta: number) => {
      const current = activeSheet.columns[column]?.width ?? 9;
      const nextWidth = Math.max(20, current + delta / 4);
      model.commands.setColumnWidth(column, nextWidth);
    },
    [activeSheet.columns, model.commands]
  );

  /** Resizes a row. */
  const resizeRow = useCallback(
    (row: number, delta: number) => {
      const current = activeSheet.rows[row]?.height ?? ROW_HEIGHT;
      const nextHeight = Math.max(12, current + delta);
      model.commands.setRowHeight(row, nextHeight);
    },
    [activeSheet.rows, model.commands]
  );

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  // Each character in Excel's "width" units maps to 8 CSS pixels at 1x
  // zoom; the workbook default is 9 chars so the helper returns 9 * 8.
  const columnWidth = useCallback(
    (column: number) => (activeSheet.columns[column]?.width ?? 9) * 8,
    [activeSheet.columns]
  );
  const rowHeight = useCallback(
    (row: number) => activeSheet.rows[row]?.height ?? ROW_HEIGHT,
    [activeSheet.rows]
  );
  // Total scrollable size: account for per-column widths and per-row
  // heights, skipping hidden rows/columns so the canvas matches what the
  // user actually sees.
  const totalWidth = useMemo(() => {
    let width = ROW_HEADER_WIDTH;
    for (let column = 0; column < activeSheet.columnCount; column++) {
      if (activeSheet.columns[column]?.hidden) continue;
      width += columnWidth(column) * zoom;
    }
    return width;
  }, [activeSheet.columnCount, activeSheet.columns, columnWidth, zoom]);
  const totalHeight = useMemo(() => {
    let height = COLUMN_HEADER_HEIGHT * zoom;
    for (let row = 0; row < activeSheet.rowCount; row++) {
      if (activeSheet.rows[row]?.hidden) continue;
      height += rowHeight(row) * zoom;
    }
    return height;
  }, [activeSheet.rowCount, activeSheet.rows, rowHeight, zoom]);

  // Frozen pane offsets.
  const frozenColumnWidth = useMemo(() => {
    let width = 0;
    for (let column = 0; column < frozenColumns; column++) {
      width += columnWidth(column) * zoom;
    }
    return width;
  }, [frozenColumns, zoom, columnWidth]);
  const frozenRowHeight = useMemo(() => {
    let height = 0;
    for (let row = 0; row < frozenRows; row++) {
      height += rowHeight(row) * zoom;
    }
    return height;
  }, [frozenRows, zoom, rowHeight]);

  // Offset helpers that account for the row/column header strips and skip
  // hidden rows/columns so the layout matches the visible scroll area.
  const cellColumnOffset = useCallback(
    (column: number) => ROW_HEADER_WIDTH + columnOffset(column, columnWidth, activeSheet, zoom),
    [zoom, columnWidth, activeSheet]
  );
  const cellRowOffset = useCallback(
    (row: number) => COLUMN_HEADER_HEIGHT * zoom + rowOffset(row, rowHeight, activeSheet, zoom),
    [zoom, rowHeight, activeSheet]
  );

  // ----------------------------------------------------------------
  // Formula bar
  // ----------------------------------------------------------------

  const formulaAddress = useMemo(() => {
    const selection = model.selection;
    if (!selection) return "";
    return toA1(selection.focus);
  }, [model.selection]);
  const formulaValue = useMemo(() => {
    const selection = model.selection;
    if (!selection) return "";
    return getRawInput(selection.focus).value;
  }, [model.selection, getRawInput]);
  const formulaDisplay = useMemo(() => {
    const selection = model.selection;
    if (!selection) return "";
    return getDisplayedValue(selection.focus);
  }, [model.selection, getDisplayedValue]);

  // ----------------------------------------------------------------
  // Sheet tabs
  // ----------------------------------------------------------------

  const handleSheetSelect = useCallback(
    (id: string) => {
      model.commands.selectSheet(id);
    },
    [model.commands]
  );
  const handleSheetAdd = useCallback(() => {
    model.commands.addSheet();
  }, [model.commands]);
  const handleSheetRemove = useCallback(
    (id: string) => {
      model.commands.removeSheet(id);
    },
    [model.commands]
  );
  const handleSheetRename = useCallback(
    (id: string, name: string) => {
      model.commands.renameSheet(id, name);
    },
    [model.commands]
  );

  /**
   * Selects an entire column. With extend=true the selection grows from
   * the anchor; with extend=false the column becomes the only thing
   * selected. Matches Excel/Google Sheets' click-on-column-header.
   */
  const selectColumn = useCallback(
    (column: number, extend: boolean) => {
      if (extend && model.selection) {
        const focusColumn = Math.max(
          0,
          Math.min(activeSheet.columnCount - 1, column)
        );
        model.setSelection({
          anchor: { row: 0, column: focusColumn },
          focus: { row: activeSheet.rowCount - 1, column: focusColumn },
        });
      } else {
        model.setSelection({
          anchor: { row: 0, column },
          focus: { row: activeSheet.rowCount - 1, column },
        });
      }
    },
    [activeSheet.columnCount, activeSheet.rowCount, model]
  );

  /**
   * Selects an entire row. Same semantics as `selectColumn` but flips
   * the row/column axes.
   */
  const selectRow = useCallback(
    (row: number, extend: boolean) => {
      if (extend && model.selection) {
        const focusRow = Math.max(
          0,
          Math.min(activeSheet.rowCount - 1, row)
        );
        model.setSelection({
          anchor: { row: focusRow, column: 0 },
          focus: { row: focusRow, column: activeSheet.columnCount - 1 },
        });
      } else {
        model.setSelection({
          anchor: { row, column: 0 },
          focus: { row, column: activeSheet.columnCount - 1 },
        });
      }
    },
    [activeSheet.columnCount, activeSheet.rowCount, model]
  );

  const isColumnSelected = useCallback(
    (column: number) => {
      const selection = model.selection;
      if (!selection) return false;
      const startCol = Math.min(selection.anchor.column, selection.focus.column);
      const endCol = Math.max(selection.anchor.column, selection.focus.column);
      return (
        startCol === 0 &&
        endCol === activeSheet.columnCount - 1 &&
        selection.anchor.row === 0 &&
        selection.focus.row === activeSheet.rowCount - 1
      );
    },
    [activeSheet.columnCount, activeSheet.rowCount, model.selection]
  );

  const isRowSelected = useCallback(
    (row: number) => {
      const selection = model.selection;
      if (!selection) return false;
      const startRow = Math.min(selection.anchor.row, selection.focus.row);
      const endRow = Math.max(selection.anchor.row, selection.focus.row);
      return (
        startRow === row &&
        endRow === row &&
        selection.anchor.column === 0 &&
        selection.focus.column === activeSheet.columnCount - 1
      );
    },
    [activeSheet.columnCount, model.selection]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <SpreadsheetToolbar
        commands={model.commands}
        body={model.body}
        activeSheet={activeSheet}
        zoom={zoom}
        onZoomChange={setZoom}
        onFindReplace={() => setFindOpen(true)}
        getSelectionRange={getSelectionRange}
      />

      {/* Formula bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-1.5 text-xs">
        <span className="w-14 rounded border border-border bg-background px-2 py-1 text-center font-mono text-[11px]">
          {formulaAddress}
        </span>
        <span className="text-muted-foreground">fx</span>
        <input
          type="text"
          value={editing && toA1(editing.address) === formulaAddress ? editing.value : formulaValue}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (model.selection) {
              const value = event.target.value;
              setEditing({ address: model.selection.focus, value, isFormula: value.startsWith("=") });
            }
          }}
          onFocus={() => {
            if (model.selection && !editing) {
              setEditing({ address: model.selection.focus, value: formulaValue, isFormula: formulaValue.startsWith("=") });
            }
          }}
          onBlur={commitEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEdit();
              // Shift+Enter moves up, Enter moves down — matches Excel.
              moveSelection(event.shiftKey ? -1 : 1, 0, false);
              (event.target as HTMLInputElement).blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEdit();
              (event.target as HTMLInputElement).blur();
            } else if (event.key === "Tab") {
              event.preventDefault();
              commitEdit();
              moveSelection(0, event.shiftKey ? -1 : 1, false);
              (event.target as HTMLInputElement).blur();
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              commitEdit();
              moveSelection(event.key === "ArrowUp" ? -1 : 1, 0, false);
              (event.target as HTMLInputElement).blur();
            } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              // Don't hijack left/right when the cursor is in the middle
              // of the input value; only move the selection once the
              // cursor is at the edge, like Excel does.
              const input = event.target as HTMLInputElement;
              const atEdge =
                (event.key === "ArrowLeft" && input.selectionStart === 0) ||
                (event.key === "ArrowRight" &&
                  input.selectionStart === input.value.length);
              if (atEdge) {
                event.preventDefault();
                commitEdit();
                moveSelection(0, event.key === "ArrowLeft" ? -1 : 1, false);
                input.blur();
              }
            }
          }}
          placeholder="Enter value or formula (e.g. =SUM(A1:A10))"
          className="h-7 flex-1 rounded border border-border bg-background px-2 text-xs font-mono"
          aria-label="Formula bar"
        />
        <span className="rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
          {formulaDisplay || "—"}
        </span>
      </div>

      {/* Grid container */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-auto bg-background outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onMouseDown={(event) => {
          // A mousedown on the grid background (not on a cell) should
          // still focus the grid so the keyboard shortcuts keep working.
          // The cell mousedown handler runs first and may stopPropagation.
          if (event.target === event.currentTarget) {
            (event.currentTarget as HTMLDivElement).focus();
          }
        }}
        role="grid"
        aria-label="Spreadsheet grid"
      >
        {/* Main scrollable layer (the only scroller; sticky elements
            inside it are pinned to the viewport edges). */}
        <div
          style={{
            width: totalWidth,
            height: totalHeight,
            position: "relative",
          }}
        >
          {/* Selection indicator overlay (for the visible window) */}
          <SelectionOverlay
            sheet={activeSheet}
            selection={model.selection}
            zoom={zoom}
            rowHeight={rowHeight}
            columnWidth={columnWidth}
          />
          {/* Top-left corner where the row and column header strips meet. */}
          <div
            aria-hidden="true"
            className="bg-muted"
            style={{
              position: "sticky",
              top: 0,
              left: 0,
              zIndex: 40,
              width: ROW_HEADER_WIDTH,
              height: COLUMN_HEADER_HEIGHT * zoom,
              borderRight: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          />

          {/* Column headers (sticky to the top while scrolling). */}
          <div
            className="z-20"
            style={{ height: COLUMN_HEADER_HEIGHT * zoom, position: "sticky", top: 0, left: 0, right: 0 }}
          >
            {visibleColumns.map((column) => {
              const width = columnWidth(column) * zoom;
              const offset = cellColumnOffset(column);
              if (activeSheet.columns[column]?.hidden) return null;
              return (
                <ColumnHeader
                  key={column}
                  column={column}
                  width={width}
                  offset={offset}
                  isFrozen={column < frozenColumns}
                  isSelected={isColumnSelected(column)}
                  zoom={zoom}
                  onResize={(delta) => resizeColumn(column, delta)}
                  onSelect={(extend) => selectColumn(column, extend)}
                />
              );
            })}
          </div>

          {/* Row headers (scrollable) */}
          {visibleRows.map((row) => {
            const height = rowHeight(row) * zoom;
            const offset = cellRowOffset(row);
            if (activeSheet.rows[row]?.hidden) return null;
            return (
              <RowHeader
                key={row}
                row={row}
                height={height}
                offset={offset}
                isFrozen={row < frozenRows}
                isSelected={isRowSelected(row)}
                onResize={(delta) => resizeRow(row, delta)}
                onSelect={(extend) => selectRow(row, extend)}
              />
            );
          })}

          {/* Cells (scrollable) */}
          {visibleRows.map((row) => {
            const height = rowHeight(row) * zoom;
            const rowTop = cellRowOffset(row);
            if (activeSheet.rows[row]?.hidden) return null;
            return (
              <div
                key={`row-${row}`}
                style={{
                  position: "absolute",
                  top: rowTop,
                  left: 0,
                  right: 0,
                  height,
                }}
              >
                {visibleColumns.map((column) => {
                  if (activeSheet.columns[column]?.hidden) return null;
                  const width = columnWidth(column) * zoom;
                  const left = cellColumnOffset(column);
                  const isSelected = isInSelection(model.selection, row, column);
                  const isEditing = Boolean(
                    editing && editing.address.row === row && editing.address.column === column
                  );
                  // When this cell is the one being edited, prefer the
                  // in-progress value the user is typing over the
                  // committed display so the input does not snap back on
                  // every keystroke.
                  const cellDisplayedValue = isEditing
                    ? editing!.value
                    : getDisplayedValue({ row, column });
                  return (
                    <CellView
                      key={`${row}:${column}`}
                      row={row}
                      column={column}
                      top={0}
                      left={left}
                      width={width}
                      height={height}
                      sheet={activeSheet}
                      isSelected={isSelected}
                      isEditing={isEditing}
                      zoom={zoom}
                      displayedValue={cellDisplayedValue}
                      onMouseDown={(event) => {
                        // Focus the grid container on every cell click so
                        // arrow keys, copy/paste and the other grid-level
                        // shortcuts work without a second click somewhere
                        // else first.
                        const container = containerRef.current;
                        if (container && event.currentTarget instanceof Element) {
                          // requestAnimationFrame defers the focus call
                          // until after the browser's default focus
                          // management has settled.
                          requestAnimationFrame(() => container.focus());
                        }
                        if (event.shiftKey && model.selection) {
                          model.setSelection({
                            anchor: model.selection.anchor,
                            focus: { row, column },
                          });
                        } else {
                          model.setSelection({ anchor: { row, column }, focus: { row, column } });
                          setEditing(null);
                        }
                      }}
                      onDoubleClick={() => beginEdit()}
                      onCommit={commitEdit}
                      onCancel={cancelEdit}
                      onChange={(value) => setEditing({ address: { row, column }, value, isFormula: value.startsWith("=") })}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheet tabs */}
      <SheetTabs
        sheets={model.body.sheets}
        activeId={model.body.settings.activeSheetId}
        onSelect={handleSheetSelect}
        onAdd={handleSheetAdd}
        onRemove={handleSheetRemove}
        onRename={handleSheetRename}
      />

      <FindReplaceDialog
        open={findOpen}
        onClose={() => setFindOpen(false)}
        onReplace={(search, replacement, caseSensitive) => {
          const range = getSelectionRange();
          if (range) {
            // For now, replace across the entire sheet.
            return model.commands.replaceInRange(search, replacement, caseSensitive);
          }
          return model.commands.replaceInRange(search, replacement, caseSensitive);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function rowOffset(row: number, rowHeight: (row: number) => number, sheet: Sheet, zoom: number): number {
  let offset = 0;
  for (let r = 0; r < row; r++) {
    if (sheet.rows[r]?.hidden) continue;
    offset += rowHeight(r) * zoom;
  }
  return offset;
}

function columnOffset(column: number, columnWidth: (col: number) => number, sheet: Sheet, zoom: number): number {
  let offset = 0;
  for (let c = 0; c < column; c++) {
    if (sheet.columns[c]?.hidden) continue;
    offset += columnWidth(c) * zoom;
  }
  return offset;
}

function isInSelection(selection: SheetSelection | null, row: number, column: number): boolean {
  if (!selection) return false;
  const startRow = Math.min(selection.anchor.row, selection.focus.row);
  const endRow = Math.max(selection.anchor.row, selection.focus.row);
  const startCol = Math.min(selection.anchor.column, selection.focus.column);
  const endCol = Math.max(selection.anchor.column, selection.focus.column);
  return row >= startRow && row <= endRow && column >= startCol && column <= endCol;
}

interface ColumnHeaderProps {
  column: number;
  width: number;
  offset: number;
  isFrozen: boolean;
  zoom: number;
  isSelected: boolean;
  onResize: (delta: number) => void;
  onSelect: (extend: boolean) => void;
}

function ColumnHeader({ column, width, offset, isFrozen, zoom, onResize, onSelect, isSelected }: ColumnHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end border-b border-r border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground",
        isFrozen && "z-30",
        isSelected && "bg-foreground/15"
      )}
      style={{
        position: "absolute",
        top: 0,
        left: offset,
        width,
        height: COLUMN_HEADER_HEIGHT * zoom,
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(event.shiftKey);
      }}
    >
      <span className="flex-1 truncate text-center">{columnLetter(column)}</span>
      <ResizeHandle axis="column" onResize={onResize} />
    </div>
  );
}

interface RowHeaderProps {
  row: number;
  height: number;
  offset: number;
  isFrozen: boolean;
  isSelected: boolean;
  onResize: (delta: number) => void;
  onSelect: (extend: boolean) => void;
}

function RowHeader({ row, height, offset, isFrozen, isSelected, onResize, onSelect }: RowHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-r border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground",
        isFrozen && "z-30",
        isSelected && "bg-foreground/15"
      )}
      style={{
        position: "absolute",
        top: offset,
        left: 0,
        width: ROW_HEADER_WIDTH,
        height,
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(event.shiftKey);
      }}
    >
      <span className="flex-1 text-center">{row + 1}</span>
      <ResizeHandle axis="row" onResize={onResize} />
    </div>
  );
}

interface ResizeHandleProps {
  axis: "row" | "column";
  onResize: (delta: number) => void;
}

function ResizeHandle({ axis, onResize }: ResizeHandleProps) {
  const [active, setActive] = useState(false);
  const startRef = useRef<{ position: number; value: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    function onMove(event: MouseEvent) {
      if (!startRef.current) return;
      const delta = axis === "column" ? event.clientX - startRef.current.position : event.clientY - startRef.current.position;
      onResize(delta - startRef.current.value);
      startRef.current.value = delta;
      startRef.current.position = axis === "column" ? event.clientX : event.clientY;
    }
    function onUp() {
      setActive(false);
      startRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, axis, onResize]);

  return (
    <span
      role="separator"
      aria-orientation={axis === "column" ? "vertical" : "horizontal"}
      className={cn(
        "select-none",
        axis === "column" ? "h-full w-1 cursor-col-resize" : "h-1 w-full cursor-row-resize"
      )}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setActive(true);
        startRef.current = {
          position: axis === "column" ? event.clientX : event.clientY,
          value: 0,
        };
      }}
    />
  );
}

interface CellViewProps {
  row: number;
  column: number;
  top: number;
  left: number;
  width: number;
  height: number;
  sheet: import("@/lib/officepilot/spreadsheet/schema").Sheet;
  isSelected: boolean;
  isEditing: boolean;
  zoom: number;
  displayedValue: string;
  onMouseDown: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
}

function CellView({
  row,
  column,
  top,
  left,
  width,
  height,
  sheet,
  isSelected,
  isEditing,
  zoom,
  displayedValue,
  onMouseDown,
  onDoubleClick,
  onCommit,
  onCancel,
  onChange,
}: CellViewProps) {
  const cell = sheet.cells[`${row}:${column}`];
  const style = cell?.style;
  const backgroundColor = style?.backgroundColor;
  const fontColor = style?.fontColor;
  const fontFamily = style?.fontFamily;
  const fontSize = style?.fontSize;
  const bold = style?.bold === true;
  const italic = style?.italic === true;
  const underline = style?.underline === true;
  const strikethrough = style?.strikethrough === true;
  const alignment = style?.alignment ?? "right";
  const isNumeric = typeof cell?.value === "number";
  const isBoolean = typeof cell?.value === "boolean";
  const isError = cell?.valueType === "error";
  const computedAlignment: "left" | "right" | "center" =
    isNumeric || isBoolean ? (alignment === "left" ? "right" : alignment) : alignment;

  const borderStyle: React.CSSProperties = {};
  if (style?.borders) {
    if (style.borders.top) borderStyle.borderTop = borderCss(style.borders.top);
    if (style.borders.right) borderStyle.borderRight = borderCss(style.borders.right);
    if (style.borders.bottom) borderStyle.borderBottom = borderCss(style.borders.bottom);
    if (style.borders.left) borderStyle.borderLeft = borderCss(style.borders.left);
  }
  const conditionalBackground = pickConditionalBackground(sheet, row, column);
  return (
    <div
      role="gridcell"
      aria-selected={isSelected}
      data-row={row}
      data-column={column}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        "absolute border-b border-r border-border/60",
        isSelected && "outline outline-2 outline-foreground/80 outline-offset-[-2px] z-10",
        isError && "text-red-500"
      )}
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        backgroundColor: backgroundColor ?? conditionalBackground,
        color: fontColor,
        fontFamily,
        fontSize: fontSize ? `${fontSize * zoom}px` : undefined,
        fontWeight: bold ? 600 : undefined,
        fontStyle: italic ? "italic" : undefined,
        textDecoration: strikethrough
          ? "line-through"
          : underline
            ? "underline"
            : undefined,
        textAlign: computedAlignment,
        lineHeight: `${height}px`,
        overflow: "hidden",
        whiteSpace: "nowrap",
        padding: "0 4px",
        ...borderStyle,
      }}
    >
      {isEditing ? (
        <input
          autoFocus
          value={displayedValue}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            } else if (event.key === "Tab") {
              // Tab is handled by the grid-level keydown listener so it
              // can run after the cell commits, but make sure the
              // browser does not steal focus on its own.
              event.preventDefault();
              onCommit();
            }
          }}
          className="absolute inset-0 w-full bg-background px-1 font-mono text-[12px] outline-none"
          style={{
            fontWeight: bold ? 600 : undefined,
            fontStyle: italic ? "italic" : undefined,
            textAlign: computedAlignment,
          }}
        />
      ) : (
        displayedValue
      )}
    </div>
  );
}

function borderCss(border: { style: string; color?: string }): string {
  const color = border.color ?? "#0a0a0a";
  const width = border.style === "thick" ? 3 : border.style === "medium" ? 2 : 1;
  return `${width}px ${border.style === "dashed" || border.style === "dotted" ? border.style : "solid"} ${color}`;
}

function pickConditionalBackground(sheet: import("@/lib/officepilot/spreadsheet/schema").Sheet, row: number, column: number): string | undefined {
  for (const rule of sheet.conditionalFormats) {
    const range = parseRuleRange(rule.range);
    if (!range) continue;
    if (row < range.startRow || row > range.endRow || column < range.startColumn || column > range.endColumn) continue;
    if (rule.style.backgroundColor) return rule.style.backgroundColor;
  }
  return undefined;
}

function parseRuleRange(range: string): { startRow: number; startColumn: number; endRow: number; endColumn: number } | null {
  const [start, end] = range.split(":");
  if (!start) return null;
  const startAddress = parseA1(start);
  if (!startAddress) return null;
  if (!end) return { startRow: startAddress.row, startColumn: startAddress.column, endRow: startAddress.row, endColumn: startAddress.column };
  const endAddress = parseA1(end);
  if (!endAddress) return { startRow: startAddress.row, startColumn: startAddress.column, endRow: startAddress.row, endColumn: startAddress.column };
  return {
    startRow: Math.min(startAddress.row, endAddress.row),
    startColumn: Math.min(startAddress.column, endAddress.column),
    endRow: Math.max(startAddress.row, endAddress.row),
    endColumn: Math.max(startAddress.column, endAddress.column),
  };
}

function parseA1(reference: string): { row: number; column: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(reference.replace(/\$/g, ""));
  if (!match) return null;
  const column = columnIndexLocal(match[1]!);
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

interface SelectionOverlayProps {
  sheet: import("@/lib/officepilot/spreadsheet/schema").Sheet;
  selection: SheetSelection | null;
  zoom: number;
  rowHeight: (row: number) => number;
  columnWidth: (column: number) => number;
}

function SelectionOverlay({ sheet, selection, zoom, rowHeight, columnWidth }: SelectionOverlayProps) {
  if (!selection) return null;
  const startRow = Math.min(selection.anchor.row, selection.focus.row);
  const endRow = Math.max(selection.anchor.row, selection.focus.row);
  const startCol = Math.min(selection.anchor.column, selection.focus.column);
  const endCol = Math.max(selection.anchor.column, selection.focus.column);
  // Compute a single rectangle for the selection so the outline is one
  // continuous box even when hidden rows/columns are skipped. Offsets
  // include the row/column header strips.
  const startRowOffset = COLUMN_HEADER_HEIGHT * zoom + rowOffset(startRow, rowHeight, sheet, zoom);
  const startColOffset = ROW_HEADER_WIDTH + columnOffset(startCol, columnWidth, sheet, zoom);
  let endRowOffset = startRowOffset;
  for (let row = startRow; row <= endRow; row++) {
    if (sheet.rows[row]?.hidden) continue;
    endRowOffset = COLUMN_HEADER_HEIGHT * zoom + rowOffset(row, rowHeight, sheet, zoom) + rowHeight(row) * zoom;
  }
  let endColOffset = startColOffset;
  for (let column = startCol; column <= endCol; column++) {
    if (sheet.columns[column]?.hidden) continue;
    endColOffset = ROW_HEADER_WIDTH + columnOffset(column, columnWidth, sheet, zoom) + columnWidth(column) * zoom;
  }
  if (endRowOffset <= startRowOffset || endColOffset <= startColOffset) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 outline outline-2 outline-foreground/80 outline-offset-[-2px]"
      style={{
        top: startRowOffset,
        left: startColOffset,
        width: endColOffset - startColOffset,
        height: endRowOffset - startRowOffset,
      }}
    />
  );
}

interface SheetTabsProps {
  sheets: import("@/lib/officepilot/spreadsheet/schema").Sheet[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function SheetTabs({ sheets, activeId, onSelect, onAdd, onRemove, onRename }: SheetTabsProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  return (
    <div className="flex shrink-0 items-center gap-1 border-t border-border bg-card px-2 py-1 text-xs">
      {sheets.map((sheet) => {
        const isActive = sheet.id === activeId;
        return (
          <div
            key={sheet.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg border px-2 py-1 transition-colors",
              isActive
                ? "border-foreground/30 bg-background"
                : "border-transparent hover:bg-accent"
            )}
          >
            {renamingId === sheet.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => {
                  if (renameValue.trim()) onRename(sheet.id, renameValue);
                  setRenamingId(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (renameValue.trim()) onRename(sheet.id, renameValue);
                    setRenamingId(null);
                  } else if (event.key === "Escape") {
                    setRenamingId(null);
                  }
                }}
                className="h-6 w-24 rounded border border-border bg-background px-1 text-xs"
                aria-label={`Rename sheet ${sheet.name}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelect(sheet.id)}
                onDoubleClick={() => {
                  setRenamingId(sheet.id);
                  setRenameValue(sheet.name);
                }}
                className="text-xs"
              >
                {sheet.name}
              </button>
            )}
            {sheets.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(sheet.id)}
                className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                aria-label={`Remove sheet ${sheet.name}`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Add sheet"
      >
        +
      </button>
    </div>
  );
}
