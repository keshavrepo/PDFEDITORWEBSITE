import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, subscriptions, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { getStripe } from "@/lib/stripe";

const deletionSchema = z.object({
  confirmation: z.literal("DELETE"),
});

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = deletionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Type DELETE to confirm account deletion" },
        { status: 400 }
      );
    }

    const [subscription] = await db
      .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    if (subscription?.stripeSubscriptionId) {
      try {
        await getStripe().subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (stripeError) {
        console.error("Subscription cancellation during deletion failed", stripeError);
        return Response.json(
          {
            error:
              "We could not cancel your subscription. Please try again before deleting your account.",
          },
          { status: 502 }
        );
      }
    }

    await db.transaction(async (transaction) => {
      await transaction.delete(users).where(eq(users.id, user.id));
      await transaction.insert(auditLogs).values({
        action: "user.deleted",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
    });

    return Response.json({ message: "Account deleted" });
  } catch (error) {
    console.error("Account deletion failed", error);
    return Response.json({ error: "Unable to delete your account" }, { status: 500 });
  }
}
