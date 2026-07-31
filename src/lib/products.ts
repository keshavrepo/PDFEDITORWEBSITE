/**
 * LaunchStack product registry.
 *
 * LaunchStack is the parent platform; each product is a module that plugs into
 * it. PDFPilot is the first live product, and the entries below drive the
 * homepage, the products page, the footer and product metadata so a future
 * launch only needs its status flipped here.
 */

export type ProductStatus = "active" | "coming-soon";

export interface Product {
  id: string;
  name: string;
  /** Short tagline used on cards. */
  tagline: string;
  description: string;
  status: ProductStatus;
  /** Landing route. Only set for products that are live. */
  href?: string;
  /** Tailwind accent classes, kept inside the existing palette. */
  accent: string;
  /** Representative capabilities shown on the product card. */
  highlights: string[];
}

export const products: Product[] = [
  {
    id: "pdfpilot",
    name: "PDFPilot",
    tagline: "Private, browser-first PDF tools",
    description:
      "Convert, organise, optimise, edit and secure PDFs without uploading them. Twenty-eight tools covering Word, Excel, PowerPoint, images, OCR, forms, redaction and archival PDF/A.",
    status: "active",
    href: "/tools",
    accent: "text-primary",
    highlights: ["28 tools", "Runs in your browser", "No file uploads"],
  },
  {
    id: "imagepilot",
    name: "ImagePilot",
    tagline: "Image editing and optimisation",
    description:
      "Resize, convert, compress and clean up images in bulk, with the same privacy-first browser processing as PDFPilot.",
    status: "coming-soon",
    accent: "text-muted-foreground",
    highlights: ["Bulk conversion", "Smart compression", "Background removal"],
  },
  {
    id: "devpilot",
    name: "DevPilot",
    tagline: "Everyday developer utilities",
    description:
      "Formatters, validators, encoders and generators for the tasks developers reach for a dozen times a day.",
    status: "coming-soon",
    accent: "text-muted-foreground",
    highlights: ["JSON and YAML tools", "Encoding helpers", "Diff and validate"],
  },
  {
    id: "officepilot",
    name: "OfficePilot",
    tagline: "Documents, sheets and slides",
    description:
      "Create and transform Word, Excel and PowerPoint files directly in the browser, building on the OOXML engine behind PDFPilot.",
    status: "coming-soon",
    accent: "text-muted-foreground",
    highlights: ["Office formats", "Templates", "Batch processing"],
  },
  {
    id: "webpilot",
    name: "WebPilot",
    tagline: "Site and SEO tooling",
    description:
      "Audit performance, inspect metadata and generate the assets a site needs before it ships.",
    status: "coming-soon",
    accent: "text-muted-foreground",
    highlights: ["SEO audits", "Metadata tools", "Asset generation"],
  },
  {
    id: "financepilot",
    name: "FinancePilot",
    tagline: "Invoices and financial documents",
    description:
      "Generate invoices, reconcile statements and extract structured data from financial paperwork.",
    status: "coming-soon",
    accent: "text-muted-foreground",
    highlights: ["Invoice builder", "Statement parsing", "Exports"],
  },
  {
    id: "aipilot",
    name: "AIPilot",
    tagline: "AI assistance across your documents",
    description:
      "Summarise, translate and question your documents, with on-device processing wherever the model allows.",
    status: "coming-soon",
    accent: "text-muted-foreground",
    highlights: ["Summaries", "Translation", "Document Q&A"],
  },
];

export const activeProducts = products.filter((product) => product.status === "active");
export const upcomingProducts = products.filter((product) => product.status === "coming-soon");

export function getProduct(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

/** Platform-level identity, distinct from the per-product branding. */
export const platform = {
  name: "LaunchStack",
  tagline: "One platform. Every tool you need.",
  description:
    "LaunchStack is a growing suite of focused, privacy-first productivity products. PDFPilot is available today, with more modules on the way.",
} as const;
