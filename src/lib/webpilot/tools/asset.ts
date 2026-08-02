/**
 * Asset Manager helpers.
 *
 * Pure functions the Asset Manager surface uses to detect an
 * asset's kind from its MIME type and to derive the asset's
 * logical "kind" bucket (image, svg, font, video, icon, other).
 *
 * The actual upload (read a File, build a data URL, record the
 * dimensions) is exposed by `tools/io.ts`; this module only
 * classifies what the user dropped.
 */

import type { WebAsset } from "../types";

const IMAGE_PREFIXES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/avif", "image/bmp", "image/svg+xml"];
const FONT_MIME = new Set([
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/font-woff",
  "application/font-woff2",
]);
const VIDEO_PREFIX = "video/";
const ICON_EXTENSIONS = new Set(["ico", "icns"]);

export function classifyAsset(
  file: File | { name: string; type?: string }
): WebAsset["kind"] {
  const name = (file.name ?? "").toLowerCase();
  const mime = (file.type ?? "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (mime === "image/svg+xml" || ext === "svg") return "svg";
  if (IMAGE_PREFIXES.includes(mime)) return "image";
  if (FONT_MIME.has(mime) || ["ttf", "otf", "woff", "woff2"].includes(ext)) {
    return "font";
  }
  if (mime.startsWith(VIDEO_PREFIX) || ["mp4", "webm", "ogg", "mov"].includes(ext)) {
    return "video";
  }
  if (ICON_EXTENSIONS.has(ext)) return "icon";
  return "other";
}

export function uniqueAssetName(
  name: string,
  taken: Set<string>
): string {
  if (!taken.has(name)) return name;
  const ext = name.lastIndexOf(".");
  const stem = ext === -1 ? name : name.slice(0, ext);
  const suffix = ext === -1 ? "" : name.slice(ext);
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${stem} (${i})${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}${suffix}`;
}

export function uniqueFolderName(
  name: string,
  taken: Set<string>
): string {
  if (!taken.has(name)) return name;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${name} (${i})`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${name}-${Date.now()}`;
}

/** Build a folder path by joining `parent` and `child`. */
export function joinAssetFolder(parent: string, child: string): string {
  if (!parent) return child;
  if (!child) return parent;
  return `${parent}/${child}`;
}

/** Split a folder path into segments. The root returns []. */
export function splitAssetFolder(path: string): string[] {
  if (!path) return [];
  return path.split("/").filter(Boolean);
}
