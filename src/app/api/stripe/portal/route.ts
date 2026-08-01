import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { isSameOrigin } from "@/lib/request";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [subscription] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    if (!subscription?.stripeCustomerId) {
      return Response.json(
        { error: "No billing account was found" },
        { status: 404 }
      );
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getAppUrl()}/settings`,
    });
    return Response.json({ url: portal.url });
  } catch (error) {
    console.error("Stripe portal creation failed", error);
    return Response.json({ error: "Unable to open billing settings" }, { status: 500 });
  }
}
