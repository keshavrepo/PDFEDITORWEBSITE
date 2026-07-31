import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { ImageEditor } from "@/components/imagepilot/image-editor";
import { getAppUrl } from "@/lib/env";
import { platform } from "@/lib/products";
import { focusedWorkspaces, getWorkspaceBySlug } from "@/lib/imagepilot/core";

/**
 * One route serving every focused ImagePilot workspace.
 *
 * Each tool is a configuration of the same editor, so they share this page
 * rather than each getting a near-identical copy of it. Adding a tool means
 * adding a workspace descriptor; no new route file is required.
 */

export function generateStaticParams() {
  return focusedWorkspaces.map((workspace) => ({ workspace: workspace.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspace: string }>;
}): Promise<Metadata> {
  const { workspace: slug } = await params;
  const workspace = getWorkspaceBySlug(slug);
  if (!workspace) return {};

  const url = `${getAppUrl()}/imagepilot/${workspace.slug}`;
  const title = `${workspace.name} — ImagePilot | ${platform.name}`;

  return {
    title,
    description: workspace.description,
    keywords: [...workspace.keywords, "ImagePilot", "LaunchStack", "no upload"],
    alternates: { canonical: url },
    openGraph: {
      title,
      description: workspace.description,
      url,
      type: "website",
      siteName: platform.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: workspace.description,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function ImagePilotWorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = getWorkspaceBySlug(slug);
  // The full editor lives at /imagepilot, so an empty slug must not match here.
  if (!workspace || !workspace.slug) notFound();

  const user = await getSession();
  const appUrl = getAppUrl();
  const url = `${appUrl}/imagepilot/${workspace.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: `${workspace.name} — ImagePilot`,
        url,
        description: workspace.description,
        applicationCategory: "DesignApplication",
        operatingSystem: "Any modern web browser",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@type": "Organization", name: "Keshav Labs" },
        isPartOf: { "@type": "WebSite", name: platform.name, url: appUrl },
        featureList: workspace.highlights,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: appUrl },
          { "@type": "ListItem", position: 2, name: "Products", item: `${appUrl}/products` },
          {
            "@type": "ListItem",
            position: 3,
            name: "ImagePilot",
            item: `${appUrl}/products/imagepilot`,
          },
          { "@type": "ListItem", position: 4, name: workspace.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar user={user} />

      {/*
        The editor is a fixed-height application surface, so the page is sized
        to the viewport rather than allowed to scroll. `dvh` keeps that correct
        on mobile browsers whose toolbars change the visible height.
      */}
      <main className="flex h-[100dvh] flex-col pt-16">
        <nav aria-label="Breadcrumb" className="shrink-0 border-b border-border/60 px-4 py-1.5">
          <ol className="mx-auto flex max-w-full flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/products/imagepilot" className="transition-colors hover:text-foreground">
                ImagePilot
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/imagepilot" className="transition-colors hover:text-foreground">
                Editor
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground" aria-current="page">
              {workspace.name}
            </li>
          </ol>
        </nav>

        <h1 className="sr-only">
          {workspace.name} — {workspace.tagline}
        </h1>
        <div className="min-h-0 flex-1">
          <ImageEditor workspace={workspace} />
        </div>
      </main>
    </>
  );
}
