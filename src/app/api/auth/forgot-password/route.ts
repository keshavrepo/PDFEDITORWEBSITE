import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { escapeHtml, sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import {
  checkRateLimit,
  getClientIp,
  isSameOrigin,
  rateLimitResponse,
} from "@/lib/request";

const requestSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
});

const genericMessage =
  "If an account exists for that email, a password reset link has been sent.";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const rateLimit = checkRateLimit(
    `forgot-password:${getClientIp(request)}`,
    5,
    15 * 60_000
  );
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  try {
    assertDatabaseConfigured();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (!user) return Response.json({ message: genericMessage });

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;

    await db.transaction(async (transaction) => {
      await transaction
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));
      await transaction.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
    });

    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your PDFPilot password",
        html: `
          <p>Hello ${escapeHtml(user.name || "there")},</p>
          <p>We received a request to reset your PDFPilot password.</p>
          <p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>
          <p>This link expires in one hour. If you did not request it, you can ignore this email.</p>
        `,
      });
    } catch (emailError) {
      console.error("Password reset email delivery failed", emailError);
    }

    return Response.json({
      message: genericMessage,
      ...(process.env.NODE_ENV !== "production" ? { devResetUrl: resetUrl } : {}),
    });
  } catch (error) {
    console.error("Password reset request failed", error);
    // Keep the response indistinguishable so this endpoint cannot enumerate users.
    return Response.json({ message: genericMessage });
  }
}
