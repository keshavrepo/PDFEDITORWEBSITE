import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Check } from "lucide-react";
import { BillingButton } from "@/components/billing-button";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getSession();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      features: [
        "5 files per day",
        "Files up to 10MB",
        "Basic tools",
        "24-hour storage",
      ],
      cta: "Get started",
      href: "/register",
      planId: null,
    },
    {
      name: "Pro",
      price: "$12",
      period: "per month",
      features: [
        "Unlimited files",
        "Files up to 100MB",
        "All premium tools",
        "Priority processing",
        "No watermarks",
        "Email support",
      ],
      cta: "Start trial",
      href: "/register?plan=pro",
      planId: "pro" as const,
      highlighted: true,
    },
    {
      name: "Business",
      price: "$49",
      period: "per month",
      features: [
        "Everything in Pro",
        "Unlimited file size",
        "Team collaboration",
        "API access",
        "Custom branding",
        "Dedicated support",
      ],
      cta: "Contact sales",
      href: "/contact",
      planId: null,
    },
  ];

  return (
    <>
      <Navbar user={user} />
      
      <main>
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Pricing
            </h1>
            <p className="text-lg text-muted-foreground">
              Simple, transparent pricing for teams of all sizes
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`p-8 ${
                  plan.highlighted ? "ring-2 ring-foreground" : ""
                }`}
              >
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="mb-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {plan.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.planId ? (
                  user?.plan === plan.planId ? (
                    <BillingButton mode="portal" className="w-full" size="lg">
                      Manage plan
                    </BillingButton>
                  ) : (
                    <BillingButton
                      mode="checkout"
                      plan={plan.planId}
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      size="lg"
                    >
                      {plan.cta}
                    </BillingButton>
                  )
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    size="lg"
                    asChild
                  >
                    <Link href={plan.name === "Free" && user ? "/dashboard" : plan.href}>
                      {plan.name === "Free" && user ? "Go to dashboard" : plan.cta}
                    </Link>
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 border-t pt-24">
          <h2 className="text-2xl font-semibold mb-12">
            Frequently asked questions
          </h2>

          <div className="space-y-8">
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes. You can cancel your subscription at any time with no questions asked.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, we offer a 30-day money-back guarantee. Contact us for a full refund.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards, PayPal, and bank transfers for annual plans.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! Pro and Business plans come with a 14-day free trial. No credit card required.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
