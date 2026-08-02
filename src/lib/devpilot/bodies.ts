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
  DevHistoryBody,
  DevHistoryEntry,
  DevSnippetBody,
} from "./types";

export type {
  DevHistoryBody,
  DevHistoryEntry,
  DevSnippetBody,
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
