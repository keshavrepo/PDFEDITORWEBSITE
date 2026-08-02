/**
 * UUID tool.
 *
 * Generates RFC 4122 v4 UUIDs in the browser. Uses
 * `crypto.getRandomValues` when available, with a Math.random
 * fallback so the helpers still work in older test environments.
 */

function randomHex(byte: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    return (bytes[0]! & (0xf0 >> (byte % 4))).toString(16);
  }
  return Math.floor(Math.random() * 16).toString(16);
}

function randomByte(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0]!;
  }
  return Math.floor(Math.random() * 256);
}

/** Generate a single v4 UUID. */
export function generateUuidV4(): string {
  const bytes = new Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = randomByte();
  }
  // Per RFC 4122 §4.4
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push(bytes[i]!.toString(16).padStart(2, "0"));
  }
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

/** Generate a batch of v4 UUIDs. */
export function generateUuidV4Batch(count: number): string[] {
  const safe = Math.max(1, Math.min(200, Math.floor(count) || 1));
  const out: string[] = [];
  for (let i = 0; i < safe; i += 1) out.push(generateUuidV4());
  return out;
}

/** Validate a v4 UUID. The check is permissive on the variant bits. */
export function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}
