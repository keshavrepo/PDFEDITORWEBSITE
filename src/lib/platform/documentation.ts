/**
 * Documentation registry.
 *
 * Sections are declared here so they can be rendered on the documentation page
 * and indexed by global search from a single source. Long-form articles live
 * in the blog CMS; the documentation page pulls those in by category so
 * writing a guide never requires a code change.
 */

export interface DocumentationSection {
  /** Anchor id, also used for deep links from search results. */
  id: string;
  title: string;
  summary: string;
  /** Extra terms that should match this section in search. */
  keywords: string[];
  items: Array<{ label: string; description: string; href?: string }>;
}

export const documentationSections: DocumentationSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    summary:
      "Create a LaunchStack account, open a product and run your first task. One account works across every product on the platform.",
    keywords: ["account", "sign up", "register", "first steps", "onboarding", "launchstack"],
    items: [
      {
        label: "Create an account",
        description:
          "Sign up with an email address or Google. The same account carries across every product as new modules launch.",
        href: "/register",
      },
      {
        label: "Open a product",
        description:
          "Browse the product directory to see what is available today and what is in development.",
        href: "/products",
      },
      {
        label: "Run your first task",
        description:
          "PDFPilot is live now. Choose a tool, select a file and download the result — nothing is uploaded to run it.",
        href: "/tools",
      },
    ],
  },
  {
    id: "pdfpilot",
    title: "Using PDFPilot",
    summary:
      "Convert, organise, optimise, edit and secure PDFs entirely in your browser, including OCR, forms, redaction and PDF/A.",
    keywords: ["pdf", "convert", "merge", "compress", "ocr", "redact", "forms", "tools"],
    items: [
      {
        label: "Choose a tool",
        description:
          "Open the tool directory and pick an operation. Each tool explains what it preserves and what it cannot.",
        href: "/tools",
      },
      {
        label: "Work with scanned documents",
        description:
          "Scanned pages have no text layer. Run OCR first to make them searchable, then use any other tool on the result.",
        href: "/tools/ocr-pdf",
      },
      {
        label: "Remove sensitive content",
        description:
          "Redaction deletes the text from the file itself rather than drawing a box over it, so it cannot be copied out.",
        href: "/tools/redact-pdf",
      },
      {
        label: "Archive a document",
        description:
          "PDF/A conversion validates the file first and reports anything it cannot make conformant before exporting.",
        href: "/tools/pdfa-converter",
      },
    ],
  },
  {
    id: "imagepilot",
    title: "Using ImagePilot",
    summary:
      "Edit images with layers, non-destructive adjustments, text and shapes, then export to PNG, JPG, WEBP or SVG — all in the browser.",
    keywords: [
      "image",
      "photo",
      "editor",
      "layers",
      "crop",
      "resize",
      "rotate",
      "brightness",
      "contrast",
      "text",
      "shapes",
      "png",
      "jpg",
      "webp",
      "svg",
    ],
    items: [
      {
        label: "Open the editor",
        description:
          "Drop an image onto the canvas, paste one from the clipboard, or start from a blank canvas preset.",
        href: "/imagepilot",
      },
      {
        label: "Work in layers",
        description:
          "Every image, text block and shape is its own layer. Reorder, lock, hide, duplicate and blend them independently.",
        href: "/imagepilot",
      },
      {
        label: "Adjust without losing quality",
        description:
          "Adjustments are stored on the layer rather than baked into the pixels, so any slider can be returned to neutral at any point.",
        href: "/imagepilot",
      },
      {
        label: "Export",
        description:
          "PNG and WEBP keep transparency, JPG flattens onto a matte, and SVG keeps shapes and text as real vectors.",
        href: "/imagepilot",
      },
    ],
  },
  {
    id: "files",
    title: "Files and storage",
    summary:
      "Every product writes to one shared file history. Rename, favourite, download, search and filter files from a single place.",
    keywords: ["files", "file manager", "storage", "download", "rename", "favorite", "history"],
    items: [
      {
        label: "Open the file manager",
        description:
          "The file manager lists everything you have processed, across every product, with search and per-product filters.",
        href: "/files",
      },
      {
        label: "Favourites",
        description:
          "Star a file to pin it to the top of the manager and surface it on your dashboard.",
      },
      {
        label: "Deleting files",
        description:
          "Deleting removes a file from the manager. Related processing history is kept so your activity timeline stays accurate.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and security",
    summary:
      "Supported operations run in browser memory, so document bytes do not need to be uploaded just to complete a task.",
    keywords: ["privacy", "security", "local", "browser", "encryption", "data"],
    items: [
      {
        label: "Local processing",
        description:
          "Browser-supported operations execute on your device. Keep the tab open until processing and download finish.",
      },
      {
        label: "Account security",
        description:
          "Sessions are signed, passwords are hashed, and account activity is recorded in your timeline.",
        href: "/security",
      },
      {
        label: "Your data",
        description:
          "Read what is stored, for how long, and how to remove it.",
        href: "/privacy",
      },
    ],
  },
  {
    id: "account",
    title: "Account and billing",
    summary:
      "Manage your profile, password, theme and notification preferences, and review your plan.",
    keywords: ["settings", "profile", "password", "billing", "plan", "subscription", "theme"],
    items: [
      {
        label: "Settings",
        description:
          "Update your name, avatar, password, theme and notification preferences.",
        href: "/settings",
      },
      {
        label: "Notifications",
        description:
          "Choose which events reach your notification centre. Preferences apply across every product.",
        href: "/settings",
      },
      {
        label: "Plans",
        description: "Compare what is included on each plan.",
        href: "/pricing",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary:
      "What to check when a file will not open, a tool reports an error, or a download is blocked.",
    keywords: ["error", "problem", "broken", "failed", "help", "support", "troubleshoot"],
    items: [
      {
        label: "A file will not open",
        description:
          "Confirm the file is valid and below the displayed size limit. Unlock encrypted PDFs before using tools that read page content.",
      },
      {
        label: "A conversion produced unreadable text",
        description:
          "Some documents use legacy fonts that store glyph codes rather than characters. PDFPilot detects this and reports that OCR is required instead of producing a broken file.",
      },
      {
        label: "Still stuck",
        description: "Send us the details and we will take a look.",
        href: "/contact",
      },
    ],
  },
];

/**
 * Blog category treated as long-form documentation.
 * Articles filed here appear on the documentation page automatically.
 */
export const DOCUMENTATION_CATEGORY = "Documentation";
