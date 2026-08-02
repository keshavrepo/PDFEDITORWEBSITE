/**
 * WebPilot template registry.
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
 * Mirrors the SocialPilot / FinancePilot / DevPilot `templates.ts`
 * shape.
 */

import { sessionCategoryOrder } from "./sessions";
import {
  DEFAULT_ASSETS_BODY,
  DEFAULT_CSS_BODY,
  DEFAULT_HISTORY_BODY,
  DEFAULT_HTML_BODY,
  DEFAULT_JS_BODY,
  DEFAULT_PREVIEW_BODY,
  DEFAULT_PROJECTS_BODY,
  DEFAULT_SEARCH_BODY,
  DEFAULT_UTILITIES_BODY,
  DEFAULT_WORKSPACE_BODY,
  cloneProjectsBody,
} from "./bodies";
import type {
  WebSessionCategory,
  WebSessionKind,
  WebTemplate,
} from "./types";

/**
 * Returns the default body for a session kind.
 *
 * Each registered kind maps to its typed default body so the new-session
 * menu and the runtime both speak the same schema.
 */
export function createBlankBody(kind: WebSessionKind): unknown {
  switch (kind) {
    case "html":
      return { ...DEFAULT_HTML_BODY };
    case "css":
      return { ...DEFAULT_CSS_BODY };
    case "javascript":
      return { ...DEFAULT_JS_BODY };
    case "preview":
      return { ...DEFAULT_PREVIEW_BODY };
    case "history":
      return { ...DEFAULT_HISTORY_BODY };
    case "projects":
      return cloneProjectsBody(DEFAULT_PROJECTS_BODY);
    case "assets":
      return { ...DEFAULT_ASSETS_BODY };
    case "workspace":
      return { ...DEFAULT_WORKSPACE_BODY };
    case "search":
      return { ...DEFAULT_SEARCH_BODY };
    case "utilities":
      return { ...DEFAULT_UTILITIES_BODY };
    case "blank":
    case "custom":
    default:
      return {
        kind,
        notes: "",
        fields: {},
      };
  }
}

/**
 * Static template descriptors. Starter bodies are loaded from
 * `createBlankBody` so the session stays the single source of truth
 * for its default inputs.
 */
export const templates: WebTemplate[] = [
  {
    id: "web-blank",
    kind: "blank",
    category: "blank",
    name: "Blank session",
    description: "An empty session ready for any future web tool.",
    hasStarter: true,
    highlights: ["Single screen", "Default fields", "Saves as you type"],
  },
  ...sessionCategoryOrder
    .filter((category) => category !== "blank")
    .map<WebTemplate>((category) => ({
      id: `web-${category}`,
      kind: category,
      category,
      name: `${category.charAt(0).toUpperCase()}${category.slice(1)} foundation`,
      description: `A blank ${category} session with the standard fields ready for the future ${category} tool.`,
      hasStarter: true,
      highlights: ["Single screen", "Default fields", "Saves as you type"],
    })),
];

/** Templates for a given session kind, including the session-kind template itself. */
export function templatesForKind(kind: WebSessionKind): WebTemplate[] {
  return templates.filter((template) => template.kind === kind);
}

/** Loads a starter body for a template. */
export function loadTemplateBody(template: WebTemplate): unknown {
  return createBlankBody(template.kind);
}
