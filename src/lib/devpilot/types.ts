/**
 * Shared types for the DevPilot workspace.
 *
 * DevPilot is a developer workspace that hosts many future tools
 * (formatters, validators, encoders, generators) on top of one engine.
 * The engine only cares about an abstract `DevSession`; each tool
 * kind declares its own input schema and result shape through the
 * session descriptor. The workspace shell, storage layer and search
 * index are all keyed off these types.
 *
 * DevPilot reuses the same patterns as OfficePilot, SocialPilot and
 * FinancePilot so a reader who knows one product knows them all.
 */

/** The session kinds DevPilot can host. */
export type DevSessionKind = string;

/** A category for a session, surfaced in the new-session menu. */
export type DevSessionCategory =
  | "blank"
  | "snippet"
  | "history"
  | "custom";

/** Persistent metadata stored alongside the session body. */
export interface DevSessionMeta {
  /** Stable id; used as the IndexedDB key and the audit trail. */
  id: string;
  /** Session kind this session belongs to. */
  kind: DevSessionKind;
  /** Free-text title shown in tabs and the file manager. */
  title: string;
  /** Session category, used for templates and the new-session menu. */
  category: DevSessionCategory;
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
 * A session stored in DevPilot.
 *
 * The body is intentionally `unknown` because each session kind shapes
 * it differently. Every session guard the shape at the boundary.
 */
export interface DevSession {
  meta: DevSessionMeta;
  body: unknown;
}

/** A short summary of a session used in lists and the file manager. */
export interface DevSessionSummary {
  id: string;
  kind: DevSessionKind;
  title: string;
  category: DevSessionCategory;
  updatedAt: string;
  autosavedAt: string | null;
  version: number;
  size: number;
  isFavorite: boolean;
}

/** Static template descriptor. Bodies are loaded lazily. */
export interface DevTemplate {
  id: string;
  kind: DevSessionKind;
  category: DevSessionCategory;
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
export interface DevSessionDefinition {
  id: string;
  kind: DevSessionKind;
  /** Route segment under `/devpilot`. Empty for the default. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  /** Default category when the user starts a blank session. */
  defaultCategory: DevSessionCategory;
  /** Search keywords, mirroring the rest of the platform. */
  keywords: string[];
  /** Short bullets shown on the product page. */
  highlights: string[];
  /** Marketing-grade count for the product card. */
  toolCount: number;
}

/* -------------------------------------------------------------------------- */
/* Snippet body                                                              */
/* -------------------------------------------------------------------------- */

/** A developer snippet body. */
export interface DevSnippetBody {
  /** The snippet text. */
  text: string;
  /** Free-form category, e.g. "JavaScript", "SQL", "Bash". */
  category: string;
  /** Free-form language, e.g. "ts", "js", "py", "sh", "sql". */
  language: string;
  /** Optional tags for finer-grained search. */
  tags: string[];
  /** Optional description of what the snippet does. */
  description: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* History body                                                              */
/* -------------------------------------------------------------------------- */

/** A single history entry. */
export interface DevHistoryEntry {
  id: string;
  /** Tool name (e.g. "snippet" or a future tool id). */
  toolName: string;
  /** Free-form category. */
  category: string;
  /** Free-form language (mirrors the snippet body). */
  language: string;
  /** The snippet / output text. */
  text: string;
  /** When the entry was created. */
  createdAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A developer history body. */
export interface DevHistoryBody {
  entries: DevHistoryEntry[];
  /** Default tool filter, persisted between sessions. */
  toolFilter: string;
  /** Default search term. */
  search: string;
}
