/**
 * Recent-media index for SocialPilot.
 *
 * The browser is the source of truth for the full asset body; this
 * route is only the small server-side mirror used by the dashboard
 * and the file manager.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  listRecentMedia,
  recordRecentMedia,
} from "@/lib/socialpilot/recent";

export const dynamic = "force-dynamic";

/** Lists the user's recent SocialPilot media assets. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const kind = request.nextUrl.searchParams.get("kind") ?? undefined;
  const projectId = request.nextUrl.searchParams.get("projectId");
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 50, 200) : 50;

  const media = await listRecentMedia(user.id, {
    kind: kind as never,
    projectId: projectId === null ? null : projectId ?? undefined,
    limit,
  });
  return Response.json({ media });
}

const recordSchema = z.object({
  id: z.string().trim().min(1).max(80),
  projectId: z.string().trim().max(80).nullable().optional(),
  kind: z.enum(["image", "video", "audio"]),
  title: z.string().trim().min(1).max(200),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(100).nullable().optional(),
  size: z.number().int().nonnegative().max(64 * 1024 * 1024),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  updatedAt: z.string().trim().min(1).max(40),
  createdAt: z.string().trim().min(1).max(40),
});

/** Upserts a recent-media row. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`social-media-recents:${user.id}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = recordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  await recordRecentMedia(user.id, {
    id: data.id,
    projectId: data.projectId ?? null,
    kind: data.kind,
    title: data.title,
    filename: data.filename,
    mimeType: data.mimeType ?? null,
    size: data.size,
    objectUrl: null,
    tags: data.tags ?? [],
    updatedAt: data.updatedAt,
    createdAt: data.createdAt,
  });

  return Response.json({ ok: true });
}
