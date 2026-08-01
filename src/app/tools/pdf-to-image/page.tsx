import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PdfToImageTool } from "@/components/pdfpilot/pdf-to-image-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Convert every page of a PDF into high-quality JPG or PNG images. Choose the resolution and download multi-page documents as a ZIP archive, all in your browser.";
const url = `${getAppUrl()}/tools/pdf-to-image`;

export const metadata: Metadata = {
  title: "PDF to JPG or PNG — Free Online Converter | PDFPilot",
  description,
  keywords: ["PDF to JPG", "PDF to PNG", "PDF to image", "convert PDF pages to images"],
  alternates: { canonical: url },
  openGraph: {
    title: "PDF to JPG or PNG — Free Online Converter | PDFPilot",
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
      name: "PDF to JPG or PNG",
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
        { "@type": "ListItem", position: 3, name: "PDF to JPG or PNG", item: url },
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
      <PdfToImageTool />
      <Footer />
    </>
  );
}
