"use client";

/**
 * Financial Health Score properties panel. Read-only summary of
 * the inputs, the latest score and the calculation metadata.
 */

import { useMemo } from "react";
import {
  evaluateHealthScore,
  readHealthScoreBody,
  summariseHealthScore,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function HealthScoreProperties({ calculation }: { calculation: FinanceCalculation }) {
  const inputs = useMemo(
    () => readHealthScoreBody(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateHealthScore(calculation), [calculation]);
  const summary = useMemo(() => summariseHealthScore(inputs), [inputs]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Monthly income" value={formatCompact(inputs.monthlyIncome)} />
          <Row label="Monthly expenses" value={formatCompact(inputs.monthlyExpenses)} />
          <Row label="Emergency fund" value={formatCompact(inputs.emergencyFund)} />
          <Row label="Total debt" value={formatCompact(inputs.totalDebt)} />
          <Row
            label="Monthly debt service"
            value={formatCompact(inputs.monthlyDebtService)}
          />
          <Row label="Invested amount" value={formatCompact(inputs.investedAmount)} />
          <Row label="Insurance policies" value={String(inputs.insurancePolicies)} />
          <Row label="Active goals" value={String(inputs.activeGoals)} />
          <Row label="Goals on track" value={String(inputs.goalsOnTrack)} />
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
          Categories
        </h3>
        <dl className="space-y-1.5">
          {summary.categories.map((entry) => (
            <Row
              key={entry.name}
              label={`${entry.name} (${entry.verdict})`}
              value={`${entry.score.toFixed(0)} / 100`}
            />
          ))}
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Suggestions
        </h3>
        {summary.suggestions.length === 0 ? (
          <p className="text-muted-foreground">No suggestions.</p>
        ) : (
          <ul className="space-y-1.5 text-foreground">
            {summary.suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion}-${index}`}
                className="flex items-start gap-2"
              >
                <span className="font-mono tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        )}
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

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
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
