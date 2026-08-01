"use client";

/**
 * Financial Dashboard properties panel. Read-only summary of the
 * latest dashboard state and the calculation metadata.
 */

import { useMemo } from "react";
import {
  evaluateDashboard,
  formatCurrency,
  formatPercent,
  readDashboardBody,
  summariseDashboard,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function DashboardProperties({ calculation }: { calculation: FinanceCalculation }) {
  const body = useMemo(() => readDashboardBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateDashboard(calculation), [calculation]);
  const summary = useMemo(() => summariseDashboard(body), [body]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;
  const budgetLabel =
    summary.budgetStatus === "surplus"
      ? "Surplus"
      : summary.budgetStatus === "deficit"
        ? "Deficit"
        : "Balanced";

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Total assets" value={formatCurrency(body.totalAssets)} />
          <Row label="Total liabilities" value={formatCurrency(body.totalLiabilities)} />
          <Row label="Monthly income" value={formatCurrency(body.monthlyIncome)} />
          <Row label="Monthly expenses" value={formatCurrency(body.monthlyExpenses)} />
          <Row label="Monthly savings" value={formatCurrency(body.monthlySavings)} />
          <Row label="Active goals" value={String(body.activeGoals)} />
          <Row label="Total invested" value={formatCurrency(body.totalInvested)} />
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
          Summary
        </h3>
        <dl className="space-y-1.5">
          <Row label="Net worth" value={formatCurrency(summary.netWorth)} />
          <Row label="Savings rate" value={formatPercent(Math.max(0, summary.savingsRate * 100))} />
          <Row label="Budget status" value={budgetLabel} />
          <Row
            label="Investment coverage"
            value={formatPercent(Math.max(0, Math.min(1, summary.investmentCoverage) * 100))}
          />
          <Row label="Insights" value={String(body.insights.length)} />
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
