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
  DevBase64Body,
  DevHashBody,
  DevHistoryBody,
  DevHistoryEntry,
  DevJsonBody,
  DevJwtBody,
  DevSnippetBody,
  DevUrlBody,
  DevUuidBody,
} from "./types";

export type {
  DevBase64Body,
  DevHashBody,
  DevHistoryBody,
  DevHistoryEntry,
  DevJsonBody,
  DevJwtBody,
  DevSnippetBody,
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
