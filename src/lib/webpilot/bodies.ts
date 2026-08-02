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

/* -------------------------------------------------------------------------- */
/* Batch 3: terminal + intelligence + validation + export + import +          */
/* productivity normalisers                                                  */
/* -------------------------------------------------------------------------- */

import type {
  WebCommandPaletteItem,
  WebExportAsset,
  WebExportBody,
  WebExportEntry,
  WebImportBody,
  WebImportConflict,
  WebIntelligenceBody,
  WebIntelligenceBracket,
  WebIntelligenceBreadcrumb,
  WebIntelligenceFold,
  WebIntelligenceSeverity,
  WebIntelligenceSymbol,
  WebProductivityBody,
  WebProductivityQuickAction,
  WebProductivityRecent,
  WebTerminalBody,
  WebTerminalCommand,
  WebTerminalLine,
  WebTerminalPane,
  WebValidationBody,
  WebValidationCategory,
  WebValidationIssue,
  WebValidationSeverity,
  WebValidationSummary,
} from "./types";

export type {
  WebCommandPaletteItem,
  WebExportAsset,
  WebExportBody,
  WebExportEntry,
  WebImportBody,
  WebImportConflict,
  WebIntelligenceBody,
  WebIntelligenceBracket,
  WebIntelligenceBreadcrumb,
  WebIntelligenceFold,
  WebIntelligenceSeverity,
  WebIntelligenceSymbol,
  WebProductivityBody,
  WebProductivityQuickAction,
  WebProductivityRecent,
  WebTerminalBody,
  WebTerminalCommand,
  WebTerminalLine,
  WebTerminalPane,
  WebValidationBody,
  WebValidationCategory,
  WebValidationIssue,
  WebValidationSeverity,
  WebValidationSummary,
} from "./types";

/* ----------------------------- Terminal ----------------------------------- */

const TERMINAL_LINE_KINDS = new Set([
  "input",
  "output",
  "info",
  "error",
] as const);

function asTerminalLineKind(
  value: unknown
): WebTerminalLine["kind"] {
  return TERMINAL_LINE_KINDS.has(value as never)
    ? (value as WebTerminalLine["kind"])
    : "output";
}

function asTerminalLine(value: unknown): WebTerminalLine | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.text !== "string") {
    return null;
  }
  return {
    id: record.id,
    kind: asTerminalLineKind(record.kind),
    text: record.text,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
  };
}

function asTerminalPane(value: unknown): WebTerminalPane | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    return null;
  }
  const lines = Array.isArray(record.lines)
    ? (record.lines as unknown[])
        .map((entry) => asTerminalLine(entry))
        .filter((entry): entry is WebTerminalLine => Boolean(entry))
        .slice(-500)
    : [];
  const history = Array.isArray(record.history)
    ? (record.history as unknown[]).filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  return {
    id: record.id,
    name: record.name,
    lines,
    input: typeof record.input === "string" ? record.input : "",
    history: history.slice(0, 100),
    historyIndex:
      typeof record.historyIndex === "number" &&
      Number.isFinite(record.historyIndex)
        ? Math.max(-1, Math.floor(record.historyIndex))
        : -1,
    cwd: typeof record.cwd === "string" ? record.cwd : "/",
  };
}

function asTerminalCommand(value: unknown): WebTerminalCommand | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.source !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    source: record.source,
    runAt:
      typeof record.runAt === "string"
        ? record.runAt
        : new Date().toISOString(),
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_TERMINAL_BODY: WebTerminalBody = {
  activePaneId: "pane-default",
  panes: [
    {
      id: "pane-default",
      name: "Terminal 1",
      lines: [
        {
          id: "line-info-1",
          kind: "info",
          text: "WebPilot · Integrated Terminal",
          createdAt: new Date().toISOString(),
        },
        {
          id: "line-info-2",
          kind: "info",
          text: "Type `help` to list built-in commands.",
          createdAt: new Date().toISOString(),
        },
      ],
      input: "",
      history: [],
      historyIndex: -1,
      cwd: "/",
    },
  ],
  fullscreen: false,
  commands: [],
  fontSize: 13,
  isFavorite: false,
};

export function asTerminalBody(value: unknown): WebTerminalBody {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_TERMINAL_BODY,
      panes: DEFAULT_TERMINAL_BODY.panes.map((pane) => ({
        ...pane,
        lines: pane.lines.map((line) => ({ ...line })),
      })),
    };
  }
  const record = value as Record<string, unknown>;
  const panes = Array.isArray(record.panes)
    ? (record.panes as unknown[])
        .map((entry) => asTerminalPane(entry))
        .filter((entry): entry is WebTerminalPane => Boolean(entry))
    : [];
  const finalPanes = panes.length > 0 ? panes : DEFAULT_TERMINAL_BODY.panes;
  const activePaneId =
    typeof record.activePaneId === "string" &&
    finalPanes.some((pane) => pane.id === record.activePaneId)
      ? record.activePaneId
      : finalPanes[0]!.id;
  const commands = Array.isArray(record.commands)
    ? (record.commands as unknown[])
        .map((entry) => asTerminalCommand(entry))
        .filter((entry): entry is WebTerminalCommand => Boolean(entry))
        .slice(0, 100)
    : [];
  return {
    activePaneId,
    panes: finalPanes,
    fullscreen: record.fullscreen === true,
    commands,
    fontSize: clampNumber(record.fontSize, 10, 24, 13),
    isFavorite: record.isFavorite === true,
  };
}

export function cloneTerminalBody(body: WebTerminalBody): WebTerminalBody {
  return {
    activePaneId: body.activePaneId,
    panes: body.panes.map((pane) => ({
      ...pane,
      lines: pane.lines.map((line) => ({ ...line })),
      history: [...pane.history],
    })),
    fullscreen: body.fullscreen,
    commands: body.commands.map((command) => ({ ...command })),
    fontSize: body.fontSize,
    isFavorite: body.isFavorite,
  };
}

/* --------------------------- Intelligence --------------------------------- */

const SYMBOL_KINDS = new Set([
  "function",
  "class",
  "variable",
  "method",
  "selector",
  "rule",
  "id",
  "tag",
  "attribute",
] as const);

const FOLD_KINDS = new Set(["block", "function", "rule", "comment"] as const);

function asSymbolKind(value: unknown): WebIntelligenceSymbol["kind"] {
  return SYMBOL_KINDS.has(value as never)
    ? (value as WebIntelligenceSymbol["kind"])
    : "variable";
}

function asFoldKind(value: unknown): WebIntelligenceFold["kind"] {
  return FOLD_KINDS.has(value as never)
    ? (value as WebIntelligenceFold["kind"])
    : "block";
}

function asIntelligenceSymbol(value: unknown): WebIntelligenceSymbol | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.path !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    kind: asSymbolKind(record.kind),
    path: record.path,
    line: clampNumber(record.line, 1, 1_000_000, 1),
    column: clampNumber(record.column, 1, 1_000_000, 1),
    endLine: clampNumber(record.endLine, 1, 1_000_000, 1),
    endColumn: clampNumber(record.endColumn, 1, 1_000_000, 1),
    preview:
      typeof record.preview === "string" ? record.preview : undefined,
  };
}

function asIntelligenceBracket(value: unknown): WebIntelligenceBracket | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.path !== "string" ||
    typeof record.openChar !== "string" ||
    typeof record.closeChar !== "string"
  ) {
    return null;
  }
  return {
    path: record.path,
    openLine: clampNumber(record.openLine, 1, 1_000_000, 1),
    openColumn: clampNumber(record.openColumn, 1, 1_000_000, 1),
    closeLine: clampNumber(record.closeLine, 1, 1_000_000, 1),
    closeColumn: clampNumber(record.closeColumn, 1, 1_000_000, 1),
    openChar: record.openChar,
    closeChar: record.closeChar,
  };
}

function asIntelligenceFold(value: unknown): WebIntelligenceFold | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.path !== "string") return null;
  return {
    path: record.path,
    startLine: clampNumber(record.startLine, 1, 1_000_000, 1),
    endLine: clampNumber(record.endLine, 1, 1_000_000, 1),
    kind: asFoldKind(record.kind),
  };
}

function asIntelligenceBreadcrumb(
  value: unknown
): WebIntelligenceBreadcrumb | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.path !== "string") return null;
  return {
    path: record.path,
    line: clampNumber(record.line, 1, 1_000_000, 1),
    column:
      typeof record.column === "number" && Number.isFinite(record.column)
        ? clampNumber(record.column, 1, 1_000_000, 1)
        : undefined,
    label: typeof record.label === "string" ? record.label : undefined,
  };
}

export const DEFAULT_INTELLIGENCE_BODY: WebIntelligenceBody = {
  activePath: "",
  symbols: [],
  brackets: [],
  folds: [],
  breadcrumbs: [],
  cursor: { line: 1, column: 1 },
  goToLine: "",
  goToSymbol: "",
  foldedLines: [],
  isFavorite: false,
};

export function asIntelligenceBody(value: unknown): WebIntelligenceBody {
  if (!value || typeof value !== "object")
    return cloneIntelligenceBody(DEFAULT_INTELLIGENCE_BODY);
  const record = value as Record<string, unknown>;
  const symbols = Array.isArray(record.symbols)
    ? (record.symbols as unknown[])
        .map((entry) => asIntelligenceSymbol(entry))
        .filter((entry): entry is WebIntelligenceSymbol => Boolean(entry))
    : [];
  const brackets = Array.isArray(record.brackets)
    ? (record.brackets as unknown[])
        .map((entry) => asIntelligenceBracket(entry))
        .filter((entry): entry is WebIntelligenceBracket => Boolean(entry))
    : [];
  const folds = Array.isArray(record.folds)
    ? (record.folds as unknown[])
        .map((entry) => asIntelligenceFold(entry))
        .filter((entry): entry is WebIntelligenceFold => Boolean(entry))
    : [];
  const breadcrumbs = Array.isArray(record.breadcrumbs)
    ? (record.breadcrumbs as unknown[])
        .map((entry) => asIntelligenceBreadcrumb(entry))
        .filter((entry): entry is WebIntelligenceBreadcrumb => Boolean(entry))
    : [];
  const foldedLines = Array.isArray(record.foldedLines)
    ? (record.foldedLines as unknown[])
        .filter((entry): entry is number => typeof entry === "number")
        .map((entry) => clampNumber(entry, 1, 1_000_000, 1))
    : [];
  const cursor =
    record.cursor &&
    typeof record.cursor === "object" &&
    typeof (record.cursor as Record<string, unknown>).line === "number" &&
    typeof (record.cursor as Record<string, unknown>).column === "number"
      ? {
          line: clampNumber(
            (record.cursor as Record<string, unknown>).line,
            1,
            1_000_000,
            1
          ),
          column: clampNumber(
            (record.cursor as Record<string, unknown>).column,
            1,
            1_000_000,
            1
          ),
        }
      : { line: 1, column: 1 };
  return {
    activePath:
      typeof record.activePath === "string" ? record.activePath : "",
    symbols,
    brackets,
    folds,
    breadcrumbs,
    cursor,
    goToLine: typeof record.goToLine === "string" ? record.goToLine : "",
    goToSymbol:
      typeof record.goToSymbol === "string" ? record.goToSymbol : "",
    foldedLines,
    isFavorite: record.isFavorite === true,
  };
}

export function cloneIntelligenceBody(
  body: WebIntelligenceBody
): WebIntelligenceBody {
  return {
    activePath: body.activePath,
    symbols: body.symbols.map((entry) => ({ ...entry })),
    brackets: body.brackets.map((entry) => ({ ...entry })),
    folds: body.folds.map((entry) => ({ ...entry })),
    breadcrumbs: body.breadcrumbs.map((entry) => ({ ...entry })),
    cursor: { ...body.cursor },
    goToLine: body.goToLine,
    goToSymbol: body.goToSymbol,
    foldedLines: [...body.foldedLines],
    isFavorite: body.isFavorite,
  };
}

/* --------------------------- Validation ----------------------------------- */

const VALIDATION_SEVERITIES = new Set(["info", "warning", "error"] as const);
const VALIDATION_CATEGORIES = new Set([
  "html",
  "css",
  "javascript",
  "link",
  "asset",
  "duplicate-id",
  "accessibility",
  "performance",
] as const);

function asValidationSeverity(
  value: unknown
): WebValidationSeverity {
  return VALIDATION_SEVERITIES.has(value as never)
    ? (value as WebValidationSeverity)
    : "warning";
}

function asValidationCategory(
  value: unknown
): WebValidationCategory {
  return VALIDATION_CATEGORIES.has(value as never)
    ? (value as WebValidationCategory)
    : "html";
}

function asValidationIssue(value: unknown): WebValidationIssue | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.path !== "string" ||
    typeof record.message !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    severity: asValidationSeverity(record.severity),
    category: asValidationCategory(record.category),
    path: record.path,
    line: clampNumber(record.line, 1, 1_000_000, 1),
    message: record.message,
    suggestion:
      typeof record.suggestion === "string" ? record.suggestion : undefined,
  };
}

export const DEFAULT_VALIDATION_BODY: WebValidationBody = {
  issues: [],
  summary: {
    errors: 0,
    warnings: 0,
    info: 0,
    files: 0,
    ranAt: "",
  },
  categoryFilter: "",
  severityFilter: "",
  search: "",
  enabledHtml: true,
  enabledCss: true,
  enabledJavascript: true,
  enabledLink: true,
  enabledAsset: true,
  enabledDuplicateId: true,
  enabledAccessibility: true,
  enabledPerformance: true,
  isFavorite: false,
};

export function asValidationBody(value: unknown): WebValidationBody {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_VALIDATION_BODY };
  const record = value as Record<string, unknown>;
  const issues = Array.isArray(record.issues)
    ? (record.issues as unknown[])
        .map((entry) => asValidationIssue(entry))
        .filter((entry): entry is WebValidationIssue => Boolean(entry))
        .slice(0, 500)
    : [];
  return {
    issues,
    summary: {
      errors: clampNumber(
        (record.summary as Record<string, unknown> | undefined)?.errors,
        0,
        1_000_000,
        0
      ),
      warnings: clampNumber(
        (record.summary as Record<string, unknown> | undefined)?.warnings,
        0,
        1_000_000,
        0
      ),
      info: clampNumber(
        (record.summary as Record<string, unknown> | undefined)?.info,
        0,
        1_000_000,
        0
      ),
      files: clampNumber(
        (record.summary as Record<string, unknown> | undefined)?.files,
        0,
        1_000_000,
        0
      ),
      ranAt:
        typeof (record.summary as Record<string, unknown> | undefined)
          ?.ranAt === "string"
          ? ((record.summary as Record<string, unknown>).ranAt as string)
          : "",
    },
    categoryFilter:
      typeof record.categoryFilter === "string" ? record.categoryFilter : "",
    severityFilter:
      typeof record.severityFilter === "string"
        ? record.severityFilter
        : "",
    search: typeof record.search === "string" ? record.search : "",
    enabledHtml: record.enabledHtml !== false,
    enabledCss: record.enabledCss !== false,
    enabledJavascript: record.enabledJavascript !== false,
    enabledLink: record.enabledLink !== false,
    enabledAsset: record.enabledAsset !== false,
    enabledDuplicateId: record.enabledDuplicateId !== false,
    enabledAccessibility: record.enabledAccessibility !== false,
    enabledPerformance: record.enabledPerformance !== false,
    isFavorite: record.isFavorite === true,
  };
}

/* ----------------------------- Export ------------------------------------- */

function asExportEntry(value: unknown): WebExportEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.path !== "string" ||
    (record.kind !== "file" && record.kind !== "folder")
  ) {
    return null;
  }
  return {
    path: record.path,
    kind: record.kind,
    size:
      typeof record.size === "number" && Number.isFinite(record.size)
        ? Math.max(0, Math.floor(record.size))
        : undefined,
    mime: typeof record.mime === "string" ? record.mime : undefined,
  };
}

function asExportAsset(value: unknown): WebExportAsset | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.dataUrl !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    folder: typeof record.folder === "string" ? record.folder : "",
    kind: asAssetKind(record.kind),
    size:
      typeof record.size === "number" && Number.isFinite(record.size)
        ? Math.max(0, Math.floor(record.size))
        : record.dataUrl.length,
    dataUrl: record.dataUrl,
  };
}

export const DEFAULT_EXPORT_BODY: WebExportBody = {
  archiveName: "webpilot-project",
  includeFolders: true,
  includeAssets: true,
  includeMetadata: true,
  prettyPrint: true,
  lastSize: 0,
  lastBuiltAt: "",
  isFavorite: false,
};

export function asExportBody(value: unknown): WebExportBody {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_EXPORT_BODY };
  const record = value as Record<string, unknown>;
  return {
    archiveName:
      typeof record.archiveName === "string" && record.archiveName.trim()
        ? record.archiveName.trim()
        : DEFAULT_EXPORT_BODY.archiveName,
    includeFolders: record.includeFolders !== false,
    includeAssets: record.includeAssets !== false,
    includeMetadata: record.includeMetadata !== false,
    prettyPrint: record.prettyPrint !== false,
    lastSize: clampNumber(record.lastSize, 0, 1_000_000_000, 0),
    lastBuiltAt:
      typeof record.lastBuiltAt === "string" ? record.lastBuiltAt : "",
    isFavorite: record.isFavorite === true,
  };
}

/* ----------------------------- Import ------------------------------------- */

const IMPORT_RESOLUTIONS = new Set([
  "skip",
  "replace",
  "rename",
  "merge",
] as const);

function asImportResolution(
  value: unknown
): WebImportConflict["resolution"] {
  return IMPORT_RESOLUTIONS.has(value as never)
    ? (value as WebImportConflict["resolution"])
    : "skip";
}

function asImportConflict(value: unknown): WebImportConflict | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.path !== "string") return null;
  return {
    path: record.path,
    kind:
      record.kind === "folder" || record.kind === "asset"
        ? record.kind
        : "file",
    resolution: asImportResolution(record.resolution),
    resolvedAt:
      typeof record.resolvedAt === "string"
        ? record.resolvedAt
        : new Date().toISOString(),
  };
}

export const DEFAULT_IMPORT_BODY: WebImportBody = {
  lastArchiveName: "",
  lastImportAt: "",
  lastFileCount: 0,
  lastAssetCount: 0,
  lastConflictCount: 0,
  conflicts: [],
  defaultResolution: "skip",
  validateBeforeImport: true,
  isFavorite: false,
};

export function asImportBody(value: unknown): WebImportBody {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_IMPORT_BODY };
  const record = value as Record<string, unknown>;
  const conflicts = Array.isArray(record.conflicts)
    ? (record.conflicts as unknown[])
        .map((entry) => asImportConflict(entry))
        .filter((entry): entry is WebImportConflict => Boolean(entry))
    : [];
  return {
    lastArchiveName:
      typeof record.lastArchiveName === "string"
        ? record.lastArchiveName
        : "",
    lastImportAt:
      typeof record.lastImportAt === "string" ? record.lastImportAt : "",
    lastFileCount: clampNumber(record.lastFileCount, 0, 1_000_000, 0),
    lastAssetCount: clampNumber(record.lastAssetCount, 0, 1_000_000, 0),
    lastConflictCount: clampNumber(
      record.lastConflictCount,
      0,
      1_000_000,
      0
    ),
    conflicts,
    defaultResolution:
      record.defaultResolution === "replace"
        ? "replace"
        : record.defaultResolution === "rename"
          ? "rename"
          : "skip",
    validateBeforeImport: record.validateBeforeImport !== false,
    isFavorite: record.isFavorite === true,
  };
}

/* ------------------------- Productivity ----------------------------------- */

function asCommandPaletteItem(
  value: unknown
): WebCommandPaletteItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.label !== "string") {
    return null;
  }
  const keywords = Array.isArray(record.keywords)
    ? (record.keywords as unknown[]).filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  return {
    id: record.id,
    label: record.label,
    category: typeof record.category === "string" ? record.category : "",
    shortcut: typeof record.shortcut === "string" ? record.shortcut : undefined,
    keywords,
    lastInvokedAt:
      typeof record.lastInvokedAt === "string"
        ? record.lastInvokedAt
        : undefined,
  };
}

function asProductivityRecent(value: unknown): WebProductivityRecent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.kind !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    title: record.title,
    kind: record.kind,
    openedAt:
      typeof record.openedAt === "string"
        ? record.openedAt
        : new Date().toISOString(),
  };
}

function asQuickAction(value: unknown): WebProductivityQuickAction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.label !== "string" ||
    typeof record.target !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    label: record.label,
    description:
      typeof record.description === "string" ? record.description : "",
    target: record.target,
    shortcut: typeof record.shortcut === "string" ? record.shortcut : undefined,
  };
}

const DEFAULT_QUICK_ACTIONS: WebProductivityQuickAction[] = [
  {
    id: "qa-projects",
    label: "Open Project Explorer",
    description: "Browse the project tree and edit files.",
    target: "projects",
    shortcut: "Ctrl/Cmd + 1",
  },
  {
    id: "qa-assets",
    label: "Open Asset Manager",
    description: "Upload and organise project assets.",
    target: "assets",
    shortcut: "Ctrl/Cmd + 2",
  },
  {
    id: "qa-workspace",
    label: "Open Multi-file Workspace",
    description: "Edit every file with tabs and autosave.",
    target: "workspace",
    shortcut: "Ctrl/Cmd + 3",
  },
  {
    id: "qa-search",
    label: "Open Professional Search",
    description: "Find and replace across the project.",
    target: "search",
    shortcut: "Ctrl/Cmd + 4",
  },
  {
    id: "qa-validation",
    label: "Run Project Validation",
    description: "Catch HTML, CSS, JS, link, asset, a11y, perf issues.",
    target: "validation",
    shortcut: "Ctrl/Cmd + 5",
  },
  {
    id: "qa-export",
    label: "Export the project",
    description: "Build a ZIP archive of the project.",
    target: "export",
  },
  {
    id: "qa-import",
    label: "Import a project",
    description: "Bring a ZIP back into WebPilot.",
    target: "import",
  },
  {
    id: "qa-terminal",
    label: "Open Integrated Terminal",
    description: "Run a command in a sandboxed shell.",
    target: "terminal",
  },
  {
    id: "qa-intelligence",
    label: "Open Code Intelligence",
    description: "Symbols, brackets, folding, breadcrumbs.",
    target: "intelligence",
  },
  {
    id: "qa-utilities",
    label: "Open Developer Utilities",
    description: "Color picker, gradient, shadow, radius, units.",
    target: "utilities",
  },
];

const DEFAULT_PALETTE_ITEMS: WebCommandPaletteItem[] = [
  {
    id: "cmd-open-projects",
    label: "Open Project Explorer",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 1",
    keywords: ["project", "explorer", "files", "tree", "folders", "WebPilot"],
  },
  {
    id: "cmd-open-assets",
    label: "Open Asset Manager",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 2",
    keywords: ["assets", "images", "fonts", "videos", "icons", "WebPilot"],
  },
  {
    id: "cmd-open-workspace",
    label: "Open Multi-file Workspace",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 3",
    keywords: ["workspace", "tabs", "autosave", "WebPilot"],
  },
  {
    id: "cmd-open-search",
    label: "Open Professional Search",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 4",
    keywords: ["search", "find", "replace", "regex", "WebPilot"],
  },
  {
    id: "cmd-open-validation",
    label: "Open Project Validation",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 5",
    keywords: ["validation", "lint", "broken", "a11y", "WebPilot"],
  },
  {
    id: "cmd-open-export",
    label: "Open Project Export",
    category: "Tools",
    keywords: ["export", "zip", "archive", "WebPilot"],
  },
  {
    id: "cmd-open-import",
    label: "Open Project Import",
    category: "Tools",
    keywords: ["import", "zip", "restore", "WebPilot"],
  },
  {
    id: "cmd-open-terminal",
    label: "Open Integrated Terminal",
    category: "Tools",
    keywords: ["terminal", "shell", "command", "WebPilot"],
  },
  {
    id: "cmd-open-intelligence",
    label: "Open Code Intelligence",
    category: "Tools",
    keywords: [
      "intelligence",
      "bracket",
      "fold",
      "outline",
      "symbol",
      "WebPilot",
    ],
  },
  {
    id: "cmd-open-utilities",
    label: "Open Developer Utilities",
    category: "Tools",
    keywords: [
      "utilities",
      "color",
      "gradient",
      "shadow",
      "radius",
      "WebPilot",
    ],
  },
  {
    id: "cmd-toggle-palette",
    label: "Toggle Command Palette",
    category: "Workspace",
    shortcut: "Ctrl/Cmd + Shift + P",
    keywords: ["palette", "command", "WebPilot"],
  },
  {
    id: "cmd-toggle-autosave",
    label: "Toggle Autosave",
    category: "Workspace",
    keywords: ["autosave", "save", "WebPilot"],
  },
  {
    id: "cmd-run-validation",
    label: "Run Project Validation",
    category: "Validation",
    keywords: ["validation", "run", "WebPilot"],
  },
  {
    id: "cmd-build-export",
    label: "Build Project Export",
    category: "Export",
    keywords: ["export", "build", "zip", "WebPilot"],
  },
  {
    id: "cmd-clear-terminal",
    label: "Clear Integrated Terminal",
    category: "Terminal",
    shortcut: "Ctrl/Cmd + K",
    keywords: ["terminal", "clear", "WebPilot"],
  },
  {
    id: "cmd-new-terminal",
    label: "New Terminal Pane",
    category: "Terminal",
    shortcut: "Ctrl/Cmd + T",
    keywords: ["terminal", "new", "pane", "WebPilot"],
  },
  {
    id: "cmd-fullscreen-terminal",
    label: "Toggle Terminal Fullscreen",
    category: "Terminal",
    shortcut: "Ctrl/Cmd + Shift + F",
    keywords: ["terminal", "fullscreen", "WebPilot"],
  },
  {
    id: "cmd-copy-output",
    label: "Copy Terminal Output",
    category: "Terminal",
    keywords: ["terminal", "copy", "WebPilot"],
  },
];

export const DEFAULT_PRODUCTIVITY_BODY: WebProductivityBody = {
  paletteOpen: false,
  paletteQuery: "",
  recent: [],
  quickActions: DEFAULT_QUICK_ACTIONS,
  autosaveEnabled: true,
  autosaveIntervalMs: 1500,
  wordWrap: true,
  theme: "system",
  minimap: true,
  indent: 2,
  findShortcut: true,
  isFavorite: false,
};

export function asProductivityBody(value: unknown): WebProductivityBody {
  if (!value || typeof value !== "object")
    return cloneProductivityBody(DEFAULT_PRODUCTIVITY_BODY);
  const record = value as Record<string, unknown>;
  const recent = Array.isArray(record.recent)
    ? (record.recent as unknown[])
        .map((entry) => asProductivityRecent(entry))
        .filter((entry): entry is WebProductivityRecent => Boolean(entry))
        .slice(0, 12)
    : [];
  const quickActions = Array.isArray(record.quickActions)
    ? (record.quickActions as unknown[])
        .map((entry) => asQuickAction(entry))
        .filter(
          (entry): entry is WebProductivityQuickAction => Boolean(entry)
        )
    : DEFAULT_QUICK_ACTIONS;
  return {
    paletteOpen: record.paletteOpen === true,
    paletteQuery:
      typeof record.paletteQuery === "string" ? record.paletteQuery : "",
    recent,
    quickActions,
    autosaveEnabled: record.autosaveEnabled !== false,
    autosaveIntervalMs: clampNumber(
      record.autosaveIntervalMs,
      250,
      60_000,
      1500
    ),
    wordWrap: record.wordWrap !== false,
    theme:
      record.theme === "light" || record.theme === "dark"
        ? record.theme
        : "system",
    minimap: record.minimap !== false,
    indent: clampNumber(record.indent, 0, 8, 2),
    findShortcut: record.findShortcut !== false,
    isFavorite: record.isFavorite === true,
  };
}

export function cloneProductivityBody(
  body: WebProductivityBody
): WebProductivityBody {
  return {
    paletteOpen: body.paletteOpen,
    paletteQuery: body.paletteQuery,
    recent: body.recent.map((entry) => ({ ...entry })),
    quickActions: body.quickActions.map((entry) => ({ ...entry })),
    autosaveEnabled: body.autosaveEnabled,
    autosaveIntervalMs: body.autosaveIntervalMs,
    wordWrap: body.wordWrap,
    theme: body.theme,
    minimap: body.minimap,
    indent: body.indent,
    findShortcut: body.findShortcut,
    isFavorite: body.isFavorite,
  };
}
