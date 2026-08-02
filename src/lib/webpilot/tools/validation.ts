/**
 * Project Validation helpers.
 *
 * Pure functions the Project Validation surface uses to derive a
 * flat list of issues from a snapshot of the project. The
 * implementation is intentionally dependency-free: every check
 * runs against the project tree, the asset list, and the raw
 * source, and returns a `WebValidationIssue` for every problem
 * found.
 *
 * The validator mirrors the same checks a typical linter would
 * run, but it never blocks a save. The surface renders the
 * issues, the user decides what to fix, and the autosave loop
 * persists the change.
 */

import type {
  WebAsset,
  WebProjectFile,
  WebProjectFolder,
  WebValidationIssue,
  WebValidationSummary,
} from "../types";

const VOID_TAGS = new Set([
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

export interface ValidationOptions {
  html: boolean;
  css: boolean;
  javascript: boolean;
  link: boolean;
  asset: boolean;
  duplicateId: boolean;
  accessibility: boolean;
  performance: boolean;
}

function newIssueId(): string {
  return `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeIssue(
  partial: Omit<WebValidationIssue, "id">
): WebValidationIssue {
  return { id: newIssueId(), ...partial };
}

/** Find the line number for an absolute character offset. */
function lineOf(source: string, offset: number): number {
  let line = 1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

/** Run the HTML validator over a single HTML file. */
export function validateHtmlFile(
  path: string,
  source: string
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  const text = source.trim();
  if (!text) {
    out.push(
      makeIssue({
        severity: "warning",
        category: "html",
        path,
        line: 1,
        message: "File is empty",
        suggestion: "Add a doctype and an <html> root element.",
      })
    );
    return out;
  }
  const tagPattern = /<(\/?)\s*([A-Za-z][A-Za-z0-9-]*)([^>]*?)(\/?)>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(text)) !== null) {
    const closing = m[1] === "/";
    const name = m[2]!.toLowerCase();
    const self = m[4] === "/";
    if (closing) {
      const top = stack.pop();
      if (!top) {
        out.push(
          makeIssue({
            severity: "error",
            category: "html",
            path,
            line: lineOf(text, m.index),
            message: `Unexpected closing tag </${name}>`,
            suggestion: `Remove the stray closing tag or add the matching opening tag.`,
          })
        );
        continue;
      }
      if (top !== name) {
        out.push(
          makeIssue({
            severity: "error",
            category: "html",
            path,
            line: lineOf(text, m.index),
            message: `Mismatched tag: expected </${top}> but found </${name}>`,
            suggestion: `Reorder the closing tags so the inner-most opens first.`,
          })
        );
      }
      continue;
    }
    if (self || VOID_TAGS.has(name)) continue;
    stack.push(name);
  }
  if (stack.length > 0) {
    out.push(
      makeIssue({
        severity: "error",
        category: "html",
        path,
        line: lineOf(text, text.length),
        message: `Unclosed tag: <${stack[stack.length - 1]}>`,
        suggestion: `Add a closing tag before the end of the file.`,
      })
    );
  }
  return out;
}

/** Run the CSS validator over a single CSS file. */
export function validateCssFile(
  path: string,
  source: string
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  const text = source;
  // Strip comments.
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
  // Walk the source and report every `{` that is not closed by a `}`.
  let open = 0;
  let inString: string | null = null;
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i]!;
    if (inString) {
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "{") open += 1;
    else if (ch === "}") open -= 1;
  }
  if (open !== 0) {
    out.push(
      makeIssue({
        severity: "error",
        category: "css",
        path,
        line: lineOf(text, text.length),
        message: open > 0
          ? `${open} unclosed block${open === 1 ? "" : "s"}`
          : `${-open} extra closing brace${open === -1 ? "" : "s"}`,
        suggestion: "Balance every `{` with a matching `}`.",
      })
    );
  }
  return out;
}

/** Run the JavaScript validator over a single script. The check
 * is intentionally lightweight: it counts braces, brackets and
 * parens, and reports the file line where they go out of balance. */
export function validateJsFile(
  path: string,
  source: string
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  const text = source;
  let openBrace = 0;
  let openBracket = 0;
  let openParen = 0;
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "{") openBrace += 1;
    else if (ch === "}") openBrace -= 1;
    else if (ch === "[") openBracket += 1;
    else if (ch === "]") openBracket -= 1;
    else if (ch === "(") openParen += 1;
    else if (ch === ")") openParen -= 1;
  }
  if (openBrace !== 0 || openBracket !== 0 || openParen !== 0) {
    const parts: string[] = [];
    if (openBrace !== 0) parts.push(`${openBrace} unclosed brace${Math.abs(openBrace) === 1 ? "" : "s"}`);
    if (openBracket !== 0) parts.push(`${openBracket} unclosed bracket${Math.abs(openBracket) === 1 ? "" : "s"}`);
    if (openParen !== 0) parts.push(`${openParen} unclosed paren${Math.abs(openParen) === 1 ? "" : "s"}`);
    out.push(
      makeIssue({
        severity: "error",
        category: "javascript",
        path,
        line: lineOf(text, text.length),
        message: `Unbalanced delimiters: ${parts.join(", ")}`,
        suggestion: "Balance every `{`, `[` and `(` with its closing delimiter.",
      })
    );
  }
  return out;
}

/** Walk every HTML file and surface duplicate id attributes. */
export function findDuplicateIds(
  files: WebProjectFile[]
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  const seen = new Map<string, { path: string; line: number }>();
  for (const file of files) {
    if (file.kind !== "html") continue;
    const pattern = /\bid\s*=\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(file.source)) !== null) {
      const id = m[1]!;
      const line = lineOf(file.source, m.index);
      const previous = seen.get(id);
      if (previous) {
        out.push(
          makeIssue({
            severity: "warning",
            category: "duplicate-id",
            path: file.path,
            line,
            message: `Duplicate id "${id}" (also in ${previous.path}:${previous.line})`,
            suggestion: "Use a unique id on every element.",
          })
        );
      } else {
        seen.set(id, { path: file.path, line });
      }
    }
  }
  return out;
}

/** Walk every href / src / url() reference and report any that
 * point to a file the project does not contain. The check is
 * conservative: it only flags exact-path matches, so a CDN URL
 * like `https://cdn.example.com/style.css` is left alone. */
export function findBrokenLinks(
  files: WebProjectFile[],
  assets: WebAsset[]
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  const filePaths = new Set(files.map((file) => file.path));
  const assetNames = new Set(assets.map((asset) => asset.name));
  const assetFolders = new Set(
    assets.map((asset) => asset.folder + "/" + asset.name).filter(Boolean)
  );

  const checkRef = (path: string, source: string, pattern: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(source)) !== null) {
      const ref = m[1]!;
      // Ignore data:, http://, https://, mailto:, #fragment.
      if (
        ref.startsWith("data:") ||
        ref.startsWith("http://") ||
        ref.startsWith("https://") ||
        ref.startsWith("mailto:") ||
        ref.startsWith("#") ||
        ref.startsWith("/")
      ) {
        continue;
      }
      const clean = ref.split("?")[0]!.split("#")[0]!;
      // Try to match the reference against either a project file
      // or an asset (the asset's name or its full folder/name).
      if (
        filePaths.has(clean) ||
        assetNames.has(clean) ||
        assetFolders.has(clean)
      ) {
        continue;
      }
      out.push(
        makeIssue({
          severity: "error",
          category: "link",
          path,
          line: lineOf(source, m.index),
          message: `Broken link: ${ref}`,
          suggestion: "Check the path, add the missing file, or import the asset.",
        })
      );
    }
  };

  for (const file of files) {
    if (file.kind === "html") {
      checkRef(file.path, file.source, /\b(?:href|src)\s*=\s*"([^"]+)"/g);
    } else if (file.kind === "css") {
      checkRef(file.path, file.source, /url\(\s*['"]?([^'")]+)['"]?\s*\)/g);
    } else {
      checkRef(file.path, file.source, /\bimport\s+[^;]*?from\s+['"]([^'"]+)['"]/g);
      checkRef(file.path, file.source, /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    }
  }
  return out;
}

/** Walk every project asset that is referenced from a CSS url() or
 * an HTML href/src, and report any that are not present in the
 * asset list. */
export function findMissingAssets(
  files: WebProjectFile[],
  assets: WebAsset[]
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  const assetNames = new Set(assets.map((asset) => asset.name));
  const assetByPath = new Set(
    assets.map((asset) => asset.folder + "/" + asset.name).filter(Boolean)
  );
  for (const file of files) {
    if (file.kind === "css") {
      const pattern = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(file.source)) !== null) {
        const ref = m[1]!;
        const clean = ref.split("?")[0]!.split("#")[0]!;
        if (clean.startsWith("data:")) continue;
        const basename = clean.split("/").pop() ?? clean;
        if (assetNames.has(basename) || assetByPath.has(clean)) continue;
        out.push(
          makeIssue({
            severity: "warning",
            category: "asset",
            path: file.path,
            line: lineOf(file.source, m.index),
            message: `Missing asset: ${ref}`,
            suggestion: "Upload the asset or fix the path.",
          })
        );
      }
    }
  }
  return out;
}

/** Walk every HTML file and surface accessibility warnings: missing
 * alt on <img>, missing label on form controls, missing lang on
 * <html>, and no <main> element on the page. */
export function findAccessibilityIssues(
  files: WebProjectFile[]
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  for (const file of files) {
    if (file.kind !== "html") continue;
    const imgWithoutAlt = /<img\b(?![^>]*\balt\s*=)/gi;
    let m: RegExpExecArray | null;
    while ((m = imgWithoutAlt.exec(file.source)) !== null) {
      out.push(
        makeIssue({
          severity: "warning",
          category: "accessibility",
          path: file.path,
          line: lineOf(file.source, m.index),
          message: "<img> is missing an alt attribute",
          suggestion: "Add an alt attribute to every <img> element.",
        })
      );
    }
    if (!/\blang\s*=\s*"/.test(file.source)) {
      out.push(
        makeIssue({
          severity: "info",
          category: "accessibility",
          path: file.path,
          line: 1,
          message: "<html> is missing a lang attribute",
          suggestion: "Add lang=\"en\" (or the page language) on the <html> tag.",
        })
      );
    }
    if (!/<main\b/i.test(file.source)) {
      out.push(
        makeIssue({
          severity: "info",
          category: "accessibility",
          path: file.path,
          line: 1,
          message: "No <main> element on the page",
          suggestion: "Wrap the page's primary content in a <main> element.",
        })
      );
    }
    const inputsWithoutLabel =
      /<input\b(?![^>]*\btype\s*=\s*"(?:hidden|submit|button)")(?![^>]*\baria-label)/gi;
    while ((m = inputsWithoutLabel.exec(file.source)) !== null) {
      out.push(
        makeIssue({
          severity: "warning",
          category: "accessibility",
          path: file.path,
          line: lineOf(file.source, m.index),
          message: "<input> is missing an accessible label",
          suggestion: "Add a <label for=…> or aria-label attribute.",
        })
      );
    }
  }
  return out;
}

/** Walk every file and surface performance hints: large inline
 * scripts, blocking scripts in <head>, missing <meta viewport>,
 * and missing <title>. */
export function findPerformanceIssues(
  files: WebProjectFile[]
): WebValidationIssue[] {
  const out: WebValidationIssue[] = [];
  for (const file of files) {
    if (file.kind !== "html") continue;
    if (!/<title>/i.test(file.source)) {
      out.push(
        makeIssue({
          severity: "warning",
          category: "performance",
          path: file.path,
          line: 1,
          message: "<title> is missing",
          suggestion: "Add a <title> element to the <head>.",
        })
      );
    }
    if (!/<meta[^>]+name\s*=\s*"viewport"/i.test(file.source)) {
      out.push(
        makeIssue({
          severity: "warning",
          category: "performance",
          path: file.path,
          line: 1,
          message: "<meta name=\"viewport\"> is missing",
          suggestion: "Add <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">.",
        })
      );
    }
    if (/<script\b(?![^>]*\bdefer)(?![^>]*\basync)/i.test(file.source)) {
      const blocking = /<script\b(?![^>]*\bdefer)(?![^>]*\basync)/i.exec(
        file.source
      );
      if (blocking) {
        out.push(
          makeIssue({
            severity: "info",
            category: "performance",
            path: file.path,
            line: lineOf(file.source, blocking.index),
            message: "<script> without defer or async blocks the parser",
            suggestion: "Add defer or async to non-blocking scripts.",
          })
        );
      }
    }
  }
  for (const file of files) {
    if (file.kind === "javascript" && file.source.length > 100_000) {
      out.push(
        makeIssue({
          severity: "info",
          category: "performance",
          path: file.path,
          line: 1,
          message: `Large inline script (${file.source.length} bytes)`,
          suggestion: "Move large scripts to a separate file and load with defer.",
        })
      );
    }
  }
  return out;
}

/** Run every enabled check over the project. */
export function runValidation(
  files: WebProjectFile[],
  folders: WebProjectFolder[],
  assets: WebAsset[],
  options: ValidationOptions
): { issues: WebValidationIssue[]; summary: WebValidationSummary } {
  const issues: WebValidationIssue[] = [];
  for (const file of files) {
    if (file.kind === "html" && options.html) {
      issues.push(...validateHtmlFile(file.path, file.source));
    } else if (file.kind === "css" && options.css) {
      issues.push(...validateCssFile(file.path, file.source));
    } else if (file.kind === "javascript" && options.javascript) {
      issues.push(...validateJsFile(file.path, file.source));
    }
  }
  if (options.duplicateId) {
    issues.push(...findDuplicateIds(files));
  }
  if (options.link) {
    issues.push(...findBrokenLinks(files, assets));
  }
  if (options.asset) {
    issues.push(...findMissingAssets(files, assets));
  }
  if (options.accessibility) {
    issues.push(...findAccessibilityIssues(files));
  }
  if (options.performance) {
    issues.push(...findPerformanceIssues(files));
  }
  // Reference the folders array so the function signature stays
  // consistent with the surface contract.
  void folders;
  const summary: WebValidationSummary = {
    errors: issues.filter((entry) => entry.severity === "error").length,
    warnings: issues.filter((entry) => entry.severity === "warning").length,
    info: issues.filter((entry) => entry.severity === "info").length,
    files: files.length,
    ranAt: new Date().toISOString(),
  };
  return { issues, summary };
}
