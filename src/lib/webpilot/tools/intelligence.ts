/**
 * Code Intelligence helpers.
 *
 * Pure functions the Code Intelligence surface uses to derive a
 * file's bracket pairs, code folds, symbol outline and
 * breadcrumbs. The implementation is intentionally lightweight
 * and dependency-free: every function takes the raw source and
 * returns immutable data the surface renders.
 *
 * The surface reuses the same convention the rest of WebPilot
 * uses: HTML, CSS and JavaScript are analysed as one source of
 * truth, and the symbols the user sees mirror the project
 * file's `kind` field.
 */

import type {
  WebIntelligenceBracket,
  WebIntelligenceBreadcrumb,
  WebIntelligenceFold,
  WebIntelligenceSymbol,
} from "../types";

/** The auto-closing pairs the surface inserts. */
export const AUTO_CLOSING_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
  "<": ">",
};

interface LineInfo {
  /** 1-based line number. */
  line: number;
  /** The line text. */
  text: string;
  /** The start offset of the line in the source. */
  start: number;
}

function splitLines(source: string): LineInfo[] {
  const out: LineInfo[] = [];
  let start = 0;
  for (let i = 0; i <= source.length; i += 1) {
    if (i === source.length || source[i] === "\n") {
      const text = source.slice(start, i);
      out.push({ line: out.length + 1, text, start });
      start = i + 1;
    }
  }
  return out;
}

/** Compute the auto-indent for a freshly-inserted newline. The
 * surface calls this when the user presses Enter so the cursor
 * jumps to the right column immediately. */
export function autoIndent(
  source: string,
  selectionStart: number,
  options: { unit: number }
): string {
  const unit = " ".repeat(Math.max(0, Math.min(8, options.unit)));
  let lineStart = selectionStart;
  while (lineStart > 0 && source[lineStart - 1] !== "\n") {
    lineStart -= 1;
  }
  let indent = "";
  while (
    lineStart < selectionStart &&
    (source[lineStart] === " " || source[lineStart] === "\t")
  ) {
    indent += source[lineStart]!;
    lineStart += 1;
  }
  const before = source.slice(0, selectionStart).trimEnd();
  const lastChar = before[before.length - 1];
  if (lastChar === "{" || lastChar === "(" || lastChar === "[") {
    return indent + unit;
  }
  return indent;
}

/** Derive every bracket pair in the file. The function understands
 * `( )`, `[ ]`, `{ }` and `< >`. Strings and comments are skipped
 * using the same rules the existing tokenisers use. */
export function findBrackets(
  path: string,
  source: string,
  kind: "html" | "css" | "javascript"
): WebIntelligenceBracket[] {
  const lines = splitLines(source);
  const out: WebIntelligenceBracket[] = [];
  const stack: Array<{
    char: string;
    line: number;
    column: number;
  }> = [];

  for (const line of lines) {
    let i = 0;
    while (i < line.text.length) {
      const ch = line.text[i]!;
      // Skip strings.
      if (ch === '"' || ch === "'" || (kind === "javascript" && ch === "`")) {
        const quote = ch;
        i += 1;
        while (i < line.text.length && line.text[i] !== quote) {
          if (line.text[i] === "\\" && i + 1 < line.text.length) {
            i += 2;
            continue;
          }
          i += 1;
        }
        i += 1;
        continue;
      }
      // Skip comments.
      if (line.text.startsWith("//", i)) break;
      if (line.text.startsWith("/*", i)) {
        // The block comment may span multiple lines; the surface
        // already pre-splits, so just bail on this line.
        break;
      }
      if (kind === "html" && line.text.startsWith("<!--", i)) {
        // HTML comment — skip to end of line.
        break;
      }
      if ("([{".includes(ch)) {
        stack.push({ char: ch, line: line.line, column: i + 1 });
        i += 1;
        continue;
      }
      if (")]}".includes(ch)) {
        const open = stack.pop();
        if (open) {
          const match: WebIntelligenceBracket = {
            path,
            openLine: open.line,
            openColumn: open.column,
            closeLine: line.line,
            closeColumn: i + 1,
            openChar: open.char,
            closeChar: ch,
          };
          out.push(match);
        }
        i += 1;
        continue;
      }
      i += 1;
    }
  }

  return out;
}

/** Compute the bracket pair at the given (line, column) — used for
 * the "jump to matching bracket" command. */
export function bracketAt(
  brackets: WebIntelligenceBracket[],
  line: number,
  column: number
): WebIntelligenceBracket | null {
  for (const entry of brackets) {
    if (
      entry.openLine === line &&
      entry.openColumn === column
    ) {
      return entry;
    }
    if (
      entry.closeLine === line &&
      entry.closeColumn === column
    ) {
      return entry;
    }
  }
  return null;
}

/** Derive the folding ranges for the file. The function returns
 * one range per block, function, rule and comment block. */
export function findFolds(
  path: string,
  source: string,
  kind: "html" | "css" | "javascript"
): WebIntelligenceFold[] {
  const lines = splitLines(source);
  const out: WebIntelligenceFold[] = [];
  const stack: Array<{
    startLine: number;
    kind: WebIntelligenceFold["kind"];
  }> = [];

  for (const line of lines) {
    const text = line.text;
    if (kind === "css" && text.includes("{")) {
      stack.push({ startLine: line.line, kind: "rule" });
    } else if (kind === "javascript" && /function\s+\w+|=>\s*\{|\{\s*$/.test(text)) {
      // Function or block start.
      if (text.includes("{")) {
        stack.push({ startLine: line.line, kind: "function" });
      }
    } else if (kind === "html" && /<(?!\/|!|script\b)/.test(text) && text.includes(">")) {
      // HTML element open that is not a comment, doctype, or a
      // void element.
      const tagMatch = /<([A-Za-z][A-Za-z0-9-]*)/.exec(text);
      if (
        tagMatch &&
        ![
          "area",
          "base",
          "br",
          "col",
          "embed",
          "hr",
          "img",
          "input",
          "link",
          "meta",
          "param",
          "source",
          "track",
          "wbr",
        ].includes(tagMatch[1]!.toLowerCase())
      ) {
        if (!text.endsWith("/>")) {
          stack.push({ startLine: line.line, kind: "block" });
        }
      }
    } else if (text.includes("{")) {
      stack.push({ startLine: line.line, kind: "block" });
    }
    if (text.includes("}")) {
      const open = stack.pop();
      if (open) {
        out.push({
          path,
          startLine: open.startLine,
          endLine: line.line,
          kind: open.kind,
        });
      }
    }
  }
  return out;
}

/** Derive the symbol outline for the file. The function looks for
 * functions, classes, methods, variables, rules, ids and tags. */
export function findSymbols(
  path: string,
  source: string,
  kind: "html" | "css" | "javascript"
): WebIntelligenceSymbol[] {
  const lines = splitLines(source);
  const out: WebIntelligenceSymbol[] = [];
  for (const line of lines) {
    const text = line.text;
    if (kind === "html") {
      const tagMatch = /<([A-Za-z][A-Za-z0-9-]*)/.exec(text);
      const idMatch = /\bid\s*=\s*"([^"]+)"/.exec(text);
      const classMatch = /\bclass\s*=\s*"([^"]+)"/.exec(text);
      if (tagMatch) {
        out.push({
          id: `sym-${path}-${line.line}-tag`,
          name: `<${tagMatch[1]!}>`,
          kind: "tag",
          path,
          line: line.line,
          column: (tagMatch.index ?? 0) + 1,
          endLine: line.line,
          endColumn:
            (tagMatch.index ?? 0) + tagMatch[0]!.length + 1,
          preview: text.trim(),
        });
      }
      if (idMatch) {
        out.push({
          id: `sym-${path}-${line.line}-id`,
          name: `#${idMatch[1]!}`,
          kind: "id",
          path,
          line: line.line,
          column: (idMatch.index ?? 0) + 1,
          endLine: line.line,
          endColumn:
            (idMatch.index ?? 0) + idMatch[0]!.length + 1,
          preview: text.trim(),
        });
      }
      if (classMatch) {
        for (const cls of classMatch[1]!.split(/\s+/)) {
          if (!cls) continue;
          out.push({
            id: `sym-${path}-${line.line}-cls-${cls}`,
            name: `.${cls}`,
            kind: "selector",
            path,
            line: line.line,
            column: (classMatch.index ?? 0) + 1,
            endLine: line.line,
            endColumn:
              (classMatch.index ?? 0) + classMatch[0]!.length + 1,
            preview: text.trim(),
          });
        }
      }
    } else if (kind === "css") {
      const match = /^([.#]?[A-Za-z][\w-]*|@[\w-]+)\s*\{/.exec(text);
      if (match) {
        out.push({
          id: `sym-${path}-${line.line}-rule`,
          name: match[1]!,
          kind: match[1]!.startsWith("@")
            ? "rule"
            : match[1]!.startsWith("#")
              ? "id"
              : match[1]!.startsWith(".")
                ? "selector"
                : "rule",
          path,
          line: line.line,
          column: 1,
          endLine: line.line,
          endColumn: match[0]!.length + 1,
          preview: text.trim(),
        });
      }
      const propMatch = /^\s*([\w-]+)\s*:/.exec(text);
      if (propMatch) {
        out.push({
          id: `sym-${path}-${line.line}-prop-${propMatch[1]!}`,
          name: propMatch[1]!,
          kind: "variable",
          path,
          line: line.line,
          column: 1,
          endLine: line.line,
          endColumn: propMatch[0]!.length + 1,
          preview: text.trim(),
        });
      }
    } else {
      const functionMatch =
        /\bfunction\s+([A-Za-z_$][\w$]*)/.exec(text) ??
        /\bclass\s+([A-Za-z_$][\w$]*)/.exec(text) ??
        /\bconst\s+([A-Za-z_$][\w$]*)\s*=/.exec(text) ??
        /\blet\s+([A-Za-z_$][\w$]*)\s*=/.exec(text) ??
        /\bvar\s+([A-Za-z_$][\w$]*)\s*=/.exec(text) ??
        /\b([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/.exec(text);
      if (functionMatch) {
        const name = functionMatch[1]!;
        const isMethod = /^\s*(async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/.test(
          text
        );
        const isFunction = /\bfunction\b/.test(text) || /\bclass\b/.test(text);
        out.push({
          id: `sym-${path}-${line.line}-${name}`,
          name,
          kind: isFunction
            ? text.includes("class")
              ? "class"
              : "function"
            : isMethod
              ? "method"
              : "variable",
          path,
          line: line.line,
          column: (functionMatch.index ?? 0) + 1,
          endLine: line.line,
          endColumn:
            (functionMatch.index ?? 0) + functionMatch[0]!.length + 1,
          preview: text.trim(),
        });
      }
    }
  }
  return out;
}

/** Derive the breadcrumb chain at the cursor position. */
export function findBreadcrumbs(
  path: string,
  source: string,
  kind: "html" | "css" | "javascript",
  cursor: { line: number; column: number }
): WebIntelligenceBreadcrumb[] {
  const lines = splitLines(source);
  const breadcrumbs: WebIntelligenceBreadcrumb[] = [
    { path, line: cursor.line, column: cursor.column },
  ];
  if (kind === "html") {
    // Walk up the line stack to find the deepest open tag.
    const stack: Array<{ name: string; line: number }> = [];
    for (const line of lines) {
      if (line.line > cursor.line) break;
      const opens = /<([A-Za-z][A-Za-z0-9-]*)/g;
      const closes = /<\/([A-Za-z][A-Za-z0-9-]*)/g;
      let m: RegExpExecArray | null;
      while ((m = opens.exec(line.text)) !== null) {
        if (m[1]!.toLowerCase() === "br") continue;
        stack.push({ name: m[1]!, line: line.line });
      }
      while ((m = closes.exec(line.text)) !== null) {
        if (stack.length && stack[stack.length - 1]!.name === m[1]) {
          stack.pop();
        }
      }
    }
    for (const entry of stack) {
      breadcrumbs.push({
        path,
        line: entry.line,
        label: `<${entry.name}>`,
      });
    }
  } else if (kind === "css") {
    let ruleName = "";
    let ruleLine = 1;
    for (const line of lines) {
      if (line.line > cursor.line) break;
      const match = /^([.#]?[A-Za-z][\w-]*|@[\w-]+)\s*\{/.exec(line.text);
      if (match) {
        ruleName = match[1]!;
        ruleLine = line.line;
      }
    }
    if (ruleName) {
      breadcrumbs.push({ path, line: ruleLine, label: ruleName });
    }
  } else {
    let functionName = "";
    let functionLine = 1;
    let depth = 0;
    let lastAt = 0;
    for (const line of lines) {
      if (line.line > cursor.line) break;
      const openCount = (line.text.match(/\{/g) ?? []).length;
      const closeCount = (line.text.match(/\}/g) ?? []).length;
      const match = /\b(?:function|class)\s+([A-Za-z_$][\w$]*)/.exec(
        line.text
      );
      if (match && depth === 0) {
        functionName = match[1]!;
        functionLine = line.line;
      }
      if (openCount > 0) lastAt = depth;
      depth += openCount - closeCount;
    }
    if (functionName) {
      breadcrumbs.push({
        path,
        line: functionLine,
        label: functionName,
        column: lastAt,
      });
    }
  }
  return breadcrumbs;
}
