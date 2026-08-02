/**
 * Body-schema helpers for the DevPilot surfaces.
 *
 * Every DevPilot surface coerces an unknown body into a typed
 * envelope. The helpers live here so each surface reads as
 * "render the typed body" and the type guards / normalisers do not
 * have to be duplicated.
 *
 * Mirrors the SocialPilot / FinancePilot `bodies.ts` shape.
 */

import type {
  DevApiBody,
  DevApiHeader,
  DevApiHistoryEntry,
  DevApiQueryParam,
  DevApiRequest,
  DevBase64Body,
  DevCronBody,
  DevDiffBody,
  DevHashBody,
  DevHistoryBody,
  DevHistoryEntry,
  DevHtmlBody,
  DevCssBody,
  DevJsBody,
  DevJsonBody,
  DevJwtBody,
  DevRegexBody,
  DevSnippetBody,
  DevSqlBody,
  DevTimestampBody,
  DevUrlBody,
  DevUuidBody,
} from "./types";

export type {
  DevApiBody,
  DevApiHeader,
  DevApiHistoryEntry,
  DevApiQueryParam,
  DevApiRequest,
  DevBase64Body,
  DevCronBody,
  DevDiffBody,
  DevHashBody,
  DevHistoryBody,
  DevHistoryEntry,
  DevHtmlBody,
  DevCssBody,
  DevJsBody,
  DevJsonBody,
  DevJwtBody,
  DevRegexBody,
  DevSnippetBody,
  DevSqlBody,
  DevTimestampBody,
  DevUrlBody,
  DevUuidBody,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Snippet body                                                               */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SNIPPET_BODY: DevSnippetBody = {
  text: "",
  category: "",
  language: "",
  tags: [],
  description: "",
  isFavorite: false,
};

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of list) {
    const key = entry.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}

export function asSnippetBody(value: unknown): DevSnippetBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_SNIPPET_BODY };
  const record = value as Record<string, unknown>;
  return {
    text: typeof record.text === "string" ? record.text : "",
    category: typeof record.category === "string" ? record.category : "",
    language: typeof record.language === "string" ? record.language : "",
    tags: Array.isArray(record.tags)
      ? uniq(
          (record.tags as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          )
        )
      : [],
    description: typeof record.description === "string" ? record.description : "",
    isFavorite: record.isFavorite === true,
  };
}

/* -------------------------------------------------------------------------- */
/* History body                                                               */
/* -------------------------------------------------------------------------- */

export const DEFAULT_HISTORY_BODY: DevHistoryBody = {
  entries: [],
  toolFilter: "all",
  search: "",
};

function asHistoryEntry(value: unknown): DevHistoryEntry | null {
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
    language: typeof record.language === "string" ? record.language : "",
    text: record.text,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    isFavorite: record.isFavorite === true,
  };
}

export function asHistoryBody(value: unknown): DevHistoryBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_HISTORY_BODY };
  const record = value as Record<string, unknown>;
  const entries = Array.isArray(record.entries)
    ? (record.entries as unknown[])
        .map((entry) => asHistoryEntry(entry))
        .filter((entry): entry is DevHistoryEntry => Boolean(entry))
    : [];
  return {
    entries,
    toolFilter:
      typeof record.toolFilter === "string" ? record.toolFilter : "all",
    search: typeof record.search === "string" ? record.search : "",
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 2: tool body normalisers                                             */
/* -------------------------------------------------------------------------- */

export const DEFAULT_JSON_BODY: DevJsonBody = {
  input: "",
  sortKeys: false,
  indent: 2,
  note: "",
  isFavorite: false,
};

export function asJsonBody(value: unknown): DevJsonBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_JSON_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    input: typeof record.input === "string" ? record.input : "",
    sortKeys: record.sortKeys === true,
    indent,
    note: typeof record.note === "string" ? record.note : "",
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_JWT_BODY: DevJwtBody = {
  token: "",
  isFavorite: false,
};

export function asJwtBody(value: unknown): DevJwtBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_JWT_BODY };
  const record = value as Record<string, unknown>;
  return {
    token: typeof record.token === "string" ? record.token : "",
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_BASE64_BODY: DevBase64Body = {
  mode: "text",
  text: "",
  filename: "",
  fileBase64: "",
  note: "",
  isFavorite: false,
};

export function asBase64Body(value: unknown): DevBase64Body {
  if (!value || typeof value !== "object") return { ...DEFAULT_BASE64_BODY };
  const record = value as Record<string, unknown>;
  const mode: DevBase64Body["mode"] =
    record.mode === "file" ? "file" : "text";
  return {
    mode,
    text: typeof record.text === "string" ? record.text : "",
    filename: typeof record.filename === "string" ? record.filename : "",
    fileBase64:
      typeof record.fileBase64 === "string" ? record.fileBase64 : "",
    note: typeof record.note === "string" ? record.note : "",
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_UUID_BODY: DevUuidBody = {
  count: 5,
  generated: [],
  isFavorite: false,
};

export function asUuidBody(value: unknown): DevUuidBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_UUID_BODY };
  const record = value as Record<string, unknown>;
  const count =
    typeof record.count === "number" && Number.isFinite(record.count)
      ? Math.max(1, Math.min(200, Math.floor(record.count)))
      : 5;
  const generated = Array.isArray(record.generated)
    ? (record.generated as unknown[]).filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  return {
    count,
    generated,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_HASH_BODY: DevHashBody = {
  mode: "text",
  text: "",
  filename: "",
  fileDataUrl: "",
  isFavorite: false,
};

export function asHashBody(value: unknown): DevHashBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_HASH_BODY };
  const record = value as Record<string, unknown>;
  const mode: DevHashBody["mode"] = record.mode === "file" ? "file" : "text";
  return {
    mode,
    text: typeof record.text === "string" ? record.text : "",
    filename: typeof record.filename === "string" ? record.filename : "",
    fileDataUrl:
      typeof record.fileDataUrl === "string" ? record.fileDataUrl : "",
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_URL_BODY: DevUrlBody = {
  input: "",
  direction: "encode",
  isFavorite: false,
};

export function asUrlBody(value: unknown): DevUrlBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_URL_BODY };
  const record = value as Record<string, unknown>;
  const direction: DevUrlBody["direction"] =
    record.direction === "decode" ? "decode" : "encode";
  return {
    input: typeof record.input === "string" ? record.input : "",
    direction,
    isFavorite: record.isFavorite === true,
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 3: tool body normalisers                                             */
/* -------------------------------------------------------------------------- */

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const API_METHODS: DevApiRequest["method"][] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

function asApiMethod(value: unknown): DevApiRequest["method"] {
  return API_METHODS.includes(value as DevApiRequest["method"])
    ? (value as DevApiRequest["method"])
    : "GET";
}

function asApiHeader(value: unknown): DevApiHeader | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.key !== "string") return null;
  return {
    id: typeof record.id === "string" ? record.id : randomId("hdr"),
    key: record.key,
    value: typeof record.value === "string" ? record.value : "",
    enabled: record.enabled !== false,
  };
}

function asApiQueryParam(value: unknown): DevApiQueryParam | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.key !== "string") return null;
  return {
    id: typeof record.id === "string" ? record.id : randomId("q"),
    key: record.key,
    value: typeof record.value === "string" ? record.value : "",
    enabled: record.enabled !== false,
  };
}

export const DEFAULT_API_REQUEST: DevApiRequest = {
  id: randomId("req"),
  method: "GET",
  url: "",
  headers: [],
  query: [],
  body: "",
  contentType: "application/json",
};

export const DEFAULT_API_BODY: DevApiBody = {
  request: DEFAULT_API_REQUEST,
  history: [],
  collections: [],
  activeCollection: "",
  search: "",
  isFavorite: false,
};

function asApiHistoryEntry(value: unknown): DevApiHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.url !== "string" || typeof record.id !== "string") return null;
  return {
    id: record.id,
    method: asApiMethod(record.method),
    url: record.url,
    status:
      typeof record.status === "number" && Number.isFinite(record.status)
        ? Math.max(0, Math.floor(record.status))
        : 0,
    failed: record.failed === true,
    elapsedMs:
      typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)
        ? Math.max(0, record.elapsedMs)
        : 0,
    isFavorite: record.isFavorite === true,
    collection:
      typeof record.collection === "string" ? record.collection : "",
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
  };
}

function asApiRequest(value: unknown): DevApiRequest {
  if (!value || typeof value !== "object") return { ...DEFAULT_API_REQUEST, id: randomId("req") };
  const record = value as Record<string, unknown>;
  return {
    id:
      typeof record.id === "string" ? record.id : randomId("req"),
    method: asApiMethod(record.method),
    url: typeof record.url === "string" ? record.url : "",
    headers: Array.isArray(record.headers)
      ? (record.headers as unknown[])
          .map((entry) => asApiHeader(entry))
          .filter((entry): entry is DevApiHeader => Boolean(entry))
      : [],
    query: Array.isArray(record.query)
      ? (record.query as unknown[])
          .map((entry) => asApiQueryParam(entry))
          .filter((entry): entry is DevApiQueryParam => Boolean(entry))
      : [],
    body: typeof record.body === "string" ? record.body : "",
    contentType:
      typeof record.contentType === "string"
        ? record.contentType
        : "application/json",
  };
}

export function asApiBody(value: unknown): DevApiBody {
  if (!value || typeof value !== "object") return {
    ...DEFAULT_API_BODY,
    request: { ...DEFAULT_API_REQUEST, id: randomId("req") },
  };
  const record = value as Record<string, unknown>;
  return {
    request: asApiRequest(record.request),
    history: Array.isArray(record.history)
      ? (record.history as unknown[])
          .map((entry) => asApiHistoryEntry(entry))
          .filter((entry): entry is DevApiHistoryEntry => Boolean(entry))
          .slice(0, 200)
      : [],
    collections: Array.isArray(record.collections)
      ? (record.collections as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
    activeCollection:
      typeof record.activeCollection === "string"
        ? record.activeCollection
        : "",
    search: typeof record.search === "string" ? record.search : "",
    isFavorite: record.isFavorite === true,
  };
}

const REGEX_VIEWS: DevRegexBody["view"][] = ["test", "replace"];

export const DEFAULT_REGEX_BODY: DevRegexBody = {
  pattern: "",
  flags: "g",
  input: "",
  replacement: "",
  view: "test",
  presetId: "",
  isFavorite: false,
};

export function asRegexBody(value: unknown): DevRegexBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_REGEX_BODY };
  const record = value as Record<string, unknown>;
  return {
    pattern: typeof record.pattern === "string" ? record.pattern : "",
    flags: typeof record.flags === "string" ? record.flags : "g",
    input: typeof record.input === "string" ? record.input : "",
    replacement:
      typeof record.replacement === "string" ? record.replacement : "",
    view: REGEX_VIEWS.includes(record.view as DevRegexBody["view"])
      ? (record.view as DevRegexBody["view"])
      : "test",
    presetId: typeof record.presetId === "string" ? record.presetId : "",
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_DIFF_BODY: DevDiffBody = {
  left: "",
  right: "",
  mode: "text",
  layout: "side",
  isFavorite: false,
};

export function asDiffBody(value: unknown): DevDiffBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_DIFF_BODY };
  const record = value as Record<string, unknown>;
  return {
    left: typeof record.left === "string" ? record.left : "",
    right: typeof record.right === "string" ? record.right : "",
    mode: record.mode === "json" ? "json" : "text",
    layout: record.layout === "inline" ? "inline" : "side",
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_SQL_BODY: DevSqlBody = {
  input: "",
  uppercase: true,
  indent: 2,
  isFavorite: false,
};

export function asSqlBody(value: unknown): DevSqlBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_SQL_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    input: typeof record.input === "string" ? record.input : "",
    uppercase: record.uppercase !== false,
    indent,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_HTML_BODY: DevHtmlBody = {
  input: "",
  indent: 2,
  isFavorite: false,
};

export function asHtmlBody(value: unknown): DevHtmlBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_HTML_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    input: typeof record.input === "string" ? record.input : "",
    indent,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_CSS_BODY: DevCssBody = {
  input: "",
  indent: 2,
  isFavorite: false,
};

export function asCssBody(value: unknown): DevCssBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_CSS_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    input: typeof record.input === "string" ? record.input : "",
    indent,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_JS_BODY: DevJsBody = {
  input: "",
  indent: 2,
  isFavorite: false,
};

export function asJsBody(value: unknown): DevJsBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_JS_BODY };
  const record = value as Record<string, unknown>;
  const indent =
    typeof record.indent === "number" && Number.isFinite(record.indent)
      ? Math.max(0, Math.min(8, Math.floor(record.indent)))
      : 2;
  return {
    input: typeof record.input === "string" ? record.input : "",
    indent,
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_CRON_BODY: DevCronBody = {
  minute: "*",
  hour: "*",
  dayOfMonth: "*",
  month: "*",
  dayOfWeek: "*",
  note: "",
  isFavorite: false,
};

export function asCronBody(value: unknown): DevCronBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_CRON_BODY };
  const record = value as Record<string, unknown>;
  return {
    minute: typeof record.minute === "string" ? record.minute : "*",
    hour: typeof record.hour === "string" ? record.hour : "*",
    dayOfMonth:
      typeof record.dayOfMonth === "string" ? record.dayOfMonth : "*",
    month: typeof record.month === "string" ? record.month : "*",
    dayOfWeek: typeof record.dayOfWeek === "string" ? record.dayOfWeek : "*",
    note: typeof record.note === "string" ? record.note : "",
    isFavorite: record.isFavorite === true,
  };
}

const TS_DIRECTIONS: DevTimestampBody["direction"][] = [
  "fromUnix",
  "toUnix",
  "fromIso",
  "toIso",
];

export const DEFAULT_TIMESTAMP_BODY: DevTimestampBody = {
  input: "",
  direction: "fromUnix",
  isFavorite: false,
};

export function asTimestampBody(value: unknown): DevTimestampBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_TIMESTAMP_BODY };
  const record = value as Record<string, unknown>;
  return {
    input: typeof record.input === "string" ? record.input : "",
    direction: TS_DIRECTIONS.includes(
      record.direction as DevTimestampBody["direction"]
    )
      ? (record.direction as DevTimestampBody["direction"])
      : "fromUnix",
    isFavorite: record.isFavorite === true,
  };
}
