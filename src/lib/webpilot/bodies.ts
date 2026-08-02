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
  WebAsset,
  WebAssetFolder,
  WebAssetsBody,
  WebColorHistoryEntry,
  WebColorPaletteEntry,
  WebCssBody,
  WebGradientStop,
  WebHistoryBody,
  WebHistoryEntry,
  WebHtmlBody,
  WebJsBody,
  WebPreviewBody,
  WebProjectFile,
  WebProjectFolder,
  WebProjectRecent,
  WebProjectsBody,
  WebSearchBody,
  WebSearchMatch,
  WebUtilitiesBody,
  WebWorkspaceBody,
  WebWorkspaceClosedTab,
  WebWorkspaceTab,
} from "./types";

export type {
  WebAsset,
  WebAssetFolder,
  WebAssetsBody,
  WebColorHistoryEntry,
  WebColorPaletteEntry,
  WebCssBody,
  WebGradientStop,
  WebHistoryBody,
  WebHistoryEntry,
  WebHtmlBody,
  WebJsBody,
  WebPreviewBody,
  WebProjectFile,
  WebProjectFolder,
  WebProjectRecent,
  WebProjectsBody,
  WebSearchBody,
  WebSearchMatch,
  WebUtilitiesBody,
  WebWorkspaceBody,
  WebWorkspaceClosedTab,
  WebWorkspaceTab,
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

/* -------------------------------------------------------------------------- */
/* Batch 2: project + asset + workspace + search + utility normalisers        */
/* -------------------------------------------------------------------------- */

const FILE_KINDS = new Set(["html", "css", "javascript"] as const);
const ASSET_KINDS = new Set([
  "image",
  "svg",
  "font",
  "video",
  "icon",
  "other",
] as const);

function asFileKind(value: unknown): "html" | "css" | "javascript" {
  return FILE_KINDS.has(value as never)
    ? (value as "html" | "css" | "javascript")
    : "html";
}

function asAssetKind(value: unknown): WebAsset["kind"] {
  return ASSET_KINDS.has(value as never)
    ? (value as WebAsset["kind"])
    : "other";
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function asProjectFile(value: unknown): WebProjectFile | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.path !== "string" ||
    typeof record.source !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    path: record.path,
    kind: asFileKind(record.kind),
    source: record.source,
    savedSource:
      typeof record.savedSource === "string"
        ? record.savedSource
        : record.source,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

function asProjectFolder(value: unknown): WebProjectFolder | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.path !== "string") {
    return null;
  }
  return {
    id: record.id,
    path: record.path,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

function asProjectRecent(value: unknown): WebProjectRecent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.path !== "string") return null;
  return {
    path: record.path,
    openedAt:
      typeof record.openedAt === "string"
        ? record.openedAt
        : new Date().toISOString(),
  };
}

export const DEFAULT_PROJECTS_BODY: WebProjectsBody = {
  projectId: "",
  projectName: "Untitled project",
  folders: [],
  files: [
    {
      id: "file-index-html",
      path: "index.html",
      kind: "html",
      source:
        "<!doctype html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>WebPilot · Project</title>\n  </head>\n  <body>\n    <h1>Hello, WebPilot!</h1>\n    <p>Edit the project files. Use the tree on the left.</p>\n  </body>\n</html>\n",
      savedSource: "",
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: "file-style-css",
      path: "style.css",
      kind: "css",
      source:
        ":root {\n  --bg: #0f172a;\n  --fg: #f8fafc;\n  --accent: #38bdf8;\n}\n\nbody {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: var(--bg);\n  color: var(--fg);\n}\n",
      savedSource: "",
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: "file-script-js",
      path: "script.js",
      kind: "javascript",
      source:
        "console.log(\"Hello, WebPilot!\");\n",
      savedSource: "",
      updatedAt: new Date(0).toISOString(),
    },
  ],
  selectedPath: "index.html",
  search: "",
  recent: [],
  favorites: ["index.html"],
  isFavorite: false,
};

export function asProjectsBody(value: unknown): WebProjectsBody {
  if (!value || typeof value !== "object") {
    return cloneProjectsBody(DEFAULT_PROJECTS_BODY);
  }
  const record = value as Record<string, unknown>;
  const folders = Array.isArray(record.folders)
    ? (record.folders as unknown[])
        .map((entry) => asProjectFolder(entry))
        .filter((entry): entry is WebProjectFolder => Boolean(entry))
    : [];
  const files = Array.isArray(record.files)
    ? (record.files as unknown[])
        .map((entry) => asProjectFile(entry))
        .filter((entry): entry is WebProjectFile => Boolean(entry))
    : [];
  const recent = Array.isArray(record.recent)
    ? (record.recent as unknown[])
        .map((entry) => asProjectRecent(entry))
        .filter((entry): entry is WebProjectRecent => Boolean(entry))
        .slice(0, 20)
    : [];
  const favorites = Array.isArray(record.favorites)
    ? (record.favorites as unknown[]).filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  return {
    projectId: typeof record.projectId === "string" ? record.projectId : "",
    projectName:
      typeof record.projectName === "string"
        ? record.projectName
        : DEFAULT_PROJECTS_BODY.projectName,
    folders,
    files,
    selectedPath:
      typeof record.selectedPath === "string"
        ? record.selectedPath
        : "index.html",
    search: typeof record.search === "string" ? record.search : "",
    recent,
    favorites,
    isFavorite: record.isFavorite === true,
  };
}

export function cloneProjectsBody(body: WebProjectsBody): WebProjectsBody {
  return {
    projectId: body.projectId,
    projectName: body.projectName,
    folders: body.folders.map((folder) => ({ ...folder })),
    files: body.files.map((file) => ({ ...file })),
    selectedPath: body.selectedPath,
    search: body.search,
    recent: body.recent.map((entry) => ({ ...entry })),
    favorites: [...body.favorites],
    isFavorite: body.isFavorite,
  };
}

function asAssetFolder(value: unknown): WebAssetFolder | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.path !== "string") {
    return null;
  }
  return {
    id: record.id,
    path: record.path,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

function asAsset(value: unknown): WebAsset | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.dataUrl !== "string" ||
    typeof record.mime !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    folder: typeof record.folder === "string" ? record.folder : "",
    kind: asAssetKind(record.kind),
    mime: record.mime,
    dataUrl: record.dataUrl,
    width:
      typeof record.width === "number" && Number.isFinite(record.width)
        ? record.width
        : undefined,
    height:
      typeof record.height === "number" && Number.isFinite(record.height)
        ? record.height
        : undefined,
    size:
      typeof record.size === "number" && Number.isFinite(record.size)
        ? Math.max(0, Math.floor(record.size))
        : record.dataUrl.length,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_ASSETS_BODY: WebAssetsBody = {
  folders: [],
  assets: [],
  selectedAssetId: "",
  selectedFolder: "",
  search: "",
  isFavorite: false,
};

export function asAssetsBody(value: unknown): WebAssetsBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_ASSETS_BODY };
  const record = value as Record<string, unknown>;
  const folders = Array.isArray(record.folders)
    ? (record.folders as unknown[])
        .map((entry) => asAssetFolder(entry))
        .filter((entry): entry is WebAssetFolder => Boolean(entry))
    : [];
  const assets = Array.isArray(record.assets)
    ? (record.assets as unknown[])
        .map((entry) => asAsset(entry))
        .filter((entry): entry is WebAsset => Boolean(entry))
    : [];
  return {
    folders,
    assets,
    selectedAssetId:
      typeof record.selectedAssetId === "string" ? record.selectedAssetId : "",
    selectedFolder:
      typeof record.selectedFolder === "string" ? record.selectedFolder : "",
    search: typeof record.search === "string" ? record.search : "",
    isFavorite: record.isFavorite === true,
  };
}

function asWorkspaceTab(value: unknown): WebWorkspaceTab | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.path !== "string") {
    return null;
  }
  return {
    id: record.id,
    path: record.path,
    fileKind: asFileKind(record.fileKind),
    split: record.split === true,
  };
}

function asClosedTab(value: unknown): WebWorkspaceClosedTab | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.path !== "string") return null;
  return {
    path: record.path,
    fileKind: asFileKind(record.fileKind),
    closedAt:
      typeof record.closedAt === "string"
        ? record.closedAt
        : new Date().toISOString(),
  };
}

export const DEFAULT_WORKSPACE_BODY: WebWorkspaceBody = {
  projectId: "",
  folders: [],
  files: [],
  tabs: [],
  activeTabId: "",
  closedTabs: [],
  search: "",
  isFavorite: false,
};

export function asWorkspaceBody(value: unknown): WebWorkspaceBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_WORKSPACE_BODY };
  const record = value as Record<string, unknown>;
  const folders = Array.isArray(record.folders)
    ? (record.folders as unknown[])
        .map((entry) => asProjectFolder(entry))
        .filter((entry): entry is WebProjectFolder => Boolean(entry))
    : [];
  const files = Array.isArray(record.files)
    ? (record.files as unknown[])
        .map((entry) => asProjectFile(entry))
        .filter((entry): entry is WebProjectFile => Boolean(entry))
    : [];
  const tabs = Array.isArray(record.tabs)
    ? (record.tabs as unknown[])
        .map((entry) => asWorkspaceTab(entry))
        .filter((entry): entry is WebWorkspaceTab => Boolean(entry))
    : [];
  const closedTabs = Array.isArray(record.closedTabs)
    ? (record.closedTabs as unknown[])
        .map((entry) => asClosedTab(entry))
        .filter((entry): entry is WebWorkspaceClosedTab => Boolean(entry))
        .slice(0, 20)
    : [];
  return {
    projectId:
      typeof record.projectId === "string" ? record.projectId : "",
    folders,
    files,
    tabs,
    activeTabId:
      typeof record.activeTabId === "string" ? record.activeTabId : "",
    closedTabs,
    search: typeof record.search === "string" ? record.search : "",
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_SEARCH_BODY: WebSearchBody = {
  projectId: "",
  folders: [],
  files: [],
  query: "",
  replacement: "",
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  projectWide: true,
  isFavorite: false,
};

export function asSearchBody(value: unknown): WebSearchBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_SEARCH_BODY };
  const record = value as Record<string, unknown>;
  const folders = Array.isArray(record.folders)
    ? (record.folders as unknown[])
        .map((entry) => asProjectFolder(entry))
        .filter((entry): entry is WebProjectFolder => Boolean(entry))
    : [];
  const files = Array.isArray(record.files)
    ? (record.files as unknown[])
        .map((entry) => asProjectFile(entry))
        .filter((entry): entry is WebProjectFile => Boolean(entry))
    : [];
  return {
    projectId:
      typeof record.projectId === "string" ? record.projectId : "",
    folders,
    files,
    query: typeof record.query === "string" ? record.query : "",
    replacement:
      typeof record.replacement === "string" ? record.replacement : "",
    caseSensitive: record.caseSensitive === true,
    wholeWord: record.wholeWord === true,
    regex: record.regex === true,
    projectWide: record.projectWide !== false,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_UTILITIES_BODY: WebUtilitiesBody = {
  activeUtility: "color-picker",
  colorHex: "#38bdf8",
  colorHistory: [],
  colorPalette: [
    { hex: "#0f172a", name: "Slate 900" },
    { hex: "#1e293b", name: "Slate 800" },
    { hex: "#334155", name: "Slate 700" },
    { hex: "#64748b", name: "Slate 500" },
    { hex: "#94a3b8", name: "Slate 400" },
    { hex: "#cbd5e1", name: "Slate 300" },
    { hex: "#f8fafc", name: "Slate 50" },
    { hex: "#f43f5e", name: "Rose 500" },
    { hex: "#ec4899", name: "Pink 500" },
    { hex: "#a855f7", name: "Purple 500" },
    { hex: "#6366f1", name: "Indigo 500" },
    { hex: "#3b82f6", name: "Blue 500" },
    { hex: "#0ea5e9", name: "Sky 500" },
    { hex: "#06b6d4", name: "Cyan 500" },
    { hex: "#14b8a6", name: "Teal 500" },
    { hex: "#10b981", name: "Emerald 500" },
    { hex: "#22c55e", name: "Green 500" },
    { hex: "#eab308", name: "Yellow 500" },
    { hex: "#f97316", name: "Orange 500" },
  ],
  gradientType: "linear",
  gradientAngle: 90,
  gradientStops: [
    { position: 0, color: "#38bdf8" },
    { position: 100, color: "#a855f7" },
  ],
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  shadowBlur: 12,
  shadowSpread: 0,
  shadowColor: "#000000",
  shadowInset: false,
  radiusTopLeft: 8,
  radiusTopRight: 8,
  radiusBottomRight: 8,
  radiusBottomLeft: 8,
  unitFrom: "px",
  unitTo: "rem",
  unitValue: 16,
  unitBaseFontSize: 16,
  unitBaseViewportWidth: 1280,
  unitBaseViewportHeight: 720,
  entityInput: "<p>Hello & welcome to \"WebPilot\"</p>",
  base64Mode: "encode",
  base64Input: "Hello, WebPilot!",
  urlMode: "encode",
  urlInput: "https://webpilot.example.com/?q=hello world",
  isFavorite: false,
};

export function asUtilitiesBody(value: unknown): WebUtilitiesBody {
  if (!value || typeof value !== "object")
    return cloneUtilitiesBody(DEFAULT_UTILITIES_BODY);
  const record = value as Record<string, unknown>;
  const stops = Array.isArray(record.gradientStops)
    ? (record.gradientStops as unknown[])
        .map((entry) => asGradientStop(entry))
        .filter((entry): entry is WebGradientStop => Boolean(entry))
    : DEFAULT_UTILITIES_BODY.gradientStops;
  const colorHistory = Array.isArray(record.colorHistory)
    ? (record.colorHistory as unknown[])
        .map((entry) => asColorHistoryEntry(entry))
        .filter(
          (entry): entry is WebColorHistoryEntry => Boolean(entry)
        )
        .slice(0, 50)
    : [];
  const colorPalette = Array.isArray(record.colorPalette)
    ? (record.colorPalette as unknown[])
        .map((entry) => asColorPaletteEntry(entry))
        .filter(
          (entry): entry is WebColorPaletteEntry => Boolean(entry)
        )
    : DEFAULT_UTILITIES_BODY.colorPalette;
  return {
    activeUtility:
      typeof record.activeUtility === "string"
        ? record.activeUtility
        : DEFAULT_UTILITIES_BODY.activeUtility,
    colorHex:
      typeof record.colorHex === "string"
        ? record.colorHex
        : DEFAULT_UTILITIES_BODY.colorHex,
    colorHistory,
    colorPalette,
    gradientType:
      record.gradientType === "radial" ? "radial" : "linear",
    gradientAngle: clampNumber(
      record.gradientAngle,
      0,
      360,
      DEFAULT_UTILITIES_BODY.gradientAngle
    ),
    gradientStops: stops,
    shadowOffsetX: clampNumber(
      record.shadowOffsetX,
      -100,
      100,
      DEFAULT_UTILITIES_BODY.shadowOffsetX
    ),
    shadowOffsetY: clampNumber(
      record.shadowOffsetY,
      -100,
      100,
      DEFAULT_UTILITIES_BODY.shadowOffsetY
    ),
    shadowBlur: clampNumber(
      record.shadowBlur,
      0,
      200,
      DEFAULT_UTILITIES_BODY.shadowBlur
    ),
    shadowSpread: clampNumber(
      record.shadowSpread,
      -100,
      100,
      DEFAULT_UTILITIES_BODY.shadowSpread
    ),
    shadowColor:
      typeof record.shadowColor === "string"
        ? record.shadowColor
        : DEFAULT_UTILITIES_BODY.shadowColor,
    shadowInset: record.shadowInset === true,
    radiusTopLeft: clampNumber(
      record.radiusTopLeft,
      0,
      500,
      DEFAULT_UTILITIES_BODY.radiusTopLeft
    ),
    radiusTopRight: clampNumber(
      record.radiusTopRight,
      0,
      500,
      DEFAULT_UTILITIES_BODY.radiusTopRight
    ),
    radiusBottomRight: clampNumber(
      record.radiusBottomRight,
      0,
      500,
      DEFAULT_UTILITIES_BODY.radiusBottomRight
    ),
    radiusBottomLeft: clampNumber(
      record.radiusBottomLeft,
      0,
      500,
      DEFAULT_UTILITIES_BODY.radiusBottomLeft
    ),
    unitFrom: asUnitName(record.unitFrom, "px"),
    unitTo: asUnitName(record.unitTo, "rem"),
    unitValue: clampNumber(record.unitValue, 0, 100000, 16),
    unitBaseFontSize: clampNumber(
      record.unitBaseFontSize,
      1,
      100,
      16
    ),
    unitBaseViewportWidth: clampNumber(
      record.unitBaseViewportWidth,
      1,
      100000,
      1280
    ),
    unitBaseViewportHeight: clampNumber(
      record.unitBaseViewportHeight,
      1,
      100000,
      720
    ),
    entityInput:
      typeof record.entityInput === "string"
        ? record.entityInput
        : DEFAULT_UTILITIES_BODY.entityInput,
    base64Mode: record.base64Mode === "decode" ? "decode" : "encode",
    base64Input:
      typeof record.base64Input === "string"
        ? record.base64Input
        : DEFAULT_UTILITIES_BODY.base64Input,
    urlMode: record.urlMode === "decode" ? "decode" : "encode",
    urlInput:
      typeof record.urlInput === "string"
        ? record.urlInput
        : DEFAULT_UTILITIES_BODY.urlInput,
    isFavorite: record.isFavorite === true,
  };
}

export function cloneUtilitiesBody(body: WebUtilitiesBody): WebUtilitiesBody {
  return {
    activeUtility: body.activeUtility,
    colorHex: body.colorHex,
    colorHistory: body.colorHistory.map((entry) => ({ ...entry })),
    colorPalette: body.colorPalette.map((entry) => ({ ...entry })),
    gradientType: body.gradientType,
    gradientAngle: body.gradientAngle,
    gradientStops: body.gradientStops.map((stop) => ({ ...stop })),
    shadowOffsetX: body.shadowOffsetX,
    shadowOffsetY: body.shadowOffsetY,
    shadowBlur: body.shadowBlur,
    shadowSpread: body.shadowSpread,
    shadowColor: body.shadowColor,
    shadowInset: body.shadowInset,
    radiusTopLeft: body.radiusTopLeft,
    radiusTopRight: body.radiusTopRight,
    radiusBottomRight: body.radiusBottomRight,
    radiusBottomLeft: body.radiusBottomLeft,
    unitFrom: body.unitFrom,
    unitTo: body.unitTo,
    unitValue: body.unitValue,
    unitBaseFontSize: body.unitBaseFontSize,
    unitBaseViewportWidth: body.unitBaseViewportWidth,
    unitBaseViewportHeight: body.unitBaseViewportHeight,
    entityInput: body.entityInput,
    base64Mode: body.base64Mode,
    base64Input: body.base64Input,
    urlMode: body.urlMode,
    urlInput: body.urlInput,
    isFavorite: body.isFavorite,
  };
}

function asGradientStop(value: unknown): WebGradientStop | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.color !== "string") return null;
  return {
    position: clampNumber(record.position, 0, 100, 0),
    color: record.color,
  };
}

function asColorHistoryEntry(value: unknown): WebColorHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.hex !== "string") {
    return null;
  }
  return {
    id: record.id,
    hex: record.hex,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
  };
}

function asColorPaletteEntry(value: unknown): WebColorPaletteEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.hex !== "string") return null;
  return {
    hex: record.hex,
    name: typeof record.name === "string" ? record.name : "",
  };
}

type UnitName = WebUtilitiesBody["unitFrom"];

function asUnitName(value: unknown, fallback: UnitName): UnitName {
  const allowed: UnitName[] = [
    "px",
    "rem",
    "em",
    "pt",
    "vw",
    "vh",
    "%",
  ];
  return (allowed as string[]).includes(value as string)
    ? (value as UnitName)
    : fallback;
}
