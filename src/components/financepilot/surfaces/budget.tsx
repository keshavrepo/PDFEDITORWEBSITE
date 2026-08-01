"use client";

/**
 * Budget Planner surface.
 *
 * Inputs: a month and a list of line items grouped by kind
 * (income, fixed, variable). Outputs: total income, total fixed
 * expenses, total variable expenses, remaining budget, a variable
 * spending pie chart and a category breakdown.
 *
 * The list editor is the shared `LineItemList` so the table styling,
 * the add / edit / remove flow and the search affordance are
 * consistent with the other personal-finance modules.
 */

import { useMemo, useState } from "react";
import {
  evaluateBudget,
  readBudgetBody,
  summariseBudget,
  type BudgetBody,
  type BudgetLine,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ListWorkspace } from "./shared/list-surface";
import { LineItemList, type LineItemField } from "./shared/line-item-list";
import { PieChart, ChartLegend } from "./shared/chart";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/financepilot";

interface BudgetSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

const KIND_OPTIONS: Array<{ value: BudgetLine["kind"]; label: string }> = [
  { value: "income", label: "Income" },
  { value: "fixed", label: "Fixed" },
  { value: "variable", label: "Variable" },
];

const BUDGET_FIELDS: LineItemField[] = [
  { field: "kind", label: "Type", type: "select", options: KIND_OPTIONS, required: true },
  { field: "category", label: "Category", type: "text", placeholder: "e.g. Salary" },
  { field: "label", label: "Label", type: "text", required: true },
  { field: "amount", label: "Amount", type: "number", step: 100, required: true },
];

const MONTH_OPTIONS = (() => {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = -3; i <= 9; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    out.push({ value, label });
  }
  return out;
})();

function newLine(): BudgetLine {
  return {
    id: `b-${Math.random().toString(36).slice(2, 8)}`,
    kind: "variable",
    category: "Other",
    label: "",
    amount: 0,
  };
}

export function BudgetSurface({ calculation, onChange }: BudgetSurfaceProps) {
  const body = useMemo(() => readBudgetBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateBudget(calculation), [calculation]);
  const summary = useMemo(() => summariseBudget(body), [body]);
  const [kindFilter, setKindFilter] = useState<"all" | BudgetLine["kind"]>("all");

  function update(next: BudgetBody) {
    onChange({ ...calculation, body: next });
  }
  function setMonth(month: string) {
    update({ ...body, month });
  }
  function setLines(lines: BudgetLine[]) {
    update({ ...body, lines });
  }
  function setRollover(rollover: number) {
    update({ ...body, rollover });
  }

  const visibleLines =
    kindFilter === "all" ? body.lines : body.lines.filter((line) => line.kind === kindFilter);

  return (
    <ListWorkspace
      calculation={calculation}
      evaluation={evaluation}
      title="Budget Planner"
      description="Plan a month of income, fixed and variable expenses. The remaining budget, category breakdown and monthly summary update as you type."
      toolName="Budget Planner"
      pdfSubtitle="Budget planner"
      inputSummary={[
        { label: "Month", value: body.month || "—" },
        { label: "Income", value: formatCurrency(summary.totalIncome) },
        { label: "Fixed expenses", value: formatCurrency(summary.totalFixed) },
        { label: "Variable expenses", value: formatCurrency(summary.totalVariable) },
        {
          label: "Remaining",
          value: formatCurrency(summary.remaining),
        },
      ]}
      chart={
        summary.variableByCategory.length > 0 ? (
          <div className="space-y-3">
            <PieChart
              ariaLabel="Variable spending by category"
              slices={summary.variableByCategory.map((entry) => ({
                label: entry.category,
                value: entry.amount,
              }))}
            />
            <ChartLegend
              series={[
                {
                  name: "Variable spend",
                  points: summary.variableByCategory.map((entry) => ({
                    label: entry.category,
                    value: entry.amount,
                  })),
                },
              ]}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add a variable expense to see the category breakdown.
          </p>
        )
      }
      summary={
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Month
              </span>
              <select
                value={body.month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label="Budget month"
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rollover from last month
              </span>
              <input
                type="number"
                value={body.rollover}
                step={100}
                onChange={(event) => setRollover(Number(event.target.value) || 0)}
                className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-sm"
                aria-label="Rollover"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Filter
              </span>
              <select
                value={kindFilter}
                onChange={(event) =>
                  setKindFilter(event.target.value as "all" | BudgetLine["kind"])
                }
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label="Kind filter"
              >
                <option value="all">All lines</option>
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      }
    >
      <LineItemList<BudgetLine>
        title="Lines"
        description="Each line adds to the monthly summary on the right. Categories help the variable-spending chart group totals."
        items={visibleLines}
        fields={BUDGET_FIELDS}
        createBlank={newLine}
        onChange={(next) => {
          // Preserve kind filter semantics by mapping back to the full list
          if (kindFilter === "all") {
            setLines(next);
          } else {
            const others = body.lines.filter((line) => line.kind !== kindFilter);
            setLines([...others, ...next]);
          }
        }}
        headerSummary={[
          { label: "Income", value: formatCurrency(summary.totalIncome) },
          { label: "Fixed", value: formatCurrency(summary.totalFixed) },
          { label: "Variable", value: formatCurrency(summary.totalVariable) },
        ]}
        totalField="amount"
        searchPlaceholder="Search lines"
        matchSearch={(line, query) =>
          line.label.toLowerCase().includes(query) ||
          line.category.toLowerCase().includes(query)
        }
        emptyMessage="No lines yet. Click Add to create one."
      />
    </ListWorkspace>
  );
}
