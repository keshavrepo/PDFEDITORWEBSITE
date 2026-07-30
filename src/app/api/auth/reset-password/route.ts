import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/db";
import { auditLogs, passwordResetTokens, users } from "@/db/schema";
import {
  checkRateLimit,
  getClientIp,
  isSameOrigin,
  rateLimitResponse,
} from "@/lib/request";

const resetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ipAddress = getClientIp(request);
  const rateLimit = checkRateLimit(`reset-password:${ipAddress}`, 10, 15 * 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  try {
    assertDatabaseConfigured();
    const parsed = resetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Invalid reset request" },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(parsed.data.token)
      .digest("hex");
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetToken) {
      return Response.json(
        { error: "This reset link is invalid or has expired" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 12);
    await db.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId));
      await transaction
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.userId, resetToken.userId));
      await transaction.insert(auditLogs).values({
        userId: resetToken.userId,
        action: "user.password_reset",
        resourceType: "user",
        resourceId: resetToken.userId,
        ipAddress,
        userAgent: request.headers.get("user-agent"),
      });
    });

    return Response.json({ message: "Your password has been updated" });
  } catch (error) {
    console.error("Password reset failed", error);
    return Response.json(
      { error: "Unable to reset your password right now" },
      { status: 500 }
    );
  }
}
