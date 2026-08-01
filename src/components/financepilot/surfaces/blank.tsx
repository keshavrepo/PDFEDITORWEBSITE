"use client";

/**
 * OfficePilot-style FinancePilot surface stub.
 *
 * The foundation intentionally ships without calculators, so the blank
 * surface is a minimal but real editor that future calculators can clone
 * and customise. It renders a simple inputs/result layout that the
 * engine will evaluate once calculators register an `evaluate` function
 * with the registry.
 *
 * Future calculators replace this file with their own surface; the
 * workspace shell hosts the same chrome regardless of which one is
 * mounted.
 */

import { useMemo, useState } from "react";
import { evaluate, type FinanceCalculation, type FinanceEvaluation } from "@/lib/financepilot";
import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BlankSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

/**
 * A minimal "blank" surface that demonstrates the contract every future
 * surface must implement: accept a calculation, render the body so the
 * user can edit it, and call `onChange` with the new body so the shell's
 * autosave loop picks it up.
 *
 * It is intentionally tiny — the goal is to prove the workspace shell
 * end-to-end before the first real calculator lands.
 */
export function BlankSurface({ calculation, onChange }: BlankSurfaceProps) {
  const inputs = useMemo(() => readInputs(calculation.body), [calculation.body]);
  const [localValue, setLocalValue] = useState("0");

  const evaluation: FinanceEvaluation = useMemo(
    () => evaluate(calculation, inputs),
    [calculation, inputs]
  );

  function updateInput(field: string, value: string) {
    const next = { ...inputs, [field]: value };
    const body: Record<string, unknown> =
      calculation.body && typeof calculation.body === "object"
        ? { ...(calculation.body as Record<string, unknown>) }
        : {};
    onChange({
      ...calculation,
      body: { ...body, inputs: next },
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Inputs
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          The first real calculator lands in the next batch. This blank
          surface proves the workspace chrome: edits autosave, the
          shell reports save state, and the engine returns a structured
          result.
        </p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Sample value</span>
          <input
            type="number"
            inputMode="decimal"
            value={localValue}
            onChange={(event) => {
              setLocalValue(event.target.value);
              updateInput("amount", event.target.value);
            }}
            className="h-9 rounded border border-border bg-background px-2 font-mono text-sm"
            aria-label="Sample value"
          />
        </label>
      </Card>

      <Card className="p-4">
        <div className="mb-3 text-sm font-semibold">Result</div>
        {evaluation.ok ? (
          <dl className="space-y-1.5 text-xs">
            {evaluation.lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="tabular-nums font-medium">{line.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            {evaluation.error ?? "The engine has no result for this body yet."}
          </p>
        )}
      </Card>
    </div>
  );
}

/** Reads the input map from a calculation body, defaulting to an empty map. */
function readInputs(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const candidate = (body as { inputs?: unknown }).inputs;
  if (!candidate || typeof candidate !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number") {
      result[key] = String(value);
    }
  }
  return result;
}
