/**
 * WebPilot storage layer.
 *
 * The browser (IndexedDB) is the source of truth for the full session
 * body so it is always available offline and the server never has to
 * stream it. The platform keeps a small "recent sessions" mirror in the
 * server database, so the dashboard, file manager and search can list
 * them without reading the IndexedDB on every visit.
 *
 * This file only describes the storage layer. The actual IndexedDB
 * code lives in `client-storage.ts`; that file is loaded only in the
 * browser so the server bundle never imports `indexedDB`.
 *
 * Mirrors the SocialPilot / FinancePilot / DevPilot storage shape so a
 * reader who knows one product knows them all.
 */

import type {
  WebSession,
  WebSessionKind,
  WebSessionSummary,
} from "./types";

/** The IndexedDB database name. Stable across versions. */
export const STORAGE_DATABASE = "launchstack-webpilot";

/** Object store name for sessions. One per database, keyed by session id. */
export const SESSION_STORE = "sessions";

/** Object store name for history entries. Keyed by entry id. */
export const HISTORY_STORE = "history";

/** The current schema version. Bumped when the body shape changes. */
export const STORAGE_VERSION = 1;

/** Maximum session size, in bytes, that the storage will accept. */
export const MAX_SESSION_BYTES = 4 * 1024 * 1024;

/** Maximum number of sessions stored locally. Older ones are evicted. */
export const MAX_LOCAL_SESSIONS = 200;

/** Maximum age in days of a session that the storage will retain. */
export const MAX_LOCAL_AGE_DAYS = 90;

/** Maximum number of history entries stored locally. Older ones are evicted. */
export const MAX_LOCAL_HISTORY = 500;

/** A request to list recent sessions. */
export interface ListSessionsOptions {
  kind?: WebSessionKind;
  limit?: number;
  favoritesOnly?: boolean;
}

/** Result of listing sessions, sorted newest first. */
export interface ListSessionsResult {
  summaries: WebSessionSummary[];
  total: number;
}

/** A request to list history entries. */
export interface ListHistoryOptions {
  toolName?: string;
  limit?: number;
  favoritesOnly?: boolean;
}

/** Result of listing history, sorted newest first. */
export interface ListHistoryResult {
  entries: WebSessionSummary[];
  total: number;
}

/** Outcome of a save attempt. */
export type SaveResult =
  | { ok: true; session: WebSession }
  | { ok: false; reason: "too-large" | "invalid" | "missing-id" | "io" };

/** Outcome of an autosave attempt. */
export type AutosaveResult = SaveResult | { ok: false; reason: "noop" };
