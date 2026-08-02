import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/platform/product-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Check, Layers, Lock, Shield, Users, Zap } from "lucide-react";
import { activeProducts, platform, products, upcomingProducts } from "@/lib/products";
import { tools } from "@/lib/tools";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/",
  title: platform.tagline,
  description: platform.description,
  keywords: [
    "LaunchStack",
    "productivity platform",
    "PDF tools",
    "ImagePilot",
    "AudioPilot",
    "OfficePilot",
    "DevPilot",
    "SocialPilot",
    "FinancePilot",
    "WebPilot",
    "PDFPilot",
    "browser tools",
    "privacy-first tools",
  ],
});

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSession();

  const pillars = [
    {
      icon: Lock,
      title: "Privacy-conscious by design",
      description:
        "Supported tools process your files locally in the browser, so document bytes do not need to be uploaded just to complete a task",
    },
    {
      icon: Zap,
      title: "Fast where it matters",
      description:
        "Work completes in seconds without a round trip to a server, and downloads are immediate",
    },
    {
      icon: Layers,
      title: "One account, every product",
      description:
        "A single LaunchStack account carries across every module as new products arrive",
    },
    {
      icon: Users,
      title: "Built by Keshav Labs",
      description:
        "A focused, independently developed platform built and supported from Delhi, India",
    },
  ];

  return (
    <>
      <Navbar user={user} />

      <main className="pt-16 animate-page-in">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-20 md:pt-28 md:pb-24">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Layers className="w-4 h-4" aria-hidden="true" />
                {activeProducts.length} product live · {upcomingProducts.length} in development
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]">
                One platform.<br />Every tool you need.
              </h1>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
                {platform.name} is a growing suite of focused, privacy-first productivity
                products.<br className="hidden sm:block" />
                PDFPilot is available today, with more modules on the way.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/tools">
                    Open PDFPilot
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/products">Explore all products</Link>
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mt-6">
                No credit card required • Free forever
              </p>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">The {platform.name} suite</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Each product is a focused module. Start with PDFPilot today; the rest arrive as
                they are ready.
              </p>
            </div>

            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ul>
          </div>
        </section>

        {/* PDFPilot spotlight: the platform's live product */}
        <section className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Available now
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  PDFPilot: {tools.length} PDF tools, all in your browser
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Convert between PDF, Word, Excel, PowerPoint and images. Fill forms, redact
                  sensitive content, run OCR on scans, compare versions and produce archival
                  PDF/A files — without your documents leaving your device.
                </p>
                <div className="space-y-4 mb-8">
                  {[
                    "Local browser processing",
                    "Temporary in-memory results",
                    "Secure account sessions",
                    "No sale of personal data",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-primary" aria-hidden="true" />
                      </div>
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <Button size="lg" asChild>
                  <Link href="/tools">
                    Browse all {tools.length} tools
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {tools.slice(0, 8).map((tool) => (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className="rounded-2xl focus-visible:outline-none"
                  >
                    <Card className="p-5 h-full transition-colors group cursor-pointer hover:bg-accent/50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{tool.name}</h3>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Platform pillars */}
        <section className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why {platform.name}</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                The same principles apply to every product on the platform
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {pillars.map((pillar) => (
                <Card key={pillar.title} className="p-7">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-5">
                    <pillar.icon className="w-6 h-6 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Your documents stay under your control
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Supported operations run in browser memory, so document bytes do not need to be
                  uploaded to {platform.name} just to complete a task. That principle carries into
                  every product we add.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/security">
                    Read about security
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
              <Card className="p-12">
                <div className="flex items-center justify-center h-64">
                  <Shield className="w-32 h-32 text-primary/20" aria-hidden="true" />
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to get started?</h2>
            <p className="text-xl text-muted-foreground mb-10">
              Create one {platform.name} account and use every product as it launches
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start for free
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">Contact us</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
