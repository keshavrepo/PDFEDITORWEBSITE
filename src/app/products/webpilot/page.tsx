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
import { sessions } from "@/lib/webpilot";

const product = getProduct("webpilot");
const url = `${getAppUrl()}/products/webpilot`;
const description =
  product?.description ??
  "WebPilot is LaunchStack's web workspace. Batch 1 ships a reusable web workspace with a syntax-highlighted HTML editor, a CSS editor with auto-complete and color preview, a JavaScript editor with console preview, and a live preview that combines all three into a working browser surface. The same LaunchStack platform hosts PDFPilot, ImagePilot, OfficePilot, DevPilot, SocialPilot and FinancePilot.";

/** The features the product page advertises. */
const FEATURE_HIGHLIGHTS = [
  "Reusable web-workspace shell with a left navigation rail, workspace header, tool switcher, status bar, recent sessions, favourites, autosave and keyboard shortcuts — the same shell OfficePilot, SocialPilot, FinancePilot and DevPilot ship",
  "HTML editor with syntax highlighting, line numbers, auto-indentation, find and replace with match-case / whole-word / regex, undo and redo, format, minify, beautify, word wrap, import and export",
  "CSS editor with syntax highlighting, property and value auto-complete, inline color preview for every hex and rgb() reference, variable usage detection, format, minify, beautify, import and export",
  "JavaScript editor with syntax highlighting, identifier auto-complete, format, minify, beautify, a sandboxed console preview that captures log, warn, error and info, import and export",
  "Live Preview that combines HTML, CSS and JavaScript into a working browser surface, with a sandboxed iframe, auto-refresh and a console output panel",
  "Right-rail tabbed panel with session properties, web history and the platform-level activity feed",
  "IndexedDB-backed autosave loop and server-side recent-sessions mirror, the same architecture proven by OfficePilot, SocialPilot, FinancePilot and DevPilot",
];

/** What ships in Batch 1. */
const LAUNCHED_CHECKLIST = [
  "Batch 1 — WebPilot workspace shell with left navigation, workspace header, tool switcher, recent sessions, favourites, activity panel, properties panel, search, autosave and keyboard shortcuts",
  "Batch 1 — HTML editor with syntax highlighting, line numbers, auto-indentation, find and replace, undo and redo, format, minify, beautify, word wrap, import and export",
  "Batch 1 — CSS editor with syntax highlighting, auto-complete, color preview, variable usage detection, format, minify, beautify, import and export",
  "Batch 1 — JavaScript editor with syntax highlighting, identifier auto-complete, format, minify, beautify, console preview, import and export",
  "Batch 1 — Live Preview surface that combines HTML, CSS and JavaScript into a sandboxed browser surface with auto-refresh and a console output panel",
  "Batch 1 — Two new database tables: webSessions and webHistory, both keyed per user, mirroring the FinancePilot / SocialPilot / DevPilot recent-mirror pattern",
  "Batch 1 — Two new API endpoints: /api/webpilot/{sessions, history}, both rate-limited and origin-checked",
  "Batch 1 — The default /webpilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
];

/** What the future batches will add. */
const ROADMAP = [
  "Batch 2 — SEO inspector: meta-tag audits, open-graph previews, structured-data validation and lighthouse-style accessibility hints",
  "Batch 2 — Asset generator: favicon, manifest, OG image, robots.txt and sitemap.xml from a single form",
  "Batch 3 — Site linter and accessibility checker built on top of the same HTML editor and the live preview",
  "Batch 3 — Snippet library for HTML, CSS and JavaScript components, reuses the DevPilot snippet model",
];

export const metadata: Metadata = {
  title: `${product?.name ?? "WebPilot"} | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `${product?.name ?? "WebPilot"} | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

export default async function WebPilotProductPage() {
  const user = await getSession();
  const productStatus = product?.status ?? "coming-soon";

  return (
    <>
      <Navbar user={user} />
      <main>
        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              Batch 1 · Foundation
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {product?.name ?? "WebPilot"}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              {product?.tagline ??
                "A professional web workspace in your browser."}
            </p>
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button asChild className="gap-1.5">
                <Link href="/webpilot">
                  Open the workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              {productStatus === "active" && (
                <Button asChild variant="ghost" className="gap-1.5">
                  <Link href="/webpilot/html">
                    Open the HTML editor
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
                        href={`/webpilot/${entry.slug}`}
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
              WebPilot reuses the same authentication, dashboard, file manager,
              search, notification centre, settings and analytics that ship
              with PDFPilot, ImagePilot, OfficePilot, DevPilot, SocialPilot
              and FinancePilot. No new shared infrastructure was created for
              this product.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
