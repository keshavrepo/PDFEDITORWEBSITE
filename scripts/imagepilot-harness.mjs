/**
 * Bundles the ImagePilot editor core so it can be exercised directly from Node.
 *
 * The core is deliberately written against the standard 2D canvas surface and
 * plain typed arrays, which lets the exact production modules run headlessly
 * against `@napi-rs/canvas` and produce real pixels the tests can assert on.
 */

import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as nodeCanvas from "@napi-rs/canvas";

const ROOT = new URL("..", import.meta.url).pathname;
const ENTRY = join(ROOT, "src/lib/imagepilot/core.ts");
const STATE_ENTRY = join(ROOT, "src/lib/imagepilot/editor-state.ts");
const OUT_DIR = join(ROOT, ".imagepilot-test-build");

let cached = null;
let cachedState = null;

async function bundle(entry, name) {
  await mkdir(OUT_DIR, { recursive: true });
  const outfile = join(OUT_DIR, name);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

/** Builds (once) and imports the editor core. */
export async function loadEditorCore() {
  if (cached) return cached;
  cached = await bundle(ENTRY, "core.mjs");
  return cached;
}

/**
 * Builds (once) and imports the editor state machine.
 *
 * The reducer is the same one the React shell drives, so exercising it here
 * tests the real interaction behaviour rather than a reimplementation.
 */
export async function loadEditorState() {
  if (cachedState) return cachedState;
  cachedState = await bundle(STATE_ENTRY, "editor-state.mjs");
  return cachedState;
}

export async function cleanEditorBuild() {
  await rm(OUT_DIR, { recursive: true, force: true });
}

/**
 * Canvas factory backed by `@napi-rs/canvas`.
 *
 * Satisfies the same `CanvasFactory` contract the browser implementation
 * does, so the renderer runs unmodified.
 */
export const nodeCanvasFactory = {
  create(width, height) {
    const canvas = nodeCanvas.createCanvas(
      Math.max(1, Math.floor(width)),
      Math.max(1, Math.floor(height))
    );
    return { canvas, ctx: canvas.getContext("2d") };
  },
};

/** Renders a document and returns the canvas plus its pixels. */
export async function renderToPixels(doc, rasters, options = {}) {
  const core = await loadEditorCore();
  const scale = options.scale ?? 1;
  const width = Math.max(1, Math.round(doc.width * scale));
  const height = Math.max(1, Math.round(doc.height * scale));
  const { canvas, ctx } = nodeCanvasFactory.create(width, height);

  core.renderDocument(ctx, doc, rasters, {
    scale,
    canvasFactory: nodeCanvasFactory,
    ...options,
  });

  const imageData = ctx.getImageData(0, 0, width, height);
  return { canvas, ctx, data: imageData.data, width, height };
}

/**
 * Decodes encoded image bytes back into a drawable image.
 *
 * Used to prove that a cleaned or converted file is still valid: if the bytes
 * were corrupted, this throws.
 */
export async function nodeCanvasLoadImage(bytes) {
  return nodeCanvas.loadImage(Buffer.from(bytes));
}

/** Reads one pixel as `[r, g, b, a]`. */
export function pixelAt(pixels, width, x, y) {
  const index = (Math.floor(y) * width + Math.floor(x)) * 4;
  return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
}

/** Minimal raster store satisfying the renderer's lookup contract. */
export function makeRasterStore(entries = []) {
  const map = new Map(entries.map((entry) => [entry.id, entry]));
  return {
    get: (id) => map.get(id),
    set: (source) => map.set(source.id, source),
    has: (id) => map.has(id),
  };
}

/**
 * Builds a solid-colour raster source.
 *
 * Flat colours make assertions exact: a brightness change of a known input is
 * a single arithmetic check rather than a tolerance over noise.
 */
export function makeSolidRaster(id, width, height, color) {
  const canvas = nodeCanvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return { id, width, height, image: canvas };
}

/** Two-tone raster, used to verify spatial filters actually mix neighbours. */
export function makeSplitRaster(id, width, height, left, right) {
  const canvas = nodeCanvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, Math.floor(width / 2), height);
  ctx.fillStyle = right;
  ctx.fillRect(Math.floor(width / 2), 0, Math.ceil(width / 2), height);
  return { id, width, height, image: canvas };
}

/** Deterministic pseudo-random noise, for the denoise tests. */
export function makeNoisyRaster(id, width, height, base = 128, amplitude = 60) {
  const canvas = nodeCanvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  let seed = 12345;
  for (let i = 0; i < width * height; i++) {
    // Park–Miller LCG: reproducible across runs and platforms.
    seed = (seed * 16807) % 2147483647;
    const noise = ((seed % 1000) / 1000 - 0.5) * 2 * amplitude;
    const value = Math.max(0, Math.min(255, base + noise));
    imageData.data[i * 4] = value;
    imageData.data[i * 4 + 1] = value;
    imageData.data[i * 4 + 2] = value;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return { id, width, height, image: canvas };
}

/** Standard deviation of the luminance channel, for noise assertions. */
export function luminanceDeviation(pixels) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    count++;
  }
  if (!count) return 0;
  const mean = sum / count;

  let variance = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const luma = pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    variance += (luma - mean) ** 2;
  }
  return Math.sqrt(variance / count);
}
