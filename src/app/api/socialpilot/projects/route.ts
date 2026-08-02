/**
 * Recent-projects index for SocialPilot.
 *
 * The browser is the source of truth for the full project body; this
 * route is only the small server-side mirror used by the dashboard,
 * the file manager and the search endpoint to know what the user has
 * been working on.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  listRecentProjects,
  recordRecentProject,
} from "@/lib/socialpilot/recent";

export const dynamic = "force-dynamic";

/** Lists the user's recent SocialPilot projects. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const kind = request.nextUrl.searchParams.get("kind") ?? undefined;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 50, 200) : 50;
  const favoritesOnly = request.nextUrl.searchParams.get("favorites") === "1";

  const projects = await listRecentProjects(user.id, {
    kind: kind ?? undefined,
    limit,
    favoritesOnly,
  });
  return Response.json({ projects });
}

const recordSchema = z.object({
  id: z.string().trim().min(1).max(80),
  kind: z.string().trim().min(1).max(30),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(30),
  version: z.number().int().nonnegative().max(1_000_000),
  size: z.number().int().nonnegative().max(64 * 1024 * 1024),
  isFavorite: z.boolean().optional(),
  updatedAt: z.string().trim().min(1).max(40),
  createdAt: z.string().trim().min(1).max(40).optional(),
});

/** Upserts a recent-project row. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`social-recents:${user.id}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = recordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  await recordRecentProject(user.id, {
    meta: {
      id: data.id,
      kind: data.kind as never,
      title: data.title,
      category: data.category as never,
      createdAt: data.createdAt ?? data.updatedAt,
      updatedAt: data.updatedAt,
      autosavedAt: data.updatedAt,
      version: data.version,
      size: data.size,
      tags: [],
      isFavorite: data.isFavorite ?? false,
    },
  });

  return Response.json({ ok: true });
}
