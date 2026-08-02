/**
 * WebPilot server-side history helpers.
 *
 * History entries live in the browser (IndexedDB) so they are always
 * available offline and the server never has to stream them. This
 * table is a small per-user, per-tool index the dashboard, the file
 * manager and the search endpoint use to know what the user has been
 * working on and which entries are favourites.
 *
 * Mirrors the DevPilot `history.ts` shape.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { webHistory } from "@/db/schema";

/** Maximum number of rows kept per user. Older rows are pruned. */
const HISTORY_LIMIT_PER_USER = 500;

export interface WebHistoryRow {
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
}): WebHistoryRow {
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
): Promise<WebHistoryRow[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(webHistory.userId, userId)];
  if (options.toolName) conditions.push(eq(webHistory.toolName, options.toolName));
  if (options.favoritesOnly) conditions.push(eq(webHistory.isFavorite, true));

  const rows = await db
    .select()
    .from(webHistory)
    .where(and(...conditions))
    .orderBy(desc(webHistory.updatedAt))
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
      .insert(webHistory)
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
        target: webHistory.id,
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
      .delete(webHistory)
      .where(and(eq(webHistory.id, id), eq(webHistory.userId, userId)));
  } catch {
    // The local copy is already gone; the index can be slightly stale.
  }
}

/** Keeps the history index at the configured size. */
async function pruneHistory(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: webHistory.id })
      .from(webHistory)
      .where(eq(webHistory.userId, userId))
      .orderBy(desc(webHistory.updatedAt));
    if (rows.length <= HISTORY_LIMIT_PER_USER) return;
    const overflow = rows.slice(HISTORY_LIMIT_PER_USER);
    if (overflow.length === 0) return;
    await db
      .delete(webHistory)
      .where(
        and(
          eq(webHistory.userId, userId),
          inArray(
            webHistory.id,
            overflow.map((row) => row.id)
          )
        )
      );
  } catch {
    // Pruning is best-effort.
  }
}
