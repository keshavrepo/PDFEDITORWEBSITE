/**
 * SocialPilot public surface.
 *
 * Components import from this file rather than the underlying modules,
 * so the engine can move pieces between files without breaking every
 * caller.
 */

export * from "./types";
export * from "./projects";
export * from "./templates";
export * from "./engine";
export * from "./media-engine";
export {
  STORAGE_DATABASE,
  STORAGE_VERSION,
  PROJECT_STORE,
  ASSET_STORE,
  MAX_PROJECT_BYTES,
  MAX_ASSET_BYTES,
  MAX_LOCAL_PROJECTS,
  MAX_LOCAL_ASSETS,
  MAX_LOCAL_AGE_DAYS,
} from "./storage";
export type {
  ListProjectsOptions,
  ListProjectsResult,
  ListAssetsOptions,
  ListAssetsResult,
  SaveResult,
  AutosaveResult,
} from "./storage";
