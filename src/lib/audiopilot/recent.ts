/**
 * AudioPilot server-side recent-sessions index.
 *
 * The IndexedDB-backed client storage is the source of truth for
 * session bodies; this table is just the small index the
 * dashboard, file manager and search use to know what the user
 * has been working on.
 *
 * All writes are best-effort: a failed update never propagates
 * back to the editor. Reads honour `limit` and an optional `kind`
 * filter so the API can serve a small recent list without
 * pagination.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * `recent.ts` shape.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audioSessions } from "@/db/schema";
import type {
  AudioSession,
  AudioSessionKind,
  AudioSessionSummary,
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
}): AudioSessionSummary {
  return {
    id: row.id,
    kind: row.kind as AudioSessionKind,
    title: row.title,
    category: row.category as AudioSessionSummary["category"],
    updatedAt: row.updatedAt.toISOString(),
    autosavedAt: null,
    version: row.version,
    size: row.size,
    isFavorite: row.isFavorite,
  };
}

/** Lists the user's recent sessions, newest first. */
export async function listRecentSessions(
  userId: string,
  options: {
    kind?: AudioSessionKind;
    limit?: number;
    favoritesOnly?: boolean;
  } = {}
): Promise<AudioSessionSummary[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(audioSessions.userId, userId)];
  if (options.kind) conditions.push(eq(audioSessions.kind, options.kind));
  if (options.favoritesOnly)
    conditions.push(eq(audioSessions.isFavorite, true));

  const rows = await db
    .select()
    .from(audioSessions)
    .where(and(...conditions))
    .orderBy(desc(audioSessions.updatedAt))
    .limit(limit);

  return rows.map(toSummary);
}

/** Upserts a single session row. */
export async function recordRecentSession(
  userId: string,
  session: Pick<AudioSession, "meta">
): Promise<void> {
  const meta = session.meta;
  if (!meta.id || !meta.kind) return;

  try {
    await db
      .insert(audioSessions)
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
        target: audioSessions.id,
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

    await pruneOldRows(userId);
  } catch {
    // Best-effort: the local store is the source of truth.
  }
}

/** Deletes a single row from the recent index. */
export async function deleteRecentSession(
  userId: string,
  id: string
): Promise<void> {
  try {
    await db
      .delete(audioSessions)
      .where(and(eq(audioSessions.userId, userId), eq(audioSessions.id, id)));
  } catch {
    // Best-effort.
  }
}

/** Trims the table to the most recent N rows per user. */
async function pruneOldRows(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: audioSessions.id, updatedAt: audioSessions.updatedAt })
      .from(audioSessions)
      .where(eq(audioSessions.userId, userId))
      .orderBy(desc(audioSessions.updatedAt))
      .limit(RECENT_LIMIT_PER_USER + 50);
    const overflow = rows.slice(RECENT_LIMIT_PER_USER);
    if (overflow.length === 0) return;
    for (const row of overflow) {
      await db
        .delete(audioSessions)
        .where(and(eq(audioSessions.userId, userId), eq(audioSessions.id, row.id)));
    }
  } catch {
    // Best-effort.
  }
}
