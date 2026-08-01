/**
 * SocialPilot client-side storage.
 *
 * IndexedDB-backed. Projects and media assets are stored as a single
 * object per row so the workspace can read and write the whole
 * project in one transaction. The project body is held in `body` and
 * the metadata in `meta`, so a future migration can change either side
 * independently.
 *
 * This module is browser-only: it imports `indexedDB` at the top
 * level, so the server bundle never pulls it in. Server code that
 * needs to read projects goes through the recent-projects API
 * instead.
 *
 * The on-disk format is JSON; `JSON.stringify` and `JSON.parse` are
 * the only operations needed for projects. Media assets are stored as
 * the file binary plus a metadata envelope.
 */

import {
  ASSET_STORE,
  MAX_ASSET_BYTES,
  MAX_LOCAL_ASSETS,
  MAX_LOCAL_AGE_DAYS,
  MAX_LOCAL_PROJECTS,
  MAX_PROJECT_BYTES,
  PROJECT_STORE,
  STORAGE_DATABASE,
  STORAGE_VERSION,
  type AutosaveResult,
  type ListAssetsOptions,
  type ListAssetsResult,
  type ListProjectsOptions,
  type ListProjectsResult,
  type SaveResult,
} from "./storage";
import type {
  SocialMediaAsset,
  SocialMediaAssetSummary,
  SocialProject,
  SocialProjectKind,
  SocialProjectSummary,
} from "./types";

/** A stored project row. Mirrors the on-disk shape. */
interface StoredProjectRow {
  id: string;
  project: SocialProject;
}

/** A stored asset row. Mirrors the on-disk shape. */
interface StoredAssetRow {
  id: string;
  asset: SocialMediaAsset;
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
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE, { keyPath: "id" });
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
      const rows = (getAll.result as Array<{ project?: SocialProject; asset?: SocialMediaAsset }>)
        .filter((row) => row.project || row.asset);
      // Newest first.
      rows.sort((a, b) => {
        const aMeta = a.project?.meta ?? a.asset!;
        const bMeta = b.project?.meta ?? b.asset!;
        return new Date(bMeta.updatedAt).getTime() - new Date(aMeta.updatedAt).getTime();
      });
      const cutoff = Date.now() - MAX_LOCAL_AGE_DAYS * 24 * 60 * 60 * 1000;
      const toDelete: string[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row) continue;
        const meta = row.project?.meta ?? row.asset!;
        const updated = new Date(meta.updatedAt).getTime();
        if (updated < cutoff) {
          toDelete.push(meta.id);
          continue;
        }
        if (i >= limit) {
          toDelete.push(meta.id);
        }
      }
      for (const id of toDelete) {
        store.delete(id);
      }
    };
    return getAll;
  });
}

/** Generates a stable project id of the form `social-<kind>-<suffix>`. */
export function generateProjectId(kind: SocialProjectKind): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  const safeKind = (kind || "project").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "project";
  return `social-${safeKind}-${suffix}`;
}

/** Generates a stable asset id of the form `media-<suffix>`. */
export function generateAssetId(): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `media-${suffix}`;
}

function projectToSummary(project: SocialProject): SocialProjectSummary {
  return {
    id: project.meta.id,
    kind: project.meta.kind,
    title: project.meta.title,
    category: project.meta.category,
    updatedAt: project.meta.updatedAt,
    autosavedAt: project.meta.autosavedAt,
    version: project.meta.version,
    size: project.meta.size,
    isFavorite: project.meta.isFavorite,
  };
}

function assetToSummary(asset: SocialMediaAsset): SocialMediaAssetSummary {
  return {
    id: asset.id,
    kind: asset.kind,
    title: asset.title,
    filename: asset.filename,
    mimeType: asset.mimeType,
    size: asset.size,
    projectId: asset.projectId,
    tags: asset.tags,
    updatedAt: asset.updatedAt,
    createdAt: asset.createdAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

/** Creates a project in the store. */
export async function createProjectStorage(
  project: SocialProject
): Promise<SaveResult> {
  if (!isBrowser()) {
    return { ok: true, project };
  }
  if (!project.meta.id) {
    return { ok: false, reason: "missing-id" };
  }
  const json = JSON.stringify(project);
  if (json.length > MAX_PROJECT_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  const db = await openDatabase();
  const row: StoredProjectRow = { id: project.meta.id, project };
  const result = await runTransaction<unknown>(db, PROJECT_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).put(row);
  });
  if (result instanceof Error) return { ok: false, reason: "io" };
  await evictIfNeeded(db, PROJECT_STORE, MAX_LOCAL_PROJECTS);
  return { ok: true, project };
}

/** Reads a project from the store. Returns null if it does not exist. */
export async function getProjectStorage(
  id: string
): Promise<SocialProject | null> {
  if (!isBrowser()) return null;
  const db = await openDatabase();
  const row = await runTransaction<StoredProjectRow | undefined>(
    db,
    PROJECT_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).get(id) as IDBRequest<StoredProjectRow | undefined>
  );
  return row?.project ?? null;
}

/** Lists project summaries, newest first. */
export async function listProjectsStorage(
  options: ListProjectsOptions = {}
): Promise<ListProjectsResult> {
  if (!isBrowser()) return { summaries: [], total: 0 };
  const db = await openDatabase();
  const rows = await runTransaction<StoredProjectRow[]>(
    db,
    PROJECT_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).getAll() as IDBRequest<StoredProjectRow[]>
  );
  const limit = Math.min(options.limit ?? 200, MAX_LOCAL_PROJECTS);
  const summaries = rows
    .map((row) => row.project)
    .filter((project): project is SocialProject => Boolean(project))
    .filter((project) => (options.kind ? project.meta.kind === options.kind : true))
    .filter((project) =>
      options.favoritesOnly ? project.meta.isFavorite : true
    )
    .map(projectToSummary)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
  return { summaries, total: rows.length };
}

/** Saves a project, bumping the version and timestamps. */
export async function saveProjectStorage(
  project: SocialProject
): Promise<SaveResult> {
  if (!isBrowser()) {
    return { ok: true, project };
  }
  if (!project.meta.id) {
    return { ok: false, reason: "missing-id" };
  }
  const json = JSON.stringify(project);
  if (json.length > MAX_PROJECT_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  const db = await openDatabase();
  const next: SocialProject = {
    ...project,
    meta: {
      ...project.meta,
      updatedAt: new Date().toISOString(),
      version: project.meta.version + 1,
      size: json.length,
    },
  };
  const row: StoredProjectRow = { id: next.meta.id, project: next };
  await runTransaction<unknown>(db, PROJECT_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).put(row);
  });
  await evictIfNeeded(db, PROJECT_STORE, MAX_LOCAL_PROJECTS);
  return { ok: true, project: next };
}

/** Autosaves a project, skipping the write when the body is unchanged. */
export async function autosaveProjectStorage(
  project: SocialProject
): Promise<AutosaveResult> {
  const existing = await getProjectStorage(project.meta.id);
  if (existing && JSON.stringify(existing.body) === JSON.stringify(project.body)) {
    return { ok: false, reason: "noop" };
  }
  return saveProjectStorage(project);
}

/** Renames a project and returns the new summary. */
export async function renameProjectStorage(
  id: string,
  title: string
): Promise<SocialProjectSummary | null> {
  const existing = await getProjectStorage(id);
  if (!existing) return null;
  const next: SocialProject = {
    ...existing,
    meta: {
      ...existing.meta,
      title: title.trim() || existing.meta.title,
      updatedAt: new Date().toISOString(),
      version: existing.meta.version + 1,
    },
  };
  const result = await saveProjectStorage(next);
  if (!result.ok) return null;
  return projectToSummary(result.project);
}

/** Toggles the favourite flag on a project. */
export async function toggleFavoriteProjectStorage(
  id: string
): Promise<SocialProjectSummary | null> {
  const existing = await getProjectStorage(id);
  if (!existing) return null;
  const next: SocialProject = {
    ...existing,
    meta: {
      ...existing.meta,
      isFavorite: !existing.meta.isFavorite,
      updatedAt: new Date().toISOString(),
      version: existing.meta.version + 1,
    },
  };
  const result = await saveProjectStorage(next);
  if (!result.ok) return null;
  return projectToSummary(result.project);
}

/** Duplicates a project with a fresh id and a " (copy)" suffix. */
export async function duplicateProjectStorage(
  id: string
): Promise<SocialProject | null> {
  const existing = await getProjectStorage(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const copy: SocialProject = {
    meta: {
      ...existing.meta,
      id: generateProjectId(existing.meta.kind),
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
  const result = await createProjectStorage(copy);
  if (!result.ok) return null;
  return result.project;
}

/** Soft-deletes a project from the store. */
export async function deleteProjectStorage(id: string): Promise<boolean> {
  if (!isBrowser()) return true;
  const db = await openDatabase();
  await runTransaction<unknown>(db, PROJECT_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).delete(id);
  });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Media assets                                                               */
/* -------------------------------------------------------------------------- */

/** Saves a media asset to the store. */
export async function saveAssetStorage(
  asset: SocialMediaAsset
): Promise<{ ok: true; asset: SocialMediaAsset } | { ok: false; reason: "too-large" | "missing-id" }> {
  if (!asset.id) {
    return { ok: false, reason: "missing-id" };
  }
  if (asset.size > MAX_ASSET_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  if (!isBrowser()) {
    return { ok: true, asset };
  }
  const db = await openDatabase();
  const row: StoredAssetRow = { id: asset.id, asset };
  await runTransaction<unknown>(db, ASSET_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).put(row);
  });
  await evictIfNeeded(db, ASSET_STORE, MAX_LOCAL_ASSETS);
  return { ok: true, asset };
}

/** Reads a media asset from the store. */
export async function getAssetStorage(
  id: string
): Promise<SocialMediaAsset | null> {
  if (!isBrowser()) return null;
  const db = await openDatabase();
  const row = await runTransaction<StoredAssetRow | undefined>(
    db,
    ASSET_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).get(id) as IDBRequest<StoredAssetRow | undefined>
  );
  return row?.asset ?? null;
}

/** Lists media asset summaries, newest first. */
export async function listAssetsStorage(
  options: ListAssetsOptions = {}
): Promise<ListAssetsResult> {
  if (!isBrowser()) return { assets: [], total: 0 };
  const db = await openDatabase();
  const rows = await runTransaction<StoredAssetRow[]>(
    db,
    ASSET_STORE,
    "readonly",
    (store) => (store as IDBObjectStore).getAll() as IDBRequest<StoredAssetRow[]>
  );
  const limit = Math.min(options.limit ?? 200, MAX_LOCAL_ASSETS);
  const search = options.search?.trim().toLowerCase();
  const assets = rows
    .map((row) => row.asset)
    .filter((asset): asset is SocialMediaAsset => Boolean(asset))
    .filter((asset) => (options.kind ? asset.kind === options.kind : true))
    .filter((asset) =>
      options.projectId === undefined
        ? true
        : options.projectId === null
          ? asset.projectId === null
          : asset.projectId === options.projectId
    )
    .filter((asset) => {
      if (!search) return true;
      return (
        asset.title.toLowerCase().includes(search) ||
        asset.filename.toLowerCase().includes(search) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(search))
      );
    })
    .map(assetToSummary)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
  return { assets, total: rows.length };
}

/** Deletes a media asset from the store. */
export async function deleteAssetStorage(id: string): Promise<boolean> {
  if (!isBrowser()) return true;
  const db = await openDatabase();
  await runTransaction<unknown>(db, ASSET_STORE, "readwrite", (store) => {
    return (store as IDBObjectStore).delete(id);
  });
  return true;
}
