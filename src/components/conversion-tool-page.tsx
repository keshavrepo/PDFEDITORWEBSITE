import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DocumentConverter } from "@/components/document-converter";
import { getAppUrl } from "@/lib/env";
import type { ConversionToolConfig } from "@/lib/conversion/tool-config";

/** Shared metadata builder so every conversion tool page stays consistent. */
export function buildConversionMetadata(tool: ConversionToolConfig): Metadata {
  const url = `${getAppUrl()}${tool.href}`;
  const title = `${tool.name} — Free Online Converter | PDFPilot`;

  return {
    title,
    description: tool.longDescription,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: tool.longDescription,
      url,
      type: "website",
      siteName: "PDFPilot",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tool.longDescription,
    },
  };
}

/**
 * Structured data for search engines: the tool itself, its breadcrumb trail
 * and the FAQ shown on the page.
 */
function buildStructuredData(tool: ConversionToolConfig) {
  const appUrl = getAppUrl();
  const url = `${appUrl}${tool.href}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: tool.name,
        url,
        description: tool.longDescription,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any modern web browser",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@type": "Organization", name: "Keshav Labs" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: appUrl },
          { "@type": "ListItem", position: 2, name: "Tools", item: `${appUrl}/tools` },
          { "@type": "ListItem", position: 3, name: tool.name, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: tool.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };
}

export function ConversionToolPage({ tool }: { tool: ConversionToolConfig }) {
  return (
    <>
      <script
        type="application/ld+json"
        // Structured data is generated from trusted static configuration.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData(tool)) }}
      />
      <Navbar />
      <DocumentConverter tool={tool} />
      <Footer />
    </>
  );
}
