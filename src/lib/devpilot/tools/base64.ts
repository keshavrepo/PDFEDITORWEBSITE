/**
 * Base64 tool.
 *
 * Encodes and decodes base64 strings, with support for both text
 * and file inputs. Encoding uses the standard base64 alphabet
 * without URL-safe substitutions; decoding tolerates the URL-safe
 * alphabet and missing padding.
 */

interface NodeBufferLike {
  from(input: string, encoding: string): { toString(encoding: string): string };
}

function getNodeBuffer(): NodeBufferLike | undefined {
  const g = globalThis as { Buffer?: NodeBufferLike };
  return g.Buffer;
}

/** Encode a UTF-8 string to a base64 string. */
export function encodeBase64(input: string): string {
  if (typeof btoa === "function") {
    // btoa needs binary, so round-trip through encodeURIComponent.
    const binary = unescape(encodeURIComponent(input));
    return btoa(binary);
  }
  // Node fallback.
  const bufferCtor = getNodeBuffer();
  if (bufferCtor) {
    return bufferCtor.from(input, "utf-8").toString("base64");
  }
  throw new Error("No base64 encoder available");
}

/** Decode a base64 string to UTF-8 text. */
export function decodeBase64(input: string): string {
  const normalized = (input ?? "").replace(/\s+/g, "");
  if (!normalized) return "";
  // Try the standard alphabet first; fall back to URL-safe.
  try {
    return decodeStrict(normalized);
  } catch {
    const urlSafe = normalized.replace(/-/g, "+").replace(/_/g, "/");
    return decodeStrict(urlSafe);
  }
}

function decodeStrict(input: string): string {
  const padding = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const padded = input + padding;
  if (typeof atob === "function") {
    const binary = atob(padded);
    return decodeURIComponent(escape(binary));
  }
  // Node fallback.
  const bufferCtor = getNodeBuffer();
  if (bufferCtor) {
    return bufferCtor.from(padded, "base64").toString("utf-8");
  }
  throw new Error("No base64 decoder available");
}

/** Encode a binary string (e.g. from a File) to base64. */
export function encodeBase64Binary(binary: string): string {
  if (typeof btoa === "function") return btoa(binary);
  const bufferCtor = getNodeBuffer();
  if (bufferCtor) {
    return bufferCtor.from(binary, "binary").toString("base64");
  }
  throw new Error("No base64 encoder available");
}

/** Read a browser File as a base64 string (no data URL prefix). */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return encodeBase64Binary(binary);
}
