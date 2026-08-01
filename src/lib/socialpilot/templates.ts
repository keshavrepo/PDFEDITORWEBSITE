/**
 * SocialPilot template registry.
 *
 * The template list is product metadata: it tells the new-project menu
 * what is available, what category it belongs to, and what the starter
 * body looks like. Starter bodies are loaded lazily from the runtime
 * so the directory stays small and a project kind never imports a body
 * it does not need.
 *
 * Every registered project ships a blank-template descriptor so the
 * new-project menu has real entries out of the box. Future categories
 * can add richer templates here.
 */

import { projectCategoryOrder } from "./projects";
import type { SocialProjectCategory, SocialProjectKind, SocialTemplate } from "./types";

/**
 * Returns the default body for a project kind.
 *
 * The foundation only knows the "blank" body shape; future tools swap
 * the body for a real schema without changing the registry.
 */
export function createBlankBody(kind: SocialProjectKind): unknown {
  return {
    kind,
    notes: "",
    fields: {},
  };
}

/**
 * Static template descriptors. Starter bodies are loaded from
 * `createBlankBody` so the project stays the single source of truth
 * for its default inputs.
 */
export const templates: SocialTemplate[] = [
  {
    id: "social-blank",
    kind: "blank",
    category: "blank",
    name: "Blank project",
    description: "An empty project ready for any future tool.",
    hasStarter: true,
    highlights: ["Single screen", "Default fields", "Saves as you type"],
  },
  ...projectCategoryOrder
    .filter((category) => category !== "blank")
    .map<SocialTemplate>((category) => ({
      id: `social-${category}`,
      kind: category,
      category,
      name: `${category.charAt(0).toUpperCase()}${category.slice(1)} foundation`,
      description: `A blank ${category} project with the standard fields ready for the future ${category} tool.`,
      hasStarter: true,
      highlights: ["Single screen", "Default fields", "Saves as you type"],
    })),
];

/** Templates for a given project kind, including the project-kind template itself. */
export function templatesForKind(kind: SocialProjectKind): SocialTemplate[] {
  return templates.filter((template) => template.kind === kind);
}

/** Loads a starter body for a template. */
export function loadTemplateBody(template: SocialTemplate): unknown {
  return createBlankBody(template.kind);
}
