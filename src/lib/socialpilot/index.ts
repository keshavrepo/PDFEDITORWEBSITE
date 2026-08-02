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
export * from "./platforms";
export {
  DEFAULT_POST_BODY,
  DEFAULT_CAPTION_BODY,
  DEFAULT_HASHTAG_BODY,
  DEFAULT_CALENDAR_BODY,
  DEFAULT_NOTE_BODY,
  DEFAULT_QUEUE_BODY,
  DEFAULT_PROFILE_BODY,
  DEFAULT_MEDIA_BODY,
  DEFAULT_BRAND_BODY,
  QUEUE_STATUSES,
  PLAN_COLORS,
  PLAN_PLATFORMS,
  asPostBody,
  asCaptionBody,
  asHashtagGroupBody,
  asCalendarBody,
  asNoteBody,
  asQueueBody,
  asProfileBody,
  asMediaBody,
  asBrandBody,
  asParagraphs,
  emptyParagraphs,
  paragraphsToPlainTextLocal,
  deriveHashtags,
  deriveMentions,
} from "./bodies";
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
