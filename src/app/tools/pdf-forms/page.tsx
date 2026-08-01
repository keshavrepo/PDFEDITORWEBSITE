import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PdfFormsTool } from "@/components/pdfpilot/pdf-forms-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Detect and fill PDF form fields in your browser. Complete text boxes, checkboxes, radio buttons, dropdowns and multi-select lists, then save or flatten the finished document.";
const url = `${getAppUrl()}/tools/pdf-forms`;

export const metadata: Metadata = {
  title: "Fill PDF Forms | PDFPilot",
  description,
  keywords: ["fill PDF form", "PDF form filler", "AcroForm", "complete PDF form"],
  alternates: { canonical: url },
  openGraph: {
    title: "Fill PDF Forms | PDFPilot",
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
      name: "Fill PDF Forms",
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
        { "@type": "ListItem", position: 3, name: "Fill PDF Forms", item: url },
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
      <PdfFormsTool />
      <Footer />
    </>
  );
}
