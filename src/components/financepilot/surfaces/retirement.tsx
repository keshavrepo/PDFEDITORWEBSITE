"use client";

/**
 * Retirement Planner surface.
 *
 * Inputs: current age, retirement age, current savings, monthly
 * contribution, expected return, inflation rate, years in retirement,
 * replacement ratio and current income. Outputs: years to retirement,
 * corpus at retirement, required corpus, inflation-adjusted corpus,
 * estimated monthly income, surplus/shortfall, on-track flag and a
 * yearly projection.
 *
 * The chrome (header, result card, chart card, schedule card) is the
 * shared `CalculatorSurface`; the form lives in the inputs card.
 */

import { useMemo } from "react";
import {
  evaluateRetirement,
  formatCurrency,
  formatPercent,
  readRetirementBody,
  summariseRetirement,
  type FinanceCalculation,
  type RetirementBody,
} from "@/lib/financepilot";
import { CalculatorSurface } from "./shared/surface";
import { NumberField, PercentField } from "./shared/inputs";
import { LineChart, ChartLegend } from "./shared/chart";

interface RetirementSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

export function RetirementSurface({ calculation, onChange }: RetirementSurfaceProps) {
  const inputs = useMemo(
    () => readRetirementBody(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateRetirement(calculation), [calculation]);
  const summary = useMemo(
    () => summariseRetirement(inputs),
    [inputs]
  );

  function setField(field: keyof RetirementBody, value: number) {
    onChange({ ...calculation, body: { ...inputs, [field]: value } });
  }

  return (
    <CalculatorSurface
      calculation={calculation}
      evaluation={evaluation}
      title="Retirement Planner"
      description="Type a current age, retirement age, current savings, monthly contribution, expected return, inflation rate, years in retirement, replacement ratio and current income to see the corpus at retirement, the required corpus, the estimated monthly income, the surplus / shortfall, the on-track flag and a yearly projection."
      toolName="Retirement Planner"
      pdfSubtitle="Retirement planner"
      inputSummary={[
        { label: "Current age", value: String(inputs.currentAge) },
        { label: "Retirement age", value: String(inputs.retirementAge) },
        { label: "Current savings", value: formatCurrency(inputs.currentSavings) },
        { label: "Monthly contribution", value: formatCurrency(inputs.monthlyContribution) },
        { label: "Expected return", value: formatPercent(inputs.expectedReturn) },
        { label: "Inflation rate", value: formatPercent(inputs.inflationRate) },
        { label: "Years in retirement", value: String(inputs.yearsInRetirement) },
        {
          label: "Replacement ratio",
          value: formatPercent(inputs.replacementRatio * 100),
        },
        { label: "Current income", value: formatCurrency(inputs.currentIncome) },
      ]}
      inputs={
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Current age"
            field="currentAge"
            value={inputs.currentAge}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={1}
          />
          <NumberField
            label="Retirement age"
            field="retirementAge"
            value={inputs.retirementAge}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={1}
          />
          <NumberField
            label="Current savings"
            field="currentSavings"
            value={inputs.currentSavings}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={10000}
            hint="Your existing retirement savings."
          />
          <NumberField
            label="Monthly contribution"
            field="monthlyContribution"
            value={inputs.monthlyContribution}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={500}
            hint="How much you save every month."
          />
          <PercentField
            label="Expected annual return"
            field="expectedReturn"
            value={inputs.expectedReturn}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={0.1}
          />
          <PercentField
            label="Inflation rate"
            field="inflationRate"
            value={inputs.inflationRate}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={0.1}
          />
          <NumberField
            label="Years in retirement"
            field="yearsInRetirement"
            value={inputs.yearsInRetirement}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={1}
            hint="How long the corpus needs to last."
          />
          <NumberField
            label="Replacement ratio"
            field="replacementRatio"
            value={inputs.replacementRatio}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={0.05}
            hint="Target retirement income as a fraction of current income."
          />
          <NumberField
            label="Current income (annual)"
            field="currentIncome"
            value={inputs.currentIncome}
            onChange={(field, value) => setField(field as keyof RetirementBody, value)}
            step={10000}
            hint="Your current annual income, used to size the corpus."
          />
        </div>
      }
      chart={
        evaluation.series && summary.yearly.length > 0 ? (
          <div className="space-y-3">
            <LineChart
              series={[
                {
                  name: "Cumulative contribution",
                  points: summary.yearly.map((entry) => ({
                    label: `Age ${entry.age + inputs.currentAge - 1}`,
                    value: entry.contributed,
                  })),
                },
                {
                  name: "Projected balance",
                  points: summary.yearly.map((entry) => ({
                    label: `Age ${entry.age + inputs.currentAge - 1}`,
                    value: entry.balance,
                  })),
                },
              ]}
              ariaLabel="Retirement projection"
            />
            <ChartLegend series={evaluation.series} />
          </div>
        ) : null
      }
    />
  );
}
