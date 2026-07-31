import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ScanToPdfTool } from "@/components/scan-to-pdf-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Turn phone photos into a clean multi-page PDF. Page edges are detected automatically, backgrounds cropped away, sideways shots rotated and lighting evened out.";
const url = `${getAppUrl()}/tools/scan-to-pdf`;

export const metadata: Metadata = {
  title: "Scan to PDF | PDFPilot",
  description,
  keywords: ["scan to PDF", "camera to PDF", "photo to PDF", "document scanner"],
  alternates: { canonical: url },
  openGraph: {
    title: "Scan to PDF | PDFPilot",
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
      name: "Scan to PDF",
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
        { "@type": "ListItem", position: 3, name: "Scan to PDF", item: url },
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
      <ScanToPdfTool />
      <Footer />
    </>
  );
}
