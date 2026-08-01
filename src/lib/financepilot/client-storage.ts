/**
 * FinancePilot client-side storage.
 *
 * IndexedDB-backed. Calculations are stored as a single object per row so
 * the editor can read and write the whole calculation in one transaction.
 * The calculation body is held in `body` and the metadata in `meta`, so a
 * future migration can change either side independently.
 *
 * This module is browser-only: it imports `indexedDB` at the top level, so
 * the server bundle never pulls it in. Server code that needs to read
 * calculations goes through the recent-calculations API instead.
 *
 * The on-disk format is JSON; `JSON.stringify` and `JSON.parse` are the
 * only operations needed. Larger calculations could be migrated to
 * structured clone later without breaking the public API.
 */

import {
  MAX_CALCULATION_BYTES,
  MAX_LOCAL_AGE_DAYS,
  MAX_LOCAL_CALCULATIONS,
  STORAGE_DATABASE,
  STORAGE_STORE,
  STORAGE_VERSION,
  type AutosaveResult,
  type ListCalculationsOptions,
  type ListCalculationsResult,
  type SaveResult,
} from "./storage";
import type {
  FinanceCalculation,
  FinanceCalculationSummary,
  FinanceCalculatorKind,
} from "./types";

/** A stored row. Mirrors the on-disk shape. */
interface StoredRow {
  id: string;
  calculation: FinanceCalculation;
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

function toSummary(calculation: FinanceCalculation): FinanceCalculationSummary {
  return {
    id: calculation.meta.id,
    kind: calculation.meta.kind,
    title: calculation.meta.title,
    category: calculation.meta.category,
    updatedAt: calculation.meta.updatedAt,
    autosavedAt: calculation.meta.autosavedAt,
    version: calculation.meta.version,
    size: calculation.meta.size,
  };
}

function calculationSize(calculation: FinanceCalculation): number {
  try {
    return new TextEncoder().encode(JSON.stringify(calculation)).byteLength;
  } catch {
    return calculation.meta.size;
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
 * Creates a new calculation and persists it.
 *
 * The caller is responsible for generating the id; the storage does not
 * assign one so the same id can be referenced from server-side records
 * (e.g. the recent-calculations index) without a second round trip.
 */
export async function createCalculation(
  calculation: FinanceCalculation
): Promise<SaveResult> {
  if (!calculation.meta.id) return { ok: false, reason: "missing-id" };
  if (!calculation.meta.kind) return { ok: false, reason: "invalid" };

  const size = calculationSize(calculation);
  if (size > MAX_CALCULATION_BYTES) return { ok: false, reason: "too-large" };

  const next: FinanceCalculation = {
    ...calculation,
    meta: {
      ...calculation.meta,
      size,
      version: calculation.meta.version || 1,
      autosavedAt: calculation.meta.autosavedAt ?? null,
    },
  };

  try {
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) =>
        store.put({ id: next.meta.id, calculation: next } as StoredRow)
      )
    );
    await evictIfNeeded();
    return { ok: true, calculation: next };
  } catch {
    return { ok: false, reason: "io" };
  }
}

/**
 * Persists a calculation, returning a new object with the metadata
 * fields (`updatedAt`, `autosavedAt`, `version`, `size`) updated.
 */
export async function saveCalculation(
  calculation: FinanceCalculation
): Promise<SaveResult> {
  if (!calculation.meta.id) return { ok: false, reason: "missing-id" };
  if (!calculation.meta.kind) return { ok: false, reason: "invalid" };

  const now = new Date().toISOString();
  const size = calculationSize(calculation);
  if (size > MAX_CALCULATION_BYTES) return { ok: false, reason: "too-large" };

  const next: FinanceCalculation = {
    ...calculation,
    meta: {
      ...calculation.meta,
      size,
      updatedAt: now,
      autosavedAt: now,
      version: (calculation.meta.version || 0) + 1,
    },
  };

  try {
    await withDatabase((db) =>
      runTransaction(db, "readwrite", (store) =>
        store.put({ id: next.meta.id, calculation: next } as StoredRow)
      )
    );
    await evictIfNeeded();
    return { ok: true, calculation: next };
  } catch {
    return { ok: false, reason: "io" };
  }
}

/**
 * Autosave variant. Reads the current row first and skips the write if the
 * body has not changed since the last autosave — that prevents a continuous
 * keystroke flood from rewriting the same calculation on every event.
 */
export async function autosaveCalculation(
  calculation: FinanceCalculation
): Promise<AutosaveResult> {
  if (!isBrowser()) return { ok: false, reason: "noop" };
  const existing = await getCalculation(calculation.meta.id);
  if (existing && JSON.stringify(existing.body) === JSON.stringify(calculation.body)) {
    return { ok: false, reason: "noop" };
  }
  return saveCalculation(calculation);
}

/** Reads a single calculation. Returns `null` if it does not exist. */
export async function getCalculation(
  id: string
): Promise<FinanceCalculation | null> {
  if (!isBrowser()) return null;
  try {
    const row = await withDatabase((db) =>
      runTransaction<StoredRow | undefined>(db, "readonly", (store) =>
        store.get(id)
      )
    );
    return row?.calculation ?? null;
  } catch {
    return null;
  }
}

/** Lists calculation summaries, newest first, with an optional kind filter. */
export async function listCalculations(
  options: ListCalculationsOptions = {}
): Promise<ListCalculationsResult> {
  if (!isBrowser()) return { summaries: [], total: 0 };
  const limit = options.limit ?? 100;
  try {
    const rows = await withDatabase((db) =>
      runTransaction<StoredRow[]>(db, "readonly", (store) => store.getAll())
    );
    const summaries = rows
      .map((row) => toSummary(row.calculation))
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

/** Renames a calculation and returns the updated summary, or `null`. */
export async function renameCalculation(
  id: string,
  title: string
): Promise<FinanceCalculationSummary | null> {
  const existing = await getCalculation(id);
  if (!existing) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  const result = await saveCalculation({
    ...existing,
    meta: { ...existing.meta, title: trimmed.slice(0, 200) },
  });
  return result.ok ? toSummary(result.calculation) : null;
}

/** Duplicates a calculation under a new id, suffixed with "(copy)". */
export async function duplicateCalculation(
  id: string
): Promise<FinanceCalculation | null> {
  const existing = await getCalculation(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const copy: FinanceCalculation = {
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
  const result = await createCalculation(copy);
  return result.ok ? result.calculation : null;
}

/** Soft-deletes a calculation. */
export async function deleteCalculation(id: string): Promise<boolean> {
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
 * Evicts old or excess calculations so the local store stays within budget.
 *
 * The eviction is lazy and best-effort; the editor keeps working even when
 * it fails. The strategy is LRU: oldest updatedAt first, then any
 * calculation older than `MAX_LOCAL_AGE_DAYS`.
 */
async function evictIfNeeded(): Promise<void> {
  if (!isBrowser()) return;
  try {
    const rows = await withDatabase((db) =>
      runTransaction<StoredRow[]>(db, "readonly", (store) => store.getAll())
    );
    const cutoff = Date.now() - MAX_LOCAL_AGE_DAYS * 24 * 60 * 60 * 1000;
    const stale = rows
      .map((row) => row.calculation)
      .filter(
        (calculation) =>
          new Date(calculation.meta.updatedAt).getTime() < cutoff
      )
      .sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? -1 : 1));

    const toEvict: string[] = stale.map((calculation) => calculation.meta.id);

    // Add the oldest non-stale calculations until the store is at or below
    // `MAX_LOCAL_CALCULATIONS`.
    const sorted = rows
      .map((row) => row.calculation)
      .sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? -1 : 1));
    for (const calc of sorted) {
      if (toEvict.length >= rows.length - MAX_LOCAL_CALCULATIONS) break;
      if (!toEvict.includes(calc.meta.id)) toEvict.push(calc.meta.id);
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
 * Generates a stable id for a new calculation. The id is short and prefixed
 * with the calculator kind, so the file manager and search can show it
 * without rendering a long UUID.
 */
export function generateCalculationId(kind: FinanceCalculatorKind): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `fin-${kind}-${Date.now().toString(36)}-${random}`;
}
