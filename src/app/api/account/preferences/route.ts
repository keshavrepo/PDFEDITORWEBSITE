import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getClientIp, isSameOrigin } from "@/lib/request";
import {
  defaultPreferences,
  parsePreferences,
  type UserPreferences,
} from "@/lib/platform/preferences";

export const dynamic = "force-dynamic";

const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z
    .object({
      conversions: z.boolean().optional(),
      uploads: z.boolean().optional(),
      subscription: z.boolean().optional(),
      account: z.boolean().optional(),
      productUpdates: z.boolean().optional(),
    })
    .optional(),
});

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return Response.json({ preferences: parsePreferences(row?.preferences) });
}

/** Merges the submitted values over the stored preferences. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = preferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid preferences" },
      { status: 400 }
    );
  }

  try {
    const [existing] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const current = parsePreferences(existing?.preferences);
    // Merge rather than replace so a partial update cannot silently reset
    // preferences the form did not submit.
    const next: UserPreferences = {
      theme: parsed.data.theme ?? current.theme,
      notifications: {
        ...defaultPreferences.notifications,
        ...current.notifications,
        ...(parsed.data.notifications ?? {}),
      },
    };

    await db.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ preferences: next, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      await transaction.insert(auditLogs).values({
        userId: user.id,
        action: "user.preferences_updated",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
    });

    return Response.json({ preferences: next });
  } catch (error) {
    console.error("Preferences update failed", error);
    return Response.json(
      { error: "Unable to save your preferences" },
      { status: 500 }
    );
  }
}
