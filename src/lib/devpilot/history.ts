/**
 * DevPilot server-side history helpers.
 *
 * History entries live in the browser (IndexedDB) so they are always
 * available offline and the server never has to stream them. This
 * table is a small per-user, per-tool index the dashboard, the file
 * manager and the search endpoint use to know what the user has been
 * working on and which entries are favourites.
 *
 * Mirrors the SocialPilot `server-state.ts` shape.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { devHistory } from "@/db/schema";

/** Maximum number of rows kept per user. Older rows are pruned. */
const HISTORY_LIMIT_PER_USER = 500;

export interface DevHistoryRow {
  id: string;
  userId: string;
  toolName: string;
  kind: string;
  isFavorite: boolean;
  updatedAt: string;
  createdAt: string;
}

function toRow(record: {
  id: string;
  userId: string;
  toolName: string;
  kind: string;
  isFavorite: boolean;
  updatedAt: Date;
  createdAt: Date;
}): DevHistoryRow {
  return {
    id: record.id,
    userId: record.userId,
    toolName: record.toolName,
    kind: record.kind,
    isFavorite: record.isFavorite,
    updatedAt: record.updatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

/** Lists the user's history rows, newest first. */
export async function listRecentHistory(
  userId: string,
  options: { toolName?: string; limit?: number; favoritesOnly?: boolean } = {}
): Promise<DevHistoryRow[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(devHistory.userId, userId)];
  if (options.toolName) conditions.push(eq(devHistory.toolName, options.toolName));
  if (options.favoritesOnly) conditions.push(eq(devHistory.isFavorite, true));

  const rows = await db
    .select()
    .from(devHistory)
    .where(and(...conditions))
    .orderBy(desc(devHistory.updatedAt))
    .limit(limit);

  return rows.map(toRow);
}

/** Upserts a single history row. */
export async function recordHistory(
  userId: string,
  entry: {
    id: string;
    toolName: string;
    kind: string;
    isFavorite: boolean;
    updatedAt: string;
  }
): Promise<void> {
  if (!entry.id || !entry.toolName) return;

  try {
    await db
      .insert(devHistory)
      .values({
        id: entry.id,
        userId,
        toolName: entry.toolName,
        kind: entry.kind,
        isFavorite: entry.isFavorite,
        updatedAt: new Date(entry.updatedAt),
        createdAt: new Date(entry.updatedAt),
      })
      .onConflictDoUpdate({
        target: devHistory.id,
        set: {
          toolName: entry.toolName,
          kind: entry.kind,
          isFavorite: entry.isFavorite,
          updatedAt: new Date(entry.updatedAt),
        },
      });
  } catch {
    // The local IndexedDB copy is the source of truth; a server-mirror
    // failure never surfaces to the user.
  }
  await pruneHistory(userId);
}

/** Soft-deletes a history row from the index. */
export async function deleteHistoryRow(userId: string, id: string): Promise<void> {
  try {
    await db
      .delete(devHistory)
      .where(and(eq(devHistory.id, id), eq(devHistory.userId, userId)));
  } catch {
    // The local copy is already gone; the index can be slightly stale.
  }
}

/** Keeps the history index at the configured size. */
async function pruneHistory(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: devHistory.id })
      .from(devHistory)
      .where(eq(devHistory.userId, userId))
      .orderBy(desc(devHistory.updatedAt));
    if (rows.length <= HISTORY_LIMIT_PER_USER) return;
    const overflow = rows.slice(HISTORY_LIMIT_PER_USER);
    if (overflow.length === 0) return;
    await db
      .delete(devHistory)
      .where(
        and(
          eq(devHistory.userId, userId),
          inArray(
            devHistory.id,
            overflow.map((row) => row.id)
          )
        )
      );
  } catch {
    // Pruning is best-effort.
  }
}
