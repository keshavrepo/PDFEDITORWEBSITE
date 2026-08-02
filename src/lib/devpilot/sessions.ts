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
  "api",
  "regex",
  "diff",
  "sql",
  "html",
  "css",
  "javascript",
  "cron",
  "timestamp",
  "xml",
  "yaml",
  "qr",
  "color",
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
  api: "API",
  regex: "Regex",
  diff: "Diff",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  cron: "Cron",
  timestamp: "Timestamp",
  xml: "XML",
  yaml: "YAML",
  qr: "QR",
  color: "Color",
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
  api: "API client with method, headers, query, body, response, history and collections",
  regex: "Live regex testing with groups, replace preview and common patterns",
  diff: "Text and JSON diff in side-by-side or inline view",
  sql: "SQL formatter, beautifier, minifier and keyword highlighting",
  html: "HTML formatter, beautifier and minifier",
  css: "CSS formatter, beautifier and minifier",
  javascript: "JavaScript formatter, beautifier and minifier",
  cron: "Visual cron expression builder with human-readable output",
  timestamp: "Convert between Unix timestamps, ISO 8601 and local time",
  xml: "XML beautifier, minifier and validator",
  yaml: "YAML beautifier, minifier and validator",
  qr: "QR code generator with PNG and SVG export",
  color: "HEX, RGB, HSL and HSV converter with a generated palette",
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
  {
    id: "dev-api",
    kind: "api",
    slug: "api",
    name: "API client",
    tagline: "GET, POST, PUT, PATCH and DELETE with full request and response inspection",
    description:
      "A professional API testing workspace. Build a request with method, URL, headers, query parameters and a JSON or text body, send it from the browser, and inspect the status, response headers, response body, response size and elapsed time. Every response lands in the per-session history; pin favourites, group into collections and search the history.",
    intro:
      "Open the API client to send a request from the browser. Choose a method, paste the URL, attach headers and query parameters, write a body, and press Send. The response, status, headers, size and elapsed time land in the right rail, and every call is stored in the per-session history.",
    defaultCategory: "api",
    keywords: ["api", "http", "request", "response", "headers", "query", "body", "DevPilot"],
    highlights: [
      "GET, POST, PUT, PATCH and DELETE",
      "Headers and query parameters",
      "Request body with content type",
      "JSON viewer for the response",
      "Response time, status, headers and size",
      "Request history with collections and favourites",
    ],
    toolCount: 1,
  },
  {
    id: "dev-regex",
    kind: "regex",
    slug: "regex",
    name: "Regex lab",
    tagline: "Live regex testing with groups, replace preview and a common-patterns library",
    description:
      "Type a pattern, choose flags, paste text, and see every match highlight in place. The Groups panel surfaces every capture group; the Replace tab shows what the result would be. The common-patterns library covers email, URL, IPv4, ISO date, time, hex colour, semver and slug patterns.",
    intro:
      "Open the Regex lab to test a regular expression against any text. Pick a flag, type or paste a pattern, and see the matches, the capture groups and a replace preview in real time.",
    defaultCategory: "regex",
    keywords: ["regex", "regexp", "pattern", "match", "groups", "replace", "DevPilot"],
    highlights: [
      "Live match results",
      "Capture groups",
      "Replace preview",
      "Flags (g, i, m, s, u, y)",
      "Common-patterns library",
    ],
    toolCount: 1,
  },
  {
    id: "dev-diff",
    kind: "diff",
    slug: "diff",
    name: "Diff viewer",
    tagline: "Text and JSON diff in side-by-side or inline view",
    description:
      "Paste two text blocks or two JSON payloads and see a line-level diff. Switch the algorithm to JSON to re-parse the inputs before comparing so re-ordered keys and whitespace changes don't generate noise. Switch the layout to side-by-side or inline.",
    intro:
      "Open the Diff viewer to compare two text or JSON blocks. The tool computes a line-level diff using a Longest Common Subsequence algorithm; toggle JSON mode to canonicalise the inputs first, and switch the layout to side-by-side or inline.",
    defaultCategory: "diff",
    keywords: ["diff", "compare", "text", "json", "side by side", "inline", "DevPilot"],
    highlights: [
      "Text and JSON diff",
      "Side-by-side and inline layouts",
      "Line-level highlight",
    ],
    toolCount: 1,
  },
  {
    id: "dev-sql",
    kind: "sql",
    slug: "sql",
    name: "SQL workspace",
    tagline: "Format, beautify, minify and keyword-highlight SQL",
    description:
      "Format SQL with a configurable indent, optionally upper-case the keywords, minify, and inspect the keyword-highlighted view. The formatter is dependency-free and handles every common clause: SELECT / FROM / WHERE / GROUP BY / ORDER BY / JOIN / INSERT / UPDATE / DELETE / CREATE / DROP / ALTER / TRANSACTION.",
    intro:
      "Open the SQL workspace to format, beautify or minify a SQL string. The keyword-highlighted view helps you spot clauses at a glance.",
    defaultCategory: "sql",
    keywords: ["sql", "format", "beautify", "minify", "highlight", "DevPilot"],
    highlights: [
      "Format with configurable indent",
      "Beautify with upper-case keywords",
      "Minify",
      "Keyword highlighting",
    ],
    toolCount: 1,
  },
  {
    id: "dev-html",
    kind: "html",
    slug: "html",
    name: "HTML workspace",
    tagline: "Format, beautify and minify HTML",
    description:
      "Format HTML with a configurable indent, beautify, or minify. The formatter understands the HTML void-element list and respects the existing element nesting.",
    intro:
      "Open the HTML workspace to format, beautify or minify an HTML document. The minifier drops comments and collapses whitespace between tags.",
    defaultCategory: "html",
    keywords: ["html", "format", "beautify", "minify", "DevPilot"],
    highlights: [
      "Format with configurable indent",
      "Beautify",
      "Minify",
    ],
    toolCount: 1,
  },
  {
    id: "dev-css",
    kind: "css",
    slug: "css",
    name: "CSS workspace",
    tagline: "Format, beautify and minify CSS",
    description:
      "Format CSS with a configurable indent, beautify, or minify. The minifier drops comments and removes redundant whitespace between rules and declarations.",
    intro:
      "Open the CSS workspace to format, beautify or minify a stylesheet.",
    defaultCategory: "css",
    keywords: ["css", "format", "beautify", "minify", "DevPilot"],
    highlights: [
      "Format with configurable indent",
      "Beautify",
      "Minify",
    ],
    toolCount: 1,
  },
  {
    id: "dev-js",
    kind: "javascript",
    slug: "javascript",
    name: "JavaScript workspace",
    tagline: "Format, beautify, minify and keyword-highlight JavaScript",
    description:
      "Format JavaScript with a configurable indent, beautify, minify, or inspect the keyword-highlighted view. The minifier understands string, template, regex, line- and block-comment contexts so it never strips a string that looks like a comment.",
    intro:
      "Open the JavaScript workspace to format, beautify or minify a script. The keyword-highlighted view highlights the standard reserved words and language literals.",
    defaultCategory: "javascript",
    keywords: ["javascript", "js", "format", "beautify", "minify", "highlight", "DevPilot"],
    highlights: [
      "Format with configurable indent",
      "Beautify",
      "Minify",
      "Keyword highlighting",
    ],
    toolCount: 1,
  },
  {
    id: "dev-cron",
    kind: "cron",
    slug: "cron",
    name: "Cron builder",
    tagline: "Visual builder for a five-field cron expression",
    description:
      "Pick the minute, hour, day of month, month and day of week the schedule should run on. The tool renders the standard cron expression and a human-readable description such as \"At 09:30 every Monday\". Copy the expression, save it to the session, and reuse it from any future tool.",
    intro:
      "Open the Cron builder to assemble a cron expression without memorising the field ranges. The tool renders the expression and a human-readable description and lets you copy and save the result.",
    defaultCategory: "cron",
    keywords: ["cron", "schedule", "expression", "builder", "DevPilot"],
    highlights: [
      "Visual five-field builder",
      "Human-readable description",
      "Copy the expression",
      "Save the expression with the session",
    ],
    toolCount: 1,
  },
  {
    id: "dev-timestamp",
    kind: "timestamp",
    slug: "timestamp",
    name: "Timestamp workspace",
    tagline: "Convert between Unix, ISO 8601, UTC and local time",
    description:
      "Paste a Unix timestamp or an ISO 8601 string and the tool returns the other form plus the UTC and local-time representations and a relative-time string. Switch the direction to convert in either way. Seconds and milliseconds are both accepted.",
    intro:
      "Open the Timestamp workspace to convert between Unix, ISO 8601, UTC and local time. The tool also surfaces a relative-time string such as \"3 days ago\".",
    defaultCategory: "timestamp",
    keywords: ["timestamp", "unix", "iso", "utc", "local", "time", "DevPilot"],
    highlights: [
      "Unix timestamp ↔ ISO 8601",
      "UTC and local time",
      "Relative time",
    ],
    toolCount: 1,
  },
  {
    id: "dev-xml",
    kind: "xml",
    slug: "xml",
    name: "XML workspace",
    tagline: "Beautify, minify and validate an XML document",
    description:
      "Format an XML document with a configurable indent, minify, and validate against the standard parser. The format pass uses fast-xml-parser to round-trip the document safely; the minify pass strips whitespace between tags.",
    intro:
      "Open the XML workspace to beautify, minify or validate an XML document. The minifier drops whitespace between tags; the validator catches the first parser error.",
    defaultCategory: "xml",
    keywords: ["xml", "format", "beautify", "minify", "validate", "DevPilot"],
    highlights: [
      "Beautify with configurable indent",
      "Minify",
      "Validate with parser errors",
      "Copy and download",
    ],
    toolCount: 1,
  },
  {
    id: "dev-yaml",
    kind: "yaml",
    slug: "yaml",
    name: "YAML workspace",
    tagline: "Beautify, minify and validate a YAML document",
    description:
      "Format a YAML document with a configurable indent, minify, and validate. The parser handles scalars, quoted strings, key/value pairs, lists, nested maps, comments, multi-line scalars and flow-style arrays and objects.",
    intro:
      "Open the YAML workspace to beautify, minify or validate a YAML document. The minifier collapses whitespace; the validator catches indentation mismatches and other errors with line numbers.",
    defaultCategory: "yaml",
    keywords: ["yaml", "format", "beautify", "minify", "validate", "DevPilot"],
    highlights: [
      "Beautify with configurable indent",
      "Minify",
      "Validate with line-aware errors",
    ],
    toolCount: 1,
  },
  {
    id: "dev-qr",
    kind: "qr",
    slug: "qr",
    name: "QR workspace",
    tagline: "Generate a QR code and download it as PNG or SVG",
    description:
      "Type any text — a URL, a UUID, a JSON payload — and the workspace generates a Model 2 QR code with the four standard error-correction levels. Adjust the module size and the quiet zone, then download the matrix as PNG or SVG.",
    intro:
      "Open the QR workspace to generate a QR code for any text. Pick the error-correction level, set the module size, and download the matrix as PNG or SVG.",
    defaultCategory: "qr",
    keywords: ["qr", "qrcode", "barcode", "generate", "png", "svg", "DevPilot"],
    highlights: [
      "RFC-compliant QR code generation",
      "Four error-correction levels",
      "Download as PNG or SVG",
      "Configurable module size and quiet zone",
    ],
    toolCount: 1,
  },
  {
    id: "dev-color",
    kind: "color",
    slug: "color",
    name: "Color workspace",
    tagline: "Convert HEX, RGB, HSL and HSV; generate a palette",
    description:
      "Type a HEX code and the tool renders the colour in RGB, HSL and HSV. The palette generator produces a five-colour monochromatic-plus-complementary palette; the contrast-ratio helper answers the WCAG question for any second colour. Recent colours and the generated palette are kept on the session body.",
    intro:
      "Open the Color workspace to convert between HEX, RGB, HSL and HSV. Pick a base colour, generate a palette, and check the contrast ratio against any other colour.",
    defaultCategory: "color",
    keywords: ["color", "hex", "rgb", "hsl", "hsv", "palette", "contrast", "DevPilot"],
    highlights: [
      "HEX, RGB, HSL and HSV converter",
      "Five-colour palette generator",
      "WCAG contrast ratio",
      "Recent colours history",
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
