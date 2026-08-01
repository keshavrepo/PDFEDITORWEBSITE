"use client";

/**
 * Reusable amortisation / growth schedule table.
 *
 * Every schedule from the calculator runtime has the same shape: a
 * period number, a payment, an interest portion, a principal portion
 * and a balance. The table renders up to `maxRows` rows in a virtual
 * scroll container so a 30-year monthly amortisation (360 rows)
 * stays usable without overflowing the surface.
 *
 * The table is read-only: the schedule is recomputed on every input
 * change so re-rendering is cheap.
 */

import { useMemo, useState } from "react";
import type { FinanceScheduleRow } from "@/lib/financepilot";
import { cn } from "@/lib/utils";

interface ScheduleTableProps {
  rows: FinanceScheduleRow[];
  /** Total height of the scroll container. Defaults to 18rem. */
  maxHeight?: string;
  /** Show the balance column. Off for SIP-style schedules. */
  showBalance?: boolean;
  /** Custom column header for the first period column. */
  periodLabel?: string;
  /** Optional row sub-sampling: every nth row is shown. */
  sampleEvery?: number;
  /** Optional accessibility label. */
  ariaLabel?: string;
}

export function ScheduleTable({
  rows,
  maxHeight = "18rem",
  showBalance = true,
  periodLabel = "Period",
  sampleEvery = 1,
  ariaLabel,
}: ScheduleTableProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = useMemo(() => {
    if (showAll || sampleEvery === 1) return rows;
    const filtered: FinanceScheduleRow[] = [];
    rows.forEach((row, index) => {
      if (index % sampleEvery === 0) filtered.push(row);
    });
    return filtered;
  }, [rows, sampleEvery, showAll]);

  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        No schedule yet
      </div>
    );
  }

  const canCollapse = rows.length > 12 && sampleEvery > 1;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="overflow-auto rounded-lg border border-border"
        style={{ maxHeight }}
        role="region"
        aria-label={ariaLabel ?? "Schedule"}
      >
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-semibold">{periodLabel}</th>
              <th className="px-3 py-2 text-right font-semibold">Payment</th>
              <th className="px-3 py-2 text-right font-semibold">Interest</th>
              <th className="px-3 py-2 text-right font-semibold">Principal</th>
              {showBalance && (
                <th className="px-3 py-2 text-right font-semibold">Balance</th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.period}
                className="border-t border-border/60 font-mono tabular-nums"
              >
                <td className="px-3 py-1.5 text-left text-muted-foreground">
                  {row.period}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {formatCompactCurrency(row.payment)}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {formatCompactCurrency(row.interest)}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {formatCompactCurrency(row.principal)}
                </td>
                {showBalance && (
                  <td className="px-3 py-1.5 text-right">
                    {formatCompactCurrency(row.balance)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canCollapse && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {showAll ? "Show every period" : `Show every ${sampleEvery}th period`}
        </button>
      )}
    </div>
  );
}

function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(2)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

interface ResultLinesProps {
  lines: Array<{ label: string; value: string }>;
  className?: string;
}

/**
 * A read-only grid of result lines. Used by the right-rail
 * properties panel and the calculator surface.
 */
export function ResultLines({ lines, className }: ResultLinesProps) {
  if (lines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Enter a value above to see the result.
      </p>
    );
  }
  return (
    <dl className={cn("space-y-1.5 text-xs", className)}>
      {lines.map((line) => (
        <div
          key={line.label}
          className="flex items-center justify-between gap-3"
        >
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd className="font-mono tabular-nums font-medium">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}
