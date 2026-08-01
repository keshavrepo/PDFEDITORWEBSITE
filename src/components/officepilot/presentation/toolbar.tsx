"use client";

/**
 * OfficePilot Presentation toolbar.
 *
 * Slide management (add, duplicate, remove, move), theme picker,
 * transition picker, content block insertion (text, bullets, shapes,
 * images, tables), find/replace, print, export PPTX.
 */

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Plus,
  Printer,
  Search,
  Shapes,
  Table as TableIcon,
  Text,
  Trash2,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRESENTATION_THEMES,
  type PresentationBody,
  type PresentationSlide,
  type PresentationTheme,
  type PresentationTransition,
} from "@/lib/officepilot/presentation/schema";
import type { PresentationEditorCommands } from "./document-model";
import { exportPresentationToPptx } from "@/lib/officepilot/presentation/pptx-export";
import { printPresentationDocument } from "@/lib/officepilot/presentation/text-exporters";

interface PresentationToolbarProps {
  commands: PresentationEditorCommands;
  body: PresentationBody;
  activeSlide: PresentationSlide | null;
  zoom: number;
  onZoomChange: (next: number) => void;
  onFindReplace: () => void;
}

export function PresentationToolbar({
  commands,
  body,
  activeSlide,
  zoom,
  onZoomChange,
  onFindReplace,
}: PresentationToolbarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-menu]")) {
        setOpenMenu(null);
      }
    }
    if (openMenu) {
      window.addEventListener("mousedown", onClick);
      return () => window.removeEventListener("mousedown", onClick);
    }
  }, [openMenu]);

  const handleExportPptx = async () => {
    const blob = await exportPresentationToPptx(body, { title: "Presentation" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${activeSlide?.title ?? "presentation"}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex shrink-0 flex-col border-b border-border bg-card">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1">
        <ToolGroup>
          <IconButton onClick={commands.undo} disabled={!commands.canUndo()} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)">
            <span className="text-xs">↶</span>
          </IconButton>
          <IconButton onClick={commands.redo} disabled={!commands.canRedo()} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)">
            <span className="text-xs">↷</span>
          </IconButton>
        </ToolGroup>

        <ToolGroup>
          <IconButton onClick={() => commands.addSlide()} aria-label="Add slide" title="Add slide (Ctrl/Cmd+Enter)">
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => commands.duplicateSlide(commands.getActiveIndex())}
            aria-label="Duplicate slide"
            title="Duplicate slide"
          >
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => commands.removeSlide(commands.getActiveIndex())}
            aria-label="Delete slide"
            title="Delete slide"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <ToolGroup>
          <DropdownMenu
            label="Theme"
            open={openMenu === "theme"}
            onToggle={() => setOpenMenu(openMenu === "theme" ? null : "theme")}
          >
            {(Object.keys(PRESENTATION_THEMES) as PresentationTheme[]).map((theme) => {
              const palette = PRESENTATION_THEMES[theme];
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => {
                    commands.setTheme(theme);
                    setOpenMenu(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent",
                    body.settings.theme === theme && "bg-accent"
                  )}
                >
                  <span
                    className="inline-block h-3 w-6 rounded-sm border border-border"
                    style={{ background: palette.background.kind === "color" ? palette.background.color : `linear-gradient(135deg, ${palette.background.color}, ${palette.background.color2 ?? palette.background.color})` }}
                    aria-hidden="true"
                  />
                  <span>{palette.name}</span>
                </button>
              );
            })}
          </DropdownMenu>

          <DropdownMenu
            label="Transition"
            open={openMenu === "transition"}
            onToggle={() => setOpenMenu(openMenu === "transition" ? null : "transition")}
          >
            {(["none", "fade", "slide", "zoom", "push"] as PresentationTransition[]).map((transition) => (
              <button
                key={transition}
                type="button"
                onClick={() => {
                  commands.setTransition(commands.getActiveIndex(), transition);
                  setOpenMenu(null);
                }}
                className="block w-full rounded-md px-2 py-1 text-left text-xs capitalize hover:bg-accent"
              >
                {transition}
              </button>
            ))}
          </DropdownMenu>

          <DropdownMenu
            label="Aspect"
            open={openMenu === "aspect"}
            onToggle={() => setOpenMenu(openMenu === "aspect" ? null : "aspect")}
          >
            {(["16:9", "4:3"] as const).map((aspect) => (
              <button
                key={aspect}
                type="button"
                onClick={() => {
                  commands.setDeckAspect(aspect);
                  setOpenMenu(null);
                }}
                className={cn(
                  "block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent",
                  body.settings.aspect === aspect && "bg-accent"
                )}
              >
                {aspect}
              </button>
            ))}
          </DropdownMenu>
        </ToolGroup>

        <ToolGroup>
          <IconButton
            onClick={() => commands.addText(commands.getActiveIndex(), "New text")}
            aria-label="Add text"
            title="Add text"
          >
            <TypeIcon className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => commands.addBullets(commands.getActiveIndex(), [["First item"], ["Second item"]])}
            aria-label="Add bullets"
            title="Add bullets"
          >
            <Text className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add image"
            title="Add image"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => commands.addTable(commands.getActiveIndex(), [["A", "B"], ["1", "2"]])}
            aria-label="Add table"
            title="Add table"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => commands.addShape(commands.getActiveIndex(), "rounded-rectangle", "#0a0a0a")}
            aria-label="Add shape"
            title="Add shape"
          >
            <Shapes className="h-3.5 w-3.5" />
          </IconButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  commands.addImage(commands.getActiveIndex(), reader.result, file.name);
                }
              };
              reader.readAsDataURL(file);
              event.target.value = "";
            }}
          />
        </ToolGroup>

        <ToolGroup>
          <IconButton onClick={onFindReplace} aria-label="Find" title="Find (Ctrl/Cmd+F)">
            <Search className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            onClick={() => printPresentationDocument(body, { title: activeSlide?.title ?? "Presentation" })}
            aria-label="Print"
            title="Print preview"
          >
            <Printer className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={() => void handleExportPptx()} aria-label="Export PPTX" title="Export PPTX">
            <Download className="h-3.5 w-3.5" />
          </IconButton>
        </ToolGroup>

        <div className="ml-auto flex items-center gap-1">
          <span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
            <Layers className="mr-1 inline h-3 w-3" /> {body.slides.length} slides
          </span>
          <IconButton onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))} aria-label="Zoom out">
            <span className="text-xs">−</span>
          </IconButton>
          <span className="min-w-[3rem] text-center text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <IconButton onClick={() => onZoomChange(Math.min(2, zoom + 0.1))} aria-label="Zoom in">
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
        // Keep keyboard focus where the user expects it (a slide
        // title or notes field) so they can keep typing after a click.
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

interface DropdownMenuProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function DropdownMenu({ label, open, onToggle, children }: DropdownMenuProps) {
  return (
    <div className="relative" data-menu>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent"
      >
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-md">
          {children}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Find / replace dialog                                                       */
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
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs"
              placeholder="Find in slides"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Replace with</label>
            <input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
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
