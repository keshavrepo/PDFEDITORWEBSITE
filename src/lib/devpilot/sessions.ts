/**
 * DevPilot session registry.
 *
 * The foundation ships with a list of session categories. Each future
 * session registers itself in the `sessions` array and gets picked up
 * by the workspace shell, the search index and the products page.
 *
 * Mirrors the SocialPilot `projects.ts` and FinancePilot
 * `calculators.ts` shape: a small typed array and a couple of lookup
 * helpers, so a reader who knows one product knows all of them.
 */

import type {
  DevSessionCategory,
  DevSessionDefinition,
  DevSessionKind,
} from "./types";

/** Session categories in the order they appear in the new-session menu. */
export const sessionCategoryOrder: DevSessionCategory[] = [
  "blank",
  "snippet",
  "history",
  "custom",
];

/** Human-readable label for a category. */
export const sessionCategoryLabels: Record<DevSessionCategory, string> = {
  blank: "Blank",
  snippet: "Snippet",
  history: "History",
  custom: "Custom",
};

/** Short description for each category, used as the menu section header. */
export const sessionCategoryDescriptions: Record<DevSessionCategory, string> = {
  blank: "Start from an empty session",
  snippet: "Reusable code snippet with categories, languages and favourites",
  history: "Per-tool history with recent and favourites",
  custom: "Anything else you build",
};

/**
 * Registered sessions.
 *
 * The array is the single source of truth for which sessions the
 * workspace shell mounts, which sessions the products page lists, and
 * which sessions the search index surfaces. Adding a new session
 * means appending one descriptor here.
 *
 * Batch 1 ships the foundation: every session kind is a placeholder
 * with the right shape so the workspace shell and the navigation rail
 * show real entries out of the box. Future batches swap placeholders
 * for real editor surfaces.
 */
export const sessions: DevSessionDefinition[] = [
  {
    id: "dev-dashboard",
    kind: "dashboard",
    slug: "dashboard",
    name: "Workspace dashboard",
    tagline: "A one-page summary of your DevPilot workspace",
    description:
      "The Workspace Dashboard surfaces every important surface in one place: recent sessions, recent and favourite history, the active snippet library, the per-tool history summary, and quick links to every other DevPilot surface. The dashboard is the default landing surface for every DevPilot session.",
    intro:
      "Open the Workspace Dashboard to see every DevPilot surface in one place. The dashboard reads from the same IndexedDB-backed store the rest of the workspace uses, so the data is always in sync.",
    defaultCategory: "blank",
    keywords: ["dashboard", "summary", "DevPilot"],
    highlights: [
      "Recent sessions",
      "Recent and favourite history",
      "Snippet library summary",
      "Quick links to every surface",
    ],
    toolCount: 1,
  },
  {
    id: "dev-blank",
    kind: "blank",
    slug: "",
    name: "Blank session",
    tagline: "Start from an empty canvas",
    description:
      "An empty DevPilot session ready for any future tool. The workspace saves automatically, mirrors to the server, and lets you organise the session with tags and favourites.",
    intro:
      "Create a blank DevPilot session. The workspace will hold the body, save it automatically, and surface it on the dashboard. Future tools (formatter, validator, encoder, generator) will replace this blank with their own surface.",
    defaultCategory: "blank",
    keywords: ["blank", "session", "DevPilot"],
    highlights: ["Empty body", "Autosaves", "Mirrored to the dashboard"],
    toolCount: 1,
  },
  {
    id: "dev-snippet",
    kind: "snippet",
    slug: "snippets",
    name: "Developer snippets",
    tagline: "Reusable snippets with categories, languages and favourites",
    description:
      "Save the snippets you reach for every day. Group them by category, tag them by language, search across the library, favourite the ones you reuse, duplicate a snippet to branch from it, and find any snippet in seconds.",
    intro:
      "The Developer Snippets surface holds the snippets you reuse. Create a new snippet from the new-session menu, give it a category, a language, and find it from the search. The autosave loop keeps the library up to date.",
    defaultCategory: "snippet",
    keywords: ["snippet", "developer", "code", "DevPilot"],
    highlights: [
      "Categories and languages",
      "Search",
      "Favourite",
      "Duplicate and delete",
    ],
    toolCount: 1,
  },
  {
    id: "dev-history",
    kind: "history",
    slug: "history",
    name: "Developer history",
    tagline: "Per-tool recent and favourites, search and restore",
    description:
      "Maintain a history for every tool. Recent entries appear on the dashboard and the rail; favourites are pinned; search finds any entry in seconds. Restore an entry back to its source surface with one click.",
    intro:
      "The Developer History surface holds the recent and favourite entries every tool records. Switch the tool filter to focus on one tool at a time, search across the full history, and restore any entry to its source surface. The autosave loop keeps the history in sync.",
    defaultCategory: "history",
    keywords: ["history", "recent", "favourites", "DevPilot"],
    highlights: [
      "Per-tool recent and favourites",
      "Search",
      "Restore",
      "Favourite toggle",
    ],
    toolCount: 1,
  },
];

export function getSession(
  kind: DevSessionKind
): DevSessionDefinition | undefined {
  return sessions.find((session) => session.kind === kind);
}

export function getSessionBySlug(
  slug: string
): DevSessionDefinition | undefined {
  return sessions.find((session) => session.slug === slug);
}

/** Sessions that are not the default landing session, used in directory listings. */
export const focusedSessions = sessions.filter((session) => session.slug !== "");

/** Route for a session, e.g. `/devpilot/snippets`. */
export function sessionHref(session: DevSessionDefinition): string {
  return session.slug ? `/devpilot/${session.slug}` : "/devpilot";
}

/** Sessions for the directory, sorted by their category order. */
export function sessionsForCategory(
  category: DevSessionCategory
): DevSessionDefinition[] {
  return sessions.filter((session) => session.defaultCategory === category);
}
