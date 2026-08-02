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
  "terminal",
  "intelligence",
  "validation",
  "export",
  "import",
  "productivity",
  "settings",
  "templates",
  "project-history",
  "dashboard-integration",
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
  terminal: "Terminal",
  intelligence: "Intelligence",
  validation: "Validation",
  export: "Export",
  import: "Import",
  productivity: "Productivity",
  settings: "Settings",
  templates: "Templates",
  "project-history": "Project History",
  "dashboard-integration": "Dashboard",
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
  terminal:
    "Integrated Terminal — multiple terminals, history, clear, copy, resize, fullscreen and keyboard shortcuts",
  intelligence:
    "Code Intelligence — bracket matching, auto-closing pairs, auto indentation, code folding, breadcrumbs, symbol outline, go to line, go to symbol",
  validation:
    "Project Validation — HTML / CSS / JavaScript validation, broken link detection, missing asset detection, duplicate ID detection, accessibility warnings, performance hints",
  export:
    "Project Export — export the complete project as a ZIP, with clean folder structure, assets, folders and metadata preserved",
  import:
    "Project Import — import a ZIP, restore folders, assets and metadata, conflict handling, validation before import",
  productivity:
    "Workspace Productivity — Command Palette, keyboard shortcut reference, recent projects, quick actions, workspace settings, autosave controls",
  settings:
    "Project Settings — name, description, version, author, theme, custom CSS, custom JavaScript, metadata, favicon, Open Graph fields",
  templates:
    "Professional Project Templates — Landing Page, Portfolio, Business Website, SaaS Landing Page, Dashboard, Blog, Documentation, Login Page, Pricing Page, Contact Page",
  "project-history":
    "Project History — recent projects, duplicate, rename, delete, restore last session",
  "dashboard-integration":
    "Dashboard Integration — recent projects, storage summary, notifications, search, favourites and analytics in one place",
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

/* -------------------------------------------------------------------------- */
/* Batch 3: terminal, intelligence, validation, export, import, productivity  */
/* -------------------------------------------------------------------------- */

const TERMINAL_SESSION: WebSessionDefinition = {
  id: "web-terminal",
  kind: "terminal",
  slug: "terminal",
  name: "Integrated Terminal",
  tagline:
    "Multiple terminals, history, clear, copy, resize, fullscreen and keyboard shortcuts",
  description:
    "A professional Integrated Terminal for WebPilot. Open multiple terminal panes, scroll through their history, clear the buffer, copy the output, resize the panes, drop into fullscreen, and run every command from the keyboard. The terminal ships with a small set of built-in commands (echo, ls, pwd, cat, head, tail, wc, clear, help, exit) so the surface is fully usable even before the user extends it.",
  intro:
    "Open the Integrated Terminal to run a command without leaving WebPilot. The terminal is fully client-side: every command runs locally against the project files, the asset list, and the IndexedDB store, so the surface is responsive even when the user is offline. Use Ctrl/Cmd + T to spawn a new pane, Ctrl/Cmd + K to clear, and Ctrl/Cmd + Shift + F to enter fullscreen.",
  defaultCategory: "terminal",
  keywords: [
    "terminal",
    "shell",
    "command",
    "console",
    "history",
    "resize",
    "fullscreen",
    "WebPilot",
  ],
  highlights: [
    "Multiple terminal panes with their own buffer and history",
    "Clear the terminal, copy the output, resize the panes and drop into fullscreen",
    "Built-in commands: echo, ls, pwd, cat, head, tail, wc, clear, help, exit",
    "Favourite commands pinned to the top of the history",
    "Keyboard shortcuts: Ctrl/Cmd + T, Ctrl/Cmd + K, Ctrl/Cmd + Shift + F, Up / Down for history",
  ],
  toolCount: 1,
};

const INTELLIGENCE_SESSION: WebSessionDefinition = {
  id: "web-intelligence",
  kind: "intelligence",
  slug: "intelligence",
  name: "Code Intelligence",
  tagline:
    "Bracket matching, auto-closing pairs, auto indentation, code folding, breadcrumbs, symbol outline, go to line and go to symbol",
  description:
    "A professional Code Intelligence surface. The user gets bracket matching for round, square, curly and angle brackets, auto-closing pairs for every common opening bracket and quote, automatic indentation that respects the current indent unit, code folding for blocks / functions / rules / comments, breadcrumb navigation that tracks the cursor, a symbol outline that lists every function, class, method, variable, rule, id and tag in the file, go-to-line and go-to-symbol jumps, and a folded-lines stack that remembers the user's view of the file.",
  intro:
    "Open the Code Intelligence surface to read the structure of every file in the project. The surface analyses HTML, CSS and JavaScript in one pass, surfaces every symbol in the symbol outline, and lets the user jump to a line or a symbol with one keystroke. Folding collapses blocks so the user can keep the file small, and the breadcrumbs track the cursor so the user always knows where they are.",
  defaultCategory: "intelligence",
  keywords: [
    "intelligence",
    "bracket",
    "fold",
    "breadcrumb",
    "outline",
    "symbol",
    "go to line",
    "WebPilot",
  ],
  highlights: [
    "Bracket matching for round, square, curly and angle brackets",
    "Auto-closing pairs for brackets and quotes",
    "Auto indentation that respects the current indent unit",
    "Code folding for blocks, functions, rules and comments",
    "Breadcrumb navigation that tracks the cursor",
    "Symbol outline with functions, classes, methods, variables, rules, ids and tags",
    "Go to line and go to symbol jumps",
  ],
  toolCount: 1,
};

const VALIDATION_SESSION: WebSessionDefinition = {
  id: "web-validation",
  kind: "validation",
  slug: "validation",
  name: "Project Validation",
  tagline:
    "HTML / CSS / JavaScript validation, broken link detection, missing asset detection, duplicate ID detection, accessibility warnings and performance hints",
  description:
    "A professional Project Validation surface. The user runs a single pass that runs HTML, CSS and JavaScript validators, walks every <a href>, <img src>, <link href> and <script src> to flag broken links and missing assets, scans every id attribute for duplicates, surfaces accessibility warnings (missing alt, missing label, missing lang, no <main>), and reports performance hints (large inline scripts, blocking scripts, missing <meta viewport>, missing <title>). The result is a categorised issue list with severity, line number and a suggested fix.",
  intro:
    "Open the Project Validation surface to catch every issue before you ship. Pick which checks to enable, run the pass, and the surface produces a flat issue list with severity, category, file path, line number and a one-line suggestion. Filter by category, severity or search term, click an issue to open the file in the multi-file workspace, and re-run the pass after every fix.",
  defaultCategory: "validation",
  keywords: [
    "validation",
    "lint",
    "broken link",
    "missing asset",
    "duplicate id",
    "accessibility",
    "performance",
    "WebPilot",
  ],
  highlights: [
    "HTML, CSS and JavaScript validators run in one pass",
    "Broken link detection across href, src and url() references",
    "Missing asset detection for images, fonts and scripts",
    "Duplicate ID detection across every HTML file",
    "Accessibility warnings (missing alt, missing label, missing lang, no main)",
    "Performance hints (large inline scripts, missing viewport, missing title)",
    "Issue list with severity, category, line number and a suggested fix",
  ],
  toolCount: 1,
};

const EXPORT_SESSION: WebSessionDefinition = {
  id: "web-export",
  kind: "export",
  slug: "export",
  name: "Project Export",
  tagline:
    "Export the complete project as a ZIP, with clean folder structure, assets, folders and metadata preserved",
  description:
    "A professional Project Export surface. The user picks an archive name, chooses what to include (files, folders, assets, metadata), and the surface builds a clean ZIP that mirrors the project tree: every file lands at its logical path, every folder is recreated, every asset ships as a data URL, and the metadata (project name, created at, updated at, version) is captured in a project.json manifest. The ZIP is downloaded through the browser's native download pipeline so the user can move it to a server, a colleague, or a CI job.",
  intro:
    "Open the Project Export surface to ship the project. The surface walks the project tree, builds a deterministic archive, and reports the archive size and the time of the last build. Reuse the same surface every time the project changes — the export is reproducible, so a CI job that runs it twice will produce the same archive.",
  defaultCategory: "export",
  keywords: [
    "export",
    "zip",
    "archive",
    "download",
    "manifest",
    "WebPilot",
  ],
  highlights: [
    "Export the complete project as a single ZIP archive",
    "Clean folder structure that mirrors the project tree",
    "Assets preserved as data URLs in the archive",
    "Folders recreated at the right depth",
    "Project metadata captured in a project.json manifest",
    "Reproducible builds so the same project always produces the same archive",
  ],
  toolCount: 1,
};

const IMPORT_SESSION: WebSessionDefinition = {
  id: "web-import",
  kind: "import",
  slug: "import",
  name: "Project Import",
  tagline:
    "Import a ZIP, restore folders, assets and metadata, with conflict handling and validation before import",
  description:
    "A professional Project Import surface. The user picks a ZIP archive the Project Export surface produced, the surface reads the manifest, validates the file list, then merges the project back into the workspace. Conflicts (a file with the same path already exists, an asset with the same id, a folder with the same path) are surfaced one by one and resolved with skip, replace, rename or merge. Validation before import is the default — the surface rejects malformed archives, files at illegal paths, and unknown MIME types.",
  intro:
    "Open the Project Import surface to bring a project back into WebPilot. The surface walks the ZIP, surfaces every conflict, and lets the user decide what to do. The default resolution is skip (so an import never silently overwrites a file); the user can change it to replace or rename before the pass starts.",
  defaultCategory: "import",
  keywords: [
    "import",
    "zip",
    "restore",
    "merge",
    "conflict",
    "validation",
    "WebPilot",
  ],
  highlights: [
    "Import a ZIP archive the Project Export surface produced",
    "Restore folders, files, assets and metadata in a single pass",
    "Conflict resolution per file: skip, replace, rename or merge",
    "Default resolution: skip (an import never silently overwrites a file)",
    "Validation before import rejects malformed archives and illegal paths",
    "Audit trail: every conflict and its resolution is recorded on the body",
  ],
  toolCount: 1,
};

const PRODUCTIVITY_SESSION: WebSessionDefinition = {
  id: "web-productivity",
  kind: "productivity",
  slug: "productivity",
  name: "Workspace Productivity",
  tagline:
    "Command Palette, keyboard shortcut reference, recent projects, quick actions, workspace settings and autosave controls",
  description:
    "A professional Workspace Productivity surface. The user opens the Command Palette (Ctrl/Cmd + Shift + P) to fuzzy-search every command the workspace exposes, browses the recent projects list, runs quick actions (open the project, open the assets, run validation, open the export, open the import), and tunes the workspace settings: autosave on / off, autosave interval, word wrap, theme, minimap, indent width, find shortcut. The surface is the single place every other tool reads its defaults from.",
  intro:
    "Open the Workspace Productivity surface to tune WebPilot. The Command Palette is the fastest way to reach any tool; the recent projects list jumps straight back into the work in progress; the quick actions row covers the common flows; the settings panel persists through the autosave loop so the workspace looks the same on the next visit. The keyboard shortcut reference lists every shortcut the workspace exposes.",
  defaultCategory: "productivity",
  keywords: [
    "productivity",
    "command palette",
    "shortcut",
    "recent",
    "settings",
    "autosave",
    "WebPilot",
  ],
  highlights: [
    "Command Palette with fuzzy search (Ctrl/Cmd + Shift + P)",
    "Keyboard shortcut reference for every workspace action",
    "Recent projects list with one-click reopen",
    "Quick actions row: open the project, open the assets, run validation, export, import",
    "Workspace settings: autosave, interval, word wrap, theme, minimap, indent, find shortcut",
    "Settings persist through the autosave loop",
  ],
  toolCount: 1,
};

export const BATCH3_SESSIONS: WebSessionDefinition[] = [
  TERMINAL_SESSION,
  INTELLIGENCE_SESSION,
  VALIDATION_SESSION,
  EXPORT_SESSION,
  IMPORT_SESSION,
  PRODUCTIVITY_SESSION,
];

/* -------------------------------------------------------------------------- */
/* Batch 4: project settings, project history, dashboard integration          */
/* -------------------------------------------------------------------------- */

const SETTINGS_SESSION: WebSessionDefinition = {
  id: "web-settings",
  kind: "settings",
  slug: "settings",
  name: "Project Settings",
  tagline:
    "Project name, description, version, author, theme, custom CSS, custom JavaScript, metadata, favicon and Open Graph fields",
  description:
    "A professional Project Settings surface. The user edits the project name, description, version, author, theme, custom CSS, custom JavaScript, and the Open Graph / favicon metadata. The settings surface is the single place every other WebPilot surface reads its defaults from: the multi-file editor reads the custom CSS and JavaScript, the Project Export surface reads the metadata, and the Workspace Productivity surface reads the theme.",
  intro:
    "Open the Project Settings to tune the project. The custom CSS and JavaScript are appended to every HTML file the Project Export surface produces, the metadata block lands in the project.json manifest and in the Open Graph tags of every HTML file, and the theme is the default the rest of the workspace reads on its first render.",
  defaultCategory: "settings",
  keywords: [
    "settings",
    "config",
    "configuration",
    "metadata",
    "open graph",
    "favicon",
    "WebPilot",
  ],
  highlights: [
    "Project name, description, version, author and theme in one place",
    "Custom CSS and custom JavaScript appended to every HTML file the export produces",
    "Open Graph fields: title, description, image, type, URL, locale, theme color",
    "Twitter card: summary, summary_large_image, app, player",
    "Favicon URL or data URL, canonical URL, keywords",
    "Settings are the single source of truth for the rest of the workspace",
  ],
  toolCount: 1,
};

const TEMPLATES_SESSION: WebSessionDefinition = {
  id: "web-templates",
  kind: "templates",
  slug: "templates",
  name: "Professional Project Templates",
  tagline:
    "Landing Page, Portfolio, Business Website, SaaS Landing Page, Dashboard, Blog, Documentation, Login Page, Pricing Page, Contact Page",
  description:
    "A professional Project Templates surface. The user picks one of the ten starter templates (Landing Page, Portfolio, Business Website, SaaS Landing Page, Dashboard, Blog, Documentation, Login Page, Pricing Page, Contact Page), the surface builds a complete project tree (HTML, CSS, JavaScript, configuration), the templates surface persists the project into the workspace, and the multi-file editor opens with the new project already loaded. Every template integrates with the existing workspace: the Project Explorer, the Asset Manager, the Multi-file Workspace, the Project Export, and the rest of the tools.",
  intro:
    "Open the Professional Project Templates to scaffold a complete project in one click. Each template is a curated, opinionated starting point: a Landing Page is hero / features / footer, a SaaS Landing Page is hero / pricing / FAQ, a Documentation site is sidebar / article / table of contents, and so on. Pick one, the project tree appears in the Multi-file Workspace, the Live Preview opens, and the user is ready to ship.",
  defaultCategory: "templates",
  keywords: [
    "template",
    "starter",
    "scaffold",
    "landing",
    "portfolio",
    "saas",
    "blog",
    "docs",
    "WebPilot",
  ],
  highlights: [
    "Ten professional starter templates: Landing Page, Portfolio, Business, SaaS, Dashboard, Blog, Documentation, Login, Pricing, Contact",
    "Each template ships a complete project tree (HTML, CSS, JavaScript, configuration) the user can edit immediately",
    "One-click open in the Multi-file Workspace and the Live Preview",
    "Templates integrate with the existing Project Explorer, Asset Manager and Project Export surfaces",
    "Saved as a regular WebPilot session, so the autosave loop and the dashboard mirror keep working",
  ],
  toolCount: 1,
};

const PROJECT_HISTORY_SESSION: WebSessionDefinition = {
  id: "web-project-history",
  kind: "project-history",
  slug: "project-history",
  name: "Project History",
  tagline:
    "Recent projects, duplicate, rename, delete, restore last session",
  description:
    "A professional Project History surface. The user sees the most recent projects in one place, can duplicate, rename, or delete a project, and can restore the last session from a soft-deletion tombstone. The surface reads the existing session lifecycle (create, open, save, duplicate, rename, delete) and reuses it without duplicating any code.",
  intro:
    "Open the Project History to manage the lifecycle of every WebPilot project. The recent list is the most recent edit per project, the favourite list pins the projects the user keeps coming back to, the soft-deletion tombstones keep a one-click restore available for the most recent accidental delete, and the actions row exposes duplicate / rename / delete without leaving the surface.",
  defaultCategory: "history",
  keywords: [
    "history",
    "recent",
    "duplicate",
    "rename",
    "delete",
    "restore",
    "WebPilot",
  ],
  highlights: [
    "Recent projects list with the most recent edit per project",
    "Duplicate a project with one click — the copy opens in a new tab",
    "Rename and delete in place, with a soft-deletion tombstone for restore",
    "Restore the last session with one click",
    "Search across the recent and favourite lists",
    "Reuses the existing session engine, no new lifecycle code",
  ],
  toolCount: 1,
};

const DASHBOARD_INTEGRATION_SESSION: WebSessionDefinition = {
  id: "web-dashboard-integration",
  kind: "dashboard-integration",
  slug: "dashboard-integration",
  name: "Dashboard Integration",
  tagline:
    "Recent projects, storage summary, notifications, search, favourites and analytics in one place",
  description:
    "A professional Dashboard Integration surface. The user sees every important piece of WebPilot state in one place: the recent projects list, the storage summary (sessions, history, assets, bytes), the notifications queue, the search history, the favourites gallery, and the activity analytics broken down by surface. The surface reuses the same IndexedDB-backed store, the same autosave loop, and the same platform-wide search index every other tool already uses.",
  intro:
    "Open the Dashboard Integration to see every important WebPilot state in one place. The recent projects, the storage summary, the notifications queue, the search history, the favourites gallery, and the activity analytics all live in this surface. The dashboard is the LaunchStack-wide aggregation point the user can visit from the /webpilot route.",
  defaultCategory: "blank",
  keywords: [
    "dashboard",
    "recent",
    "storage",
    "notifications",
    "search",
    "favourites",
    "analytics",
    "WebPilot",
  ],
  highlights: [
    "Recent projects list with one-click reopen",
    "Storage summary: sessions, history, assets, total bytes",
    "Notifications queue: info, success, warning, error",
    "Search history: the most recent 12 search terms",
    "Favourites gallery: pinned surfaces and pinned sessions",
    "Activity analytics: events per surface, sorted by recency",
  ],
  toolCount: 1,
};

export const BATCH4_SESSIONS: WebSessionDefinition[] = [
  SETTINGS_SESSION,
  TEMPLATES_SESSION,
  PROJECT_HISTORY_SESSION,
  DASHBOARD_INTEGRATION_SESSION,
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
  ...BATCH3_SESSIONS,
  ...BATCH4_SESSIONS,
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

