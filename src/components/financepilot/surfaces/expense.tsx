"use client";

/**
 * Expense Tracker surface.
 *
 * Inputs: a month and a list of expenses with date, category,
 * payment method, label, amount and notes. Outputs: monthly total,
 * count, average, by-category breakdown, by-method breakdown,
 * daily spend line chart and category pie chart.
 *
 * The list editor is the shared `LineItemList`. Search, filter and
 * sort are wired to `applyExpenseFilters` so the persisted
 * preferences are also in the runtime (not just the React state).
 */

import { useMemo, useState } from "react";
import {
  applyExpenseFilters,
  DEFAULT_EXPENSE_FILTERS,
  evaluateExpense,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  readExpenseBody,
  summariseExpenses,
  type ExpenseBody,
  type ExpenseFilters,
  type FinanceCalculation,
} from "@/lib/financepilot";
import { ListWorkspace } from "./shared/list-surface";
import { LineItemList, type LineItemField } from "./shared/line-item-list";
import { LineChart, ChartLegend, PieChart } from "./shared/chart";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/financepilot";

interface ExpenseSurfaceProps {
  calculation: FinanceCalculation;
  onChange: (next: FinanceCalculation) => void;
}

const EXPENSE_FIELDS: LineItemField[] = [
  { field: "date", label: "Date", type: "date", required: true },
  {
    field: "category",
    label: "Category",
    type: "select",
    options: EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
    required: true,
  },
  { field: "label", label: "Label", type: "text", required: true },
  { field: "amount", label: "Amount", type: "number", step: 10, required: true },
  {
    field: "paymentMethod",
    label: "Payment",
    type: "select",
    options: EXPENSE_PAYMENT_METHODS.map((method) => ({
      value: method,
      label: method.toUpperCase(),
    })),
    required: true,
  },
  { field: "notes", label: "Notes", type: "textarea" },
];

const SORT_OPTIONS = [
  { value: "date-desc", label: "Date (newest first)" },
  { value: "date-asc", label: "Date (oldest first)" },
  { value: "amount-desc", label: "Amount (high to low)" },
  { value: "amount-asc", label: "Amount (low to high)" },
];

const FILTER_CATEGORIES = [
  { value: "all", label: "All categories" },
  ...EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
];

const FILTER_METHODS = [
  { value: "all", label: "All methods" },
  ...EXPENSE_PAYMENT_METHODS.map((method) => ({
    value: method,
    label: method.toUpperCase(),
  })),
];

function newExpense(month: string): ExpenseBody["expenses"][number] {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    date: month ? `${month}-01` : "",
    category: "Other",
    label: "",
    amount: 0,
    paymentMethod: "upi",
  };
}

export function ExpenseSurface({ calculation, onChange }: ExpenseSurfaceProps) {
  const body = useMemo(() => readExpenseBody(calculation.body), [calculation.body]);
  const [filters, setFilters] = useState<ExpenseFilters>(DEFAULT_EXPENSE_FILTERS);
  const evaluation = useMemo(() => evaluateExpense(calculation), [calculation]);
  const summary = useMemo(() => summariseExpenses(body.expenses), [body.expenses]);
  const visible = useMemo(
    () => applyExpenseFilters(body.expenses, filters),
    [body.expenses, filters]
  );

  function setBody(next: ExpenseBody) {
    onChange({ ...calculation, body: next });
  }
  function setMonth(month: string) {
    setBody({ ...body, month });
  }
  function setExpenses(expenses: ExpenseBody["expenses"]) {
    setBody({ ...body, expenses });
  }

  return (
    <ListWorkspace
      calculation={calculation}
      evaluation={evaluation}
      title="Expense Tracker"
      description="Add every expense with a date, category, payment method and notes. Search, filter and sort; the daily and category charts update live."
      toolName="Expense Tracker"
      pdfSubtitle="Expense tracker"
      inputSummary={[
        { label: "Month", value: body.month || "—" },
        { label: "Entries", value: String(summary.count) },
        { label: "Total", value: formatCurrency(summary.total) },
        { label: "Average", value: formatCurrency(summary.average) },
      ]}
      chart={
        summary.byDay.length > 0 || summary.byCategory.length > 0 ? (
          <div className="space-y-3">
            {summary.byDay.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Daily spend
                </p>
                <LineChart
                  series={[
                    {
                      name: "Daily spend",
                      points: summary.byDay.map((entry) => ({
                        label: entry.day.slice(8),
                        value: Math.round(entry.amount),
                      })),
                    },
                  ]}
                  ariaLabel="Daily spend"
                />
                <ChartLegend
                  series={[
                    {
                      name: "Daily spend",
                      points: summary.byDay.map((entry) => ({
                        label: entry.day,
                        value: entry.amount,
                      })),
                    },
                  ]}
                />
              </div>
            )}
            {summary.byCategory.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  By category
                </p>
                <PieChart
                  ariaLabel="Spending by category"
                  slices={summary.byCategory.map((entry) => ({
                    label: entry.category,
                    value: entry.amount,
                  }))}
                />
                <ChartLegend
                  series={[
                    {
                      name: "By category",
                      points: summary.byCategory.map((entry) => ({
                        label: entry.category,
                        value: entry.amount,
                      })),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add an expense to see the daily and category charts.
          </p>
        )
      }
      summary={
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Month
              </span>
              <input
                type="month"
                value={body.month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label="Month"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </span>
              <select
                value={filters.category}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, category: event.target.value }))
                }
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label="Category filter"
              >
                {FILTER_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Payment
              </span>
              <select
                value={filters.paymentMethod}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, paymentMethod: event.target.value }))
                }
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label="Payment method filter"
              >
                {FILTER_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sort
              </span>
              <select
                value={filters.sort}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sort: event.target.value as ExpenseFilters["sort"],
                  }))
                }
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                aria-label="Sort order"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      }
    >
      <LineItemList<ExpenseBody["expenses"][number]>
        title="Expenses"
        description="Each entry adds to the monthly total, the daily chart and the category breakdown."
        items={visible}
        fields={EXPENSE_FIELDS}
        createBlank={() => newExpense(body.month)}
        onChange={setExpenses}
        headerSummary={[
          { label: "Entries", value: String(summary.count) },
          { label: "Total", value: formatCurrency(summary.total) },
        ]}
        totalField="amount"
        searchPlaceholder="Search label, category or notes"
        matchSearch={(entry, query) =>
          entry.label.toLowerCase().includes(query) ||
          entry.category.toLowerCase().includes(query) ||
          (entry.notes ?? "").toLowerCase().includes(query)
        }
        emptyMessage="No expenses match the current filters."
      />
    </ListWorkspace>
  );
}
