/**
 * CSS tool.
 *
 * Format, minify and beautify stylesheets. Exposes the format
 * helpers from `format.ts` plus a small set of utilities the CSS
 * editor uses for color extraction and variable detection.
 */

import { formatCss, minifyCss } from "./format";
import type { FormatResult } from "./format";

export { formatCss, minifyCss };
export type { FormatResult };

/** Extract every color reference in a stylesheet. */
export interface ColorReference {
  /** The original text (e.g. "#ff0000", "rgb(...)"). */
  raw: string;
  /** The canonical hex value (lowercase, 6-digit). */
  hex: string;
  /** The starting offset in the source. */
  start: number;
  /** The ending offset in the source (exclusive). */
  end: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = ((clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255))
    .toString(16)
    .padStart(6, "0");
  return "#" + hex;
}

function expandHex(hex: string): string {
  if (hex.length === 3) {
    return hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (hex.length === 4) {
    return hex.slice(0, 3).split("").map((ch) => ch + ch).join("");
  }
  return hex.slice(0, 6);
}

/** Extract every color reference in a stylesheet. */
export function extractColors(input: string): ColorReference[] {
  const out: ColorReference[] = [];
  const text = input ?? "";
  const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
  let m: RegExpExecArray | null;
  while ((m = hexPattern.exec(text)) !== null) {
    const raw = m[0];
    const body = expandHex(m[1]!);
    if (![3, 4, 6, 8].includes(m[1]!.length)) continue;
    out.push({ raw, hex: "#" + body.slice(0, 6).toLowerCase(), start: m.index, end: m.index + raw.length });
  }
  const fnPatterns: Array<{ re: RegExp; parser: (args: string) => [number, number, number] | null }> = [
    {
      re: /\brgba?\(\s*([^)]+)\)/g,
      parser: (args) => {
        const parts = args.split(/[\s,/]+/).filter(Boolean);
        if (parts.length < 3) return null;
        const r = parseChannel(parts[0]!);
        const g = parseChannel(parts[1]!);
        const b = parseChannel(parts[2]!);
        if (r === null || g === null || b === null) return null;
        return [r, g, b];
      },
    },
    {
      re: /\bhsla?\(\s*([^)]+)\)/g,
      parser: (args) => {
        const parts = args.split(/[\s,/]+/).filter(Boolean);
        if (parts.length < 3) return null;
        const h = parseFloat(parts[0]!);
        const s = parsePercent(parts[1]!);
        const l = parsePercent(parts[2]!);
        if (Number.isNaN(h) || s === null || l === null) return null;
        return hslToRgb(h, s, l);
      },
    },
  ];
  for (const { re, parser } of fnPatterns) {
    let n: RegExpExecArray | null;
    while ((n = re.exec(text)) !== null) {
      const rgb = parser(n[1]!);
      if (!rgb) continue;
      out.push({
        raw: n[0],
        hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
        start: n.index,
        end: n.index + n[0].length,
      });
    }
  }
  return out;
}

function parseChannel(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const n = parseFloat(trimmed.slice(0, -1));
    if (Number.isNaN(n)) return null;
    return Math.round((n / 100) * 255);
  }
  const n = parseFloat(trimmed);
  if (Number.isNaN(n)) return null;
  return n;
}

function parsePercent(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const n = parseFloat(trimmed.slice(0, -1));
    if (Number.isNaN(n)) return null;
    return n;
  }
  const n = parseFloat(trimmed);
  if (Number.isNaN(n)) return null;
  return (n / 255) * 100;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return [v, v, v];
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  return [
    Math.round(hueToRgb(p, q, hh + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hh) * 255),
    Math.round(hueToRgb(p, q, hh - 1 / 3) * 255),
  ];
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

/** Extract every CSS variable declaration in a stylesheet. */
export interface CssVariable {
  /** Variable name including the leading `--`. */
  name: string;
  /** Variable value (trimmed). */
  value: string;
  /** Starting offset in the source. */
  start: number;
  /** Ending offset in the source (exclusive). */
  end: number;
}

export function extractVariables(input: string): CssVariable[] {
  const out: CssVariable[] = [];
  const text = input ?? "";
  const pattern = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    out.push({
      name: m[1]!,
      value: m[2]!.trim(),
      start: m.index,
      end: m.index + m[1]!.length,
    });
  }
  return out;
}

/** Return every unique variable reference (var(--name)) in the source. */
export function extractVariableReferences(input: string): string[] {
  const text = input ?? "";
  const pattern = /var\(\s*(--[A-Za-z0-9_-]+)/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    set.add(m[1]!);
  }
  return Array.from(set);
}

/** A short, dependency-free list of common CSS properties for auto-complete. */
export const CSS_PROPERTIES = [
  "align-content",
  "align-items",
  "align-self",
  "animation",
  "background",
  "background-color",
  "background-image",
  "background-position",
  "background-repeat",
  "background-size",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "bottom",
  "box-shadow",
  "box-sizing",
  "color",
  "column-gap",
  "columns",
  "content",
  "cursor",
  "display",
  "filter",
  "flex",
  "flex-basis",
  "flex-direction",
  "flex-flow",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "gap",
  "grid",
  "grid-area",
  "grid-auto-columns",
  "grid-auto-flow",
  "grid-auto-rows",
  "grid-column",
  "grid-row",
  "grid-template",
  "grid-template-areas",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "justify-content",
  "justify-items",
  "justify-self",
  "left",
  "letter-spacing",
  "line-height",
  "list-style",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "object-position",
  "opacity",
  "order",
  "outline",
  "outline-color",
  "outline-offset",
  "outline-style",
  "outline-width",
  "overflow",
  "overflow-wrap",
  "overflow-x",
  "overflow-y",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "pointer-events",
  "position",
  "right",
  "row-gap",
  "text-align",
  "text-decoration",
  "text-indent",
  "text-overflow",
  "text-shadow",
  "text-transform",
  "top",
  "transform",
  "transform-origin",
  "transition",
  "transition-delay",
  "transition-duration",
  "transition-property",
  "transition-timing-function",
  "user-select",
  "vertical-align",
  "visibility",
  "white-space",
  "width",
  "word-break",
  "word-spacing",
  "word-wrap",
  "z-index",
];

/** Common CSS values for auto-complete. */
export const CSS_VALUES = [
  "auto",
  "none",
  "inherit",
  "initial",
  "unset",
  "block",
  "inline",
  "inline-block",
  "flex",
  "grid",
  "inline-flex",
  "inline-grid",
  "table",
  "table-cell",
  "table-row",
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
  "transparent",
  "currentColor",
  "ease",
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
];
