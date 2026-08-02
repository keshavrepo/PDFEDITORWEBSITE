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
    tagline: "A professional developer workspace in your browser",
    description:
      "A developer workspace for every future DevPilot tool. Batch 1 ships the foundation: a reusable workspace shell with sessions, snippets and history that future developer tools (formatters, validators, encoders, generators) will plug into. Reuses the same LaunchStack platform that hosts OfficePilot, SocialPilot and FinancePilot: authentication, dashboard, storage, search, activity, settings, notifications and the shared file manager.",
    status: "active",
    category: "Developer",
    version: "0.1.0",
    href: "/devpilot",
    accent: "text-primary",
    highlights: [
      "Reusable developer workspace: left rail, tool switcher, header, properties, activity, autosave, keyboard shortcuts",
      "Workspace sessions: create, rename, duplicate, delete, favourite, recent and dashboard integration",
      "Developer snippets: categories, languages, search, favourite, duplicate and delete",
      "Developer history: per-tool recent and favourites, search and restore",
    ],
    releaseNotes: [
      {
        version: "0.1.0",
        date: "2026-08-02",
        changes: [
          "Added the DevPilot workspace shell: left navigation, tool switcher, workspace header, activity panel, properties panel, search, recent sessions, favourites, autosave and keyboard shortcuts — consistent with OfficePilot and SocialPilot",
          "Added workspace sessions as first-class projects: create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
          "Added developer snippets: save snippets with categories, languages, search, favourite, duplicate and delete",
          "Added developer history: per-tool recent and favourites with search and restore, mirroring the same pattern the rest of LaunchStack uses",
          "Added two new database tables: devSessions and devHistory, both keyed per user, mirroring the FinancePilot / SocialPilot recent-mirror pattern",
          "Added two new API endpoints: /api/devpilot/{sessions, history}, both rate-limited and origin-checked",
          "The default /devpilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
        ],
      },
    ],
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
    tagline: "A professional web workspace in your browser",
    description:
      "A web workspace for HTML, CSS and JavaScript with a live preview. Batch 1 ships the foundation: a reusable workspace shell that hosts a syntax-highlighted HTML editor, a CSS editor with variables and a color preview, a JavaScript editor with a console preview, and a live preview that combines all three into a working browser surface. Batch 2 adds the professional project workflow: Project Explorer, Asset Manager, Multi-file Workspace, Professional Search and Developer Utilities. Future web tools (SEO, metadata, asset generation) will reuse the same shell, the same autosave loop and the same platform infrastructure as every other LaunchStack product.",
    status: "active",
    category: "Web",
    version: "0.2.0",
    href: "/webpilot",
    accent: "text-primary",
    highlights: [
      "Project Explorer — folder tree, nested folders, create / rename / delete / duplicate, drag and drop, search, recent files and favourites",
      "Asset Manager — upload images, SVG, fonts, videos and icons, organise folders, preview, rename, delete and copy URL",
      "Multi-file Workspace — multiple tabs with an unsaved indicator, autosave, restore session, close and reopen tabs, split editor and quick switch",
      "Professional Search — find in current file or across the project, replace, replace all, regex, match case and whole word",
      "Developer Utilities — color picker, gradient generator, box shadow generator, border radius generator, CSS unit converter, HTML entity, base64 and URL codecs",
      "HTML, CSS, JavaScript editors and Live Preview from Batch 1, all still shipping in the same workspace",
    ],
    releaseNotes: [
      {
        version: "0.2.0",
        date: "2026-08-02",
        changes: [
          "Added the Project Explorer: folder tree with nested folders, create file / create folder, rename, delete, duplicate, drag and drop to reorganise, search, recent files, and pinned favourites",
          "Added the Asset Manager: upload images, SVG, fonts, videos and icons, organise folders, inline preview, rename, delete and copy the asset URL with one click",
          "Added the Multi-file Workspace: open every project file as a tab, unsaved indicator, autosave, restore previous session, close and reopen tabs, split the active editor into two side-by-side panes, quick switch between files with the keyboard",
          "Added Professional Search: find in the current file or across the project, replace and replace-all, regex, match case and whole word toggles, with a match list and a read-only preview pane",
          "Added Developer Utilities: color picker with palette and history, gradient generator for linear and radial gradients, box shadow generator with offset / blur / spread / colour / inset, border radius generator with per-corner control, CSS unit converter for px / rem / em / pt / vw / vh / %, HTML entity encoder / decoder, base64 encoder / decoder, and URL encoder / decoder",
          "Reused the existing WebPilot workspace shell, IndexedDB storage, autosave loop, search index, dashboard and recent-mirror for every new tool — no second workspace was created and no shared infrastructure was duplicated",
          "Added five new rail entries to the WebPilot session switcher: projects, assets, workspace, search and utilities",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-08-02",
        changes: [
          "Added the WebPilot workspace shell: left navigation, tool switcher, workspace header, activity panel, properties panel, search, recent sessions, favourites, autosave and keyboard shortcuts — consistent with OfficePilot, SocialPilot, FinancePilot and DevPilot",
          "Added the HTML editor: syntax highlighting, line numbers, auto-indentation, find and replace, undo and redo, format, minify and beautify, word wrap, import and export, with a Workspace Dashboard that surfaces recent and favourite sessions",
          "Added the CSS editor: syntax highlighting, property and value auto-complete, color preview swatches, variable usage detection, format, minify and beautify, import and export",
          "Added the JavaScript editor: syntax highlighting, identifier auto-complete, format, minify and beautify, an in-page console preview that captures console.log / console.warn / console.error output, import and export",
          "Added the Live Preview surface: combines the HTML, CSS and JavaScript bodies into a working browser surface with auto-refresh and a console output panel",
          "Added two new database tables: webSessions and webHistory, both keyed per user, mirroring the FinancePilot / SocialPilot / DevPilot recent-mirror pattern",
          "Added two new API endpoints: /api/webpilot/{sessions, history}, both rate-limited and origin-checked",
          "The default /webpilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
        ],
      },
    ],
  },
  {
    id: "socialpilot",
    name: "SocialPilot",
    tagline: "A professional creator workspace in your browser",
    description:
      "A creator workspace for every future SocialPilot tool. Batch 1 ships the foundation (workspace shell, project system, media library, brand kit). Batch 2 adds the core creator tools (Post Creator, Caption Manager, Hashtag Manager, Content Calendar, Notes). Batch 3 adds the professional creator workspace: Publishing Queue with five statuses, Platform Profiles for eight networks, Media Workspace with grid / list / multi-select / collections, multi-brand Brand Workspace with logos, colours, fonts, watermarks, templates, default hashtags and default captions, plus a Workspace Dashboard that surfaces every important surface in one place. The future scheduler and AI assistant will reuse the same shell, brand workspace, platform profiles and queue.",
    status: "active",
    category: "Media",
    version: "0.3.0",
    href: "/socialpilot",
    accent: "text-primary",
    highlights: [
      "Publishing Queue with five statuses, drag-and-drop, priority, bulk actions, filters and search",
      "Platform Profiles for Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Threads and Pinterest",
      "Media Workspace with grid / list, multi-select, drag-and-drop, favourites, tags and collections",
      "Multi-brand Brand Workspace with logos, colours, fonts, watermarks, templates, default hashtags and default captions",
      "Workspace Dashboard: recent projects, recent and favourite assets, favourite captions and hashtag groups, active brand and profile, queue summary",
    ],
    releaseNotes: [
      {
        version: "0.3.0",
        date: "2026-08-05",
        changes: [
          "Added the Publishing Queue: five statuses (draft, ready, scheduled, published, failed), drag-and-drop reordering and status moves, priority, bulk actions (mark / delete), status filters, search and a list of all items with date sort",
          "Added the Platform Profiles surface: store every Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Threads and Pinterest profile; default profile per platform; profile switching; the future scheduler will reuse this list",
          "Added the Media Workspace: grid and list views, multi-select, drag-and-drop into collections, favourites, tags, search, kind filter, details panel and the same upload / preview / delete pipeline as the existing media library",
          "Added the multi-brand Brand Workspace: multiple brands with logos, colours, fonts, watermarks, templates, default hashtags, default captions, default platform profile and an active-brand switcher persisted on the user row",
          "Added the Workspace Dashboard: a one-page summary of recent projects, recent assets, favourite assets, favourite captions, favourite hashtag groups, the active brand, the active platform profile and the publishing-queue summary by status",
          "Added four new database tables: socialBrandProfiles, socialPlatformProfiles, socialMediaCollections and socialUserState, all keyed per user",
          "Added four new API endpoints: /api/socialpilot/{brand-profiles, platform-profiles, media-collections, user-state}, all rate-limited and origin-checked",
          "The default /socialpilot landing now opens the Workspace Dashboard; the rail and the new-project menu link to every other tool",
        ],
      },
      {
        version: "0.2.0",
        date: "2026-08-04",
        changes: [
          "Added the Post Creator: plain / rich text, bold / italic / code / link / mention / hashtag marks, bullet / ordered / checklist lists, character counter, live preview, autosave, duplicate draft, media attachment and one-click insertion of saved captions and hashtag groups",
          "Added the Caption Manager: saved captions with categories, tags, search, favourite, duplicate and delete; one-click insertion into the Post Creator",
          "Added the Hashtag Manager: named hashtag groups with categories, search, favourite, duplicate and delete; one-click insertion of the whole group into the Post Creator",
          "Added the Content Calendar: monthly, weekly and daily views, platform filter, color labels, create / edit / delete / move plans, and a list of all plans with search",
          "Added Notes: rich text, plain text, optional checklist mode, tags, search and favourite, with the same autosave loop as the other tools",
          "Added a shared rich-text editor component reused by the Post Creator and Notes (dependency-free, content-editable-based)",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-08-02",
        changes: [
          "Added the SocialPilot workspace shell: left navigation, tool switcher, workspace header, activity panel, properties panel, search, recent projects, favourites, autosave and keyboard shortcuts",
          "Added the project system with create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
          "Added the media library for images, videos and audio with upload, organize, search, filter, preview and delete (reuses the existing upload infrastructure)",
          "Added the brand kit with logos, brand colours, fonts and default social profiles (reusable across every future tool)",
        ],
      },
    ],
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
    "LaunchStack is a growing suite of focused, privacy-first productivity products. PDFPilot, ImagePilot, OfficePilot, DevPilot, SocialPilot, FinancePilot and WebPilot are available today, with more modules on the way.",
} as const;
