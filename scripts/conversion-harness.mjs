/**
 * Bundles the isomorphic conversion core so it can be exercised directly from
 * Node with real documents.
 *
 * The conversion modules deliberately avoid DOM APIs, which lets the exact
 * production code paths run headlessly in tests and in CI.
 */

import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;
const ENTRY = join(ROOT, "src/lib/conversion/index.ts");
// Build inside the repo so bare imports resolve against its node_modules.
const OUT_DIR = join(ROOT, ".conversion-test-build");

let cached = null;

/** Builds (once) and imports the conversion core. */
export async function loadConversionCore() {
  if (cached) return cached;

  await mkdir(OUT_DIR, { recursive: true });
  const outfile = join(OUT_DIR, "conversion.mjs");

  await build({
    entryPoints: [ENTRY],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    // pdf.js ships browser and Node builds; let Node resolve its own.
    // Tesseract is likewise left external: bundling it pulls in its Node
    // worker internals, whereas the browser loads it as a plain dependency.
    external: ["pdfjs-dist", "tesseract.js"],
    // Production imports the browser build. Under Node the `legacy` build is
    // required because the default one touches DOMMatrix at module scope.
    alias: { "pdfjs-dist": "pdfjs-dist/legacy/build/pdf.mjs" },
    // Without this, esbuild honours tesseract.js's `browser` field and pulls
    // in its browser worker, which needs `window`. Tests run on Node.
    mainFields: ["module", "main"],
    logLevel: "silent",
  });

  cached = await import(pathToFileURL(outfile).href);
  return cached;
}

/** Removes build artifacts produced by {@link loadConversionCore}. */
export async function cleanConversionBuild() {
  await rm(OUT_DIR, { recursive: true, force: true });
}

/** Minimal File shim so tests can call the same validation helpers as the UI. */
export function makeFile(bytes, name, type) {
  return new File([bytes], name, { type });
}
