/**
 * Color tool.
 *
 * Convert between HEX, RGB, HSL and HSV. Generate a five-colour
 * palette from a base colour (monochromatic + complementary) and
 * compute readable contrast ratios for accessibility.
 *
 * All functions are pure and dependency-free so the colour
 * workspace renders consistently in every browser LaunchStack
 * supports.
 */

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

export interface PaletteEntry {
  hex: string;
  name: string;
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normaliseHex(hex: string): string | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;
  let body = match[1]!;
  if (body.length === 3) {
    body = body
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (body.length === 8) body = body.slice(0, 6);
  return "#" + body.toLowerCase();
}

/** Parse a hex string. Returns `null` on invalid input. */
export function parseHex(hex: string): RgbColor | null {
  const normalised = normaliseHex(hex);
  if (!normalised) return null;
  const value = parseInt(normalised.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/** Format an RGB colour as a hex string. */
export function rgbToHex(rgb: RgbColor): string {
  const r = clamp(Math.round(rgb.r), 0, 255);
  const g = clamp(Math.round(rgb.g), 0, 255);
  const b = clamp(Math.round(rgb.b), 0, 255);
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  return "#" + hex;
}

/** Convert RGB to HSL. */
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
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Convert HSL to RGB. */
export function hslToRgb(hsl: HslColor): RgbColor {
  const h = ((hsl.h % 360) + 360) % 360 / 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  function hueToRgb(t: number): number {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  }
  return {
    r: hueToRgb(h + 1 / 3) * 255,
    g: hueToRgb(h) * 255,
    b: hueToRgb(h - 1 / 3) * 255,
  };
}

/** Convert RGB to HSV. */
export function rgbToHsv(rgb: RgbColor): HsvColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  let s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

/** Convert HSV to RGB. */
export function hsvToRgb(hsv: HsvColor): RgbColor {
  const h = ((hsv.h % 360) + 360) % 360 / 60;
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 1) { r = c; g = x; b = 0; }
  else if (h < 2) { r = x; g = c; b = 0; }
  else if (h < 3) { r = 0; g = c; b = x; }
  else if (h < 4) { r = 0; g = x; b = c; }
  else if (h < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
}

function relLuminance(rgb: RgbColor): number {
  const channel = (value: number) => {
    const normalised = value / 255;
    return normalised <= 0.03928
      ? normalised / 12.92
      : Math.pow((normalised + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Compute the WCAG contrast ratio between two colours. */
export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Build a five-colour palette (monochromatic + complementary) from a base colour. */
export function generatePalette(hex: string): PaletteEntry[] {
  const rgb = parseHex(hex);
  if (!rgb) return [];
  const hsl = rgbToHsl(rgb);
  return [
    { hex: rgbToHex({ r: rgb.r, g: rgb.g, b: rgb.b }), name: "Base" },
    { hex: rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l: Math.min(95, hsl.l + 25) })), name: "Tint" },
    { hex: rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l: Math.max(5, hsl.l - 25) })), name: "Shade" },
    { hex: rgbToHex(hslToRgb({ h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l })), name: "Analogous" },
    { hex: rgbToHex(hslToRgb({ h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l })), name: "Complement" },
  ];
}

export interface ColorValidationResult {
  ok: boolean;
  error: string | null;
}

export function validateHex(hex: string): ColorValidationResult {
  const normalised = normaliseHex(hex);
  if (!normalised) return { ok: false, error: "Invalid hex string" };
  return { ok: true, error: null };
}

export interface ColorFormatResult {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
  contrast: number | null;
}

export function formatColor(hex: string, compareHex?: string): ColorFormatResult | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const contrast =
    compareHex && parseHex(compareHex)
      ? contrastRatio(rgb, parseHex(compareHex)!)
      : null;
  return {
    hex: rgbToHex(rgb),
    rgb: `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`,
    hsl: `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`,
    hsv: `hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`,
    contrast,
  };
}
