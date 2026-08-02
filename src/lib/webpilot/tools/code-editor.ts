/**
 * Code editor helpers.
 *
 * WebPilot uses a textarea-based code editor with a syntax
 * highlighting overlay. The shared helpers in this file cover the
 * bits every editor needs: tokenisation, indent computation,
 * find / replace, and an undo / redo stack.
 *
 * The highlighter is intentionally lightweight: it splits the
 * source into runs of plain text and "token" runs that share a
 * single class name. The overlay `<pre>` mirrors the textarea via
 * a tab-stop tweak so the two stay in sync.
 */

export type TokenKind =
  | "plain"
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "selector"
  | "property"
  | "value"
  | "function"
  | "operator"
  | "punct"
  | "regex"
  | "variable"
  | "tag";

export interface Token {
  kind: TokenKind;
  text: string;
}

/** Tokenise `source` for the HTML editor. */
export function tokeniseHtml(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    // Comments
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      const stop = end === -1 ? source.length : end + 3;
      out.push({ kind: "comment", text: source.slice(i, stop) });
      i = stop;
      continue;
    }
    // Doctype / CDATA / processing
    if (source.startsWith("<!", i) || source.startsWith("<?", i)) {
      const end = source.indexOf(">", i);
      const stop = end === -1 ? source.length : end + 1;
      out.push({ kind: "comment", text: source.slice(i, stop) });
      i = stop;
      continue;
    }
    // Tags
    if (ch === "<") {
      const end = source.indexOf(">", i);
      const stop = end === -1 ? source.length : end + 1;
      out.push({ kind: "tag", text: source.slice(i, stop) });
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < source.length && source[j] !== quote) {
        if (source[j] === "\\" && j + 1 < source.length) j += 2;
        else j += 1;
      }
      out.push({
        kind: "string",
        text: source.slice(i, Math.min(j + 1, source.length)),
      });
      i = j + 1;
      continue;
    }
    // Plain run
    let j = i + 1;
    while (j < source.length && source[j] !== "<" && source[j] !== '"' && source[j] !== "'") {
      j += 1;
    }
    out.push({ kind: "plain", text: source.slice(i, j) });
    i = j;
  }
  return out;
}

const CSS_KEYWORDS = new Set([
  "important",
  "from",
  "to",
  "and",
  "or",
  "not",
  "only",
]);

const CSS_PROPERTY_NAMES = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "background-position",
  "background-repeat",
  "background-size",
  "border",
  "border-color",
  "border-style",
  "border-width",
  "border-radius",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "box-shadow",
  "display",
  "flex",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-content",
  "gap",
  "grid",
  "grid-template-columns",
  "grid-template-rows",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "opacity",
  "overflow",
  "overflow-x",
  "overflow-y",
  "text-align",
  "text-decoration",
  "text-transform",
  "transition",
  "transform",
  "z-index",
  "cursor",
  "pointer-events",
  "user-select",
  "content",
  "list-style",
  "outline",
  "animation",
]);

const CSS_PROPERTY_VALUES = new Set([
  "auto",
  "none",
  "block",
  "inline",
  "inline-block",
  "flex",
  "grid",
  "table",
  "table-cell",
  "absolute",
  "relative",
  "fixed",
  "sticky",
  "static",
  "center",
  "left",
  "right",
  "top",
  "bottom",
  "middle",
  "baseline",
  "stretch",
  "wrap",
  "nowrap",
  "wrap-reverse",
  "row",
  "column",
  "row-reverse",
  "column-reverse",
  "hidden",
  "visible",
  "scroll",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
  "italic",
  "bold",
  "normal",
  "uppercase",
  "lowercase",
  "capitalize",
  "underline",
  "line-through",
  "pointer",
  "default",
  "text",
  "move",
  "grab",
  "grabbing",
  "all-scroll",
  "crosshair",
  "ease",
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "infinite",
  "alternate",
  "forwards",
  "backwards",
  "both",
  "transparent",
  "currentColor",
  "inherit",
  "initial",
  "unset",
]);

/** Tokenise `source` for the CSS editor. */
export function tokeniseCss(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let inAtRule = false;
  while (i < source.length) {
    const ch = source[i]!;
    // Comments
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out.push({ kind: "comment", text: source.slice(i, stop) });
      i = stop;
      continue;
    }
    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < source.length && source[j] !== quote) {
        if (source[j] === "\\" && j + 1 < source.length) j += 2;
        else j += 1;
      }
      out.push({
        kind: "string",
        text: source.slice(i, Math.min(j + 1, source.length)),
      });
      i = j + 1;
      continue;
    }
    // At-rules
    if (ch === "@") {
      let j = i + 1;
      while (j < source.length && /[A-Za-z-]/.test(source[j]!)) j += 1;
      out.push({ kind: "keyword", text: source.slice(i, j) });
      inAtRule = true;
      i = j;
      continue;
    }
    // Selector until `{`
    if (!inAtRule && ch !== "{" && ch !== "}" && ch !== ";" && ch !== ":") {
      let j = i + 1;
      while (j < source.length && source[j] !== "{" && source[j] !== "}" && source[j] !== ";" && source[j] !== ":") {
        j += 1;
      }
      const text = source.slice(i, j);
      if (text.trim().length > 0) {
        out.push({ kind: "selector", text });
      }
      i = j;
      continue;
    }
    if (ch === "{") {
      out.push({ kind: "punct", text: ch });
      inAtRule = true;
      i += 1;
      continue;
    }
    if (ch === "}") {
      out.push({ kind: "punct", text: ch });
      inAtRule = false;
      i += 1;
      continue;
    }
    if (ch === ";") {
      out.push({ kind: "punct", text: ch });
      i += 1;
      continue;
    }
    if (ch === ":") {
      out.push({ kind: "punct", text: ch });
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j]!)) j += 1;
      out.push({ kind: "plain", text: source.slice(i, j) });
      i = j;
      continue;
    }
    if (/\d/.test(ch) || (ch === "." && /\d/.test(source[i + 1] ?? "")) || ch === "#") {
      // Number, hex color, id selector
      if (ch === "#") {
        let j = i + 1;
        while (j < source.length && /[0-9A-Za-z]/.test(source[j]!)) j += 1;
        out.push({ kind: "number", text: source.slice(i, j) });
        i = j;
        continue;
      }
      if (ch === "." && /\d/.test(source[i + 1] ?? "")) {
        let j = i + 1;
        while (j < source.length && /[0-9.]/.test(source[j]!)) j += 1;
        out.push({ kind: "number", text: source.slice(i, j) });
        i = j;
        continue;
      }
      let j = i;
      while (j < source.length && /[0-9.%a-zA-Z-]/.test(source[j]!)) j += 1;
      out.push({ kind: "number", text: source.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_-]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_-]/.test(source[j]!)) j += 1;
      const word = source.slice(i, j);
      let kind: TokenKind = "plain";
      if (CSS_PROPERTY_NAMES.has(word.toLowerCase())) kind = "property";
      else if (CSS_PROPERTY_VALUES.has(word.toLowerCase())) kind = "value";
      else if (CSS_KEYWORDS.has(word.toLowerCase())) kind = "keyword";
      else if (word.startsWith("--")) kind = "variable";
      else if (word.startsWith("var(") || word === "var") kind = "function";
      out.push({ kind, text: word });
      i = j;
      continue;
    }
    out.push({ kind: "operator", text: ch });
    i += 1;
  }
  return out;
}

const JS_KEYWORDS = new Set([
  "await",
  "async",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "static",
  "true",
  "false",
  "null",
  "undefined",
]);

const JS_LITERALS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
]);

/** Tokenise `source` for the JavaScript editor. */
export function tokeniseJs(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    // Line comments
    if (source.startsWith("//", i)) {
      let j = i + 2;
      while (j < source.length && source[j] !== "\n") j += 1;
      out.push({ kind: "comment", text: source.slice(i, j) });
      i = j;
      continue;
    }
    // Block comments
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out.push({ kind: "comment", text: source.slice(i, stop) });
      i = stop;
      continue;
    }
    // Strings
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < source.length && source[j] !== quote) {
        if (source[j] === "\\" && j + 1 < source.length) j += 2;
        else if (source[j] === "\n" && quote === "`") {
          j += 1;
        } else j += 1;
      }
      out.push({
        kind: "string",
        text: source.slice(i, Math.min(j + 1, source.length)),
      });
      i = j + 1;
      continue;
    }
    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[0-9.xXbBeE_]/.test(source[j]!)) j += 1;
      out.push({ kind: "number", text: source.slice(i, j) });
      i = j;
      continue;
    }
    // Identifiers and keywords
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_$]/.test(source[j]!)) j += 1;
      const word = source.slice(i, j);
      let kind: TokenKind = "plain";
      if (JS_KEYWORDS.has(word)) kind = "keyword";
      else if (JS_LITERALS.has(word)) kind = "value";
      else if (source[j] === "(") kind = "function";
      out.push({ kind, text: word });
      i = j;
      continue;
    }
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j]!)) j += 1;
      out.push({ kind: "plain", text: source.slice(i, j) });
      i = j;
      continue;
    }
    out.push({ kind: "operator", text: ch });
    i += 1;
  }
  return out;
}

/** Escape HTML for the highlight overlay. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convert a token list to an HTML string for the highlight overlay. */
export function tokensToHtml(tokens: Token[]): string {
  let out = "";
  for (const token of tokens) {
    if (token.kind === "plain" || token.text === "") {
      out += escapeHtml(token.text);
      continue;
    }
    out += `<span class="tok-${token.kind}">${escapeHtml(token.text)}</span>`;
  }
  // Always end with a zero-width marker so the overlay trailing
  // newline stays aligned with the textarea.
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

/** Compute the indent for a freshly-inserted line. */
export function computeIndent(
  text: string,
  selectionStart: number,
  options: { unit: number }
): string {
  const unit = " ".repeat(Math.max(0, Math.min(8, options.unit)));
  // Walk back to the previous line break.
  let lineStart = selectionStart;
  while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart -= 1;
  let indent = "";
  while (lineStart < selectionStart && /[ \t]/.test(text[lineStart]!)) {
    indent += text[lineStart];
    lineStart += 1;
  }
  // If the previous non-whitespace char is `{` or `(` or `[` or `,`, add a unit.
  const before = text.slice(0, selectionStart).trimEnd();
  const lastChar = before[before.length - 1];
  if (lastChar === "{" || lastChar === "(" || lastChar === "[" || lastChar === ",") {
    return indent + unit;
  }
  return indent;
}

/** A simple cursor / line index for the textarea. */
export function caretPosition(
  text: string,
  position: number
): { line: number; column: number; lineStart: number; lineEnd: number } {
  let lineStart = 0;
  let line = 0;
  for (let i = 0; i < text.length && i < position; i += 1) {
    if (text[i] === "\n") {
      if (i + 1 <= position) {
        line += 1;
        lineStart = i + 1;
      }
    }
  }
  let lineEnd = text.indexOf("\n", lineStart);
  if (lineEnd === -1) lineEnd = text.length;
  return { line, column: position - lineStart, lineStart, lineEnd };
}

export interface FindResult {
  /** Total number of matches. */
  total: number;
  /** The current match position, or -1 if no matches. */
  current: number;
  /** The start index of the current match. */
  start: number;
  /** The end index of the current match (exclusive). */
  end: number;
}

export interface FindOptions {
  /** Case-sensitive match. Defaults to false. */
  caseSensitive?: boolean;
  /** Whole-word match. Defaults to false. */
  wholeWord?: boolean;
  /** Use a regular expression. Defaults to false. */
  regex?: boolean;
}

/** Find all matches in `text` for `query`, returning the total and the index of the
 * match that contains or follows `from`. */
export function findInText(
  text: string,
  query: string,
  from: number,
  options: FindOptions = {}
): FindResult {
  if (!query) return { total: 0, current: -1, start: -1, end: -1 };
  const flags = options.caseSensitive ? "g" : "gi";
  let pattern: RegExp;
  try {
    pattern = options.regex
      ? new RegExp(query, flags)
      : new RegExp(escapeRegex(query), flags);
  } catch {
    return { total: 0, current: -1, start: -1, end: -1 };
  }
  if (options.wholeWord && !options.regex) {
    pattern = new RegExp(`\\b${escapeRegex(query)}\\b`, flags);
  }
  const matches: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    matches.push({ start: m.index, end: m.index + m[0].length });
  }
  if (matches.length === 0) {
    return { total: 0, current: -1, start: -1, end: -1 };
  }
  let current = matches.findIndex((entry) => entry.start >= from);
  if (current === -1) current = 0;
  const match = matches[current]!;
  return { total: matches.length, current, start: match.start, end: match.end };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace one or all matches in `text` according to the find result. */
export function replaceInText(
  text: string,
  query: string,
  replacement: string,
  options: FindOptions & { replaceAll?: boolean; from?: number } = {}
): { next: string; count: number } {
  if (!query) return { next: text, count: 0 };
  // For single-replace we use a non-global regex so the engine
  // matches at most once. For replace-all we keep the global flag.
  const flags = options.caseSensitive
    ? options.replaceAll
      ? "g"
      : ""
    : options.replaceAll
      ? "gi"
      : "i";
  let pattern: RegExp;
  try {
    pattern = options.regex
      ? new RegExp(query, flags)
      : new RegExp(escapeRegex(query), flags);
  } catch {
    return { next: text, count: 0 };
  }
  if (options.wholeWord && !options.regex) {
    // Re-build with the same flag policy so the g flag is
    // preserved when replaceAll is true.
    pattern = new RegExp(`\\b${escapeRegex(query)}\\b`, flags);
  }
  if (!options.replaceAll) {
    // Anchor a non-global pattern to the first match at or after
    // `from`. Setting `lastIndex` before exec lets us find the
    // first match past the cursor.
    const from = Math.max(0, options.from ?? 0);
    pattern.lastIndex = from;
    const exec = pattern.exec(text);
    if (!exec) {
      return { next: text, count: 0 };
    }
    const start = exec.index;
    const end = start + exec[0].length;
    const next = text.slice(0, start) + replacement + text.slice(end);
    return { next, count: 1 };
  }
  let count = 0;
  const next = text.replace(pattern, () => {
    count += 1;
    return replacement;
  });
  return { next, count };
}

/** Return every match in `text` for `query`. */
export function findAllInText(
  text: string,
  query: string,
  options: FindOptions = {}
): Array<{ start: number; end: number }> {
  if (!query) return [];
  const flags = options.caseSensitive ? "g" : "gi";
  let pattern: RegExp;
  try {
    pattern = options.regex
      ? new RegExp(query, flags)
      : new RegExp(escapeRegex(query), flags);
  } catch {
    return [];
  }
  if (options.wholeWord && !options.regex) {
    pattern = new RegExp(`\\b${escapeRegex(query)}\\b`, flags);
  }
  const out: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** A small undo / redo stack with bounded size. */
export class UndoStack {
  private past: string[] = [];
  private future: string[] = [];
  private readonly limit: number;

  constructor(initial: string, limit = 200) {
    this.past = [initial];
    this.limit = limit;
  }

  push(next: string, current: string): void {
    if (next === current) return;
    this.past.push(next);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: string): { previous: string; hasUndo: boolean; hasRedo: boolean } {
    if (this.past.length <= 1) {
      return { previous: current, hasUndo: false, hasRedo: this.future.length > 0 };
    }
    const previous = this.past.pop()!;
    this.future.push(previous);
    const next = this.past[this.past.length - 1]!;
    return { previous: next, hasUndo: this.past.length > 1, hasRedo: this.future.length > 0 };
  }

  redo(current: string): { previous: string; hasUndo: boolean; hasRedo: boolean } {
    if (this.future.length === 0) {
      return { previous: current, hasUndo: this.past.length > 1, hasRedo: false };
    }
    const previous = this.future.pop()!;
    this.past.push(previous);
    return { previous, hasUndo: this.past.length > 1, hasRedo: this.future.length > 0 };
  }

  reset(initial: string): void {
    this.past = [initial];
    this.future = [];
  }
}
