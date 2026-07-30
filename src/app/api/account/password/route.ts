import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  isSameOrigin,
  rateLimitResponse,
} from "@/lib/request";

const passwordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ipAddress = getClientIp(request);
  const rateLimit = checkRateLimit(`password:${user.id}:${ipAddress}`, 5, 15 * 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  try {
    const parsed = passwordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Invalid password" },
        { status: 400 }
      );
    }

    const [databaseUser] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!databaseUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (databaseUser.passwordHash) {
      const currentMatches = parsed.data.currentPassword
        ? await compare(parsed.data.currentPassword, databaseUser.passwordHash)
        : false;
      if (!currentMatches) {
        return Response.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      if (await compare(parsed.data.newPassword, databaseUser.passwordHash)) {
        return Response.json(
          { error: "New password must be different from your current password" },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hash(parsed.data.newPassword, 12);
    await db.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await transaction.insert(auditLogs).values({
        userId: user.id,
        action: databaseUser.passwordHash
          ? "user.password_changed"
          : "user.password_created",
        resourceType: "user",
        resourceId: user.id,
        ipAddress,
        userAgent: request.headers.get("user-agent"),
      });
    });

    return Response.json({ message: "Password updated" });
  } catch (error) {
    console.error("Password update failed", error);
    return Response.json({ error: "Unable to update your password" }, { status: 500 });
  }
}
