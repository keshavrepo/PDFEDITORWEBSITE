/**
 * Body-schema helpers for the WebPilot surfaces.
 *
 * Every WebPilot surface coerces an unknown body into a typed
 * envelope. The helpers live here so each surface reads as
 * "render the typed body" and the type guards / normalisers do not
 * have to be duplicated.
 *
 * Mirrors the SocialPilot / FinancePilot / DevPilot `bodies.ts` shape.
 */

import type {
  WebCssBody,
  WebHistoryBody,
  WebHistoryEntry,
  WebHtmlBody,
  WebJsBody,
  WebPreviewBody,
} from "./types";

export type {
  WebCssBody,
  WebHistoryBody,
  WebHistoryEntry,
  WebHtmlBody,
  WebJsBody,
  WebPreviewBody,
} from "./types";

/* -------------------------------------------------------------------------- */
/* History body                                                               */
/* -------------------------------------------------------------------------- */

export const DEFAULT_HISTORY_BODY: WebHistoryBody = {
  entries: [],
  toolFilter: "all",
  search: "",
};

function asHistoryEntry(value: unknown): WebHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.toolName !== "string" ||
    typeof record.text !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    toolName: record.toolName,
    category: typeof record.category === "string" ? record.category : "",
    text: record.text,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    isFavorite: record.isFavorite === true,
  };
}

export function asHistoryBody(value: unknown): WebHistoryBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_HISTORY_BODY };
  const record = value as Record<string, unknown>;
  const entries = Array.isArray(record.entries)
    ? (record.entries as unknown[])
        .map((entry) => asHistoryEntry(entry))
        .filter((entry): entry is WebHistoryEntry => Boolean(entry))
    : [];
  return {
    entries,
    toolFilter:
      typeof record.toolFilter === "string" ? record.toolFilter : "all",
    search: typeof record.search === "string" ? record.search : "",
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 1: tool body normalisers                                             */
/* -------------------------------------------------------------------------- */

export const DEFAULT_HTML_BODY: WebHtmlBody = {
  source: "<!doctype html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>WebPilot · HTML</title>\n  </head>\n  <body>\n    <h1>Hello, WebPilot!</h1>\n    <p>Edit the HTML on the left. The live preview is on the right.</p>\n  </body>\n</html>\n",
  indent: 2,
  isFavorite: false,
};

export function asHtmlBody(value: unknown): WebHtmlBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_HTML_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    source: typeof record.source === "string" ? record.source : DEFAULT_HTML_BODY.source,
    indent,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_CSS_BODY: WebCssBody = {
  source: "/* WebPilot · CSS editor */\n:root {\n  --bg: #0f172a;\n  --fg: #f8fafc;\n  --accent: #38bdf8;\n}\n\nbody {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: var(--bg);\n  color: var(--fg);\n}\n",
  indent: 2,
  isFavorite: false,
};

export function asCssBody(value: unknown): WebCssBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_CSS_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    source: typeof record.source === "string" ? record.source : DEFAULT_CSS_BODY.source,
    indent,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_JS_BODY: WebJsBody = {
  source:
    "// WebPilot · JavaScript editor\nconsole.log(\"Hello, WebPilot!\");\n\ndocument.addEventListener(\"DOMContentLoaded\", () => {\n  const heading = document.querySelector(\"h1\");\n  if (heading) {\n    heading.addEventListener(\"click\", () => {\n      console.log(\"Heading clicked\");\n    });\n  }\n});\n",
  indent: 2,
  isFavorite: false,
};

export function asJsBody(value: unknown): WebJsBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_JS_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    source: typeof record.source === "string" ? record.source : DEFAULT_JS_BODY.source,
    indent,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_PREVIEW_BODY: WebPreviewBody = {
  html: "<!doctype html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>WebPilot · Live Preview</title>\n  </head>\n  <body>\n    <h1>Hello, WebPilot!</h1>\n    <p>Edit the HTML, CSS or JavaScript on the left. The preview updates here.</p>\n    <button id=\"ping\">Ping</button>\n  </body>\n</html>\n",
  css: "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: #0f172a;\n  color: #f8fafc;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n}\n\nbutton {\n  margin-top: 1rem;\n  padding: 0.5rem 1rem;\n  border: 0;\n  border-radius: 0.5rem;\n  background: #38bdf8;\n  color: #0f172a;\n  font-weight: 600;\n  cursor: pointer;\n}\n",
  js: "document.getElementById(\"ping\").addEventListener(\"click\", () => {\n  console.log(\"Ping!\");\n  alert(\"Ping!\");\n});\n",
  autoRefresh: true,
  isFavorite: false,
};

export function asPreviewBody(value: unknown): WebPreviewBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_PREVIEW_BODY };
  const record = value as Record<string, unknown>;
  return {
    html:
      typeof record.html === "string"
        ? record.html
        : DEFAULT_PREVIEW_BODY.html,
    css:
      typeof record.css === "string" ? record.css : DEFAULT_PREVIEW_BODY.css,
    js: typeof record.js === "string" ? record.js : DEFAULT_PREVIEW_BODY.js,
    autoRefresh: record.autoRefresh !== false,
    isFavorite: record.isFavorite === true,
  };
}
