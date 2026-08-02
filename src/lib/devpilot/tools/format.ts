/**
 * Generic formatters for HTML, CSS and JavaScript.
 *
 * Each formatter walks the input character-by-character, tracking
 * bracket depth and string context, and inserts newlines plus the
 * configured indent. No regex shortcuts — the implementation is
 * small enough to reason about and handles every common case the
 * user will paste.
 *
 * The minifier is the inverse: drop whitespace, drop comments,
 * keep the source semantically identical. JavaScript minification
 * strips block and line comments and collapses whitespace outside
 * string / regex / template literals.
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

const VOID_ELEMENTS = new Set([
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

/** Format / beautify HTML. */
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

  function skipWhitespace() {
    while (i < text.length && /\s/.test(text[i]!)) i += 1;
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
    const tagName = extractTagName(raw);
    const isVoid = tagName ? VOID_ELEMENTS.has(tagName.toLowerCase()) : false;

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

function extractTagName(raw: string): string | null {
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

/** Format / beautify CSS. */
export function formatCss(input: string, options: { indent?: number } = {}): FormatResult {
  const indentUnit = " ".repeat(Math.max(0, Math.min(8, options.indent ?? 2)));
  const text = stripCssComments(input ?? "");
  if (!text.trim()) return { ok: true, formatted: "", error: null };

  const out: string[] = [];
  let depth = 0;
  let i = 0;
  let inAtRule = false;

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
      inAtRule = false;
      i += 1;
      continue;
    }
    if (ch === "{") {
      out.push(" {");
      depth += 1;
      newline(depth);
      inAtRule = false;
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

  function top(): { indent: number; context: JsContext } {
    return stack[stack.length - 1]!;
  }

  function pushNewline(level: number) {
    out.push("\n" + repeat(indentUnit, Math.max(0, level)));
  }

  while (i < text.length) {
    const ch = text[i]!;
    const context = top().context;

    if (context === "single") {
      out.push(ch);
      if (ch === "\\" && i + 1 < text.length) {
        out.push(text[i + 1]!);
        i += 2;
        continue;
      }
      if (ch === "'") {
        stack.pop();
      }
      i += 1;
      continue;
    }
    if (context === "double") {
      out.push(ch);
      if (ch === "\\" && i + 1 < text.length) {
        out.push(text[i + 1]!);
        i += 2;
        continue;
      }
      if (ch === '"') {
        stack.pop();
      }
      i += 1;
      continue;
    }
    if (context === "template") {
      out.push(ch);
      if (ch === "\\" && i + 1 < text.length) {
        out.push(text[i + 1]!);
        i += 2;
        continue;
      }
      if (ch === "`") {
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
    if (ch === "'") {
      out.push("'");
      stack.push({ indent: top().indent, context: "single" });
      i += 1;
      continue;
    }
    if (ch === '"') {
      out.push('"');
      stack.push({ indent: top().indent, context: "double" });
      i += 1;
      continue;
    }
    if (ch === "`") {
      out.push("`");
      stack.push({ indent: top().indent, context: "template" });
      i += 1;
      continue;
    }
    if (ch === "{") {
      out.push("{");
      const nextContext: JsContext = "code";
      stack.push({ indent: top().indent + 1, context: nextContext });
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
      out.push(",");
      if (top().indent > 0) {
        // Stay on the same line for short lists.
        const next = text[i + 1];
        if (next && next === " ") i += 1;
        out.push(" ");
      } else {
        pushNewline(top().indent);
      }
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

/** Minify JavaScript by stripping comments and collapsing whitespace. */
export function minifyJs(input: string): FormatResult {
  const text = input ?? "";
  let out = "";
  let i = 0;
  let lastWasSpace = false;
  let context: JsContext = "code";

  while (i < text.length) {
    const ch = text[i]!;

    if (context === "single") {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1]!;
        i += 2;
        continue;
      }
      if (ch === "'") context = "code";
      lastWasSpace = false;
      i += 1;
      continue;
    }
    if (context === "double") {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1]!;
        i += 2;
        continue;
      }
      if (ch === '"') context = "code";
      lastWasSpace = false;
      i += 1;
      continue;
    }
    if (context === "template") {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1]!;
        i += 2;
        continue;
      }
      if (ch === "`") context = "code";
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
    if (ch === "'") {
      context = "single";
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      context = "double";
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "`") {
      context = "template";
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return { ok: true, formatted: out.replace(/[ \t]+\n/g, "\n").trim(), error: null };
}

export interface JsHighlightToken {
  text: string;
  kind: "keyword" | "string" | "number" | "comment" | "punct" | "identifier";
}

const JS_KEYWORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "export", "extends", "finally", "for",
  "function", "if", "import", "in", "instanceof", "let", "new", "of", "return",
  "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while",
  "with", "yield", "async", "static", "true", "false", "null", "undefined",
]);

/** Tokenise JavaScript for the keyword-highlight view. */
export function highlightJs(input: string): JsHighlightToken[] {
  const out: JsHighlightToken[] = [];
  const text = input ?? "";
  let i = 0;
  let context: JsContext = "code";

  while (i < text.length) {
    const ch = text[i]!;
    if (context === "single") {
      if (ch === "\\" && i + 1 < text.length) {
        out.push({ text: ch + text[i + 1]!, kind: "string" });
        i += 2;
        continue;
      }
      if (ch === "'") {
        out.push({ text: ch, kind: "string" });
        context = "code";
        i += 1;
        continue;
      }
      out.push({ text: ch, kind: "string" });
      i += 1;
      continue;
    }
    if (context === "double") {
      if (ch === "\\" && i + 1 < text.length) {
        out.push({ text: ch + text[i + 1]!, kind: "string" });
        i += 2;
        continue;
      }
      if (ch === '"') {
        out.push({ text: ch, kind: "string" });
        context = "code";
        i += 1;
        continue;
      }
      out.push({ text: ch, kind: "string" });
      i += 1;
      continue;
    }
    if (context === "template") {
      if (ch === "\\" && i + 1 < text.length) {
        out.push({ text: ch + text[i + 1]!, kind: "string" });
        i += 2;
        continue;
      }
      if (ch === "`") {
        out.push({ text: ch, kind: "string" });
        context = "code";
        i += 1;
        continue;
      }
      out.push({ text: ch, kind: "string" });
      i += 1;
      continue;
    }
    if (context === "line-comment") {
      if (ch === "\n") {
        context = "code";
        out.push({ text: ch, kind: "comment" });
        i += 1;
        continue;
      }
      out.push({ text: ch, kind: "comment" });
      i += 1;
      continue;
    }
    if (context === "block-comment") {
      if (ch === "*" && text[i + 1] === "/") {
        out.push({ text: "*/", kind: "comment" });
        context = "code";
        i += 2;
        continue;
      }
      out.push({ text: ch, kind: "comment" });
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      out.push({ text: ch, kind: "punct" });
      i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      out.push({ text: "//", kind: "comment" });
      context = "line-comment";
      i += 2;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      out.push({ text: "/*", kind: "comment" });
      context = "block-comment";
      i += 2;
      continue;
    }
    if (ch === "'") {
      out.push({ text: ch, kind: "string" });
      context = "single";
      i += 1;
      continue;
    }
    if (ch === '"') {
      out.push({ text: ch, kind: "string" });
      context = "double";
      i += 1;
      continue;
    }
    if (ch === "`") {
      out.push({ text: ch, kind: "string" });
      context = "template";
      i += 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[0-9.xXbBeE_]/.test(text[j]!)) j += 1;
      out.push({ text: text.slice(i, j), kind: "number" });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_$]/.test(text[j]!)) j += 1;
      const word = text.slice(i, j);
      if (JS_KEYWORDS.has(word)) {
        out.push({ text: word, kind: "keyword" });
      } else {
        out.push({ text: word, kind: "identifier" });
      }
      i = j;
      continue;
    }
    out.push({ text: ch, kind: "punct" });
    i += 1;
  }
  return out;
}
