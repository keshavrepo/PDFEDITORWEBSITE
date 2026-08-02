/**
 * User-state endpoint for SocialPilot.
 *
 * One row per user, holding the small UI state the workspace
 * needs across sessions: the active brand id and the active
 * platform profile id.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import { getUserState, saveUserState } from "@/lib/socialpilot/server-state";

export const dynamic = "force-dynamic";

/** Reads the user's workspace state. */
export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getUserState(user.id);
  return Response.json({ state });
}

const putSchema = z.object({
  activeBrandId: z.string().trim().max(40).optional().default(""),
  activeProfileId: z.string().trim().max(40).optional().default(""),
});

/** Upserts the user's workspace state. */
export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`social-user-state:${user.id}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const saved = await saveUserState(user.id, {
    activeBrandId: parsed.data.activeBrandId,
    activeProfileId: parsed.data.activeProfileId,
  });
  return Response.json({ state: saved });
}
