import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, subscriptions, users } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function asDate(timestamp?: number | null): Date | null {
  return timestamp ? new Date(timestamp * 1000) : null;
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  let userId = subscription.metadata.userId || fallbackUserId || null;

  if (!userId) {
    const [existing] = await db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);
    userId = existing?.userId || null;
  }
  if (!userId) throw new Error("Stripe subscription is not linked to a user");

  const item = subscription.items.data[0];
  const priceId = item?.price.id || null;
  const configuredPlan =
    priceId === process.env.STRIPE_BUSINESS_PRICE_ID ? "business" : "pro";
  const plan = subscription.metadata.plan || configuredPlan;
  const hasEntitlement = ["active", "trialing"].includes(subscription.status);

  await db.transaction(async (transaction) => {
    await transaction
      .insert(subscriptions)
      .values({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: subscription.status,
        currentPeriodStart: asDate(item?.current_period_start),
        currentPeriodEnd: asDate(item?.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          status: subscription.status,
          currentPeriodStart: asDate(item?.current_period_start),
          currentPeriodEnd: asDate(item?.current_period_end),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date(),
        },
      });

    await transaction
      .update(users)
      .set({ plan: hasEntitlement ? plan : "free", updatedAt: new Date() })
      .where(eq(users.id, userId));

    await transaction.insert(auditLogs).values({
      userId,
      action: `subscription.${subscription.status}`,
      resourceType: "subscription",
      resourceId: subscription.id,
      metadata: { priceId, plan, cancelAtPeriodEnd: subscription.cancel_at_period_end },
    });
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "checkout.session.completed": {
        const checkout = event.data.object;
        const subscriptionId =
          typeof checkout.subscription === "string"
            ? checkout.subscription
            : checkout.subscription?.id;
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await syncSubscription(
            subscription,
            checkout.client_reference_id || checkout.metadata?.userId
          );
        }
        break;
      }
      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook ${event.id} failed`, error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
