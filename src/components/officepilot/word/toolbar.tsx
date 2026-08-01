"use client";

/**
 * OfficePilot Word formatting toolbar.
 *
 * Mounted above the editor canvas. Hosts every formatting action the user
 * can take: font, size, color, marks, alignment, indentation, list style,
 * quote, code, table, image, hyperlink, page break, undo/redo, find/
 * replace, print, zoom, and the document-wide settings (page size,
 * margins, language).
 *
 * The toolbar is a pure consumer of `WordEditorCommands`; it does not own
 * any state. The active marks, heading level, alignment and indent are
 * derived from the current selection so the buttons reflect what would
 * happen if the user clicked them.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code as CodeIcon,
  Image as ImageIcon,
  Indent,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Outdent,
  Printer,
  Quote,
  Redo2,
  Search,
  SquareSplitVertical,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Type,
  Underline,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WordEditorCommands } from "./document-model";
import type { WordAlignment, WordBlock, WordMark } from "@/lib/officepilot/word/schema";

/** Common fonts a user can pick without leaving the toolbar. */
const FONT_FAMILIES = [
  "Inter",
  "Georgia",
  "Times New Roman",
  "Arial",
  "Helvetica",
  "Courier New",
  "JetBrains Mono",
  "system-ui",
];

/** Font sizes a user can pick without leaving the toolbar. */
const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72];

/** Quick colour palette for the font and background colour pickers. */
const COLOR_PALETTE = [
  "#0a0a0a",
  "#525252",
  "#a1a1aa",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#fafafa",
];

/** Toggle button that reflects the active mark on the current block. */
function MarkToggle({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
        active ? "bg-foreground text-background" : "hover:bg-accent text-foreground"
      )}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </button>
  );
}

/** A horizontal separator inside the toolbar. */
function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />;
}

/** A toolbar group with a label for screen readers. */
function Group({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {children}
    </div>
  );
}

interface WordToolbarProps {
  commands: WordEditorCommands;
  body: { settings: { fontFamily: string; fontSize: number; lineSpacing: number; pageNumber: boolean } };
  activeBlock: WordBlock | null;
  zoom: number;
  onZoomChange: (next: number) => void;
  onPrint: () => void;
  onInsertHyperlink: () => void;
  onInsertImage: () => void;
  onFindReplace: () => void;
  /** Reports whether the search dialog is open so the button can reflect it. */
  findOpen: boolean;
}

export function WordToolbar({
  commands,
  body,
  activeBlock,
  zoom,
  onZoomChange,
  onPrint,
  onInsertHyperlink,
  onInsertImage,
  onFindReplace,
  findOpen,
}: WordToolbarProps) {
  // The active formatting is derived from the active block rather than
  // mirrored into state. The state-everywhere pattern is harder to keep
  // consistent and is the cause of the cascading-render lint errors.
  const activeMarks = useMemo<WordMark[]>(() => {
    if (
      !activeBlock ||
      (activeBlock.type !== "paragraph" &&
        activeBlock.type !== "heading" &&
        activeBlock.type !== "quote")
    ) {
      return [];
    }
    const marks = new Set<WordMark>();
    for (const run of activeBlock.runs) for (const mark of run.marks) marks.add(mark);
    return Array.from(marks);
  }, [activeBlock]);

  const activeAlignment = useMemo<WordAlignment>(() => {
    if (!activeBlock) return "left";
    if (
      activeBlock.type === "paragraph" ||
      activeBlock.type === "heading" ||
      activeBlock.type === "quote"
    ) {
      return activeBlock.alignment;
    }
    return "left";
  }, [activeBlock]);

  const activeLevel = useMemo<number | null>(() => {
    if (activeBlock?.type === "heading") return activeBlock.level;
    return null;
  }, [activeBlock]);

  const activeIndent = useMemo<number>(() => {
    if (activeBlock?.type === "paragraph") return activeBlock.indent;
    return 0;
  }, [activeBlock]);

  const activeFontFamily = body.settings.fontFamily;
  const activeFontSize = body.settings.fontSize;

  const toggle = useCallback(
    (mark: WordMark) => {
      commands.toggleMark(mark);
    },
    [commands]
  );

  const applyHeading = useCallback(
    (level: 1 | 2 | 3 | 4 | 5 | 6 | null) => {
      commands.setHeadingLevel(level);
    },
    [commands]
  );

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5"
    >
      <Group label="History">
        <MarkToggle
          active={false}
          onClick={() => commands.undo()}
          label="Undo"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={false}
          onClick={() => commands.redo()}
          label="Redo"
        >
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
      </Group>

      <Divider />

      <Group label="Heading">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium hover:bg-accent"
              aria-label="Style"
            >
              <Type className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{activeLevel ? `Heading ${activeLevel}` : "Paragraph"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onSelect={() => applyHeading(null)}>Paragraph</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyHeading(1)}>Heading 1</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyHeading(2)}>Heading 2</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyHeading(3)}>Heading 3</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyHeading(4)}>Heading 4</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyHeading(5)}>Heading 5</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyHeading(6)}>Heading 6</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Group>

      <Divider />

      <Group label="Font">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs hover:bg-accent"
              aria-label="Font family"
            >
              <span className="max-w-[100px] truncate" style={{ fontFamily: activeFontFamily }}>
                {activeFontFamily}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 max-h-72 overflow-y-auto">
            {FONT_FAMILIES.map((family) => (
              <DropdownMenuItem
                key={family}
                onSelect={() => {
                  commands.setFontFamily(family);
                }}
              >
                <span style={{ fontFamily: family }}>{family}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs hover:bg-accent"
              aria-label="Font size"
            >
              {activeFontSize}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-24 max-h-72 overflow-y-auto">
            {FONT_SIZES.map((size) => (
              <DropdownMenuItem
                key={size}
                onSelect={() => {
                  commands.setFontSize(size);
                }}
              >
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ColourPicker
          label="Font colour"
          onChange={(color) => {
            commands.setColor(color);
          }}
        />
        <HighlightPicker label="Highlight colour" onChange={(color) => commands.setHighlight(color)} />
      </Group>

      <Divider />

      <Group label="Inline marks">
        <MarkToggle
          active={activeMarks.includes("bold")}
          onClick={() => toggle("bold")}
          label="Bold"
        >
          <Bold className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeMarks.includes("italic")}
          onClick={() => toggle("italic")}
          label="Italic"
        >
          <Italic className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeMarks.includes("underline")}
          onClick={() => toggle("underline")}
          label="Underline"
        >
          <Underline className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeMarks.includes("strikethrough")}
          onClick={() => toggle("strikethrough")}
          label="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeMarks.includes("superscript")}
          onClick={() => toggle("superscript")}
          label="Superscript"
        >
          <Superscript className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeMarks.includes("subscript")}
          onClick={() => toggle("subscript")}
          label="Subscript"
        >
          <Subscript className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeMarks.includes("code")}
          onClick={() => toggle("code")}
          label="Inline code"
        >
          <CodeIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
      </Group>

      <Divider />

      <Group label="Alignment">
        <MarkToggle
          active={activeAlignment === "left"}
          onClick={() => commands.setAlignment("left")}
          label="Align left"
        >
          <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeAlignment === "center"}
          onClick={() => commands.setAlignment("center")}
          label="Align center"
        >
          <AlignCenter className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeAlignment === "right"}
          onClick={() => commands.setAlignment("right")}
          label="Align right"
        >
          <AlignRight className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={activeAlignment === "justify"}
          onClick={() => commands.setAlignment("justify")}
          label="Justify"
        >
          <AlignJustify className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
      </Group>

      <Divider />

      <Group label="Indentation">
        <MarkToggle
          active={false}
          onClick={() => commands.setIndent(-1)}
          label="Decrease indent"
        >
          <Outdent className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={false}
          onClick={() => commands.setIndent(1)}
          label="Increase indent"
        >
          <Indent className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs hover:bg-accent"
              aria-label="Line spacing"
            >
              <SquareSplitVertical className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{body.settings.lineSpacing.toFixed(2)}×</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-32">
            {[1, 1.15, 1.5, 2].map((spacing) => (
              <DropdownMenuItem
                key={spacing}
                onSelect={() => commands.setLineSpacing(spacing as 1 | 1.15 | 1.5 | 2)}
              >
                {spacing.toFixed(2)}×
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Group>

      <Divider />

      <Group label="Lists">
        <MarkToggle
          active={false}
          onClick={() => commands.convertToList("unordered")}
          label="Bulleted list"
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={false}
          onClick={() => commands.convertToList("ordered")}
          label="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={false}
          onClick={() => commands.convertToList("checklist")}
          label="Checklist"
        >
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
      </Group>

      <Divider />

      <Group label="Blocks">
        <MarkToggle
          active={false}
          onClick={() => commands.convertToQuote()}
          label="Block quote"
        >
          <Quote className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={false}
          onClick={() => commands.convertToCode()}
          label="Code block"
        >
          <CodeIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs hover:bg-accent"
              aria-label="Insert"
            >
              <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Table</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => commands.insertTable(2, 2)}>2 × 2</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => commands.insertTable(3, 3)}>3 × 3</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => commands.insertTable(3, 4)}>3 × 4</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => commands.insertTable(4, 4)}>4 × 4</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => commands.insertTable(5, 5)}>5 × 5</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => commands.insertTable(6, 8)}>6 × 8</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <MarkToggle
          active={false}
          onClick={onInsertImage}
          label="Insert image"
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={false}
          onClick={onInsertHyperlink}
          label="Insert hyperlink"
        >
          <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle
          active={false}
          onClick={() => commands.insertPageBreak()}
          label="Insert page break"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
      </Group>

      <Divider />

      <Group label="Search">
        <MarkToggle active={findOpen} onClick={onFindReplace} label="Find and replace">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <MarkToggle active={false} onClick={onPrint} label="Print preview">
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
      </Group>

      <Divider />

      <Group label="Zoom">
        <MarkToggle
          active={false}
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
          label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
        <span className="min-w-[44px] text-center text-[11px] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <MarkToggle
          active={false}
          onClick={() => onZoomChange(Math.min(2, zoom + 0.1))}
          label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
        </MarkToggle>
      </Group>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Colour picker                                                              */
/* -------------------------------------------------------------------------- */

function ColourPicker({
  label,
  onChange,
}: {
  label: string;
  onChange: (color: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg px-1.5 text-xs hover:bg-accent"
          aria-label={label}
          title={label}
        >
          <span
            className="block h-4 w-4 rounded border border-border"
            style={{ background: "linear-gradient(180deg,#dc2626 50%,#0a0a0a 50%)" }}
            aria-hidden="true"
          />
          <span className="sr-only">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 p-2">
        <div className="grid grid-cols-6 gap-1">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className="h-6 w-6 rounded border border-border"
              style={{ backgroundColor: color }}
              aria-label={`Colour ${color}`}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HighlightPicker({
  label,
  onChange,
}: {
  label: string;
  onChange: (color: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg px-1.5 text-xs hover:bg-accent"
          aria-label={label}
          title={label}
        >
          <span
            className="block h-4 w-4 rounded border border-border"
            style={{ background: "#fde68a" }}
            aria-hidden="true"
          />
          <span className="sr-only">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 p-2">
        <div className="grid grid-cols-6 gap-1">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className="h-6 w-6 rounded border border-border"
              style={{ backgroundColor: color }}
              aria-label={`Highlight ${color}`}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- */
/* Find and replace dialog                                                    */
/* -------------------------------------------------------------------------- */

interface FindReplaceDialogProps {
  open: boolean;
  onClose: () => void;
  onReplace: (search: string, replacement: string, caseSensitive: boolean) => number;
}

export function FindReplaceDialog({ open, onClose, onReplace }: FindReplaceDialogProps) {
  if (!open) return null;
  return (
    <FindReplaceDialogBody
      key="find-replace"
      onClose={onClose}
      onReplace={onReplace}
    />
  );
}

/** Internal stateful body of the find-and-replace dialog. */
function FindReplaceDialogBody({
  onClose,
  onReplace,
}: {
  onClose: () => void;
  onReplace: FindReplaceDialogProps["onReplace"];
}) {
  const [search, setSearch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const handleReplace = useCallback(() => {
    if (!search) return;
    const count = onReplace(search, replacement, caseSensitive);
    setLastCount(count);
  }, [caseSensitive, onReplace, replacement, search]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Find and replace"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Find and replace</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Find</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the document"
              autoFocus
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Replace with</span>
            <Input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Replacement text"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <span>Case sensitive</span>
          </label>
          {lastCount !== null && (
            <p className="text-xs text-muted-foreground">
              {lastCount === 0
                ? "No matches found."
                : `Replaced ${lastCount} ${lastCount === 1 ? "match" : "matches"}.`}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={handleReplace} disabled={!search}>
              Replace all
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hyperlink dialog                                                            */
/* -------------------------------------------------------------------------- */

interface HyperlinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (href: string | null) => void;
  initial: string;
}

export function HyperlinkDialog({ open, onClose, onSave, initial }: HyperlinkDialogProps) {
  if (!open) return null;
  return (
    <HyperlinkDialogBody
      key={`hyperlink-${initial}`}
      onClose={onClose}
      onSave={onSave}
      initial={initial}
    />
  );
}

/** Internal stateful body of the hyperlink dialog. */
function HyperlinkDialogBody({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  onSave: (href: string | null) => void;
  initial: string;
}) {
  const [href, setHref] = useState(initial);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Insert hyperlink"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Insert hyperlink</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">URL</span>
            <Input
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onSave(null)}>
              Remove link
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onSave(href || null)}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Image dialog                                                                */
/* -------------------------------------------------------------------------- */

interface ImageDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (src: string, alt: string, width: number) => void;
}

export function ImageDialog({ open, onClose, onSave }: ImageDialogProps) {
  if (!open) return null;
  // Remount the body on every open so the inputs reset to their defaults.
  return <ImageDialogBody key="image-open" onClose={onClose} onSave={onSave} />;
}

/** Internal stateful body of the image dialog. */
function ImageDialogBody({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (src: string, alt: string, width: number) => void;
}) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [width, setWidth] = useState(480);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Insert image"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Insert image</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Image URL or data URL</span>
            <Input
              value={src}
              onChange={(event) => setSrc(event.target.value)}
              placeholder="https://… or data:image/png;base64,…"
              autoFocus
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Alt text</span>
            <Input
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="Describe the image"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Width (px)</span>
            <Input
              type="number"
              min={80}
              max={1200}
              value={width}
              onChange={(event) => setWidth(Number(event.target.value) || 480)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onSave(src, alt, width)} disabled={!src}>
              Insert
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
