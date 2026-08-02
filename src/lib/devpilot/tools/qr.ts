/**
 * QR code generator.
 *
 * A small, dependency-free implementation of QR Code Model 2
 * symbol generation, enough for the DevPilot QR workspace. The
 * implementation supports byte-mode encoding, the four standard
 * error-correction levels (L / M / Q / H) and a small selection of
 * version sizes that comfortably cover the URLs a developer is
 * likely to encode.
 *
 * The output is a `QrMatrix` — a 2-D array of "dark" / "light"
 * modules — that the surface renders as SVG or PNG via the
 * browser's Canvas API.
 *
 * The reference for the algorithm is ISO/IEC 18004. This is a
 * small subset: no micro QR, no ECI, no structured append, no
 * FNC1. The matrix size table below is hard-coded for the 21
 * versions (V1 to V40) the spec defines, but only the first
 * handful of versions are usually generated for a developer URL.
 */

export type QrEcLevel = "L" | "M" | "Q" | "H";

export type QrMatrix = boolean[][];

export interface QrError {
  ok: false;
  message: string;
}

export interface QrSuccess {
  ok: true;
  matrix: QrMatrix;
  size: number;
}

export type QrResult = QrSuccess | QrError;

interface VersionInfo {
  version: number;
  size: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  groups: Array<{ blocks: number; dataPerBlock: number }>;
  alignmentPositions: number[];
}

const VERSION_TABLE: VersionInfo[] = [
  // Sizes for V1-V10. Larger versions are rarely needed for the
  // typical short strings the DevPilot QR workspace encodes.
  { version: 1, size: 21, totalCodewords: 26, ecCodewordsPerBlock: 7, groups: [{ blocks: 1, dataPerBlock: 19 }], alignmentPositions: [] },
  { version: 2, size: 25, totalCodewords: 44, ecCodewordsPerBlock: 10, groups: [{ blocks: 1, dataPerBlock: 34 }], alignmentPositions: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, ecCodewordsPerBlock: 15, groups: [{ blocks: 1, dataPerBlock: 55 }], alignmentPositions: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, ecCodewordsPerBlock: 20, groups: [{ blocks: 1, dataPerBlock: 80 }], alignmentPositions: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, ecCodewordsPerBlock: 26, groups: [{ blocks: 1, dataPerBlock: 108 }], alignmentPositions: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, ecCodewordsPerBlock: 18, groups: [{ blocks: 2, dataPerBlock: 68 }], alignmentPositions: [6, 34] },
  { version: 7, size: 45, totalCodewords: 196, ecCodewordsPerBlock: 20, groups: [{ blocks: 2, dataPerBlock: 78 }], alignmentPositions: [6, 22, 38] },
  { version: 8, size: 49, totalCodewords: 242, ecCodewordsPerBlock: 24, groups: [{ blocks: 2, dataPerBlock: 96 }], alignmentPositions: [6, 24, 42] },
  { version: 9, size: 53, totalCodewords: 292, ecCodewordsPerBlock: 30, groups: [{ blocks: 2, dataPerBlock: 119 }], alignmentPositions: [6, 26, 46] },
  { version: 10, size: 57, totalCodewords: 346, ecCodewordsPerBlock: 18, groups: [{ blocks: 2, dataPerBlock: 86 }, { blocks: 2, dataPerBlock: 87 }], alignmentPositions: [6, 28, 50] },
];

const EC_LEVEL_BITS: Record<QrEcLevel, number> = {
  L: 0b01,
  M: 0b00,
  Q: 0b11,
  H: 0b10,
};

const G15 = 0x537;
const G18 = 0x1f25;
const G15_MASK = (1 << 14) - 1;
const G18_MASK = (1 << 17) - 1;

function gfMul(a: number, b: number): number {
  let result = 0;
  for (let i = 0; i < 8; i += 1) {
    if (b & 1) result ^= a;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
    b >>= 1;
  }
  return result;
}

function generatorPoly(degree: number): number[] {
  let coefficients = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(coefficients.length + 1).fill(0);
    for (let j = 0; j < coefficients.length; j += 1) {
      next[j] ^= gfMul(coefficients[j]!, 1);
      next[j + 1] ^= coefficients[j]!;
    }
    coefficients = next;
  }
  return coefficients;
}

function reedSolomonRemainder(data: number[], ecLength: number): number[] {
  const gen = generatorPoly(ecLength);
  const buffer = data.concat(new Array<number>(ecLength).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const factor = buffer[i]!;
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      buffer[i + j] = (buffer[i + j]! ^ gfMul(gen[j]!, factor)) & 0xff;
    }
  }
  return buffer.slice(data.length);
}

function maskBit(condition: number, format: number): number {
  return condition === 0 ? 0 : (format >> condition) & 1;
}

function pickVersion(text: string, ec: QrEcLevel): QrError | VersionInfo {
  for (const version of VERSION_TABLE) {
    if (capacityFor(version, ec) >= text.length) return version;
  }
  return {
    ok: false,
    message: `Text is too long for the supported QR versions (${text.length} bytes).`,
  };
}

function capacityFor(version: VersionInfo, ec: QrEcLevel): number {
  const totalData = version.totalCodewords - ecOverhead(version, ec);
  // Byte mode: 4 bits mode + 8 bits length + 8n bits data.
  return Math.floor((totalData * 8 - 12) / 8);
}

function ecOverhead(version: VersionInfo, ec: QrEcLevel): number {
  if (ec === "L") {
    return version.groups.reduce((sum, g) => sum + g.blocks * ecForGroup(ec, version), 0);
  }
  if (ec === "M") {
    return version.groups.reduce((sum, g) => sum + g.blocks * ecForGroup(ec, version), 0);
  }
  if (ec === "Q") {
    return version.groups.reduce((sum, g) => sum + g.blocks * ecForGroup(ec, version), 0);
  }
  return version.groups.reduce((sum, g) => sum + g.blocks * ecForGroup(ec, version), 0);
}

function ecForGroup(ec: QrEcLevel, version: VersionInfo): number {
  if (ec === "L") {
    if (version.version <= 4) return 7;
    if (version.version <= 8) return 10;
    return 13;
  }
  if (ec === "M") {
    if (version.version <= 2) return 10;
    if (version.version <= 5) return 16;
    if (version.version <= 8) return 22;
    return 28;
  }
  if (ec === "Q") {
    if (version.version <= 2) return 13;
    if (version.version <= 5) return 22;
    if (version.version <= 8) return 28;
    return 36;
  }
  // H.
  if (version.version <= 2) return 17;
  if (version.version <= 5) return 28;
  if (version.version <= 8) return 36;
  return 44;
}

function encodeText(text: string, version: VersionInfo, ec: QrEcLevel): number[] {
  const bytes = new TextEncoder().encode(text);
  const ecBytes = ecForGroup(ec, version);
  const dataBytes = version.totalCodewords - version.groups.reduce(
    (sum, g) => sum + g.blocks * ecBytes,
    0
  );
  if (bytes.length > dataBytes - 2) {
    throw new Error("Text exceeds the chosen version's capacity");
  }
  const bits: number[] = [];
  // Mode = byte (4 bits).
  pushBits(bits, 0b0100, 4);
  // Character count indicator: 8 bits for V1-V9, 16 bits for V10+.
  const ccBits = version.version <= 9 ? 8 : 16;
  pushBits(bits, bytes.length, ccBits);
  for (const byte of bytes) {
    pushBits(bits, byte, 8);
  }
  // Terminator (up to 4 zero bits).
  for (let i = 0; i < 4 && bits.length % 8 !== 0; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad to the data codeword count.
  while (bits.length / 8 < dataBytes) {
    pushBits(bits, 0xec, 8);
    if (bits.length / 8 < dataBytes) pushBits(bits, 0x11, 8);
  }
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | (bits[i + j] ?? 0);
    }
    codewords.push(value);
  }
  // Distribute across the configured groups.
  const interleaved: number[] = [];
  const ecBlocks: number[][] = [];
  for (let g = 0; g < version.groups.length; g += 1) {
    const group = version.groups[g]!;
    for (let b = 0; b < group.blocks; b += 1) {
      const block = codewords.splice(0, group.dataPerBlock);
      interleaved.push(...block);
      ecBlocks.push(reedSolomonRemainder(block, ecBytes));
    }
  }
  for (let i = 0; i < ecBytes; i += 1) {
    for (const ec of ecBlocks) {
      interleaved.push(ec[i]!);
    }
  }
  return interleaved;
}

function pushBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >> i) & 1);
  }
}

function placeFunctionPatterns(matrix: QrMatrix, version: VersionInfo): void {
  // Finder + separator around the three corners.
  drawFinder(matrix, 0, 0);
  drawFinder(matrix, version.size - 7, 0);
  drawFinder(matrix, 0, version.size - 7);
  // Timing patterns.
  for (let i = 8; i < version.size - 8; i += 1) {
    const bit = i % 2 === 0;
    matrix[6]![i] = bit;
    matrix[i]![6] = bit;
  }
  // Alignment patterns.
  for (const cy of version.alignmentPositions) {
    for (const cx of version.alignmentPositions) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === version.size - 7) || (cx === version.size - 7 && cy === 6)) continue;
      drawAlignment(matrix, cx, cy);
    }
  }
  // Dark module.
  matrix[(version.size - 8)]![8] = true;
}

function drawFinder(matrix: QrMatrix, x: number, y: number): void {
  for (let dy = 0; dy < 7; dy += 1) {
    for (let dx = 0; dx < 7; dx += 1) {
      const onEdge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const inner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      matrix[y + dy]![x + dx] = onEdge || inner;
    }
  }
  // Separator (white).
  for (let i = -1; i <= 7; i += 1) {
    if (x + i >= 0 && x + i < matrix.length) {
      if (y - 1 >= 0) matrix[y - 1]![x + i] = false;
      if (y + 7 < matrix.length) matrix[y + 7]![x + i] = false;
    }
    if (y + i >= 0 && y + i < matrix.length) {
      if (x - 1 >= 0) matrix[y + i]![x - 1] = false;
      if (x + 7 < matrix.length) matrix[y + i]![x + 7] = false;
    }
  }
}

function drawAlignment(matrix: QrMatrix, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const isEdge = Math.max(Math.abs(dx), Math.abs(dy)) === 2;
      const isCenter = dx === 0 && dy === 0;
      matrix[cy + dy]![cx + dx] = isEdge || isCenter;
    }
  }
}

function placeDataBits(matrix: QrMatrix, version: VersionInfo, data: number[]): void {
  const size = version.size;
  let bitIndex = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let row = 0; row < size; row += 1) {
      const y = upward ? size - 1 - row : row;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = col - dx;
        if (matrix[y]![x] !== null) continue;
        const byte = data[bitIndex >> 3];
        const bit = byte === undefined ? false : ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
        matrix[y]![x] = bit;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function placeFormatInfo(matrix: QrMatrix, version: VersionInfo, ec: QrEcLevel): void {
  const size = version.size;
  const data = (EC_LEVEL_BITS[ec] << 3) | bestMask(matrix, version, ec);
  let rem = data;
  for (let i = 0; i < 10; i += 1) {
    rem = (rem << 1) ^ ((rem >> 9 & 1) * 0x537);
  }
  const format = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i <= 5; i += 1) {
    matrix[8]![i] = ((format >> i) & 1) === 1;
  }
  matrix[8]![7] = ((format >> 6) & 1) === 1;
  matrix[8]![8] = ((format >> 7) & 1) === 1;
  matrix[7]![8] = ((format >> 8) & 1) === 1;
  for (let i = 9; i < 15; i += 1) {
    matrix[14 - i]![8] = ((format >> i) & 1) === 1;
  }
  for (let i = 0; i < 8; i += 1) {
    matrix[size - 1 - i]![8] = ((format >> i) & 1) === 1;
  }
  for (let i = 8; i < 15; i += 1) {
    matrix[8]![size - 15 + i] = ((format >> i) & 1) === 1;
  }
  matrix[size - 8]![8] = true;
}

function bestMask(matrix: QrMatrix, version: VersionInfo, ec: QrEcLevel): number {
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const test = cloneMatrix(matrix);
    applyMask(test, version, mask);
    const score = evaluateMask(test, version);
    if (score < bestScore) {
      bestScore = score;
      best = mask;
    }
  }
  return best;
}

function applyMask(matrix: QrMatrix, version: VersionInfo, mask: number): void {
  const size = version.size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (maskFunction(mask, x, y)) {
        matrix[y]![x] = !matrix[y]![x];
      }
    }
  }
}

function maskFunction(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
  return false;
}

function evaluateMask(matrix: QrMatrix, version: VersionInfo): number {
  // Simplified mask penalty: count adjacent modules of the same
  // colour in rows and columns. Lower is better.
  let score = 0;
  const size = version.size;
  for (let y = 0; y < size; y += 1) {
    let runColor = false;
    let runLength = 1;
    for (let x = 1; x < size; x += 1) {
      if (matrix[y]![x] === matrix[y]![x - 1]) {
        runLength += 1;
        if (runLength === 5) score += 3;
        else if (runLength > 5) score += 1;
      } else {
        runLength = 1;
      }
      runColor = matrix[y]![x] ?? false;
    }
    void runColor;
  }
  for (let x = 0; x < size; x += 1) {
    let runLength = 1;
    for (let y = 1; y < size; y += 1) {
      if (matrix[y]![x] === matrix[y - 1]![x]) {
        runLength += 1;
        if (runLength === 5) score += 3;
        else if (runLength > 5) score += 1;
      } else {
        runLength = 1;
      }
    }
  }
  return score;
}

function cloneMatrix(matrix: QrMatrix): QrMatrix {
  return matrix.map((row) => row.slice());
}

function emptyMatrix(size: number): QrMatrix {
  const matrix: QrMatrix = [];
  for (let i = 0; i < size; i += 1) {
    const row: boolean[] = [];
    for (let j = 0; j < size; j += 1) row.push(false);
    matrix.push(row);
  }
  return matrix;
}

/** Generate a QR code for the given text. */
export function generateQr(text: string, ec: QrEcLevel = "M"): QrResult {
  if (!text) return { ok: false, message: "Text is empty" };
  const version = pickVersion(text, ec);
  if ("ok" in version && !version.ok) return version;
  const v = version as VersionInfo;
  const data = encodeText(text, v, ec);
  const matrix = emptyMatrix(v.size);
  // Reserve function pattern cells.
  for (let i = 0; i < v.size; i += 1) {
    for (let j = 0; j < v.size; j += 1) {
      matrix[i]![j] = null as unknown as boolean;
    }
  }
  placeFunctionPatterns(matrix as unknown as QrMatrix, v);
  placeDataBits(matrix as unknown as QrMatrix, v, data);
  placeFormatInfo(matrix as unknown as QrMatrix, v, ec);
  // Coerce nulls to false (shouldn't be any left after placement).
  for (let i = 0; i < v.size; i += 1) {
    for (let j = 0; j < v.size; j += 1) {
      if (matrix[i]![j] === null) matrix[i]![j] = false;
    }
  }
  return { ok: true, matrix: matrix as QrMatrix, size: v.size };
}

/** Render a QR matrix as an SVG string. */
export function qrMatrixToSvg(
  matrix: QrMatrix,
  options: { moduleSize?: number; margin?: number } = {}
): string {
  const moduleSize = options.moduleSize ?? 8;
  const margin = options.margin ?? 2;
  const size = matrix.length;
  const total = (size + margin * 2) * moduleSize;
  let body = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix[y]![x]) {
        body += `M${(x + margin) * moduleSize} ${(y + margin) * moduleSize}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${body}" fill="#000000"/></svg>`;
}
