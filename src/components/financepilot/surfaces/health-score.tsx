"use client";

/**
 * Financial Health Score surface.
 *
 * Inputs: monthly income, monthly expenses, emergency fund, total
 * debt, monthly debt service, invested amount, insurance policies,
 * active goals and goals on track. Outputs: an overall 0–100 score,
 * a per-category breakdown (Emergency Fund, Debt Ratio, Savings
 * Rate, Investment Ratio, Insurance Coverage, Goal Progress) and a
 * prioritised list of improvement suggestions.
 *
 * The page uses the shared `CalculatorSurface` chrome (header,
 * result, chart) and adds a custom suggestions card below the
 * result row so the user sees the most impactful improvement
 * without scrolling through the per-category detail.
 */

import { useMemo } from "react";
import {
  evaluateHealthScore,
  formatPercent,
  readHealthScoreBody,
  summariseHealthScore,
  type FinanceCalculation,
  type HealthScoreBody,
} from "@/lib/financepilot";
import { CalculatorSurface } from "./shared/surface";
import { NumberField } from "./shared/inputs";
import { BarChart, ChartLegend } from "./shared/chart";
import { Card } from "@/components/ui/card";

interface HealthScoreSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

export function HealthScoreSurface({ calculation, onChange }: HealthScoreSurfaceProps) {
  const inputs = useMemo(
    () => readHealthScoreBody(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateHealthScore(calculation), [calculation]);
  const summary = useMemo(() => summariseHealthScore(inputs), [inputs]);

  function setField(field: keyof HealthScoreBody, value: number) {
    onChange({ ...calculation, body: { ...inputs, [field]: value } });
  }

  return (
    <CalculatorSurface
      calculation={calculation}
      evaluation={evaluation}
      title="Financial Health Score"
      description="Type the monthly income, monthly expenses, emergency fund, total debt, monthly debt service, invested amount, insurance policies, active goals and goals on track. The workspace computes the overall score, the per-category score and the most impactful improvement suggestion."
      toolName="Financial Health Score"
      pdfSubtitle="Financial health score"
      inputSummary={[
        { label: "Overall score", value: `${summary.overall.toFixed(0)} / 100` },
        { label: "Verdict", value: summary.verdict },
        { label: "Suggestions", value: String(summary.suggestions.length) },
      ]}
      inputs={
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Monthly income"
            field="monthlyIncome"
            value={inputs.monthlyIncome}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={1000}
          />
          <NumberField
            label="Monthly expenses"
            field="monthlyExpenses"
            value={inputs.monthlyExpenses}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={1000}
          />
          <NumberField
            label="Emergency fund"
            field="emergencyFund"
            value={inputs.emergencyFund}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={10000}
            hint="Liquid savings available for an emergency."
          />
          <NumberField
            label="Total debt"
            field="totalDebt"
            value={inputs.totalDebt}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={10000}
          />
          <NumberField
            label="Monthly debt service"
            field="monthlyDebtService"
            value={inputs.monthlyDebtService}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={1000}
            hint="Sum of every EMI, interest and minimum payment."
          />
          <NumberField
            label="Invested amount"
            field="investedAmount"
            value={inputs.investedAmount}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={10000}
          />
          <NumberField
            label="Insurance policies"
            field="insurancePolicies"
            value={inputs.insurancePolicies}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={1}
            hint="Number of policies carried (life, health, vehicle, …)."
          />
          <NumberField
            label="Active goals"
            field="activeGoals"
            value={inputs.activeGoals}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={1}
          />
          <NumberField
            label="Goals on track"
            field="goalsOnTrack"
            value={inputs.goalsOnTrack}
            onChange={(field, value) => setField(field as keyof HealthScoreBody, value)}
            step={1}
          />
        </div>
      }
      chart={
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Category scores (0–100)
          </p>
          <BarChart
            series={[
              {
                name: "Score",
                points: summary.categories.map((entry) => ({
                  label: entry.name,
                  value: entry.score,
                })),
              },
            ]}
            ariaLabel="Category scores"
          />
          <ChartLegend series={evaluation.series ?? []} />
        </div>
      }
    />
  );
}

/**
 * Inline suggestions list. Rendered below the calculator surface so
 * the user can scan the most impactful improvement at a glance.
 */
export function HealthScoreSuggestions({ summary }: { summary: ReturnType<typeof summariseHealthScore> }) {
  if (summary.suggestions.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Improvement suggestions
        </h3>
        <p className="text-xs text-muted-foreground">
          Every category is in great shape. Keep doing what you are doing.
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Improvement suggestions
      </h3>
      <ul className="space-y-2 text-xs">
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
      <p className="mt-3 text-[10px] text-muted-foreground">
        Overall score {summary.overall.toFixed(0)} / 100 · verdict {summary.verdict}.
      </p>
    </Card>
  );
}

// Re-export the formatter for the property panel; the runtime is the
// single source of truth for the verdict label.
export { formatPercent };
