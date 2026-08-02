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
  "projects",
  "assets",
  "workspace",
  "search",
  "utilities",
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
  projects: "Projects",
  assets: "Assets",
  workspace: "Workspace",
  search: "Search",
  utilities: "Utilities",
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
  projects:
    "Project Explorer — folder tree, nested folders, create / rename / delete / duplicate, drag and drop, search, recent and favourites",
  assets:
    "Asset Manager — upload images, SVG, fonts, videos and icons, organise folders, preview, rename, delete and copy URL",
  workspace:
    "Multi-file Workspace — multiple tabs with an unsaved indicator, autosave, restore session, close and reopen tabs, split editor and quick switch",
  search:
    "Professional Search — find in current file or across the project, replace and replace all, regex, match case and whole word",
  utilities:
    "Developer Utilities — color picker, gradient generator, box shadow generator, border radius generator, CSS unit converter, HTML entity, base64 and URL codecs",
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
/* -------------------------------------------------------------------------- */
/* Batch 2: project explorer, asset manager, multi-file workspace, search,    */
/* utilities                                                                   */
/* -------------------------------------------------------------------------- */

const PROJECTS_SESSION: WebSessionDefinition = {
  id: "web-projects",
  kind: "projects",
  slug: "projects",
  name: "Project Explorer",
  tagline:
    "Folder tree, nested folders, create / rename / delete / duplicate, drag and drop, search, recent and favourites",
  description:
    "A professional project explorer for WebPilot. Browse the project as a folder tree with nested folders, create new files and folders, rename, delete and duplicate, drag and drop entries to reorganise, search the tree, jump back into recently opened files, and pin favourites. The explorer is the entry point to every other project surface: opening a file from the tree routes the workspace into the multi-file editor with the file already open.",
  intro:
    "Open the Project Explorer to manage every HTML, CSS and JavaScript file in your project. Create new files, rename, delete, duplicate, drag and drop to reorganise folders, search the tree, and pin favourites. The explorer mirrors every change to the server-side recent mirror and the IndexedDB autosave loop.",
  defaultCategory: "projects",
  keywords: [
    "project",
    "explorer",
    "files",
    "tree",
    "folders",
    "drag and drop",
    "search",
    "WebPilot",
  ],
  highlights: [
    "Folder tree with nested folders",
    "Create file, create folder, rename, delete, duplicate",
    "Drag and drop to reorganise",
    "Search the tree by file or folder name",
    "Recent files list with one-click reopen",
    "Favourite file paths pinned to the top",
    "Mirrored to the recent sessions and dashboard",
  ],
  toolCount: 1,
};

const ASSETS_SESSION: WebSessionDefinition = {
  id: "web-assets",
  kind: "assets",
  slug: "assets",
  name: "Asset Manager",
  tagline:
    "Upload images, SVG, fonts, videos and icons, organise folders, preview, rename, delete and copy URL",
  description:
    "A professional asset manager for WebPilot. Upload images, SVG, fonts, videos and icons, organise them into folders, preview every asset, rename, delete and copy the asset URL with one click. The asset manager is shared across every project and the storage layer keeps the assets in IndexedDB so they remain available offline.",
  intro:
    "Open the Asset Manager to upload and organise every binary the project needs. Switch between folders, search by name, preview images and videos, copy the asset URL for the HTML or CSS file, and delete what you no longer need. The asset list is persisted through the same autosave loop the rest of the workspace uses.",
  defaultCategory: "assets",
  keywords: [
    "assets",
    "images",
    "svg",
    "fonts",
    "videos",
    "icons",
    "upload",
    "preview",
    "copy",
    "WebPilot",
  ],
  highlights: [
    "Upload images, SVG, fonts, videos and icons",
    "Organise assets into folders",
    "Inline preview for every asset kind",
    "Rename, delete and copy URL",
    "Search the asset list",
    "Persisted in the IndexedDB store",
  ],
  toolCount: 1,
};

const WORKSPACE_SESSION: WebSessionDefinition = {
  id: "web-workspace",
  kind: "workspace",
  slug: "workspace",
  name: "Multi-file Workspace",
  tagline:
    "Multiple tabs with an unsaved indicator, autosave, restore session, close and reopen tabs, split editor and quick switch",
  description:
    "A professional multi-file workspace. Open every file in the project as a tab, see the unsaved indicator on dirty files, autosave the moment the user stops typing, restore the previous session when the workspace re-opens, close and reopen tabs with a single click, split the active editor into two side-by-side panes, and quick-switch between files with the keyboard. The workspace reuses the existing WebPilot CodeEditor so every existing tool surface stays identical.",
  intro:
    "Open the Multi-file Workspace to edit every project file from a single surface. Files you open become tabs; tabs you close join the reopen stack; the active tab's editor includes the same find / replace, undo / redo and format / minify / beautify the standalone HTML, CSS and JavaScript editors ship with. Use the split button to compare two files side by side.",
  defaultCategory: "workspace",
  keywords: [
    "workspace",
    "tabs",
    "split",
    "autosave",
    "restore",
    "reopen",
    "WebPilot",
  ],
  highlights: [
    "Open multiple files as tabs with an unsaved indicator",
    "Autosave preserves every keystroke through the IndexedDB loop",
    "Restore the previous session when the workspace re-opens",
    "Close and reopen tabs from the closed-tab stack",
    "Split the active editor into two side-by-side panes",
    "Quick-switch between files with the keyboard",
  ],
  toolCount: 1,
};

const SEARCH_SESSION: WebSessionDefinition = {
  id: "web-search",
  kind: "search",
  slug: "search",
  name: "Professional Search",
  tagline:
    "Find in current file, find across project, replace, replace all, regex, match case and whole word",
  description:
    "A professional project-wide search. Find a string in the active file or across every project file, replace one or all matches, scope the search to the whole word, toggle match case, and switch to a regular expression. The search lists every match with the file path, line number and a preview, and every replace writes back to the IndexedDB store so the change survives a reload.",
  intro:
    "Open the Professional Search to find anything across the project. Type a query, choose whether to scope the search to the current file or the whole project, toggle regex / match case / whole word, then step through the matches. The replace and replace-all actions write back to every matched file, all the way through the autosave loop.",
  defaultCategory: "search",
  keywords: ["search", "find", "replace", "regex", "match case", "WebPilot"],
  highlights: [
    "Find in the current file or across the project",
    "Replace one match or every match in a single click",
    "Regex, match case and whole word toggles",
    "Match list with file path, line number and a preview",
    "Replace writes flow through the same autosave loop",
  ],
  toolCount: 1,
};

const UTILITIES_SESSION: WebSessionDefinition = {
  id: "web-utilities",
  kind: "utilities",
  slug: "utilities",
  name: "Developer Utilities",
  tagline:
    "Color Picker, Gradient Generator, Box Shadow Generator, Border Radius Generator, CSS Unit Converter, HTML Entity, Base64 and URL codecs",
  description:
    "A swiss-army knife of small web-development utilities. Pick a colour from the colour palette and copy its hex / rgb / hsl / hsv values, generate a CSS linear or radial gradient, build a CSS box-shadow, draw a custom border-radius, convert between CSS units (px, rem, em, pt, vw, vh, %), encode and decode HTML entities, encode and decode base64, and encode and decode URLs. Each utility is a tab on the surface so the rail stays uncluttered.",
  intro:
    "Open the Developer Utilities to find a colour, build a gradient, generate a box-shadow, tweak a border-radius, convert a CSS unit, encode or decode an HTML entity, encode or decode a base64 string, or encode or decode a URL. Every utility keeps its own state on the session body so the rail stays clean.",
  defaultCategory: "utilities",
  keywords: [
    "color",
    "gradient",
    "shadow",
    "radius",
    "unit",
    "entity",
    "base64",
    "url",
    "WebPilot",
  ],
  highlights: [
    "Color Picker with a built-in palette and history",
    "Gradient Generator for linear and radial gradients",
    "Box Shadow Generator with offset, blur, spread, colour and inset",
    "Border Radius Generator with per-corner control",
    "CSS Unit Converter (px, rem, em, pt, vw, vh, %)",
    "HTML Entity Encoder / Decoder",
    "Base64 Encode / Decode",
    "URL Encode / Decode",
  ],
  toolCount: 1,
};

export const BATCH2_SESSIONS: WebSessionDefinition[] = [
  PROJECTS_SESSION,
  ASSETS_SESSION,
  WORKSPACE_SESSION,
  SEARCH_SESSION,
  UTILITIES_SESSION,
];

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
  ...BATCH2_SESSIONS,
]

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

