/**
 * FinancePilot calculator registry.
 *
 * The foundation ships with a list of calculator categories. Each future
 * calculator registers itself in the `calculators` array and gets picked
 * up by the workspace shell, the search index and the products page.
 *
 * Mirrors the ImagePilot `workspaces.ts` shape: a small typed array and
 * a couple of lookup helpers, so a reader who knows one product knows
 * all three.
 */

import type {
  FinanceCalculationCategory,
  FinanceCalculatorDefinition,
  FinanceCalculatorKind,
} from "./types";

/** Calculator categories in the order they appear in the new-calculation menu. */
export const calculatorCategoryOrder: FinanceCalculationCategory[] = [
  "blank",
  "loan",
  "mortgage",
  "compound-interest",
  "savings",
  "investment",
  "tax",
  "currency",
  "budget",
  "invoice",
  "roi",
  "break-even",
  "discount",
  "tip",
  "retirement",
  "debt",
  "cash-flow",
  "custom",
];

/** Human-readable label for a category. */
export const calculatorCategoryLabels: Record<FinanceCalculationCategory, string> = {
  blank: "Blank",
  loan: "Loan",
  mortgage: "Mortgage",
  "compound-interest": "Compound interest",
  savings: "Savings",
  investment: "Investment",
  tax: "Tax",
  currency: "Currency",
  budget: "Budget",
  invoice: "Invoice",
  roi: "Return on investment",
  "break-even": "Break-even",
  discount: "Discount",
  tip: "Tip",
  retirement: "Retirement",
  debt: "Debt payoff",
  "cash-flow": "Cash flow",
  custom: "Custom",
};

/** Short description for each category, used as the menu section header. */
export const calculatorCategoryDescriptions: Record<FinanceCalculationCategory, string> = {
  blank: "Start from an empty calculation",
  loan: "Fixed payment and total interest",
  mortgage: "Home loan amortisation",
  "compound-interest": "Growth with reinvested returns",
  savings: "Reach a savings goal",
  investment: "Project returns on a portfolio",
  tax: "Bracket and effective rate",
  currency: "Convert and round-trip rates",
  budget: "Income, expenses and balance",
  invoice: "Line items, tax and totals",
  roi: "Compare an investment's payoff",
  "break-even": "When revenue covers cost",
  discount: "Sale price from a discount",
  tip: "Split a bill fairly",
  retirement: "Plan withdrawals over retirement",
  debt: "Payoff schedule and interest saved",
  "cash-flow": "Net cash across periods",
  custom: "Anything else you build",
};

/**
 * Registered calculators.
 *
 * The foundation intentionally starts empty: no calculators ship until a
 * future PR adds the first one. The array stays here so the workspace
 * shell, the search index and the products page can iterate it without
 * branching on whether anything has been registered yet.
 */
export const calculators: FinanceCalculatorDefinition[] = [];

export function getCalculator(
  kind: FinanceCalculatorKind
): FinanceCalculatorDefinition | undefined {
  return calculators.find((calculator) => calculator.kind === kind);
}

export function getCalculatorBySlug(
  slug: string
): FinanceCalculatorDefinition | undefined {
  return calculators.find((calculator) => calculator.slug === slug);
}

/** Calculators that are not the default landing calculator, used in directory listings. */
export const focusedCalculators = calculators.filter(
  (calculator) => calculator.slug !== ""
);

/** Route for a calculator, e.g. `/financepilot/loan`. */
export function calculatorHref(calculator: FinanceCalculatorDefinition): string {
  return calculator.slug ? `/financepilot/${calculator.slug}` : "/financepilot";
}

/** Calculators for the directory, sorted by their category order. */
export function calculatorsForCategory(
  category: FinanceCalculationCategory
): FinanceCalculatorDefinition[] {
  return calculators.filter((calculator) => calculator.defaultCategory === category);
}
