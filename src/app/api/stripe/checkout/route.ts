import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { isSameOrigin } from "@/lib/request";
import { getStripe } from "@/lib/stripe";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Select a valid plan" }, { status: 400 });
    }

    const priceId =
      parsed.data.plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_BUSINESS_PRICE_ID;
    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      return Response.json(
        { error: "Billing is not configured for this plan" },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    if (
      existingSubscription?.stripeSubscriptionId &&
      ["active", "trialing", "past_due"].includes(existingSubscription.status)
    ) {
      return Response.json(
        { error: "Manage your existing subscription from Settings" },
        { status: 409 }
      );
    }

    let customerId = existingSubscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await db
        .insert(subscriptions)
        .values({
          userId: user.id,
          stripeCustomerId: customerId,
          status: "incomplete",
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: { stripeCustomerId: customerId, updatedAt: new Date() },
        });
    }

    const appUrl = getAppUrl();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_collection: "if_required",
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/pricing?billing=canceled`,
      metadata: { userId: user.id, plan: parsed.data.plan },
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: { userId: user.id, plan: parsed.data.plan },
      },
    });

    if (!checkout.url) throw new Error("Stripe did not return a checkout URL");
    return Response.json({ url: checkout.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", error);
    return Response.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}
