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
      "Layers, non-destructive adjustments, text, shapes, crop and transform tools, plus focused studios for screenshots, watermarks, passport photos, background removal, redaction, metadata and batch conversion. Everything runs on your device.",
    status: "active",
    category: "Media",
    version: "1.2.0",
    href: "/imagepilot",
    accent: "text-primary",
    highlights: ["Layer-based editing", "18 image operations", "Nine focused tools"],
    releaseNotes: [
      {
        version: "1.2.0",
        date: "2026-08-01",
        changes: [
          "Added the Background Remover with soft-edge matting, a refinement brush and colour or image backdrops",
          "Added the Object Blur Studio with face and licence-plate presets, pixelation, blur and solid blocks",
          "Added the Metadata Cleaner, which reports EXIF, GPS and camera data then removes it without recompressing",
          "Added the Batch Converter for JPG, PNG, WEBP, AVIF and BMP with resizing, renaming and ZIP download",
        ],
      },
      {
        version: "1.1.0",
        date: "2026-08-01",
        changes: [
          "Added the Screenshot Editor with annotation, blur and pixelation for redaction",
          "Added Watermark Studio with text or logo marks, tiling, corner presets and batch runs",
          "Added Passport Photo Studio with ten country specifications, head guides and print sheets",
          "Added the Image Compressor with quality, target-size search and batch compression",
          "Added a pixelate operation that irreversibly removes detail, unlike blur",
        ],
      },
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
    tagline: "One workspace for Word, Excel and PowerPoint",
    description:
      "A single Office workspace inside LaunchStack: write documents, build spreadsheets and assemble slide decks, then export to the standard Office formats. Everything runs in the browser with autosave and a shared template library.",
    status: "active",
    category: "Documents",
    version: "0.1.0",
    href: "/officepilot",
    accent: "text-primary",
    highlights: [
      "Word, Excel and PowerPoint in one workspace",
      "Autosave in the browser",
      "Shared template library",
    ],
    releaseNotes: [
      {
        version: "0.1.0",
        date: "2026-08-01",
        changes: [
          "Added the OfficePilot workspace shell with a shared toolbar, sidebar, properties panel and status bar",
          "Added the document engine with create, open, save, rename, duplicate and delete",
          "Added browser-first autosave with a server-side recent-documents mirror",
          "Added the template registry covering resume, invoice, letter, meeting notes, budget, planner, checklist and presentation",
        ],
      },
    ],
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
    tagline: "Financial calculators in your browser",
    description:
      "Run the financial calculators you reach for every day — EMI, SIP, compound interest, loans, budgets, expenses, savings goals, net worth, retirement, investment, multi-goal planning, a one-screen financial dashboard and a 0–100 financial health score — inside the LaunchStack workspace, with autosave, the same shared chrome as OfficePilot, and print-to-PDF export.",
    status: "active",
    category: "Finance",
    version: "0.5.0",
    href: "/financepilot",
    accent: "text-primary",
    highlights: [
      "13 calculators: EMI, SIP, compound interest, loan, budget, expense, savings, net worth, retirement, investment, goal, dashboard, health score",
      "Autosave and recent mirror",
      "Print-to-PDF export",
    ],
    releaseNotes: [
      {
        version: "0.5.0",
        date: "2026-08-03",
        changes: [
          "Financial Health Score: 0–100 weighted score across 6 categories (Emergency Fund, Debt Ratio, Savings Rate, Investment Ratio, Insurance Coverage, Goal Progress) with per-category verdicts and prioritised improvement suggestions",
          "Net Worth Tracker adds the spec asset categories (Cash, Savings, Investments, Property, Gold, Vehicles) and liability categories (Loans, Credit Cards, Mortgage) without removing the existing granular ones",
          "Goal Planner keeps the existing multi-goal surface and confirms every spec field (target amount, current savings, monthly contribution, expected return, target date) plus progress, remaining amount, remaining months and projected completion",
          "Dashboard integration adds the Health Score card, a recent-calculations list and a quick-actions row that links to every other calculator",
        ],
      },
      {
        version: "0.4.0",
        date: "2026-08-03",
        changes: [
          "Four investment & retirement modules: Retirement Planner, Investment Planner, Goal Planner, Financial Dashboard",
          "Reusable BarChart component shared by the goal planner's progress visualisation",
          "Retirement planner projects corpus, required corpus, inflation-adjusted corpus, monthly income, surplus / shortfall, on-track flag and a yearly chart",
          "Investment planner supports a risk profile, a custom return, an allocation list and a suggested monthly contribution",
          "Goal planner tracks multiple goals with priority, target date, monthly contribution, on-track flag, estimated completion and a multi-goal progress chart",
          "Financial dashboard surfaces total assets, total liabilities, net worth, monthly savings, savings rate, budget status, active goals, investment summary, KPI cards, history charts and quick insights",
        ],
      },
      {
        version: "0.3.0",
        date: "2026-08-02",
        changes: [
          "Four personal-finance modules: Budget Planner, Expense Tracker, Savings Planner, Net Worth Tracker",
          "Reusable line-item list editor and list workspace shared by every personal-finance module",
          "Expense tracker adds search, filter, sort, by-method breakdown and a daily spend chart",
          "Savings planner projects when the goal is met and reports progress, on-track flag and yearly chart",
          "Net worth tracker ships a 6-month historical timeline plus asset and liability category breakdowns",
        ],
      },
      {
        version: "0.2.0",
        date: "2026-08-02",
        changes: [
          "Four live calculators: EMI, SIP, compound interest, loan",
          "Reusable inputs, charts and schedule-table components shared by every calculator",
          "Print-to-PDF export via the browser's native print pipeline (matches OfficePilot's `printWordDocument` pattern)",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-08-01",
        changes: [
          "Reusable FinancePilot workspace shell with sidebar, recent calculations, autosave and search integration",
          "Shared calculation engine and per-calculator registry",
          "IndexedDB-backed storage and a server-side recent-calculations mirror",
        ],
      },
    ],
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
