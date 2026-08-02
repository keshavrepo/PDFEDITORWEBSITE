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
