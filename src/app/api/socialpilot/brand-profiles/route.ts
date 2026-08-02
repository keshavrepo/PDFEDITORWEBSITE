/**
 * Brand-profiles endpoint for SocialPilot.
 *
 * One row per user, holding the full list of brands the user
 * manages. The active brand is stored on the user-state row.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  getBrandProfiles,
  saveBrandProfiles,
} from "@/lib/socialpilot/server-state";

export const dynamic = "force-dynamic";

/** Reads the user's brand profiles. */
export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const brands = await getBrandProfiles(user.id);
  return Response.json({ brands });
}

const brandSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().default(""),
  logos: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(80),
        dataUrl: z.string().trim().min(1).max(2_000_000),
      })
    )
    .max(20)
    .optional()
    .default([]),
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
    .optional()
    .default([]),
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
    .optional()
    .default([]),
  watermarks: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(80),
        dataUrl: z.string().trim().min(1).max(2_000_000),
        opacity: z.number().min(0).max(1).optional().default(1),
        placement: z
          .enum([
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "center",
          ])
          .optional()
          .default("bottom-right"),
      })
    )
    .max(20)
    .optional()
    .default([]),
  templates: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(255).optional().default(""),
        body: z.string().trim().max(10_000),
      })
    )
    .max(20)
    .optional()
    .default([]),
  defaultHashtags: z
    .array(z.string().trim().min(1).max(60))
    .max(50)
    .optional()
    .default([]),
  defaultCaptions: z
    .array(z.string().trim().min(1).max(2_000))
    .max(20)
    .optional()
    .default([]),
  defaultProfileId: z.string().trim().max(40).optional().default(""),
});

const putSchema = z.object({
  brands: z.array(brandSchema).max(50),
});

/** Upserts the user's brand profiles. */
export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`social-brand-profiles:${user.id}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  // Preserve each brand's existing createdAt if it already exists on
  // the server; otherwise stamp it now. This avoids overwriting the
  // original creation time on every save.
  const existing = await getBrandProfiles(user.id);
  const existingById = new Map(existing.map((brand) => [brand.id, brand]));
  const brands = parsed.data.brands.map((brand) => {
    const previous = existingById.get(brand.id);
    return {
      ...brand,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
  });

  const saved = await saveBrandProfiles(user.id, brands);
  return Response.json({ brands: saved });
}
