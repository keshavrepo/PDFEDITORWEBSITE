import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PdfATool } from "@/components/pdfpilot/pdfa-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Convert PDFs to the PDF/A archival format for long-term storage. Every document is validated first, then given an sRGB output intent and conforming XMP metadata.";
const url = `${getAppUrl()}/tools/pdfa-converter`;

export const metadata: Metadata = {
  title: "PDF/A Converter | PDFPilot",
  description,
  keywords: ["PDF to PDF/A", "PDF/A converter", "archival PDF", "ISO 19005"],
  alternates: { canonical: url },
  openGraph: {
    title: "PDF/A Converter | PDFPilot",
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
      name: "PDF/A Converter",
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
        { "@type": "ListItem", position: 3, name: "PDF/A Converter", item: url },
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
      <PdfATool />
      <Footer />
    </>
  );
}
