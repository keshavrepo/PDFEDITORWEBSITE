import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CropPdfTool } from "@/components/crop-pdf-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Crop PDF pages with a live preview. Trim margins by hand, remove white space automatically, and apply the crop to every page or just a selection.";
const url = `${getAppUrl()}/tools/crop-pdf`;

export const metadata: Metadata = {
  title: "Crop PDF | PDFPilot",
  description,
  keywords: ["crop PDF", "trim PDF margins", "remove white margins PDF"],
  alternates: { canonical: url },
  openGraph: {
    title: "Crop PDF | PDFPilot",
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
      name: "Crop PDF",
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
        { "@type": "ListItem", position: 3, name: "Crop PDF", item: url },
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
      <CropPdfTool />
      <Footer />
    </>
  );
}
