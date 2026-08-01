"use client";

/**
 * Expense Tracker properties panel. Read-only summary of the latest
 * list, the monthly total and the calculation metadata.
 */

import { useMemo } from "react";
import {
  evaluateExpense,
  formatCurrency,
  readExpenseBody,
  summariseExpenses,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function ExpenseProperties({ calculation }: { calculation: FinanceCalculation }) {
  const body = useMemo(() => readExpenseBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateExpense(calculation), [calculation]);
  const summary = useMemo(() => summariseExpenses(body.expenses), [body.expenses]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Month" value={body.month || "—"} />
          <Row label="Entries" value={String(summary.count)} />
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
          Top categories
        </h3>
        <dl className="space-y-1.5">
          {summary.byCategory.slice(0, 5).map((entry) => (
            <Row key={entry.category} label={entry.category} value={formatCurrency(entry.amount)} />
          ))}
          {summary.byCategory.length === 0 && (
            <p className="text-muted-foreground">No entries yet.</p>
          )}
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
