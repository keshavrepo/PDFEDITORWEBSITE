import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ImageToPdfTool } from "@/components/pdfpilot/image-to-pdf-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Combine JPG and PNG images into a single high-quality PDF. Reorder pages, choose portrait or landscape, set margins and pick fit or fill — all in your browser.";
const url = `${getAppUrl()}/tools/image-to-pdf`;

export const metadata: Metadata = {
  title: "JPG or PNG to PDF — Free Online Converter | PDFPilot",
  description,
  keywords: ["JPG to PDF", "PNG to PDF", "image to PDF", "combine images into PDF"],
  alternates: { canonical: url },
  openGraph: {
    title: "JPG or PNG to PDF — Free Online Converter | PDFPilot",
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
      name: "JPG or PNG to PDF",
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
        { "@type": "ListItem", position: 3, name: "JPG or PNG to PDF", item: url },
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
      <ImageToPdfTool />
      <Footer />
    </>
  );
}
