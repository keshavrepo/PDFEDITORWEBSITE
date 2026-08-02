/**
 * XML tool.
 *
 * Format, beautify, minify and validate an XML document. Validation
 * and formatting use the `fast-xml-parser` library, which is
 * already a LaunchStack dependency. Minification is a tiny
 * dependency-free pass that strips whitespace between tags.
 */

import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface XmlFormatResult {
  ok: boolean;
  formatted: string;
  error: string | null;
}

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  parseAttributeValue: false,
  trimValues: true,
};

/** Format / beautify an XML string. */
export function formatXml(
  input: string,
  options: { indent?: number } = {}
): XmlFormatResult {
  const text = (input ?? "").trim();
  if (!text) return { ok: true, formatted: "", error: null };

  const validation = XMLValidator.validate(text, {
    allowBooleanAttributes: true,
  });
  if (validation !== true) {
    const message =
      typeof validation === "object" && validation
        ? `Invalid XML: ${validation.err.msg} at line ${validation.err.line}`
        : "Invalid XML";
    return { ok: false, formatted: "", error: message };
  }

  const indent = " ".repeat(Math.max(0, Math.min(8, options.indent ?? 2)));
  try {
    const parser = new XMLParser(PARSER_OPTIONS);
    const parsed = parser.parse(text);
    const formatted = serialiseNode(parsed, indent, 0);
    return { ok: true, formatted: formatted.trimEnd() + "\n", error: null };
  } catch (err) {
    return { ok: false, formatted: "", error: err instanceof Error ? err.message : "Format failed" };
  }
}

interface ParsedNode {
  [key: string]: unknown;
}

function tagName(node: ParsedNode): string | null {
  const keys = Object.keys(node);
  for (const key of keys) {
    if (key === ":@") continue;
    if (key.startsWith("#")) continue;
    return key;
  }
  return null;
}

function attributesOf(node: ParsedNode): Record<string, string> {
  const attrs = node[":@"] as Record<string, unknown> | undefined;
  if (!attrs) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("@_")) {
      out[key.slice(2)] = String(value);
    }
  }
  return out;
}

function nodeBody(node: ParsedNode): unknown {
  for (const key of Object.keys(node)) {
    if (key === ":@") continue;
    if (key.startsWith("#")) return node[key];
  }
  return null;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serialiseNode(
  node: ParsedNode,
  indent: string,
  depth: number
): string {
  const name = tagName(node);
  if (!name) return "";
  const attrs = attributesOf(node);
  const body = nodeBody(node);

  const attrString = Object.keys(attrs).length
    ? " " +
      Object.entries(attrs)
        .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
        .join(" ")
    : "";

  if (body === null || body === undefined) {
    return `${indent.repeat(depth)}<${name}${attrString} />`;
  }
  if (typeof body === "string") {
    if (body.trim() === "" && body.includes("\n")) {
      return `${indent.repeat(depth)}<${name}${attrString}>\n${body}\n${indent.repeat(depth)}</${name}>`;
    }
    return `${indent.repeat(depth)}<${name}${attrString}>${escapeText(body)}</${name}>`;
  }
  if (Array.isArray(body)) {
    const inner = body
      .map((entry) => serialiseNode(entry as ParsedNode, indent, depth + 1))
      .join("\n");
    return `${indent.repeat(depth)}<${name}${attrString}>\n${inner}\n${indent.repeat(depth)}</${name}>`;
  }
  if (body && typeof body === "object") {
    const inner = serialiseNode(body as ParsedNode, indent, depth + 1);
    return `${indent.repeat(depth)}<${name}${attrString}>\n${inner}\n${indent.repeat(depth)}</${name}>`;
  }
  return `${indent.repeat(depth)}<${name}${attrString}>${escapeText(String(body))}</${name}>`;
}

/** Minify an XML string by stripping whitespace between tags. */
export function minifyXml(input: string): XmlFormatResult {
  const text = (input ?? "").trim();
  if (!text) return { ok: true, formatted: "", error: null };
  const validation = XMLValidator.validate(text, {
    allowBooleanAttributes: true,
  });
  if (validation !== true) {
    const message =
      typeof validation === "object" && validation
        ? `Invalid XML: ${validation.err.msg} at line ${validation.err.line}`
        : "Invalid XML";
    return { ok: false, formatted: "", error: message };
  }
  try {
    const parser = new XMLParser(PARSER_OPTIONS);
    const parsed = parser.parse(text);
    const formatted = serialiseNode(parsed, "", 0);
    return { ok: true, formatted: formatted.replace(/\s+/g, " ").trim() + "\n", error: null };
  } catch (err) {
    return { ok: false, formatted: "", error: err instanceof Error ? err.message : "Minify failed" };
  }
}

export interface XmlValidationResult {
  ok: boolean;
  error: string | null;
}

export function validateXml(input: string): XmlValidationResult {
  const text = (input ?? "").trim();
  if (!text) return { ok: false, error: "Input is empty" };
  const result = XMLValidator.validate(text, { allowBooleanAttributes: true });
  if (result === true) return { ok: true, error: null };
  if (typeof result === "object" && result) {
    return { ok: false, error: `${result.err.msg} at line ${result.err.line}` };
  }
  return { ok: false, error: "Invalid XML" };
}
