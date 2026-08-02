/**
 * Developer history endpoint for DevPilot.
 *
 * History rows are stored in the browser (IndexedDB) so they are
 * always available offline; this route is the small per-user,
 * per-tool index the dashboard, file manager and search use to
 * surface recent and favourite entries without round-tripping the
 * local store.
 *
 * Mirrors the SocialPilot /api/socialpilot/brand-profiles/route.ts
 * shape.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  deleteHistoryRow,
  listRecentHistory,
  recordHistory,
} from "@/lib/devpilot/history";

export const dynamic = "force-dynamic";

/** Reads the user's history rows. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const toolName = request.nextUrl.searchParams.get("toolName") ?? undefined;
  const favoritesOnly = request.nextUrl.searchParams.get("favorites") === "1";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 50, 200) : 50;

  const history = await listRecentHistory(user.id, {
    toolName: toolName ?? undefined,
    favoritesOnly,
    limit,
  });
  return Response.json({ history });
}

const entrySchema = z.object({
  id: z.string().trim().min(1).max(80),
  toolName: z.string().trim().min(1).max(100),
  kind: z.string().trim().min(1).max(20).optional().default("tool"),
  isFavorite: z.boolean().optional().default(false),
  updatedAt: z.string().trim().min(1).max(40),
});

const putSchema = z.object({
  entries: z.array(entrySchema).max(200),
});

/** Upserts the user's history rows. */
export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`dev-history:${user.id}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  for (const entry of parsed.data.entries) {
    await recordHistory(user.id, {
      id: entry.id,
      toolName: entry.toolName,
      kind: entry.kind ?? "tool",
      isFavorite: entry.isFavorite ?? false,
      updatedAt: entry.updatedAt,
    });
  }

  return Response.json({ ok: true });
}

/** Soft-deletes a single history row. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id || id.length > 80) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  await deleteHistoryRow(user.id, id);
  return Response.json({ ok: true });
}
