/**
 * Shared formatting helpers.
 *
 * These were previously re-declared in fourteen separate components, which
 * meant fourteen chances for the same number to be rendered differently. They
 * live here so every product formats a byte count, a percentage or a duration
 * identically, and so a future product inherits the behaviour rather than
 * copying it.
 *
 * Deliberately dependency-free and side-effect-free: the module is safe to
 * import from a server component, a client component or a plain Node script.
 */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Formats a byte count for display.
 *
 * Uses binary units (1024) because that is what file managers report, and
 * drops the decimal above 100 so the width stays stable in a table.
 */
export function formatBytes(bytes: number, options: { long?: boolean } = {}): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return options.long ? "0 Bytes" : "0 KB";

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1
  );
  const value = bytes / 1024 ** index;
  const unit = options.long && index === 0 ? "Bytes" : BYTE_UNITS[index];

  // One decimal below 100, none above: "9.4 MB" but "412 MB".
  const rounded = value >= 100 || index === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}

/** Percentage saved between two sizes, clamped so growth reads as 0%. */
export function savingsPercent(originalBytes: number, resultBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.max(0, Math.round((1 - resultBytes / originalBytes) * 100));
}

/** Formats a millisecond duration as a short human string. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${Math.round(ms / 100) / 10}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Initials for an avatar fallback.
 *
 * Prefers the name, falls back to the email, and never returns an empty string
 * because an empty avatar reads as a rendering bug.
 */
export function getInitials(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.slice(0, 2).toUpperCase() || "U";
}

/** Strips the extension from a file name, leaving the base. */
export function fileBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}
