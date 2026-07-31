import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Layers, Tag } from "lucide-react";
import {
  activeProducts,
  platform,
  productCategories,
  products,
  upcomingProducts,
} from "@/lib/products";
import { getAppUrl } from "@/lib/env";
import { tools } from "@/lib/tools";

const description = `Every product in the ${platform.name} suite. PDFPilot is available now with ${tools.length} browser-based PDF tools; ImagePilot, DevPilot, OfficePilot, WebPilot, FinancePilot and AIPilot are in development.`;
const url = `${getAppUrl()}/products`;

export const metadata: Metadata = {
  title: `Products | ${platform.name}`,
  description,
  keywords: [
    "LaunchStack products",
    "PDFPilot",
    "ImagePilot",
    "DevPilot",
    "OfficePilot",
    "WebPilot",
    "FinancePilot",
    "AIPilot",
  ],
  alternates: { canonical: url },
  openGraph: {
    title: `Products | ${platform.name}`,
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
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Products", item: url },
      ],
    },
    {
      "@type": "ItemList",
      name: `${platform.name} products`,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
        description: product.description,
        ...(product.href ? { url: `${getAppUrl()}${product.href}` } : {}),
      })),
    },
  ],
};

export default async function ProductsPage() {
  const user = await getSession();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar user={user} />

      <main className="pt-16">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground font-medium" aria-current="page">
                Products
              </li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Layers className="w-4 h-4" aria-hidden="true" />
              {activeProducts.length} available · {upcomingProducts.length} coming soon
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Products</h1>
            <div className="flex flex-wrap gap-2 mb-5">
              {productCategories().map((category) => (
                <span
                  key={category}
                  className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {category}
                </span>
              ))}
            </div>
            <p className="text-lg text-muted-foreground">
              {platform.name} is built as a suite of focused modules that share one account and
              the same privacy-first approach. PDFPilot is live today; the rest are listed here so
              you can see where the platform is heading.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Available now
          </h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none mb-14">
            {activeProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>

          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            In development
          </h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none">
            {upcomingProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>
        </section>

        {/* Release notes for everything that has shipped. */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Release notes
          </h2>
          <div className="space-y-6">
            {activeProducts.map((product) => (
              <Card key={product.id} className="p-6">
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <h3 className="font-semibold">{product.name}</h3>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    v{product.version}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {product.category}
                  </span>
                </div>

                <ol className="space-y-5">
                  {product.releaseNotes.map((release) => (
                    <li key={release.version} className="border-l-2 border-border/60 pl-4">
                      <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                        <span className="text-sm font-medium">v{release.version}</span>
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
                      <ul className="space-y-1">
                        {release.changes.map((change) => (
                          <li
                            key={change}
                            className="text-sm text-muted-foreground leading-relaxed"
                          >
                            {change}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Card className="p-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Want to be told when a product launches?
              </h2>
              <p className="text-muted-foreground mb-8">
                Create a free account and you will have access the moment each module goes live.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Create a free account
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/contact">Suggest a product</Link>
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
