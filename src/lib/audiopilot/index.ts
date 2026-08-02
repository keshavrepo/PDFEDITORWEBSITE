/**
 * AudioPilot public surface.
 *
 * Components import from this file rather than the underlying
 * modules, so the engine can move pieces between files without
 * breaking every caller.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * public surface.
 */

export * from "./types";
export * from "./sessions";
export * from "./templates";
export * from "./engine";
export * from "./tools";
export {
  DEFAULT_PLAYER_BODY,
  DEFAULT_TRIMMER_BODY,
  DEFAULT_CONVERTER_BODY,
  DEFAULT_RECORDER_BODY,
  asPlayerBody,
  asTrimmerBody,
  asConverterBody,
  asRecorderBody,
  clonePlayerBody,
  cloneTrimmerBody,
  cloneConverterBody,
  cloneRecorderBody,
} from "./bodies";
export {
  STORAGE_DATABASE,
  SESSION_STORE,
  STORAGE_VERSION,
  MAX_SESSION_BYTES,
  MAX_LOCAL_SESSIONS,
  MAX_LOCAL_AGE_DAYS,
} from "./storage";
export type {
  ListSessionsOptions,
  ListSessionsResult,
  SaveResult,
  AutosaveResult,
} from "./storage";
export {
  createSessionStorage,
  saveSessionStorage,
  autosaveSessionStorage,
  getSessionStorage,
  listSessionsStorage,
  renameSessionStorage,
  toggleFavoriteSessionStorage,
  duplicateSessionStorage,
  deleteSessionStorage,
  generateSessionId,
} from "./client-storage";
