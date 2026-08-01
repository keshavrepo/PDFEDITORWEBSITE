"use client";

/**
 * Blank surface — fallback for any calculator kind that has not been
 * wired up to a real surface yet.
 *
 * Batch 1 ships four real calculator surfaces (EMI, SIP, compound
 * interest, loan). This component is the safety net: if a future
 * calculator descriptor is added without a matching surface, the
 * workspace shell still mounts something usable.
 */

import type { FinanceCalculation } from "@/lib/financepilot";
import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BlankSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

/**
 * A minimal "blank" surface that demonstrates the contract every future
 * surface must implement: accept a calculation, render the body so
 * the user can edit it, and call `onChange` with the new body so the
 * shell's autosave loop picks it up.
 */
export function BlankSurface({ calculation, onChange }: BlankSurfaceProps) {
  function updateInput(field: string, value: string) {
    const body: Record<string, unknown> =
      calculation.body && typeof calculation.body === "object"
        ? { ...(calculation.body as Record<string, unknown>) }
        : {};
    onChange({ ...calculation, body: { ...body, inputs: { ...(body.inputs as Record<string, unknown> | undefined), [field]: value } } });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Inputs
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          This calculator kind does not have a dedicated surface yet.
          Pick a different calculator from the rail, or add one to the
          FinancePilot foundation.
        </p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Sample value</span>
          <input
            type="text"
            onChange={(event) => updateInput("amount", event.target.value)}
            className="h-9 rounded border border-border bg-background px-2 font-mono text-sm"
            aria-label="Sample value"
          />
        </label>
      </Card>
    </div>
  );
}
