"use client";

/**
 * Budget Planner properties panel. Read-only summary of the inputs
 * and the latest result.
 */

import { useMemo } from "react";
import {
  evaluateBudget,
  formatCurrency,
  readBudgetBody,
  summariseBudget,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function BudgetProperties({ calculation }: { calculation: FinanceCalculation }) {
  const body = useMemo(() => readBudgetBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateBudget(calculation), [calculation]);
  const summary = useMemo(() => summariseBudget(body), [body]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;
  const lineCount = body.lines.length;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Month" value={body.month || "—"} />
          <Row label="Lines" value={String(lineCount)} />
          <Row label="Rollover" value={formatCurrency(body.rollover)} />
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
          Spending
        </h3>
        <dl className="space-y-1.5">
          <Row label="Income" value={formatCurrency(summary.totalIncome)} />
          <Row label="Fixed" value={formatCurrency(summary.totalFixed)} />
          <Row label="Variable" value={formatCurrency(summary.totalVariable)} />
          <Row label="Remaining" value={formatCurrency(summary.remaining)} />
        </dl>
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
      <dd className="truncate text-right font-mono tabular-nums font-medium">{value}</dd>
    </div>
  );
}
