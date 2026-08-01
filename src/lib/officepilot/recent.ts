/**
 * OfficePilot server-side recent-documents index.
 *
 * The IndexedDB-backed client storage is the source of truth for document
 * bodies; this table is just the small index the dashboard, file manager
 * and search use to know what the user has been working on.
 *
 * All writes are best-effort: a failed update never propagates back to the
 * editor. Reads honour `limit` and an optional `kind` filter so the API can
 * serve a small recent list without pagination.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { officeDocuments } from "@/db/schema";
import type {
  OfficeDocument,
  OfficeDocumentSummary,
  OfficeEditorKind,
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
  updatedAt: Date;
}): OfficeDocumentSummary {
  return {
    id: row.id,
    kind: row.kind as OfficeDocumentSummary["kind"],
    title: row.title,
    category: row.category as OfficeDocumentSummary["category"],
    updatedAt: row.updatedAt.toISOString(),
    autosavedAt: row.updatedAt.toISOString(),
    version: row.version,
    size: row.size,
  };
}

/** Lists the user's recent documents, newest first. */
export async function listRecentDocuments(
  userId: string,
  options: { kind?: OfficeEditorKind; limit?: number } = {}
): Promise<OfficeDocumentSummary[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(officeDocuments.userId, userId)];
  if (options.kind) conditions.push(eq(officeDocuments.kind, options.kind));

  const rows = await db
    .select()
    .from(officeDocuments)
    .where(and(...conditions))
    .orderBy(desc(officeDocuments.updatedAt))
    .limit(limit);

  return rows.map(toSummary);
}

/**
 * Upserts a single document row. The browser pushes here after every
 * successful save or autosave; failures are best-effort.
 */
export async function recordRecentDocument(
  userId: string,
  document: Pick<
    OfficeDocument,
    "meta"
  > & { body?: unknown }
): Promise<void> {
  const meta = document.meta;
  if (!meta.id || !meta.kind) return;

  try {
    await db
      .insert(officeDocuments)
      .values({
        id: meta.id,
        userId,
        kind: meta.kind,
        title: meta.title,
        category: meta.category,
        version: meta.version,
        size: meta.size,
        updatedAt: new Date(meta.updatedAt),
        createdAt: new Date(meta.createdAt),
      })
      .onConflictDoUpdate({
        target: officeDocuments.id,
        set: {
          kind: meta.kind,
          title: meta.title,
          category: meta.category,
          version: meta.version,
          size: meta.size,
          updatedAt: new Date(meta.updatedAt),
        },
      });
  } catch {
    // The local IndexedDB copy is the source of truth; a server-mirror
    // failure never surfaces to the user.
  }
  await pruneRecentDocuments(userId);
}

/** Soft-deletes a document from the recent index. */
export async function deleteRecentDocument(
  userId: string,
  id: string
): Promise<void> {
  try {
    await db
      .delete(officeDocuments)
      .where(and(eq(officeDocuments.id, id), eq(officeDocuments.userId, userId)));
  } catch {
    // The local copy is already gone; the index can be slightly stale.
  }
}

/** Keeps the recent index at the configured size. */
async function pruneRecentDocuments(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: officeDocuments.id })
      .from(officeDocuments)
      .where(eq(officeDocuments.userId, userId))
      .orderBy(desc(officeDocuments.updatedAt));

    if (rows.length <= RECENT_LIMIT_PER_USER) return;
    const overflow = rows.slice(RECENT_LIMIT_PER_USER);
    for (const row of overflow) {
      await db
        .delete(officeDocuments)
        .where(
          and(eq(officeDocuments.id, row.id), eq(officeDocuments.userId, userId))
        );
    }
  } catch {
    // Pruning is best-effort.
  }
}
