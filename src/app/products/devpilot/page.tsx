import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProduct, platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";
import { sessions } from "@/lib/devpilot";

const product = getProduct("devpilot");
const url = `${getAppUrl()}/products/devpilot`;
const description =
  product?.description ??
  "DevPilot is LaunchStack's developer workspace. Batch 1 ships the foundation: a reusable developer workspace with sessions, snippets and history. The same LaunchStack platform hosts OfficePilot, SocialPilot and FinancePilot.";

/** The features the product page advertises. */
const FEATURE_HIGHLIGHTS = [
  "Reusable developer-workspace shell with a left navigation rail, workspace header, tool switcher, status bar, recent sessions, favourites, autosave and keyboard shortcuts",
  "Workspace sessions: create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
  "Developer snippets: categories, languages, tags, search, favourite, duplicate and delete",
  "Developer history: per-tool recent and favourites, search and restore",
  "Right-rail tabbed panel with session properties, developer history and the platform-level activity feed",
  "IndexedDB-backed autosave loop and server-side recent-sessions mirror, the same architecture proven by OfficePilot, SocialPilot and FinancePilot",
  "Search integrated with the global platform search so the dashboard, file manager and search bar all surface DevPilot entries",
];

/** What ships in Batch 1. */
const LAUNCHED_CHECKLIST = [
  "Batch 1 — DevPilot workspace shell with left navigation, workspace header, tool switcher, recent sessions, favourites, activity panel, properties panel, search, autosave and keyboard shortcuts",
  "Batch 1 — Workspace sessions: create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
  "Batch 1 — Developer snippets with categories, languages, tags, search, favourite, duplicate and delete",
  "Batch 1 — Developer history with per-tool recent and favourites, search and restore",
  "Batch 1 — Two new database tables: devSessions and devHistory, both keyed per user, mirroring the FinancePilot / SocialPilot recent-mirror pattern",
  "Batch 1 — Two new API endpoints: /api/devpilot/{sessions, history}, both rate-limited and origin-checked",
  "Batch 1 — The default /devpilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
];

/** What the future batches will add. */
const ROADMAP = [
  "Batch 2 — Formatter and validator tools (JSON, YAML, XML, TOML) on top of the same workspace shell, history and snippet library",
  "Batch 2 — Encoding and decoding tools (Base64, URL, JWT) on the same shell",
  "Batch 3 — Diff, hash, regex tester and code generator tools",
  "Batch 3 — Snippet library enhancements: GitHub Gist import / export, language detection, syntax highlighting",
];

export const metadata: Metadata = {
  title: `${product?.name ?? "DevPilot"} | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `${product?.name ?? "DevPilot"} | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

export default async function DevPilotProductPage() {
  const user = await getSession();
  const productStatus = product?.status ?? "coming-soon";

  return (
    <>
      <Navbar user={user} />
      <main className="animate-page-in">
        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              Batch 1 · Foundation
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {product?.name ?? "DevPilot"}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              {product?.tagline ??
                "A professional developer workspace in your browser."}
            </p>
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button asChild className="gap-1.5">
                <Link href="/devpilot">
                  Open the workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              {productStatus === "active" && (
                <Button asChild variant="ghost" className="gap-1.5">
                  <Link href="/devpilot/snippets">
                    Browse snippets
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">What ships in Batch 1</h2>
            <Card className="p-6">
              <ul className="space-y-2 text-sm">
                {LAUNCHED_CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">What&apos;s coming next</h2>
            <Card className="p-6">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {ROADMAP.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ArrowRight
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
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
            <h2 className="mb-6 text-lg font-semibold">Feature highlights</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {FEATURE_HIGHLIGHTS.map((item) => (
                <li key={item}>
                  <Card className="p-4">
                    <p className="text-sm">{item}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">Sessions included in Batch 1</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sessions.map((entry) => (
                <li key={entry.kind}>
                  <Card className="p-4">
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.tagline}
                    </p>
                    {entry.slug && (
                      <Link
                        href={`/devpilot/${entry.slug}`}
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

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-4 text-lg font-semibold">Reused from the LaunchStack platform</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              DevPilot reuses the same authentication, dashboard, file manager,
              search, notification centre, settings and analytics that ship
              with OfficePilot, SocialPilot, FinancePilot and PDFPilot. No
              new shared infrastructure was created for this product.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
