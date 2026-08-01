"use client";

/**
 * Net Worth Tracker surface.
 *
 * Inputs: a month, a list of assets by category, a list of
 * liabilities by category and a historical timeline of net worth
 * snapshots. Outputs: total assets, total liabilities, net worth, a
 * category breakdown of assets and liabilities, and a historical
 * net worth line chart.
 *
 * The list editor is the shared `LineItemList`. The history is
 * editable so the user can backfill past months.
 */

import { useMemo } from "react";
import {
  evaluateNetWorth,
  formatCurrency,
  NET_WORTH_ASSET_CATEGORIES,
  NET_WORTH_LIABILITY_CATEGORIES,
  readNetWorthBody,
  summariseNetWorth,
  type FinanceCalculation,
  type NetWorthBody,
} from "@/lib/financepilot";
import { ListWorkspace } from "./shared/list-surface";
import { LineItemList, type LineItemField } from "./shared/line-item-list";
import { LineChart, ChartLegend, PieChart } from "./shared/chart";
import { Card } from "@/components/ui/card";

interface NetWorthSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

const ASSET_FIELDS: LineItemField[] = [
  {
    field: "category",
    label: "Category",
    type: "select",
    options: NET_WORTH_ASSET_CATEGORIES.map((category) => ({
      value: category,
      label: category,
    })),
    required: true,
  },
  { field: "label", label: "Label", type: "text", required: true },
  { field: "amount", label: "Amount", type: "number", step: 1000, required: true },
];

const LIABILITY_FIELDS: LineItemField[] = [
  {
    field: "category",
    label: "Category",
    type: "select",
    options: NET_WORTH_LIABILITY_CATEGORIES.map((category) => ({
      value: category,
      label: category,
    })),
    required: true,
  },
  { field: "label", label: "Label", type: "text", required: true },
  { field: "amount", label: "Amount", type: "number", step: 1000, required: true },
];

const HISTORY_FIELDS: LineItemField[] = [
  { field: "month", label: "Month (YYYY-MM)", type: "text", required: true },
  { field: "netWorth", label: "Net worth", type: "number", step: 1000, required: true },
];

function newAsset(): NetWorthBody["assets"][number] {
  return {
    id: `a-${Math.random().toString(36).slice(2, 8)}`,
    category: "Other",
    label: "",
    amount: 0,
  };
}

function newLiability(): NetWorthBody["liabilities"][number] {
  return {
    id: `l-${Math.random().toString(36).slice(2, 8)}`,
    category: "Other",
    label: "",
    amount: 0,
  };
}

function newHistoryEntry(): NetWorthBody["history"][number] {
  return {
    id: `h-${Math.random().toString(36).slice(2, 8)}`,
    month: "",
    netWorth: 0,
  };
}

export function NetWorthSurface({ calculation, onChange }: NetWorthSurfaceProps) {
  const body = useMemo(() => readNetWorthBody(calculation.body), [calculation.body]);
  const evaluation = useMemo(() => evaluateNetWorth(calculation), [calculation]);
  const summary = useMemo(() => summariseNetWorth(body), [body]);

  function setBody(next: NetWorthBody) {
    onChange({ ...calculation, body: next });
  }
  function setAssets(assets: NetWorthBody["assets"]) {
    setBody({ ...body, assets });
  }
  function setLiabilities(liabilities: NetWorthBody["liabilities"]) {
    setBody({ ...body, liabilities });
  }
  function setHistory(history: NetWorthBody["history"]) {
    setBody({ ...body, history });
  }

  return (
    <ListWorkspace
      calculation={calculation}
      evaluation={evaluation}
      title="Net Worth Tracker"
      description="Track assets and liabilities by category. The total assets, total liabilities, net worth, category breakdown and historical timeline update as you type."
      toolName="Net Worth Tracker"
      pdfSubtitle="Net worth tracker"
      inputSummary={[
        { label: "Month", value: body.month || "—" },
        { label: "Total assets", value: formatCurrency(summary.totalAssets) },
        { label: "Total liabilities", value: formatCurrency(summary.totalLiabilities) },
        { label: "Net worth", value: formatCurrency(summary.netWorth) },
      ]}
      chart={
        summary.history.length > 0 ? (
          <div className="space-y-3">
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
              ariaLabel="Net worth over time"
            />
            <ChartLegend
              series={[
                {
                  name: "Net worth",
                  points: summary.history.map((entry) => ({
                    label: entry.month,
                    value: entry.netWorth,
                  })),
                },
              ]}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add a history entry to see the net worth timeline.
          </p>
        )
      }
    >
      <Card className="p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Snapshot
        </h3>
        <label className="flex max-w-xs flex-col gap-1 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Month
          </span>
          <input
            type="month"
            value={body.month}
            onChange={(event) => setBody({ ...body, month: event.target.value })}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            aria-label="Snapshot month"
          />
        </label>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineItemList<NetWorthBody["assets"][number]>
          title="Assets"
          description="Cash, bank accounts, investments, property and anything you own with a positive value."
          items={body.assets}
          fields={ASSET_FIELDS}
          createBlank={newAsset}
          onChange={setAssets}
          totalField="amount"
          emptyMessage="No assets yet. Click Add to record one."
        />
        <LineItemList<NetWorthBody["liabilities"][number]>
          title="Liabilities"
          description="Loans, credit card balances and anything you owe with a positive balance."
          items={body.liabilities}
          fields={LIABILITY_FIELDS}
          createBlank={newLiability}
          onChange={setLiabilities}
          totalField="amount"
          emptyMessage="No liabilities yet. Click Add to record one."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Assets by category
          </h3>
          {summary.byAssetCategory.length > 0 ? (
            <PieChart
              ariaLabel="Assets by category"
              slices={summary.byAssetCategory.map((entry) => ({
                label: entry.category,
                value: entry.amount,
              }))}
            />
          ) : (
            <p className="text-xs text-muted-foreground">No assets yet.</p>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Liabilities by category
          </h3>
          {summary.byLiabilityCategory.length > 0 ? (
            <PieChart
              ariaLabel="Liabilities by category"
              slices={summary.byLiabilityCategory.map((entry) => ({
                label: entry.category,
                value: entry.amount,
              }))}
            />
          ) : (
            <p className="text-xs text-muted-foreground">No liabilities yet.</p>
          )}
        </Card>
      </div>

      <LineItemList<NetWorthBody["history"][number]>
        title="Historical timeline"
        description="One entry per month so the chart and the year-over-year comparison have something to draw."
        items={body.history}
        fields={HISTORY_FIELDS}
        createBlank={newHistoryEntry}
        onChange={setHistory}
        totalField="netWorth"
        emptyMessage="No history yet. Add the current month to seed the chart."
      />
    </ListWorkspace>
  );
}
