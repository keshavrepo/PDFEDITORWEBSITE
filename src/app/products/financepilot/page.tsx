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
  "FinancePilot is the next LaunchStack product: a browser-based workspace for the financial calculators you reach for every day. The reusable workspace is live; the first calculators ship in the next batch.";

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

/** The features the product page advertises while the foundation is empty. */
const FOUNDATION_HIGHLIGHTS = [
  "Reusable workspace shell with the LaunchStack chrome",
  "Sidebar, recent calculations, categories and search integrated",
  "Autosave to IndexedDB with a server-side recent mirror",
  "Export pipeline (JSON) ready for richer exporters",
  "Shared calculation engine that every future calculator plugs into",
];

const FOUNDATION_CHECKLIST = [
  "Workspace shell, navigation rail, status bar and shortcuts dialog",
  "Per-document autosave, save / open / rename / duplicate / delete lifecycle",
  "Recent-calculations mirror, dashboard and search integration",
  "Type-safe calculation registry, templates and storage layer",
  "First calculator (loan, mortgage, savings, …) — coming next",
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

      <main className="bg-background">
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
                  Foundation status
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight">
                  {calculators.length === 0
                    ? "Workspace ready"
                    : `${calculators.length} calculator${calculators.length === 1 ? "" : "s"} live`}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The reusable FinancePilot workspace is live. The first
                  calculator lands in the next batch and will plug straight
                  into the same shell, sidebar, autosave loop and export
                  pipeline.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="grid gap-6 sm:grid-cols-2">
              {FOUNDATION_HIGHLIGHTS.map((highlight) => (
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
              <h2 className="text-lg font-semibold">What ships in the foundation</h2>
            </div>
            <Card className="p-6">
              <ul className="space-y-3 text-sm">
                {FOUNDATION_CHECKLIST.map((item) => (
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
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Open the FinancePilot workspace</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The foundation is already usable. Open the workspace to
                  explore the chrome while the first calculators are being
                  built.
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
