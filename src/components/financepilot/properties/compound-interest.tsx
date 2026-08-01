"use client";

/**
 * Compound interest calculator properties panel.
 */

import { useMemo } from "react";
import {
  evaluateCompoundInterest,
  formatCurrency,
  formatPercent,
  readCompoundInterestInputs,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

const FREQUENCY_LABELS: Record<number, string> = {
  1: "Annually",
  2: "Half-yearly",
  4: "Quarterly",
  6: "Bi-monthly",
  12: "Monthly",
  365: "Daily",
};

export function CompoundInterestProperties({
  calculation,
}: {
  calculation: FinanceCalculation;
}) {
  const inputs = useMemo(
    () => readCompoundInterestInputs(calculation.body),
    [calculation.body]
  );
  const evaluation = useMemo(
    () => evaluateCompoundInterest(calculation),
    [calculation]
  );
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Principal" value={formatCurrency(inputs.principal)} />
          <Row label="Interest rate" value={formatPercent(inputs.annualRate)} />
          <Row
            label="Compounding"
            value={FREQUENCY_LABELS[inputs.frequency] ?? `${inputs.frequency} per year`}
          />
          <Row label="Duration" value={`${inputs.years} years`} />
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Result
        </h3>
        <ResultLines lines={evaluation.ok ? evaluation.lines : []} />
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Calculation
        </h3>
        <dl className="space-y-1.5">
          <Row label="Title" value={calculation.meta.title} />
          <Row label="Version" value={`v${calculation.meta.version}`} />
          <Row
            label="Last saved"
            value={updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
          />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-mono tabular-nums font-medium">
        {value}
      </dd>
    </div>
  );
}
