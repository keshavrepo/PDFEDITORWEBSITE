/**
 * AudioPilot client-side storage.
 *
 * IndexedDB-backed. Sessions are stored as a single object per row so
 * the workspace can read and write the whole session in one
 * transaction. The session body is held in `body` and the metadata
 * in `meta`, so a future migration can change either side
 * independently.
 *
 * This module is browser-only: it imports `indexedDB` at the top
 * level, so the server bundle never pulls it in. Server code that
 * needs to read sessions goes through the recent-sessions API
 * instead.
 *
 * The on-disk format is JSON; `JSON.stringify` and `JSON.parse` are
 * the only operations needed.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * `client-storage.ts` shape so a reader who knows one product knows
 * them all.
 */

import {
  MAX_LOCAL_AGE_DAYS,
  MAX_LOCAL_SESSIONS,
  MAX_SESSION_BYTES,
  SESSION_STORE,
  STORAGE_DATABASE,
  STORAGE_VERSION,
  type AutosaveResult,
  type ListSessionsOptions,
  type ListSessionsResult,
  type SaveResult,
} from "./storage";
import type {
  AudioSession,
  AudioSessionKind,
  AudioSessionSummary,
} from "./types";

/** A stored session row. Mirrors the on-disk shape. */
interface StoredSessionRow {
  id: string;
  session: AudioSession;
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
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "id" });
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
    const transaction = db.transaction(SESSION_STORE, mode);
    const store = transaction.objectStore(SESSION_STORE);
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

function toSummary(session: AudioSession): AudioSessionSummary {
  return {
    id: session.meta.id,
    kind: session.meta.kind,
    title: session.meta.title,
    category: session.meta.category,
    updatedAt: session.meta.updatedAt,
    autosavedAt: session.meta.autosavedAt,
    version: session.meta.version,
    size: session.meta.size,
    isFavorite: session.meta.isFavorite,
  };
}

function sessionSize(session: AudioSession): number {
  try {
    return new TextEncoder().encode(JSON.stringify(session)).byteLength;
  } catch {
    return session.meta.size;
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
 * Creates a new session and persists it.
 *
 * The caller is responsible for generating the id; the storage does not
 * assign one so the same id can be referenced from server-side records
 * (e.g. the recent-sessions index) without a second round trip.
 */
export async function createSessionStorage(
  session: AudioSession
): Promise<SaveResult> {
  if (!session.meta.id) return { ok: false, reason: "missing-id" };
  if (!session.meta.kind) return { ok: false, reason: "invalid" };

  const size = sessionSize(session);
  if (size > MAX_SESSION_BYTES) return { ok: false, reason: "too-large" };

  const next: AudioSession = {
    ...session,
    meta: {
      ...session.meta,
      size,
      version: session.meta.version || 1,
      autosavedAt: session.meta.autosavedAt ?? null,
    },
  };

  try {
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) =>
        store.put({ id: next.meta.id, session: next } as StoredSessionRow)
      )
    );
    await evictIfNeeded();
    return { ok: true, session: next };
  } catch {
    return { ok: false, reason: "io" };
  }
}

/**
 * Persists a session, returning a new object with the metadata
 * fields (`updatedAt`, `autosavedAt`, `version`, `size`) updated.
 */
export async function saveSessionStorage(
  session: AudioSession
): Promise<SaveResult> {
  if (!session.meta.id) return { ok: false, reason: "missing-id" };
  if (!session.meta.kind) return { ok: false, reason: "invalid" };

  const now = new Date().toISOString();
  const size = sessionSize(session);
  if (size > MAX_SESSION_BYTES) return { ok: false, reason: "too-large" };

  const next: AudioSession = {
    ...session,
    meta: {
      ...session.meta,
      size,
      updatedAt: now,
      autosavedAt: now,
      version: (session.meta.version || 0) + 1,
    },
  };

  try {
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) =>
        store.put({ id: next.meta.id, session: next } as StoredSessionRow)
      )
    );
    await evictIfNeeded();
    return { ok: true, session: next };
  } catch {
    return { ok: false, reason: "io" };
  }
}

/**
 * Autosave variant. Reads the current row first and skips the write if the
 * body has not changed since the last autosave — that prevents a continuous
 * scrub flood from rewriting the same session on every animation frame.
 */
export async function autosaveSessionStorage(
  session: AudioSession
): Promise<AutosaveResult> {
  if (!isBrowser()) return { ok: false, reason: "noop" };
  const existing = await getSessionStorage(session.meta.id);
  if (existing && JSON.stringify(existing.body) === JSON.stringify(session.body)) {
    return { ok: false, reason: "noop" };
  }
  return saveSessionStorage(session);
}

/** Reads a single session. Returns `null` if it does not exist. */
export async function getSessionStorage(
  id: string
): Promise<AudioSession | null> {
  if (!isBrowser()) return null;
  try {
    const row = await withDatabase((db) =>
      runTransaction<StoredSessionRow | undefined>(db, "readonly", (store) =>
        store.get(id)
      )
    );
    return row?.session ?? null;
  } catch {
    return null;
  }
}

/** Lists session summaries, newest first, with an optional kind filter. */
export async function listSessionsStorage(
  options: ListSessionsOptions = {}
): Promise<ListSessionsResult> {
  if (!isBrowser()) return { summaries: [], total: 0 };
  const limit = options.limit ?? 100;
  try {
    const rows = await withDatabase((db) =>
      runTransaction<StoredSessionRow[]>(db, "readonly", (store) => store.getAll())
    );
    const summaries = rows
      .map((row) => toSummary(row.session))
      .filter((summary) =>
        options.kind ? summary.kind === options.kind : true
      )
      .filter((summary) =>
        options.favoritesOnly ? summary.isFavorite : true
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, Math.min(limit, 200));
    return { summaries, total: summaries.length };
  } catch {
    return { summaries: [], total: 0 };
  }
}

/** Renames a session and returns the updated summary, or `null`. */
export async function renameSessionStorage(
  id: string,
  title: string
): Promise<AudioSessionSummary | null> {
  const existing = await getSessionStorage(id);
  if (!existing) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  const result = await saveSessionStorage({
    ...existing,
    meta: { ...existing.meta, title: trimmed.slice(0, 200) },
  });
  return result.ok && result.session ? toSummary(result.session) : null;
}

/** Toggles the favourite flag on a session. */
export async function toggleFavoriteSessionStorage(
  id: string
): Promise<AudioSessionSummary | null> {
  const existing = await getSessionStorage(id);
  if (!existing) return null;
  const result = await saveSessionStorage({
    ...existing,
    meta: { ...existing.meta, isFavorite: !existing.meta.isFavorite },
  });
  return result.ok && result.session ? toSummary(result.session) : null;
}

/** Duplicates a session under a new id, suffixed with "(copy)". */
export async function duplicateSessionStorage(
  id: string
): Promise<AudioSession | null> {
  const existing = await getSessionStorage(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const copy: AudioSession = {
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
  const result = await createSessionStorage(copy);
  return result.ok && result.session ? result.session : null;
}

/** Soft-deletes a session. */
export async function deleteSessionStorage(id: string): Promise<boolean> {
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
 * Evicts old or excess sessions so the local store stays within budget.
 *
 * The eviction is lazy and best-effort; the editor keeps working even when
 * it fails. The strategy is LRU: oldest updatedAt first, then any
 * session older than `MAX_LOCAL_AGE_DAYS`.
 */
async function evictIfNeeded(): Promise<void> {
  if (!isBrowser()) return;
  try {
    const rows = await withDatabase((db) =>
      runTransaction<StoredSessionRow[]>(db, "readonly", (store) => store.getAll())
    );
    const cutoff = Date.now() - MAX_LOCAL_AGE_DAYS * 24 * 60 * 60 * 1000;
    const stale = rows
      .map((row) => row.session)
      .filter(
        (session) => new Date(session.meta.updatedAt).getTime() < cutoff
      )
      .sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? -1 : 1));

    const toEvict: string[] = stale.map((session) => session.meta.id);

    const sorted = rows
      .map((row) => row.session)
      .sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? -1 : 1));
    for (const session of sorted) {
      if (toEvict.length >= rows.length - MAX_LOCAL_SESSIONS) break;
      if (!toEvict.includes(session.meta.id)) toEvict.push(session.meta.id);
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
 * Generates a stable id for a new session. The id is short and prefixed
 * with the session kind, so the file manager and search can show it
 * without rendering a long UUID.
 */
export function generateSessionId(kind: AudioSessionKind): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `audio-${kind}-${Date.now().toString(36)}-${random}`;
}
