"use client";

/**
 * Compound interest calculator surface.
 *
 * Inputs: principal, annual interest rate, compounding frequency,
 * duration in years. Outputs: final amount, interest earned, total
 * growth percentage, a year-by-year growth chart and a yearly
 * schedule.
 */

import { useMemo } from "react";
import {
  evaluateCompoundInterest,
  formatCurrency,
  formatPercent,
  readCompoundInterestInputs,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { CalculatorSurface } from "./shared/surface";
import { NumberField, PercentField, SelectField } from "./shared/inputs";
import { LineChart, ChartLegend } from "./shared/chart";
import { ScheduleTable } from "./shared/schedule-table";

interface CompoundInterestSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

/** Human-readable options for the compounding frequency select. */
const FREQUENCY_OPTIONS = [
  { value: 1, label: "Annually" },
  { value: 2, label: "Half-yearly" },
  { value: 4, label: "Quarterly" },
  { value: 6, label: "Bi-monthly" },
  { value: 12, label: "Monthly" },
  { value: 365, label: "Daily" },
];

export function CompoundInterestSurface({
  calculation,
  onChange,
}: CompoundInterestSurfaceProps) {
  const inputs = useMemo(
    () => readCompoundInterestInputs(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(
    () => evaluateCompoundInterest(calculation),
    [calculation]
  );

  function setField(field: string, value: number) {
    const body: Record<string, unknown> =
      calculation.body && typeof calculation.body === "object"
        ? { ...(calculation.body as Record<string, unknown>) }
        : {};
    onChange({ ...calculation, body: { ...body, [field]: value } });
  }

  return (
    <CalculatorSurface
      calculation={calculation}
      evaluation={evaluation}
      title="Compound Interest Calculator"
      description="Type a principal, an annual rate, a compounding frequency and a duration to see how the deposit grows, with a year-by-year chart and a yearly schedule."
      toolName="Compound Interest Calculator"
      pdfSubtitle="Compound interest"
      inputSummary={[
        { label: "Principal", value: formatCurrency(inputs.principal) },
        { label: "Interest rate", value: formatPercent(inputs.annualRate) },
        {
          label: "Compounding",
          value: frequencyLabel(inputs.frequency),
        },
        { label: "Duration", value: `${inputs.years} years` },
      ]}
      inputs={
        <>
          <NumberField
            label="Principal"
            field="principal"
            value={inputs.principal}
            onChange={setField}
            step={1000}
            hint="The amount you start with."
          />
          <PercentField
            label="Interest rate (per year)"
            field="annualRate"
            value={inputs.annualRate}
            onChange={setField}
            step={0.05}
            hint="The nominal annual rate."
          />
          <SelectField
            label="Compounding"
            field="frequency"
            value={inputs.frequency}
            options={FREQUENCY_OPTIONS}
            onChange={setField}
          />
          <NumberField
            label="Duration (years)"
            field="years"
            value={inputs.years}
            onChange={setField}
            step={1}
            hint="How long the deposit stays in the account."
          />
        </>
      }
      chart={
        evaluation.series ? (
          <div className="space-y-3">
            <LineChart
              series={evaluation.series}
              ariaLabel="Yearly growth"
            />
            <ChartLegend series={evaluation.series} />
          </div>
        ) : null
      }
      schedule={
        evaluation.schedule ? (
          <ScheduleTable
            rows={evaluation.schedule}
            ariaLabel="Yearly schedule"
            showBalance
            periodLabel="Year"
            sampleEvery={1}
          />
        ) : undefined
      }
    />
  );
}

function frequencyLabel(frequency: number): string {
  return (
    FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label ??
    `${frequency} per year`
  );
}
