/**
 * FinancePilot template registry.
 *
 * The template list is product metadata: it tells the new-calculation
 * menu what is available, what category it belongs to, and what the
 * starter body looks like. Starter bodies are loaded lazily from a
 * separate module so the directory stays small and a calculator never
 * imports a body it does not need.
 *
 * The foundation ships with one entry (a blank calculation) so the
 * workspace always has something to render. Future calculators register
 * their own templates next to the calculator code.
 */

import type {
  FinanceCalculation,
  FinanceCalculationCategory,
  FinanceTemplate,
} from "./types";
import { calculatorCategoryOrder } from "./calculators";

/** A blank calculation starter — every future calculator can clone this shape. */
function blankCalculation(
  id: string,
  kind: string,
  title: string,
  category: FinanceCalculationCategory
): FinanceCalculation {
  const now = new Date().toISOString();
  return {
    meta: {
      id,
      kind,
      title,
      category,
      createdAt: now,
      updatedAt: now,
      autosavedAt: null,
      version: 1,
      size: 0,
    },
    body: {},
  };
}

/**
 * Static template descriptors.
 *
 * The foundation only ships the blank entry. Future calculators add their
 * own templates next to the calculator code so the directory stays
 * product-owned.
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
 * The "blank" entry returns a real starter so the calculator always has
 * a body to render. Every other category is reserved for a future
 * calculator batch and falls back to a blank body so the workspace
 * stays usable in the meantime.
 */
export function loadTemplateBody(template: FinanceTemplate): unknown {
  if (template.hasStarter && template.id === "finance-blank") {
    return blankCalculation(
      `fin-${Date.now().toString(36)}`,
      template.kind,
      template.name,
      template.category
    ).body;
  }
  return {};
}

/** Default body for a brand-new calculation of a given kind. */
export function createBlankBody(kind: string): unknown {
  return {};
}
