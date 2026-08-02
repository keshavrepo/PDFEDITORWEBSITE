/**
 * JavaScript tool.
 *
 * Format, minify, beautify and validate scripts. Exposes the format
 * helpers plus a small set of utilities the JavaScript editor uses
 * for identifier auto-complete and runtime error reporting.
 */

import { formatJs, minifyJs } from "./format";
import type { FormatResult } from "./format";

export { formatJs, minifyJs };
export type { FormatResult };

/** Reserved words that may not appear as identifiers. */
const JS_RESERVED = new Set([
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
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "await",
  "async",
  "static",
  "undefined",
]);

/**
 * Walk the source and return every identifier that looks like a
 * declaration. Used by the JavaScript editor to seed the
 * auto-complete list.
 */
export function collectDeclaredIdentifiers(input: string): string[] {
  const text = input ?? "";
  const out = new Set<string>();
  const patterns: RegExp[] = [
    /\b(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
    /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
    /\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (!JS_RESERVED.has(m[1]!)) out.add(m[1]!);
    }
  }
  return Array.from(out).sort();
}

/**
 * A small built-in identifier list used for auto-complete when the
 * user's source has no declared identifiers yet. Sorted ascending.
 */
export const JS_BUILTIN_IDENTIFIERS = [
  "Array",
  "Boolean",
  "Date",
  "Error",
  "Function",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Proxy",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "WeakMap",
  "WeakSet",
  "alert",
  "clearInterval",
  "clearTimeout",
  "console",
  "decodeURI",
  "decodeURIComponent",
  "document",
  "encodeURI",
  "encodeURIComponent",
  "fetch",
  "isFinite",
  "isNaN",
  "localStorage",
  "location",
  "navigator",
  "parseFloat",
  "parseInt",
  "queueMicrotask",
  "requestAnimationFrame",
  "requestIdleCallback",
  "setInterval",
  "setTimeout",
  "sessionStorage",
  "window",
].sort();

/** A list of common browser globals exposed in the live preview iframe. */
export const PREVIEW_GLOBALS = [
  "window",
  "document",
  "console",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "fetch",
  "alert",
  "prompt",
  "confirm",
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "URL",
  "URLSearchParams",
  "FormData",
  "Blob",
  "File",
  "FileReader",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "Event",
  "CustomEvent",
  "addEventListener",
  "removeEventListener",
  "querySelector",
  "querySelectorAll",
  "createElement",
  "getElementById",
];

/** A captured console message. */
export interface ConsoleMessage {
  level: "log" | "warn" | "error" | "info";
  parts: string[];
  time: number;
}

export interface ConsoleCapture {
  install(target: { console: Console }): void;
  messages(): ConsoleMessage[];
  clear(): void;
}

/** Build a console capture that records the four standard levels. */
export function createConsoleCapture(): ConsoleCapture {
  const messages: ConsoleMessage[] = [];
  const wrap =
    (level: ConsoleMessage["level"]) =>
    (...args: unknown[]) => {
      messages.push({
        level,
        parts: args.map((arg) => formatArg(arg)),
        time: Date.now(),
      });
    };
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };
  return {
    install(target) {
      target.console.log = wrap("log") as typeof console.log;
      target.console.warn = wrap("warn") as typeof console.warn;
      target.console.error = wrap("error") as typeof console.error;
      target.console.info = wrap("info") as typeof console.info;
    },
    messages() {
      return messages.slice();
    },
    clear() {
      messages.length = 0;
    },
  };
  // Keep the original references reachable so they are not stripped
  // by the bundler.
  void original;
}

function formatArg(arg: unknown): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  if (arg instanceof Error) return arg.stack ?? arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/** Build a sandboxed HTML document for the live preview iframe. */
export function buildPreviewDocument(html: string, css: string, js: string): string {
  // Strip any leading <!doctype> from the user HTML so we can use the
  // iframe srcdoc HTML5 document. Inject our own minimal doctype.
  let userHtml = (html ?? "").replace(/^\s*<!doctype[^>]*>/i, "").trim();
  if (!userHtml.toLowerCase().includes("<html")) {
    userHtml = `<!doctype html><html><head><meta charset="utf-8" /></head><body>${userHtml}</body></html>`;
  }
  const styleBlock = `<style>${css ?? ""}</style>`;
  const scriptBlock = `<script>try {\n${js ?? ""}\n} catch (err) { console.error(err); }<\/script>`;
  if (userHtml.includes("</head>")) {
    userHtml = userHtml.replace(/<\/head>/i, `${styleBlock}</head>`);
  } else if (userHtml.includes("<head>")) {
    userHtml = userHtml.replace(/<head>/i, `<head>${styleBlock}`);
  } else {
    userHtml = `<head>${styleBlock}</head>${userHtml}`;
  }
  if (userHtml.includes("</body>")) {
    userHtml = userHtml.replace(/<\/body>/i, `${scriptBlock}</body>`);
  } else {
    userHtml = `${userHtml}${scriptBlock}`;
  }
  return userHtml;
}
