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
