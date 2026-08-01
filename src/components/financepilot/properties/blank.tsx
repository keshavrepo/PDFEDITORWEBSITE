"use client";

/**
 * FinancePilot properties panel for the blank surface.
 *
 * The foundation ships a read-only summary of the active calculation so
 * the right rail is never empty. Future calculators replace this file
 * with their own properties panel.
 */

import type { FinanceCalculation } from "@/lib/financepilot";
import { evaluate } from "@/lib/financepilot";

export function BlankProperties({ calculation }: { calculation: FinanceCalculation }) {
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;
  const evaluation = evaluate(calculation);

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Calculation
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Title</dt>
            <dd className="truncate text-right font-medium" title={calculation.meta.title}>
              {calculation.meta.title}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Kind</dt>
            <dd className="font-medium">{calculation.meta.kind}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium capitalize">
              {calculation.meta.category.replace(/-/g, " ")}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="tabular-nums font-medium">v{calculation.meta.version}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Last saved</dt>
            <dd className="tabular-nums">
              {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Result
        </h3>
        {evaluation.ok ? (
          <dl className="space-y-1.5">
            {evaluation.lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="tabular-nums font-medium">{line.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            {evaluation.error ?? "No result yet."}
          </p>
        )}
      </section>
    </div>
  );
}
