/**
 * Platform-profiles endpoint for SocialPilot.
 *
 * One row per user, holding the list of social profiles the user
 * manages. The future scheduler will reuse this list to know which
 * profile to publish to.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  getPlatformProfiles,
  savePlatformProfiles,
} from "@/lib/socialpilot/server-state";

export const dynamic = "force-dynamic";

/** Reads the user's platform profiles. */
export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const profiles = await getPlatformProfiles(user.id);
  return Response.json({ profiles });
}

const platformKeys = [
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "threads",
  "pinterest",
] as const;

const profileSchema = z.object({
  id: z.string().trim().min(1).max(40),
  platform: z.enum(platformKeys),
  name: z.string().trim().min(1).max(80),
  handle: z.string().trim().max(60).optional().default(""),
  url: z.string().trim().max(255).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

const putSchema = z.object({
  profiles: z.array(profileSchema).max(200),
});

/** Upserts the user's platform profiles. */
export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`social-platform-profiles:${user.id}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const profiles = parsed.data.profiles.map((profile) => ({
    id: profile.id,
    platform: profile.platform,
    name: profile.name,
    handle: profile.handle,
    url: profile.url,
    notes: profile.notes,
    isDefault: profile.isDefault,
  }));

  const saved = await savePlatformProfiles(user.id, profiles);
  return Response.json({ profiles: saved });
}
