/**
 * Developer Utilities helpers.
 *
 * Pure functions the Utilities surface uses for the eight small
 * web-development tools: Color Picker, Gradient Generator, Box
 * Shadow Generator, Border Radius Generator, CSS Unit Converter,
 * HTML Entity, Base64 and URL codecs.
 *
 * Every helper is dependency-free so the surface can call it from
 * either a useMemo (preview) or an event handler (apply).
 */

import type { WebGradientStop, WebUtilitiesBody } from "../types";

/* -------------------------------------------------------------------------- */
/* Color helpers                                                             */
/* -------------------------------------------------------------------------- */

const HEX_RE = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function expandHex(hex: string): string {
  const cleaned = hex.replace(/^#/, "").toLowerCase();
  if (cleaned.length === 3) {
    return cleaned
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (cleaned.length === 4) {
    return cleaned
      .slice(0, 3)
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return cleaned.slice(0, 6);
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex.trim());
}

export function normaliseHex(hex: string): string {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return "#000000";
  return "#" + expandHex(match[1]!).toLowerCase();
}

export function hexToRgb(hex: string): RgbColor {
  const normalised = normaliseHex(hex);
  return {
    r: parseInt(normalised.slice(1, 3), 16),
    g: parseInt(normalised.slice(3, 5), 16),
    b: parseInt(normalised.slice(5, 7), 16),
  };
}

export function rgbToHex(rgb: RgbColor): string {
  const r = clamp(Math.round(rgb.r), 0, 255);
  const g = clamp(Math.round(rgb.g), 0, 255);
  const b = clamp(Math.round(rgb.b), 0, 255);
  return (
    "#" +
    [r, g, b]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(hsl: HslColor): RgbColor {
  const h = (((hsl.h % 360) + 360) % 360) / 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
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

export function rgbToHsv(rgb: RgbColor): HsvColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

export function hsvToRgb(hsv: HsvColor): RgbColor {
  const h = (((hsv.h % 360) + 360) % 360) / 60;
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 1) {
    r = c;
    g = x;
  } else if (h < 2) {
    r = x;
    g = c;
  } else if (h < 3) {
    g = c;
    b = x;
  } else if (h < 4) {
    g = x;
    b = c;
  } else if (h < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export interface ColorFormats {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
}

export function formatColor(hex: string): ColorFormats {
  const normalised = normaliseHex(hex);
  const rgb = hexToRgb(normalised);
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  return {
    hex: normalised,
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`,
    hsv: `hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`,
  };
}

/* -------------------------------------------------------------------------- */
/* Gradient helpers                                                          */
/* -------------------------------------------------------------------------- */

export function buildGradientCss(
  type: WebUtilitiesBody["gradientType"],
  angle: number,
  stops: WebGradientStop[]
): string {
  const sorted = [...stops]
    .map((stop) => ({ ...stop }))
    .sort((a, b) => a.position - b.position);
  const colourStops = sorted
    .map((stop) => `${stop.color} ${Math.round(clamp(stop.position, 0, 100))}%`)
    .join(", ");
  if (type === "radial") {
    return `radial-gradient(circle, ${colourStops})`;
  }
  return `linear-gradient(${Math.round(clamp(angle, 0, 360))}deg, ${colourStops})`;
}

/* -------------------------------------------------------------------------- */
/* Shadow helpers                                                            */
/* -------------------------------------------------------------------------- */

export function buildBoxShadowCss(input: {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}): string {
  const parts = [
    `${Math.round(input.offsetX)}px`,
    `${Math.round(input.offsetY)}px`,
    `${Math.round(input.blur)}px`,
    `${Math.round(input.spread)}px`,
    input.color,
  ];
  return `${input.inset ? "inset " : ""}${parts.join(" ")}`;
}

/* -------------------------------------------------------------------------- */
/* Border-radius helpers                                                     */
/* -------------------------------------------------------------------------- */

export function buildBorderRadiusCss(input: {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}): string {
  const allEqual =
    input.topLeft === input.topRight &&
    input.topRight === input.bottomRight &&
    input.bottomRight === input.bottomLeft;
  if (allEqual) return `${Math.round(input.topLeft)}px`;
  return [
    Math.round(input.topLeft),
    Math.round(input.topRight),
    Math.round(input.bottomRight),
    Math.round(input.bottomLeft),
  ]
    .map((value) => `${value}px`)
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Unit converter helpers                                                    */
/* -------------------------------------------------------------------------- */

export type UnitName = WebUtilitiesBody["unitFrom"];

const ALL_UNITS: UnitName[] = ["px", "rem", "em", "pt", "vw", "vh", "%"];

const UNIT_PX_PER_PT = 4 / 3; // 1pt = 1.333... px

export function convertUnit(
  value: number,
  from: UnitName,
  to: UnitName,
  options: { baseFontSize: number; baseViewportWidth: number; baseViewportHeight: number }
): number {
  if (!Number.isFinite(value)) return 0;
  // First, convert to px.
  let px: number;
  switch (from) {
    case "px":
      px = value;
      break;
    case "rem":
    case "em":
      px = value * (options.baseFontSize || 16);
      break;
    case "pt":
      px = value * UNIT_PX_PER_PT;
      break;
    case "vw":
      px = (value / 100) * (options.baseViewportWidth || 1280);
      break;
    case "vh":
      px = (value / 100) * (options.baseViewportHeight || 720);
      break;
    case "%":
      // For percent conversions, treat the value as a fraction of
      // the base font size (a common convention in design tools).
      px = (value / 100) * (options.baseFontSize || 16);
      break;
    default:
      px = value;
      break;
  }
  // Then convert from px to the target unit.
  switch (to) {
    case "px":
      return px;
    case "rem":
    case "em":
      return px / (options.baseFontSize || 16);
    case "pt":
      return px / UNIT_PX_PER_PT;
    case "vw":
      return (px / (options.baseViewportWidth || 1280)) * 100;
    case "vh":
      return (px / (options.baseViewportHeight || 720)) * 100;
    case "%":
      return (px / (options.baseFontSize || 16)) * 100;
    default:
      return px;
  }
}

export const ALL_UNIT_NAMES = ALL_UNITS;

/* -------------------------------------------------------------------------- */
/* HTML entity encoder / decoder                                             */
/* -------------------------------------------------------------------------- */

const HTML_ENTITIES: Array<[RegExp, string]> = [
  [/&/g, "&amp;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"],
  [/"/g, "&quot;"],
  [/'/g, "&#39;"],
];

export function encodeHtmlEntities(input: string): string {
  let next = input;
  for (const [pattern, replacement] of HTML_ENTITIES) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

const HTML_NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: "\u00a0",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  hellip: "\u2026",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  middot: "\u00b7",
  deg: "\u00b0",
  times: "\u00d7",
  divide: "\u00f7",
  plusmn: "\u00b1",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith("#")) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named = HTML_NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

/* -------------------------------------------------------------------------- */
/* Base64 and URL codecs                                                     */
/* -------------------------------------------------------------------------- */

/** Best-effort UTF-8 safe base64 encode (browser + Node 18+). */
export function encodeBase64(input: string): string {
  if (typeof btoa === "function") {
    const binary = unescape(encodeURIComponent(input));
    return btoa(binary);
  }
  const g = globalThis as { Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } } };
  if (g.Buffer) return g.Buffer.from(input, "utf-8").toString("base64");
  return input;
}

/** Best-effort UTF-8 safe base64 decode. Throws on invalid input. */
export function decodeBase64(input: string): string {
  const cleaned = (input ?? "").trim().replace(/\s+/g, "");
  if (!cleaned) return "";
  if (typeof atob === "function") {
    const binary = atob(cleaned);
    return decodeURIComponent(escape(binary));
  }
  const g = globalThis as { Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } } };
  if (g.Buffer) return g.Buffer.from(cleaned, "base64").toString("utf-8");
  throw new Error("No base64 decoder available");
}

export function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}

export function decodeUrl(input: string): string {
  return decodeURIComponent(input);
}
