import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, Check, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProduct, platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";
import { calculators } from "@/lib/financepilot";

const product = getProduct("financepilot");
const url = `${getAppUrl()}/products/financepilot`;
const description =
  product?.description ??
  "FinancePilot is LaunchStack's workspace for the financial calculators you reach for every day. The EMI, SIP, compound interest and loan calculators are live, with autosave, recent calculations and PDF export.";

export const metadata: Metadata = {
  title: `FinancePilot — Financial calculators | ${platform.name}`,
  description,
  keywords: [
    "FinancePilot",
    "financial calculator",
    "loan calculator",
    "mortgage calculator",
    "compound interest",
    "browser calculator",
    "LaunchStack",
  ],
  alternates: { canonical: url },
  openGraph: {
    title: `FinancePilot — Financial calculators | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "FinancePilot",
      url,
      description,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any modern browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Keshav Labs" },
      isPartOf: { "@type": "WebSite", name: platform.name, url: getAppUrl() },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Products", item: `${getAppUrl()}/products` },
        { "@type": "ListItem", position: 3, name: "FinancePilot", item: url },
      ],
    },
  ],
};

/** The features the product page advertises. */
const FEATURE_HIGHLIGHTS = [
  "13 calculators: formula, personal-finance, investment & retirement, plus a 0–100 financial health score",
  "Amortisation and growth schedules with a virtualised scroll for long tenures",
  "Pure-SVG pie, line and bar charts that match the LaunchStack visual language",
  "Reusable line-item list editor shared by every personal-finance module",
  "Health score with 6 categories and prioritised improvement suggestions",
  "Autosave to IndexedDB with a server-side recent mirror and full rename / duplicate / delete",
  "Print-to-PDF export for every calculation, using the same browser pipeline as OfficePilot",
];

const LAUNCHED_CHECKLIST = [
  "Workspace shell, navigation rail, status bar and shortcuts dialog",
  "Per-document autosave, save / open / rename / duplicate / delete lifecycle",
  "Recent-calculations mirror, dashboard and search integration",
  "Type-safe calculation registry, templates and storage layer",
  "Four formula calculators: EMI, SIP, compound interest, loan",
  "Four personal-finance modules: budget planner, expense tracker, savings planner, net worth tracker",
  "Four investment & retirement modules: retirement, investment, goal, financial dashboard",
  "Financial Health Score with 6 categories and improvement suggestions",
];

export default async function FinancePilotProductPage() {
  const user = await getSession();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar user={user} />

      <main className="bg-background animate-page-in">
        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
            <nav
              aria-label="Breadcrumb"
              className="mb-8 text-xs text-muted-foreground"
            >
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href="/" className="transition-colors hover:text-foreground">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/products" className="transition-colors hover:text-foreground">
                    Products
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-foreground" aria-current="page">
                  FinancePilot
                </li>
              </ol>
            </nav>

            <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Calculator className="h-3 w-3" aria-hidden="true" />
                  {product?.category ?? "Finance"}
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  FinancePilot
                </h1>
                <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                  {product?.tagline ??
                    "The browser-based workspace for the financial calculators you reach for every day."}
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {description}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Button asChild size="lg">
                    <Link href="/financepilot">
                      Open the workspace
                      <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="ghost">
                    <Link href="/products">All LaunchStack products</Link>
                  </Button>
                </div>
              </div>

              <Card className="p-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {calculators.length === 0
                    ? "Foundation status"
                    : "Live status"}
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight">
                  {calculators.length === 0
                    ? "Workspace ready"
                    : `${calculators.length} calculators live`}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {calculators.length === 0
                    ? "The reusable FinancePilot workspace is live. The first calculator lands in the next batch and will plug straight into the same shell, sidebar, autosave loop and export pipeline."
                    : "The reusable FinancePilot workspace is live with four formula calculators (EMI, SIP, compound interest, loan), four personal-finance modules (budget, expense, savings, net worth), four investment & retirement modules (retirement, investment, goal, financial dashboard) and a 0–100 financial health score. Every module uses the same shell, sidebar, autosave loop and print-to-PDF export pipeline."}
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="grid gap-6 sm:grid-cols-2">
              {FEATURE_HIGHLIGHTS.map((highlight) => (
                <div key={highlight} className="flex items-start gap-3">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-sm">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-lg font-semibold">What ships in batches 1, 2, 3 and 4</h2>
            </div>
            <Card className="p-6">
              <ul className="space-y-3 text-sm">
                {LAUNCHED_CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            {calculators.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
                  Live calculators
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {calculators.map((calc) => (
                    <li key={calc.kind}>
                      <Link
                        href={`/financepilot/${calc.slug}`}
                        className="block rounded-lg border border-border/60 p-4 transition-colors hover:border-foreground/30 hover:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <p className="text-sm font-semibold">{calc.name}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {calc.tagline}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Open the FinancePilot workspace</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a calculator from the workspace rail or jump straight to
                  one of the thirteen live calculators below. Calculations save
                  themselves and export as a PDF in one click.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/financepilot">
                  Open the workspace
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
