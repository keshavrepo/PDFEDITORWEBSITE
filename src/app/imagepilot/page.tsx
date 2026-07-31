import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { ImageEditor } from "@/components/imagepilot/image-editor";
import { getAppUrl } from "@/lib/env";
import { platform } from "@/lib/products";

const description =
  "A free browser-based image editor with layers, undo history, crop, resize, rotate, flip and seventeen non-destructive adjustments. Add text and shapes, then export to PNG, JPG, WEBP or SVG. Images never leave your device.";
const url = `${getAppUrl()}/imagepilot`;

export const metadata: Metadata = {
  title: `Image Editor — ImagePilot | ${platform.name}`,
  description,
  keywords: [
    "online image editor",
    "free photo editor",
    "browser image editor",
    "layer editor",
    "photo editor no upload",
    "resize image online",
    "crop image online",
    "add text to image",
    "ImagePilot",
    "LaunchStack",
  ],
  alternates: { canonical: url },
  openGraph: {
    title: `Image Editor — ImagePilot | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `Image Editor — ImagePilot | ${platform.name}`,
    description,
  },
};

export const dynamic = "force-dynamic";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "ImagePilot Image Editor",
      url,
      description,
      applicationCategory: "DesignApplication",
      operatingSystem: "Any modern web browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Keshav Labs" },
      isPartOf: { "@type": "WebSite", name: platform.name, url: getAppUrl() },
      featureList: [
        "Layer-based editing",
        "Undo and redo history",
        "Crop, resize, rotate and flip",
        "Brightness, contrast, saturation, hue and exposure",
        "Blur, sharpen and noise reduction",
        "Editable text layers",
        "Rectangle, ellipse, line, arrow, polygon and star shapes",
        "PNG, JPG, WEBP and SVG export",
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Products", item: `${getAppUrl()}/products` },
        {
          "@type": "ListItem",
          position: 3,
          name: "ImagePilot",
          item: `${getAppUrl()}/products/imagepilot`,
        },
        { "@type": "ListItem", position: 4, name: "Image Editor", item: url },
      ],
    },
  ],
};

/**
 * The editor fills the viewport, so this page deliberately omits the platform
 * footer: a scrolling footer under a fixed-height canvas would push the
 * workspace off screen. Navigation back into the platform stays available in
 * the navbar and the breadcrumb above the editor.
 */
export default async function ImagePilotEditorPage() {
  const user = await getSession();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar user={user} />

      {/*
        The editor is a fixed-height application surface rather than a scrolling
        page, so the column is sized to the viewport minus the navbar and the
        breadcrumb takes its own row. `dvh` keeps this correct on mobile
        browsers whose toolbars change the visible height.
      */}
      <main className="flex h-[100dvh] flex-col pt-16">
        <nav
          aria-label="Breadcrumb"
          className="shrink-0 border-b border-border/60 px-4 py-1.5"
        >
          <ol className="mx-auto flex max-w-full flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
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
            <li>
              <Link href="/products/imagepilot" className="transition-colors hover:text-foreground">
                ImagePilot
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground" aria-current="page">
              Image Editor
            </li>
          </ol>
        </nav>

        <h1 className="sr-only">ImagePilot image editor</h1>
        <div className="min-h-0 flex-1">
          <ImageEditor />
        </div>
      </main>
    </>
  );
}
