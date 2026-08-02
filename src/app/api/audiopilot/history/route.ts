/**
 * Per-tool history index for AudioPilot.
 *
 * The browser holds the full per-tool history in IndexedDB; this
 * route is the small server-side mirror used by the dashboard,
 * the file manager and the search to list the user's recent
 * audio activities.
 *
 * AudioPilot reuses the same /api/webpilot/history table shape
 * with the `audio_history` rows so a reader who knows one product
 * knows them all.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audioHistory } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  checkRateLimit,
  isSameOrigin,
  rateLimitResponse,
} from "@/lib/request";

export const dynamic = "force-dynamic";

/** Returns the user's most recent AudioPilot history entries. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const toolName = request.nextUrl.searchParams.get("tool");
  const favoritesOnly = request.nextUrl.searchParams.get("favorites") === "1";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 20, 100) : 20;

  const conditions = [eq(audioHistory.userId, user.id)];
  if (toolName) conditions.push(eq(audioHistory.toolName, toolName));
  if (favoritesOnly) conditions.push(eq(audioHistory.isFavorite, true));

  const rows = await db
    .select()
    .from(audioHistory)
    .where(and(...conditions))
    .orderBy(desc(audioHistory.updatedAt))
    .limit(limit);

  return Response.json({
    history: rows.map((row) => ({
      id: row.id,
      toolName: row.toolName,
      kind: row.kind,
      isFavorite: row.isFavorite,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

const recordSchema = z.object({
  id: z.string().trim().min(1).max(80),
  toolName: z.string().trim().min(1).max(100),
  kind: z.string().trim().min(1).max(20).optional(),
  isFavorite: z.boolean().optional(),
});

/** Upserts a per-tool history row. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`audio-history:${user.id}`, 240, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = recordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const now = new Date();
  try {
    await db
      .insert(audioHistory)
      .values({
        id: data.id,
        userId: user.id,
        toolName: data.toolName,
        kind: data.kind ?? "tool",
        isFavorite: data.isFavorite ?? false,
        updatedAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: audioHistory.id,
        set: {
          toolName: data.toolName,
          kind: data.kind ?? "tool",
          isFavorite: data.isFavorite ?? false,
          updatedAt: now,
        },
      });
  } catch {
    // Best-effort.
  }

  return Response.json({ ok: true });
}
