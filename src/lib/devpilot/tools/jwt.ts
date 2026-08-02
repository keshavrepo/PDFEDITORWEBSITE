/**
 * JWT tool.
 *
 * Pure decoder for the three segments of a JSON Web Token. No
 * signing, no verification — the tool only decodes what the user
 * pastes. Expiry is computed from the standard `exp` claim when
 * present, alongside `nbf` and `iat` for context.
 */

export interface JwtSegment {
  /** Raw segment. */
  raw: string;
  /** Decoded JSON value, or `null` if decoding failed. */
  value: unknown;
  /** Friendly error string when decoding failed. */
  error: string | null;
}

export interface JwtDecoded {
  ok: boolean;
  header: JwtSegment;
  payload: JwtSegment;
  signature: string;
  /** Expiry info, computed from the standard `exp` / `nbf` / `iat` claims. */
  expiry: JwtExpiry | null;
  error: string | null;
}

export interface JwtExpiry {
  /** ISO string from `exp`, or `null` when missing. */
  expiresAt: string | null;
  /** Whether the token is currently expired. */
  expired: boolean;
  /** Seconds until expiry. Negative when expired. `null` when not set. */
  secondsToExpiry: number | null;
  /** ISO string from `nbf`, or `null` when missing. */
  notBefore: string | null;
  /** Whether `nbf` is in the future. */
  notYetValid: boolean;
  /** ISO string from `iat`, or `null` when missing. */
  issuedAt: string | null;
}

function base64UrlDecode(input: string): string {
  // Convert base64url to base64.
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const padded = normalized + padding;
  if (typeof atob === "function") {
    try {
      return atob(padded);
    } catch {
      // Fall through to Buffer.
    }
  }
  // Node fallback.
  const bufferCtor = getNodeBuffer();
  if (bufferCtor) {
    return bufferCtor.from(padded, "base64").toString("utf-8");
  }
  throw new Error("No base64 decoder available");
}

interface NodeBufferLike {
  from(input: string, encoding: string): { toString(encoding: string): string };
}

function getNodeBuffer(): NodeBufferLike | undefined {
  const g = globalThis as { Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } } };
  return g.Buffer;
}

function decodeSegment(raw: string): JwtSegment {
  if (!raw) {
    return { raw, value: null, error: "Empty segment" };
  }
  try {
    const json = base64UrlDecode(raw);
    const value = JSON.parse(json);
    return { raw, value, error: null };
  } catch (err) {
    return {
      raw,
      value: null,
      error: err instanceof Error ? err.message : "Failed to decode",
    };
  }
}

function toIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // JWT exp / iat / nbf are seconds since the epoch.
  const ms = value * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function computeExpiry(payload: unknown): JwtExpiry | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const expiresAt = toIso(record.exp);
  const notBefore = toIso(record.nbf);
  const issuedAt = toIso(record.iat);
  const now = Date.now();
  const expired = expiresAt ? new Date(expiresAt).getTime() < now : false;
  const notYetValid = notBefore ? new Date(notBefore).getTime() > now : false;
  const secondsToExpiry = expiresAt
    ? Math.floor((new Date(expiresAt).getTime() - now) / 1000)
    : null;
  return { expiresAt, expired, secondsToExpiry, notBefore, notYetValid, issuedAt };
}

export function decodeJwt(token: string): JwtDecoded {
  const trimmed = (token ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      header: decodeSegment(""),
      payload: decodeSegment(""),
      signature: "",
      expiry: null,
      error: "Token is empty",
    };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      header: decodeSegment(parts[0] ?? ""),
      payload: decodeSegment(parts[1] ?? ""),
      signature: parts[2] ?? "",
      expiry: null,
      error: `Expected three dot-separated segments, found ${parts.length}`,
    };
  }
  const header = decodeSegment(parts[0]!);
  const payload = decodeSegment(parts[1]!);
  const signature = parts[2] ?? "";
  const expiry = header.error || payload.error ? null : computeExpiry(payload.value);
  const error = header.error ?? payload.error;
  return {
    ok: !error,
    header,
    payload,
    signature,
    expiry,
    error,
  };
}

export function formatJwt(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
