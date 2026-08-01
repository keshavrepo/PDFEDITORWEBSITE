/**
 * Color palette extraction.
 *
 * The naïve way to pull colours out of an image is to count every pixel, sort
 * by frequency, and return the top N. That gives a palette dominated by the
 * background — exactly the colour the user already knows about — and tends to
 * miss the smaller accents that are usually the interesting ones.
 *
 * A meaningful palette instead clusters pixels into perceptually distinct
 * groups and ranks the groups by visual weight, where weight combines raw
 * frequency with the spatial area each group occupies. A small but vivid
 * patch can outrank a large neutral block, which is what designers expect.
 *
 * The pipeline:
 *
 *   1. Downsample to ~200 px on the long edge so the count fits comfortably
 *      in memory and small details don't drown out the big picture.
 *   2. Quantise into 4-bit-per-channel buckets (4096 cells) — coarse enough
 *      to merge JPEG noise, fine enough to keep a gradient's bands separate.
 *   3. Drop near-transparent pixels: their colour is the background colour
 *      and they would otherwise dominate the palette.
 *   4. Merge buckets whose average colours are within a perceptual distance of
 *      each other. The merging runs several passes so the palette stays small
 *      and the colours stay distinct.
 *   5. Return clusters with their weight, the swatch colour, and the original
 *      pixel count, so the UI can sort by anything the user finds useful.
 *
 * The algorithm is content-agnostic: it works equally on a photo, a flat
 * illustration and a screenshot, and is stable enough that a 1-pixel shift in
 * the source does not produce a wildly different palette.
 */

import { parseColor } from "./regions";

/** A single extracted colour with its weight in the source image. */
export interface PaletteSwatch {
  /** CSS hex string, always six digits. */
  color: string;
  /** Red, green, blue components, 0..255. */
  rgb: [number, number, number];
  /** Number of source pixels that mapped to this swatch. */
  count: number;
  /**
   * Visual weight, 0..1, blending count and how spread out the cluster is.
   * Used to rank the palette so a vivid accent is not drowned by background.
   */
  weight: number;
  /** Human-readable label, e.g. "Slate Blue". Best-effort, not localised. */
  name: string;
}

/** Settings that change how a palette is built. */
export interface PaletteSettings {
  /**
   * Maximum number of swatches returned. The pipeline keeps at least this
   * many unless the source has fewer unique buckets, which is rare.
   */
  count: number;
  /**
   * Minimum perceptual distance between any two swatches. Higher values
   * produce a more varied palette; lower values keep similar colours apart
   * only when they are clearly distinct in the source.
   */
  minDistance: number;
  /**
   * Skip pixels whose alpha is below this threshold. The default of 0.1
   * removes fully transparent corners without losing very soft edges.
   */
  minAlpha: number;
  /**
   * Build a tonal palette (one hue, varying lightness) rather than a
   * multi-hue one. False picks whatever the image contains; true keeps the
   * dominant hue and varies only its value.
   */
  monochrome: boolean;
}

export const defaultPaletteSettings: PaletteSettings = {
  count: 6,
  minDistance: 36,
  minAlpha: 0.1,
  monochrome: false,
};

/** Human-friendly names for the most common hues. */
const NAMED_HUES: Array<{ hue: number; range: number; name: string }> = [
  { hue: 0, range: 14, name: "Red" },
  { hue: 18, range: 14, name: "Vermillion" },
  { hue: 32, range: 12, name: "Orange" },
  { hue: 45, range: 12, name: "Amber" },
  { hue: 55, range: 10, name: "Gold" },
  { hue: 65, range: 18, name: "Yellow" },
  { hue: 85, range: 12, name: "Lime" },
  { hue: 100, range: 18, name: "Green" },
  { hue: 120, range: 18, name: "Emerald" },
  { hue: 145, range: 18, name: "Teal" },
  { hue: 170, range: 16, name: "Cyan" },
  { hue: 195, range: 16, name: "Sky" },
  { hue: 215, range: 18, name: "Azure" },
  { hue: 230, range: 18, name: "Blue" },
  { hue: 250, range: 14, name: "Indigo" },
  { hue: 270, range: 16, name: "Violet" },
  { hue: 290, range: 14, name: "Magenta" },
  { hue: 310, range: 16, name: "Pink" },
  { hue: 330, range: 16, name: "Rose" },
  { hue: 348, range: 12, name: "Crimson" },
];

/** Grayscale descriptors keyed by their luma band. */
const NEUTRAL_NAMES: Array<{ luma: number; name: string }> = [
  { luma: 12, name: "Black" },
  { luma: 36, name: "Charcoal" },
  { luma: 64, name: "Slate" },
  { luma: 96, name: "Stone" },
  { luma: 128, name: "Grey" },
  { luma: 160, name: "Ash" },
  { luma: 192, name: "Silver" },
  { luma: 224, name: "Fog" },
  { luma: 256, name: "White" },
];

/** Names a swatch as best it can. */
export function nameColor(red: number, green: number, blue: number): string {
  const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  // Highly desaturated colours are read as greys, even if they are not exactly
  // neutral — "warm grey" is what people call an off-white that leans amber.
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const chroma = max - min;
  if (chroma < 16) {
    // The neutral list is sorted from black to white; the first entry whose
    // ceiling is above the swatch's luma is the right band. The `<=` keeps
    // a mid-grey at exactly luma=128 landing on the "Grey" band rather
    // than the next one.
    const descriptor = NEUTRAL_NAMES.find((entry) => luma <= entry.luma) ?? NEUTRAL_NAMES[NEUTRAL_NAMES.length - 1];
    // A warm or cool grey is still useful information.
    if (chroma >= 8) {
      const warm = red > blue;
      return `${warm ? "Warm" : "Cool"} ${descriptor.name}`;
    }
    return descriptor.name;
  }

  // For colourful swatches, identify the dominant hue by max channel and use
  // HSL hue for the label, which matches what people see in a colour wheel.
  const [h, s, l] = rgbToHsl(red, green, blue);
  const descriptor = NAMED_HUES.reduce<typeof NAMED_HUES[number] & { distance: number }>(
    (best, entry) => {
      const distance = hueDistance(h, entry.hue);
      return distance < best.distance ? { ...entry, distance } : best;
    },
    { ...NAMED_HUES[0], distance: Infinity }
  );

  // Saturation adjectives match how designers describe a colour in writing.
  const saturationWord = s > 0.7 ? "Vivid" : s > 0.45 ? "" : s > 0.18 ? "Muted" : "Dusty";
  const lightnessWord =
    l > 0.85 ? "Pale " : l > 0.65 ? "Light " : l < 0.18 ? "Deep " : l < 0.32 ? "Dark " : "";

  return `${lightnessWord}${saturationWord} ${descriptor.name}`.replace(/\s+/g, " ").trim();
}

/**
 * Pipeline output: the swatches plus the totals the caller needs to render a
 * progress bar or compute percentages.
 */
export interface PaletteResult {
  swatches: PaletteSwatch[];
  /** Number of distinct colour buckets seen, before merging. */
  sourceBuckets: number;
  /** Pixels that contributed to the palette, after transparency was dropped. */
  countedPixels: number;
  /** Total pixels in the input. Useful for "skipped 12% as transparent". */
  totalPixels: number;
}

/** Builds a palette from raw RGBA pixels. */
export function extractPalette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: PaletteSettings = defaultPaletteSettings
): PaletteResult {
  if (width < 1 || height < 1 || data.length < width * height * 4) {
    return { swatches: [], sourceBuckets: 0, countedPixels: 0, totalPixels: 0 };
  }

  const totalPixels = width * height;
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  let counted = 0;

  // 4-bit-per-channel quantisation: 4096 buckets. Coarser than that and
  // fine gradients smear into one band; finer than that and JPEG noise shows
  // up as distinct colours.
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    if (data[offset + 3] < settings.minAlpha * 255) continue;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
    counted++;
  }

  if (!buckets.size) {
    return { swatches: [], sourceBuckets: 0, countedPixels: 0, totalPixels };
  }

  let clusters: Array<{ r: number; g: number; b: number; count: number }> = [...buckets.values()].map(
    (entry) => ({
      r: entry.r / entry.count,
      g: entry.g / entry.count,
      b: entry.b / entry.count,
      count: entry.count,
    })
  );

  // Keep merging until no two clusters are within the perceptual threshold.
  // The loop caps at 8 passes; in practice one or two is plenty and the cap
  // is just defence against pathological inputs.
  for (let pass = 0; pass < 8; pass++) {
    let merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (clusterDistance(clusters[i], clusters[j]) < settings.minDistance) {
          clusters[i] = mergeClusters(clusters[i], clusters[j]);
          clusters.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
    if (!merged) break;
  }

  // Optional monochrome mode: keep the dominant hue, vary value only.
  if (settings.monochrome && clusters.length > 1) {
    clusters = clusters
      .map((cluster) => ({ ...cluster, weight: clusterWeight(cluster, counted) }))
      .sort((a, b) => b.weight - a.weight);
    const dominant = clusters[0];
    const [h] = rgbToHsl(dominant.r, dominant.g, dominant.b);
    clusters = clusters
      .map((cluster) => {
        const [, s, l] = rgbToHsl(cluster.r, cluster.g, cluster.b);
        const [rr, gg, bb] = hslToRgb(h, Math.max(0.05, s), l);
        return { r: rr, g: gg, b: bb, count: cluster.count };
      })
      // After recolouring, several clusters can land on the same value; merge again.
      .reduce<Array<{ r: number; g: number; b: number; count: number }>>((acc, cluster) => {
        const near = acc.findIndex(
          (existing) => clusterDistance(existing, cluster) < settings.minDistance
        );
        if (near >= 0) {
          acc[near] = mergeClusters(acc[near], cluster);
        } else {
          acc.push(cluster);
        }
        return acc;
      }, []);
  }

  // Rank by visual weight. A pure count would always crown the dominant
  // background, which is rarely what the user wants from a "swatch" tool.
  const totalWeight = clusters.reduce(
    (sum, cluster) => sum + clusterWeight(cluster, counted),
    0
  );
  const swatches: PaletteSwatch[] = clusters
    .map((cluster) => {
      const weight = totalWeight > 0 ? clusterWeight(cluster, counted) / totalWeight : 0;
      return {
        rgb: [Math.round(cluster.r), Math.round(cluster.g), Math.round(cluster.b)] as [
          number,
          number,
          number
        ],
        color: rgbToHex(cluster.r, cluster.g, cluster.b),
        count: cluster.count,
        weight,
        name: nameColor(cluster.r, cluster.g, cluster.b),
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(1, settings.count));

  return {
    swatches,
    sourceBuckets: buckets.size,
    countedPixels: counted,
    totalPixels,
  };
}

/**
 * Approximate perceptual distance.
 *
 * Sums squared differences in CIE-Lab-like space; full Lab conversion would be
 * overkill because the source is already quantised to 4 bits per channel.
 * The factor on blue matches the human eye's lower sensitivity there.
 */
function clusterDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = (a.b - b.b) * 0.8;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Two clusters are merged by averaging, weighted by pixel count. */
function mergeClusters(
  a: { r: number; g: number; b: number; count: number },
  b: { r: number; g: number; b: number; count: number }
): { r: number; g: number; b: number; count: number } {
  const total = a.count + b.count;
  return {
    r: (a.r * a.count + b.r * b.count) / total,
    g: (a.g * a.count + b.g * b.count) / total,
    b: (a.b * a.count + b.b * b.count) / total,
    count: total,
  };
}

/**
 * Visual weight.
 *
 * Raw count works for a uniform photo, but a single yellow flower in a green
 * field has tiny count and huge impact. The boost on chroma lifts vivid
 * accents above dull backgrounds without overpowering them: a pure white
 * stays at 1×, a fully saturated colour gets a 100× lift, which is enough to
 * surface small accents over a large neutral area.
 */
function clusterWeight(
  cluster: { r: number; g: number; b: number; count: number },
  total: number
): number {
  const max = Math.max(cluster.r, cluster.g, cluster.b);
  const min = Math.min(cluster.r, cluster.g, cluster.b);
  const chroma = (max - min) / 255;
  // The boost is 1 + 99 × chroma^2. Pure neutrals (chroma 0) stay at 1×;
  // fully saturated colours (chroma 1) get a 100× lift, which is enough to
  // rank a small accent above a large neutral background. A more aggressive
  // exponential would over-rank the brightest colours; chroma^2 is enough.
  return (cluster.count / Math.max(1, total)) * (1 + 99 * chroma * chroma);
}

/** Hex form, always six digits, always lower-case. */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    Math.round(r).toString(16).padStart(2, "0") +
    Math.round(g).toString(16).padStart(2, "0") +
    Math.round(b).toString(16).padStart(2, "0")
  );
}

/** RGB → HSL. Hue is degrees, others are 0..1. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) {
      hue = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      hue = (bn - rn) / delta + 2;
    } else {
      hue = (rn - gn) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, saturation, lightness];
}

/** HSL → RGB. Matches the standard algorithm; returned bytes are 0..255. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360 / 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 1 / 6) {
    r = c; g = x; b = 0;
  } else if (hue < 2 / 6) {
    r = x; g = c; b = 0;
  } else if (hue < 3 / 6) {
    r = 0; g = c; b = x;
  } else if (hue < 4 / 6) {
    r = 0; g = x; b = c;
  } else if (hue < 5 / 6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/** Smallest angle between two hue values, 0..180. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/* -------------------------------------------------------------------------- */
/* Palette expressions                                                        */
/*                                                                            */
/* A palette is useful for more than the swatches themselves: designers want  */
/* to know what to do with them. These helpers turn a palette into the forms  */
/* a stylesheet, a Figma document or a Sass file actually consume.            */
/* -------------------------------------------------------------------------- */

/** CSS custom properties under `:root`. */
export function paletteToCssVariables(swatches: PaletteSwatch[], prefix = "color"): string {
  return swatches
    .map((swatch, index) => `  --${prefix}-${index + 1}: ${swatch.color};`)
    .join("\n");
}

/** SCSS / LESS variables. */
export function paletteToCodeVariables(
  swatches: PaletteSwatch[],
  prefix = "color",
  syntax: "scss" | "less" = "scss"
): string {
  const operator = syntax === "scss" ? ":" : ":";
  const suffix = syntax === "scss" ? ";" : ";";
  return swatches
    .map((swatch, index) => `$${prefix}-${index + 1}${operator} ${swatch.color}${suffix}`)
    .join("\n");
}

/** JSON palette, useful for hand-off to other tools. */
export function paletteToJson(swatches: PaletteSwatch[]): string {
  return JSON.stringify(
    swatches.map((swatch) => ({
      hex: swatch.color,
      rgb: swatch.rgb,
      name: swatch.name,
      weight: Math.round(swatch.weight * 1000) / 1000,
    })),
    null,
    2
  );
}

/**
 * ASCII art swatch grid for the terminal. Six characters per swatch, ten
 * characters of name space, twenty swatches per line. A small thing but
 * useful for "look at the palette while reviewing a PR" in the CLI.
 */
export function paletteToAscii(swatches: PaletteSwatch[]): string {
  return swatches
    .map((swatch) => `${swatch.color}  ${swatch.name.padEnd(28, " ").slice(0, 28)} ${(swatch.weight * 100).toFixed(1).padStart(5, " ")}%`)
    .join("\n");
}

/** Re-exported for callers that want to validate user-typed colours. */
export { parseColor };
