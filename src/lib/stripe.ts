import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    appInfo: { name: "PDFPilot", version: "1.0.0" },
  });
  return stripeClient;
}
