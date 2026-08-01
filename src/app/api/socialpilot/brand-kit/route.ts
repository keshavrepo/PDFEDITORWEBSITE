/**
 * Brand-kit endpoint for SocialPilot.
 *
 * One brand kit per user. The browser keeps an in-memory copy and
 * mirrors changes back to the server through this endpoint.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  getBrandKit,
  saveBrandKit,
  defaultBrandKit,
} from "@/lib/socialpilot/brand-kit";
import type { SocialBrandKit } from "@/lib/socialpilot";

export const dynamic = "force-dynamic";

/** Reads the user's brand kit, returning the default when none exists. */
export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const kit = await getBrandKit(user.id);
  return Response.json({ kit: kit ?? defaultBrandKit });
}

const brandKitSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  logos: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(80),
        dataUrl: z.string().trim().min(1).max(2_000_000),
      })
    )
    .max(20)
    .optional(),
  colors: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(40),
        value: z
          .string()
          .trim()
          .min(1)
          .max(20)
          .regex(/^#?[0-9a-fA-F]{3,8}$|^rgb\(/),
      })
    )
    .max(50)
    .optional(),
  fonts: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(40),
        family: z.string().trim().min(1).max(80),
        weight: z.number().int().min(100).max(1000),
      })
    )
    .max(20)
    .optional(),
  profiles: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        platform: z.string().trim().min(1).max(40),
        handle: z.string().trim().min(1).max(60),
        url: z.string().trim().min(1).max(255),
      })
    )
    .max(20)
    .optional(),
});

/** Upserts the user's brand kit. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`social-brand-kit:${user.id}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = brandKitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const next: SocialBrandKit = {
    id: "default",
    name: parsed.data.name ?? defaultBrandKit.name,
    logos: parsed.data.logos ?? [],
    colors: parsed.data.colors ?? [],
    fonts: parsed.data.fonts ?? [],
    profiles: parsed.data.profiles ?? [],
  };

  const saved = await saveBrandKit(user.id, next);
  return Response.json({ kit: saved });
}
