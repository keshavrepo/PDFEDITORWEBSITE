/**
 * Diff tool.
 *
 * Line-level diff using a classic Longest Common Subsequence
 * implementation. For JSON, the input is parsed first so the diff
 * is semantically meaningful (key reorder, value change) rather
 * than byte-equal. For text, the raw lines are compared.
 *
 * The output is a `DevDiffLine[]` array that the surface renders
 * side by side or inline.
 */

import type { DevDiffLine } from "../types";

/** Normalise an input pair for JSON diffing. */
function normaliseJson(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  try {
    const value = JSON.parse(trimmed);
    return JSON.stringify(value, null, 2);
  } catch {
    return input;
  }
}

/** Split text into lines without losing the trailing empty line. */
function toLines(input: string): string[] {
  if (input === "") return [];
  return input.split(/\n/);
}

/**
 * Compute the LCS table for two arrays. The table is row-major and
 * uses 32-bit integers.
 */
function lcsTable(left: string[], right: string[]): Uint32Array {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = 1; i < rows; i += 1) {
    const leftLine = left[i - 1]!;
    for (let j = 1; j < cols; j += 1) {
      if (leftLine === right[j - 1]!) {
        table[i * cols + j] = table[(i - 1) * cols + (j - 1)]! + 1;
      } else {
        const up = table[(i - 1) * cols + j]!;
        const left2 = table[i * cols + (j - 1)]!;
        table[i * cols + j] = up >= left2 ? up : left2;
      }
    }
  }
  return table;
}

function backtrack(
  table: Uint32Array,
  left: string[],
  right: string[]
): DevDiffLine[] {
  const cols = right.length + 1;
  const out: DevDiffLine[] = [];
  let i = left.length;
  let j = right.length;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      out.push({
        kind: "context",
        leftLine: i,
        rightLine: j,
        leftText: left[i - 1]!,
        rightText: right[j - 1]!,
      });
      i -= 1;
      j -= 1;
    } else if (table[(i - 1) * cols + j]! >= table[i * cols + (j - 1)]!) {
      out.push({
        kind: "remove",
        leftLine: i,
        rightLine: null,
        leftText: left[i - 1]!,
        rightText: "",
      });
      i -= 1;
    } else {
      out.push({
        kind: "add",
        leftLine: null,
        rightLine: j,
        leftText: "",
        rightText: right[j - 1]!,
      });
      j -= 1;
    }
  }
  while (i > 0) {
    out.push({
      kind: "remove",
      leftLine: i,
      rightLine: null,
      leftText: left[i - 1]!,
      rightText: "",
    });
    i -= 1;
  }
  while (j > 0) {
    out.push({
      kind: "add",
      leftLine: null,
      rightLine: j,
      leftText: "",
      rightText: right[j - 1]!,
    });
    j -= 1;
  }
  return out.reverse();
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
  lines: DevDiffLine[];
}

export function computeTextDiff(leftInput: string, rightInput: string): DiffSummary {
  const left = toLines(leftInput);
  const right = toLines(rightInput);
  const table = lcsTable(left, right);
  const lines = backtrack(table, left, right);
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const line of lines) {
    if (line.kind === "add") added += 1;
    else if (line.kind === "remove") removed += 1;
    else unchanged += 1;
  }
  return { added, removed, unchanged, lines };
}

export function computeJsonDiff(leftInput: string, rightInput: string): DiffSummary {
  return computeTextDiff(normaliseJson(leftInput), normaliseJson(rightInput));
}
