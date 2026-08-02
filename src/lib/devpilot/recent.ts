/**
 * DevPilot server-side recent-sessions index.
 *
 * The IndexedDB-backed client storage is the source of truth for
 * session bodies; this table is just the small index the dashboard,
 * file manager and search use to know what the user has been working
 * on.
 *
 * All writes are best-effort: a failed update never propagates back
 * to the editor. Reads honour `limit` and an optional `kind` filter so
 * the API can serve a small recent list without pagination.
 *
 * Mirrors the SocialPilot / FinancePilot `recent.ts` shape.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { devSessions } from "@/db/schema";
import type {
  DevSession,
  DevSessionKind,
  DevSessionSummary,
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
}): DevSessionSummary {
  return {
    id: row.id,
    kind: row.kind as DevSessionKind,
    title: row.title,
    category: row.category as DevSessionSummary["category"],
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

/** Lists the user's recent sessions, newest first. */
export async function listRecentSessions(
  userId: string,
  options: { kind?: DevSessionKind; limit?: number; favoritesOnly?: boolean } = {}
): Promise<DevSessionSummary[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(devSessions.userId, userId)];
  if (options.kind) conditions.push(eq(devSessions.kind, options.kind));
  if (options.favoritesOnly) conditions.push(eq(devSessions.isFavorite, true));

  const rows = await db
    .select()
    .from(devSessions)
    .where(and(...conditions))
    .orderBy(desc(devSessions.updatedAt))
    .limit(limit);

  return rows.map(toSummary);
}

/**
 * Upserts a single session row. The browser pushes here after every
 * successful save or autosave; failures are best-effort.
 */
export async function recordRecentSession(
  userId: string,
  session: Pick<DevSession, "meta">
): Promise<void> {
  const meta = session.meta;
  if (!meta.id || !meta.kind) return;

  try {
    await db
      .insert(devSessions)
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
        target: devSessions.id,
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
  await pruneRecentSessions(userId);
}

/** Soft-deletes a session from the recent index. */
export async function deleteRecentSession(userId: string, id: string): Promise<void> {
  try {
    await db
      .delete(devSessions)
      .where(and(eq(devSessions.id, id), eq(devSessions.userId, userId)));
  } catch {
    // The local copy is already gone; the index can be slightly stale.
  }
}

/** Keeps the recent index at the configured size. */
async function pruneRecentSessions(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: devSessions.id })
      .from(devSessions)
      .where(eq(devSessions.userId, userId))
      .orderBy(desc(devSessions.updatedAt));

    if (rows.length <= RECENT_LIMIT_PER_USER) return;
    const overflow = rows.slice(RECENT_LIMIT_PER_USER);
    if (overflow.length === 0) return;
    await db
      .delete(devSessions)
      .where(
        and(
          eq(devSessions.userId, userId),
          inArray(
            devSessions.id,
            overflow.map((row) => row.id)
          )
        )
      );
  } catch {
    // Pruning is best-effort.
  }
}
