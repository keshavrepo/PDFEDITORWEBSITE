"use client";

/**
 * Financial Dashboard surface.
 *
 * Inputs: total assets, total liabilities, monthly savings, monthly
 * income, monthly expenses, active goals, total invested, a
 * 7-month net worth history and a 12-month savings history. The
 * dashboard also shows a free-form list of quick insights.
 *
 * Outputs: net worth, savings rate, budget status (surplus /
 * balanced / deficit), an investment coverage readout, the
 * historical net worth chart and the monthly savings chart.
 *
 * The dashboard is read-only by design: every figure on the page
 * is supplied by the user, then aggregated by the runtime. Future
 * work can wire the dashboard to the other modules' persisted
 * calculations so the numbers update without manual entry.
 */

import { useMemo, useState } from "react";
import {
  evaluateDashboard,
  formatCurrency,
  formatPercent,
  readDashboardBody,
  summariseDashboard,
  type DashboardBody,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ListWorkspace } from "./shared/list-surface";
import { Card } from "@/components/ui/card";
import { LineChart, ChartLegend } from "./shared/chart";
import { NumberField } from "./shared/inputs";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

const BUDGET_STATUS_TONE: Record<string, string> = {
  surplus: "text-foreground",
  balanced: "text-muted-foreground",
  deficit: "text-foreground",
};

const BUDGET_STATUS_LABEL: Record<string, string> = {
  surplus: "Surplus",
  balanced: "Balanced",
  deficit: "Deficit",
};

export function DashboardSurface({ calculation, onChange }: DashboardSurfaceProps) {
  const body = useMemo(() => readDashboardBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateDashboard(calculation), [calculation]);
  const summary = useMemo(() => summariseDashboard(body), [body]);
  const [insightDraft, setInsightDraft] = useState("");

  function setBody(next: DashboardBody) {
    onChange({ ...calculation, body: next });
  }
  function setField<K extends keyof DashboardBody>(field: K, value: DashboardBody[K]) {
    setBody({ ...body, [field]: value });
  }
  function addInsight() {
    const value = insightDraft.trim();
    if (!value) return;
    setField("insights", [...body.insights, value]);
    setInsightDraft("");
  }
  function removeInsight(index: number) {
    setField(
      "insights",
      body.insights.filter((_, i) => i !== index)
    );
  }

  return (
    <ListWorkspace
      calculation={calculation}
      evaluation={evaluation}
      title="Financial Dashboard"
      description="A single screen for every FinancePilot metric: total assets, total liabilities, net worth, monthly savings, budget status, active goals, investment summary, charts and quick insights."
      toolName="Financial Dashboard"
      pdfSubtitle="Financial dashboard"
      inputSummary={[
        { label: "Total assets", value: formatCurrency(body.totalAssets) },
        { label: "Total liabilities", value: formatCurrency(body.totalLiabilities) },
        { label: "Net worth", value: formatCurrency(summary.netWorth) },
        { label: "Monthly savings", value: formatCurrency(body.monthlySavings) },
        { label: "Savings rate", value: formatPercent(Math.max(0, summary.savingsRate * 100)) },
        { label: "Active goals", value: String(body.activeGoals) },
      ]}
      chart={
        <div className="space-y-4">
          {evaluation.series && evaluation.series.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Net worth
              </p>
              <LineChart
                series={[
                  {
                    name: "Net worth",
                    points: summary.history.map((entry) => ({
                      label: entry.month,
                      value: Math.round(entry.netWorth),
                    })),
                  },
                ]}
                ariaLabel="Net worth history"
              />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly savings
              </p>
              <LineChart
                series={[
                  {
                    name: "Monthly savings",
                    points: summary.savingsHistory.map((entry) => ({
                      label: entry.month,
                      value: Math.round(entry.savings),
                    })),
                  },
                ]}
                ariaLabel="Monthly savings history"
              />
              <ChartLegend series={evaluation.series} />
            </>
          )}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total assets"
          value={formatCurrency(body.totalAssets)}
          icon={<ArrowUp className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Total liabilities"
          value={formatCurrency(body.totalLiabilities)}
          icon={<ArrowDown className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Net worth"
          value={formatCurrency(summary.netWorth)}
          tone="highlight"
        />
        <KpiCard
          label="Monthly income"
          value={formatCurrency(body.monthlyIncome)}
        />
        <KpiCard
          label="Monthly expenses"
          value={formatCurrency(body.monthlyExpenses)}
        />
        <KpiCard
          label="Monthly savings"
          value={formatCurrency(body.monthlySavings)}
          tone="highlight"
        />
        <KpiCard
          label="Savings rate"
          value={formatPercent(Math.max(0, summary.savingsRate * 100))}
        />
        <KpiCard
          label="Budget status"
          value={BUDGET_STATUS_LABEL[summary.budgetStatus]}
          tone={summary.budgetStatus === "surplus" ? "highlight" : "default"}
        />
        <KpiCard
          label="Active goals"
          value={String(body.activeGoals)}
        />
        <KpiCard
          label="Total invested"
          value={formatCurrency(body.totalInvested)}
        />
        <KpiCard
          label="Investment coverage"
          value={formatPercent(Math.max(0, Math.min(1, summary.investmentCoverage) * 100))}
          hint="How much of your monthly savings reaches the investment portfolio."
        />
        <KpiCard
          label="High priority"
          value="—"
          hint="Add goals to see the high-priority count here."
        />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Total assets"
            field="totalAssets"
            value={body.totalAssets}
            onChange={(field, value) => setField(field as keyof DashboardBody, value)}
            step={10000}
          />
          <NumberField
            label="Total liabilities"
            field="totalLiabilities"
            value={body.totalLiabilities}
            onChange={(field, value) => setField(field as keyof DashboardBody, value)}
            step={10000}
          />
          <NumberField
            label="Monthly income"
            field="monthlyIncome"
            value={body.monthlyIncome}
            onChange={(field, value) => setField(field as keyof DashboardBody, value)}
            step={1000}
          />
          <NumberField
            label="Monthly expenses"
            field="monthlyExpenses"
            value={body.monthlyExpenses}
            onChange={(field, value) => setField(field as keyof DashboardBody, value)}
            step={1000}
          />
          <NumberField
            label="Monthly savings"
            field="monthlySavings"
            value={body.monthlySavings}
            onChange={(field, value) => setField(field as keyof DashboardBody, value)}
            step={1000}
          />
          <NumberField
            label="Active goals"
            field="activeGoals"
            value={body.activeGoals}
            onChange={(field, value) => setField(field as keyof DashboardBody, value)}
            step={1}
          />
          <NumberField
            label="Total invested"
            field="totalInvested"
            value={body.totalInvested}
            onChange={(field, value) => setField(field as keyof DashboardBody, value)}
            step={10000}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick insights
        </h3>
        {body.insights.length === 0 ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Add a one-line insight to highlight on the dashboard.
          </p>
        ) : (
          <ul className="mb-3 space-y-1.5 text-xs">
            {body.insights.map((insight, index) => (
              <li
                key={`${insight}-${index}`}
                className="flex items-start justify-between gap-2"
              >
                <span className="text-foreground">· {insight}</span>
                <button
                  type="button"
                  onClick={() => removeInsight(index)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Remove insight"
                >
                  <Minus className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={insightDraft}
            onChange={(event) => setInsightDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addInsight();
              }
            }}
            placeholder="e.g. Savings rate is 20% of income."
            className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs"
            aria-label="New insight"
          />
          <button
            type="button"
            onClick={addInsight}
            className="h-8 rounded-lg border border-border bg-background px-3 text-xs hover:bg-accent"
          >
            Add
          </button>
        </div>
      </Card>
    </ListWorkspace>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "default" | "highlight";
  hint?: string;
}

function KpiCard({ label, value, icon, tone = "default", hint }: KpiCardProps) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 flex items-center gap-1.5 font-mono tabular-nums text-lg font-semibold",
          tone === "highlight" ? "text-foreground" : "text-foreground/90"
        )}
      >
        {icon}
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
