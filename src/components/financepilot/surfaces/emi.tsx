"use client";

/**
 * EMI calculator surface.
 *
 * Inputs: loan amount, annual interest rate, loan tenure in years.
 * Outputs: monthly EMI, total interest, total payment, an
 * amortisation schedule and a principal-vs-interest pie chart.
 */

import { useMemo } from "react";
import {
  formatCurrency,
  formatPercent,
  readEmiInputs,
  evaluateEmi,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { CalculatorSurface } from "./shared/surface";
import { NumberField, PercentField } from "./shared/inputs";
import { LineChart, ChartLegend, PieChart } from "./shared/chart";
import { ScheduleTable } from "./shared/schedule-table";

interface EmiSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

export function EmiSurface({ calculation, onChange }: EmiSurfaceProps) {
  const inputs = useMemo(
    () => readEmiInputs(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateEmi(calculation), [calculation]);

  function setField(field: string, value: number) {
    const body: Record<string, unknown> =
      calculation.body && typeof calculation.body === "object"
        ? { ...(calculation.body as Record<string, unknown>) }
        : {};
    onChange({ ...calculation, body: { ...body, [field]: value } });
  }

  // Pie chart shows the share of principal vs interest over the life
  // of the loan. Schedule data already carries the per-period split,
  // so the total is the sum of all `principal` and `interest` rows.
  const principalTotal = evaluation.schedule?.reduce(
    (acc, row) => acc + row.principal,
    0
  );
  const interestTotal = evaluation.schedule?.reduce(
    (acc, row) => acc + row.interest,
    0
  );

  return (
    <CalculatorSurface
      calculation={calculation}
      evaluation={evaluation}
      title="EMI Calculator"
      description="Type a loan amount, an interest rate and a tenure to compute the Equated Monthly Instalment, total interest and total payment, with a full amortisation schedule."
      toolName="EMI Calculator"
      pdfSubtitle="EMI calculator"
      inputSummary={[
        { label: "Loan amount", value: formatCurrency(inputs.principal) },
        { label: "Interest rate", value: formatPercent(inputs.annualRate) },
        { label: "Tenure", value: `${inputs.years} years` },
      ]}
      inputs={
        <>
          <NumberField
            label="Loan amount"
            field="principal"
            value={inputs.principal}
            onChange={setField}
            step={1000}
            hint="The amount you want to borrow."
          />
          <PercentField
            label="Interest rate (per year)"
            field="annualRate"
            value={inputs.annualRate}
            onChange={setField}
            step={0.05}
            hint="The annual interest rate."
          />
          <NumberField
            label="Tenure (years)"
            field="years"
            value={inputs.years}
            onChange={setField}
            step={1}
            hint="The loan tenure in years."
          />
        </>
      }
      chart={
        evaluation.ok && seriesPayload(evaluation) ? (
          <div className="space-y-3">
            {principalTotal !== undefined && interestTotal !== undefined ? (
              <PieChart
                ariaLabel="Principal versus interest"
                slices={[
                  { label: "Principal", value: principalTotal },
                  { label: "Interest", value: interestTotal },
                ]}
              />
            ) : (
              <LineChart
                series={seriesPayload(evaluation)!}
                ariaLabel="Per-period principal and interest"
              />
            )}
            <ChartLegend series={evaluation.series ?? []} />
          </div>
        ) : null
      }
      schedule={
        evaluation.schedule ? (
          <ScheduleTable
            rows={evaluation.schedule}
            ariaLabel="Amortisation schedule"
            sampleEvery={Math.max(1, Math.floor(evaluation.schedule.length / 24))}
          />
        ) : undefined
      }
    />
  );
}

function seriesPayload(evaluation: ReturnType<typeof evaluateEmi>) {
  if (!evaluation.series) return null;
  return evaluation.series;
}
