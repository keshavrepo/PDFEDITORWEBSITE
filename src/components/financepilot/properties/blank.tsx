"use client";

/**
 * FinancePilot blank properties panel.
 *
 * The foundation keeps a blank fallback so the right rail is never
 * empty when an unknown calculator kind is mounted. The four
 * calculators in batch 1 ship their own dedicated panels.
 */

import type { FinanceCalculation } from "@/lib/financepilot";

export function BlankProperties({ calculation }: { calculation: FinanceCalculation }) {
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;
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
    </div>
  );
}
