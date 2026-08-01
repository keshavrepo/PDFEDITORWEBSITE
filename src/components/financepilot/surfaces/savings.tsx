"use client";

/**
 * Savings Planner surface.
 *
 * Inputs: goal name, target amount, current savings, monthly
 * contribution, target date and an optional annual return. Outputs:
 * progress percentage, months remaining, months to goal, estimated
 * completion date, on-track flag and a yearly projection of the
 * balance.
 *
 * The progress bar is a pure-CSS element so the visual stays
 * consistent with the rest of the workspace. The yearly chart is the
 * shared `LineChart`.
 */

import { useMemo } from "react";
import {
  evaluateSavings,
  formatCurrency,
  formatPercent,
  readSavingsBody,
  summariseSavings,
  type FinanceCalculation,
  type SavingsBody,
} from "@/lib/financepilot";
import { ListWorkspace } from "./shared/list-surface";
import { Card } from "@/components/ui/card";
import { LineChart, ChartLegend } from "./shared/chart";

interface SavingsSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

export function SavingsSurface({ calculation, onChange }: SavingsSurfaceProps) {
  const body = useMemo(() => readSavingsBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateSavings(calculation), [calculation]);
  const summary = useMemo(() => summariseSavings(body), [body]);

  function setField(field: keyof SavingsBody, value: string | number) {
    onChange({ ...calculation, body: { ...body, [field]: value } });
  }

  const progressPercent = Math.max(0, Math.min(100, summary.progressFraction * 100));
  const status =
    body.targetAmount <= 0
      ? "Set a target amount"
      : body.currentSavings >= body.targetAmount
        ? "Goal reached"
        : summary.onTrack
          ? "On track"
          : "Behind plan";

  return (
    <ListWorkspace
      calculation={calculation}
      evaluation={evaluation}
      title="Savings Planner"
      description="Set a savings goal, current savings and a monthly contribution. The progress, months to goal, estimated completion date and yearly projection update as you type."
      toolName="Savings Planner"
      pdfSubtitle="Savings planner"
      inputSummary={[
        { label: "Goal", value: body.goalName || "—" },
        { label: "Target", value: formatCurrency(body.targetAmount) },
        { label: "Current", value: formatCurrency(body.currentSavings) },
        { label: "Monthly", value: formatCurrency(body.monthlyContribution) },
        { label: "Target date", value: body.targetDate || "—" },
        { label: "Annual return", value: formatPercent(body.annualReturn) },
      ]}
      chart={
        summary.yearly.length > 0 ? (
          <div className="space-y-3">
            <LineChart
              series={[
                {
                  name: "Cumulative contribution",
                  points: summary.yearly.map((entry) => ({
                    label: `Year ${entry.year}`,
                    value: entry.contributed,
                  })),
                },
                {
                  name: "Projected balance",
                  points: summary.yearly.map((entry) => ({
                    label: `Year ${entry.year}`,
                    value: entry.balance,
                  })),
                },
              ]}
              ariaLabel="Yearly savings projection"
            />
            <ChartLegend series={evaluation.series ?? []} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add a positive monthly contribution to see the projection.
          </p>
        )
      }
    >
      <Card className="p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Progress
        </h3>
        <div className="mb-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {formatCurrency(body.currentSavings)} of {formatCurrency(body.targetAmount)}
          </span>
          <span className="font-mono tabular-nums font-medium">
            {progressPercent.toFixed(1)}%
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full border border-border bg-background"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercent)}
          aria-label="Goal progress"
        >
          <div
            className="h-full bg-foreground"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p
          className={
            "mt-3 text-xs " +
            (body.targetAmount <= 0
              ? "text-muted-foreground"
              : body.currentSavings >= body.targetAmount
                ? "text-foreground"
                : summary.onTrack
                  ? "text-muted-foreground"
                  : "text-foreground")
          }
        >
          {status}
          {body.targetAmount > 0 && body.currentSavings < body.targetAmount
            ? ` · ~${summary.monthsToGoal} months to goal at the current contribution`
            : ""}
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Goal
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Goal name
            </span>
            <input
              type="text"
              value={body.goalName}
              onChange={(event) => setField("goalName", event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              aria-label="Goal name"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Target amount
            </span>
            <input
              type="number"
              value={body.targetAmount}
              step={1000}
              onChange={(event) =>
                setField("targetAmount", Number(event.target.value) || 0)
              }
              className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-sm"
              aria-label="Target amount"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current savings
            </span>
            <input
              type="number"
              value={body.currentSavings}
              step={1000}
              onChange={(event) =>
                setField("currentSavings", Number(event.target.value) || 0)
              }
              className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-sm"
              aria-label="Current savings"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly contribution
            </span>
            <input
              type="number"
              value={body.monthlyContribution}
              step={500}
              onChange={(event) =>
                setField("monthlyContribution", Number(event.target.value) || 0)
              }
              className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-sm"
              aria-label="Monthly contribution"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Target date
            </span>
            <input
              type="date"
              value={body.targetDate}
              onChange={(event) => setField("targetDate", event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              aria-label="Target date"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Annual return (%)
            </span>
            <input
              type="number"
              value={body.annualReturn}
              step={0.1}
              onChange={(event) =>
                setField("annualReturn", Number(event.target.value) || 0)
              }
              className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-sm"
              aria-label="Annual return"
            />
          </label>
        </div>
      </Card>
    </ListWorkspace>
  );
}
