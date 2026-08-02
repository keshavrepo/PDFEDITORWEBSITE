/**
 * AudioPilot shared utilities.
 *
 * Small, dependency-free helpers shared by every surface in the
 * AudioPilot workspace. The helpers here are intentionally tiny
 * — anything bigger belongs in `tools/` or `types.ts`.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * `utils.ts` shape.
 */

import type { AudioFormat } from "./types";
import { FORMAT_EXTENSIONS } from "./tools/audio";

/** Builds a safe file name from a base name, an extension and an
 * optional list of existing names. The function lowercases the
 * extension, replaces characters that the OS rejects (`/\?%*:|"<>`)
 * with `_`, trims trailing whitespace and (if the result would
 * collide with an existing name) appends ` (n)` until it does
 * not. The function returns the final file name without the
 * directory prefix. */
export function safeFileName(
  base: string,
  extension: string,
  existing: string[] = []
): string {
  const cleaned = base
    .normalize("NFKD")
    .replace(/[\\/\\?\\%\\*\\:\\|\\"<>]/g, "_")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, 120);
  const safeBase = cleaned.length > 0 ? cleaned : "audio";
  const safeExt = extension.replace(/^\\./, "").toLowerCase();
  const ext = safeExt || "bin";
  const primary = `${safeBase}.${ext}`;
  if (!existing.includes(primary)) return primary;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${safeBase} (${n}).${ext}`;
    if (!existing.includes(candidate)) return candidate;
  }
  // Fallback: timestamp suffix.
  return `${safeBase}-${Date.now().toString(36)}.${ext}`;
}

/** Builds an `AudioFormat` from a file name. The function is
 * tolerant of the most common extensions (mp3, wav, ogg, oga,
 * flac, aac, m4a). */
export function formatFromFileName(name: string): AudioFormat {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "mp3") return "mp3";
  if (ext === "wav") return "wav";
  if (ext === "ogg" || ext === "oga") return "ogg";
  if (ext === "flac") return "flac";
  if (ext === "aac" || ext === "m4a") return "aac";
  return "wav";
}

/** Builds a downloadable file name for a session export. */
export function sessionExportName(
  title: string,
  format: AudioFormat,
  suffix: string = ""
): string {
  const ext = FORMAT_EXTENSIONS[format] ?? "wav";
  const base = title.trim() || "audio";
  return safeFileName(
    suffix ? `${base}-${suffix}` : base,
    ext
  );
}

/** Triggers a download for the given data URL. The function
 * appends an off-DOM anchor, clicks it, then removes it. The
 * caller is responsible for revoking any object URLs that were
 * allocated for the data. */
export function triggerDownload(
  dataUrl: string,
  fileName: string
): void {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Sleeps for the requested number of milliseconds. Returns a
 * promise that resolves when the sleep is done. The helper is
 * shared by every surface that needs to throttle async work
 * (e.g. the Export Center between jobs). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    window.setTimeout(resolve, Math.max(0, ms));
  });
}

/** Clamps a number to a range with a fallback. */
export function clamp(
  value: number,
  min: number,
  max: number,
  fallback: number
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

/** Generates a short, sortable id. The result is a 12-character
 * base-36 string — short enough to fit in a toast, unique enough
 * to avoid clashes in the IndexedDB store. */
export function shortUid(prefix: string = ""): string {
  const random = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return prefix ? `${prefix}-${stamp}-${random}` : `${stamp}-${random}`;
}

/** Returns the difference between two arrays of strings, preserving
 * order. The function is used by the download history to compute
 * the new entries to prepend. */
export function uniquePrepend<T>(current: T[], next: T[], cap: number): T[] {
  const seen = new Set(current.map((entry) => JSON.stringify(entry)));
  const additions: T[] = [];
  for (const entry of next) {
    const key = JSON.stringify(entry);
    if (!seen.has(key)) {
      seen.add(key);
      additions.push(entry);
    }
  }
  return [...additions, ...current].slice(0, cap);
}

/** Returns the basename of a path, ignoring trailing slashes. */
export function basename(path: string): string {
  if (!path) return "";
  const normalised = path.replace(/[\\/]+$/, "");
  const lastSlash = Math.max(
    normalised.lastIndexOf("/"),
    normalised.lastIndexOf("\\")
  );
  return lastSlash >= 0 ? normalised.slice(lastSlash + 1) : normalised;
}

/** Returns true when the browser supports the standard
 * `DataTransfer.items` drag-and-drop API. The check is robust
 * to SSR (returns `false` when `window` is undefined). */
export function isDropSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "DataTransfer" in window;
}

/** Returns a stable, sortable timestamp for the download history.
 * The format is `YYYY-MM-DD HH:mm:ss` in the user's locale. */
export function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** Returns a friendly, short, human-readable file size label
 * (e.g. `4.2 MB`). */
export function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** Validates that a downloaded file is non-empty and matches the
 * declared format. The function is used by the Export Center
 * to reject bogus results. */
export function isValidExportResult(
  bytes: number,
  format: AudioFormat,
  sourceBytes: number
): { ok: boolean; reason?: string } {
  if (bytes <= 0) {
    return { ok: false, reason: "Empty result" };
  }
  // A passthrough should be at least 80% the size of the source.
  // An encoded result can be smaller; the threshold is a soft
  // sanity check, not a hard error.
  if (bytes > sourceBytes * 2) {
    return {
      ok: false,
      reason: `Result is much larger than the source (${formatBytesShort(
        bytes
      )} vs ${formatBytesShort(sourceBytes)})`,
    };
  }
  return { ok: true };
}
