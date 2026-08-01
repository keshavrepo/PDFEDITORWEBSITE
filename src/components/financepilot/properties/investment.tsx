"use client";

/**
 * Investment Planner properties panel. Read-only summary of the
 * inputs, the latest projection and the calculation metadata.
 */

import { useMemo } from "react";
import {
  evaluateInvestment,
  formatCurrency,
  formatCurrencyPrecise,
  formatPercent,
  readInvestmentBody,
  summariseInvestment,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function InvestmentProperties({ calculation }: { calculation: FinanceCalculation }) {
  const inputs = useMemo(() => readInvestmentBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateInvestment(calculation), [calculation]);
  const summary = useMemo(() => summariseInvestment(inputs), [inputs]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Goal" value={inputs.goalName || "—"} />
          <Row label="Target" value={formatCurrency(inputs.targetAmount)} />
          <Row label="Time horizon" value={`${inputs.timeHorizon} years`} />
          <Row label="Monthly contribution" value={formatCurrency(inputs.monthlyContribution)} />
          <Row label="Risk profile" value={inputs.riskProfile} />
          <Row
            label="Custom return"
            value={inputs.customReturn === null ? "—" : formatPercent(inputs.customReturn)}
          />
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
          Allocation
        </h3>
        <dl className="space-y-1.5">
          {summary.allocation.map((entry) => (
            <Row
              key={entry.id}
              label={`${entry.name} (${entry.weight}%)`}
              value={formatPercent(entry.expectedReturn)}
            />
          ))}
          {summary.allocation.length === 0 && (
            <p className="text-muted-foreground">No allocation set.</p>
          )}
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Projection
        </h3>
        <dl className="space-y-1.5">
          <Row label="Expected return" value={formatPercent(summary.expectedReturn)} />
          <Row label="Projected value" value={formatCurrency(summary.futureValue)} />
          <Row label="Total contribution" value={formatCurrency(summary.totalContribution)} />
          <Row
            label="Suggested monthly"
            value={formatCurrencyPrecise(summary.suggestedMonthly)}
          />
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
