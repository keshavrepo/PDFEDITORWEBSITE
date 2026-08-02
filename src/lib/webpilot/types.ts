/**
 * Shared types for the WebPilot workspace.
 *
 * WebPilot is a web workspace that hosts every future web tool
 * (HTML editor, CSS editor, JavaScript editor, Live Preview, SEO,
 * metadata, asset generation) on top of one engine. The engine only
 * cares about an abstract `WebSession`; each tool kind declares its
 * own input schema and result shape through the session descriptor.
 * The workspace shell, storage layer and search index are all keyed
 * off these types.
 *
 * WebPilot reuses the same patterns as OfficePilot, SocialPilot,
 * FinancePilot and DevPilot so a reader who knows one product
 * knows them all.
 */

/** The session kinds WebPilot can host. */
export type WebSessionKind = string;

/** A category for a session, surfaced in the new-session menu. */
export type WebSessionCategory =
  | "blank"
  | "history"
  | "html"
  | "css"
  | "javascript"
  | "preview"
  | "projects"
  | "assets"
  | "workspace"
  | "search"
  | "utilities"
  | "terminal"
  | "intelligence"
  | "validation"
  | "export"
  | "import"
  | "productivity"
  | "settings"
  | "templates"
  | "project-history"
  | "dashboard-integration"
  | "custom";

/** Persistent metadata stored alongside the session body. */
export interface WebSessionMeta {
  /** Stable id; used as the IndexedDB key and the audit trail. */
  id: string;
  /** Session kind this session belongs to. */
  kind: WebSessionKind;
  /** Free-text title shown in tabs and the file manager. */
  title: string;
  /** Session category, used for templates and the new-session menu. */
  category: WebSessionCategory;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the last user edit. */
  updatedAt: string;
  /**
   * ISO timestamp of the last successful autosave. Separated from
   * `updatedAt` so the version-ready architecture can compare what the user
   * touched against what was committed to storage.
   */
  autosavedAt: string | null;
  /**
   * Monotonically increasing version. Bumped on every save (manual or
   * automatic) so a future history UI can render diffs without a bespoke
   * engine — the body itself is the source of truth.
   */
  version: number;
  /** Bytes of the in-memory body. Approximate; for status readouts only. */
  size: number;
  /** Optional user tags, lowercase, free-text. */
  tags?: string[];
  /** Whether the user has favourited this session. */
  isFavorite: boolean;
}

/**
 * A session stored in WebPilot.
 *
 * The body is intentionally `unknown` because each session kind shapes
 * it differently. Every session guard the shape at the boundary.
 */
export interface WebSession {
  meta: WebSessionMeta;
  body: unknown;
}

/** A short summary of a session used in lists and the file manager. */
export interface WebSessionSummary {
  id: string;
  kind: WebSessionKind;
  title: string;
  category: WebSessionCategory;
  updatedAt: string;
  autosavedAt: string | null;
  version: number;
  size: number;
  isFavorite: boolean;
}

/** Static template descriptor. Bodies are loaded lazily. */
export interface WebTemplate {
  id: string;
  kind: WebSessionKind;
  category: WebSessionCategory;
  name: string;
  description: string;
  /** Whether a starter body is available locally. */
  hasStarter: boolean;
  /** Marketing-grade highlights shown on the template card. */
  highlights: string[];
}

/**
 * A session descriptor.
 *
 * Each future session registers one of these. The workspace shell reads
 * the array to decide which surface to mount, which tab to default to,
 * and what to show in the directory.
 */
export interface WebSessionDefinition {
  id: string;
  kind: WebSessionKind;
  /** Route segment under `/webpilot`. Empty for the default. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  /** Default category when the user starts a blank session. */
  defaultCategory: WebSessionCategory;
  /** Search keywords, mirroring the rest of the platform. */
  keywords: string[];
  /** Short bullets shown on the product page. */
  highlights: string[];
  /** Marketing-grade count for the product card. */
  toolCount: number;
}

/* -------------------------------------------------------------------------- */
/* History body                                                              */
/* -------------------------------------------------------------------------- */

/** A single history entry. */
export interface WebHistoryEntry {
  id: string;
  /** Tool name (e.g. "html" or a future tool id). */
  toolName: string;
  /** Free-form category. */
  category: string;
  /** The snippet / output text. */
  text: string;
  /** When the entry was created. */
  createdAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A developer history body. */
export interface WebHistoryBody {
  entries: WebHistoryEntry[];
  /** Default tool filter, persisted between sessions. */
  toolFilter: string;
  /** Default search term. */
  search: string;
}

/* -------------------------------------------------------------------------- */
/* Batch 1: tool bodies                                                       */
/* -------------------------------------------------------------------------- */

/** HTML editor body. */
export interface WebHtmlBody {
  /** The HTML source. */
  source: string;
  /** Indent width when formatting. */
  indent: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** CSS editor body. */
export interface WebCssBody {
  /** The CSS source. */
  source: string;
  /** Indent width when formatting. */
  indent: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** JavaScript editor body. */
export interface WebJsBody {
  /** The JavaScript source. */
  source: string;
  /** Indent width when formatting. */
  indent: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Live Preview body. */
export interface WebPreviewBody {
  /** HTML source. */
  html: string;
  /** CSS source. */
  css: string;
  /** JavaScript source. */
  js: string;
  /** Whether the preview auto-refreshes when the body changes. */
  autoRefresh: boolean;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batch 2: project + asset + workspace + search + utility bodies           */
/* -------------------------------------------------------------------------- */

/** A single file inside a project. */
export interface WebProjectFile {
  /** Stable id, used as the key in the IndexedDB tree. */
  id: string;
  /** Logical path inside the project, e.g. "src/index.html". */
  path: string;
  /** File language: html, css, javascript. */
  kind: "html" | "css" | "javascript";
  /** Current file contents. */
  source: string;
  /** Last persisted contents. Used to detect the unsaved indicator. */
  savedSource: string;
  /** When the file was last edited. */
  updatedAt: string;
}

/** A folder inside a project tree. */
export interface WebProjectFolder {
  id: string;
  /** Logical path inside the project, e.g. "src/components". Empty
   * string means the project root. */
  path: string;
  /** When the folder was last renamed. */
  updatedAt: string;
}

/** The kind of an entry in the project tree. */
export type WebProjectEntryKind = "file" | "folder";

/** A single entry shown in the project tree. */
export interface WebProjectEntry {
  id: string;
  kind: WebProjectEntryKind;
  /** Display name, e.g. "index.html" or "components". */
  name: string;
  /** Logical path inside the project, e.g. "src/index.html". */
  path: string;
  /** File language for files; undefined for folders. */
  fileKind?: "html" | "css" | "javascript";
}

/** A recently opened file inside a project. */
export interface WebProjectRecent {
  path: string;
  openedAt: string;
}

/** The Project Explorer body. */
export interface WebProjectsBody {
  /** Project id (mirrors the session id). */
  projectId: string;
  /** Free-form project name shown in tabs and the file manager. */
  projectName: string;
  /** Folders in the project. */
  folders: WebProjectFolder[];
  /** Files in the project. */
  files: WebProjectFile[];
  /** Currently focused path, used when the user re-opens the explorer. */
  selectedPath: string;
  /** Search term for the project tree. */
  search: string;
  /** Recently opened files, newest first. Capped at 20. */
  recent: WebProjectRecent[];
  /** Favourite paths. */
  favorites: string[];
  /** Favourite flag (on the project itself, mirroring other tools). */
  isFavorite: boolean;
}

/** An asset in the Asset Manager. */
export interface WebAsset {
  id: string;
  /** Display name. */
  name: string;
  /** Logical folder path inside the Asset Manager. Empty string
   * means the root. */
  folder: string;
  /** Asset kind. */
  kind: "image" | "svg" | "font" | "video" | "icon" | "other";
  /** MIME type, e.g. "image/png". */
  mime: string;
  /** Asset payload. For images and videos this is a data URL; for
   * fonts and icons it is the raw bytes or source. */
  dataUrl: string;
  /** Optional width in pixels. */
  width?: number;
  /** Optional height in pixels. */
  height?: number;
  /** Bytes of the raw asset. */
  size: number;
  /** When the asset was added. */
  createdAt: string;
  /** When the asset was last renamed. */
  updatedAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A folder inside the Asset Manager. */
export interface WebAssetFolder {
  id: string;
  path: string;
  updatedAt: string;
}

/** The Asset Manager body. */
export interface WebAssetsBody {
  folders: WebAssetFolder[];
  assets: WebAsset[];
  /** Currently selected asset id, used to keep the preview open. */
  selectedAssetId: string;
  /** Currently selected folder path. Empty string means root. */
  selectedFolder: string;
  /** Search term for the asset list. */
  search: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single open tab in the multi-file workspace. */
export interface WebWorkspaceTab {
  /** Tab id, usually the project file id. */
  id: string;
  /** File path inside the project. */
  path: string;
  /** File kind. */
  fileKind: "html" | "css" | "javascript";
  /** Whether the tab is currently split. */
  split: boolean;
}

/** An entry in the closed-tabs history. */
export interface WebWorkspaceClosedTab {
  path: string;
  fileKind: "html" | "css" | "javascript";
  closedAt: string;
}

/** The multi-file workspace body. */
export interface WebWorkspaceBody {
  /** The project the workspace is currently bound to. */
  projectId: string;
  /** Folders and files are a flat cache of the project tree, kept
   * in sync with the Project Explorer via the projectId. */
  folders: WebProjectFolder[];
  files: WebProjectFile[];
  /** Currently open tabs. */
  tabs: WebWorkspaceTab[];
  /** Active tab id. */
  activeTabId: string;
  /** Stack of recently closed tabs, newest first. Capped at 20. */
  closedTabs: WebWorkspaceClosedTab[];
  /** Search term for the workspace. */
  search: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single match in a Professional Search. */
export interface WebSearchMatch {
  /** File path inside the project. */
  path: string;
  /** File kind. */
  fileKind: "html" | "css" | "javascript";
  /** Line number (1-based). */
  line: number;
  /** Column (1-based). */
  column: number;
  /** The matched line. */
  lineText: string;
  /** Start offset within the line. */
  matchStart: number;
  /** End offset within the line. */
  matchEnd: number;
}

/** The Professional Search body. */
export interface WebSearchBody {
  projectId: string;
  /** Folders and files, mirrored from the project explorer. */
  folders: WebProjectFolder[];
  files: WebProjectFile[];
  /** The most recent search query. */
  query: string;
  /** Replacement text. */
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  /** Whether the search runs across all files (true) or just the
   * currently active file (false). */
  projectWide: boolean;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single utility entry in the Developer Utilities surface. */
export interface WebUtilityItem {
  id: string;
  /** Display name. */
  name: string;
  /** Short tagline shown on the tab. */
  tagline: string;
}

/** A single gradient stop. */
export interface WebGradientStop {
  /** Position in percent, 0..100. */
  position: number;
  /** Hex color. */
  color: string;
}

/** A colour in the Color Picker history. */
export interface WebColorHistoryEntry {
  id: string;
  hex: string;
  createdAt: string;
}

/** A palette entry in the Color Picker. */
export interface WebColorPaletteEntry {
  hex: string;
  name: string;
}

/** The Developer Utilities body. */
export interface WebUtilitiesBody {
  /** The active utility. Defaults to "color-picker". */
  activeUtility: string;
  /** Color Picker state. */
  colorHex: string;
  colorHistory: WebColorHistoryEntry[];
  colorPalette: WebColorPaletteEntry[];
  /** Gradient Generator state. */
  gradientType: "linear" | "radial";
  gradientAngle: number;
  gradientStops: WebGradientStop[];
  /** Box Shadow Generator state. */
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowColor: string;
  shadowInset: boolean;
  /** Border Radius Generator state. */
  radiusTopLeft: number;
  radiusTopRight: number;
  radiusBottomRight: number;
  radiusBottomLeft: number;
  /** CSS Unit Converter state. */
  unitFrom: "px" | "rem" | "em" | "pt" | "vw" | "vh" | "%";
  unitTo: "px" | "rem" | "em" | "pt" | "vw" | "vh" | "%";
  unitValue: number;
  unitBaseFontSize: number;
  unitBaseViewportWidth: number;
  unitBaseViewportHeight: number;
  /** HTML Entity Encoder/Decoder state. */
  entityInput: string;
  /** Base64 Encode/Decode state. */
  base64Mode: "encode" | "decode";
  base64Input: string;
  /** URL Encode/Decode state. */
  urlMode: "encode" | "decode";
  urlInput: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batch 3: terminal + intelligence + validation + export + import +          */
/* productivity bodies                                                       */
/* -------------------------------------------------------------------------- */

/** A single line in a terminal buffer. */
export interface WebTerminalLine {
  /** Stable id. */
  id: string;
  /** The kind of line — input (the user typed it) or output (the
   * shell wrote it back). */
  kind: "input" | "output" | "info" | "error";
  /** The line text. */
  text: string;
  /** When the line was written. */
  createdAt: string;
}

/** A single terminal pane inside the Integrated Terminal. */
export interface WebTerminalPane {
  /** Stable id, used as the rail key and the tab id. */
  id: string;
  /** Display name shown in the tab bar. */
  name: string;
  /** Buffer of lines, oldest first. Capped at 500. */
  lines: WebTerminalLine[];
  /** Current input the user is editing. */
  input: string;
  /** History of previously entered commands, newest first. Capped at 100. */
  history: string[];
  /** Current history cursor; -1 means the user is typing a fresh line. */
  historyIndex: number;
  /** Working directory shown in the prompt. */
  cwd: string;
}

/** A command that the Integrated Terminal can run. The list is
 * intentionally small and dependency-free; the user can extend it
 * with custom commands from the Workspace Productivity surface. */
export interface WebTerminalCommand {
  /** Stable id. */
  id: string;
  /** Command name (e.g. "echo", "ls", "pwd", "help", "clear"). */
  name: string;
  /** The full source line the user typed. */
  source: string;
  /** When the command was last run. */
  runAt: string;
  /** Favourite flag — pinned to the history. */
  isFavorite: boolean;
}

/** The Integrated Terminal body. */
export interface WebTerminalBody {
  /** Active pane id. */
  activePaneId: string;
  /** All panes. */
  panes: WebTerminalPane[];
  /** True when the terminal is in fullscreen mode. */
  fullscreen: boolean;
  /** Logged commands, newest first. Capped at 100. */
  commands: WebTerminalCommand[];
  /** Current font size in pixels. */
  fontSize: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Severity of a code-intelligence issue. */
export type WebIntelligenceSeverity = "info" | "warning" | "error";

/** A single symbol in a file (function, class, variable, etc.). */
export interface WebIntelligenceSymbol {
  /** Stable id. */
  id: string;
  /** Display name. */
  name: string;
  /** Symbol kind. */
  kind: "function" | "class" | "variable" | "method" | "selector" | "rule" | "id" | "tag" | "attribute";
  /** The file path. */
  path: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column. */
  column: number;
  /** End line (1-based). */
  endLine: number;
  /** End column (1-based). */
  endColumn: number;
  /** Optional preview of the matching line. */
  preview?: string;
}

/** A bracket pair (round, square, curly, angle). */
export interface WebIntelligenceBracket {
  /** File path. */
  path: string;
  /** 1-based line of the open. */
  openLine: number;
  /** 1-based column of the open. */
  openColumn: number;
  /** 1-based line of the close. */
  closeLine: number;
  /** 1-based column of the close. */
  closeColumn: number;
  /** Bracket character: "(", ")", "[", "]", "{", "}", "<", ">". */
  openChar: string;
  closeChar: string;
}

/** A single folding range. */
export interface WebIntelligenceFold {
  /** File path. */
  path: string;
  /** 1-based start line of the range (the header line). */
  startLine: number;
  /** 1-based end line of the range. */
  endLine: number;
  /** What kind of block this fold represents. */
  kind: "block" | "function" | "rule" | "comment";
}

/** A breadcrumb in the path bar. */
export interface WebIntelligenceBreadcrumb {
  /** File path. */
  path: string;
  /** 1-based line. */
  line: number;
  /** Optional column (1-based). */
  column?: number;
  /** Optional symbol name at this position. */
  label?: string;
}

/** The Code Intelligence body. */
export interface WebIntelligenceBody {
  /** File currently in focus. */
  activePath: string;
  /** Symbol outline for the active file. */
  symbols: WebIntelligenceSymbol[];
  /** Bracket pairs for the active file. */
  brackets: WebIntelligenceBracket[];
  /** Folding ranges for the active file. */
  folds: WebIntelligenceFold[];
  /** Breadcrumbs derived from the cursor position. */
  breadcrumbs: WebIntelligenceBreadcrumb[];
  /** The cursor position (line, column) for breadcrumb derivation. */
  cursor: { line: number; column: number };
  /** "Go to line" input, persisted between sessions. */
  goToLine: string;
  /** "Go to symbol" input, persisted between sessions. */
  goToSymbol: string;
  /** Set of line numbers that are currently folded. */
  foldedLines: number[];
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Severity for a project validation issue. */
export type WebValidationSeverity = "info" | "warning" | "error";

/** A category of validation issue. */
export type WebValidationCategory =
  | "html"
  | "css"
  | "javascript"
  | "link"
  | "asset"
  | "duplicate-id"
  | "accessibility"
  | "performance";

/** A single validation issue. */
export interface WebValidationIssue {
  /** Stable id. */
  id: string;
  /** Severity. */
  severity: WebValidationSeverity;
  /** Category. */
  category: WebValidationCategory;
  /** File path the issue is in. */
  path: string;
  /** 1-based line number, if known. */
  line: number;
  /** Short message describing the issue. */
  message: string;
  /** Optional suggested fix. */
  suggestion?: string;
}

/** A summary of the validation pass. */
export interface WebValidationSummary {
  /** Total errors. */
  errors: number;
  /** Total warnings. */
  warnings: number;
  /** Total info-level issues. */
  info: number;
  /** Total number of files inspected. */
  files: number;
  /** When the validation last ran. */
  ranAt: string;
}

/** The Project Validation body. */
export interface WebValidationBody {
  /** Most recent issues, newest first. Capped at 500. */
  issues: WebValidationIssue[];
  /** Summary of the most recent run. */
  summary: WebValidationSummary;
  /** Selected category filter — empty string means "all". */
  categoryFilter: string;
  /** Selected severity filter — empty string means "all". */
  severityFilter: string;
  /** Search term. */
  search: string;
  /** Whether the next run should include the html check. */
  enabledHtml: boolean;
  enabledCss: boolean;
  enabledJavascript: boolean;
  enabledLink: boolean;
  enabledAsset: boolean;
  enabledDuplicateId: boolean;
  enabledAccessibility: boolean;
  enabledPerformance: boolean;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single entry in the Project Export body — one per file or
 * folder in the project tree. */
export interface WebExportEntry {
  /** Logical path. */
  path: string;
  /** "file" or "folder". */
  kind: "file" | "folder";
  /** Bytes for files; undefined for folders. */
  size?: number;
  /** MIME type for files; undefined for folders. */
  mime?: string;
}

/** A snapshot of the assets that ship with the project. */
export interface WebExportAsset {
  id: string;
  name: string;
  folder: string;
  kind: WebAsset["kind"];
  size: number;
  dataUrl: string;
}

/** The Project Export body. */
export interface WebExportBody {
  /** File name used for the downloaded zip (without extension). */
  archiveName: string;
  /** Whether folders should be included in the archive. */
  includeFolders: boolean;
  /** Whether assets should be included in the archive. */
  includeAssets: boolean;
  /** Whether metadata should be included in the archive. */
  includeMetadata: boolean;
  /** Whether the JSON manifest should be pretty-printed. */
  prettyPrint: boolean;
  /** Last archive size in bytes, 0 if no archive has been built. */
  lastSize: number;
  /** When the last archive was built. */
  lastBuiltAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single conflict encountered during a Project Import. */
export interface WebImportConflict {
  /** Logical path that conflicted. */
  path: string;
  /** "file", "folder", or "asset". */
  kind: "file" | "folder" | "asset";
  /** The resolution strategy the user picked. */
  resolution: "skip" | "replace" | "rename" | "merge";
  /** When the conflict was resolved. */
  resolvedAt: string;
}

/** The Project Import body. */
export interface WebImportBody {
  /** Last archive name (without extension) the user imported. */
  lastArchiveName: string;
  /** When the last import ran. */
  lastImportAt: string;
  /** Total files imported in the last run. */
  lastFileCount: number;
  /** Total assets imported in the last run. */
  lastAssetCount: number;
  /** Total conflicts encountered in the last run. */
  lastConflictCount: number;
  /** Conflicts from the last run, for the conflict-resolution UI. */
  conflicts: WebImportConflict[];
  /** When the next run should default to "skip" / "replace" / "rename". */
  defaultResolution: "skip" | "replace" | "rename";
  /** Whether the next run should validate before import. */
  validateBeforeImport: boolean;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single entry in the Command Palette. */
export interface WebCommandPaletteItem {
  id: string;
  /** The command label shown in the palette. */
  label: string;
  /** Optional category for grouping. */
  category: string;
  /** Optional keyboard shortcut shown next to the label. */
  shortcut?: string;
  /** Free-form keywords for fuzzy matching. */
  keywords: string[];
  /** When the command was last invoked. */
  lastInvokedAt?: string;
}

/** A recent project the user has opened. Mirrors the global
 * recent-sessions list but is a per-product cache so the
 * productivity surface stays open even when the global store
 * changes. */
export interface WebProductivityRecent {
  id: string;
  title: string;
  kind: string;
  openedAt: string;
}

/** A quick action the productivity surface exposes. */
export interface WebProductivityQuickAction {
  id: string;
  label: string;
  description: string;
  /** The rail slug the action opens, or a built-in action. */
  target: string;
  /** Optional keyboard shortcut. */
  shortcut?: string;
}

/** The Workspace Productivity body. */
export interface WebProductivityBody {
  /** Whether the Command Palette is currently open. */
  paletteOpen: boolean;
  /** The current palette query. */
  paletteQuery: string;
  /** Recent projects (cap 12). */
  recent: WebProductivityRecent[];
  /** Quick actions (cap 12). */
  quickActions: WebProductivityQuickAction[];
  /** Whether autosave is enabled. */
  autosaveEnabled: boolean;
  /** Autosave interval in milliseconds. */
  autosaveIntervalMs: number;
  /** Whether word wrap is enabled by default in the editors. */
  wordWrap: boolean;
  /** Whether the user prefers a dark / light theme. */
  theme: "system" | "light" | "dark";
  /** Whether the minimap is shown. */
  minimap: boolean;
  /** The user's preferred indent width (spaces). */
  indent: number;
  /** Whether the in-editor find bar opens on Ctrl/Cmd + F. */
  findShortcut: boolean;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batch 4: project settings + project history + dashboard integration        */
/* -------------------------------------------------------------------------- */

/** A single open-graph / metadata field on the Project Settings surface. */
export interface WebSettingsMetadata {
  /** Optional favicon URL or data URL. */
  favicon?: string;
  /** Open Graph title. */
  ogTitle?: string;
  /** Open Graph description. */
  ogDescription?: string;
  /** Open Graph image (URL or data URL). */
  ogImage?: string;
  /** Open Graph type (e.g. "website", "article"). */
  ogType?: string;
  /** Open Graph URL. */
  ogUrl?: string;
  /** Twitter card. */
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  /** Twitter site. */
  twitterSite?: string;
  /** Twitter creator. */
  twitterCreator?: string;
  /** Canonical URL. */
  canonicalUrl?: string;
  /** Author name. */
  author?: string;
  /** Theme color used by mobile browsers. */
  themeColor?: string;
  /** Locale (e.g. "en_US"). */
  locale?: string;
  /** Keywords (comma-separated). */
  keywords?: string;
}

/** The Project Settings body. The settings surface is the single
 * place every other WebPilot surface reads its defaults from:
 * the multi-file editor reads the custom CSS / custom JavaScript,
 * the Project Export surface reads the metadata, and the
 * Workspace Productivity surface reads the theme. */
export interface WebSettingsBody {
  projectId: string;
  projectName: string;
  description: string;
  version: string;
  author: string;
  theme: "default" | "light" | "dark" | "high-contrast";
  customCss: string;
  customJavaScript: string;
  metadata: WebSettingsMetadata;
  /** When the settings were last updated. */
  updatedAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single record in the Project History surface. The record
 * captures the state of a project at the moment the user hit Save
 * (or the autosave loop persisted it), so the user can step
 * through previous states the same way they would through a
 * history in any other tool. */
export interface WebProjectHistoryEntry {
  id: string;
  /** The session id the entry belongs to. */
  sessionId: string;
  /** The project name at the time of the entry. */
  projectName: string;
  /** ISO timestamp the entry was recorded. */
  savedAt: string;
  /** The version the entry was recorded at. */
  version: number;
  /** Free-form note the user can attach. */
  note: string;
  /** The body shape is intentionally `unknown` so each session
   * can ship its own snapshot. The history surface never has to
   * touch the body — it is stored verbatim. */
  body: unknown;
}

/** A single soft-deletion tombstone the user can restore. */
export interface WebProjectHistoryTombstone {
  id: string;
  sessionId: string;
  projectName: string;
  deletedAt: string;
  /** The body at the moment of deletion. */
  body: unknown;
}

/** The Project History body. Stores the most recent saves and the
 * most recent deletions so the surface can offer "Restore last
 * session" with a single click. */
export interface WebProjectHistoryBody {
  /** All known session ids. The user sees them in a single list
   * with the most recent edit at the top. */
  recent: WebProjectHistoryBodyEntry[];
  /** Favourited projects, persisted between sessions. */
  favorites: string[];
  /** Soft-deletion tombstones. The most recent is offered as
   * "Restore last session". */
  tombstones: WebProjectHistoryTombstone[];
  /** The id of the most recently deleted session. */
  lastDeletedSessionId: string;
  /** When the last deletion happened. */
  lastDeletedAt: string;
  /** The id of the most recently restored session, if any. */
  lastRestoredSessionId: string;
  /** When the last restore happened. */
  lastRestoredAt: string;
  /** Search term. */
  search: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single entry in the Project History recent list. The shape
 * is intentionally small: the body is referenced by id, not
 * embedded, so the list stays under a kilobyte even for hundreds
 * of sessions. */
export interface WebProjectHistoryBodyEntry {
  id: string;
  title: string;
  kind: string;
  category: string;
  updatedAt: string;
  version: number;
  size: number;
  isFavorite: boolean;
}

/** The Dashboard Integration body. Aggregates the storage
 * summary, the notifications queue, the search index, the
 * favourites gallery and the activity analytics. */
export interface WebDashboardBody {
  /** Storage summary written by the workspace shell. */
  storage: WebDashboardStorage;
  /** Notifications queue, newest first. Capped at 50. */
  notifications: WebDashboardNotification[];
  /** Recent search terms, newest first. Capped at 12. */
  recentSearches: string[];
  /** Favourites gallery: pinned surface ids. */
  favouriteSurfaces: string[];
  /** Activity analytics per surface, sorted by event count
   * descending. The most active surface is rendered first. */
  activity: WebDashboardActivityRow[];
  /** Last dashboard refresh timestamp. */
  refreshedAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A storage summary row. */
export interface WebDashboardStorage {
  /** Total sessions, across every kind. */
  sessions: number;
  /** Total bytes used by every session. */
  bytes: number;
  /** History entries, across every kind. */
  historyEntries: number;
  /** Asset count, across every folder. */
  assets: number;
  /** Total bytes used by every asset. */
  assetBytes: number;
  /** When the summary was computed. */
  computedAt: string;
}

/** A single dashboard notification. */
export interface WebDashboardNotification {
  id: string;
  /** The notification kind. */
  kind: "info" | "success" | "warning" | "error";
  /** The notification title. */
  title: string;
  /** The notification body. */
  body: string;
  /** The surface the notification belongs to. */
  surface: string;
  /** The notification timestamp. */
  createdAt: string;
  /** Whether the user has read the notification. */
  read: boolean;
}

/** A single activity analytics row. */
export interface WebDashboardActivityRow {
  /** The surface kind, e.g. "html", "css", "projects". */
  kind: string;
  /** Number of events recorded for this surface. */
  events: number;
  /** The most recent event timestamp. */
  lastEventAt: string;
  /** Number of distinct sessions the user has opened for this
   * surface. */
  sessionCount: number;
}
