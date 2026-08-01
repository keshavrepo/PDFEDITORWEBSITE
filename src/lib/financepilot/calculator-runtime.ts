/**
 * Per-calculator runtime definitions.
 *
 * Every calculator that ships with FinancePilot is declared here as a
 * typed input/output pair. The runtime definitions are the only place
 * that knows how to:
 *
 *  - read the calculator's input map from a calculation body
 *  - validate the inputs and return a typed `FinanceCalculationInputs`
 *  - evaluate the calculator and return a typed `FinanceEvaluation`
 *  - produce a stable body for a fresh calculation (used by the
 *    templates registry when the user picks a template)
 *
 * The shared evaluation engine in `./evaluate` is a thin dispatcher
 * that looks the runtime up by `kind` so adding a new calculator means
 * dropping a new entry here and a new descriptor in `./calculators`.
 *
 * Pure functions only; no React, no DOM. Everything here runs unchanged
 * on the client and the server so the test suite can exercise the
 * formulas without mocking the editor.
 */

import type {
  FinanceCalculation,
  FinanceChartSeries,
  FinanceEvaluation,
  FinanceScheduleRow,
} from "./types";

/**
 * One calculator's typed input schema.
 *
 * The shape is intentionally narrow: only the numeric inputs the
 * formula needs, already coerced. The form surface is responsible for
 * parsing the user-typed string into a number before calling
 * `evaluate`.
 */
export interface FinanceCalculatorInputs {
  principal: number;
  annualRate: number;
  years: number;
}

/** Common helpers every formula uses, kept here so the math is uniform. */
export function monthlyRate(annualRate: number): number {
  return annualRate / 100 / 12;
}

export function monthlyPeriods(years: number): number {
  return Math.max(1, Math.round(years * 12));
}

/** EMI = P · r · (1 + r)^n / ((1 + r)^n − 1). r is the monthly rate, n the periods. */
export function emiPayment(
  principal: number,
  annualRate: number,
  years: number
): { emi: number; totalInterest: number; totalPayment: number } {
  const n = monthlyPeriods(years);
  const r = monthlyRate(annualRate);
  if (principal <= 0 || n <= 0) {
    return { emi: 0, totalInterest: 0, totalPayment: 0 };
  }
  if (r === 0) {
    const emi = principal / n;
    return { emi, totalInterest: 0, totalPayment: principal };
  }
  const factor = Math.pow(1 + r, n);
  const emi = (principal * r * factor) / (factor - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;
  return { emi, totalInterest, totalPayment };
}

/**
 * Builds an amortisation schedule for a fixed-payment loan.
 *
 * The last row absorbs any rounding drift so the running balance is
 * exactly zero at the end of the schedule.
 */
export function amortisationSchedule(
  principal: number,
  annualRate: number,
  years: number
): { rows: FinanceScheduleRow[]; emi: number; totalInterest: number; totalPayment: number } {
  const { emi, totalInterest, totalPayment } = emiPayment(
    principal,
    annualRate,
    years
  );
  const n = monthlyPeriods(years);
  const r = monthlyRate(annualRate);
  const rows: FinanceScheduleRow[] = [];
  let balance = principal;
  for (let period = 1; period <= n; period++) {
    const interest = balance * r;
    let principalPart = emi - interest;
    let payment = emi;
    if (period === n) {
      // Final row: pay off whatever is left so the balance ends at zero.
      principalPart = balance;
      payment = balance + interest;
    }
    balance = Math.max(0, balance - principalPart);
    rows.push({
      period,
      payment,
      interest,
      principal: principalPart,
      balance,
    });
  }
  return { rows, emi, totalInterest, totalPayment };
}

/** Currency formatter that trims trailing zeros but keeps up to 2 decimals. */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  });
}

/** Currency formatter that keeps up to 2 decimals. */
export function formatCurrencyPrecise(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
}

/** Plain number with up to 2 decimals. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

/** Percent with up to 2 decimals. */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${formatNumber(value)}%`;
}

/** Reads a numeric input from the raw body, falling back to a default. */
export function readNumber(
  body: unknown,
  field: string,
  fallback: number
): number {
  if (!body || typeof body !== "object") return fallback;
  const value = (body as Record<string, unknown>)[field];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Reads the inputs the EMI / Loan / Compound-Interest / SIP calculators share. */
export function readCommonInputs(
  body: unknown
): FinanceCalculatorInputs {
  return {
    principal: readNumber(body, "principal", 0),
    annualRate: readNumber(body, "annualRate", 0),
    years: readNumber(body, "years", 0),
  };
}

/** Returns true if the inputs would produce a degenerate result. */
export function hasUsableInputs(inputs: FinanceCalculatorInputs): boolean {
  return inputs.principal > 0 && inputs.years > 0;
}

/* -------------------------------------------------------------------------- */
/* EMI                                                                        */
/* -------------------------------------------------------------------------- */

export interface EmiCalculatorInputs extends FinanceCalculatorInputs {}

/** Default body for a fresh EMI calculation. */
export function defaultEmiBody(): { principal: number; annualRate: number; years: number } {
  return { principal: 2_500_000, annualRate: 8.5, years: 20 };
}

/** Reads EMI inputs from a body. */
export function readEmiInputs(body: unknown): EmiCalculatorInputs {
  return readCommonInputs(body);
}

export function evaluateEmi(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const inputs = readEmiInputs(calculation.body);
  if (!hasUsableInputs(inputs)) {
    return {
      ok: false,
      error: "Enter a loan amount above zero and a tenure above zero.",
      lines: [],
    };
  }
  const { emi, totalInterest, totalPayment } = emiPayment(
    inputs.principal,
    inputs.annualRate,
    inputs.years
  );
  if (!Number.isFinite(emi) || emi <= 0) {
    return {
      ok: false,
      error: "Inputs produce a non-finite EMI. Adjust the rate or tenure.",
      lines: [],
    };
  }
  const { rows } = amortisationSchedule(
    inputs.principal,
    inputs.annualRate,
    inputs.years
  );
  const principalSeries: FinanceChartSeries = {
    name: "Principal",
    points: rows.map((row) => ({
      label: String(row.period),
      value: Math.round(row.principal),
    })),
  };
  const interestSeries: FinanceChartSeries = {
    name: "Interest",
    points: rows.map((row) => ({
      label: String(row.period),
      value: Math.round(row.interest),
    })),
  };
  return {
    ok: true,
    lines: [
      { label: "Monthly EMI", value: formatCurrencyPrecise(emi) },
      { label: "Total interest", value: formatCurrency(totalInterest) },
      { label: "Total payment", value: formatCurrency(totalPayment) },
    ],
    schedule: rows,
    series: [principalSeries, interestSeries],
  };
}

/* -------------------------------------------------------------------------- */
/* SIP                                                                        */
/* -------------------------------------------------------------------------- */

export interface SipCalculatorInputs {
  monthlyInvestment: number;
  annualRate: number;
  years: number;
}

export function defaultSipBody(): {
  monthlyInvestment: number;
  annualRate: number;
  years: number;
} {
  return { monthlyInvestment: 10_000, annualRate: 12, years: 10 };
}

export function readSipInputs(body: unknown): SipCalculatorInputs {
  return {
    monthlyInvestment: readNumber(body, "monthlyInvestment", 0),
    annualRate: readNumber(body, "annualRate", 0),
    years: readNumber(body, "years", 0),
  };
}

/**
 * Future value of a SIP with monthly contributions and monthly compounding.
 *
 * FV = P · ((1 + r)^n − 1) / r · (1 + r), where r is the monthly rate and
 * n is the total number of monthly contributions. The `(1 + r)` factor
 * accounts for end-of-period vs start-of-period timing; the standard
 * SIP calculator treats the contribution as made at the start of the
 * month, so the value is multiplied by (1 + r).
 */
export function sipFutureValue(
  monthlyInvestment: number,
  annualRate: number,
  years: number
): { futureValue: number; totalInvested: number; estimatedReturns: number; schedule: FinanceScheduleRow[] } {
  const n = monthlyPeriods(years);
  const r = monthlyRate(annualRate);
  if (monthlyInvestment <= 0 || n <= 0) {
    return {
      futureValue: 0,
      totalInvested: 0,
      estimatedReturns: 0,
      schedule: [],
    };
  }
  if (r === 0) {
    const totalInvested = monthlyInvestment * n;
    return {
      futureValue: totalInvested,
      totalInvested,
      estimatedReturns: 0,
      schedule: [],
    };
  }
  const factor = Math.pow(1 + r, n);
  const futureValue = monthlyInvestment * ((factor - 1) / r) * (1 + r);
  const totalInvested = monthlyInvestment * n;
  const estimatedReturns = futureValue - totalInvested;
  const schedule: FinanceScheduleRow[] = [];
  // Annuity-due timing: each contribution is made at the start of the
  // period so it earns interest for the rest of the month. The first
  // contribution therefore earns interest for `n` months, the last one
  // for one month; this matches the `(1 + r)` factor in the future
  // value formula and keeps the running balance aligned with
  // `futureValue` to the rupee.
  let balance = monthlyInvestment;
  for (let period = 1; period <= n; period++) {
    const interest = balance * r;
    balance = balance + interest;
    if (period < n) {
      balance = balance + monthlyInvestment;
    }
    schedule.push({
      period,
      payment: monthlyInvestment,
      interest,
      principal: monthlyInvestment,
      balance,
    });
  }
  return { futureValue, totalInvested, estimatedReturns, schedule };
}

export function evaluateSip(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const inputs = readSipInputs(calculation.body);
  if (inputs.monthlyInvestment <= 0 || inputs.years <= 0) {
    return {
      ok: false,
      error: "Enter a monthly investment above zero and a duration above zero.",
      lines: [],
    };
  }
  const { futureValue, totalInvested, estimatedReturns } = sipFutureValue(
    inputs.monthlyInvestment,
    inputs.annualRate,
    inputs.years
  );
  if (!Number.isFinite(futureValue)) {
    return {
      ok: false,
      error: "Inputs produce a non-finite future value. Adjust the rate or duration.",
      lines: [],
    };
  }
  const { schedule } = sipFutureValue(
    inputs.monthlyInvestment,
    inputs.annualRate,
    inputs.years
  );
  // Yearly aggregation for the growth chart.
  const yearly = new Map<number, { invested: number; balance: number }>();
  for (const row of schedule) {
    const year = Math.ceil(row.period / 12);
    const entry = yearly.get(year) ?? { invested: 0, balance: 0 };
    entry.invested += row.principal;
    entry.balance = row.balance;
    yearly.set(year, entry);
  }
  const yearlySeries: FinanceChartSeries = {
    name: "Balance",
    points: Array.from(yearly.entries()).map(([year, value]) => ({
      label: `Year ${year}`,
      value: Math.round(value.balance),
    })),
  };
  const investedSeries: FinanceChartSeries = {
    name: "Invested",
    points: Array.from(yearly.entries()).map(([year, value]) => ({
      label: `Year ${year}`,
      value: Math.round(value.invested),
    })),
  };
  return {
    ok: true,
    lines: [
      { label: "Total investment", value: formatCurrency(totalInvested) },
      { label: "Estimated returns", value: formatCurrency(estimatedReturns) },
      { label: "Final value", value: formatCurrency(futureValue) },
    ],
    schedule,
    series: [investedSeries, yearlySeries],
  };
}

/* -------------------------------------------------------------------------- */
/* Compound interest                                                          */
/* -------------------------------------------------------------------------- */

export interface CompoundInterestInputs extends FinanceCalculatorInputs {
  /** Compounding frequency per year. */
  frequency: number;
}

const ALLOWED_FREQUENCIES = [1, 2, 4, 6, 12, 365] as const;
export type CompoundFrequency = (typeof ALLOWED_FREQUENCIES)[number];

export function defaultCompoundInterestBody(): {
  principal: number;
  annualRate: number;
  years: number;
  frequency: number;
} {
  return { principal: 100_000, annualRate: 7, years: 5, frequency: 12 };
}

export function readCompoundInterestInputs(
  body: unknown
): CompoundInterestInputs {
  const common = readCommonInputs(body);
  const frequency = readNumber(body, "frequency", 12);
  return {
    ...common,
    frequency: ALLOWED_FREQUENCIES.includes(frequency as CompoundFrequency)
      ? frequency
      : 12,
  };
}

/**
 * Future value with discrete compounding: A = P · (1 + r / n)^(n · t).
 *
 * The schedule records the year-end balance so the growth chart can
 * show the compounding curve.
 */
export function compoundFutureValue(
  principal: number,
  annualRate: number,
  years: number,
  frequency: number
): { futureValue: number; interestEarned: number; schedule: FinanceScheduleRow[] } {
  if (principal <= 0 || years <= 0) {
    return { futureValue: 0, interestEarned: 0, schedule: [] };
  }
  const r = annualRate / 100;
  const n = Math.max(1, frequency);
  const total = n * years;
  const factor = Math.pow(1 + r / n, total);
  const futureValue = principal * factor;
  const interestEarned = futureValue - principal;
  const schedule: FinanceScheduleRow[] = [];
  let cumulativeInterest = 0;
  for (let year = 1; year <= years; year++) {
    const f = Math.pow(1 + r / n, n * year);
    const balance = principal * f;
    const totalInterestAtYearEnd = balance - principal;
    const interestThisYear = totalInterestAtYearEnd - cumulativeInterest;
    cumulativeInterest = totalInterestAtYearEnd;
    schedule.push({
      period: year,
      payment: 0,
      interest: Math.max(0, interestThisYear),
      principal,
      balance,
    });
  }
  return { futureValue, interestEarned, schedule };
}

export function evaluateCompoundInterest(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const inputs = readCompoundInterestInputs(calculation.body);
  if (inputs.principal <= 0 || inputs.years <= 0) {
    return {
      ok: false,
      error: "Enter a principal above zero and a duration above zero.",
      lines: [],
    };
  }
  const { futureValue, interestEarned, schedule } = compoundFutureValue(
    inputs.principal,
    inputs.annualRate,
    inputs.years,
    inputs.frequency
  );
  if (!Number.isFinite(futureValue)) {
    return {
      ok: false,
      error: "Inputs produce a non-finite future value. Adjust the rate or duration.",
      lines: [],
    };
  }
  const series: FinanceChartSeries = {
    name: "Balance",
    points: schedule.map((row) => ({
      label: `Year ${row.period}`,
      value: Math.round(row.balance),
    })),
  };
  return {
    ok: true,
    lines: [
      { label: "Final amount", value: formatCurrency(futureValue) },
      { label: "Interest earned", value: formatCurrency(interestEarned) },
      { label: "Total growth", value: `${formatPercent(((futureValue / Math.max(1, inputs.principal)) - 1) * 100)}` },
    ],
    schedule,
    series: [series],
  };
}

/* -------------------------------------------------------------------------- */
/* Loan                                                                       */
/* -------------------------------------------------------------------------- */

export interface LoanCalculatorInputs extends FinanceCalculatorInputs {
  /** Optional one-time processing fee as a percentage of the loan. */
  processingFeePercent: number;
  /** Optional down payment that reduces the principal. */
  downPayment: number;
}

export function defaultLoanBody(): {
  principal: number;
  annualRate: number;
  years: number;
  processingFeePercent: number;
  downPayment: number;
} {
  return {
    principal: 5_000_000,
    annualRate: 9,
    years: 5,
    processingFeePercent: 1,
    downPayment: 500_000,
  };
}

export function readLoanInputs(body: unknown): LoanCalculatorInputs {
  return {
    ...readCommonInputs(body),
    processingFeePercent: readNumber(body, "processingFeePercent", 0),
    downPayment: readNumber(body, "downPayment", 0),
  };
}

export function evaluateLoan(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const inputs = readLoanInputs(calculation.body);
  const effectivePrincipal = Math.max(0, inputs.principal - inputs.downPayment);
  if (effectivePrincipal <= 0 || inputs.years <= 0) {
    return {
      ok: false,
      error:
        "Loan amount minus the down payment must be above zero, and the tenure must be above zero.",
      lines: [],
    };
  }
  const { emi, totalInterest, totalPayment } = emiPayment(
    effectivePrincipal,
    inputs.annualRate,
    inputs.years
  );
  if (!Number.isFinite(emi) || emi <= 0) {
    return {
      ok: false,
      error: "Inputs produce a non-finite EMI. Adjust the rate or tenure.",
      lines: [],
    };
  }
  const { rows } = amortisationSchedule(
    effectivePrincipal,
    inputs.annualRate,
    inputs.years
  );
  const fee = (inputs.principal * inputs.processingFeePercent) / 100;
  const totalCost = totalPayment + fee;
  const principalSeries: FinanceChartSeries = {
    name: "Principal",
    points: rows.map((row) => ({
      label: String(row.period),
      value: Math.round(row.principal),
    })),
  };
  const interestSeries: FinanceChartSeries = {
    name: "Interest",
    points: rows.map((row) => ({
      label: String(row.period),
      value: Math.round(row.interest),
    })),
  };
  return {
    ok: true,
    lines: [
      { label: "Effective loan", value: formatCurrency(effectivePrincipal) },
      { label: "Processing fee", value: formatCurrency(fee) },
      { label: "Monthly payment", value: formatCurrencyPrecise(emi) },
      { label: "Total interest", value: formatCurrency(totalInterest) },
      { label: "Total cost", value: formatCurrency(totalCost) },
    ],
    schedule: rows,
    series: [principalSeries, interestSeries],
  };
}

/* -------------------------------------------------------------------------- */
/* Budget Planner                                                             */
/* -------------------------------------------------------------------------- */

/** A line item in the budget planner. */
export interface BudgetLine {
  id: string;
  /** "income", "fixed" or "variable". */
  kind: "income" | "fixed" | "variable";
  /** Optional category like "Salary", "Rent", "Groceries". */
  category: string;
  /** Free-text label shown to the user. */
  label: string;
  /** Monthly amount in rupees. Negative amounts are accepted as deductions. */
  amount: number;
}

export interface BudgetBody {
  /** YYYY-MM month for which the budget is being planned. */
  month: string;
  /** Plan lines (income, fixed expenses, variable expenses). */
  lines: BudgetLine[];
  /** Optional rollover cap for the remaining budget. */
  rollover: number;
}

const BUDGET_KINDS: ReadonlyArray<BudgetLine["kind"]> = [
  "income",
  "fixed",
  "variable",
];

const BUDGET_CATEGORIES: Record<BudgetLine["kind"], string[]> = {
  income: ["Salary", "Freelance", "Investment", "Side income", "Other"],
  fixed: ["Rent", "EMI", "Utilities", "Insurance", "Subscription", "Other"],
  variable: ["Groceries", "Dining", "Transport", "Entertainment", "Shopping", "Health", "Other"],
};

export function budgetCategories(kind: BudgetLine["kind"]): string[] {
  return BUDGET_CATEGORIES[kind] ?? [];
}

export function defaultBudgetBody(): BudgetBody {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    month,
    rollover: 0,
    lines: [
      { id: "i-1", kind: "income", category: "Salary", label: "Take-home salary", amount: 120_000 },
      { id: "i-2", kind: "income", category: "Freelance", label: "Freelance project", amount: 25_000 },
      { id: "f-1", kind: "fixed", category: "Rent", label: "Rent", amount: 35_000 },
      { id: "f-2", kind: "fixed", category: "EMI", label: "Home loan EMI", amount: 21_695 },
      { id: "f-3", kind: "fixed", category: "Utilities", label: "Electricity + water", amount: 3_500 },
      { id: "f-4", kind: "fixed", category: "Subscription", label: "Streaming bundle", amount: 1_000 },
      { id: "v-1", kind: "variable", category: "Groceries", label: "Groceries", amount: 12_000 },
      { id: "v-2", kind: "variable", category: "Transport", label: "Fuel + cabs", amount: 6_000 },
      { id: "v-3", kind: "variable", category: "Dining", label: "Dining out", amount: 5_000 },
      { id: "v-4", kind: "variable", category: "Entertainment", label: "Movies + events", amount: 3_000 },
    ],
  };
}

export function readBudgetBody(body: unknown): BudgetBody {
  if (!body || typeof body !== "object") return defaultBudgetBody();
  const raw = body as Record<string, unknown>;
  const lines = Array.isArray(raw.lines)
    ? raw.lines
        .map((entry, index) => normaliseBudgetLine(entry, index))
        .filter((entry): entry is BudgetLine => entry !== null)
    : [];
  const month = typeof raw.month === "string" ? raw.month : "";
  const rollover = readNumber(raw, "rollover", 0);
  return { month, lines, rollover };
}

function normaliseBudgetLine(value: unknown, index: number): BudgetLine | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const kindValue = raw.kind;
  const kind: BudgetLine["kind"] = BUDGET_KINDS.includes(kindValue as BudgetLine["kind"])
    ? (kindValue as BudgetLine["kind"])
    : "variable";
  const label = typeof raw.label === "string" ? raw.label : "";
  const category = typeof raw.category === "string" ? raw.category : "Other";
  const amount = readNumber(raw, "amount", 0);
  if (!label) return null;
  return {
    id: typeof raw.id === "string" ? raw.id : `${kind}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    category,
    label,
    amount,
  };
}

export interface BudgetSummary {
  totalIncome: number;
  totalFixed: number;
  totalVariable: number;
  totalExpenses: number;
  remaining: number;
  /** Per-category totals for the variable bucket (used by the chart). */
  variableByCategory: Array<{ category: string; amount: number }>;
}

export function summariseBudget(body: BudgetBody): BudgetSummary {
  let totalIncome = 0;
  let totalFixed = 0;
  let totalVariable = 0;
  const variableMap = new Map<string, number>();
  for (const line of body.lines) {
    if (line.amount <= 0) continue;
    if (line.kind === "income") totalIncome += line.amount;
    else if (line.kind === "fixed") totalFixed += line.amount;
    else if (line.kind === "variable") {
      totalVariable += line.amount;
      variableMap.set(line.category, (variableMap.get(line.category) ?? 0) + line.amount);
    }
  }
  const totalExpenses = totalFixed + totalVariable;
  const remaining = totalIncome - totalExpenses + (body.rollover ?? 0);
  return {
    totalIncome,
    totalFixed,
    totalVariable,
    totalExpenses,
    remaining,
    variableByCategory: Array.from(variableMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function evaluateBudget(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const body = readBudgetBody(calculation.body);
  const summary = summariseBudget(body);
  const variablePie: FinanceChartSeries = {
    name: "Variable spending",
    points: summary.variableByCategory.map((entry) => ({
      label: entry.category,
      value: Math.round(entry.amount),
    })),
  };
  const fixedSeries: FinanceChartSeries = {
    name: "Fixed",
    points: [{ label: "Fixed", value: Math.round(summary.totalFixed) }],
  };
  const variableSeries: FinanceChartSeries = {
    name: "Variable",
    points: [{ label: "Variable", value: Math.round(summary.totalVariable) }],
  };
  const incomeSeries: FinanceChartSeries = {
    name: "Income",
    points: [{ label: "Income", value: Math.round(summary.totalIncome) }],
  };
  const remainingLabel = summary.remaining < 0 ? "Overspend" : "Remaining";
  return {
    ok: true,
    lines: [
      { label: "Month", value: body.month || "—" },
      { label: "Income", value: formatCurrency(summary.totalIncome) },
      { label: "Fixed expenses", value: formatCurrency(summary.totalFixed) },
      { label: "Variable expenses", value: formatCurrency(summary.totalVariable) },
      { label: "Total expenses", value: formatCurrency(summary.totalExpenses) },
      { label: remainingLabel, value: formatCurrency(summary.remaining) },
    ],
    series: [incomeSeries, fixedSeries, variableSeries, variablePie],
  };
}

/* -------------------------------------------------------------------------- */
/* Expense Tracker                                                            */
/* -------------------------------------------------------------------------- */

export interface ExpenseBody {
  /** YYYY-MM month the expense list belongs to. */
  month: string;
  expenses: Array<{
    id: string;
    /** ISO date (YYYY-MM-DD). */
    date: string;
    /** Category like "Groceries", "Transport". */
    category: string;
    /** Free-text label. */
    label: string;
    amount: number;
    paymentMethod: "cash" | "card" | "upi" | "netbanking" | "wallet";
    notes?: string;
  }>;
}

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Dining",
  "Entertainment",
  "Shopping",
  "Health",
  "Travel",
  "Education",
  "Other",
] as const;

export const EXPENSE_PAYMENT_METHODS = [
  "cash",
  "card",
  "upi",
  "netbanking",
  "wallet",
] as const;

export function defaultExpenseBody(): ExpenseBody {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    month,
    expenses: [
      { id: "e-1", date: `${month}-03`, category: "Groceries", label: "Weekly grocery run", amount: 2_400, paymentMethod: "upi" },
      { id: "e-2", date: `${month}-05`, category: "Transport", label: "Fuel refill", amount: 3_000, paymentMethod: "card" },
      { id: "e-3", date: `${month}-07`, category: "Dining", label: "Team lunch", amount: 1_850, paymentMethod: "upi" },
      { id: "e-4", date: `${month}-12`, category: "Utilities", label: "Electricity bill", amount: 2_300, paymentMethod: "netbanking" },
      { id: "e-5", date: `${month}-15`, category: "Entertainment", label: "Concert tickets", amount: 4_500, paymentMethod: "card" },
      { id: "e-6", date: `${month}-18`, category: "Shopping", label: "Winter jacket", amount: 6_200, paymentMethod: "card" },
      { id: "e-7", date: `${month}-22`, category: "Health", label: "Pharmacy", amount: 950, paymentMethod: "cash" },
      { id: "e-8", date: `${month}-27`, category: "Groceries", label: "Stock-up grocery run", amount: 3_100, paymentMethod: "upi" },
    ],
  };
}

export function readExpenseBody(body: unknown): ExpenseBody {
  if (!body || typeof body !== "object") return defaultExpenseBody();
  const raw = body as Record<string, unknown>;
  const month = typeof raw.month === "string" ? raw.month : "";
  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses
        .map((entry, index) => normaliseExpense(entry, index))
        .filter((entry): entry is ExpenseBody["expenses"][number] => entry !== null)
    : [];
  return { month, expenses };
}

function normaliseExpense(
  value: unknown,
  index: number
): ExpenseBody["expenses"][number] | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const label = typeof raw.label === "string" ? raw.label : "";
  if (!label) return null;
  const category = typeof raw.category === "string" ? raw.category : "Other";
  const date = typeof raw.date === "string" ? raw.date : "";
  const amount = readNumber(raw, "amount", 0);
  const paymentMethod = (
    EXPENSE_PAYMENT_METHODS as ReadonlyArray<string>
  ).includes(raw.paymentMethod as string)
    ? (raw.paymentMethod as ExpenseBody["expenses"][number]["paymentMethod"])
    : "upi";
  const notes = typeof raw.notes === "string" ? raw.notes : undefined;
  return {
    id: typeof raw.id === "string" ? raw.id : `e-${index}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    category,
    label,
    amount,
    paymentMethod,
    notes,
  };
}

export interface ExpenseFilters {
  query: string;
  category: string;
  paymentMethod: string;
  sort: "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
}

export const DEFAULT_EXPENSE_FILTERS: ExpenseFilters = {
  query: "",
  category: "all",
  paymentMethod: "all",
  sort: "date-desc",
};

/** Applies search / filter / sort to a list of expenses. */
export function applyExpenseFilters(
  expenses: ExpenseBody["expenses"],
  filters: ExpenseFilters
): ExpenseBody["expenses"] {
  const q = filters.query.trim().toLowerCase();
  let filtered = expenses;
  if (q) {
    filtered = filtered.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        (entry.notes ?? "").toLowerCase().includes(q)
    );
  }
  if (filters.category !== "all") {
    filtered = filtered.filter((entry) => entry.category === filters.category);
  }
  if (filters.paymentMethod !== "all") {
    filtered = filtered.filter((entry) => entry.paymentMethod === filters.paymentMethod);
  }
  const sorted = [...filtered];
  switch (filters.sort) {
    case "date-asc":
      sorted.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      break;
    case "amount-desc":
      sorted.sort((a, b) => b.amount - a.amount);
      break;
    case "amount-asc":
      sorted.sort((a, b) => a.amount - b.amount);
      break;
    case "date-desc":
    default:
      sorted.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      break;
  }
  return sorted;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  average: number;
  byCategory: Array<{ category: string; amount: number }>;
  byMethod: Array<{ method: string; amount: number }>;
  byDay: Array<{ day: string; amount: number }>;
}

export function summariseExpenses(
  expenses: ExpenseBody["expenses"]
): ExpenseSummary {
  let total = 0;
  const byCategory = new Map<string, number>();
  const byMethod = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const entry of expenses) {
    total += entry.amount;
    byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
    byMethod.set(entry.paymentMethod, (byMethod.get(entry.paymentMethod) ?? 0) + entry.amount);
    if (entry.date) {
      byDay.set(entry.date, (byDay.get(entry.date) ?? 0) + entry.amount);
    }
  }
  return {
    total,
    count: expenses.length,
    average: expenses.length === 0 ? 0 : total / expenses.length,
    byCategory: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    byMethod: Array.from(byMethod.entries())
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    byDay: Array.from(byDay.entries())
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)),
  };
}

export function evaluateExpense(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const body = readExpenseBody(calculation.body);
  const summary = summariseExpenses(body.expenses);
  const byDay: FinanceChartSeries = {
    name: "Daily spend",
    points: summary.byDay.map((entry) => ({
      label: entry.day.slice(8),
      value: Math.round(entry.amount),
    })),
  };
  const byCategory: FinanceChartSeries = {
    name: "By category",
    points: summary.byCategory.map((entry) => ({
      label: entry.category,
      value: Math.round(entry.amount),
    })),
  };
  return {
    ok: true,
    lines: [
      { label: "Month", value: body.month || "—" },
      { label: "Entries", value: String(summary.count) },
      { label: "Total spend", value: formatCurrency(summary.total) },
      { label: "Average", value: formatCurrencyPrecise(summary.average) },
    ],
    series: [byDay, byCategory],
  };
}

/* -------------------------------------------------------------------------- */
/* Savings Planner                                                            */
/* -------------------------------------------------------------------------- */

export interface SavingsBody {
  goalName: string;
  targetAmount: number;
  currentSavings: number;
  monthlyContribution: number;
  /** YYYY-MM-DD target date. */
  targetDate: string;
  /** Optional annual return on the savings (%). 0 by default. */
  annualReturn: number;
}

export function defaultSavingsBody(): SavingsBody {
  const now = new Date();
  const target = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  return {
    goalName: "Emergency fund",
    targetAmount: 600_000,
    currentSavings: 150_000,
    monthlyContribution: 15_000,
    targetDate: target.toISOString().slice(0, 10),
    annualReturn: 6,
  };
}

export function readSavingsBody(body: unknown): SavingsBody {
  if (!body || typeof body !== "object") return defaultSavingsBody();
  const raw = body as Record<string, unknown>;
  return {
    goalName: typeof raw.goalName === "string" ? raw.goalName : "Savings goal",
    targetAmount: readNumber(raw, "targetAmount", 0),
    currentSavings: readNumber(raw, "currentSavings", 0),
    monthlyContribution: readNumber(raw, "monthlyContribution", 0),
    targetDate: typeof raw.targetDate === "string" ? raw.targetDate : "",
    annualReturn: readNumber(raw, "annualReturn", 0),
  };
}

export interface SavingsSummary {
  monthsRemaining: number;
  yearsRemaining: number;
  /** Months required at the chosen contribution to hit the goal. */
  monthsToGoal: number;
  /** Progress towards the goal (0..1+). */
  progressFraction: number;
  /** Yearly projection of the balance. */
  yearly: Array<{ year: number; balance: number; contributed: number; interest: number }>;
  /** Estimated date the goal will be met. May be past the target date. */
  estimatedCompletion: string;
  onTrack: boolean;
}

export function summariseSavings(body: SavingsBody): SavingsSummary {
  const targetAmount = Math.max(0, body.targetAmount);
  const current = Math.max(0, body.currentSavings);
  const monthly = Math.max(0, body.monthlyContribution);
  const annualRate = Math.max(0, body.annualReturn) / 100;
  const monthlyRate = annualRate / 12;
  const monthsToGoal = monthsToReach(
    current,
    targetAmount,
    monthly,
    monthlyRate
  );
  const today = new Date();
  const completion = addMonths(today, monthsToGoal);
  const target = body.targetDate ? new Date(body.targetDate) : null;
  const monthsRemaining = target
    ? monthsBetween(today, target)
    : Math.max(0, Math.round(monthsToGoal));
  const yearly = projectSavings(current, monthly, monthlyRate, monthlyRate === 0 ? monthsToGoal : Math.max(monthsRemaining, monthsToGoal));
  const progress = targetAmount > 0 ? Math.min(1.5, current / targetAmount) : 0;
  return {
    monthsRemaining,
    yearsRemaining: monthsRemaining / 12,
    monthsToGoal,
    progressFraction: progress,
    yearly,
    estimatedCompletion: completion.toISOString().slice(0, 10),
    onTrack: monthsToGoal <= monthsRemaining,
  };
}

/**
 * Number of months to grow `principal` to `target` by contributing
 * `monthly` per month, with monthly compounding at `monthlyRate`.
 *
 * Uses the standard closed-form solution of the future-value of an
 * ordinary annuity. Returns 0 if the principal already meets the
 * target, and `Infinity` if the monthly contribution cannot reach the
 * target at the given rate.
 */
function monthsToReach(
  principal: number,
  target: number,
  monthly: number,
  monthlyRate: number
): number {
  if (target <= principal) return 0;
  if (monthly <= 0) return Number.POSITIVE_INFINITY;
  if (monthlyRate === 0) {
    return Math.ceil((target - principal) / monthly);
  }
  // FV = P*(1+r)^n + PMT * ((1+r)^n - 1) / r = target
  // Solve for n by iteration (closed form is awkward; a few hundred
  // iterations converge in microseconds for any practical horizon).
  let n = 0;
  let balance = principal;
  while (balance < target && n < 12 * 100) {
    balance = balance * (1 + monthlyRate) + monthly;
    n += 1;
  }
  return n === 12 * 100 ? Number.POSITIVE_INFINITY : n;
}

function addMonths(start: Date, months: number): Date {
  if (!Number.isFinite(months)) return new Date(start.getTime());
  const result = new Date(start);
  const wholeMonths = Math.floor(months);
  const frac = months - wholeMonths;
  result.setMonth(result.getMonth() + wholeMonths);
  const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(result.getDate(), daysInMonth));
  result.setDate(result.getDate() + Math.round(frac * daysInMonth));
  return result;
}

function monthsBetween(a: Date, b: Date): number {
  const years = b.getFullYear() - a.getFullYear();
  const months = b.getMonth() - a.getMonth();
  const days = b.getDate() - a.getDate();
  return years * 12 + months + days / 30;
}

function projectSavings(
  principal: number,
  monthly: number,
  monthlyRate: number,
  totalMonths: number
): Array<{ year: number; balance: number; contributed: number; interest: number }> {
  const result: Array<{ year: number; balance: number; contributed: number; interest: number }> = [];
  let balance = principal;
  let contributed = 0;
  let totalInterest = 0;
  const months = Math.max(0, Math.min(Math.round(totalMonths), 12 * 60));
  for (let m = 1; m <= months; m++) {
    const interest = balance * monthlyRate;
    balance = balance + interest + monthly;
    totalInterest += interest;
    contributed += monthly;
    if (m % 12 === 0) {
      result.push({
        year: m / 12,
        balance: Math.round(balance),
        contributed: Math.round(contributed),
        interest: Math.round(totalInterest),
      });
    }
  }
  return result;
}

export function evaluateSavings(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const body = readSavingsBody(calculation.body);
  if (body.targetAmount <= 0) {
    return {
      ok: false,
      error: "Set a target amount above zero.",
      lines: [],
    };
  }
  const summary = summariseSavings(body);
  const balanceSeries: FinanceChartSeries = {
    name: "Projected balance",
    points: summary.yearly.map((entry) => ({
      label: `Year ${entry.year}`,
      value: entry.balance,
    })),
  };
  const contributedSeries: FinanceChartSeries = {
    name: "Cumulative contribution",
    points: summary.yearly.map((entry) => ({
      label: `Year ${entry.year}`,
      value: entry.contributed,
    })),
  };
  const remaining = body.targetAmount - body.currentSavings;
  return {
    ok: true,
    lines: [
      { label: "Goal", value: body.goalName || "Savings goal" },
      { label: "Target", value: formatCurrency(body.targetAmount) },
      { label: "Current", value: formatCurrency(body.currentSavings) },
      { label: "Remaining", value: formatCurrency(remaining) },
      { label: "Progress", value: formatPercent(summary.progressFraction * 100) },
      { label: "Months to goal", value: Number.isFinite(summary.monthsToGoal) ? String(summary.monthsToGoal) : "—" },
      { label: "Estimated completion", value: summary.estimatedCompletion },
      {
        label: "On track",
        value: summary.onTrack ? "Yes" : "No",
      },
    ],
    series: [contributedSeries, balanceSeries],
  };
}

/* -------------------------------------------------------------------------- */
/* Net Worth Tracker                                                          */
/* -------------------------------------------------------------------------- */

export interface NetWorthBody {
  /** YYYY-MM snapshot month. */
  month: string;
  assets: Array<{
    id: string;
    category: string;
    label: string;
    amount: number;
  }>;
  liabilities: Array<{
    id: string;
    category: string;
    label: string;
    amount: number;
  }>;
  /** Historical monthly snapshots for the trend line. */
  history: Array<{
    id: string;
    month: string;
    netWorth: number;
  }>;
}

export const NET_WORTH_ASSET_CATEGORIES = [
  "Cash",
  "Bank account",
  "Fixed deposit",
  "Stocks",
  "Mutual funds",
  "Real estate",
  "Vehicle",
  "Other",
] as const;

export const NET_WORTH_LIABILITY_CATEGORIES = [
  "Home loan",
  "Car loan",
  "Personal loan",
  "Credit card",
  "Education loan",
  "Other",
] as const;

export function defaultNetWorthBody(): NetWorthBody {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    month,
    assets: [
      { id: "a-1", category: "Bank account", label: "Savings account", amount: 250_000 },
      { id: "a-2", category: "Fixed deposit", label: "FD ladder", amount: 500_000 },
      { id: "a-3", category: "Mutual funds", label: "Equity portfolio", amount: 850_000 },
      { id: "a-4", category: "Stocks", label: "Long-term holdings", amount: 320_000 },
      { id: "a-5", category: "Real estate", label: "Apartment (self-valuation)", amount: 7_500_000 },
      { id: "a-6", category: "Vehicle", label: "Car", amount: 650_000 },
    ],
    liabilities: [
      { id: "l-1", category: "Home loan", label: "Home loan principal outstanding", amount: 4_500_000 },
      { id: "l-2", category: "Car loan", label: "Car loan outstanding", amount: 350_000 },
      { id: "l-3", category: "Credit card", label: "Credit card balance", amount: 18_000 },
    ],
    history: buildSeedHistory(month, 1_900_000),
  };
}

/**
 * Builds a six-month history that trends up so the chart has a
 * recognisable shape on the first open. The current month is the
 * latest entry; the rest walk back from the actual computed net
 * worth with a small monthly drift.
 */
function buildSeedHistory(currentMonth: string, currentNetWorth: number): NetWorthBody["history"] {
  const result: NetWorthBody["history"] = [];
  const [yearStr, monthStr] = currentMonth.split("-");
  let year = Number(yearStr);
  let month = Number(monthStr);
  for (let i = 5; i >= 0; i--) {
    const drift = 1 - i * 0.015;
    const value = Math.max(0, Math.round(currentNetWorth * drift));
    const padded = String(month).padStart(2, "0");
    result.push({
      id: `h-${year}-${padded}`,
      month: `${year}-${padded}`,
      netWorth: value,
    });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return result.reverse();
}

export function readNetWorthBody(body: unknown): NetWorthBody {
  if (!body || typeof body !== "object") return defaultNetWorthBody();
  const raw = body as Record<string, unknown>;
  const month = typeof raw.month === "string" ? raw.month : "";
  const assets = Array.isArray(raw.assets)
    ? raw.assets
        .map((entry, index) => normaliseNetWorthEntry(entry, index, "asset"))
        .filter((entry): entry is NetWorthBody["assets"][number] => entry !== null)
    : [];
  const liabilities = Array.isArray(raw.liabilities)
    ? raw.liabilities
        .map((entry, index) => normaliseNetWorthEntry(entry, index, "liability"))
        .filter((entry): entry is NetWorthBody["liabilities"][number] => entry !== null)
    : [];
  const history = Array.isArray(raw.history)
    ? raw.history
        .map((entry, index) => normaliseHistoryEntry(entry, index))
        .filter((entry): entry is NetWorthBody["history"][number] => entry !== null)
    : [];
  return { month, assets, liabilities, history };
}

function normaliseNetWorthEntry(
  value: unknown,
  index: number,
  kind: "asset" | "liability"
): { id: string; category: string; label: string; amount: number } | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const label = typeof raw.label === "string" ? raw.label : "";
  if (!label) return null;
  const category = typeof raw.category === "string" ? raw.category : "Other";
  const amount = readNumber(raw, "amount", 0);
  return {
    id: typeof raw.id === "string" ? raw.id : `${kind[0]}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    label,
    amount,
  };
}

function normaliseHistoryEntry(
  value: unknown,
  index: number
): { id: string; month: string; netWorth: number } | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const month = typeof raw.month === "string" ? raw.month : "";
  if (!month) return null;
  const netWorth = readNumber(raw, "netWorth", 0);
  return {
    id: typeof raw.id === "string" ? raw.id : `h-${index}`,
    month,
    netWorth,
  };
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byAssetCategory: Array<{ category: string; amount: number }>;
  byLiabilityCategory: Array<{ category: string; amount: number }>;
  history: Array<{ month: string; netWorth: number }>;
}

export function summariseNetWorth(body: NetWorthBody): NetWorthSummary {
  const totalAssets = body.assets.reduce((acc, entry) => acc + Math.max(0, entry.amount), 0);
  const totalLiabilities = body.liabilities.reduce(
    (acc, entry) => acc + Math.max(0, entry.amount),
    0
  );
  const netWorth = totalAssets - totalLiabilities;
  const byAssetCategory = aggregate(body.assets);
  const byLiabilityCategory = aggregate(body.liabilities);
  let history = body.history
    .map((entry) => ({ month: entry.month, netWorth: entry.netWorth }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  if (body.month && !history.some((entry) => entry.month === body.month)) {
    history = [...history, { month: body.month, netWorth }];
  }
  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    byAssetCategory,
    byLiabilityCategory,
    history,
  };
}

function aggregate(
  entries: Array<{ category: string; amount: number }>
): Array<{ category: string; amount: number }> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.category, (map.get(entry.category) ?? 0) + Math.max(0, entry.amount));
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function evaluateNetWorth(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const body = readNetWorthBody(calculation.body);
  const summary = summariseNetWorth(body);
  const trend: FinanceChartSeries = {
    name: "Net worth",
    points: summary.history.map((entry) => ({
      label: entry.month,
      value: Math.round(entry.netWorth),
    })),
  };
  const assetsPie: FinanceChartSeries = {
    name: "Assets",
    points: summary.byAssetCategory.map((entry) => ({
      label: entry.category,
      value: Math.round(entry.amount),
    })),
  };
  const liabilitiesPie: FinanceChartSeries = {
    name: "Liabilities",
    points: summary.byLiabilityCategory.map((entry) => ({
      label: entry.category,
      value: Math.round(entry.amount),
    })),
  };
  return {
    ok: true,
    lines: [
      { label: "Month", value: body.month || "—" },
      { label: "Total assets", value: formatCurrency(summary.totalAssets) },
      { label: "Total liabilities", value: formatCurrency(summary.totalLiabilities) },
      {
        label: "Net worth",
        value: formatCurrency(summary.netWorth),
      },
    ],
    series: [trend, assetsPie, liabilitiesPie],
  };
}

/* -------------------------------------------------------------------------- */
/* Dispatcher                                                                 */
/* -------------------------------------------------------------------------- */

export type CalculatorKind =
  | "emi"
  | "sip"
  | "compound-interest"
  | "loan"
  | "budget"
  | "expense"
  | "savings"
  | "net-worth";

/**
 * Resolves a calculation to its runtime evaluator.
 *
 * The dispatcher is the single entry point used by the engine in
 * `./evaluate` and by the per-calculator surfaces that need a
 * consistent result for the right-rail properties panel.
 */
export function dispatch(calculation: FinanceCalculation): {
  kind: CalculatorKind;
  body: unknown;
  evaluate: (calculation: FinanceCalculation) => FinanceEvaluation;
} {
  switch (calculation.meta.kind) {
    case "emi":
      return { kind: "emi", body: calculation.body, evaluate: evaluateEmi };
    case "sip":
      return { kind: "sip", body: calculation.body, evaluate: evaluateSip };
    case "compound-interest":
      return {
        kind: "compound-interest",
        body: calculation.body,
        evaluate: evaluateCompoundInterest,
      };
    case "loan":
      return { kind: "loan", body: calculation.body, evaluate: evaluateLoan };
    case "budget":
      return {
        kind: "budget",
        body: calculation.body,
        evaluate: evaluateBudget,
      };
    case "expense":
      return {
        kind: "expense",
        body: calculation.body,
        evaluate: evaluateExpense,
      };
    case "savings":
      return {
        kind: "savings",
        body: calculation.body,
        evaluate: evaluateSavings,
      };
    case "net-worth":
      return {
        kind: "net-worth",
        body: calculation.body,
        evaluate: evaluateNetWorth,
      };
    default:
      return { kind: "emi", body: calculation.body, evaluate: evaluateEmi };
  }
}
