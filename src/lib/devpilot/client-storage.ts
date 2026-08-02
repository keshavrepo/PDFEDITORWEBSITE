/**
 * DevPilot client-side storage.
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
 * Mirrors the SocialPilot `client-storage.ts` shape so a reader who
 * knows one product knows them all.
 */

import {
  HISTORY_STORE,
  MAX_LOCAL_AGE_DAYS,
  MAX_LOCAL_HISTORY,
  MAX_LOCAL_SESSIONS,
  MAX_SESSION_BYTES,
  SESSION_STORE,
  STORAGE_DATABASE,
  STORAGE_VERSION,
  type AutosaveResult,
  type ListHistoryOptions,
  type ListHistoryResult,
  type ListSessionsOptions,
  type ListSessionsResult,
  type SaveResult,
} from "./storage";
import type {
  DevHistoryEntry,
  DevSession,
  DevSessionKind,
  DevSessionSummary,
} from "./types";

/** A stored session row. Mirrors the on-disk shape. */
interface StoredSessionRow {
  id: string;
  session: DevSession;
}

/** A stored history row. Mirrors the on-disk shape. */
interface StoredHistoryRow {
  id: string;
  entry: DevHistoryEntry;
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
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
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
  stores: string | string[],
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | Promise<T> | unknown
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
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
      const firstStore = Array.isArray(stores) ? stores[0]! : stores;
      const objectStore = transaction.objectStore(firstStore) as IDBObjectStore;
      const value = work(objectStore);
      if (value && typeof (value as { onsuccess?: unknown }).onsuccess !== "undefined") {
        const request = value as IDBRequest<T>;
        request.onsuccess = () => {
          result = request.result as T;
        };
      } else if (value && typeof (value as Promise<T>).then === "function") {
        void (value as Promise<T>).then((r) => {
          result = r;
        });
      }
    } catch (err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
}

function evictIfNeeded(
  db: IDBDatabase,
  storeName: string,
  limit: number
): Promise<void> {
  return runTransaction<void>(db, storeName, "readwrite", (store) => {
    const getAll = store.getAll();
    getAll.onsuccess = () => {
      const rows = (getAll.result as Array<{
        session?: DevSession;
        entry?: DevHistoryEntry;
      }>).filter((row) => row.session || row.entry);
      // Newest first.
      rows.sort((a, b) => {
        const aStamp =
          (a.session?.meta.updatedAt ?? a.entry?.createdAt) ?? "";
        const bStamp =
          (b.session?.meta.updatedAt ?? b.entry?.createdAt) ?? "";
        return new Date(bStamp).getTime() - new Date(aStamp).getTime();
      });
      const cutoff = Date.now() - MAX_LOCAL_AGE_DAYS * 24 * 60 * 60 * 1000;
      const toDelete: string[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row) continue;
        const stamp =
          (row.session?.meta.updatedAt ?? row.entry?.createdAt) ?? "";
        const updated = new Date(stamp).getTime();
        if (updated < cutoff) {
          toDelete.push(row.session?.meta.id ?? row.entry!.id);
          continue;
        }
        if (i >= limit) {
          toDelete.push(row.session?.meta.id ?? row.entry!.id);
        }
      }
      for (const id of toDelete) {
        store.delete(id);
      }
    };
    return getAll;
  });
}

/** Generates a stable session id of the form `dev-<kind>-<suffix>`. */
export function generateSessionId(kind: DevSessionKind): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  const safeKind = (kind || "session").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "session";
  return `dev-${safeKind}-${suffix}`;
}

/** Generates a stable history entry id of the form `devhist-<suffix>`. */
export function generateHistoryId(): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `devhist-${suffix}`;
}

function sessionToSummary(session: DevSession): DevSessionSummary {
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

function entryToSummary(entry: DevHistoryEntry): DevSessionSummary {
  return {
    id: entry.id,
    kind: "history",
    title: entry.text.slice(0, 80) || "Untitled entry",
    category: (entry.category as DevSessionSummary["category"]) ?? "history",
    updatedAt: entry.createdAt,
    autosavedAt: entry.createdAt,
    version: 1,
    size: entry.text.length,
    isFavorite: entry.isFavorite,
  };
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

/** Creates a session in the store. */
export async function createSessionStorage(
  session: DevSession
): Promise<SaveResult> {
  if (!isBrowser()) {
    return { ok: true, session };
  }
  if (!session.meta.id) {
    return { ok: false, reason: "missing-id" };
  }
  const json = JSON.stringify(session);
  if (json.length > MAX_SESSION_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  const db = await openDatabase();
  const row: StoredSessionRow = { id: session.meta.id, session };
  const result = await runTransaction<unknown>(db, SESSION_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).put(row);
  });
  if (result instanceof Error) return { ok: false, reason: "io" };
  await evictIfNeeded(db, SESSION_STORE, MAX_LOCAL_SESSIONS);
  return { ok: true, session };
}

/** Reads a session from the store. Returns null if it does not exist. */
export async function getSessionStorage(
  id: string
): Promise<DevSession | null> {
  if (!isBrowser()) return null;
  const db = await openDatabase();
  const row = await runTransaction<StoredSessionRow | undefined>(
    db,
    SESSION_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).get(id) as IDBRequest<StoredSessionRow | undefined>
  );
  return row?.session ?? null;
}

/** Lists session summaries, newest first. */
export async function listSessionsStorage(
  options: ListSessionsOptions = {}
): Promise<ListSessionsResult> {
  if (!isBrowser()) return { summaries: [], total: 0 };
  const db = await openDatabase();
  const rows = await runTransaction<StoredSessionRow[]>(
    db,
    SESSION_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).getAll() as IDBRequest<StoredSessionRow[]>
  );
  const limit = Math.min(options.limit ?? 200, MAX_LOCAL_SESSIONS);
  const summaries = rows
    .map((row) => row.session)
    .filter((session): session is DevSession => Boolean(session))
    .filter((session) => (options.kind ? session.meta.kind === options.kind : true))
    .filter((session) =>
      options.favoritesOnly ? session.meta.isFavorite : true
    )
    .map(sessionToSummary)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
  return { summaries, total: rows.length };
}

/** Saves a session, bumping the version and timestamps. */
export async function saveSessionStorage(
  session: DevSession
): Promise<SaveResult> {
  if (!isBrowser()) {
    return { ok: true, session };
  }
  if (!session.meta.id) {
    return { ok: false, reason: "missing-id" };
  }
  const json = JSON.stringify(session);
  if (json.length > MAX_SESSION_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  const db = await openDatabase();
  const next: DevSession = {
    ...session,
    meta: {
      ...session.meta,
      updatedAt: new Date().toISOString(),
      version: session.meta.version + 1,
      size: json.length,
    },
  };
  const row: StoredSessionRow = { id: next.meta.id, session: next };
  await runTransaction<unknown>(db, SESSION_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).put(row);
  });
  await evictIfNeeded(db, SESSION_STORE, MAX_LOCAL_SESSIONS);
  return { ok: true, session: next };
}

/** Autosaves a session, skipping the write when the body is unchanged. */
export async function autosaveSessionStorage(
  session: DevSession
): Promise<AutosaveResult> {
  const existing = await getSessionStorage(session.meta.id);
  if (existing && JSON.stringify(existing.body) === JSON.stringify(session.body)) {
    return { ok: false, reason: "noop" };
  }
  return saveSessionStorage(session);
}

/** Renames a session and returns the new summary. */
export async function renameSessionStorage(
  id: string,
  title: string
): Promise<DevSessionSummary | null> {
  const existing = await getSessionStorage(id);
  if (!existing) return null;
  const next: DevSession = {
    ...existing,
    meta: {
      ...existing.meta,
      title: title.trim() || existing.meta.title,
      updatedAt: new Date().toISOString(),
      version: existing.meta.version + 1,
    },
  };
  const result = await saveSessionStorage(next);
  if (!result.ok) return null;
  return sessionToSummary(result.session);
}

/** Toggles the favourite flag on a session. */
export async function toggleFavoriteSessionStorage(
  id: string
): Promise<DevSessionSummary | null> {
  const existing = await getSessionStorage(id);
  if (!existing) return null;
  const next: DevSession = {
    ...existing,
    meta: {
      ...existing.meta,
      isFavorite: !existing.meta.isFavorite,
      updatedAt: new Date().toISOString(),
      version: existing.meta.version + 1,
    },
  };
  const result = await saveSessionStorage(next);
  if (!result.ok) return null;
  return sessionToSummary(result.session);
}

/** Duplicates a session with a fresh id and a " (copy)" suffix. */
export async function duplicateSessionStorage(
  id: string
): Promise<DevSession | null> {
  const existing = await getSessionStorage(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const copy: DevSession = {
    meta: {
      ...existing.meta,
      id: generateSessionId(existing.meta.kind),
      title: `${existing.meta.title} (copy)`,
      version: 1,
      autosavedAt: null,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      size: 0,
    },
    body: existing.body,
  };
  const result = await createSessionStorage(copy);
  if (!result.ok) return null;
  return result.session;
}

/** Soft-deletes a session from the store. */
export async function deleteSessionStorage(id: string): Promise<boolean> {
  if (!isBrowser()) return true;
  const db = await openDatabase();
  await runTransaction<unknown>(db, SESSION_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).delete(id);
  });
  return true;
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

/** Saves a history entry to the store. */
export async function saveHistoryStorage(
  entry: DevHistoryEntry
): Promise<
  | { ok: true; entry: DevHistoryEntry }
  | { ok: false; reason: "missing-id" | "io" }
> {
  if (!entry.id) return { ok: false, reason: "missing-id" };
  if (!isBrowser()) return { ok: true, entry };
  const db = await openDatabase();
  const row: StoredHistoryRow = { id: entry.id, entry };
  await runTransaction<unknown>(db, HISTORY_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).put(row);
  });
  await evictIfNeeded(db, HISTORY_STORE, MAX_LOCAL_HISTORY);
  return { ok: true, entry };
}

/** Lists history summaries, newest first. */
export async function listHistoryStorage(
  options: ListHistoryOptions = {}
): Promise<ListHistoryResult> {
  if (!isBrowser()) return { entries: [], total: 0 };
  const db = await openDatabase();
  const rows = await runTransaction<StoredHistoryRow[]>(
    db,
    HISTORY_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).getAll() as IDBRequest<StoredHistoryRow[]>
  );
  const limit = Math.min(options.limit ?? 200, MAX_LOCAL_HISTORY);
  const entries = rows
    .map((row) => row.entry)
    .filter((entry): entry is DevHistoryEntry => Boolean(entry))
    .filter((entry) => (options.toolName ? entry.toolName === options.toolName : true))
    .filter((entry) => (options.favoritesOnly ? entry.isFavorite : true))
    .map(entryToSummary)
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
  return { entries, total: rows.length };
}

/** Soft-deletes a history entry from the store. */
export async function deleteHistoryStorage(id: string): Promise<boolean> {
  if (!isBrowser()) return true;
  const db = await openDatabase();
  await runTransaction<unknown>(db, HISTORY_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).delete(id);
  });
  return true;
}

/** Toggles the favourite flag on a history entry. */
export async function toggleFavoriteHistoryStorage(
  id: string
): Promise<DevHistoryEntry | null> {
  if (!isBrowser()) return null;
  const db = await openDatabase();
  const row = await runTransaction<StoredHistoryRow | undefined>(
    db,
    HISTORY_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).get(id) as IDBRequest<StoredHistoryRow | undefined>
  );
  if (!row?.entry) return null;
  const next: DevHistoryEntry = {
    ...row.entry,
    isFavorite: !row.entry.isFavorite,
  };
  const result = await saveHistoryStorage(next);
  return result.ok ? result.entry : null;
}
