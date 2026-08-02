import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, FileText, Layers, Presentation, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProduct, platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";
import { buildPageMetadata } from "@/lib/seo";
import { editors } from "@/lib/officepilot";

const product = getProduct("officepilot");
const url = `${getAppUrl()}/products/officepilot`;
const description =
  product?.description ??
  "One Office workspace inside LaunchStack: write documents, build spreadsheets and assemble slide decks.";

export const metadata: Metadata = buildPageMetadata({
  path: "/products/officepilot",
  title: "OfficePilot — Word, Excel and PowerPoint",
  description,
  keywords: [
    "OfficePilot",
    "online word editor",
    "online spreadsheet",
    "online presentation",
    "DOCX editor",
    "XLSX editor",
    "PPTX editor",
    "LaunchStack",
  ],
});

export const dynamic = "force-dynamic";

const EDITOR_ICONS = {
  word: FileText,
  spreadsheet: Layers,
  presentation: Presentation,
} as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "OfficePilot",
      url,
      description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any modern web browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Keshav Labs" },
      isPartOf: { "@type": "WebSite", name: platform.name, url: getAppUrl() },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Products", item: `${getAppUrl()}/products` },
        { "@type": "ListItem", position: 3, name: "OfficePilot", item: url },
      ],
    },
  ],
};

export default async function OfficePilotProductPage() {
  const user = await getSession();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar user={user} />

      <main className="pt-16 animate-page-in">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/products" className="hover:text-foreground transition-colors">
                  Products
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground font-medium" aria-current="page">OfficePilot</li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Check className="w-4 h-4" aria-hidden="true" />
              Available now
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">OfficePilot</h1>
            <p className="text-lg text-muted-foreground mb-8">
              {description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href="/officepilot">
                  Open the Word editor
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/products">See every product</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid sm:grid-cols-3 gap-6 mb-16">
            {[
              { icon: Sparkles, title: "Unified", body: "One workspace for documents, sheets and slides" },
              { icon: Check, title: "Autosaved", body: "Every change is saved in your browser, instantly" },
              { icon: Layers, title: "Reusable", body: "Shared components, shared template library, shared exports" },
            ].map((item) => (
              <Card key={item.title} className="p-7">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-5">
                  <item.icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold mb-2">{item.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </Card>
            ))}
          </div>

          <div className="space-y-12">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Editors
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {editors.map((editor) => {
                  const Icon = EDITOR_ICONS[editor.kind];
                  const href = editor.kind === "word" ? "/officepilot" : `/officepilot/${editor.kind}`;
                  return (
                    <Link key={editor.kind} href={href}>
                      <Card className="p-5 h-full hover:bg-accent transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                          </div>
                          <h3 className="font-semibold group-hover:translate-x-0.5 transition-transform">
                            {editor.name}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{editor.description}</p>
                        <ul className="space-y-1">
                          {editor.highlights.map((highlight) => (
                            <li key={highlight} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>

            {product?.releaseNotes?.length ? (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                  Release notes
                </h2>
                <div className="space-y-6">
                  {product.releaseNotes.map((release) => (
                    <Card key={release.version} className="p-6">
                      <div className="flex flex-wrap items-center gap-3 mb-5">
                        <h3 className="font-semibold">{product.name}</h3>
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          v{release.version}
                        </span>
                        <time
                          dateTime={release.date}
                          className="text-xs text-muted-foreground"
                        >
                          {new Date(release.date).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </time>
                      </div>
                      <ol className="space-y-2">
                        {release.changes.map((change) => (
                          <li
                            key={change}
                            className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed"
                          >
                            <Check className="h-3.5 w-3.5 mt-1 shrink-0" aria-hidden="true" />
                            {change}
                          </li>
                        ))}
                      </ol>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
