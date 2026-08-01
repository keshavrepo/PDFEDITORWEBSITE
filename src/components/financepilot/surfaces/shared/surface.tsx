"use client";

/**
 * Common surface chrome for the four FinancePilot calculators.
 *
 * Every calculator renders a three-column body:
 *
 *  - **Inputs card** on the left with the calculator-specific fields
 *  - **Results + chart** in the middle with a pie chart for EMI / Loan
 *    and a line chart for SIP / Compound interest
 *  - **Schedule** below the chart, scrollable so a 30-year amortisation
 *    does not push the page off-screen
 *
 * The "Export PDF" and "Save calculation" buttons sit in the action
 * bar at the top. The Save button triggers the shell's autosave loop
 * indirectly — calling `onChange` with the new calculation flips the
 * dirty flag — and the Export PDF button routes through the shared
 * `printFinanceCalculation` helper so the foundation does not need a
 * PDF library.
 */

import type { ReactNode } from "react";
import { FileDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FinanceCalculation, FinanceEvaluation } from "@/lib/financepilot";
import { recordActivity } from "@/lib/platform/record-activity";
import { showToast } from "../../toast";
import { ResultLines } from "./schedule-table";

interface SurfaceProps {
  calculation: FinanceCalculation;
  evaluation: FinanceEvaluation;
  /** Headline shown above the input form. */
  title: string;
  /** Optional intro line. */
  description?: string;
  /** Section rendered on the left with the input fields. */
  inputs: ReactNode;
  /** Optional chart rendered on the right, above the result lines. */
  chart?: ReactNode;
  /** Optional table rendered below the chart row. */
  schedule?: ReactNode;
  /** Text labels for the input fields, used by the PDF export. */
  inputSummary: Array<{ label: string; value: string }>;
  /** Tool name sent to the platform's activity endpoint. */
  toolName: string;
  /** Optional chart-kind label that the PDF export uses for the title. */
  pdfSubtitle: string;
}

/**
 * Renders the full calculator surface. The four calculators in batch
 * 1 share this shell; each one supplies its own inputs, chart and
 * schedule.
 */
export function CalculatorSurface({
  calculation,
  evaluation,
  title,
  description,
  inputs,
  chart,
  schedule,
  inputSummary,
  toolName,
  pdfSubtitle,
}: SurfaceProps) {
  function exportPdf() {
    void recordActivity({
      productId: "financepilot",
      toolName,
      fileName: `${calculation.meta.title}.pdf`,
      mimeType: "application/pdf",
    }).catch(() => {
      // Recording is best-effort.
    });
    // Lazy import to avoid pulling the PDF export into the initial
    // bundle for the surface.
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
    // The shell's autosave loop picks this up automatically; the
    // button just gives a clear affordance for the user.
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
            Inputs
          </h3>
          <div className="space-y-3">{inputs}</div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Result
          </h3>
          {evaluation.ok ? (
            <>
              <ResultLines lines={evaluation.lines} className="mb-4" />
              {chart && <div className="mt-4">{chart}</div>}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {evaluation.error ?? "No result yet."}
            </p>
          )}
        </Card>
      </div>

      {schedule && (
        <Card className="p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Schedule
          </h3>
          {schedule}
        </Card>
      )}
    </div>
  );
}

/**
 * A small "saved" indicator shown in the corner. The shell's status bar
 * already shows save state, so this is just a local confirmation the
 * Save button was pressed.
 */
export function SavedHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <Save className="h-3 w-3" aria-hidden="true" />
      {children}
    </span>
  );
}
