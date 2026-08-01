/**
 * FinancePilot server-side recent-calculations index.
 *
 * The IndexedDB-backed client storage is the source of truth for
 * calculation bodies; this table is just the small index the dashboard,
 * file manager and search use to know what the user has been working on.
 *
 * All writes are best-effort: a failed update never propagates back to
 * the editor. Reads honour `limit` and an optional `kind` filter so the
 * API can serve a small recent list without pagination.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { financeCalculations } from "@/db/schema";
import type {
  FinanceCalculation,
  FinanceCalculationSummary,
  FinanceCalculatorKind,
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
}): FinanceCalculationSummary {
  return {
    id: row.id,
    kind: row.kind as FinanceCalculatorKind,
    title: row.title,
    category: row.category as FinanceCalculationSummary["category"],
    updatedAt: row.updatedAt.toISOString(),
    // The server mirror only tracks `updatedAt`; the dedicated
    // `autosavedAt` column does not exist on this table, so we report
    // `null` here instead of pretending the modified-time is also an
    // autosave timestamp.
    autosavedAt: null,
    version: row.version,
    size: row.size,
  };
}

/** Lists the user's recent calculations, newest first. */
export async function listRecentCalculations(
  userId: string,
  options: { kind?: FinanceCalculatorKind; limit?: number } = {}
): Promise<FinanceCalculationSummary[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const conditions = [eq(financeCalculations.userId, userId)];
  if (options.kind) conditions.push(eq(financeCalculations.kind, options.kind));

  const rows = await db
    .select()
    .from(financeCalculations)
    .where(and(...conditions))
    .orderBy(desc(financeCalculations.updatedAt))
    .limit(limit);

  return rows.map(toSummary);
}

/**
 * Upserts a single calculation row. The browser pushes here after every
 * successful save or autosave; failures are best-effort.
 */
export async function recordRecentCalculation(
  userId: string,
  calculation: Pick<FinanceCalculation, "meta"> & { body?: unknown }
): Promise<void> {
  const meta = calculation.meta;
  if (!meta.id || !meta.kind) return;

  try {
    await db
      .insert(financeCalculations)
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
        target: financeCalculations.id,
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
  await pruneRecentCalculations(userId);
}

/** Soft-deletes a calculation from the recent index. */
export async function deleteRecentCalculation(
  userId: string,
  id: string
): Promise<void> {
  try {
    await db
      .delete(financeCalculations)
      .where(
        and(
          eq(financeCalculations.id, id),
          eq(financeCalculations.userId, userId)
        )
      );
  } catch {
    // The local copy is already gone; the index can be slightly stale.
  }
}

/** Keeps the recent index at the configured size. */
async function pruneRecentCalculations(userId: string): Promise<void> {
  try {
    const rows = await db
      .select({ id: financeCalculations.id })
      .from(financeCalculations)
      .where(eq(financeCalculations.userId, userId))
      .orderBy(desc(financeCalculations.updatedAt));

    if (rows.length <= RECENT_LIMIT_PER_USER) return;
    const overflow = rows.slice(RECENT_LIMIT_PER_USER);
    if (overflow.length === 0) return;
    await db
      .delete(financeCalculations)
      .where(
        and(
          eq(financeCalculations.userId, userId),
          inArray(
            financeCalculations.id,
            overflow.map((row) => row.id)
          )
        )
      );
  } catch {
    // Pruning is best-effort.
  }
}
