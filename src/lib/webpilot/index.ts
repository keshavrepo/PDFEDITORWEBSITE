/**
 * WebPilot public surface.
 *
 * Components import from this file rather than the underlying modules,
 * so the engine can move pieces between files without breaking every
 * caller.
 *
 * Mirrors the SocialPilot / FinancePilot / DevPilot public surface.
 */

export * from "./types";
export * from "./sessions";
export * from "./templates";
export {
  PROFESSIONAL_PROJECT_TEMPLATES,
  PROFESSIONAL_TEMPLATE_DESCRIPTORS,
  buildProjectTemplateBody,
  type ProfessionalProjectTemplate,
} from "./templates";
export * from "./engine";
export {
  DEFAULT_HISTORY_BODY,
  DEFAULT_HTML_BODY,
  DEFAULT_CSS_BODY,
  DEFAULT_JS_BODY,
  DEFAULT_PREVIEW_BODY,
  DEFAULT_PROJECTS_BODY,
  DEFAULT_ASSETS_BODY,
  DEFAULT_WORKSPACE_BODY,
  DEFAULT_SEARCH_BODY,
  DEFAULT_UTILITIES_BODY,
  DEFAULT_TERMINAL_BODY,
  DEFAULT_INTELLIGENCE_BODY,
  DEFAULT_VALIDATION_BODY,
  DEFAULT_EXPORT_BODY,
  DEFAULT_IMPORT_BODY,
  DEFAULT_PRODUCTIVITY_BODY,
  DEFAULT_SETTINGS_BODY,
  DEFAULT_PROJECT_HISTORY_BODY,
  DEFAULT_DASHBOARD_BODY,
  asHistoryBody,
  asHtmlBody,
  asCssBody,
  asJsBody,
  asPreviewBody,
  asProjectsBody,
  asAssetsBody,
  asWorkspaceBody,
  asSearchBody,
  asUtilitiesBody,
  asTerminalBody,
  asIntelligenceBody,
  asValidationBody,
  asExportBody,
  asImportBody,
  asProductivityBody,
  asSettingsBody,
  asProjectHistoryBody,
  asDashboardBody,
  cloneProjectsBody,
  cloneUtilitiesBody,
  cloneTerminalBody,
  cloneIntelligenceBody,
  cloneProductivityBody,
  cloneSettingsBody,
  cloneProjectHistoryBody,
  cloneDashboardBody,
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
export * from "./tools";
