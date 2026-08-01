/**
 * FinancePilot template registry.
 *
 * The template list is product metadata: it tells the new-calculation
 * menu what is available, what category it belongs to, and what the
 * starter body looks like. Starter bodies are loaded lazily from the
 * per-calculator runtime so the directory stays small and a calculator
 * never imports a body it does not need.
 *
 * Every registered calculator ships a blank-template descriptor so the
 * new-calculation menu has real entries out of the box. Future
 * categories can add richer templates here.
 */

import type {
  FinanceCalculationCategory,
  FinanceTemplate,
} from "./types";
import { calculatorCategoryOrder } from "./calculators";
import {
  defaultBudgetBody,
  defaultCompoundInterestBody,
  defaultDashboardBody,
  defaultEmiBody,
  defaultExpenseBody,
  defaultGoalBody,
  defaultInvestmentBody,
  defaultLoanBody,
  defaultNetWorthBody,
  defaultRetirementBody,
  defaultSavingsBody,
  defaultSipBody,
} from "./calculator-runtime";

/**
 * Static template descriptors. The runtime bodies are loaded from
 * `calculator-runtime` so the calculator stays the single source of
 * truth for its default inputs.
 */
export const templates: FinanceTemplate[] = [
  {
    id: "finance-blank",
    kind: "blank",
    category: "blank",
    name: "Blank calculation",
    description: "An empty calculation ready for your inputs.",
    hasStarter: true,
    highlights: ["Single screen", "Default inputs", "Saves as you type"],
  },
  {
    id: "finance-emi",
    kind: "emi",
    category: "loan",
    name: "Home loan",
    description: "A typical 20-year home loan with an 8.5% rate.",
    hasStarter: true,
    highlights: ["₹25 lakh principal", "20 years", "8.5% p.a."],
  },
  {
    id: "finance-sip",
    kind: "sip",
    category: "investment",
    name: "Long-term SIP",
    description: "A 10-year ₹10,000 monthly SIP at 12% expected return.",
    hasStarter: true,
    highlights: ["₹10,000 / month", "10 years", "12% expected"],
  },
  {
    id: "finance-compound-interest",
    kind: "compound-interest",
    category: "savings",
    name: "Monthly compounding",
    description: "A 5-year ₹1 lakh deposit at 7% with monthly compounding.",
    hasStarter: true,
    highlights: ["₹1 lakh principal", "5 years", "7% p.a., monthly"],
  },
  {
    id: "finance-loan",
    kind: "loan",
    category: "loan",
    name: "Car loan with fees",
    description: "A 5-year ₹50 lakh car loan with a 10% down payment and a 1% processing fee.",
    hasStarter: true,
    highlights: ["₹50 lakh", "5 years", "₹5 lakh down, 1% fee"],
  },
  {
    id: "finance-budget",
    kind: "budget",
    category: "budget",
    name: "Monthly household budget",
    description: "A typical month of income, fixed and variable expenses with a remaining-budget readout.",
    hasStarter: true,
    highlights: ["Income + fixed + variable", "Category breakdown", "Remaining budget"],
  },
  {
    id: "finance-expense",
    kind: "expense",
    category: "budget",
    name: "Sample expenses",
    description: "Eight sample expenses for the current month, ready to search, filter and export.",
    hasStarter: true,
    highlights: ["8 entries", "Search & filter", "Daily + category charts"],
  },
  {
    id: "finance-savings",
    kind: "savings",
    category: "savings",
    name: "Two-year emergency fund",
    description: "A ₹6L emergency fund with ₹15,000 / month contributions and a 6% return assumption.",
    hasStarter: true,
    highlights: ["₹6L goal", "₹15K / month", "2-year horizon"],
  },
  {
    id: "finance-net-worth",
    kind: "net-worth",
    category: "savings",
    name: "Family balance sheet",
    description: "A household balance sheet with assets, liabilities and a 6-month historical trend.",
    hasStarter: true,
    highlights: ["6 assets", "3 liabilities", "6-month trend"],
  },
  {
    id: "finance-retirement",
    kind: "retirement",
    category: "retirement",
    name: "Retire at 60",
    description: "A 30-year-old planning to retire at 60 with a 70% income replacement.",
    hasStarter: true,
    highlights: ["30 → 60", "₹20K / month", "10% expected return"],
  },
  {
    id: "finance-investment",
    kind: "investment",
    category: "investment",
    name: "Wealth building",
    description: "A 15-year wealth-building plan with a 60/30/10 equity / debt / gold allocation.",
    hasStarter: true,
    highlights: ["₹50L target", "15 years", "60/30/10 allocation"],
  },
  {
    id: "finance-goal",
    kind: "goal",
    category: "savings",
    name: "Three-goal plan",
    description: "Three sample goals: home down payment, child's education and a world tour.",
    hasStarter: true,
    highlights: ["3 goals", "Mixed priorities", "Mixed horizons"],
  },
  {
    id: "finance-dashboard",
    kind: "dashboard",
    category: "savings",
    name: "Personal finance cockpit",
    description: "A pre-populated dashboard with assets, liabilities, savings history and insights.",
    hasStarter: true,
    highlights: ["Net worth + savings", "12-month history", "Quick insights"],
  },
];

/** Templates for one calculator kind, in the canonical category order. */
export function templatesForKind(kind: string): FinanceTemplate[] {
  const filtered = templates.filter((template) => template.kind === kind);
  return filtered.sort(
    (a, b) =>
      calculatorCategoryOrder.indexOf(a.category) -
      calculatorCategoryOrder.indexOf(b.category)
  );
}

/** All templates in one category, across calculator kinds. */
export function templatesForCategory(
  category: FinanceCalculationCategory
): FinanceTemplate[] {
  return templates.filter((template) => template.category === category);
}

export function getTemplate(id: string): FinanceTemplate | undefined {
  return templates.find((template) => template.id === id);
}

/**
 * Returns a starter body for a template.
 *
 * The "blank" entry returns an empty body. Calculator templates load
 * their default body from the runtime so the input form has the
 * suggested starting values pre-filled.
 */
export function loadTemplateBody(template: FinanceTemplate): unknown {
  if (template.hasStarter) {
    switch (template.id) {
      case "finance-blank":
        return {};
      case "finance-emi":
        return defaultEmiBody();
      case "finance-sip":
        return defaultSipBody();
      case "finance-compound-interest":
        return defaultCompoundInterestBody();
      case "finance-loan":
        return defaultLoanBody();
      case "finance-budget":
        return defaultBudgetBody();
      case "finance-expense":
        return defaultExpenseBody();
      case "finance-savings":
        return defaultSavingsBody();
      case "finance-net-worth":
        return defaultNetWorthBody();
      case "finance-retirement":
        return defaultRetirementBody();
      case "finance-investment":
        return defaultInvestmentBody();
      case "finance-goal":
        return defaultGoalBody();
      case "finance-dashboard":
        return defaultDashboardBody();
      default:
        if (template.kind === "blank") return {};
        return {};
    }
  }
  return {};
}

/** Default body for a brand-new calculation of a given kind. */
export function createBlankBody(kind: string): unknown {
  switch (kind) {
    case "emi":
      return defaultEmiBody();
    case "sip":
      return defaultSipBody();
    case "compound-interest":
      return defaultCompoundInterestBody();
    case "loan":
      return defaultLoanBody();
    case "budget":
      return defaultBudgetBody();
    case "expense":
      return defaultExpenseBody();
    case "savings":
      return defaultSavingsBody();
    case "net-worth":
      return defaultNetWorthBody();
    case "retirement":
      return defaultRetirementBody();
    case "investment":
      return defaultInvestmentBody();
    case "goal":
      return defaultGoalBody();
    case "dashboard":
      return defaultDashboardBody();
    default:
      return {};
  }
}
