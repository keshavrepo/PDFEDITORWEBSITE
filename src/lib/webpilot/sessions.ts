/**
 * WebPilot session registry.
 *
 * The foundation ships with a list of session categories. Each future
 * session registers itself in the `sessions` array and gets picked up
 * by the workspace shell, the search index and the products page.
 *
 * Mirrors the SocialPilot / FinancePilot / DevPilot sessions shape: a
 * small typed array and a couple of lookup helpers, so a reader who
 * knows one product knows all of them.
 */

import type {
  WebSessionCategory,
  WebSessionDefinition,
  WebSessionKind,
} from "./types";

/** Session categories in the order they appear in the new-session menu. */
export const sessionCategoryOrder: WebSessionCategory[] = [
  "blank",
  "html",
  "css",
  "javascript",
  "preview",
  "history",
  "custom",
];

/** Human-readable label for a category. */
export const sessionCategoryLabels: Record<WebSessionCategory, string> = {
  blank: "Blank",
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  preview: "Live Preview",
  history: "History",
  custom: "Custom",
};

/** Short description for each category, used as the menu section header. */
export const sessionCategoryDescriptions: Record<WebSessionCategory, string> = {
  blank: "Start from an empty session",
  html: "Syntax-highlighted HTML editor with line numbers, find and replace, undo and redo, format, minify, beautify, word wrap, import and export",
  css: "Syntax-highlighted CSS editor with auto-complete, color preview, variable detection, format, minify, beautify, import and export",
  javascript:
    "Syntax-highlighted JavaScript editor with auto-complete, format, minify, beautify, console preview, import and export",
  preview: "Live browser preview that combines HTML, CSS and JavaScript into a single working surface",
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
 */
export const sessions: WebSessionDefinition[] = [
  {
    id: "web-dashboard",
    kind: "dashboard",
    slug: "dashboard",
    name: "Workspace dashboard",
    tagline: "A one-page summary of your WebPilot workspace",
    description:
      "The Workspace Dashboard surfaces every important surface in one place: recent sessions, recent and favourite history, the active favourite tools, the favourite-tool registry, the per-tool usage breakdown, and quick links to every other WebPilot surface. The dashboard is the default landing surface for every WebPilot session.",
    intro:
      "Open the Workspace Dashboard to see every WebPilot surface in one place. The dashboard reads from the same IndexedDB-backed store the rest of the workspace uses, so the data is always in sync.",
    defaultCategory: "blank",
    keywords: ["dashboard", "summary", "WebPilot"],
    highlights: [
      "Recent sessions",
      "Recent and favourite history",
      "Favourite tools",
      "Quick links to every surface",
    ],
    toolCount: 1,
  },
  {
    id: "web-blank",
    kind: "blank",
    slug: "",
    name: "Blank session",
    tagline: "Start from an empty canvas",
    description:
      "An empty WebPilot session ready for any future tool. The workspace saves automatically, mirrors to the server, and lets you organise the session with tags and favourites.",
    intro:
      "Create a blank WebPilot session. The workspace will hold the body, save it automatically, and surface it on the dashboard. Future tools (SEO, metadata, asset generation) will replace this blank with their own surface.",
    defaultCategory: "blank",
    keywords: ["blank", "session", "WebPilot"],
    highlights: ["Empty body", "Autosaves", "Mirrored to the dashboard"],
    toolCount: 1,
  },
  {
    id: "web-history",
    kind: "history",
    slug: "history",
    name: "Web history",
    tagline: "Per-tool recent and favourites, search and restore",
    description:
      "Maintain a history for every tool. Recent entries appear on the dashboard and the rail; favourites are pinned; search finds any entry in seconds. Restore an entry back to its source surface with one click.",
    intro:
      "The Web History surface holds the recent and favourite entries every tool records. Switch the tool filter to focus on one tool at a time, search across the full history, and restore any entry to its source surface. The autosave loop keeps the history in sync.",
    defaultCategory: "history",
    keywords: ["history", "recent", "favourites", "WebPilot"],
    highlights: [
      "Per-tool recent and favourites",
      "Search",
      "Restore",
      "Favourite toggle",
    ],
    toolCount: 1,
  },
  {
    id: "web-html",
    kind: "html",
    slug: "html",
    name: "HTML editor",
    tagline:
      "Syntax-highlighted HTML with line numbers, find and replace, undo, redo, format, minify, beautify, word wrap, import and export",
    description:
      "A professional HTML editor. Type or paste HTML, see the syntax highlighted in real time, browse with line numbers, find and replace across the document, undo and redo, format, minify, beautify, toggle word wrap, import a file and export the result.",
    intro:
      "Open the HTML editor to write markup with syntax highlighting, line numbers, find and replace, undo and redo, format, minify, beautify, word wrap, import and export. Autosave mirrors the body to IndexedDB so closing the tab does not lose your work.",
    defaultCategory: "html",
    keywords: [
      "html",
      "markup",
      "editor",
      "syntax",
      "highlight",
      "format",
      "minify",
      "beautify",
      "WebPilot",
    ],
    highlights: [
      "Syntax highlighting and line numbers",
      "Auto indentation",
      "Find and replace with match case and whole word",
      "Undo and redo history",
      "Format, minify and beautify",
      "Word wrap toggle",
      "Import a file and export the result",
    ],
    toolCount: 1,
  },
  {
    id: "web-css",
    kind: "css",
    slug: "css",
    name: "CSS editor",
    tagline:
      "Syntax-highlighted CSS with auto-complete, color preview, variables, format, minify, beautify, import and export",
    description:
      "A professional CSS editor. Type or paste styles, see the syntax highlighted in real time, use auto-complete for properties and values, preview the colours you reference as inline swatches, detect variable usage, format, minify, beautify, import and export.",
    intro:
      "Open the CSS editor to write stylesheets with syntax highlighting, auto-complete for properties and values, an inline color preview for every hex and rgb() reference, variable usage detection, format, minify, beautify, import and export.",
    defaultCategory: "css",
    keywords: [
      "css",
      "stylesheet",
      "editor",
      "syntax",
      "highlight",
      "color",
      "variable",
      "format",
      "minify",
      "beautify",
      "WebPilot",
    ],
    highlights: [
      "Syntax highlighting with auto-complete",
      "Color preview swatches for every reference",
      "Variable usage detection",
      "Format, minify and beautify",
      "Import and export",
    ],
    toolCount: 1,
  },
  {
    id: "web-javascript",
    kind: "javascript",
    slug: "javascript",
    name: "JavaScript editor",
    tagline:
      "Syntax-highlighted JavaScript with auto-complete, format, minify, beautify, console preview, import and export",
    description:
      "A professional JavaScript editor. Type or paste code, see the syntax highlighted in real time, use auto-complete for identifiers, format, minify, beautify, run the code in a sandboxed console preview, import and export.",
    intro:
      "Open the JavaScript editor to write code with syntax highlighting, identifier auto-complete, format, minify, beautify, a sandboxed console preview that captures console.log, console.warn and console.error, import and export.",
    defaultCategory: "javascript",
    keywords: [
      "javascript",
      "js",
      "editor",
      "syntax",
      "highlight",
      "format",
      "minify",
      "beautify",
      "console",
      "WebPilot",
    ],
    highlights: [
      "Syntax highlighting with auto-complete",
      "Format, minify and beautify",
      "Console preview that captures console output",
      "Import and export",
    ],
    toolCount: 1,
  },
  {
    id: "web-preview",
    kind: "preview",
    slug: "preview",
    name: "Live Preview",
    tagline:
      "Run HTML, CSS and JavaScript together in a sandboxed browser surface",
    description:
      "A professional browser preview. Type HTML, CSS and JavaScript into three editors, see them combine into a single working surface, auto-refresh as you type, and capture every console message in an output panel. The preview is sandboxed and never runs user-supplied code in the parent window.",
    intro:
      "Open the Live Preview to write HTML, CSS and JavaScript side by side. The preview combines all three into a sandboxed browser surface, auto-refreshes as you type, and shows every console message in an output panel below the preview.",
    defaultCategory: "preview",
    keywords: [
      "preview",
      "live",
      "browser",
      "sandbox",
      "console",
      "html",
      "css",
      "javascript",
      "WebPilot",
    ],
    highlights: [
      "Combines HTML, CSS and JavaScript into a working browser surface",
      "Auto-refresh on body change with a manual refresh button",
      "Console output panel that captures log, warn and error",
      "Sandboxed iframe so user code never runs in the parent window",
    ],
    toolCount: 1,
  },
];

export function getSession(
  kind: WebSessionKind
): WebSessionDefinition | undefined {
  return sessions.find((session) => session.kind === kind);
}

export function getSessionBySlug(
  slug: string
): WebSessionDefinition | undefined {
  return sessions.find((session) => session.slug === slug);
}

/** Sessions that are not the default landing session, used in directory listings. */
export const focusedSessions = sessions.filter((session) => session.slug !== "");

/** Route for a session, e.g. `/webpilot/html`. */
export function sessionHref(session: WebSessionDefinition): string {
  return session.slug ? `/webpilot/${session.slug}` : "/webpilot";
}

/** Sessions for the directory, sorted by their category order. */
export function sessionsForCategory(
  category: WebSessionCategory
): WebSessionDefinition[] {
  return sessions.filter((session) => session.defaultCategory === category);
}
