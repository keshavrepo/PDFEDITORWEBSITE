"use client";

/**
 * EMI calculator properties panel. Read-only summary of the inputs,
 * result and schedule metadata.
 */

import { useMemo } from "react";
import {
  evaluateEmi,
  formatCurrency,
  formatPercent,
  readEmiInputs,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function EmiProperties({ calculation }: { calculation: FinanceCalculation }) {
  const inputs = useMemo(
    () => readEmiInputs(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateEmi(calculation), [calculation]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Loan amount" value={formatCurrency(inputs.principal)} />
          <Row label="Interest rate" value={formatPercent(inputs.annualRate)} />
          <Row label="Tenure" value={`${inputs.years} years`} />
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Result
        </h3>
        <ResultLines lines={evaluation.ok ? evaluation.lines : []} />
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Calculation
        </h3>
        <dl className="space-y-1.5">
          <Row label="Title" value={calculation.meta.title} />
          <Row label="Version" value={`v${calculation.meta.version}`} />
          <Row
            label="Last saved"
            value={updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
          />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-mono tabular-nums font-medium">
        {value}
      </dd>
    </div>
  );
}
