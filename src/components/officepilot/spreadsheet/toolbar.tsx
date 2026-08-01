"use client";

/**
 * OfficePilot Spreadsheet toolbar.
 *
 * Formatting, number formats, alignment, borders, font, rows/columns,
 * freeze panes, merge, find and replace. The toolbar is the single
 * place that fires commands at the editor model.
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Bold,
  Combine,
  Eraser,
  Italic,
  Palette,
  PaintBucket,
  Printer,
  RotateCcw,
  RotateCw,
  Search,
  Strikethrough,
  Underline,
  X,
  Plus,
  Minus,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  TableProperties,
  ArrowDownAZ,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Sheet, SheetBody } from "@/lib/officepilot/spreadsheet/schema";
import type { SpreadsheetEditorCommands } from "./document-model";
import type { CellAddress } from "@/lib/officepilot/spreadsheet/schema";
import { printSheetDocument } from "@/lib/officepilot/spreadsheet/text-exporters";
import { exportSheetToXlsx } from "@/lib/officepilot/spreadsheet/xlsx-export";
import { ColorPicker } from "./color-picker";

const FONT_FAMILIES = [
  "Inter",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Calibri",
  "Garamond",
  "Palatino",
  "System UI",
];

const FONT_SIZES = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];

const NUMBER_FORMATS: Array<{ value: string; label: string }> = [
  { value: "general", label: "General" },
  { value: "number", label: "Number" },
  { value: "number-2dp", label: "Number (2 decimals)" },
  { value: "thousands", label: "Thousands" },
  { value: "currency", label: "Currency ($)" },
  { value: "currency-eur", label: "Currency (€)" },
  { value: "currency-gbp", label: "Currency (£)" },
  { value: "percentage", label: "Percentage" },
  { value: "percentage-2dp", label: "Percentage (2 decimals)" },
  { value: "scientific", label: "Scientific" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "datetime", label: "Date and time" },
];

interface SpreadsheetToolbarProps {
  commands: SpreadsheetEditorCommands;
  body: SheetBody;
  activeSheet: Sheet;
  zoom: number;
  onZoomChange: (next: number) => void;
  onFindReplace: () => void;
  getSelectionRange: () => [CellAddress, CellAddress] | null;
}

/** Returns a function that fires a command within the current selection. */
function withSelection(
  getSelectionRange: () => [CellAddress, CellAddress] | null,
  body: SheetBody,
  work: (start: CellAddress, end: CellAddress) => void
) {
  return () => {
    const range = getSelectionRange();
    if (!range) return;
    work(range[0], range[1]);
  };
}

export function SpreadsheetToolbar({
  commands,
  body,
  activeSheet,
  zoom,
  onZoomChange,
  onFindReplace,
  getSelectionRange,
}: SpreadsheetToolbarProps) {
  const [showFontColor, setShowFontColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [showNumberFormat, setShowNumberFormat] = useState(false);

  /** The font family of the active cell, or the default if no selection. */
  const activeFontFamily = (() => {
    const range = getSelectionRange();
    if (!range) return body.settings.fontFamily;
    const [start, end] = range;
    for (let row = start.row; row <= end.row; row++) {
      for (let column = start.column; column <= end.column; column++) {
        const cell = activeSheet.cells[`${row}:${column}`];
        if (cell?.style?.fontFamily) return cell.style.fontFamily;
      }
    }
    return body.settings.fontFamily;
  })();

  /** The font size of the active cell, or the default if no selection. */
  const activeFontSize = (() => {
    const range = getSelectionRange();
    if (!range) return body.settings.fontSize;
    const [start, end] = range;
    for (let row = start.row; row <= end.row; row++) {
      for (let column = start.column; column <= end.column; column++) {
        const cell = activeSheet.cells[`${row}:${column}`];
        if (cell?.style?.fontSize) return cell.style.fontSize;
      }
    }
    return body.settings.fontSize;
  })();

  /** The font colour of the active cell, or null (Automatic). */
  const activeFontColor = (() => {
    const range = getSelectionRange();
    if (!range) return null;
    const [start, end] = range;
    for (let row = start.row; row <= end.row; row++) {
      for (let column = start.column; column <= end.column; column++) {
        const cell = activeSheet.cells[`${row}:${column}`];
        if (cell?.style?.fontColor) return cell.style.fontColor;
      }
    }
    return null;
  })();

  /** The background colour of the active cell, or null (Automatic). */
  const activeBackgroundColor = (() => {
    const range = getSelectionRange();
    if (!range) return null;
    const [start, end] = range;
    for (let row = start.row; row <= end.row; row++) {
      for (let column = start.column; column <= end.column; column++) {
        const cell = activeSheet.cells[`${row}:${column}`];
        if (cell?.style?.backgroundColor) return cell.style.backgroundColor;
      }
    }
    return null;
  })();

  // Close the number-format dropdown on outside click. The colour
  // pickers handle their own dismissal via the ColorPicker component.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-number-format]")) {
        setShowNumberFormat(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const applyStyle = (style: Parameters<SpreadsheetEditorCommands["applyStyle"]>[2]) =>
    withSelection(getSelectionRange, body, (start, end) => commands.applyStyle(start, end, style));

  const handleExportXlsx = async () => {
    const title = activeSheet.name || "Spreadsheet";
    const blob = await exportSheetToXlsx(body, { title });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${title}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex shrink-0 flex-col border-b border-border bg-card">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1">
        <ToolGroup>
          <IconButton onClick={commands.undo} disabled={!commands.canUndo()} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)">
            <RotateCcw className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={commands.redo} disabled={!commands.canRedo()} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)">
            <RotateCw className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <ToolGroup>
          <FontFamilySelect
            value={activeFontFamily}
            onChange={(family) => withSelection(getSelectionRange, body, (start, end) => commands.setFontFamily(start, end, family))()}
          />
          <FontSizeSelect
            value={activeFontSize}
            onChange={(size) => withSelection(getSelectionRange, body, (start, end) => commands.setFontSize(start, end, size))()}
          />
        </ToolGroup>

        <ToolGroup>
          <div className="relative">
            <IconButton
              onClick={() => {
                setShowHighlight(false);
                setShowFontColor(!showFontColor);
              }}
              aria-label="Font color"
              title="Font color"
            >
              <span className="relative inline-block">
                <Palette
                  className="h-3.5 w-3.5"
                  style={{ color: activeFontColor ?? undefined }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 bottom-0.5 h-0.5 rounded"
                  style={{ background: activeFontColor ?? "currentColor" }}
                />
              </span>
            </IconButton>
            {showFontColor && (
              <ColorPicker
                key={`font-color-${activeFontColor ?? "auto"}`}
                label="Font color"
                value={activeFontColor}
                open={showFontColor}
                onClose={() => setShowFontColor(false)}
                onPick={(color) => {
                  withSelection(getSelectionRange, body, (start, end) => commands.setFontColor(start, end, color))();
                }}
              />
            )}
          </div>
          <div className="relative">
            <IconButton
              onClick={() => {
                setShowFontColor(false);
                setShowHighlight(!showHighlight);
              }}
              aria-label="Background color"
              title="Background color"
            >
              <span className="relative inline-block">
                <PaintBucket className="h-3.5 w-3.5" />
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-sm"
                  style={{ background: activeBackgroundColor ?? "currentColor" }}
                />
              </span>
            </IconButton>
            {showHighlight && (
              <ColorPicker
                key={`bg-color-${activeBackgroundColor ?? "auto"}`}
                label="Background color"
                value={activeBackgroundColor}
                open={showHighlight}
                onClose={() => setShowHighlight(false)}
                onPick={(color) => {
                  withSelection(getSelectionRange, body, (start, end) => commands.setBackgroundColor(start, end, color))();
                }}
              />
            )}
          </div>
        </ToolGroup>

        <ToolGroup>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.toggleMark(start, end, "bold"))()}
            aria-label="Bold"
            title="Bold (Ctrl/Cmd+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.toggleMark(start, end, "italic"))()}
            aria-label="Italic"
            title="Italic (Ctrl/Cmd+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.toggleMark(start, end, "underline"))()}
            aria-label="Underline"
            title="Underline (Ctrl/Cmd+U)"
          >
            <Underline className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.toggleMark(start, end, "strikethrough"))()}
            aria-label="Strikethrough"
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <ToolGroup>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.setAlignment(start, end, "left"))()}
            aria-label="Align left"
            title="Align left"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.setAlignment(start, end, "center"))()}
            aria-label="Align center"
            title="Align center"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.setAlignment(start, end, "right"))()}
            aria-label="Align right"
            title="Align right"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <ToolGroup>
          <div className="relative" data-number-format>
            <IconButton onClick={() => setShowNumberFormat(!showNumberFormat)} aria-label="Number format" title="Number format">
              <span className="font-mono text-[10px]">123</span>
            </IconButton>
            {showNumberFormat && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-md">
                {NUMBER_FORMATS.map((format) => (
                  <button
                    key={format.value}
                    type="button"
                    onClick={() => {
                      withSelection(getSelectionRange, body, (start, end) =>
                        commands.setNumberFormat(start, end, format.value as never)
                      )();
                      setShowNumberFormat(false);
                    }}
                    className="block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </ToolGroup>

        <ToolGroup>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.applyBorder(start, end, ["top", "right", "bottom", "left"]))()}
            aria-label="All borders"
            title="All borders"
          >
            <TableProperties className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.clearBorders(start, end))()}
            aria-label="Clear borders"
            title="Clear borders"
          >
            <Eraser className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <ToolGroup>
          <IconButton
            onClick={() => withSelection(getSelectionRange, body, (start, end) => commands.mergeCells(start, end))()}
            aria-label="Merge cells"
            title="Merge cells"
          >
            <Combine className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <ToolGroup>
          <SplitButton
            label="Rows"
            options={[
              { label: "Insert row above", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.insertRows(range[0].row);
              }},
              { label: "Insert row below", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.insertRows(range[1].row + 1);
              }},
              { label: "Duplicate row", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.duplicateRow(range[0].row);
              }},
              { label: "Delete rows", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.deleteRows(range[0].row, range[1].row - range[0].row + 1);
              }},
              { label: "Hide rows", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.hideRows(range[0], range[1]);
              }},
              { label: "Show rows", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.showRows(range[0], range[1]);
              }},
              { label: "Sort A → Z", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.sortRange(range[0], range[1], range[0].column, "asc");
              }},
              { label: "Sort Z → A", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.sortRange(range[0], range[1], range[0].column, "desc");
              }},
            ]}
          />
          <SplitButton
            label="Cols"
            options={[
              { label: "Insert column left", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.insertColumns(range[0].column);
              }},
              { label: "Insert column right", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.insertColumns(range[1].column + 1);
              }},
              { label: "Delete columns", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.deleteColumns(range[0].column, range[1].column - range[0].column + 1);
              }},
              { label: "Hide columns", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.hideColumns(range[0], range[1]);
              }},
              { label: "Show columns", onSelect: () => {
                const range = getSelectionRange();
                if (range) commands.showColumns(range[0], range[1]);
              }},
            ]}
          />
          <SplitButton
            label="View"
            options={[
              { label: "Freeze top row", onSelect: () => commands.setFrozenRows(1) },
              { label: "Freeze first column", onSelect: () => commands.setFrozenColumns(1) },
              { label: "Unfreeze panes", onSelect: () => {
                commands.setFrozenRows(0);
                commands.setFrozenColumns(0);
              }},
            ]}
          />
        </ToolGroup>

        <ToolGroup>
          <IconButton onClick={onFindReplace} aria-label="Find and replace" title="Find and replace (Ctrl/Cmd+F)">
            <Search className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => printSheetDocument(body, { title: "Spreadsheet" })}
            aria-label="Print"
            title="Print"
          >
            <Printer className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={() => void handleExportXlsx()} aria-label="Export XLSX" title="Export XLSX">
            <ArrowDownAZ className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <div className="ml-auto flex items-center gap-1">
          <IconButton onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))} aria-label="Zoom out" title="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </IconButton>
          <span className="min-w-[3rem] text-center text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <IconButton onClick={() => onZoomChange(Math.min(2, zoom + 0.1))} aria-label="Zoom in" title="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-1 py-0.5">{children}</div>;
}

interface IconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  "aria-label": string;
  title?: string;
  children: React.ReactNode;
}

function IconButton({ onClick, disabled, children, title, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        // Preserve the grid's keyboard focus so the user can keep using
        // shortcuts (arrows, copy/paste, etc.) after clicking a button.
        event.preventDefault();
      }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-md px-1.5 text-xs transition-colors hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50"
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function FontFamilySelect({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onMouseDown={(event) => event.preventDefault()}
      className="h-7 rounded border border-border bg-background px-2 text-xs"
      aria-label="Font family"
    >
      {FONT_FAMILIES.map((family) => (
        <option key={family} value={family}>
          {family}
        </option>
      ))}
    </select>
  );
}

function FontSizeSelect({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <select
      value={String(value)}
      onChange={(event) => onChange(Number(event.target.value))}
      onMouseDown={(event) => event.preventDefault()}
      className="h-7 w-16 rounded border border-border bg-background px-2 text-xs"
      aria-label="Font size"
    >
      {FONT_SIZES.map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
    </select>
  );
}

interface SplitButtonProps {
  label: string;
  options: Array<{ label: string; onSelect: () => void }>;
}

function SplitButton({ label, options }: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("mousedown", onClick);
      return () => window.removeEventListener("mousedown", onClick);
    }
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(event) => {
          // Keep grid focus on the open and on the option click.
          event.preventDefault();
        }}
        onClick={() => setOpen(!open)}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent"
      >
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-md">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                option.onSelect();
                setOpen(false);
              }}
              className="block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Find / Replace dialog                                                       */
/* -------------------------------------------------------------------------- */

interface FindReplaceDialogProps {
  open: boolean;
  onClose: () => void;
  onReplace: (search: string, replacement: string, caseSensitive: boolean) => number;
}

export function FindReplaceDialog({ open, onClose, onReplace }: FindReplaceDialogProps) {
  const [search, setSearch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => {
        searchRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;
  return (
    <div
      key={open ? "open" : "closed"}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Find and replace"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Find and replace</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Find</label>
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter") {
                  onReplace(search, replacement, caseSensitive);
                }
              }}
              className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs"
              placeholder="Find in cells"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Replace with</label>
            <input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter") {
                  onReplace(search, replacement, caseSensitive);
                }
              }}
              className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs"
              placeholder="Replacement"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />
            <span>Case sensitive</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onReplace(search, replacement, caseSensitive)}>
              Replace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
