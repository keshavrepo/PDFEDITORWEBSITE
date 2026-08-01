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
  {
    id: "finance-budget",
    kind: "budget",
    slug: "budget",
    name: "Budget Planner",
    tagline: "Plan a month of income and expenses with a remaining-budget readout",
    description:
      "Set a monthly budget with income, fixed expenses and variable expenses. The workspace shows the remaining budget, a category breakdown of variable spending and a monthly summary that exports to PDF.",
    intro:
      "Add income, fixed expenses and variable expenses for a month. The workspace computes the remaining budget, a category breakdown of variable spending and a monthly summary, then lets you save the budget or export it as a PDF.",
    defaultCategory: "budget",
    keywords: [
      "budget",
      "monthly budget",
      "income",
      "expenses",
      "category",
      "FinancePilot",
    ],
    highlights: ["Income", "Fixed and variable expenses", "Remaining budget", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-expense",
    kind: "expense",
    slug: "expense",
    name: "Expense Tracker",
    tagline: "Track every expense with category, payment method and notes",
    description:
      "Capture every expense with a date, category, payment method and notes. The workspace supports search, filter and sort, shows a daily and category breakdown and exports the list as a PDF.",
    intro:
      "Add expenses with a date, category, payment method and notes. The workspace supports search, filter and sort, shows a daily and category breakdown, a monthly summary and exports the list as a PDF.",
    defaultCategory: "budget",
    keywords: [
      "expense",
      "expense tracker",
      "spend",
      "category",
      "payment method",
      "FinancePilot",
    ],
    highlights: ["Search & filter", "Daily breakdown", "Monthly summary", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-savings",
    kind: "savings",
    slug: "savings",
    name: "Savings Planner",
    tagline: "Project when a savings goal is met and how contributions compound",
    description:
      "Set a savings goal, current savings and a monthly contribution. The workspace shows the progress percentage, the months remaining, the estimated completion date and a yearly projection of the balance.",
    intro:
      "Type the goal name, target amount, current savings, monthly contribution and a target date. The workspace computes the progress percentage, the months remaining, the estimated completion date and a yearly projection, then lets you save the plan or export it as a PDF.",
    defaultCategory: "savings",
    keywords: [
      "savings",
      "savings goal",
      "monthly contribution",
      "target",
      "FinancePilot",
    ],
    highlights: ["Progress tracking", "Estimated completion", "Yearly chart", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-net-worth",
    kind: "net-worth",
    slug: "net-worth",
    name: "Net Worth Tracker",
    tagline: "Assets minus liabilities, with a historical timeline",
    description:
      "Track assets and liabilities by category. The workspace shows the total assets, total liabilities, net worth, a category breakdown of assets and liabilities, and a historical monthly timeline.",
    intro:
      "Add assets and liabilities by category. The workspace computes the total assets, total liabilities, net worth, a category breakdown and a historical monthly timeline, then lets you save the snapshot or export it as a PDF.",
    defaultCategory: "savings",
    keywords: [
      "net worth",
      "assets",
      "liabilities",
      "balance sheet",
      "FinancePilot",
    ],
    highlights: ["Assets & liabilities", "Net worth", "Historical timeline", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-retirement",
    kind: "retirement",
    slug: "retirement",
    name: "Retirement Planner",
    tagline: "Project the corpus, the income and the on-track flag",
    description:
      "Set the current age, retirement age, current savings, monthly contribution, expected return, inflation rate and years in retirement. The workspace shows the corpus at retirement, the required corpus, the estimated monthly income, a yearly projection and an on-track flag.",
    intro:
      "Type the current age, retirement age, current savings, monthly contribution, expected return, inflation rate, years in retirement, replacement ratio and current income. The workspace computes the corpus at retirement, the required corpus, the inflation-adjusted corpus, the estimated monthly income, a yearly projection and an on-track flag, then lets you save the plan or export it as a PDF.",
    defaultCategory: "retirement",
    keywords: [
      "retirement",
      "retirement planner",
      "corpus",
      "pension",
      "FinancePilot",
    ],
    highlights: [
      "Required corpus",
      "Inflation adjustment",
      "Yearly projection",
      "Export PDF",
    ],
    toolCount: 1,
  },
  {
    id: "finance-investment",
    kind: "investment",
    slug: "investment",
    name: "Investment Planner",
    tagline: "Project an investment goal with risk profile and allocation",
    description:
      "Set a goal name, target amount, time horizon, monthly contribution, risk profile and allocation. The workspace shows the projected value, the expected return, the progress, the allocation breakdown, a yearly projection and a suggested monthly contribution.",
    intro:
      "Type the goal name, target amount, time horizon, monthly contribution, risk profile and allocation. The workspace computes the projected value, the expected return, the progress, the allocation breakdown, a yearly projection and a suggested monthly contribution, then lets you save the plan or export it as a PDF.",
    defaultCategory: "investment",
    keywords: [
      "investment",
      "investment planner",
      "portfolio",
      "allocation",
      "FinancePilot",
    ],
    highlights: [
      "Risk profile",
      "Allocation summary",
      "Growth projection",
      "Export PDF",
    ],
    toolCount: 1,
  },
  {
    id: "finance-goal",
    kind: "goal",
    slug: "goal",
    name: "Goal Planner",
    tagline: "Track every financial goal in one place",
    description:
      "Add as many financial goals as you like with a target amount, current amount, target date, monthly contribution, expected return and priority. The workspace shows the progress, the on-track flag, the timeline and the monthly requirement for each goal.",
    intro:
      "Add financial goals with a target amount, current amount, target date, monthly contribution, expected return and priority. The workspace computes the progress, the on-track flag, the timeline and the monthly requirement for each goal, then lets you save the plan or export it as a PDF.",
    defaultCategory: "savings",
    keywords: [
      "goal",
      "goal planner",
      "financial goal",
      "target",
      "FinancePilot",
    ],
    highlights: ["Multiple goals", "Priority", "Timeline", "Export PDF"],
    toolCount: 1,
  },
  {
    id: "finance-dashboard",
    kind: "dashboard",
    slug: "dashboard",
    name: "Financial Dashboard",
    tagline: "A single screen for every FinancePilot metric",
    description:
      "See total assets, total liabilities, net worth, monthly savings, budget status, active goals, investment summary, charts and quick insights on one page.",
    intro:
      "The dashboard surfaces every FinancePilot metric on a single page: total assets, total liabilities, net worth, monthly savings, budget status, active goals, investment summary, a net worth trend chart, a monthly savings chart and a list of quick insights. Save the dashboard or export it as a PDF.",
    defaultCategory: "savings",
    keywords: [
      "dashboard",
      "financial dashboard",
      "net worth",
      "savings",
      "FinancePilot",
    ],
    highlights: ["Net worth", "Budget status", "Charts", "Quick insights"],
    toolCount: 1,
  },
  {
    id: "finance-health-score",
    kind: "health-score",
    slug: "health-score",
    name: "Financial Health Score",
    tagline: "0–100 score across emergency fund, debt, savings, insurance and goals",
    description:
      "Get a 0–100 financial health score with category breakdowns (emergency fund, debt ratio, savings rate, investment ratio, insurance coverage, goal progress) and prioritised improvement suggestions.",
    intro:
      "Type the monthly income, monthly expenses, emergency fund, total debt, monthly debt service, invested amount, insurance policies, active goals and goals on track. The workspace computes the overall score, the per-category score and the most impactful improvement suggestion, then lets you save the plan or export it as a PDF.",
    defaultCategory: "savings",
    keywords: [
      "health score",
      "financial health",
      "score",
      "improvement",
      "FinancePilot",
    ],
    highlights: [
      "0–100 overall score",
      "6 category scores",
      "Improvement suggestions",
      "Export PDF",
    ],
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
