/**
 * LaunchStack product registry.
 *
 * LaunchStack is the parent platform; each product is a module that plugs into
 * it. PDFPilot is the first live product, and the entries below drive the
 * homepage, the products page, the footer and product metadata so a future
 * launch only needs its status flipped here.
 */

export type ProductStatus = "active" | "coming-soon";

export type ProductCategory =
  | "Documents"
  | "Media"
  | "Developer"
  | "Web"
  | "Finance"
  | "AI";

/** A dated entry in a product's changelog. */
export interface ReleaseNote {
  /** Semantic version this note describes. */
  version: string;
  /** ISO date, rendered in the user's locale. */
  date: string;
  /** What shipped, written for users rather than as commit messages. */
  changes: string[];
}

export interface Product {
  id: string;
  name: string;
  /** Short tagline used on cards. */
  tagline: string;
  description: string;
  status: ProductStatus;
  category: ProductCategory;
  /** Current version. Only meaningful once a product is active. */
  version: string;
  /** Landing route. Only set for products that are live. */
  href?: string;
  /** Tailwind accent classes, kept inside the existing palette. */
  accent: string;
  /** Representative capabilities shown on the product card. */
  highlights: string[];
  /** Newest first. Empty until a product ships. */
  releaseNotes: ReleaseNote[];
}

export const products: Product[] = [
  {
    id: "pdfpilot",
    name: "PDFPilot",
    tagline: "Private, browser-first PDF tools",
    description:
      "Convert, organise, optimise, edit and secure PDFs without uploading them. Twenty-seven tools covering Word, Excel, PowerPoint, images, OCR, forms, redaction and archival PDF/A.",
    status: "active",
    category: "Documents",
    version: "1.4.0",
    href: "/tools",
    accent: "text-primary",
    highlights: ["27 tools", "Runs in your browser", "No file uploads"],
    releaseNotes: [
      {
        version: "1.4.0",
        date: "2026-07-31",
        changes: [
          "Added OCR for scanned PDFs with searchable output in five languages",
          "Added Scan to PDF with edge detection, auto-crop and auto-rotate",
          "Added Compare PDF with page alignment and word-level differences",
          "Added PDF/A conversion with validation before export",
        ],
      },
      {
        version: "1.3.0",
        date: "2026-07-31",
        changes: [
          "Added fillable form detection and completion",
          "Added page numbering with header and footer placement",
          "Added cropping with a live preview and white-margin removal",
          "Added permanent redaction that removes text from the file itself",
        ],
      },
      {
        version: "1.2.0",
        date: "2026-07-31",
        changes: [
          "Added PDF to Excel and Excel to PDF, including legacy .xls",
          "Added PDF to JPG or PNG with selectable resolution",
          "Added JPG or PNG to PDF with reordering and layout options",
        ],
      },
      {
        version: "1.1.0",
        date: "2026-07-31",
        changes: [
          "Detect unreadable PDFs and report when OCR is required",
          "Added a pluggable conversion engine architecture",
        ],
      },
      {
        version: "1.0.0",
        date: "2026-07-31",
        changes: [
          "Added PDF to Word, Word to PDF, PDF to PowerPoint and PowerPoint to PDF",
        ],
      },
    ],
  },
  {
    id: "imagepilot",
    name: "ImagePilot",
    tagline: "A professional image editor in your browser",
    description:
      "Layers, non-destructive adjustments, text, shapes, crop and transform tools, with undo history and PNG, JPG, WEBP and SVG export. Everything runs on your device.",
    status: "active",
    category: "Media",
    version: "1.0.0",
    href: "/imagepilot",
    accent: "text-primary",
    highlights: ["Layer-based editing", "17 image operations", "Runs in your browser"],
    releaseNotes: [
      {
        version: "1.0.0",
        date: "2026-07-31",
        changes: [
          "Added the ImagePilot editor with layers, undo history and a full transform toolset",
          "Added seventeen non-destructive image operations covering light, colour, detail and stylising",
          "Added editable text layers with stroke, shadow, tracking and alignment",
          "Added six shape tools with fill, stroke and rounded corners",
          "Added PNG, JPG, WEBP and SVG export, clipboard support and drag-and-drop import",
        ],
      },
    ],
  },
  {
    id: "devpilot",
    name: "DevPilot",
    tagline: "Everyday developer utilities",
    description:
      "Formatters, validators, encoders and generators for the tasks developers reach for a dozen times a day.",
    status: "coming-soon",
    category: "Developer",
    version: "0.0.0",
    accent: "text-muted-foreground",
    highlights: ["JSON and YAML tools", "Encoding helpers", "Diff and validate"],
    releaseNotes: [],
  },
  {
    id: "officepilot",
    name: "OfficePilot",
    tagline: "Documents, sheets and slides",
    description:
      "Create and transform Word, Excel and PowerPoint files directly in the browser, building on the OOXML engine behind PDFPilot.",
    status: "coming-soon",
    category: "Documents",
    version: "0.0.0",
    accent: "text-muted-foreground",
    highlights: ["Office formats", "Templates", "Batch processing"],
    releaseNotes: [],
  },
  {
    id: "webpilot",
    name: "WebPilot",
    tagline: "Site and SEO tooling",
    description:
      "Audit performance, inspect metadata and generate the assets a site needs before it ships.",
    status: "coming-soon",
    category: "Web",
    version: "0.0.0",
    accent: "text-muted-foreground",
    highlights: ["SEO audits", "Metadata tools", "Asset generation"],
    releaseNotes: [],
  },
  {
    id: "financepilot",
    name: "FinancePilot",
    tagline: "Invoices and financial documents",
    description:
      "Generate invoices, reconcile statements and extract structured data from financial paperwork.",
    status: "coming-soon",
    category: "Finance",
    version: "0.0.0",
    accent: "text-muted-foreground",
    highlights: ["Invoice builder", "Statement parsing", "Exports"],
    releaseNotes: [],
  },
  {
    id: "aipilot",
    name: "AIPilot",
    tagline: "AI assistance across your documents",
    description:
      "Summarise, translate and question your documents, with on-device processing wherever the model allows.",
    status: "coming-soon",
    category: "AI",
    version: "0.0.0",
    accent: "text-muted-foreground",
    highlights: ["Summaries", "Translation", "Document Q&A"],
    releaseNotes: [],
  },
];

export const activeProducts = products.filter((product) => product.status === "active");
export const upcomingProducts = products.filter((product) => product.status === "coming-soon");

export function getProduct(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

/** Every category that has at least one product, in registry order. */
export function productCategories(): ProductCategory[] {
  return [...new Set(products.map((product) => product.category))];
}

/** Platform-level identity, distinct from the per-product branding. */
export const platform = {
  name: "LaunchStack",
  tagline: "One platform. Every tool you need.",
  description:
    "LaunchStack is a growing suite of focused, privacy-first productivity products. PDFPilot is available today, with more modules on the way.",
} as const;
