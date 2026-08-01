import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import {
  checkRateLimit,
  getClientIp,
  isSameOrigin,
  rateLimitResponse,
} from "@/lib/request";

const registrationSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255)
    .transform((value) => value.toLowerCase()),
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
  const rateLimit = checkRateLimit(`register:${ipAddress}`, 5, 15 * 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  try {
    assertDatabaseConfigured();
    const body = await request.json();
    const parsed = registrationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Invalid account details" },
        { status: 400 }
      );
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (existingUser) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 12);

    const created = await db.transaction(async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
        })
        .returning({ id: users.id, email: users.email });

      await transaction.insert(auditLogs).values({
        userId: user.id,
        action: "user.registered",
        resourceType: "user",
        resourceId: user.id,
        ipAddress,
        userAgent: request.headers.get("user-agent"),
      });

      return user;
    });

    return Response.json({ user: created }, { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === "23505") {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    console.error("Registration failed", error);
    return Response.json(
      { error: "Unable to create your account right now" },
      { status: 500 }
    );
  }
}
