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
 * The array is the single source of truth for which calculators the
 * workspace shell mounts, which calculators the products page lists,
 * and which calculators the search index surfaces. Adding a new
 * calculator means appending one descriptor here.
 */
export const calculators: FinanceCalculatorDefinition[] = [
  {
    id: "finance-emi",
    kind: "emi",
    slug: "emi",
    name: "EMI Calculator",
    tagline: "Monthly payments, total interest and amortisation",
    description:
      "Compute the Equated Monthly Instalment for any fixed-rate loan. See the total interest, the total payment, and a full amortisation schedule with a pie chart of principal versus interest.",
    intro:
      "Type a loan amount, an annual interest rate and a tenure. The workspace computes the EMI, the total interest, the total payment, an amortisation table and a pie chart, then lets you save the calculation or export it as a PDF.",
    defaultCategory: "loan",
    keywords: [
      "EMI",
      "loan",
      "amortisation",
      "monthly payment",
      "interest",
      "FinancePilot",
    ],
    highlights: ["EMI", "Amortisation schedule", "Pie chart", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-sip",
    kind: "sip",
    slug: "sip",
    name: "SIP Calculator",
    tagline: "Project a Systematic Investment Plan to its final value",
    description:
      "See how a monthly SIP grows over time. The workspace shows the total investment, the estimated returns, the final value and a year-by-year growth chart.",
    intro:
      "Type the monthly investment, the expected return rate and the duration. The workspace computes the final value, the total invested, the estimated returns and a growth chart, then lets you save the calculation or export it as a PDF.",
    defaultCategory: "investment",
    keywords: [
      "SIP",
      "systematic investment plan",
      "mutual fund",
      "growth",
      "FinancePilot",
    ],
    highlights: ["Total investment", "Estimated returns", "Growth chart", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-compound-interest",
    kind: "compound-interest",
    slug: "compound-interest",
    name: "Compound Interest Calculator",
    tagline: "See compounding frequency reshape your returns",
    description:
      "Project a principal through monthly, quarterly, half-yearly or daily compounding. The workspace shows the final amount, the interest earned and a year-by-year growth chart.",
    intro:
      "Type a principal, an annual rate, a compounding frequency and a duration. The workspace computes the final amount, the interest earned and a growth chart, then lets you save the calculation or export it as a PDF.",
    defaultCategory: "savings",
    keywords: [
      "compound interest",
      "compounding",
      "growth",
      "savings",
      "FinancePilot",
    ],
    highlights: ["Final amount", "Interest earned", "Growth chart", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-loan",
    kind: "loan",
    slug: "loan",
    name: "Loan Calculator",
    tagline: "True loan cost with down payment and processing fee",
    description:
      "Compute the monthly payment, total interest and total cost of a loan after the down payment and the processing fee. The workspace shows an amortisation table and a pie chart of principal versus interest.",
    intro:
      "Type the loan amount, the annual interest rate, the tenure, the processing fee and the down payment. The workspace computes the monthly payment, the total interest, the total cost, an amortisation table and a pie chart, then lets you save the calculation or export it as a PDF.",
    defaultCategory: "loan",
    keywords: [
      "loan",
      "down payment",
      "processing fee",
      "amortisation",
      "FinancePilot",
    ],
    highlights: ["Monthly payment", "Total cost", "Amortisation table", "Export PDF"],
    toolCount: 1,
  },
];

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
