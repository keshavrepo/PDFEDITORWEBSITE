/**
 * DevPilot session registry.
 *
 * The foundation ships with a list of session categories. Each future
 * session registers itself in the `sessions` array and gets picked up
 * by the workspace shell, the search index and the products page.
 *
 * Mirrors the SocialPilot `projects.ts` and FinancePilot
 * `calculators.ts` shape: a small typed array and a couple of lookup
 * helpers, so a reader who knows one product knows all of them.
 */

import type {
  DevSessionCategory,
  DevSessionDefinition,
  DevSessionKind,
} from "./types";

/** Session categories in the order they appear in the new-session menu. */
export const sessionCategoryOrder: DevSessionCategory[] = [
  "blank",
  "snippet",
  "history",
  "json",
  "jwt",
  "base64",
  "uuid",
  "hash",
  "url",
  "custom",
];

/** Human-readable label for a category. */
export const sessionCategoryLabels: Record<DevSessionCategory, string> = {
  blank: "Blank",
  snippet: "Snippet",
  history: "History",
  json: "JSON",
  jwt: "JWT",
  base64: "Base64",
  uuid: "UUID",
  hash: "Hash",
  url: "URL",
  custom: "Custom",
};

/** Short description for each category, used as the menu section header. */
export const sessionCategoryDescriptions: Record<DevSessionCategory, string> = {
  blank: "Start from an empty session",
  snippet: "Reusable code snippet with categories, languages and favourites",
  history: "Per-tool history with recent and favourites",
  json: "JSON formatter, minifier, validator, tree view and search",
  jwt: "JSON Web Token decoder with header, payload and expiry",
  base64: "Base64 encoder / decoder for text and files",
  uuid: "UUID v4 generator with bulk output",
  hash: "MD5, SHA-1, SHA-256 and SHA-512 for text and files",
  url: "URL encode, decode, parse and query parameters",
  custom: "Anything else you build",
};

/**
 * Registered sessions.
 *
 * The array is the single source of truth for which sessions the
 * workspace shell mounts, which sessions the products page lists, and
 * which sessions the search index surfaces. Adding a new session
 * means appending one descriptor here.
 *
 * Batch 1 ships the foundation: every session kind is a placeholder
 * with the right shape so the workspace shell and the navigation rail
 * show real entries out of the box. Future batches swap placeholders
 * for real editor surfaces.
 */
export const sessions: DevSessionDefinition[] = [
  {
    id: "dev-dashboard",
    kind: "dashboard",
    slug: "dashboard",
    name: "Workspace dashboard",
    tagline: "A one-page summary of your DevPilot workspace",
    description:
      "The Workspace Dashboard surfaces every important surface in one place: recent sessions, recent and favourite history, the active snippet library, the per-tool history summary, and quick links to every other DevPilot surface. The dashboard is the default landing surface for every DevPilot session.",
    intro:
      "Open the Workspace Dashboard to see every DevPilot surface in one place. The dashboard reads from the same IndexedDB-backed store the rest of the workspace uses, so the data is always in sync.",
    defaultCategory: "blank",
    keywords: ["dashboard", "summary", "DevPilot"],
    highlights: [
      "Recent sessions",
      "Recent and favourite history",
      "Snippet library summary",
      "Quick links to every surface",
    ],
    toolCount: 1,
  },
  {
    id: "dev-blank",
    kind: "blank",
    slug: "",
    name: "Blank session",
    tagline: "Start from an empty canvas",
    description:
      "An empty DevPilot session ready for any future tool. The workspace saves automatically, mirrors to the server, and lets you organise the session with tags and favourites.",
    intro:
      "Create a blank DevPilot session. The workspace will hold the body, save it automatically, and surface it on the dashboard. Future tools (formatter, validator, encoder, generator) will replace this blank with their own surface.",
    defaultCategory: "blank",
    keywords: ["blank", "session", "DevPilot"],
    highlights: ["Empty body", "Autosaves", "Mirrored to the dashboard"],
    toolCount: 1,
  },
  {
    id: "dev-snippet",
    kind: "snippet",
    slug: "snippets",
    name: "Developer snippets",
    tagline: "Reusable snippets with categories, languages and favourites",
    description:
      "Save the snippets you reach for every day. Group them by category, tag them by language, search across the library, favourite the ones you reuse, duplicate a snippet to branch from it, and find any snippet in seconds.",
    intro:
      "The Developer Snippets surface holds the snippets you reuse. Create a new snippet from the new-session menu, give it a category, a language, and find it from the search. The autosave loop keeps the library up to date.",
    defaultCategory: "snippet",
    keywords: ["snippet", "developer", "code", "DevPilot"],
    highlights: [
      "Categories and languages",
      "Search",
      "Favourite",
      "Duplicate and delete",
    ],
    toolCount: 1,
  },
  {
    id: "dev-history",
    kind: "history",
    slug: "history",
    name: "Developer history",
    tagline: "Per-tool recent and favourites, search and restore",
    description:
      "Maintain a history for every tool. Recent entries appear on the dashboard and the rail; favourites are pinned; search finds any entry in seconds. Restore an entry back to its source surface with one click.",
    intro:
      "The Developer History surface holds the recent and favourite entries every tool records. Switch the tool filter to focus on one tool at a time, search across the full history, and restore any entry to its source surface. The autosave loop keeps the history in sync.",
    defaultCategory: "history",
    keywords: ["history", "recent", "favourites", "DevPilot"],
    highlights: [
      "Per-tool recent and favourites",
      "Search",
      "Restore",
      "Favourite toggle",
    ],
    toolCount: 1,
  },
  {
    id: "dev-json",
    kind: "json",
    slug: "json",
    name: "JSON workspace",
    tagline: "Format, minify, validate, browse, search, copy and download",
    description:
      "A professional JSON editor that runs entirely in the browser. Format with configurable indent, minify, validate against the JSON spec, browse a tree view, search by value, copy the result and download the file. Upload a JSON file to start.",
    intro:
      "Open the JSON workspace to format, minify and validate JSON in your browser. The tree view lets you explore nested objects; search finds any value by key or content; copy and download the result. Autosave mirrors the body to IndexedDB so closing the tab does not lose your work.",
    defaultCategory: "json",
    keywords: ["json", "format", "minify", "validate", "tree", "DevPilot"],
    highlights: [
      "Format with configurable indent",
      "Minify",
      "Validate with parser errors",
      "Tree view with collapsible nodes",
      "Search by value or key",
      "Copy and download",
    ],
    toolCount: 1,
  },
  {
    id: "dev-jwt",
    kind: "jwt",
    slug: "jwt",
    name: "JWT workspace",
    tagline: "Decode the three segments, inspect claims, check expiry",
    description:
      "Decode any JSON Web Token. The workspace splits the token into its three segments, shows the header and payload as pretty JSON, displays the signature, and surfaces the standard expiry, issued-at and not-before claims. No signing, no verification.",
    intro:
      "Open the JWT workspace to decode any JSON Web Token. The tool never signs or verifies — it just decodes what you paste and reads the standard time-based claims. Useful for inspecting tokens during development.",
    defaultCategory: "jwt",
    keywords: ["jwt", "json web token", "decode", "header", "payload", "expiry", "DevPilot"],
    highlights: [
      "Decode header and payload",
      "Pretty view for both segments",
      "Expiry information from the standard `exp` claim",
      "Issued-at and not-before context",
      "Copy any segment",
    ],
    toolCount: 1,
  },
  {
    id: "dev-base64",
    kind: "base64",
    slug: "base64",
    name: "Base64 workspace",
    tagline: "Encode and decode text and files to and from base64",
    description:
      "Encode any text to base64, or decode base64 back to text. Switch the input mode to upload a file and the tool encodes the file binary to base64, or decodes a base64 string back to the original file. Copy the result or download it.",
    intro:
      "Open the Base64 workspace to encode and decode base64. Switch between text and file inputs; copy the result or download the decoded file. The tool runs entirely in the browser, so the data never leaves the device.",
    defaultCategory: "base64",
    keywords: ["base64", "encode", "decode", "text", "file", "DevPilot"],
    highlights: [
      "Encode text to base64",
      "Decode base64 to text or file",
      "File upload for binary input",
      "Copy and download",
    ],
    toolCount: 1,
  },
  {
    id: "dev-uuid",
    kind: "uuid",
    slug: "uuid",
    name: "UUID workspace",
    tagline: "Generate RFC 4122 v4 UUIDs in any batch size",
    description:
      "Generate v4 UUIDs one at a time or in bulk. Pick a count, generate, and copy individual UUIDs or the whole batch. Download the batch as a text file. The generator uses the browser's secure random source.",
    intro:
      "Open the UUID workspace to generate RFC 4122 v4 UUIDs. Pick a count, generate, and copy the batch or individual UUIDs. Download the batch when you need to ship a list.",
    defaultCategory: "uuid",
    keywords: ["uuid", "guid", "v4", "generate", "DevPilot"],
    highlights: [
      "RFC 4122 v4 generation",
      "Bulk output (1-200)",
      "Copy individual or full batch",
      "Download as text",
    ],
    toolCount: 1,
  },
  {
    id: "dev-hash",
    kind: "hash",
    slug: "hash",
    name: "Hash workspace",
    tagline: "MD5, SHA-1, SHA-256 and SHA-512 for text and files",
    description:
      "Hash text or files with MD5, SHA-1, SHA-256 and SHA-512. The tool computes all four algorithms at once, lets you copy any individual digest, and downloads the full report. SHA-2 algorithms use the browser's SubtleCrypto; MD5 and SHA-1 use a built-in reference implementation.",
    intro:
      "Open the Hash workspace to compute MD5, SHA-1, SHA-256 and SHA-512 for any text or file. The tool runs entirely in the browser. Copy a single digest or download the full report.",
    defaultCategory: "hash",
    keywords: ["md5", "sha1", "sha256", "sha512", "hash", "checksum", "DevPilot"],
    highlights: [
      "All four algorithms at once",
      "Text and file input",
      "Copy any digest",
      "Download the full report",
    ],
    toolCount: 1,
  },
  {
    id: "dev-url",
    kind: "url",
    slug: "url",
    name: "URL workspace",
    tagline: "Encode, decode and parse URLs",
    description:
      "Encode the whole URL or any component, decode encoded URLs, and parse a URL into its protocol, host, path, query and hash. The query-parameter viewer lists every parameter with its value and lets you copy the reconstructed query string.",
    intro:
      "Open the URL workspace to encode, decode and parse URLs. Switch the direction, paste a URL, and the tool shows the encoded or decoded form, the parsed components and the query parameters.",
    defaultCategory: "url",
    keywords: ["url", "encode", "decode", "parse", "query", "DevPilot"],
    highlights: [
      "Encode / decode the full URL or components",
      "Parse into protocol, host, path, query and hash",
      "Query parameters viewer",
      "Copy any output",
    ],
    toolCount: 1,
  },
];

export function getSession(
  kind: DevSessionKind
): DevSessionDefinition | undefined {
  return sessions.find((session) => session.kind === kind);
}

export function getSessionBySlug(
  slug: string
): DevSessionDefinition | undefined {
  return sessions.find((session) => session.slug === slug);
}

/** Sessions that are not the default landing session, used in directory listings. */
export const focusedSessions = sessions.filter((session) => session.slug !== "");

/** Route for a session, e.g. `/devpilot/snippets`. */
export function sessionHref(session: DevSessionDefinition): string {
  return session.slug ? `/devpilot/${session.slug}` : "/devpilot";
}

/** Sessions for the directory, sorted by their category order. */
export function sessionsForCategory(
  category: DevSessionCategory
): DevSessionDefinition[] {
  return sessions.filter((session) => session.defaultCategory === category);
}
