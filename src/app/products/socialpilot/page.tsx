import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, FileText } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProduct, platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";
import { projects } from "@/lib/socialpilot";

const product = getProduct("socialpilot");
const url = `${getAppUrl()}/products/socialpilot`;
const description =
  product?.description ??
  "SocialPilot is LaunchStack's creator workspace. The foundation is live: a reusable workspace shell, a project system, a media library and a brand kit. Future batches add the creator tools (post designer, video editor, scheduler, AI assistant) on top of the same shell.";

export const metadata: Metadata = {
  title: `SocialPilot — Creator workspace | ${platform.name}`,
  description,
  keywords: [
    "SocialPilot",
    "creator workspace",
    "social media",
    "post designer",
    "video editor",
    "scheduler",
    "LaunchStack",
  ],
  alternates: { canonical: url },
  openGraph: {
    title: `SocialPilot — Creator workspace | ${platform.name}`,
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
      name: "SocialPilot",
      url,
      description,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: platform.name },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Products", item: `${getAppUrl()}/products` },
        { "@type": "ListItem", position: 3, name: "SocialPilot", item: url },
      ],
    },
  ],
};

/** The features the product page advertises. */
const FEATURE_HIGHLIGHTS = [
  "Reusable creator-workspace shell with a left navigation rail, workspace header, tool switcher, status bar, recent projects, favourites, autosave and keyboard shortcuts",
  "Project system: create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
  "Media library: upload images, video and audio; organise, search, filter, preview and delete assets; reuses the existing upload infrastructure",
  "Reusable brand kit: logos, brand colours, fonts and default social profiles (reusable across every future SocialPilot tool)",
  "IndexedDB-backed autosave loop and server-side recent-projects mirror, the same architecture proven by OfficePilot and FinancePilot",
  "Right-rail tabbed panel with project properties, brand kit, media library and activity timeline (reuses the platform-level activity feed)",
];

/** What ships in batch 1. */
const LAUNCHED_CHECKLIST = [
  "Social Workspace shell with left navigation, workspace header, tool switcher, recent projects, favourites, activity panel, properties panel, search, autosave and keyboard shortcuts",
  "Project system: create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
  "Media library for images, video and audio: upload, organise, search, filter, preview and delete",
  "Reusable brand kit with logos, brand colours, fonts and default social profiles",
];

export default async function SocialPilotProductPage() {
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
                  SocialPilot
                </li>
              </ol>
            </nav>

            <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  {product?.category ?? "Media"}
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  SocialPilot
                </h1>
                <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                  {product?.tagline ??
                    "The browser-based creator workspace that hosts every future SocialPilot tool."}
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {description}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Button asChild size="lg">
                    <Link href="/socialpilot">
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
                  {projects.length} project kinds live
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The reusable SocialPilot workspace is live with {projects.length}{" "}
                  project kinds (post, story, carousel, video, short, reel, thread,
                  campaign, podcast) and a brand kit, media library, project
                  properties and activity panel. Every future tool plugs straight
                  into the same shell, sidebar, autosave loop and export pipeline.
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
              <h2 className="text-lg font-semibold">What ships in batch 1</h2>
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
          </div>
        </section>

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">Project kinds included in batch 1</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map((entry) => (
                <li key={entry.kind}>
                  <Card className="p-4">
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.tagline}
                    </p>
                    {entry.slug && (
                      <Link
                        href={`/socialpilot/${entry.slug}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-4 text-lg font-semibold">Reused from the LaunchStack platform</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              SocialPilot reuses the same authentication, dashboard, file manager,
              search, notification centre and analytics that ship with
              OfficePilot, FinancePilot and PDFPilot. No new shared infrastructure
              was created for this product.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
