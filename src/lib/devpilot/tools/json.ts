/**
 * JSON tool.
 *
 * Pure functions for formatting, minifying, validating and searching
 * JSON. Browser-only because it depends on `JSON.parse` /
 * `JSON.stringify` (already available in Node 18+ but exported
 * anyway).
 *
 * The tool reuses no infrastructure outside the JSON spec itself.
 */

export interface JsonSuccess {
  ok: true;
  /** Pretty-printed JSON. */
  formatted: string;
  /** Minified JSON. */
  minified: string;
  /** The parsed value, kept for the tree view. */
  value: unknown;
}

export interface JsonError {
  ok: false;
  message: string;
  /** Optional line / column from `JSON.parse`. */
  line?: number;
  column?: number;
}

export type JsonResult = JsonSuccess | JsonError;

function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out as unknown as T;
  }
  return value;
}

export function parseJson(input: string): JsonResult {
  const text = input ?? "";
  if (!text.trim()) {
    return { ok: false, message: "Input is empty" };
  }
  try {
    const value = JSON.parse(text);
    return { ok: true, formatted: "", minified: "", value };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { ok: false, message };
  }
}

export function formatJson(
  input: string,
  options: { indent?: number; sortKeys?: boolean } = {}
): JsonResult {
  const parsed = parseJson(input);
  if (!parsed.ok) return parsed;
  const indent = Math.max(0, Math.min(8, options.indent ?? 2));
  const value = options.sortKeys ? sortKeysDeep(parsed.value) : parsed.value;
  try {
    const formatted = JSON.stringify(value, null, indent);
    const minified = JSON.stringify(value);
    return { ok: true, formatted, minified, value };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to format" };
  }
}

export function minifyJson(input: string): JsonResult {
  const parsed = parseJson(input);
  if (!parsed.ok) return parsed;
  try {
    return {
      ok: true,
      formatted: JSON.stringify(parsed.value),
      minified: JSON.stringify(parsed.value),
      value: parsed.value,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to minify" };
  }
}

/** A flattened path through a JSON value. */
export interface JsonPathHit {
  /** Dotted path with array indices, e.g. `users[0].name`. */
  path: string;
  /** The matched value, serialised back to a string. */
  value: string;
}

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

export function searchJson(value: unknown, term: string, maxHits = 50): JsonPathHit[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  const out: JsonPathHit[] = [];
  function walk(node: unknown, path: string) {
    if (out.length >= maxHits) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        walk(node[i], `${path}[${i}]`);
        if (out.length >= maxHits) return;
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        const next = path ? `${path}.${key}` : key;
        walk(child, next);
        if (out.length >= maxHits) return;
      }
      return;
    }
    const text = typeof node === "string" ? node : JSON.stringify(node);
    if (matches(text, needle)) {
      out.push({ path: path || "$", value: text });
    }
  }
  walk(value, "");
  return out;
}

export interface JsonTreeNode {
  key: string;
  path: string;
  kind: "object" | "array" | "string" | "number" | "boolean" | "null";
  /** Number of children for objects / arrays. */
  size: number;
  /** Short preview of the value. */
  preview: string;
  children: JsonTreeNode[];
}

export function toTree(value: unknown, key = "$", path = ""): JsonTreeNode {
  if (Array.isArray(value)) {
    return {
      key,
      path: path || key,
      kind: "array",
      size: value.length,
      preview: `Array(${value.length})`,
      children: value.map((entry, index) =>
        toTree(entry, `[${index}]`, path ? `${path}[${index}]` : `[${index}]`)
      ),
    };
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      key,
      path: path || key,
      kind: "object",
      size: entries.length,
      preview: `Object(${entries.length})`,
      children: entries.map(([k, v]) =>
        toTree(v, k, path ? `${path}.${k}` : k)
      ),
    };
  }
  if (value === null) {
    return { key, path: path || key, kind: "null", size: 0, preview: "null", children: [] };
  }
  if (typeof value === "string") {
    const preview = value.length > 80 ? `${value.slice(0, 80)}…` : value;
    return { key, path: path || key, kind: "string", size: 0, preview, children: [] };
  }
  if (typeof value === "number") {
    return { key, path: path || key, kind: "number", size: 0, preview: String(value), children: [] };
  }
  if (typeof value === "boolean") {
    return { key, path: path || key, kind: "boolean", size: 0, preview: value ? "true" : "false", children: [] };
  }
  return { key, path: path || key, kind: "null", size: 0, preview: String(value), children: [] };
}
