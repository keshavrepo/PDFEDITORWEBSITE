import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { RedactPdfTool } from "@/components/pdfpilot/redact-pdf-tool";
import { getAppUrl } from "@/lib/env";

const description =
  "Permanently remove sensitive text from a PDF. Redacted content is deleted from the file rather than hidden, and document metadata is stripped as well.";
const url = `${getAppUrl()}/tools/redact-pdf`;

export const metadata: Metadata = {
  title: "Redact PDF | PDFPilot",
  description,
  keywords: ["redact PDF", "remove sensitive text PDF", "black out PDF", "PDF redaction"],
  alternates: { canonical: url },
  openGraph: {
    title: "Redact PDF | PDFPilot",
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
      name: "Redact PDF",
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
        { "@type": "ListItem", position: 3, name: "Redact PDF", item: url },
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
      <RedactPdfTool />
      <Footer />
    </>
  );
}
