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
  let balance = 0;
  for (let period = 1; period <= n; period++) {
    const interest = balance * r;
    balance = balance + interest + monthlyInvestment;
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
/* Dispatcher                                                                 */
/* -------------------------------------------------------------------------- */

export type CalculatorKind =
  | "emi"
  | "sip"
  | "compound-interest"
  | "loan";

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
    default:
      return { kind: "emi", body: calculation.body, evaluate: evaluateEmi };
  }
}
