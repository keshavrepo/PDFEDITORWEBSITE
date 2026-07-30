import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getClientIp, isSameOrigin } from "@/lib/request";

const avatarSchema = z
  .string()
  .max(1_400_000, "Profile photo must be smaller than 1MB")
  .refine(
    (value) =>
      /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value) ||
      /^https:\/\//.test(value),
    "Unsupported profile photo"
  )
  .nullable();

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  avatar: avatarSchema.optional(),
});

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Invalid profile" },
        { status: 400 }
      );
    }

    const [updatedUser] = await db.transaction(async (transaction) => {
      const updated = await transaction
        .update(users)
        .set({
          name: parsed.data.name,
          ...(parsed.data.avatar !== undefined
            ? { avatar: parsed.data.avatar }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning({ name: users.name, avatar: users.avatar });

      await transaction.insert(auditLogs).values({
        userId: user.id,
        action: "user.profile_updated",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
      return updated;
    });

    return Response.json({ user: updatedUser });
  } catch (error) {
    console.error("Profile update failed", error);
    return Response.json({ error: "Unable to update your profile" }, { status: 500 });
  }
}
