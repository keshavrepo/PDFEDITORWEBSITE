"use client";

/**
 * Workspace chrome for the personal-finance modules.
 *
 * The batch-2 modules (Budget, Expense, Savings, Net Worth) all work
 * over a list of line items rather than a single formula. The
 * `CalculatorSurface` in `surface.tsx` is built around a fixed
 * inputs/result/schedule layout, so the list-based modules use this
 * `ListWorkspace` instead: it shares the same header chrome (Save,
 * Export PDF, activity tracking) and the same result+chart row, then
 * delegates the rest of the page to the per-module list editors.
 *
 * The component is intentionally simple — it is a small wrapper
 * around the shell that owns the action bar and the activity
 * tracking, so every list-based module gets the same chrome for free.
 */

import type { ReactNode } from "react";
import { FileDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FinanceCalculation, FinanceEvaluation } from "@/lib/financepilot";
import { recordActivity } from "@/lib/platform/record-activity";
import { showToast } from "../../toast";
import { ResultLines } from "./schedule-table";

interface ListWorkspaceProps {
  calculation: FinanceCalculation;
  evaluation: FinanceEvaluation;
  /** Headline shown above the result card. */
  title: string;
  /** Optional intro line. */
  description?: string;
  /** Optional chart rendered alongside the result lines. */
  chart?: ReactNode;
  /** Optional summary cards shown between the result and the lists. */
  summary?: ReactNode;
  /** The list editors and tables that make up the bulk of the page. */
  children: ReactNode;
  /** Text labels for the input fields, used by the PDF export. */
  inputSummary: Array<{ label: string; value: string }>;
  /** Tool name sent to the platform's activity endpoint. */
  toolName: string;
  /** Optional chart-kind label that the PDF export uses for the title. */
  pdfSubtitle: string;
}

export function ListWorkspace({
  calculation,
  evaluation,
  title,
  description,
  chart,
  summary,
  children,
  inputSummary,
  toolName,
  pdfSubtitle,
}: ListWorkspaceProps) {
  function exportPdf() {
    void recordActivity({
      productId: "financepilot",
      toolName,
      fileName: `${calculation.meta.title}.pdf`,
      mimeType: "application/pdf",
    }).catch(() => {
      // Recording is best-effort.
    });
    void import("@/lib/financepilot").then(({ printFinanceCalculation }) => {
      printFinanceCalculation({
        calculation,
        evaluation,
        title: calculation.meta.title,
        subtitle: pdfSubtitle,
        inputs: inputSummary,
      });
    });
  }

  function saveCalculation() {
    showToast({ message: "Saved", tone: "success" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              onClick={saveCalculation}
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              onClick={exportPdf}
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              Export PDF
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_1.2fr)]">
        <Card className="p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </h3>
          {evaluation.ok ? (
            <ResultLines lines={evaluation.lines} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {evaluation.error ?? "No result yet."}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Chart
          </h3>
          {chart ?? (
            <p className="text-xs text-muted-foreground">No chart data yet.</p>
          )}
        </Card>
      </div>

      {summary}

      {children}
    </div>
  );
}
