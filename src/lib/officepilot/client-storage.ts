/**
 * OfficePilot client-side storage.
 *
 * IndexedDB-backed. Documents are stored as a single object per row so the
 * editor can read and write the whole document in one transaction. The
 * document body is held in `body` and the metadata in `meta`, so a future
 * migration can change either side independently.
 *
 * This module is browser-only: it imports `indexedDB` at the top level, so
 * the server bundle never pulls it in. Server code that needs to read
 * documents goes through the recent-documents API instead.
 *
 * The on-disk format is JSON; `JSON.stringify` and `JSON.parse` are the
 * only operations needed. Larger documents could be migrated to structured
 * clone later without breaking the public API.
 */

import {
  MAX_DOCUMENT_BYTES,
  MAX_LOCAL_AGE_DAYS,
  MAX_LOCAL_DOCUMENTS,
  STORAGE_DATABASE,
  STORAGE_STORE,
  STORAGE_VERSION,
  type ListDocumentsOptions,
  type ListDocumentsResult,
  type SaveResult,
} from "./storage";
import type {
  OfficeDocument,
  OfficeDocumentSummary,
  OfficeEditorKind,
} from "./types";

/** A stored row. Mirrors the on-disk shape. */
interface StoredRow {
  id: string;
  document: OfficeDocument;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB is only available in the browser"));
      return;
    }
    const request = indexedDB.open(STORAGE_DATABASE, STORAGE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORAGE_STORE)) {
        db.createObjectStore(STORAGE_STORE, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("Unable to open IndexedDB"))
    );
  });
}

function runTransaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | Promise<T> | unknown
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORAGE_STORE, mode);
    const store = transaction.objectStore(STORAGE_STORE);
    let result: T | undefined;
    let settled = false;

    transaction.addEventListener("complete", () => {
      if (!settled) {
        settled = true;
        resolve(result as T);
      }
    });
    transaction.addEventListener("error", () => {
      if (!settled) {
        settled = true;
        reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      }
    });
    transaction.addEventListener("abort", () => {
      if (!settled) {
        settled = true;
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      }
    });

    try {
      const value = work(store);
      if (value && typeof (value as { onsuccess?: unknown }).onsuccess !== "undefined") {
        // The work returned an IDBRequest; capture the result via its handler.
        const request = value as IDBRequest<T>;
        request.onsuccess = () => {
          result = request.result as T;
        };
        request.onerror = () => {
          if (!settled) {
            settled = true;
            reject(request.error ?? new Error("IndexedDB request failed"));
          }
        };
      } else if (value && typeof (value as Promise<T>).then === "function") {
        Promise.resolve(value as Promise<T>)
          .then((resolved) => {
            result = resolved;
          })
          .catch((error) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          });
      }
    } catch (error) {
      if (!settled) {
        settled = true;
        reject(error);
      }
    }
  });
}

function toSummary(document: OfficeDocument): OfficeDocumentSummary {
  return {
    id: document.meta.id,
    kind: document.meta.kind,
    title: document.meta.title,
    category: document.meta.category,
    updatedAt: document.meta.updatedAt,
    autosavedAt: document.meta.autosavedAt,
    version: document.meta.version,
    size: document.meta.size,
  };
}

function documentSize(document: OfficeDocument): number {
  try {
    return new TextEncoder().encode(JSON.stringify(document)).byteLength;
  } catch {
    return document.meta.size;
  }
}

/** Opens the database, lazily creating the store if needed. */
async function withDatabase<T>(
  work: (db: IDBDatabase) => Promise<T>
): Promise<T> {
  if (!isBrowser()) throw new Error("IndexedDB is only available in the browser");
  const db = await openDatabase();
  try {
    return await work(db);
  } finally {
    db.close();
  }
}

/**
 * Creates a new document and persists it.
 *
 * The caller is responsible for generating the id; the storage does not
 * assign one so the same id can be referenced from server-side records
 * (e.g. the recent-documents index) without a second round trip.
 */
export async function createDocument(
  document: OfficeDocument
): Promise<SaveResult> {
  if (!document.meta.id) return { ok: false, reason: "missing-id" };
  if (!document.meta.kind) return { ok: false, reason: "invalid" };

  const size = documentSize(document);
  if (size > MAX_DOCUMENT_BYTES) return { ok: false, reason: "too-large" };

  const next: OfficeDocument = {
    ...document,
    meta: {
      ...document.meta,
      size,
      version: document.meta.version || 1,
      autosavedAt: document.meta.autosavedAt ?? null,
    },
  };

  try {
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) =>
        store.put({ id: next.meta.id, document: next } as StoredRow)
      )
    );
    await evictIfNeeded();
    return { ok: true, document: next };
  } catch {
    return { ok: false, reason: "io" };
  }
}

/**
 * Persists a document, returning a new document object with the metadata
 * fields (`updatedAt`, `autosavedAt`, `version`, `size`) updated.
 */
export async function saveDocument(
  document: OfficeDocument
): Promise<SaveResult> {
  if (!document.meta.id) return { ok: false, reason: "missing-id" };
  if (!document.meta.kind) return { ok: false, reason: "invalid" };

  const now = new Date().toISOString();
  const size = documentSize(document);
  if (size > MAX_DOCUMENT_BYTES) return { ok: false, reason: "too-large" };

  const next: OfficeDocument = {
    ...document,
    meta: {
      ...document.meta,
      size,
      updatedAt: now,
      autosavedAt: now,
      version: (document.meta.version || 0) + 1,
    },
  };

  try {
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) =>
        store.put({ id: next.meta.id, document: next } as StoredRow)
      )
    );
    await evictIfNeeded();
    return { ok: true, document: next };
  } catch {
    return { ok: false, reason: "io" };
  }
}

/**
 * Autosave variant. Reads the current row first and skips the write if the
 * body has not changed since the last autosave — that prevents a continuous
 * keystroke flood from rewriting the same document on every event.
 */
export async function autosaveDocument(
  document: OfficeDocument
): Promise<SaveResult | { ok: false; reason: "noop" }> {
  if (!isBrowser()) return { ok: false, reason: "noop" };
  const existing = await getDocument(document.meta.id);
  if (existing && JSON.stringify(existing.body) === JSON.stringify(document.body)) {
    return { ok: false, reason: "noop" };
  }
  return saveDocument(document);
}

/** Reads a single document. Returns `null` if it does not exist. */
export async function getDocument(id: string): Promise<OfficeDocument | null> {
  if (!isBrowser()) return null;
  try {
    const row = await withDatabase((db) =>
      runTransaction<StoredRow | undefined>(db, "readonly", (store) =>
        store.get(id)
      )
    );
    return row?.document ?? null;
  } catch {
    return null;
  }
}

/** Lists document summaries, newest first, with an optional kind filter. */
export async function listDocuments(
  options: ListDocumentsOptions = {}
): Promise<ListDocumentsResult> {
  if (!isBrowser()) return { summaries: [], total: 0 };
  const limit = options.limit ?? 100;
  try {
    const rows = await withDatabase((db) =>
      runTransaction<StoredRow[]>(db, "readonly", (store) => store.getAll())
    );
    const summaries = rows
      .map((row) => toSummary(row.document))
      .filter((summary) =>
        options.kind ? summary.kind === options.kind : true
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, Math.min(limit, 200));
    return { summaries, total: summaries.length };
  } catch {
    return { summaries: [], total: 0 };
  }
}

/** Renames a document and returns the updated summary, or `null`. */
export async function renameDocument(
  id: string,
  title: string
): Promise<OfficeDocumentSummary | null> {
  const existing = await getDocument(id);
  if (!existing) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  const result = await saveDocument({
    ...existing,
    meta: { ...existing.meta, title: trimmed.slice(0, 200) },
  });
  return result.ok ? toSummary(result.document) : null;
}

/** Duplicates a document under a new id, suffixed with "(copy)". */
export async function duplicateDocument(
  id: string
): Promise<OfficeDocument | null> {
  const existing = await getDocument(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const copy: OfficeDocument = {
    ...existing,
    meta: {
      ...existing.meta,
      id: `${existing.meta.id}-copy-${Date.now().toString(36)}`,
      title: `${existing.meta.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      autosavedAt: null,
      version: 1,
    },
  };
  const result = await createDocument(copy);
  return result.ok ? result.document : null;
}

/** Soft-deletes a document. */
export async function deleteDocument(id: string): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) => store.delete(id))
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Evicts old or excess documents so the local store stays within budget.
 *
 * The eviction is lazy and best-effort; the editor keeps working even when
 * it fails. The strategy is LRU: oldest updatedAt first, then any document
 * older than `MAX_LOCAL_AGE_DAYS`.
 */
async function evictIfNeeded(): Promise<void> {
  if (!isBrowser()) return;
  try {
    const rows = await withDatabase((db) =>
      runTransaction<StoredRow[]>(db, "readonly", (store) => store.getAll())
    );
    const cutoff = Date.now() - MAX_LOCAL_AGE_DAYS * 24 * 60 * 60 * 1000;
    const stale = rows
      .map((row) => row.document)
      .filter(
        (document) =>
          new Date(document.meta.updatedAt).getTime() < cutoff
      )
      .sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? -1 : 1));

    const toEvict: string[] = stale.map((document) => document.meta.id);

    // Add the oldest non-stale documents until the store is at or below
    // `MAX_LOCAL_DOCUMENTS`. The previous implementation undercounted the
    // additional rows to remove when many stale rows were present, so the
    // store could stay over the cap after eviction.
    const sorted = rows
      .map((row) => row.document)
      .sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? -1 : 1));
    for (const doc of sorted) {
      if (toEvict.length >= rows.length - MAX_LOCAL_DOCUMENTS) break;
      if (!toEvict.includes(doc.meta.id)) toEvict.push(doc.meta.id);
    }

    if (toEvict.length === 0) return;
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) => {
        for (const id of toEvict) store.delete(id);
        return store.getAllKeys();
      })
    );
  } catch {
    // Eviction is best-effort; a failure here never surfaces to the user.
  }
}

/**
 * Generates a stable id for a new document. The id is short and prefixed
 * with the editor kind, so the file manager and search can show it without
 * rendering a long UUID.
 */
export function generateDocumentId(kind: OfficeEditorKind): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${kind}-${Date.now().toString(36)}-${random}`;
}
