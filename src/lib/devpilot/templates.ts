/**
 * DevPilot template registry.
 *
 * The template list is product metadata: it tells the new-session menu
 * what is available, what category it belongs to, and what the starter
 * body looks like. Starter bodies are loaded lazily from the runtime
 * so the directory stays small and a session kind never imports a body
 * it does not need.
 *
 * Every registered session ships a blank-template descriptor so the
 * new-session menu has real entries out of the box. Future categories
 * can add richer templates here.
 *
 * Mirrors the SocialPilot / FinancePilot `templates.ts` shape.
 */

import { sessionCategoryOrder } from "./sessions";
import type {
  DevSessionCategory,
  DevSessionKind,
  DevTemplate,
} from "./types";

/**
 * Returns the default body for a session kind.
 *
 * The foundation only knows the "blank" body shape; future tools swap
 * the body for a real schema without changing the registry.
 */
export function createBlankBody(kind: DevSessionKind): unknown {
  return {
    kind,
    notes: "",
    fields: {},
  };
}

/**
 * Static template descriptors. Starter bodies are loaded from
 * `createBlankBody` so the session stays the single source of truth
 * for its default inputs.
 */
export const templates: DevTemplate[] = [
  {
    id: "dev-blank",
    kind: "blank",
    category: "blank",
    name: "Blank session",
    description: "An empty session ready for any future tool.",
    hasStarter: true,
    highlights: ["Single screen", "Default fields", "Saves as you type"],
  },
  ...sessionCategoryOrder
    .filter((category) => category !== "blank")
    .map<DevTemplate>((category) => ({
      id: `dev-${category}`,
      kind: category,
      category,
      name: `${category.charAt(0).toUpperCase()}${category.slice(1)} foundation`,
      description: `A blank ${category} session with the standard fields ready for the future ${category} tool.`,
      hasStarter: true,
      highlights: ["Single screen", "Default fields", "Saves as you type"],
    })),
];

/** Templates for a given session kind, including the session-kind template itself. */
export function templatesForKind(kind: DevSessionKind): DevTemplate[] {
  return templates.filter((template) => template.kind === kind);
}

/** Loads a starter body for a template. */
export function loadTemplateBody(template: DevTemplate): unknown {
  return createBlankBody(template.kind);
}
