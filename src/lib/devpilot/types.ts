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
  | "json"
  | "jwt"
  | "base64"
  | "uuid"
  | "hash"
  | "url"
  | "api"
  | "regex"
  | "diff"
  | "sql"
  | "html"
  | "css"
  | "javascript"
  | "cron"
  | "timestamp"
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

/* -------------------------------------------------------------------------- */
/* Batch 2: tool bodies                                                       */
/* -------------------------------------------------------------------------- */

/** JSON workspace body. */
export interface DevJsonBody {
  /** The user's input text. */
  input: string;
  /** Optional sorted key order when pretty-printing. */
  sortKeys: boolean;
  /** Indent width used when formatting. */
  indent: number;
  /** Free-form note shown in the properties panel. */
  note: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** JWT workspace body. */
export interface DevJwtBody {
  /** The encoded JWT, three dot-separated segments. */
  token: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Base64 workspace body. */
export interface DevBase64Body {
  /** Input mode: text or file. */
  mode: "text" | "file";
  /** Text input (used when mode === "text"). */
  text: string;
  /** Original filename (used when mode === "file"). */
  filename: string;
  /** Base64 representation of the file binary (used when mode === "file"). */
  fileBase64: string;
  /** Free-form note. */
  note: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** UUID workspace body. */
export interface DevUuidBody {
  /** Number of UUIDs to generate. */
  count: number;
  /** Last generated batch. */
  generated: string[];
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Hash workspace body. */
export interface DevHashBody {
  /** Input mode: text or file. */
  mode: "text" | "file";
  /** Text input (used when mode === "text"). */
  text: string;
  /** Original filename (used when mode === "file"). */
  filename: string;
  /** File binary as a data URL (used when mode === "file"). */
  fileDataUrl: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** URL workspace body. */
export interface DevUrlBody {
  /** Input text. */
  input: string;
  /** Direction: encode or decode. */
  direction: "encode" | "decode";
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batch 3: tool bodies                                                       */
/* -------------------------------------------------------------------------- */

/** A single API header (request or response). */
export interface DevApiHeader {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

/** A single API query parameter. */
export interface DevApiQueryParam {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

/** A single API request. */
export interface DevApiRequest {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: DevApiHeader[];
  query: DevApiQueryParam[];
  body: string;
  /** Optional body content type, e.g. "application/json". */
  contentType: string;
}

/** A single API response (mirrors the wire response into a serialisable shape). */
export interface DevApiResponse {
  status: number;
  statusText: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
  /** Bytes, measured on the wire. */
  size: number;
  /** Total elapsed time in milliseconds. */
  elapsedMs: number;
  /** Whether the request failed entirely (network error, abort, etc.). */
  failed: boolean;
  /** Error message when failed. */
  error: string | null;
}

/** A single history entry inside the API workspace. */
export interface DevApiHistoryEntry {
  id: string;
  method: DevApiRequest["method"];
  url: string;
  status: number;
  failed: boolean;
  elapsedMs: number;
  /** True when the user pinned the entry. */
  isFavorite: boolean;
  /** Collection the entry belongs to, or empty for unsorted. */
  collection: string;
  /** ISO timestamp. */
  createdAt: string;
}

/** API workspace body. */
export interface DevApiBody {
  request: DevApiRequest;
  /** Saved history of every response. */
  history: DevApiHistoryEntry[];
  /** User-defined collections. */
  collections: string[];
  /** Currently-active collection filter. */
  activeCollection: string;
  /** Search term for the history list. */
  search: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Regex workspace body. */
export interface DevRegexBody {
  /** Pattern as a string (no slashes). */
  pattern: string;
  /** Active flag string, e.g. "gim". */
  flags: string;
  /** Text to test the pattern against. */
  input: string;
  /** Replacement string used in the Replace tab. */
  replacement: string;
  /** Currently-active tab. */
  view: "test" | "replace";
  /** Id of the preset picked from the common-patterns library. */
  presetId: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Diff workspace body. */
export interface DevDiffBody {
  /** Original (left) text. */
  left: string;
  /** Modified (right) text. */
  right: string;
  /** "text" or "json" — picks the diff algorithm. */
  mode: "text" | "json";
  /** "side" or "inline" — picks the visual layout. */
  layout: "side" | "inline";
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A line-level diff entry. */
export interface DevDiffLine {
  kind: "context" | "add" | "remove";
  leftLine: number | null;
  rightLine: number | null;
  leftText: string;
  rightText: string;
}

/** SQL workspace body. */
export interface DevSqlBody {
  input: string;
  /** Upper-case keyword style. */
  uppercase: boolean;
  /** Indent width when formatting. */
  indent: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** HTML workspace body. */
export interface DevHtmlBody {
  input: string;
  /** Indent width when formatting. */
  indent: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** CSS workspace body. */
export interface DevCssBody {
  input: string;
  /** Indent width when formatting. */
  indent: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** JavaScript workspace body. */
export interface DevJsBody {
  input: string;
  /** Indent width when formatting. */
  indent: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Cron workspace body. */
export interface DevCronBody {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  /** Optional free-form note shown in the properties panel. */
  note: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** Timestamp workspace body. */
export interface DevTimestampBody {
  /** Raw input text. */
  input: string;
  /** Selected conversion direction. */
  direction: "fromUnix" | "toUnix" | "fromIso" | "toIso";
  /** Favourite flag. */
  isFavorite: boolean;
}
