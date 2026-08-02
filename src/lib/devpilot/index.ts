/**
 * DevPilot public surface.
 *
 * Components import from this file rather than the underlying modules,
 * so the engine can move pieces between files without breaking every
 * caller.
 *
 * Mirrors the SocialPilot / FinancePilot public surface.
 */

export * from "./types";
export * from "./sessions";
export * from "./templates";
export * from "./engine";
export {
  DEFAULT_SNIPPET_BODY,
  DEFAULT_HISTORY_BODY,
  asSnippetBody,
  asHistoryBody,
} from "./bodies";
export {
  STORAGE_DATABASE,
  SESSION_STORE,
  HISTORY_STORE,
  STORAGE_VERSION,
  MAX_SESSION_BYTES,
  MAX_LOCAL_SESSIONS,
  MAX_LOCAL_HISTORY,
  MAX_LOCAL_AGE_DAYS,
} from "./storage";
export type {
  ListSessionsOptions,
  ListSessionsResult,
  ListHistoryOptions,
  ListHistoryResult,
  SaveResult,
  AutosaveResult,
} from "./storage";
export {
  saveHistoryStorage,
  listHistoryStorage,
  deleteHistoryStorage,
  toggleFavoriteHistoryStorage,
  generateHistoryId,
} from "./client-storage";
