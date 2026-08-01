"use client";

/**
 * SIP calculator surface.
 *
 * Inputs: monthly investment, expected return rate, investment duration.
 * Outputs: total investment, estimated returns, final value, a yearly
 * growth chart and a month-by-month schedule.
 */

import { useMemo } from "react";
import {
  evaluateSip,
  formatCurrency,
  formatPercent,
  readSipInputs,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { CalculatorSurface } from "./shared/surface";
import { NumberField, PercentField } from "./shared/inputs";
import { LineChart, ChartLegend } from "./shared/chart";
import { ScheduleTable } from "./shared/schedule-table";

interface SipSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

export function SipSurface({ calculation, onChange }: SipSurfaceProps) {
  const inputs = useMemo(
    () => readSipInputs(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(() => evaluateSip(calculation), [calculation]);

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
      title="SIP Calculator"
      description="Type a monthly investment, an expected return and a duration to see how a Systematic Investment Plan grows, with a year-by-year chart and a month-by-month schedule."
      toolName="SIP Calculator"
      pdfSubtitle="Systematic Investment Plan"
      inputSummary={[
        {
          label: "Monthly investment",
          value: formatCurrency(inputs.monthlyInvestment),
        },
        { label: "Expected return", value: formatPercent(inputs.annualRate) },
        { label: "Duration", value: `${inputs.years} years` },
      ]}
      inputs={
        <>
          <NumberField
            label="Monthly investment"
            field="monthlyInvestment"
            value={inputs.monthlyInvestment}
            onChange={setField}
            step={500}
            hint="The amount you invest every month."
          />
          <PercentField
            label="Expected return (per year)"
            field="annualRate"
            value={inputs.annualRate}
            onChange={setField}
            step={0.1}
            hint="The annual return you expect from the fund."
          />
          <NumberField
            label="Duration (years)"
            field="years"
            value={inputs.years}
            onChange={setField}
            step={1}
            hint="The investment horizon in years."
          />
        </>
      }
      chart={
        evaluation.series ? (
          <div className="space-y-3">
            <LineChart series={evaluation.series} ariaLabel="Yearly SIP growth" />
            <ChartLegend series={evaluation.series} />
          </div>
        ) : null
      }
      schedule={
        evaluation.schedule ? (
          <ScheduleTable
            rows={evaluation.schedule}
            ariaLabel="Monthly SIP schedule"
            showBalance
            periodLabel="Month"
            sampleEvery={Math.max(1, Math.floor(evaluation.schedule.length / 24))}
          />
        ) : undefined
      }
    />
  );
}
