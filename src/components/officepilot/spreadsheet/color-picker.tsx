"use client";

/**
 * OfficePilot Spreadsheet color picker.
 *
 * Excel-style popup: a Current / New colour preview, a 10×6 grid of
 * theme colours and standard colours, a hex input that applies on Enter
 * or blur, and an "Automatic" reset. Closes on Escape or outside click.
 *
 * Used by the toolbar's font and background colour buttons.
 */

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Theme colours: a 6×5 grid of greys + brand hues. The first row is
 * white → black so the user has the standard Excel "Automatic" ladder;
 * the remaining rows are saturated colours at descending lightness.
 */
const THEME_COLORS: string[] = [
  "#ffffff", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373",
  "#525252", "#404040", "#262626", "#171717", "#0a0a0a", "#000000",
  "#fef2f2", "#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#dc2626",
  "#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#ea580c",
  "#fefce8", "#fef9c3", "#fef08a", "#fde047", "#facc15", "#ca8a04",
  "#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#16a34a",
  "#ecfeff", "#cffafe", "#a5f3fc", "#67e8f9", "#22d3ee", "#0891b2",
  "#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#2563eb",
  "#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5",
  "#f5f3ff", "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#7c3aed",
  "#fdf4ff", "#fae8ff", "#f5d0fe", "#f0abfc", "#e879f9", "#c026d3",
  "#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#db2777",
];

export type ColorPickerValue = string | "automatic" | null;

interface ColorPickerProps {
  /** Current value of the cell. `null` means "Automatic" (no colour). */
  value: string | null;
  /** Caption above the swatches (e.g. "Font color"). */
  label: string;
  /** Whether the popup is open. */
  open: boolean;
  /** Close callback. */
  onClose: () => void;
  /** Commit a colour (or "automatic" to clear). */
  onPick: (color: string | null) => void;
  /** Side the popup should anchor to. */
  align?: "left" | "right";
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#?[0-9a-fA-F]{3}$/.test(trimmed)) {
    const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return `${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return hex.toLowerCase();
  }
  if (/^#?[0-9a-fA-F]{8}$/.test(trimmed)) {
    const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return hex.toLowerCase();
  }
  return null;
}

export function ColorPicker({ value, label, open, onClose, onPick, align = "left" }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // Track the user's typed hex separately from the current value so the
  // input doesn't fight the user as they type. Initialised from the
  // current value; the parent is expected to remount this component
  // (via a `key` prop) when the underlying cell colour changes.
  const [draftHex, setDraftHex] = useState<string>(
    value && value !== "automatic" ? value : ""
  );

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Focus the hex input on open for keyboard-driven entry.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const current = value && value !== "automatic" ? value : null;
  const preview = hover ?? current ?? "#ffffff";

  function commitHex(input: string) {
    const normalized = normalizeHex(input);
    if (normalized) {
      onPick(normalized);
      onClose();
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={cn(
        "absolute top-full z-50 mt-1 w-[228px] rounded-lg border border-border bg-popover p-2 shadow-2xl",
        align === "right" ? "right-0" : "left-0"
      )}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close color picker"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Current / New preview row. */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5">
          <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">Current</span>
          <span
            aria-hidden="true"
            className="h-5 w-8 rounded border border-border"
            style={{ background: current ?? "transparent", backgroundImage: current ? undefined : "linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 50%, #e5e5e5 50%, #e5e5e5 75%, transparent 75%)", backgroundSize: "8px 8px" }}
          />
        </div>
        <div className="flex flex-1 items-center gap-1.5">
          <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">New</span>
          <span
            aria-hidden="true"
            className="h-5 w-8 rounded border border-border"
            style={{ background: preview, backgroundImage: hover ? undefined : "linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 50%, #e5e5e5 50%, #e5e5e5 75%, transparent 75%)", backgroundSize: "8px 8px" }}
          />
        </div>
      </div>

      {/* Swatch grid. */}
      <div
        className="grid grid-cols-6 gap-1"
        role="grid"
        aria-label={`${label} palette`}
      >
        {THEME_COLORS.map((color) => {
          const isCurrent = current === color;
          return (
            <button
              key={color}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHover(color)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                onPick(color);
                onClose();
              }}
              className={cn(
                "h-5 w-5 rounded border border-border transition-transform",
                isCurrent && "ring-2 ring-foreground/60"
              )}
              style={{ backgroundColor: color }}
              aria-label={`Color ${color}`}
              title={color}
            />
          );
        })}
      </div>

      {/* Hex input + Automatic reset. */}
      <div className="mt-2 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hex</span>
        <input
          ref={inputRef}
          value={draftHex}
          onChange={(event) => setDraftHex(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitHex((event.target as HTMLInputElement).value);
            }
          }}
          onBlur={(event) => {
            if (draftHex && normalizeHex(draftHex)) {
              commitHex(draftHex);
            }
            // Avoid swallowing the next focus target; the popup is
            // dismissed on outside click already.
            void event;
          }}
          placeholder="#000000"
          spellCheck={false}
          className="h-7 flex-1 rounded border border-border bg-background px-2 font-mono text-[11px] uppercase outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          aria-label="Hex color"
        />
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onPick(null);
            onClose();
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Reset to automatic"
          title="Reset to automatic (no color)"
        >
          Automatic
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
