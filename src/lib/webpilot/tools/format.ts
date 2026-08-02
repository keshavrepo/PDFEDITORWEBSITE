/**
 * Formatters and minifiers for the WebPilot editors.
 *
 * Each formatter walks the source character-by-character, tracking
 * bracket depth and string context, and inserts newlines plus the
 * configured indent. The minifier is the inverse: drop comments,
 * collapse whitespace, preserve the source semantics.
 *
 * These are dependency-free implementations that run in the browser
 * and on the server so the workspace can format or minify any time.
 */

export interface FormatResult {
  ok: boolean;
  formatted: string;
  error: string | null;
}

function repeat(text: string, count: number): string {
  if (count <= 0) return "";
  let out = "";
  for (let i = 0; i < count; i += 1) out += text;
  return out;
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                       */
/* -------------------------------------------------------------------------- */

const HTML_VOID = new Set([
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
]);

/** Format / beautify an HTML document. */
export function formatHtml(input: string, options: { indent?: number } = {}): FormatResult {
  const indentUnit = " ".repeat(Math.max(0, Math.min(8, options.indent ?? 2)));
  const text = (input ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return { ok: true, formatted: "", error: null };

  const out: string[] = [];
  let depth = 0;
  let i = 0;

  function pushNewline() {
    out.push("\n");
  }
  function pushIndent() {
    out.push(repeat(indentUnit, Math.max(0, depth)));
  }

  while (i < text.length) {
    if (/\s/.test(text[i]!)) {
      i += 1;
      continue;
    }
    if (text[i] !== "<") {
      // Loose text node.
      let j = i;
      while (j < text.length && text[j] !== "<") j += 1;
      const value = text.slice(i, j);
      if (value.trim()) {
        if (out.length > 0 && !out[out.length - 1]!.endsWith("\n")) pushNewline();
        pushIndent();
        out.push(value.trim());
        pushNewline();
      }
      i = j;
      continue;
    }
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i);
      const stop = end === -1 ? text.length : end + 3;
      if (out.length > 0 && !out[out.length - 1]!.endsWith("\n")) pushNewline();
      pushIndent();
      out.push(text.slice(i, stop));
      pushNewline();
      i = stop;
      continue;
    }
    if (text.startsWith("<!", i) || text.startsWith("<?", i)) {
      const end = text.indexOf(">", i);
      const stop = end === -1 ? text.length : end + 1;
      if (out.length > 0 && !out[out.length - 1]!.endsWith("\n")) pushNewline();
      pushIndent();
      out.push(text.slice(i, stop));
      pushNewline();
      i = stop;
      continue;
    }
    // Element open / close tag.
    let j = i + 1;
    while (j < text.length && text[j] !== ">") j += 1;
    const tagEnd = j === text.length ? j : j + 1;
    const raw = text.slice(i, tagEnd);
    const isClose = raw.startsWith("</");
    const tagName = extractHtmlTagName(raw);
    const isVoid = tagName ? HTML_VOID.has(tagName.toLowerCase()) : false;

    if (!isClose) {
      if (out.length > 0 && !out[out.length - 1]!.endsWith("\n")) pushNewline();
      pushIndent();
      out.push(raw);
      pushNewline();
      if (!isVoid && !raw.endsWith("/>")) {
        depth += 1;
      }
    } else {
      depth = Math.max(0, depth - 1);
      if (out.length > 0 && !out[out.length - 1]!.endsWith("\n")) pushNewline();
      pushIndent();
      out.push(raw);
      pushNewline();
    }
    i = tagEnd;
  }

  return { ok: true, formatted: out.join("").replace(/\n{3,}/g, "\n\n").trim() + "\n", error: null };
}

function extractHtmlTagName(raw: string): string | null {
  const match = raw.match(/^<\/?\s*([A-Za-z][A-Za-z0-9-]*)/);
  return match ? match[1]! : null;
}

/** Minify HTML by collapsing whitespace and dropping comments. */
export function minifyHtml(input: string): FormatResult {
  let text = (input ?? "").replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
  return { ok: true, formatted: text, error: null };
}

/* -------------------------------------------------------------------------- */
/* CSS                                                                        */
/* -------------------------------------------------------------------------- */

/** Format / beautify a stylesheet. */
export function formatCss(input: string, options: { indent?: number } = {}): FormatResult {
  const indentUnit = " ".repeat(Math.max(0, Math.min(8, options.indent ?? 2)));
  const text = stripCssComments(input ?? "");
  if (!text.trim()) return { ok: true, formatted: "", error: null };

  const out: string[] = [];
  let depth = 0;
  let i = 0;

  function newline(level: number) {
    out.push("\n" + repeat(indentUnit, level));
  }

  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      newline(depth);
      out.push("}");
      i += 1;
      continue;
    }
    if (ch === "{") {
      out.push(" {");
      depth += 1;
      newline(depth);
      i += 1;
      continue;
    }
    if (ch === ";") {
      out.push(";");
      newline(depth);
      i += 1;
      continue;
    }
    if (ch === ":") {
      out.push(": ");
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\" && j + 1 < text.length) {
          j += 2;
          continue;
        }
        if (text[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      out.push(text.slice(i, j));
      i = j;
      continue;
    }
    out.push(ch);
    i += 1;
  }

  const joined = out.join("").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { ok: true, formatted: joined, error: null };
}

function stripCssComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Minify CSS. */
export function minifyCss(input: string): FormatResult {
  const text = stripCssComments(input ?? "")
    .replace(/\s*([{};:])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { ok: true, formatted: text, error: null };
}

/* -------------------------------------------------------------------------- */
/* JavaScript                                                                 */
/* -------------------------------------------------------------------------- */

type JsContext = "code" | "single" | "double" | "template" | "line-comment" | "block-comment";

/** Format / beautify JavaScript. */
export function formatJs(input: string, options: { indent?: number } = {}): FormatResult {
  const indentUnit = " ".repeat(Math.max(0, Math.min(8, options.indent ?? 2)));
  const text = (input ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return { ok: true, formatted: "", error: null };

  const out: string[] = [];
  const stack: { indent: number; context: JsContext }[] = [{ indent: 0, context: "code" }];
  let i = 0;

  function top() {
    return stack[stack.length - 1]!;
  }
  function pushNewline(level: number) {
    out.push("\n" + repeat(indentUnit, Math.max(0, level)));
  }

  while (i < text.length) {
    const ch = text[i]!;
    const context = top().context;

    if (context === "single" || context === "double" || context === "template") {
      out.push(ch);
      if (ch === "\\" && i + 1 < text.length) {
        out.push(text[i + 1]!);
        i += 2;
        continue;
      }
      if (
        (context === "single" && ch === "'") ||
        (context === "double" && ch === '"') ||
        (context === "template" && ch === "`")
      ) {
        stack.pop();
      }
      i += 1;
      continue;
    }
    if (context === "line-comment") {
      if (ch === "\n") {
        stack.pop();
        pushNewline(top().indent);
      } else {
        out.push(ch);
      }
      i += 1;
      continue;
    }
    if (context === "block-comment") {
      if (ch === "*" && text[i + 1] === "/") {
        out.push("*/");
        stack.pop();
        i += 2;
        continue;
      }
      out.push(ch);
      i += 1;
      continue;
    }
    // Code context.
    if (ch === " " || ch === "\t" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      out.push("//");
      stack.push({ indent: top().indent, context: "line-comment" });
      i += 2;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      out.push("/*");
      stack.push({ indent: top().indent, context: "block-comment" });
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      out.push(ch);
      stack.push({
        indent: top().indent,
        context: ch === "'" ? "single" : ch === '"' ? "double" : "template",
      });
      i += 1;
      continue;
    }
    if (ch === "{") {
      out.push("{");
      stack.push({ indent: top().indent + 1, context: "code" });
      pushNewline(top().indent);
      i += 1;
      continue;
    }
    if (ch === "}") {
      stack.pop();
      const parent = top();
      out.push("}");
      pushNewline(parent.indent);
      i += 1;
      continue;
    }
    if (ch === ";") {
      out.push(";");
      pushNewline(top().indent);
      i += 1;
      continue;
    }
    if (ch === ",") {
      out.push(", ");
      i += 1;
      continue;
    }
    out.push(ch);
    i += 1;
  }

  return {
    ok: true,
    formatted: out.join("").replace(/\n{3,}/g, "\n\n").trim() + "\n",
    error: null,
  };
}

/** Minify JavaScript. */
export function minifyJs(input: string): FormatResult {
  const text = input ?? "";
  let out = "";
  let i = 0;
  let lastWasSpace = false;
  let context: JsContext = "code";

  while (i < text.length) {
    const ch = text[i]!;
    if (context === "single" || context === "double" || context === "template") {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1]!;
        i += 2;
        continue;
      }
      if (
        (context === "single" && ch === "'") ||
        (context === "double" && ch === '"') ||
        (context === "template" && ch === "`")
      ) {
        context = "code";
      }
      lastWasSpace = false;
      i += 1;
      continue;
    }
    if (context === "line-comment") {
      if (ch === "\n") {
        out += "\n";
        lastWasSpace = false;
        context = "code";
      }
      i += 1;
      continue;
    }
    if (context === "block-comment") {
      if (ch === "*" && text[i + 1] === "/") {
        context = "code";
        i += 2;
        continue;
      }
      if (ch === "\n") out += "\n";
      i += 1;
      continue;
    }
    // Code context.
    if (ch === " " || ch === "\t" || ch === "\n") {
      if (!lastWasSpace) out += " ";
      lastWasSpace = true;
      i += 1;
      continue;
    }
    lastWasSpace = false;
    if (ch === "/" && text[i + 1] === "/") {
      context = "line-comment";
      i += 2;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      context = "block-comment";
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      out += ch;
      context = ch === "'" ? "single" : ch === '"' ? "double" : "template";
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return { ok: true, formatted: out.replace(/[ \t]+\n/g, "\n").trim(), error: null };
}
