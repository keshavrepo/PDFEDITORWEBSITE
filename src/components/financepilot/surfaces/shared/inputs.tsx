"use client";

/**
 * Reusable input controls for every FinancePilot calculator.
 *
 * The four calculators in batch 1 share the same input vocabulary
 * (a loan / investment amount, a percent rate, a tenure in years,
 * and calculator-specific extras). Centralising the controls here
 * means the per-calculator surfaces stay declarative: they describe
 * which fields they need and call a single `setField` callback.
 *
 * Every control is a thin wrapper over a native input so the
 * LaunchStack visual language is consistent across the workspace
 * without any extra primitives.
 */

import { cn } from "@/lib/utils";

interface NumberInputProps {
  /** Visible label, rendered as an uppercase eyebrow above the field. */
  label: string;
  /** Field id used for the aria-label and the onChange key. */
  field: string;
  /** Current value, parsed from the calculation body. */
  value: number;
  /** Optional suffix shown to the right of the field. Defaults to none. */
  suffix?: string;
  /** Optional helper text shown below the field. */
  hint?: string;
  /** Step value for the underlying number input. */
  step?: number;
  /** Minimum allowed value, inclusive. */
  min?: number;
  /** Maximum allowed value, inclusive. */
  max?: number;
  /** Called with the field id and the new numeric value. */
  onChange: (field: string, value: number) => void;
}

/**
 * A numeric input rendered with the LaunchStack label / value / hint
 * rhythm. The value is always a number; the underlying string is
 * formatted with `toString()` so trailing zeros from typed `0.50`
 * are not stripped.
 */
export function NumberField({
  label,
  field,
  value,
  suffix,
  hint,
  step,
  min,
  max,
  onChange,
}: NumberInputProps) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
        {label}
      </span>
      <div
        className={cn(
          "flex h-9 items-center rounded-lg border border-border bg-background px-2 font-mono text-sm",
          "focus-within:ring-2 focus-within:ring-foreground/20"
        )}
      >
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          step={step ?? "any"}
          min={min}
          max={max}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(field, Number.isFinite(next) ? next : 0);
          }}
          aria-label={label}
          className="w-full bg-transparent outline-none"
        />
        {suffix && (
          <span className="ml-1 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Convenience wrapper for percent fields. */
export function PercentField(props: Omit<NumberInputProps, "suffix">) {
  return <NumberField {...props} suffix="%" />;
}

/** Integer field, useful for compounding frequency and similar discrete inputs. */
export function IntegerField(
  props: Omit<NumberInputProps, "step" | "suffix">
) {
  return (
    <NumberField
      {...props}
      step={1}
      onChange={(field, value) => {
        let next = Math.round(value);
        if (typeof props.min === "number") next = Math.max(props.min, next);
        if (typeof props.max === "number") next = Math.min(props.max, next);
        props.onChange(field, next);
      }}
    />
  );
}

interface SelectInputProps<T extends string | number> {
  label: string;
  field: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  onChange: (field: string, value: T) => void;
}

/**
 * A native select with the same label / value rhythm. Native is used so
 * the control works without any extra state, the keyboard accessibility
 * is built in and the visual matches the existing selects in the
 * OfficePilot toolbar.
 *
 * The component is generic over the option value type, so callers can
 * use `SelectField<RiskProfile>` for string-valued selects without
 * having to cast through `unknown` or `Number(...)`.
 */
export function SelectField<T extends string | number>({
  label,
  field,
  value,
  options,
  onChange,
}: SelectInputProps<T>) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
        {label}
      </span>
      <select
        value={String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          const next = (
            typeof options[0]?.value === "number" ? Number(raw) : raw
          ) as T;
          onChange(field, next);
        }}
        aria-label={label}
        className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
