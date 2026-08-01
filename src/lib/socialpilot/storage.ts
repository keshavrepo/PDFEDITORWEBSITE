/**
 * SocialPilot storage layer.
 *
 * The browser (IndexedDB) is the source of truth for the full project
 * body so it is always available offline and the server never has to
 * stream it. The platform keeps a small "recent projects" mirror in
 * the server database, so the dashboard, file manager and search can
 * list them without reading the IndexedDB on every visit.
 *
 * This file only describes the storage layer. The actual IndexedDB
 * code lives in `client-storage.ts`; that file is loaded only in the
 * browser so the server bundle never imports `indexedDB`.
 */

import type {
  SocialMediaAsset,
  SocialMediaAssetSummary,
  SocialProject,
  SocialProjectKind,
  SocialProjectSummary,
} from "./types";

/** The IndexedDB database name. Stable across versions. */
export const STORAGE_DATABASE = "launchstack-socialpilot";

/** Object store name for projects. One per database, keyed by project id. */
export const PROJECT_STORE = "projects";

/** Object store name for media assets. Keyed by asset id. */
export const ASSET_STORE = "media_assets";

/** The current schema version. Bumped when the body shape changes. */
export const STORAGE_VERSION = 1;

/** Maximum project size, in bytes, that the storage will accept. */
export const MAX_PROJECT_BYTES = 4 * 1024 * 1024;

/** Maximum number of projects stored locally. Older ones are evicted. */
export const MAX_LOCAL_PROJECTS = 200;

/** Maximum age in days of a project that the storage will retain. */
export const MAX_LOCAL_AGE_DAYS = 90;

/** Maximum media-asset size, in bytes, that the storage will accept. */
export const MAX_ASSET_BYTES = 32 * 1024 * 1024;

/** Maximum number of media assets stored locally. Older ones are evicted. */
export const MAX_LOCAL_ASSETS = 500;

/** A request to list recent projects. */
export interface ListProjectsOptions {
  kind?: SocialProjectKind;
  limit?: number;
  favoritesOnly?: boolean;
}

/** Result of listing projects, sorted newest first. */
export interface ListProjectsResult {
  summaries: SocialProjectSummary[];
  total: number;
}

/** A request to list media assets. */
export interface ListAssetsOptions {
  projectId?: string | null;
  kind?: SocialMediaAsset["kind"];
  search?: string;
  limit?: number;
}

/** Result of listing media assets, sorted newest first. */
export interface ListAssetsResult {
  assets: SocialMediaAssetSummary[];
  total: number;
}

/** Outcome of a save attempt. */
export type SaveResult =
  | { ok: true; project: SocialProject }
  | { ok: false; reason: "too-large" | "invalid" | "missing-id" | "io" };

/** Outcome of an autosave attempt. */
export type AutosaveResult = SaveResult | { ok: false; reason: "noop" };
