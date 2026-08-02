/**
 * Hash tool.
 *
 * MD5, SHA-1, SHA-256 and SHA-512 hashing for both text and file
 * inputs. SHA-2 algorithms go through the browser's native
 * `crypto.subtle.digest` when available; MD5 and SHA-1 fall back
 * to a small pure-JS implementation so the same surface works in
 * every environment LaunchStack supports.
 */

export type HashAlgorithm = "md5" | "sha1" | "sha256" | "sha512";

const HASH_LABELS: Record<HashAlgorithm, string> = {
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
};

export function listHashAlgorithms(): HashAlgorithm[] {
  return ["md5", "sha1", "sha256", "sha512"];
}

export function hashLabel(algorithm: HashAlgorithm): string {
  return HASH_LABELS[algorithm];
}

/** Hash a UTF-8 string with the given algorithm. */
export async function hashText(text: string, algorithm: HashAlgorithm): Promise<string> {
  if (algorithm === "md5" || algorithm === "sha1") {
    return legacyHash(utf8Bytes(text), algorithm);
  }
  return subtleHash(utf8Bytes(text), algorithm);
}

/** Hash a binary string (e.g. from a File) with the given algorithm. */
export async function hashBinary(binary: string, algorithm: HashAlgorithm): Promise<string> {
  if (algorithm === "md5" || algorithm === "sha1") {
    return legacyHash(binaryStringToBytes(binary), algorithm);
  }
  return subtleHash(binaryStringToBytes(binary), algorithm);
}

/** Hash the contents of a browser File. */
export async function hashFile(file: File, algorithm: HashAlgorithm): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (algorithm === "md5" || algorithm === "sha1") {
    return legacyHash(bytes, algorithm);
  }
  return subtleHash(bytes, algorithm);
}

function utf8Bytes(input: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(input);
  }
  const out: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) {
      out.push(0xc0 | (code >> 6));
      out.push(0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      out.push(0xe0 | (code >> 12));
      out.push(0x80 | ((code >> 6) & 0x3f));
      out.push(0x80 | (code & 0x3f));
    } else {
      i += 1;
      const next = input.charCodeAt(i);
      const full = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
      out.push(0xf0 | (full >> 18));
      out.push(0x80 | ((full >> 12) & 0x3f));
      out.push(0x80 | ((full >> 6) & 0x3f));
      out.push(0x80 | (full & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function binaryStringToBytes(binary: string): Uint8Array {
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i) & 0xff;
  return out;
}

async function subtleHash(bytes: Uint8Array, algorithm: HashAlgorithm): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("SubtleCrypto is not available in this environment");
  }
  const subtleAlg = algorithm === "sha256" ? "SHA-256" : "SHA-512";
  const digest = await crypto.subtle.digest(subtleAlg, bytes as BufferSource);
  return bufferToHex(new Uint8Array(digest));
}

function bufferToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* MD5 + SHA-1 reference implementation                                       */
/* -------------------------------------------------------------------------- */

function rol(value: number, amount: number): number {
  return ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

function addBytes(bytes: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) out.push(bytes[i]!);
  return out;
}

function bytesToWordsLE(bytes: number[]): number[] {
  const words: number[] = [];
  for (let i = 0; i + 4 <= bytes.length; i += 4) {
    words.push(
      ((bytes[i]! | 0) << 0) |
        ((bytes[i + 1]! | 0) << 8) |
        ((bytes[i + 2]! | 0) << 16) |
        ((bytes[i + 3]! | 0) << 24)
    );
  }
  return words.map((value) => value >>> 0);
}

function md5(bytes: Uint8Array): string {
  const data = addBytes(bytes);
  const originalLengthBits = data.length * 8;
  data.push(0x80);
  while (data.length % 64 !== 56) data.push(0);
  for (let i = 0; i < 8; i += 1) {
    data.push((originalLengthBits >>> (i * 8)) & 0xff);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const M = bytesToWordsLE(data);
  for (let i = 0; i < M.length; i += 16) {
    const X = M.slice(i, i + 16);
    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j += 1) {
      let F: number, g: number;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      F = (F + A + K[j]! + (X[g]! | 0)) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rol(F, S[j]!)) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  return (
    a0.toString(16).padStart(8, "0") +
    b0.toString(16).padStart(8, "0") +
    c0.toString(16).padStart(8, "0") +
    d0.toString(16).padStart(8, "0")
  );
}

function sha1(bytes: Uint8Array): string {
  const data = addBytes(bytes);
  const originalLengthBits = data.length * 8;
  data.push(0x80);
  while (data.length % 64 !== 56) data.push(0);
  for (let i = 0; i < 8; i += 1) {
    data.push((originalLengthBits >>> (i * 8)) & 0xff);
  }

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const M = bytesToWordsLE(data);
  for (let i = 0; i < M.length; i += 16) {
    const X = M.slice(i, i + 16);
    for (let j = 16; j < 80; j += 1) {
      X.push(rol(X[j - 3]! ^ X[j - 8]! ^ X[j - 14]! ^ X[j - 16]!, 1));
    }
    let A = h0, B = h1, C = h2, D = h3, E = h4;
    for (let j = 0; j < 80; j += 1) {
      let F: number, k: number;
      if (j < 20) { F = (B & C) | (~B & D); k = 0x5a827999; }
      else if (j < 40) { F = B ^ C ^ D; k = 0x6ed9eba1; }
      else if (j < 60) { F = (B & C) | (B & D) | (C & D); k = 0x8f1bbcdc; }
      else { F = B ^ C ^ D; k = 0xca62c1d6; }
      const temp = (rol(A, 5) + F + E + k + X[j]!) >>> 0;
      E = D;
      D = C;
      C = rol(B, 30);
      B = A;
      A = temp;
    }
    h0 = (h0 + A) >>> 0;
    h1 = (h1 + B) >>> 0;
    h2 = (h2 + C) >>> 0;
    h3 = (h3 + D) >>> 0;
    h4 = (h4 + E) >>> 0;
  }

  return (
    h0.toString(16).padStart(8, "0") +
    h1.toString(16).padStart(8, "0") +
    h2.toString(16).padStart(8, "0") +
    h3.toString(16).padStart(8, "0") +
    h4.toString(16).padStart(8, "0")
  );
}

function legacyHash(bytes: Uint8Array, algorithm: HashAlgorithm): string {
  if (algorithm === "md5") return md5(bytes);
  if (algorithm === "sha1") return sha1(bytes);
  throw new Error(`Unsupported algorithm: ${algorithm}`);
}

/**
 * Compare two hex digests in constant time. Returns `true` when the
 * digests match. The function is exposed so the Hash workspace can
 * surface a side-by-side comparison without re-hashing the same
 * bytes.
 */
export function compareHashes(expected: string, actual: string): boolean {
  const a = expected.trim().toLowerCase();
  const b = actual.trim().toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
