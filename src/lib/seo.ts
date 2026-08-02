import type { Metadata } from "next";
import { getAppUrl } from "./env";
import { platform } from "./products";

/* -------------------------------------------------------------------------- */
/* Canonical & absolute URL helpers                                            */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/* Every page in the platform uses `appUrl(path)` to build its canonical URL */
/* and OG/Twitter URL fields. Centralising the rule here means the metadata  */
/* on every route is consistent with itself, and a single place to fix the  */
/* hostname.                                                                  */
/* -------------------------------------------------------------------------- */

/** The platform's absolute origin, no trailing slash. */
export function appOrigin(): string {
  return getAppUrl();
}

/** Joins the platform origin with a path. Empty string returns the root. */
export function appUrl(path: string = ""): string {
  const base = appOrigin();
  if (!path) return base;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalised}`;
}

/* -------------------------------------------------------------------------- */
/* Title helpers                                                              */
/* -------------------------------------------------------------------------- */

/** The full page title with the platform suffix. Keeps the suffix consistent. */
export function pageTitle(title: string): string {
  return title.includes(platform.name) ? title : `${title} | ${platform.name}`;
}

/* -------------------------------------------------------------------------- */
/* OpenGraph + Twitter builders                                                */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/* A single builder for OG / Twitter metadata means the two stay in lockstep.  */
/* The image is platform-wide (the default OG image) unless the page opts in  */
/* to its own.                                                                 */
/* -------------------------------------------------------------------------- */

interface PageSeoOptions {
  /** Path under the app origin, e.g. "/pricing". Used to build canonical / og:url. */
  path: string;
  /** Already-formatted page title (without the platform suffix). */
  title: string;
  /** Page description. */
  description: string;
  /** Optional keywords for the meta-keywords tag. */
  keywords?: string[];
  /** When true, the page is indexable (default). */
  indexable?: boolean;
  /** Page-specific OG image, absolute URL. Defaults to the platform's opengraph-image. */
  image?: string;
  /** og:type override. Defaults to "website". */
  type?: "website" | "article" | "profile";
  /** Article published time (ISO). Only relevant for og:type="article". */
  publishedTime?: string;
  /** Article modified time (ISO). Only relevant for og:type="article". */
  modifiedTime?: string;
  /** Article author. Only relevant for og:type="article". */
  author?: string;
}

/** The full Next.js Metadata object for a single page, ready to spread. */
export function buildPageMetadata(options: PageSeoOptions): Metadata {
  const {
    path,
    title,
    description,
    keywords,
    indexable = true,
    image,
    type = "website",
    publishedTime,
    modifiedTime,
    author,
  } = options;
  const url = appUrl(path);
  const resolvedTitle = pageTitle(title);
  const ogImage = image ?? appUrl("/opengraph-image");
  // The Next.js `OpenGraphMetadata` type is conservative; the article-specific
  // fields (`publishedTime`, `modifiedTime`, `authors`) are valid for
  // og:type=article but are not in the base type. Cast the assembled object
  // so the page builder can declare them through a single helper.
  const og = {
    title: resolvedTitle,
    description,
    url,
    siteName: platform.name,
    type,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: resolvedTitle,
      },
    ],
    ...(publishedTime ? { publishedTime } : {}),
    ...(modifiedTime ? { modifiedTime } : {}),
    ...(author ? { authors: [author] } : {}),
  } as NonNullable<Metadata["openGraph"]>;

  const twitter: NonNullable<Metadata["twitter"]> = {
    card: "summary_large_image",
    title: resolvedTitle,
    description,
    images: [ogImage],
  };

  return {
    title: resolvedTitle,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: og,
    twitter,
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

/* -------------------------------------------------------------------------- */
/* JSON-LD builders                                                            */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/* These are plain object factories so pages can serialise them via the       */
/* `application/ld+json` script tag. The shapes follow schema.org. The       */
/* launchstack organisation graph is consumed by the root layout; individual  */
/* pages can extend it with their own BreadcrumbList / SoftwareApplication /  */
/* WebPage nodes.                                                              */
/* -------------------------------------------------------------------------- */

export interface OrganizationNode {
  "@context": "https://schema.org";
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
  logo: string;
  description: string;
  foundingDate?: string;
  founder: { "@type": "Person"; name: string; url?: string };
  address: { "@type": "PostalAddress"; addressLocality: string; addressCountry: string };
  sameAs: string[];
  contactPoint: { "@type": "ContactPoint"; contactType: string; email: string; availableLanguage: string[] }[];
}

export interface WebSiteNode {
  "@context": "https://schema.org";
  "@type": "WebSite";
  "@id": string;
  name: string;
  url: string;
  description: string;
  inLanguage: string;
  publisher: { "@id": string };
  potentialAction: {
    "@type": "SearchAction";
    target: { "@type": "EntryPoint"; urlTemplate: string };
    "query-input": string;
  };
}

export interface SoftwareApplicationNode {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  "@id": string;
  name: string;
  url: string;
  description: string;
  applicationCategory: string;
  operatingSystem: string;
  softwareVersion?: string;
  offers: { "@type": "Offer"; price: string; priceCurrency: string };
  publisher: { "@id": string };
  isPartOf: { "@id": string };
}

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export interface BreadcrumbListNode {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
}

export interface WebPageNode {
  "@context": "https://schema.org";
  "@type": "WebPage";
  "@id": string;
  url: string;
  name: string;
  description: string;
  inLanguage: string;
  isPartOf: { "@id": string };
}

export interface ArticleNode {
  "@context": "https://schema.org";
  "@type": "Article";
  "@id": string;
  url: string;
  headline: string;
  description: string;
  inLanguage: string;
  datePublished: string;
  dateModified?: string;
  author: { "@type": "Person"; name: string; url?: string };
  publisher: { "@id": string };
  isPartOf: { "@id": string };
}

export interface FAQNode {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  "@id": string;
  url: string;
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }>;
}

/* -------------------------------------------------------------------------- */
/* Organization + WebSite graph (used by the root layout)                      */
/* -------------------------------------------------------------------------- */

export function launchstackOrganizationGraph(): {
  "@context": "https://schema.org";
  "@graph": Array<OrganizationNode | WebSiteNode>;
} {
  const origin = appOrigin();
  const organisationId = `${origin}#organization`;
  const websiteId = `${origin}#website`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": organisationId,
        name: platform.name,
        url: origin,
        logo: `${origin}/icon`,
        description: platform.description,
        founder: {
          "@type": "Person",
          name: "Keshav",
          url: "https://github.com/keshavrepo/",
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Delhi",
          addressCountry: "IN",
        },
        sameAs: [
          "https://github.com/keshavrepo/",
          "https://www.linkedin.com/in/keshavkumarfullstack",
        ],
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: "launchstack.in@gmail.com",
            availableLanguage: ["en"],
          },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": websiteId,
        name: platform.name,
        url: origin,
        description: platform.description,
        inLanguage: "en",
        publisher: { "@id": organisationId },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Product graph (used by the products index)                                 */
/* -------------------------------------------------------------------------- */

export function launchstackProductGraph(): {
  "@context": "https://schema.org";
  "@graph": SoftwareApplicationNode[];
} {
  const origin = appOrigin();
  const organisationId = `${origin}#organization`;
  const websiteId = `${origin}#website`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#pdfpilot`,
        name: "PDFPilot",
        url: `${origin}/tools`,
        description:
          "Convert, organise, optimise, edit and secure PDFs without uploading them. Twenty-seven tools covering Word, Excel, PowerPoint, images, OCR, forms, redaction and archival PDF/A.",
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "1.4.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#imagepilot`,
        name: "ImagePilot",
        url: `${origin}/imagepilot`,
        description:
          "A professional image editor in your browser. Layers, non-destructive adjustments, text, shapes, crop and transform tools, plus focused studios for screenshots, watermarks, passport photos, background removal, redaction, metadata and batch conversion.",
        applicationCategory: "DesignApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "1.2.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#audiopilot`,
        name: "AudioPilot",
        url: `${origin}/audiopilot`,
        description:
          "Browser-first audio workspace: player, trimmer, converter, recorder, merger, splitter, metadata editor, batch processing, library, waveform editor, effects, silence detection, export center and productivity.",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "0.4.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#officepilot`,
        name: "OfficePilot",
        url: `${origin}/officepilot`,
        description:
          "One workspace for Word, Excel and PowerPoint inside LaunchStack. Write documents, build spreadsheets and assemble slide decks, then export to the standard Office formats.",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "0.1.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#devpilot`,
        name: "DevPilot",
        url: `${origin}/devpilot`,
        description:
          "A professional developer workspace in your browser. Snippets, sessions and history that future developer tools plug into.",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "0.1.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#socialpilot`,
        name: "SocialPilot",
        url: `${origin}/socialpilot`,
        description:
          "A social-media workspace inside LaunchStack: captions, hashtags, drafts and exports for every network.",
        applicationCategory: "SocialMediaApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "0.1.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#financepilot`,
        name: "FinancePilot",
        url: `${origin}/financepilot`,
        description:
          "A finance workspace inside LaunchStack: SIP, EMI, FD, RD, PPF, NPS, lumpsum, goal planners, tax and salary calculators.",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "0.1.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${origin}#webpilot`,
        name: "WebPilot",
        url: `${origin}/webpilot`,
        description:
          "A web workspace inside LaunchStack: HTML editor, CSS editor, JavaScript console and project history.",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any modern web browser",
        softwareVersion: "0.1.0",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organisationId },
        isPartOf: { "@id": websiteId },
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* BreadcrumbList graph (helper)                                              */
/* -------------------------------------------------------------------------- */

export function breadcrumbGraph(items: BreadcrumbItem[]): BreadcrumbListNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: appUrl(entry.href),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* WebPage graph (helper for non-product pages)                               */
/* -------------------------------------------------------------------------- */

export function webPageGraph(options: {
  path: string;
  name: string;
  description: string;
}): WebPageNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${appUrl(options.path)}#webpage`,
    url: appUrl(options.path),
    name: options.name,
    description: options.description,
    inLanguage: "en",
    isPartOf: { "@id": `${appOrigin()}#website` },
  };
}

/* -------------------------------------------------------------------------- */
/* Article graph (used by the blog)                                            */
/* -------------------------------------------------------------------------- */

export function articleGraph(options: {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
}): ArticleNode {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${appUrl(options.path)}#article`,
    url: appUrl(options.path),
    headline: options.headline,
    description: options.description,
    inLanguage: "en",
    datePublished: options.datePublished,
    dateModified: options.dateModified,
    author: {
      "@type": "Person",
      name: options.author ?? "Keshav Labs",
      url: "https://github.com/keshavrepo/",
    },
    publisher: { "@id": `${appOrigin()}#organization` },
    isPartOf: { "@id": `${appOrigin()}#website` },
  };
}
