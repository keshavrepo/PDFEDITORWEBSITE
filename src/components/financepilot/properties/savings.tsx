"use client";

/**
 * Savings Planner properties panel. Read-only summary of the goal,
 * the latest projection and the calculation metadata.
 */

import { useMemo } from "react";
import {
  evaluateSavings,
  formatCurrency,
  formatPercent,
  readSavingsBody,
  summariseSavings,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function SavingsProperties({ calculation }: { calculation: FinanceCalculation }) {
  const body = useMemo(() => readSavingsBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateSavings(calculation), [calculation]);
  const summary = useMemo(() => summariseSavings(body), [body]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Goal" value={body.goalName || "—"} />
          <Row label="Target" value={formatCurrency(body.targetAmount)} />
          <Row label="Current" value={formatCurrency(body.currentSavings)} />
          <Row label="Monthly" value={formatCurrency(body.monthlyContribution)} />
          <Row label="Target date" value={body.targetDate || "—"} />
          <Row label="Annual return" value={formatPercent(body.annualReturn)} />
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
          Projection
        </h3>
        <dl className="space-y-1.5">
          <Row
            label="Progress"
            value={formatPercent(Math.max(0, summary.progressFraction * 100))}
          />
          <Row
            label="Months to goal"
            value={Number.isFinite(summary.monthsToGoal) ? String(summary.monthsToGoal) : "—"}
          />
          <Row label="Estimated completion" value={summary.estimatedCompletion} />
          <Row label="On track" value={summary.onTrack ? "Yes" : "No"} />
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
