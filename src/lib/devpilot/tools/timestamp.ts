/**
 * Timestamp tool.
 *
 * Convert between Unix timestamps (seconds), ISO 8601 strings and
 * the user's local time. Provides a relative-time formatter so the
 * dashboard can show "3 days ago" without pulling in a
 * date-fns-style dependency.
 */

export interface TimestampResult {
  ok: boolean;
  unix: number | null;
  iso: string | null;
  utc: string | null;
  local: string | null;
  relative: string | null;
  error: string | null;
}

function toDate(value: number | string): Date | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Accept both seconds and milliseconds.
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Pure numeric string: treat as Unix seconds.
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return toDate(Number(trimmed));
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Format a date in UTC with the YYYY-MM-DD HH:MM:SS UTC shape. */
export function formatUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
  );
}

/** Format a date in the user's local timezone. */
export function formatLocal(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Format a relative-time string ("3 minutes ago" / "in 2 days"). */
export function formatRelative(value: number | string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : toDate(value);
  if (!date) return "—";
  const diffMs = date.getTime() - now.getTime();
  const future = diffMs > 0;
  const seconds = Math.abs(Math.round(diffMs / 1000));
  if (seconds < 60) return future ? `in ${seconds} second${seconds === 1 ? "" : "s"}` : `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return future ? `in ${minutes} minute${minutes === 1 ? "" : "s"}` : `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return future ? `in ${hours} hour${hours === 1 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return future ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return future ? `in ${months} month${months === 1 ? "" : "s"}` : `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return future ? `in ${years} year${years === 1 ? "" : "s"}` : `${years} year${years === 1 ? "" : "s"} ago`;
}

export function convertTimestamp(
  input: string,
  direction: "fromUnix" | "toUnix" | "fromIso" | "toIso"
): TimestampResult {
  if (!input.trim()) {
    return { ok: false, unix: null, iso: null, utc: null, local: null, relative: null, error: "Input is empty" };
  }
  if (direction === "fromUnix" || direction === "fromIso") {
    const date = toDate(input);
    if (!date) {
      return { ok: false, unix: null, iso: null, utc: null, local: null, relative: null, error: "Could not parse input" };
    }
    return {
      ok: true,
      unix: Math.floor(date.getTime() / 1000),
      iso: date.toISOString(),
      utc: formatUtc(date),
      local: formatLocal(date),
      relative: formatRelative(date),
      error: null,
    };
  }
  // toUnix / toIso: we need a date input. The user pastes any
  // recognisable date string and the tool returns Unix + ISO.
  const date = toDate(input);
  if (!date) {
    return { ok: false, unix: null, iso: null, utc: null, local: null, relative: null, error: "Could not parse input" };
  }
  return {
    ok: true,
    unix: Math.floor(date.getTime() / 1000),
    iso: date.toISOString(),
    utc: formatUtc(date),
    local: formatLocal(date),
    relative: formatRelative(date),
    error: null,
  };
}
