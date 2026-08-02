/**
 * Media-collections endpoint for SocialPilot.
 *
 * One row per user, holding the list of media-asset collections
 * used by the Media Workspace.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  getMediaCollections,
  saveMediaCollections,
} from "@/lib/socialpilot/server-state";

export const dynamic = "force-dynamic";

/** Reads the user's media collections. */
export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const collections = await getMediaCollections(user.id);
  return Response.json({ collections });
}

const collectionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(255).optional().default(""),
  assetIds: z.array(z.string().trim().min(1).max(80)).max(500).optional().default([]),
});

const putSchema = z.object({
  collections: z.array(collectionSchema).max(50),
});

/** Upserts the user's media collections. */
export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`social-media-collections:${user.id}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const collections = parsed.data.collections.map((collection) => ({
    ...collection,
    createdAt: now,
    updatedAt: now,
  }));

  const saved = await saveMediaCollections(user.id, collections);
  return Response.json({ collections: saved });
}
