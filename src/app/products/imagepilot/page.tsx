import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  Check,
  Crop,
  Layers,
  Lock,
  Palette,
  Shapes,
  Sparkles,
  Type,
  Zap,
} from "lucide-react";
import { ADJUSTMENTS, EDITOR_TOOLS, EXPORT_FORMATS } from "@/lib/imagepilot/core";
import { getProduct, platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const product = getProduct("imagepilot");
const url = `${getAppUrl()}/products/imagepilot`;
const description = `ImagePilot is a professional image editor that runs entirely in your browser: layers, undo history, ${ADJUSTMENTS.length} non-destructive image operations, editable text, shapes, and PNG, JPG, WEBP and SVG export.`;

export const metadata: Metadata = {
  title: `ImagePilot — Browser Image Editor | ${platform.name}`,
  description,
  keywords: [
    "ImagePilot",
    "online image editor",
    "browser photo editor",
    "layer based image editor",
    "free Photoshop alternative",
    "LaunchStack",
  ],
  alternates: { canonical: url },
  openGraph: {
    title: `ImagePilot — Browser Image Editor | ${platform.name}`,
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
      name: "ImagePilot",
      url,
      description,
      applicationCategory: "DesignApplication",
      operatingSystem: "Any modern web browser",
      softwareVersion: product?.version,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Keshav Labs" },
      isPartOf: { "@type": "WebSite", name: platform.name, url: getAppUrl() },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Products", item: `${getAppUrl()}/products` },
        { "@type": "ListItem", position: 3, name: "ImagePilot", item: url },
      ],
    },
  ],
};

const capabilities = [
  {
    icon: Layers,
    title: "Layers",
    body: "Stack, reorder, lock, hide, duplicate and blend layers with sixteen blend modes and per-layer opacity.",
  },
  {
    icon: Palette,
    title: `${ADJUSTMENTS.length} image operations`,
    body: "Exposure, brightness, contrast, gamma, shadows, highlights, saturation, hue, temperature, tint, blur, sharpen, noise reduction, grayscale, sepia, invert and threshold — all non-destructive.",
  },
  {
    icon: Type,
    title: "Editable text",
    body: "Real text layers with font, size, weight, tracking, line height, alignment, stroke and drop shadow. Edit directly on the canvas.",
  },
  {
    icon: Shapes,
    title: "Shapes",
    body: "Rectangles, ellipses, lines, arrows, polygons and stars with fill, stroke and rounded corners.",
  },
  {
    icon: Crop,
    title: "Transform",
    body: "Crop with aspect presets, resize the image or the canvas, rotate, flip, and move with rulers, grid and snapping.",
  },
  {
    icon: Lock,
    title: "Private by default",
    body: "Images are decoded, edited and exported on your own device. Nothing is uploaded to a server.",
  },
];

export default async function ImagePilotProductPage() {
  const user = await getSession();
  const shapeTools = EDITOR_TOOLS.filter((tool) => tool.group === "shape");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar user={user} />

      <main className="pt-16">
        <section className="mx-auto max-w-7xl px-4 pb-14 pt-20 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
                ImagePilot
              </li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Check className="h-4 w-4" aria-hidden="true" />
              Available now
            </div>
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">ImagePilot</h1>
            <p className="mb-8 text-lg text-muted-foreground">{product?.description}</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/imagepilot">
                  Open the editor
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/products">All products</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-16 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Lock, title: "Private", body: "Images are processed in your browser, not uploaded" },
              { icon: Zap, title: "Immediate", body: "No sign-up, no waiting, no watermarks" },
              { icon: Sparkles, title: "Professional", body: "Layers, history and non-destructive editing" },
            ].map((item) => (
              <Card key={item.title} className="p-7">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <item.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <h2 className="mb-2 text-lg font-semibold">{item.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </Card>
            ))}
          </div>

          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            What the editor does
          </h2>
          <div className="mb-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <Card key={capability.title} className="p-6">
                <capability.icon className="mb-4 h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mb-2 font-semibold">{capability.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{capability.body}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Tools
              </h2>
              <ul className="space-y-2">
                {EDITOR_TOOLS.filter((tool) => tool.group !== "shape").map((tool) => (
                  <li key={tool.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <span className="text-foreground">{tool.label}</span> — {tool.hint}
                    </span>
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="text-foreground">Shapes</span> —{" "}
                    {shapeTools.map((tool) => tool.label.toLowerCase()).join(", ")}
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Image operations
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {ADJUSTMENTS.map((adjustment) => (
                  <span
                    key={adjustment.key}
                    className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                  >
                    {adjustment.label}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Export formats
              </h2>
              <ul className="space-y-3">
                {EXPORT_FORMATS.map((format) => (
                  <li key={format.value}>
                    <span className="text-sm font-medium">{format.label}</span>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {format.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {product?.releaseNotes.length ? (
            <div className="mt-16">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Release notes
              </h2>
              <div className="space-y-4">
                {product.releaseNotes.map((note) => (
                  <Card key={note.version} className="p-6">
                    <div className="mb-3 flex items-baseline gap-3">
                      <span className="font-semibold">v{note.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {note.changes.map((change) => (
                        <li key={change} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <Footer />
    </>
  );
}
