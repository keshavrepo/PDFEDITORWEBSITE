"use client";

/**
 * Investment Planner surface.
 *
 * Inputs: goal name, target amount, time horizon, monthly
 * contribution, risk profile, an optional custom return and an
 * allocation list (name, weight, expected return). Outputs:
 * portfolio expected return, projected value, total contribution,
 * estimated returns, progress, suggested monthly contribution,
 * on-track flag, allocation pie and a yearly projection.
 *
 * The page combines the shared `CalculatorSurface` chrome (header,
 * result, chart) with the `LineItemList` editor for the allocation
 * breakdown and a separate inputs card for the goal-level fields.
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
  type InvestmentBody,
  type RiskProfile,
} from "@/lib/financepilot";
import { Card } from "@/components/ui/card";
import { CalculatorSurface } from "./shared/surface";
import { NumberField, PercentField, SelectField } from "./shared/inputs";
import { LineChart, ChartLegend, PieChart } from "./shared/chart";
import { LineItemList, type LineItemField } from "./shared/line-item-list";

interface InvestmentSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

const RISK_OPTIONS: Array<{ value: RiskProfile; label: string }> = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
];

const ALLOCATION_FIELDS: LineItemField[] = [
  { field: "name", label: "Asset class", type: "text", required: true },
  { field: "weight", label: "Weight (%)", type: "number", step: 5, required: true },
  {
    field: "expectedReturn",
    label: "Expected return (%)",
    type: "number",
    step: 0.1,
    required: true,
  },
];

function newAllocation(): InvestmentBody["allocation"][number] {
  return {
    id: `al-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    weight: 0,
    expectedReturn: 0,
  };
}

export function InvestmentSurface({ calculation, onChange }: InvestmentSurfaceProps) {
  const inputs = useMemo(
    () => readInvestmentBody(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateInvestment(calculation), [calculation]);
  const summary = useMemo(() => summariseInvestment(inputs), [inputs]);

  function setField<K extends keyof InvestmentBody>(field: K, value: InvestmentBody[K]) {
    onChange({ ...calculation, body: { ...inputs, [field]: value } });
  }
  function setAllocation(allocation: InvestmentBody["allocation"]) {
    onChange({ ...calculation, body: { ...inputs, allocation } });
  }

  const totalWeight = inputs.allocation.reduce((acc, entry) => acc + entry.weight, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <CalculatorSurface
        calculation={calculation}
        evaluation={evaluation}
        title="Investment Planner"
        description="Type a goal name, target amount, time horizon, monthly contribution, risk profile and an optional custom return. The workspace computes the portfolio expected return, the projected value, the progress, the suggested monthly contribution, the on-track flag, a yearly projection and an allocation breakdown."
        toolName="Investment Planner"
        pdfSubtitle="Investment planner"
        inputSummary={[
          { label: "Goal", value: inputs.goalName || "—" },
          { label: "Target", value: formatCurrency(inputs.targetAmount) },
          { label: "Time horizon", value: `${inputs.timeHorizon} years` },
          { label: "Monthly contribution", value: formatCurrency(inputs.monthlyContribution) },
          { label: "Risk profile", value: inputs.riskProfile[0]!.toUpperCase() + inputs.riskProfile.slice(1) },
          { label: "Custom return", value: inputs.customReturn === null ? "—" : formatPercent(inputs.customReturn) },
        ]}
        inputs={
          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Goal name
              </span>
              <input
                type="text"
                value={inputs.goalName}
                onChange={(event) => setField("goalName", event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label="Goal name"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Target amount"
                field="targetAmount"
                value={inputs.targetAmount}
                onChange={(field, value) =>
                  setField(field as keyof InvestmentBody, value)
                }
                step={10000}
              />
              <NumberField
                label="Time horizon (years)"
                field="timeHorizon"
                value={inputs.timeHorizon}
                onChange={(field, value) =>
                  setField(field as keyof InvestmentBody, value)
                }
                step={1}
              />
              <NumberField
                label="Monthly contribution"
                field="monthlyContribution"
                value={inputs.monthlyContribution}
                onChange={(field, value) =>
                  setField(field as keyof InvestmentBody, value)
                }
                step={500}
              />
              <SelectField<RiskProfile>
                label="Risk profile"
                field="riskProfile"
                value={inputs.riskProfile}
                options={RISK_OPTIONS}
                onChange={(field, value) =>
                  setField(field as keyof InvestmentBody, value)
                }
              />
              <PercentField
                label="Custom return (overrides allocation)"
                field="customReturn"
                value={inputs.customReturn ?? 0}
                onChange={(field, value) => setField("customReturn", value || null)}
                step={0.1}
              />
            </div>
          </div>
        }
        chart={
          evaluation.series && summary.yearly.length > 0 ? (
            <div className="space-y-4">
              <div>
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
                  ariaLabel="Investment projection"
                />
                <ChartLegend series={evaluation.series.slice(0, 2)} />
              </div>
              {summary.allocation.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Allocation
                  </p>
                  <PieChart
                    ariaLabel="Asset allocation"
                    slices={summary.allocation.map((entry) => ({
                      label: entry.name,
                      value: entry.weight,
                    }))}
                  />
                </div>
              )}
            </div>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_1.2fr)]">
        <Card className="p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Allocation summary
          </h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Total weight</dt>
              <dd
                className={
                  Math.abs(totalWeight - 100) < 0.01
                    ? "font-mono tabular-nums font-medium"
                    : "font-mono tabular-nums font-medium text-foreground"
                }
              >
                {totalWeight.toFixed(0)}%
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Weighted return</dt>
              <dd className="font-mono tabular-nums font-medium">
                {formatPercent(summary.expectedReturn)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Projected value</dt>
              <dd className="font-mono tabular-nums font-medium">
                {formatCurrency(summary.futureValue)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Suggested monthly</dt>
              <dd className="font-mono tabular-nums font-medium">
                {formatCurrencyPrecise(summary.suggestedMonthly)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">On track</dt>
              <dd className="font-mono tabular-nums font-medium">
                {summary.onTrack ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
        </Card>
        <LineItemList<InvestmentBody["allocation"][number]>
          title="Allocation"
          description="Each row adds an asset class with a weight and an expected return. The weighted average drives the projection."
          items={inputs.allocation}
          fields={ALLOCATION_FIELDS}
          createBlank={newAllocation}
          onChange={setAllocation}
          totalField="weight"
          emptyMessage="Add an asset class to start."
        />
      </div>
    </div>
  );
}
