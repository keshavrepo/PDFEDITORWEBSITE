/**
 * PDF comparison.
 *
 * Two documents are compared at the word level so the result points at real
 * edits rather than reflowed line breaks. Pages are aligned first, which lets
 * the tool distinguish an inserted page from every following page having
 * "changed".
 */

import { extractPdf } from "./pdf/pdf-extractor";
import { buildLines } from "./pdf/layout-analyzer";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback } from "./types";

export type PageStatus = "unchanged" | "modified" | "added" | "removed";
export type ChangeType = "insert" | "delete" | "equal";

/** One run of words that is identical, inserted or deleted. */
export interface TextChange {
  type: ChangeType;
  text: string;
}

export interface PageComparison {
  status: PageStatus;
  /** Page number in the original document, or null when the page was added. */
  originalPage: number | null;
  /** Page number in the revised document, or null when the page was removed. */
  revisedPage: number | null;
  /** Word-level diff, present for modified pages. */
  changes: TextChange[];
  addedWords: number;
  removedWords: number;
  /** 0-1, where 1 means the two pages are identical. */
  similarity: number;
}

export interface ComparisonSummary {
  pages: PageComparison[];
  identical: boolean;
  totalAdded: number;
  totalRemoved: number;
  pagesAdded: number;
  pagesRemoved: number;
  pagesModified: number;
  originalPageCount: number;
  revisedPageCount: number;
}

export interface CompareOptions {
  /** Treat case differences as changes. Defaults to false. */
  caseSensitive?: boolean;
  signal?: AbortSignal;
}

/** Splits page text into comparable word tokens. */
function tokenize(text: string, caseSensitive: boolean): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(" ");
  return caseSensitive ? words : words.map((word) => word.toLowerCase());
}

/**
 * Longest common subsequence over word tokens.
 *
 * The classic dynamic-programming diff. Pages are bounded in size, so the
 * quadratic table is fine; a guard below falls back for pathological inputs.
 */
function diffWords(original: string[], revised: string[]): TextChange[] {
  const rows = original.length;
  const columns = revised.length;

  // A very long page would make the table enormous; report it as a whole-page
  // replacement instead of stalling the browser.
  if (rows * columns > 4_000_000) {
    const changes: TextChange[] = [];
    if (rows) changes.push({ type: "delete", text: original.join(" ") });
    if (columns) changes.push({ type: "insert", text: revised.join(" ") });
    return changes;
  }

  // table[i][j] = LCS length of original[i..] and revised[j..].
  const table: Uint32Array[] = Array.from(
    { length: rows + 1 },
    () => new Uint32Array(columns + 1)
  );
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--) {
      table[i][j] =
        original[i] === revised[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const changes: TextChange[] = [];
  let pending: { type: ChangeType; words: string[] } | null = null;
  const flush = () => {
    if (pending && pending.words.length) {
      changes.push({ type: pending.type, text: pending.words.join(" ") });
    }
    pending = null;
  };
  const push = (type: ChangeType, word: string) => {
    if (!pending || pending.type !== type) {
      flush();
      pending = { type, words: [] };
    }
    pending.words.push(word);
  };

  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (original[i] === revised[j]) {
      push("equal", original[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("delete", original[i]);
      i++;
    } else {
      push("insert", revised[j]);
      j++;
    }
  }
  while (i < rows) push("delete", original[i++]);
  while (j < columns) push("insert", revised[j++]);
  flush();

  return changes;
}

/** Jaccard-style similarity over word multisets, used to align pages. */
function similarity(original: string[], revised: string[]): number {
  if (!original.length && !revised.length) return 1;
  if (!original.length || !revised.length) return 0;

  const counts = new Map<string, number>();
  for (const word of original) counts.set(word, (counts.get(word) ?? 0) + 1);

  let shared = 0;
  for (const word of revised) {
    const remaining = counts.get(word) ?? 0;
    if (remaining > 0) {
      shared++;
      counts.set(word, remaining - 1);
    }
  }
  return (2 * shared) / (original.length + revised.length);
}

/** Reads each page of a PDF as a single string of text. */
async function readPageText(data: Uint8Array, signal?: AbortSignal): Promise<string[]> {
  const extracted = await extractPdf(data, { includeImages: false, signal });
  return extracted.pages.map((page) =>
    buildLines(page.items)
      .map((line) => line.text)
      .join(" ")
      .trim()
  );
}

/**
 * Aligns pages between the two documents.
 *
 * Walking both documents together and consulting a similarity score lets an
 * inserted or deleted page shift the alignment, instead of marking everything
 * after it as modified.
 */
function alignPages(
  original: string[][],
  revised: string[][]
): Array<{ originalIndex: number | null; revisedIndex: number | null }> {
  const pairs: Array<{ originalIndex: number | null; revisedIndex: number | null }> = [];
  let i = 0;
  let j = 0;

  while (i < original.length && j < revised.length) {
    const direct = similarity(original[i], revised[j]);
    // A close match means the pages correspond, edits included.
    if (direct >= 0.5) {
      pairs.push({ originalIndex: i, revisedIndex: j });
      i++;
      j++;
      continue;
    }

    // Otherwise decide whether a page was inserted or removed by looking one
    // step ahead on each side.
    const skipOriginal = j < revised.length && i + 1 < original.length
      ? similarity(original[i + 1], revised[j])
      : 0;
    const skipRevised = i < original.length && j + 1 < revised.length
      ? similarity(original[i], revised[j + 1])
      : 0;

    if (skipRevised > skipOriginal && skipRevised >= 0.5) {
      pairs.push({ originalIndex: null, revisedIndex: j });
      j++;
    } else if (skipOriginal > skipRevised && skipOriginal >= 0.5) {
      pairs.push({ originalIndex: i, revisedIndex: null });
      i++;
    } else {
      // Neither lookahead helps: treat them as a modified pair.
      pairs.push({ originalIndex: i, revisedIndex: j });
      i++;
      j++;
    }
  }

  while (i < original.length) pairs.push({ originalIndex: i++, revisedIndex: null });
  while (j < revised.length) pairs.push({ originalIndex: null, revisedIndex: j++ });

  return pairs;
}

/** Compares two PDFs and reports their differences. */
export async function comparePdfs(
  originalData: Uint8Array,
  revisedData: Uint8Array,
  options: CompareOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<ComparisonSummary> {
  const caseSensitive = options.caseSensitive === true;

  onProgress?.({ stage: "Reading the original", progress: 10, total: 100 });
  const originalText = await readPageText(originalData, options.signal);

  onProgress?.({ stage: "Reading the revision", progress: 40, total: 100 });
  const revisedText = await readPageText(revisedData, options.signal);

  if (!originalText.length && !revisedText.length) {
    throw conversionErrors.noContent("PDF");
  }

  onProgress?.({ stage: "Comparing pages", progress: 70, total: 100 });

  const originalTokens = originalText.map((text) => tokenize(text, caseSensitive));
  const revisedTokens = revisedText.map((text) => tokenize(text, caseSensitive));
  const alignment = alignPages(originalTokens, revisedTokens);

  const pages: PageComparison[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let pagesAdded = 0;
  let pagesRemoved = 0;
  let pagesModified = 0;

  for (const pair of alignment) {
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    const originalWords = pair.originalIndex === null ? [] : originalTokens[pair.originalIndex];
    const revisedWords = pair.revisedIndex === null ? [] : revisedTokens[pair.revisedIndex];

    if (pair.originalIndex === null) {
      pagesAdded++;
      totalAdded += revisedWords.length;
      pages.push({
        status: "added",
        originalPage: null,
        revisedPage: pair.revisedIndex! + 1,
        changes: revisedWords.length ? [{ type: "insert", text: revisedText[pair.revisedIndex!] }] : [],
        addedWords: revisedWords.length,
        removedWords: 0,
        similarity: 0,
      });
      continue;
    }

    if (pair.revisedIndex === null) {
      pagesRemoved++;
      totalRemoved += originalWords.length;
      pages.push({
        status: "removed",
        originalPage: pair.originalIndex + 1,
        revisedPage: null,
        changes: originalWords.length
          ? [{ type: "delete", text: originalText[pair.originalIndex] }]
          : [],
        addedWords: 0,
        removedWords: originalWords.length,
        similarity: 0,
      });
      continue;
    }

    const changes = diffWords(originalWords, revisedWords);
    const added = changes
      .filter((change) => change.type === "insert")
      .reduce((sum, change) => sum + change.text.split(" ").filter(Boolean).length, 0);
    const removed = changes
      .filter((change) => change.type === "delete")
      .reduce((sum, change) => sum + change.text.split(" ").filter(Boolean).length, 0);

    const changed = added > 0 || removed > 0;
    if (changed) pagesModified++;
    totalAdded += added;
    totalRemoved += removed;

    pages.push({
      status: changed ? "modified" : "unchanged",
      originalPage: pair.originalIndex + 1,
      revisedPage: pair.revisedIndex + 1,
      // Unchanged pages carry no diff, keeping the payload small.
      changes: changed ? changes : [],
      addedWords: added,
      removedWords: removed,
      similarity: Math.round(similarity(originalWords, revisedWords) * 100) / 100,
    });
  }

  onProgress?.({ stage: "Completed", progress: 100, total: 100 });

  return {
    pages,
    identical: totalAdded === 0 && totalRemoved === 0 && pagesAdded === 0 && pagesRemoved === 0,
    totalAdded,
    totalRemoved,
    pagesAdded,
    pagesRemoved,
    pagesModified,
    originalPageCount: originalText.length,
    revisedPageCount: revisedText.length,
  };
}
