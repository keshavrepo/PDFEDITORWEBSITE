"use client";

/**
 * Goal Planner properties panel. Read-only summary of the latest
 * multi-goal state and the calculation metadata.
 */

import { useMemo } from "react";
import {
  evaluateGoal,
  formatCurrency,
  formatPercent,
  GOAL_PRIORITY_LABELS,
  readGoalBody,
  summariseGoals,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function GoalProperties({ calculation }: { calculation: FinanceCalculation }) {
  const body = useMemo(() => readGoalBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateGoal(calculation), [calculation]);
  const summary = useMemo(() => summariseGoals(body), [body]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Active goals" value={String(summary.totalGoals)} />
          <Row label="High priority" value={String(summary.highPriorityCount)} />
          <Row label="Total target" value={formatCurrency(summary.totalTarget)} />
          <Row label="Total monthly" value={formatCurrency(summary.totalMonthly)} />
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
          Goals
        </h3>
        <ul className="space-y-1.5">
          {summary.goals.map((entry) => (
            <li
              key={entry.goal.id}
              className="space-y-0.5 border-b border-border/40 pb-1.5 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{entry.goal.name}</span>
                <span className="font-mono tabular-nums">
                  {formatPercent(Math.max(0, entry.progress * 100))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>{GOAL_PRIORITY_LABELS[entry.goal.priority]}</span>
                <span>{entry.onTrack ? "On track" : "Behind plan"}</span>
              </div>
            </li>
          ))}
          {summary.goals.length === 0 && (
            <p className="text-muted-foreground">No goals yet.</p>
          )}
        </ul>
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
