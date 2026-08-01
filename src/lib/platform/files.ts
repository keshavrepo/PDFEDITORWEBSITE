/**
 * Unified file manager.
 *
 * One implementation shared by every LaunchStack product. Files carry a
 * `productId`, so a new module writes to the same table and appears in the
 * same manager without a second implementation.
 */

import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, files } from "@/db/schema";
import { getProduct } from "@/lib/products";

export interface ManagedFile {
  id: string;
  productId: string;
  productName: string;
  originalName: string;
  size: number;
  mimeType: string | null;
  status: string;
  downloadCount: number;
  isFavorite: boolean;
  createdAt: Date;
}

export interface FileQuery {
  /** Free-text match against the file name. */
  search?: string;
  /** Restrict to one product. */
  productId?: string;
  /** Only favourites. */
  favoritesOnly?: boolean;
  limit?: number;
}

export interface StorageSummary {
  /** Total bytes across all non-deleted files. */
  usedBytes: number;
  fileCount: number;
  favoriteCount: number;
  /** Bytes grouped by product, for the dashboard breakdown. */
  byProduct: Array<{ productId: string; productName: string; bytes: number; count: number }>;
}

function productName(productId: string): string {
  if (productId === "launchstack") return "LaunchStack";
  return getProduct(productId)?.name ?? productId;
}

/** Lists a user's files, newest first, honouring search and filters. */
export async function listFiles(
  userId: string,
  query: FileQuery = {}
): Promise<ManagedFile[]> {
  const conditions = [eq(files.userId, userId), isNull(files.deletedAt)];

  if (query.search?.trim()) {
    conditions.push(ilike(files.originalName, `%${query.search.trim()}%`));
  }
  if (query.productId) {
    conditions.push(eq(files.productId, query.productId));
  }
  if (query.favoritesOnly) {
    conditions.push(eq(files.isFavorite, true));
  }

  const rows = await db
    .select({
      id: files.id,
      productId: files.productId,
      originalName: files.originalName,
      size: files.size,
      mimeType: files.mimeType,
      status: files.status,
      downloadCount: files.downloadCount,
      isFavorite: files.isFavorite,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .limit(Math.min(query.limit ?? 100, 200));

  return rows.map((row) => ({ ...row, productName: productName(row.productId) }));
}

/** Aggregates storage for the dashboard, grouped by product. */
export async function getStorageSummary(userId: string): Promise<StorageSummary> {
  const rows = await db
    .select({
      productId: files.productId,
      bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
      favorites: sql<number>`count(*) filter (where ${files.isFavorite})::int`,
    })
    .from(files)
    .where(and(eq(files.userId, userId), isNull(files.deletedAt)))
    .groupBy(files.productId);

  let usedBytes = 0;
  let fileCount = 0;
  let favoriteCount = 0;
  const byProduct: StorageSummary["byProduct"] = [];

  for (const row of rows) {
    // `sum` comes back as a string for bigint columns.
    const bytes = Number(row.bytes) || 0;
    usedBytes += bytes;
    fileCount += row.count;
    favoriteCount += row.favorites;
    byProduct.push({
      productId: row.productId,
      productName: productName(row.productId),
      bytes,
      count: row.count,
    });
  }

  byProduct.sort((a, b) => b.bytes - a.bytes);
  return { usedBytes, fileCount, favoriteCount, byProduct };
}

/** Renames a file, verifying ownership first. */
export async function renameFile(
  userId: string,
  fileId: string,
  name: string
): Promise<ManagedFile | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const [updated] = await db
    .update(files)
    .set({ originalName: trimmed.slice(0, 255), updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.userId, userId), isNull(files.deletedAt)))
    .returning();

  if (!updated) return null;
  await db.insert(auditLogs).values({
    userId,
    action: "file.renamed",
    resourceType: "file",
    resourceId: fileId,
  });

  return {
    id: updated.id,
    productId: updated.productId,
    productName: productName(updated.productId),
    originalName: updated.originalName,
    size: updated.size,
    mimeType: updated.mimeType,
    status: updated.status,
    downloadCount: updated.downloadCount,
    isFavorite: updated.isFavorite,
    createdAt: updated.createdAt,
  };
}

/** Toggles the favourite flag and returns the new value. */
export async function toggleFileFavorite(
  userId: string,
  fileId: string
): Promise<boolean | null> {
  const [updated] = await db
    .update(files)
    .set({ isFavorite: sql`not ${files.isFavorite}`, updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.userId, userId), isNull(files.deletedAt)))
    .returning({ isFavorite: files.isFavorite });

  return updated?.isFavorite ?? null;
}

/**
 * Soft-deletes a file.
 *
 * The row is retained so processing history that references it stays intact;
 * the manager filters deleted entries out everywhere.
 */
export async function deleteFile(userId: string, fileId: string): Promise<boolean> {
  const [deleted] = await db
    .update(files)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.userId, userId), isNull(files.deletedAt)))
    .returning({ id: files.id });

  if (!deleted) return false;
  await db.insert(auditLogs).values({
    userId,
    action: "file.deleted",
    resourceType: "file",
    resourceId: fileId,
  });
  return true;
}

/** Records a download and bumps the counter. */
export async function recordFileDownload(
  userId: string,
  fileId: string
): Promise<boolean> {
  const [updated] = await db
    .update(files)
    .set({ downloadCount: sql`${files.downloadCount} + 1`, updatedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.userId, userId), isNull(files.deletedAt)))
    .returning({ id: files.id });

  if (!updated) return false;
  await db.insert(auditLogs).values({
    userId,
    action: "file.downloaded",
    resourceType: "file",
    resourceId: fileId,
  });
  return true;
}
