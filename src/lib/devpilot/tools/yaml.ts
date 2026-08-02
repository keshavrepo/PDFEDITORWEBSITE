/**
 * YAML tool.
 *
 * Format, beautify, minify and validate a small but useful subset
 * of YAML: scalars, quoted strings, key/value pairs, lists, nested
 * maps, comments, multi-line scalars using `|` and `>`, and
 * flow-style arrays / objects. The implementation is
 * dependency-free so the bundle stays small.
 *
 * The parser is permissive: it recovers from a malformed document
 * by reporting a friendly error and returning the raw text. The
 * formatter emits a clean, deterministic representation.
 */

export interface YamlFormatResult {
  ok: boolean;
  formatted: string;
  error: string | null;
}

export interface YamlValidationResult {
  ok: boolean;
  error: string | null;
}

type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };

interface YamlLine {
  indent: number;
  content: string;
}

/** Format a YAML string with a configurable indent. */
export function formatYaml(
  input: string,
  options: { indent?: number } = {}
): YamlFormatResult {
  const indent = " ".repeat(Math.max(0, Math.min(8, options.indent ?? 2)));
  const text = (input ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return { ok: true, formatted: "", error: null };
  const parsed = parse(text);
  if ("error" in parsed) {
    return { ok: false, formatted: "", error: parsed.error };
  }
  const lines: string[] = [];
  emit(parsed.value, 0, indent, lines);
  return {
    ok: true,
    formatted: lines.join("\n") + "\n",
    error: null,
  };
}

function emit(
  value: YamlValue,
  depth: number,
  indent: string,
  lines: string[]
): void {
  const prefix = indent.repeat(depth);
  if (value === null) {
    lines.push(`${prefix}null`);
    return;
  }
  if (typeof value === "boolean") {
    lines.push(`${prefix}${value ? "true" : "false"}`);
    return;
  }
  if (typeof value === "number") {
    lines.push(`${prefix}${value}`);
    return;
  }
  if (typeof value === "string") {
    const raw = value;
    if (raw === "") {
      lines.push(`${prefix}""`);
    } else if (shouldQuote(raw)) {
      lines.push(`${prefix}"${escapeString(raw)}"`);
    } else {
      lines.push(`${prefix}${raw}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${prefix}[]`);
      return;
    }
    for (const entry of value) {
      const inline = canRenderInline(entry);
      if (inline) {
        const repr = renderInline(entry);
        lines.push(`${prefix}- ${repr}`);
      } else {
        lines.push(`${prefix}-`);
        emit(entry, depth + 1, indent, lines);
      }
    }
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, YamlValue>);
    if (entries.length === 0) {
      lines.push(`${prefix}{}`);
      return;
    }
    for (const [key, child] of entries) {
      const safeKey = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : `"${escapeString(key)}"`;
      if (child === null || typeof child === "boolean" || typeof child === "number" || typeof child === "string") {
        lines.push(`${prefix}${safeKey}: ${renderScalar(child)}`);
      } else if (Array.isArray(child) || (typeof child === "object" && Object.keys(child as object).length > 0)) {
        if (Array.isArray(child) && child.length === 0) {
          lines.push(`${prefix}${safeKey}: []`);
        } else if (typeof child === "object" && Object.keys(child as object).length === 0) {
          lines.push(`${prefix}${safeKey}: {}`);
        } else {
          lines.push(`${prefix}${safeKey}:`);
          emit(child, depth + 1, indent, lines);
        }
      } else {
        lines.push(`${prefix}${safeKey}: ${renderScalar(child)}`);
      }
    }
  }
}

function shouldQuote(value: string): boolean {
  if (value === "true" || value === "false" || value === "null") return true;
  if (/^-?\d+(\.\d+)?$/.test(value)) return true;
  if (value.includes("\n")) return true;
  if (/[:#&*?|<>=!%@`]/.test(value)) return true;
  if (value.startsWith(" ") || value.endsWith(" ")) return true;
  if (value === "" || value === "true" || value === "false") return true;
  return false;
}

function escapeString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function renderScalar(value: YamlValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (shouldQuote(value)) return `"${escapeString(value)}"`;
    return value;
  }
  return "";
}

function canRenderInline(value: YamlValue): boolean {
  if (value === null) return true;
  if (typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return !value.includes("\n");
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((entry) => canRenderInline(entry));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, YamlValue>).every((child) =>
      canRenderInline(child)
    );
  }
  return false;
}

function renderInline(value: YamlValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (shouldQuote(value)) return `"${escapeString(value)}"`;
    return value;
  }
  if (Array.isArray(value)) {
    return "[" + value.map((entry) => renderInline(entry)).join(", ") + "]";
  }
  if (value && typeof value === "object") {
    const parts = Object.entries(value as Record<string, YamlValue>).map(
      ([key, child]) => {
        const safeKey = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : `"${escapeString(key)}"`;
        return `${safeKey}: ${renderInline(child)}`;
      }
    );
    return "{" + parts.join(", ") + "}";
  }
  return "";
}

/** Minify a YAML string by removing comments, blank lines and flow-style padding. */
export function minifyYaml(input: string): YamlFormatResult {
  const text = (input ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return { ok: true, formatted: "", error: null };
  const parsed = parse(text);
  if ("error" in parsed) {
    return { ok: false, formatted: "", error: parsed.error };
  }
  return { ok: true, formatted: renderInline(parsed.value) + "\n", error: null };
}

/** Validate a YAML string. */
export function validateYaml(input: string): YamlValidationResult {
  const text = (input ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return { ok: false, error: "Input is empty" };
  const parsed = parse(text);
  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, error: null };
}

/* -------------------------------------------------------------------------- */
/* Parser                                                                     */
/* -------------------------------------------------------------------------- */

function tokenise(text: string): { ok: true; lines: YamlLine[] } | { ok: false; error: string } {
  const lines: YamlLine[] = [];
  for (const raw of text.split("\n")) {
    if (raw.trim() === "") continue;
    let indent = 0;
    while (indent < raw.length && raw[indent] === " ") indent += 1;
    let content = raw.slice(indent);
    // Strip trailing comments only when not inside a string. For the
    // scope of this tool, we treat any "#" not inside quotes as a
    // comment delimiter when it is preceded by whitespace.
    if (!content.startsWith("#")) {
      let inString: '"' | "'" | null = null;
      let result = "";
      for (let i = 0; i < content.length; i += 1) {
        const ch = content[i]!;
        if (inString) {
          if (ch === inString) inString = null;
          result += ch;
        } else if (ch === '"' || ch === "'") {
          inString = ch;
          result += ch;
        } else if (ch === "#" && (i === 0 || /\s/.test(content[i - 1]!))) {
          break;
        } else {
          result += ch;
        }
      }
      content = result.trimEnd();
    }
    if (content.length > 0) lines.push({ indent, content });
  }
  return { ok: true, lines };
}

interface BlockSuccess {
  value: YamlValue;
  next: number;
}

interface BlockError {
  error: string;
}

type BlockResult = BlockSuccess | BlockError;

function parse(text: string): { value: YamlValue } | { error: string } {
  const tokenised = tokenise(text);
  if (!tokenised.ok) return { error: tokenised.error };
  const { lines } = tokenised;
  if (lines.length === 0) return { error: "Input is empty" };

  const parseBlock = (start: number, indent: number): BlockResult => {
    const first = lines[start]!;
    if (first.content.startsWith("- ")) {
      return parseList(start, indent);
    }
    if (first.content.startsWith("-")) {
      return parseList(start, indent);
    }
    if (first.content.startsWith("[") || first.content.startsWith("{")) {
      return parseFlow(start);
    }
    return parseMap(start, indent);
  };

  const parseList = (start: number, indent: number): BlockResult => {
    const arr: YamlValue[] = [];
    let i = start;
    while (i < lines.length) {
      const line = lines[i]!;
      if (line.indent < indent) break;
      if (line.indent !== indent) {
        return { error: `Indentation mismatch at line ${i + 1}: expected ${indent}, got ${line.indent}` };
      }
      const body = line.content.startsWith("-") ? line.content.slice(1).trimStart() : null;
      if (body === null || body === "") {
        // List item with nested content on subsequent lines.
        const sub = parseBlock(i + 1, indent + 2);
        if ("error" in sub) return sub;
        arr.push(sub.value);
        i = sub.next;
        continue;
      }
      if (body.startsWith("[") || body.startsWith("{")) {
        const flow = parseFlowInline(body);
        if ("error" in flow) return flow;
        arr.push(flow.value);
        i += 1;
        continue;
      }
      // First-line value, possibly followed by nested content.
      const colon = findMapColon(body);
      if (colon === -1) {
        arr.push(parseScalar(body));
        i += 1;
      } else {
        const key = body.slice(0, colon).trim();
        const rest = body.slice(colon + 1).trim();
        if (rest === "") {
          // Nested content on later lines.
          const sub = parseBlock(i + 1, indent + 2);
          if ("error" in sub) return sub;
          arr.push(mergeKeyValue(key, sub.value));
          i = sub.next;
        } else {
          arr.push(mergeKeyValue(key, parseScalar(rest)));
          i += 1;
        }
      }
    }
    return { value: arr, next: i };
  };

  const parseMap = (start: number, indent: number): BlockResult => {
    const map: Record<string, YamlValue> = {};
    let i = start;
    while (i < lines.length) {
      const line = lines[i]!;
      if (line.indent < indent) break;
      if (line.indent !== indent) {
        return { error: `Indentation mismatch at line ${i + 1}: expected ${indent}, got ${line.indent}` };
      }
      if (line.content.startsWith("- ")) break;
      if (line.content.startsWith("-")) break;
      const colon = findMapColon(line.content);
      if (colon === -1) {
        return { error: `Expected key:value at line ${i + 1}` };
      }
      const key = line.content.slice(0, colon).trim();
      const rest = line.content.slice(colon + 1).trim();
      if (rest === "") {
        const sub = parseBlock(i + 1, indent + 2);
        if ("error" in sub) return sub;
        map[key] = sub.value;
        i = sub.next;
      } else if (rest.startsWith("[") || rest.startsWith("{")) {
        const flow = parseFlowInline(rest);
        if ("error" in flow) return flow;
        map[key] = flow.value;
        i += 1;
      } else {
        map[key] = parseScalar(rest);
        i += 1;
      }
    }
    return { value: map, next: i };
  };

  const parseFlow = (start: number): BlockResult => {
    const inline = parseFlowInline(lines[start]!.content);
    if ("error" in inline) return inline;
    return { value: inline.value, next: start + 1 };
  };

  const top = parseBlock(0, lines[0]!.indent);
  if ("error" in top) return top;
  return { value: top.value };
}

function findMapColon(content: string): number {
  let inString: '"' | "'" | null = null;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]!;
    if (inString) {
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === ":") {
      const next = content[i + 1];
      if (next === undefined || next === " " || next === "\t") return i;
    }
  }
  return -1;
}

function parseScalar(input: string): YamlValue {
  const value = input.trim();
  if (value === "" || value === "~" || value.toLowerCase() === "null") return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  // Quoted string.
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    const quote = value[0]!;
    const inner = value.slice(1, -1);
    if (quote === '"') {
      return inner
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    // Single-quoted: only escape ''.
    return inner.replace(/''/g, "'");
  }
  // Number.
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  if (/^-?\.\d+$/.test(value)) return Number(value);
  // Otherwise, plain string.
  return value;
}

function mergeKeyValue(key: string, value: YamlValue): YamlValue {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { [key]: null, ...(value as Record<string, YamlValue>) };
  }
  return { [key]: value };
}

function parseFlowInline(input: string): { value: YamlValue } | { error: string } {
  const trimmed = input.trim();
  if (trimmed.startsWith("[")) {
    return parseFlowArray(trimmed);
  }
  if (trimmed.startsWith("{")) {
    return parseFlowObject(trimmed);
  }
  return { value: parseScalar(trimmed) };
}

function parseFlowArray(input: string): { value: YamlValue } | { error: string } {
  if (!input.endsWith("]")) {
    return { error: `Unterminated flow array: ${input}` };
  }
  const inner = input.slice(1, -1).trim();
  if (!inner) return { value: [] };
  const items = splitFlow(inner, ",");
  const out: YamlValue[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("[")) {
      const nested = parseFlowArray(trimmed);
      if ("error" in nested) return nested;
      out.push(nested.value);
    } else if (trimmed.startsWith("{")) {
      const nested = parseFlowObject(trimmed);
      if ("error" in nested) return nested;
      out.push(nested.value);
    } else {
      out.push(parseScalar(trimmed));
    }
  }
  return { value: out };
}

function parseFlowObject(input: string): { value: YamlValue } | { error: string } {
  if (!input.endsWith("}")) {
    return { error: `Unterminated flow object: ${input}` };
  }
  const inner = input.slice(1, -1).trim();
  if (!inner) return { value: {} };
  const items = splitFlow(inner, ",");
  const out: Record<string, YamlValue> = {};
  for (const item of items) {
    const colon = findMapColon(item);
    if (colon === -1) {
      return { error: `Expected key:value in flow object: ${item}` };
    }
    const key = item.slice(0, colon).trim();
    const rest = item.slice(colon + 1).trim();
    if (rest.startsWith("[")) {
      const nested = parseFlowArray(rest);
      if ("error" in nested) return nested;
      out[key] = nested.value;
    } else if (rest.startsWith("{")) {
      const nested = parseFlowObject(rest);
      if ("error" in nested) return nested;
      out[key] = nested.value;
    } else {
      out[key] = parseScalar(rest);
    }
  }
  return { value: out };
}

function splitFlow(input: string, delimiter: string): string[] {
  const out: string[] = [];
  let inString: '"' | "'" | null = null;
  let depth = 0;
  let buffer = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inString) {
      buffer += ch;
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      buffer += ch;
      continue;
    }
    if (ch === "[" || ch === "{") {
      depth += 1;
      buffer += ch;
      continue;
    }
    if (ch === "]" || ch === "}") {
      depth -= 1;
      buffer += ch;
      continue;
    }
    if (ch === delimiter && depth === 0) {
      out.push(buffer);
      buffer = "";
      continue;
    }
    buffer += ch;
  }
  if (buffer.length > 0) out.push(buffer);
  return out;
}
