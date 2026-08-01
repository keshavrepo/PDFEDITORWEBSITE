/**
 * SocialPilot server-side recent-projects index.
 *
 * The IndexedDB-backed client storage is the source of truth for
 * project bodies; this table is just the small index the dashboard,
 * file manager and search use to know what the user has been working
 * on.
 *
 * All writes are best-effort: a failed update never propagates back
 * to the editor. Reads honour `limit` and an optional `kind` filter so
 * the API can serve a small recent list without pagination.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { socialProjects } from "@/db/schema";
import type {
  SocialProject,
  SocialProjectKind,
  SocialProjectSummary,
} from "./types";

/** Maximum number of rows kept per user. Older rows are pruned. */
const RECENT_LIMIT_PER_USER = 200;

function toSummary(row: {
  id: string;
  kind: string;
  title: string;
  category: string;
  version: number;
  size: number;
  isFavorite: boolean;
  updatedAt: Date;
}): SocialProjectSummary {
  return {
    id: row.id,
    kind: row.kind as SocialProjectKind,
    title: row.title,
    category: row.category as SocialProjectSummary["category"],
    updatedAt: row.updatedAt.toISOString(),
    // The server mirror only tracks `updatedAt`; the dedicated
    // `autosavedAt` column does not exist on this table, so we report
    // `null` here instead of pretending the modified-time is also an
    // autosave timestamp.
    autosavedAt: null,
    version: row.version,
    size: row.size,
    isFavorite: row.isFavorite,
  };
}

/** Lists the user's recent projects, newest first. */
export async function listRecentProjects(
  userId: string,
  options: { kind?: SocialProjectKind; limit?: number; favoritesOnly?: boolean } = {}
): Promise<SocialProjectSummary[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(socialProjects.userId, userId)];
  if (options.kind) conditions.push(eq(socialProjects.kind, options.kind));
  if (options.favoritesOnly) conditions.push(eq(socialProjects.isFavorite, true));

  const rows = await db
    .select()
    .from(socialProjects)
    .where(and(...conditions))
    .orderBy(desc(socialProjects.updatedAt))
    .limit(limit);

  return rows.map(toSummary);
}

/**
 * Upserts a single project row. The browser pushes here after every
 * successful save or autosave; failures are best-effort.
 */
export async function recordRecentProject(
  userId: string,
  project: Pick<SocialProject, "meta">
): Promise<void> {
  const meta = project.meta;
  if (!meta.id || !meta.kind) return;

  try {
    await db
      .insert(socialProjects)
      .values({
        id: meta.id,
        userId,
        kind: meta.kind,
        title: meta.title,
        category: meta.category,
        version: meta.version,
        size: meta.size,
        isFavorite: meta.isFavorite,
        updatedAt: new Date(meta.updatedAt),
        createdAt: new Date(meta.createdAt),
      })
      .onConflictDoUpdate({
        target: socialProjects.id,
        set: {
          kind: meta.kind,
          title: meta.title,
          category: meta.category,
          version: meta.version,
          size: meta.size,
          isFavorite: meta.isFavorite,
          updatedAt: new Date(meta.updatedAt),
        },
      });
  } catch {
    // The local IndexedDB copy is the source of truth; a server-mirror
    // failure never surfaces to the user.
  }
  await pruneRecentProjects(userId);
}

/** Soft-deletes a project from the recent index. */
export async function deleteRecentProject(userId: string, id: string): Promise<void> {
  try {
    await db
      .delete(socialProjects)
      .where(and(eq(socialProjects.id, id), eq(socialProjects.userId, userId)));
  } catch {
    // The local copy is already gone; the index can be slightly stale.
  }
}

/** Keeps the recent index at the configured size. */
async function pruneRecentProjects(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: socialProjects.id })
      .from(socialProjects)
      .where(eq(socialProjects.userId, userId))
      .orderBy(desc(socialProjects.updatedAt));

    if (rows.length <= RECENT_LIMIT_PER_USER) return;
    const overflow = rows.slice(RECENT_LIMIT_PER_USER);
    if (overflow.length === 0) return;
    await db
      .delete(socialProjects)
      .where(
        and(
          eq(socialProjects.userId, userId),
          inArray(
            socialProjects.id,
            overflow.map((row) => row.id)
          )
        )
      );
  } catch {
    // Pruning is best-effort.
  }
}

/* -------------------------------------------------------------------------- */
/* Media assets                                                               */
/* -------------------------------------------------------------------------- */

import { socialMediaAssets } from "@/db/schema";
import type { SocialMediaAsset, SocialMediaAssetSummary } from "./types";

const ASSET_RECENT_LIMIT = 500;

function toAssetSummary(row: {
  id: string;
  kind: string;
  title: string;
  filename: string;
  mimeType: string | null;
  size: number;
  projectId: string | null;
  tags: unknown;
  updatedAt: Date;
  createdAt: Date;
}): SocialMediaAssetSummary {
  return {
    id: row.id,
    kind: row.kind as SocialMediaAsset["kind"],
    title: row.title,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    projectId: row.projectId,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Lists the user's media assets, newest first. */
export async function listRecentMedia(
  userId: string,
  options: { projectId?: string | null; kind?: SocialMediaAsset["kind"]; limit?: number } = {}
): Promise<SocialMediaAssetSummary[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(socialMediaAssets.userId, userId)];
  if (options.kind) conditions.push(eq(socialMediaAssets.kind, options.kind));
  if (options.projectId !== undefined) {
    if (options.projectId === null) {
      conditions.push(eq(socialMediaAssets.projectId, ""));
    } else {
      conditions.push(eq(socialMediaAssets.projectId, options.projectId));
    }
  }

  const rows = await db
    .select()
    .from(socialMediaAssets)
    .where(and(...conditions))
    .orderBy(desc(socialMediaAssets.updatedAt))
    .limit(limit);

  return rows.map(toAssetSummary);
}

/** Upserts a single media-asset row. */
export async function recordRecentMedia(
  userId: string,
  asset: SocialMediaAsset
): Promise<void> {
  if (!asset.id) return;

  try {
    await db
      .insert(socialMediaAssets)
      .values({
        id: asset.id,
        userId,
        projectId: asset.projectId,
        kind: asset.kind,
        title: asset.title,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        tags: asset.tags,
        updatedAt: new Date(asset.updatedAt),
        createdAt: new Date(asset.createdAt),
      })
      .onConflictDoUpdate({
        target: socialMediaAssets.id,
        set: {
          projectId: asset.projectId,
          kind: asset.kind,
          title: asset.title,
          filename: asset.filename,
          mimeType: asset.mimeType,
          size: asset.size,
          tags: asset.tags,
          updatedAt: new Date(asset.updatedAt),
        },
      });
  } catch {
    // Best-effort: the local IndexedDB copy is the source of truth.
  }
  await pruneRecentMedia(userId);
}

/** Soft-deletes a media asset from the index. */
export async function deleteRecentMedia(userId: string, id: string): Promise<void> {
  try {
    await db
      .delete(socialMediaAssets)
      .where(and(eq(socialMediaAssets.id, id), eq(socialMediaAssets.userId, userId)));
  } catch {
    // The local copy is already gone; the index can be slightly stale.
  }
}

async function pruneRecentMedia(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: socialMediaAssets.id })
      .from(socialMediaAssets)
      .where(eq(socialMediaAssets.userId, userId))
      .orderBy(desc(socialMediaAssets.updatedAt));
    if (rows.length <= ASSET_RECENT_LIMIT) return;
    const overflow = rows.slice(ASSET_RECENT_LIMIT);
    if (overflow.length === 0) return;
    await db
      .delete(socialMediaAssets)
      .where(
        and(
          eq(socialMediaAssets.userId, userId),
          inArray(
            socialMediaAssets.id,
            overflow.map((row) => row.id)
          )
        )
      );
  } catch {
    // Best-effort.
  }
}
