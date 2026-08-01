import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ComparePdfTool } from "@/components/pdfpilot/compare-pdf-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Compare two PDF versions and see exactly what changed. Word-level differences are highlighted, and inserted or deleted pages are identified.";
const url = `${getAppUrl()}/tools/compare-pdf`;

export const metadata: Metadata = {
  title: "Compare PDF | PDFPilot",
  description,
  keywords: ["compare PDF", "PDF diff", "PDF comparison", "find differences PDF"],
  alternates: { canonical: url },
  openGraph: {
    title: "Compare PDF | PDFPilot",
    description,
    url,
    type: "website",
    siteName: "PDFPilot",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Compare PDF",
      url,
      description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any modern web browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Keshav Labs" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Tools", item: `${getAppUrl()}/tools` },
        { "@type": "ListItem", position: 3, name: "Compare PDF", item: url },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar />
      <ComparePdfTool />
      <Footer />
    </>
  );
}
