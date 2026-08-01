"use client";

/**
 * Retirement Planner properties panel. Read-only summary of the
 * inputs, the latest projection and the calculation metadata.
 */

import { useMemo } from "react";
import {
  evaluateRetirement,
  formatCurrency,
  formatPercent,
  readRetirementBody,
  summariseRetirement,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function RetirementProperties({ calculation }: { calculation: FinanceCalculation }) {
  const inputs = useMemo(() => readRetirementBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateRetirement(calculation), [calculation]);
  const summary = useMemo(() => summariseRetirement(inputs), [inputs]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Current age" value={String(inputs.currentAge)} />
          <Row label="Retirement age" value={String(inputs.retirementAge)} />
          <Row label="Current savings" value={formatCurrency(inputs.currentSavings)} />
          <Row label="Monthly contribution" value={formatCurrency(inputs.monthlyContribution)} />
          <Row label="Expected return" value={formatPercent(inputs.expectedReturn)} />
          <Row label="Inflation rate" value={formatPercent(inputs.inflationRate)} />
          <Row label="Years in retirement" value={String(inputs.yearsInRetirement)} />
          <Row label="Replacement ratio" value={formatPercent(inputs.replacementRatio * 100)} />
          <Row label="Current income" value={formatCurrency(inputs.currentIncome)} />
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
          <Row label="Years to retirement" value={String(summary.yearsToRetirement)} />
          <Row label="Corpus at retirement" value={formatCurrency(summary.corpusAtRetirement)} />
          <Row label="Required corpus" value={formatCurrency(summary.requiredCorpus)} />
          <Row label="Surplus / shortfall" value={formatCurrency(summary.surplus)} />
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
