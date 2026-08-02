import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Check, Lock, Zap } from "lucide-react";
import { getProduct, platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";
import { tools, type ToolCategory } from "@/lib/tools";

const product = getProduct("pdfpilot");
const url = `${getAppUrl()}/products/pdfpilot`;
const description = `PDFPilot is the first product on ${platform.name}: ${tools.length} browser-based tools to convert, organise, optimise, edit and secure PDFs without uploading them.`;

export const metadata: Metadata = {
  title: `PDFPilot — PDF Tools | ${platform.name}`,
  description,
  keywords: ["PDFPilot", "PDF tools", "PDF converter", "PDF editor", "LaunchStack"],
  alternates: { canonical: url },
  openGraph: {
    title: `PDFPilot — PDF Tools | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

const categoryOrder: ToolCategory[] = ["Convert", "Organize", "Optimize", "Edit", "Security"];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "PDFPilot",
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
        { "@type": "ListItem", position: 3, name: "PDFPilot", item: url },
      ],
    },
  ],
};

export default async function PdfPilotProductPage() {
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
              <li className="text-foreground font-medium" aria-current="page">PDFPilot</li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Check className="w-4 h-4" aria-hidden="true" />
              Available now
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">PDFPilot</h1>
            <p className="text-lg text-muted-foreground mb-8">
              {product?.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href="/tools">
                  Open all {tools.length} tools
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid sm:grid-cols-3 gap-6 mb-16">
            {[
              { icon: Lock, title: "Private", body: "Files are processed in your browser, not uploaded" },
              { icon: Zap, title: "Immediate", body: "Results download as soon as processing finishes" },
              { icon: Check, title: "Complete", body: `${tools.length} tools across five categories` },
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
            {categoryOrder.map((category) => {
              const categoryTools = tools.filter((tool) => tool.category === category);
              if (!categoryTools.length) return null;
              return (
                <div key={category}>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                    {category}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categoryTools.map((tool) => (
                      <Link key={tool.id} href={tool.href}>
                        <Card className="p-5 h-full hover:bg-accent transition-colors cursor-pointer group">
                          <h3 className="font-semibold mb-1 group-hover:translate-x-0.5 transition-transform">
                            {tool.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{tool.description}</p>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
