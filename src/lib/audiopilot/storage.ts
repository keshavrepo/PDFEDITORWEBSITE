/**
 * AudioPilot storage layer.
 *
 * The browser (IndexedDB) is the source of truth for the full session
 * body so the audio bytes are always available offline. The platform
 * keeps a small "recent sessions" mirror in the server database, so
 * the dashboard, file manager and search can list them without
 * reading the IndexedDB on every visit.
 *
 * This file only describes the storage layer. The actual IndexedDB
 * code lives in `client-storage.ts`; that file is loaded only in the
 * browser so the server bundle never imports `indexedDB`.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * storage shape so a reader who knows one product knows them all.
 */

import type {
  AudioSession,
  AudioSessionKind,
  AudioSessionSummary,
} from "./types";

/** The IndexedDB database name. Stable across versions. */
export const STORAGE_DATABASE = "launchstack-audiopilot";

/** Object store name for sessions. One per database, keyed by session id. */
export const SESSION_STORE = "sessions";

/** The current schema version. Bumped when the body shape changes. */
export const STORAGE_VERSION = 1;

/** Maximum session size, in bytes, that the storage will accept. */
export const MAX_SESSION_BYTES = 32 * 1024 * 1024;

/** Maximum number of sessions stored locally. Older ones are evicted. */
export const MAX_LOCAL_SESSIONS = 200;

/** Maximum age in days of a session that the storage will retain. */
export const MAX_LOCAL_AGE_DAYS = 90;

/** A request to list recent sessions. */
export interface ListSessionsOptions {
  kind?: AudioSessionKind;
  limit?: number;
  favoritesOnly?: boolean;
}

/** The result of a list request. */
export interface ListSessionsResult {
  summaries: AudioSessionSummary[];
  total: number;
}

/** The result of a save request. */
export interface SaveResult {
  ok: boolean;
  reason?: "missing-id" | "invalid" | "too-large" | "io";
  session?: AudioSession;
}

/** The result of an autosave request. */
export interface AutosaveResult {
  ok: boolean;
  reason?: "noop" | "missing-id" | "invalid" | "too-large" | "io";
  session?: AudioSession;
}
