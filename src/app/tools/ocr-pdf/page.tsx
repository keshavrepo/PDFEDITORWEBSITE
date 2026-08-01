import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { OcrPdfTool } from "@/components/pdfpilot/ocr-pdf-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Turn a scanned PDF into searchable, selectable text. Recognition runs entirely in your browser in English, Hindi, French, German or Spanish, and the output looks identical to the original.";
const url = `${getAppUrl()}/tools/ocr-pdf`;

export const metadata: Metadata = {
  title: "OCR PDF | PDFPilot",
  description,
  keywords: ["OCR PDF", "scanned PDF to text", "searchable PDF", "extract text from scan"],
  alternates: { canonical: url },
  openGraph: {
    title: "OCR PDF | PDFPilot",
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
      name: "OCR PDF",
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
        { "@type": "ListItem", position: 3, name: "OCR PDF", item: url },
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
      <OcrPdfTool />
      <Footer />
    </>
  );
}
