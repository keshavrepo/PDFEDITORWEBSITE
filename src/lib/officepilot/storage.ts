/**
 * OfficePilot document storage.
 *
 * Documents are stored in the browser (IndexedDB) so they are always
 * available offline and never have to round-trip a server. The platform
 * keeps a small "recent documents" mirror in the server database, so the
 * dashboard, file manager and search can list them without reading the
 * IndexedDB on every visit.
 *
 * This file only describes the storage layer. The actual IndexedDB code
 * lives in `client-storage.ts`; that file is loaded only in the browser so
 * the server bundle never imports `indexedDB`.
 */

import type {
  OfficeDocument,
  OfficeDocumentSummary,
  OfficeEditorKind,
} from "./types";

/** The IndexedDB database name. Stable across versions. */
export const STORAGE_DATABASE = "launchstack-officepilot";

/** Object store name. One per database, keyed by document id. */
export const STORAGE_STORE = "documents";

/** The current schema version. Bumped when the body shape changes. */
export const STORAGE_VERSION = 1;

/** Maximum document size, in bytes, that the storage will accept. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

/** Maximum number of documents stored locally. Older ones are evicted. */
export const MAX_LOCAL_DOCUMENTS = 200;

/** Maximum age in days of a document that the storage will retain. */
export const MAX_LOCAL_AGE_DAYS = 90;

/** A request to list recent documents. */
export interface ListDocumentsOptions {
  kind?: OfficeEditorKind;
  limit?: number;
}

/** Result of listing documents, sorted newest first. */
export interface ListDocumentsResult {
  summaries: OfficeDocumentSummary[];
  total: number;
}

/** Outcome of a save attempt. */
export type SaveResult =
  | { ok: true; document: OfficeDocument }
  | { ok: false; reason: "too-large" | "invalid" | "missing-id" | "io" };

/** Outcome of an autosave attempt. */
export type AutosaveResult = SaveResult | { ok: false; reason: "noop" };
