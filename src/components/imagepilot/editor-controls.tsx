"use client";

/**
 * Small building blocks shared by every ImagePilot panel.
 *
 * Kept in one file so the panels stay declarative and every control behaves
 * identically — a slider in the adjustments panel and one in the text panel
 * are literally the same component.
 *
 * Styling reuses the existing application tokens (`--border`, `--muted`,
 * `--primary`, the `rounded-xl` radius scale) so the editor looks like part of
 * the same product rather than a bolted-on tool.
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_SWATCHES } from "@/lib/imagepilot/core";

/* -------------------------------------------------------------------------- */
/* Panel scaffolding                                                          */
/* -------------------------------------------------------------------------- */

export function PanelSection({
  title,
  children,
  defaultOpen = true,
  actions,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")}
            aria-hidden="true"
          />
          {title}
        </button>
        {actions}
      </div>
      {open && (
        <div id={contentId} className="space-y-3 px-3 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}

export function FieldRow({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-2 text-xs font-medium text-muted-foreground"
      >
        <span>{label}</span>
        {hint && <span className="text-[10px] tabular-nums text-muted-foreground/70">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Slider                                                                     */
/* -------------------------------------------------------------------------- */

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Value the reset button restores; the button hides when already there. */
  neutral?: number;
  unit?: string;
  disabled?: boolean;
  /** Fired continuously while dragging. */
  onChange: (value: number) => void;
  /** Fired once when the drag finishes, for history bookkeeping. */
  onCommit?: () => void;
}

/**
 * Labelled slider with a numeric field and a reset affordance.
 *
 * The number input lets a user type an exact value, which matters for the
 * adjustments where "-12" is a real answer and hunting for it with a mouse is
 * not. Both inputs write through the same handler so they cannot disagree.
 */
function SliderFieldImpl({
  label,
  value,
  min,
  max,
  step = 1,
  neutral,
  unit,
  disabled,
  onChange,
  onCommit,
}: SliderFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const canReset = neutral !== undefined && Math.abs(value - neutral) > (step ?? 1) / 1000;

  const clamp = useCallback(
    (next: number) => Math.max(min, Math.min(max, next)),
    [min, max]
  );

  // Round for display without changing the stored precision.
  const display = draft ?? (step < 1 ? value.toFixed(2).replace(/\.?0+$/, "") : String(Math.round(value)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${label} value`}
            disabled={disabled}
            value={display}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft !== null) {
                const parsed = Number(draft);
                if (Number.isFinite(parsed)) onChange(clamp(parsed));
                setDraft(null);
                onCommit?.();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setDraft(null);
            }}
            className="h-6 w-14 rounded-md border border-border/60 bg-background px-1.5 text-right text-[11px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          {unit && <span className="w-4 text-[10px] text-muted-foreground">{unit.trim()}</span>}
          <button
            type="button"
            aria-label={`Reset ${label}`}
            title={`Reset ${label}`}
            disabled={disabled || !canReset}
            onClick={() => {
              if (neutral === undefined) return;
              onChange(neutral);
              onCommit?.();
            }}
            className={cn(
              "rounded p-0.5 text-muted-foreground transition-opacity hover:text-foreground",
              !canReset && "pointer-events-none opacity-0"
            )}
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={() => onCommit?.()}
        onKeyUp={() => onCommit?.()}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Numeric input                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Numeric field that only propagates valid values.
 *
 * A local draft is kept while typing so clearing the box does not immediately
 * push `0` into the document — the value commits on blur or Enter.
 */
function NumberFieldImpl({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      let next = parsed;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      onChange(next);
    }
    setDraft(null);
  };

  return (
    <FieldRow label={label} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={draft ?? (Number.isInteger(value) ? value : Math.round(value * 100) / 100)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setDraft(null);
          }}
          className={cn(
            "h-8 w-full rounded-lg border border-border/60 bg-background px-2 text-xs tabular-nums transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            suffix && "pr-7"
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </FieldRow>
  );
}

/* -------------------------------------------------------------------------- */
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <FieldRow label={label} htmlFor={id}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          const match = options.find((option) => String(option.value) === raw);
          if (match) onChange(match.value);
        }}
        className="h-8 w-full rounded-lg border border-border/60 bg-background px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode; title?: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      {label && <span className="block text-xs font-medium text-muted-foreground">{label}</span>}
      <div
        role="group"
        aria-label={label}
        className="flex gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.value}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {option.icon}
            {option.icon ? <span className="sr-only">{option.label}</span> : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toggle                                                                     */
/* -------------------------------------------------------------------------- */

function ToggleFieldImpl({
  label,
  checked,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="flex-1 text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
          style={{ transform: `translateX(${checked ? 18 : 2}px)` }}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Colour                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Colour field combining a native picker, a hex box and the app swatches.
 *
 * The native picker is kept because it is the only way to reach the OS eye
 * dropper, but hex entry is what designers actually use to match a brand
 * colour, so both are offered.
 */
export function ColorField({
  label,
  value,
  disabled,
  onChange,
  onCommit,
  allowNone,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit?: () => void;
  /** Adds a "none" swatch that emits `transparent`. */
  allowNone?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Strip any alpha suffix: <input type="color"> only accepts #rrggbb.
  const pickerValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          aria-label={`${label} swatches`}
          onClick={() => setOpen((state) => !state)}
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg border border-border/60 transition-transform hover:scale-105",
            disabled && "cursor-not-allowed opacity-50"
          )}
          style={
            value === "transparent"
              ? {
                  // Chequerboard reads as "no colour" without needing a label.
                  backgroundImage:
                    "linear-gradient(45deg,#999 25%,transparent 25%),linear-gradient(-45deg,#999 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#999 75%),linear-gradient(-45deg,transparent 75%,#999 75%)",
                  backgroundSize: "8px 8px",
                  backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
                }
              : { backgroundColor: value }
          }
        />
        <input
          id={id}
          type="text"
          spellCheck={false}
          disabled={disabled}
          value={value}
          aria-label={`${label} hex value`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onCommit?.()}
          className="h-8 min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        <input
          type="color"
          disabled={disabled}
          value={pickerValue}
          aria-label={`${label} colour picker`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onCommit?.()}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-border/60 bg-background p-0.5 disabled:opacity-50"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-border bg-popover p-2 shadow-lg">
          <div className="grid grid-cols-8 gap-1">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                title={swatch}
                onClick={() => {
                  onChange(swatch);
                  onCommit?.();
                  setOpen(false);
                }}
                className="h-5 w-5 rounded border border-border/60 transition-transform hover:scale-110"
                style={{ backgroundColor: swatch }}
              />
            ))}
            {allowNone && (
              <button
                type="button"
                aria-label="No colour"
                title="No colour"
                onClick={() => {
                  onChange("transparent");
                  onCommit?.();
                  setOpen(false);
                }}
                className="col-span-2 h-5 rounded border border-border/60 text-[9px] text-muted-foreground transition-colors hover:bg-accent"
              >
                None
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar button                                                             */
/* -------------------------------------------------------------------------- */

function ToolbarButtonImpl({
  icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
  variant = "ghost",
}: {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-foreground text-background"
          : variant === "danger"
            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {icon}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Memoised exports                                                           */
/* -------------------------------------------------------------------------- */

/*
 * The leaf controls are pure functions of their props and appear dozens of
 * times across the inspector. The editor re-renders on every pointer move
 * (the canvas tracks the cursor position), so without memoisation a mouse
 * drag re-rendered every slider, field and button in the panel on each frame.
 *
 * Callers keep the original names; only the identity check is added.
 */
export const SliderField = memo(SliderFieldImpl);
export const NumberField = memo(NumberFieldImpl);
export const ToggleField = memo(ToggleFieldImpl);
export const ToolbarButton = memo(ToolbarButtonImpl);
