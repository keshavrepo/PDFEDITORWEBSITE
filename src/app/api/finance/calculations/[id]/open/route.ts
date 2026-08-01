/**
 * Per-calculation recent-calculations lookup.
 *
 * The full calculation body lives in the browser (IndexedDB); the server
 * only keeps the recent-calculations mirror. This endpoint is the bridge:
 * the client requests metadata to confirm a calculation exists and read
 * its title and version, then the editor reads the body from IndexedDB.
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { financeCalculations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { FinanceCalculationSummary } from "@/lib/financepilot";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || id.length > 80) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(financeCalculations)
    .where(
      and(
        eq(financeCalculations.id, id),
        eq(financeCalculations.userId, user.id)
      )
    )
    .limit(1);

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const summary: FinanceCalculationSummary = {
    id: row.id,
    kind: row.kind as FinanceCalculationSummary["kind"],
    title: row.title,
    category: row.category as FinanceCalculationSummary["category"],
    updatedAt: row.updatedAt.toISOString(),
    // The dedicated `autosavedAt` column does not exist on the recent
    // mirror; return null so consumers know the field is unavailable
    // rather than treating `updatedAt` as both.
    autosavedAt: null,
    version: row.version,
    size: row.size,
  };

  return Response.json({ calculation: summary });
}
