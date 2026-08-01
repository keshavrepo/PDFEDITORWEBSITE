"use client";

/**
 * Goal Planner surface.
 *
 * Inputs: a list of goals with name, target amount, current amount,
 * target date, monthly contribution, expected return, priority and
 * optional notes. Outputs: per-goal progress and on-track flag, an
 * aggregated total-target / total-current / total-required readout,
 * a high-priority count and a multi-goal progress chart.
 *
 * The page combines the shared `CalculatorSurface` chrome (result
 * card + chart) with a `LineItemList` editor for the goals.
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
  type GoalBody,
  type GoalItem,
  type GoalPriority,
} from "@/lib/financepilot";
import { Card } from "@/components/ui/card";
import { CalculatorSurface } from "./shared/surface";
import { LineItemList, type LineItemField } from "./shared/line-item-list";
import { BarChart, ChartLegend } from "./shared/chart";

interface GoalSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

const PRIORITY_OPTIONS: Array<{ value: GoalPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const GOAL_FIELDS: LineItemField[] = [
  { field: "name", label: "Name", type: "text", required: true },
  { field: "targetAmount", label: "Target amount", type: "number", step: 1000, required: true },
  { field: "currentAmount", label: "Current amount", type: "number", step: 1000 },
  { field: "targetDate", label: "Target date (YYYY-MM-DD)", type: "text", placeholder: "2030-12-31" },
  { field: "monthlyContribution", label: "Monthly contribution", type: "number", step: 500 },
  { field: "expectedReturn", label: "Expected return (%)", type: "number", step: 0.1 },
  {
    field: "priority",
    label: "Priority",
    type: "select",
    options: PRIORITY_OPTIONS,
    required: true,
  },
  { field: "notes", label: "Notes", type: "textarea" },
];

function newGoal(): GoalItem {
  return {
    id: `g-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    targetAmount: 0,
    currentAmount: 0,
    targetDate: "",
    monthlyContribution: 0,
    expectedReturn: 0,
    priority: "medium",
  };
}

export function GoalSurface({ calculation, onChange }: GoalSurfaceProps) {
  const inputs = useMemo(() => readGoalBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateGoal(calculation), [calculation]);
  const summary = useMemo(() => summariseGoals(inputs), [inputs]);

  function setGoals(goals: GoalItem[]) {
    onChange({ ...calculation, body: { goals } satisfies GoalBody });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <CalculatorSurface
        calculation={calculation}
        evaluation={evaluation}
        title="Goal Planner"
        description="Add every financial goal with a target amount, current amount, target date, monthly contribution, expected return and priority. The workspace shows the progress, the on-track flag, the timeline and the monthly requirement for each goal."
        toolName="Goal Planner"
        pdfSubtitle="Goal planner"
        inputSummary={[
          { label: "Active goals", value: String(summary.totalGoals) },
          { label: "Total target", value: formatCurrency(summary.totalTarget) },
          { label: "Total current", value: formatCurrency(summary.totalCurrent) },
          { label: "Total required", value: formatCurrency(summary.totalRequired) },
          { label: "Total monthly", value: formatCurrency(summary.totalMonthly) },
          { label: "High priority", value: String(summary.highPriorityCount) },
          { label: "On track", value: `${summary.onTrackCount} / ${summary.totalGoals}` },
        ]}
        inputs={null}
        chart={
          evaluation.ok && summary.goals.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Goal progress (%)
              </p>
              <BarChart
                series={[
                  {
                    name: "Progress",
                    points: summary.goals.map((entry) => ({
                      label: entry.goal.name,
                      value: Math.round(entry.progress * 1000) / 10,
                    })),
                  },
                ]}
                ariaLabel="Goal progress"
              />
              <ChartLegend series={evaluation.series ?? []} />
            </div>
          ) : null
        }
      />

      <Card className="p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Per-goal status
        </h3>
        {summary.goals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No goals yet.</p>
        ) : (
          <ul className="space-y-3 text-xs">
            {summary.goals.map((entry) => {
              const percent = Math.max(0, entry.progress * 100);
              return (
                <li key={entry.goal.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{entry.goal.name}</span>{" "}
                      <span className="text-muted-foreground">
                        · {GOAL_PRIORITY_LABELS[entry.goal.priority]} priority
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono tabular-nums">
                        {formatCurrency(entry.goal.currentAmount)} / {formatCurrency(entry.goal.targetAmount)}
                      </span>{" "}
                      <span className="text-muted-foreground">· {formatPercent(percent)}</span>
                    </div>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full border border-border bg-background"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(percent)}
                    aria-label={`${entry.goal.name} progress`}
                  >
                    <div
                      className="h-full bg-foreground"
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {entry.goal.targetDate
                        ? `Target: ${entry.goal.targetDate}`
                        : "No target date"}
                    </span>
                    <span>
                      {Number.isFinite(entry.monthsToGoal)
                        ? `${entry.monthsToGoal} months to goal · ${entry.onTrack ? "On track" : "Behind plan"}`
                        : "Not on track"}
                    </span>
                    <span>Est. completion {entry.estimatedCompletion}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <LineItemList<GoalItem>
        title="Goals"
        description="Each goal gets its own progress bar, on-track flag and estimated completion date."
        items={inputs.goals}
        fields={GOAL_FIELDS}
        createBlank={newGoal}
        onChange={setGoals}
        headerSummary={[
          { label: "Total target", value: formatCurrency(summary.totalTarget) },
          { label: "Required", value: formatCurrency(summary.totalRequired) },
        ]}
        totalField="targetAmount"
        searchPlaceholder="Search goals"
        matchSearch={(goal, query) =>
          goal.name.toLowerCase().includes(query) ||
          goal.priority.toLowerCase().includes(query) ||
          (goal.notes ?? "").toLowerCase().includes(query)
        }
        emptyMessage="No goals yet. Click Add to create one."
      />
    </div>
  );
}
