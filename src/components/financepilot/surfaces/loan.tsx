"use client";

/**
 * Loan calculator surface.
 *
 * Inputs: loan amount, annual interest rate, tenure, processing fee
 * (percent of loan amount) and down payment. Outputs: effective
 * loan amount, processing fee, monthly payment, total interest,
 * total cost, an amortisation table and a pie chart.
 */

import { useMemo } from "react";
import {
  evaluateLoan,
  formatCurrency,
  formatPercent,
  readLoanInputs,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { CalculatorSurface } from "./shared/surface";
import { NumberField, PercentField } from "./shared/inputs";
import { LineChart, ChartLegend, PieChart } from "./shared/chart";
import { ScheduleTable } from "./shared/schedule-table";

interface LoanSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

export function LoanSurface({ calculation, onChange }: LoanSurfaceProps) {
  const inputs = useMemo(
    () => readLoanInputs(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateLoan(calculation), [calculation]);

  function setField(field: string, value: number) {
    const body: Record<string, unknown> =
      calculation.body && typeof calculation.body === "object"
        ? { ...(calculation.body as Record<string, unknown>) }
        : {};
    onChange({ ...calculation, body: { ...body, [field]: value } });
  }

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
      title="Loan Calculator"
      description="Type a loan amount, an interest rate, a tenure, a processing fee and a down payment to compute the effective loan, the monthly payment, the total interest, the total cost, an amortisation table and a pie chart."
      toolName="Loan Calculator"
      pdfSubtitle="Loan calculator"
      inputSummary={[
        { label: "Loan amount", value: formatCurrency(inputs.principal) },
        { label: "Down payment", value: formatCurrency(inputs.downPayment) },
        { label: "Processing fee", value: formatPercent(inputs.processingFeePercent) },
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
          <NumberField
            label="Down payment"
            field="downPayment"
            value={inputs.downPayment}
            onChange={setField}
            step={1000}
            hint="The amount you pay upfront. Reduces the effective loan."
          />
          <PercentField
            label="Processing fee (% of loan)"
            field="processingFeePercent"
            value={inputs.processingFeePercent}
            onChange={setField}
            step={0.1}
            hint="A one-time fee charged by the lender."
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
        evaluation.ok ? (
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
                series={evaluation.series ?? []}
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
            ariaLabel="Amortisation table"
            sampleEvery={Math.max(1, Math.floor(evaluation.schedule.length / 24))}
          />
        ) : undefined
      }
    />
  );
}
