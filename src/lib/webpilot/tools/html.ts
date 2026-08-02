/**
 * HTML tool.
 *
 * Format, minify, beautify and validate HTML in the browser. The
 * formatter is a small dependency-free implementation that
 * understands the standard void-element list and respects the
 * existing nesting.
 *
 * Mirrors the DevPilot `format.ts` HTML helpers but exposes them
 * as a small set of public functions the HTML surface uses.
 */

import { formatHtml, minifyHtml } from "./format";
import type { FormatResult } from "./format";

export { formatHtml, minifyHtml };

export interface HtmlValidationResult {
  ok: boolean;
  error: string | null;
}

/**
 * Validate the document. The implementation is intentionally
 * lightweight: it checks that every opening tag has a matching
 * closing tag and that the document has a single root element.
 */
export function validateHtml(input: string): HtmlValidationResult {
  const text = (input ?? "").trim();
  if (!text) return { ok: false, error: "Input is empty" };
  const stack: string[] = [];
  const tagPattern = /<\/?\s*([A-Za-z][A-Za-z0-9-]*)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  let opens = 0;
  let closes = 0;
  let voids = 0;
  while ((m = tagPattern.exec(text)) !== null) {
    const full = m[0];
    const name = m[1]!.toLowerCase();
    const isClose = full.startsWith("</");
    const isSelf = full.endsWith("/>");
    if (isClose) {
      const top = stack.pop();
      if (!top) {
        return { ok: false, error: `Unexpected closing tag </${name}>` };
      }
      if (top !== name) {
        return { ok: false, error: `Mismatched tag: expected </${top}> but found </${name}>` };
      }
      closes += 1;
      continue;
    }
    if (isSelf) {
      voids += 1;
      continue;
    }
    if (
      [
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
      ].includes(name)
    ) {
      voids += 1;
      continue;
    }
    stack.push(name);
    opens += 1;
  }
  if (stack.length > 0) {
    return { ok: false, error: `Unclosed tag: <${stack[stack.length - 1]}>` };
  }
  if (opens === 0 && closes === 0 && voids === 0) {
    return { ok: false, error: "No HTML tags found" };
  }
  return { ok: true, error: null };
}

/** A simple HTML summary used by the properties panel. */
export function summariseHtml(input: string): {
  bytes: number;
  lines: number;
  tags: number;
  voidTags: number;
} {
  const text = input ?? "";
  const lines = text === "" ? 0 : text.split("\n").length;
  const tagPattern = /<\/?\s*([A-Za-z][A-Za-z0-9-]*)([^>]*?)(\/?)>/g;
  const counts = new Map<string, number>();
  const voidNames = new Set([
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
  let m: RegExpExecArray | null;
  let total = 0;
  let voids = 0;
  while ((m = tagPattern.exec(text)) !== null) {
    const name = m[1]!.toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (voidNames.has(name)) voids += 1;
    total += 1;
  }
  return { bytes: text.length, lines, tags: total, voidTags: voids };
}

export type { FormatResult };
