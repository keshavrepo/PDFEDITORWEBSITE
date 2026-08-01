"use client";

/**
 * Net Worth Tracker properties panel. Read-only summary of the
 * latest snapshot, the historical trend and the calculation
 * metadata.
 */

import { useMemo } from "react";
import {
  evaluateNetWorth,
  formatCurrency,
  readNetWorthBody,
  summariseNetWorth,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ResultLines } from "../surfaces/shared/schedule-table";

export function NetWorthProperties({ calculation }: { calculation: FinanceCalculation }) {
  const body = useMemo(() => readNetWorthBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateNetWorth(calculation), [calculation]);
  const summary = useMemo(() => summariseNetWorth(body), [body]);
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <dl className="space-y-1.5">
          <Row label="Month" value={body.month || "—"} />
          <Row label="Assets" value={String(body.assets.length)} />
          <Row label="Liabilities" value={String(body.liabilities.length)} />
          <Row label="History" value={String(body.history.length)} />
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
          Top assets
        </h3>
        <dl className="space-y-1.5">
          {summary.byAssetCategory.slice(0, 4).map((entry) => (
            <Row key={entry.category} label={entry.category} value={formatCurrency(entry.amount)} />
          ))}
          {summary.byAssetCategory.length === 0 && (
            <p className="text-muted-foreground">No assets yet.</p>
          )}
        </dl>
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
      <dd className="truncate text-right font-mono tabular-nums font-medium">{value}</dd>
    </div>
  );
}
