/**
 * Reconstructs logical document structure from positioned PDF text.
 *
 * A PDF stores glyphs at coordinates and nothing else — there are no
 * paragraphs, lists or tables in the file. This module rebuilds that structure
 * geometrically:
 *
 *   fragments -> lines -> columns of aligned lines -> tables / paragraphs
 *
 * Thresholds are expressed relative to font size so they hold for both 8pt
 * footnotes and 40pt titles.
 */

import type { ExtractedPage, ExtractedTextItem } from "./pdf-extractor";
import type { HorizontalAlignment, TextRunModel } from "../types";

export interface AnalyzedLine {
  items: ExtractedTextItem[];
  text: string;
  x: number;
  right: number;
  baseline: number;
  fontSize: number;
  ascent: number;
  descent: number;
}

export interface AnalyzedParagraph {
  kind: "paragraph";
  lines: AnalyzedLine[];
  align: HorizontalAlignment;
  headingLevel?: number;
  indentLeft: number;
  indentFirstLine: number;
  spaceBefore: number;
  list?: { ordered: boolean; marker: string; level: number };
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface AnalyzedTable {
  kind: "table";
  rows: AnalyzedLine[][][];
  columnEdges: number[];
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type AnalyzedBlock = AnalyzedParagraph | AnalyzedTable;

/** Bullet glyphs commonly emitted by Word, LaTeX and design tools. */
const BULLET_CHARACTERS = /^[\u2022\u2023\u25AA\u25CF\u25E6\u2043\u2219\u00B7\u2212\u2013\u2014*o\u25A0\u25CB\uF0B7\uF0A7]$/;
const ORDERED_MARKER = /^\(?(\d{1,3}|[ivxlcdm]{1,7}|[a-z])[.)\]]$/i;

/* -------------------------------------------------------------------------- */
/* Line building                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Groups fragments sharing a baseline into lines.
 *
 * Superscripts and inline size changes shift the baseline slightly, so the
 * tolerance scales with font size rather than using a fixed epsilon.
 */
export function buildLines(items: ExtractedTextItem[]): AnalyzedLine[] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => a.baseline - b.baseline || a.x - b.x);
  const lines: AnalyzedLine[] = [];
  let current: ExtractedTextItem[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index++) {
    const item = sorted[index];
    const reference = current[current.length - 1];
    const tolerance = Math.max(2, Math.min(reference.fontSize, item.fontSize) * 0.45);

    if (Math.abs(item.baseline - reference.baseline) <= tolerance) {
      current.push(item);
    } else {
      lines.push(finalizeLine(current));
      current = [item];
    }
  }
  lines.push(finalizeLine(current));
  return lines;
}

function finalizeLine(items: ExtractedTextItem[]): AnalyzedLine {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  // The dominant font size drives spacing decisions; ignore stray superscripts.
  const fontSize = medianBy(ordered, (item) => item.fontSize);
  const baseline = medianBy(ordered, (item) => item.baseline);

  return {
    items: ordered,
    text: joinItems(ordered),
    x: ordered[0].x,
    right: Math.max(...ordered.map((item) => item.x + item.width)),
    baseline,
    fontSize,
    ascent: Math.max(...ordered.map((item) => item.ascent)),
    descent: Math.max(...ordered.map((item) => item.descent)),
  };
}

/**
 * Concatenates fragments, inserting spaces where the geometry implies one.
 *
 * PDF producers split words arbitrarily (kerning pairs, colour changes), so
 * gaps are measured rather than trusting fragment boundaries.
 */
function joinItems(items: ExtractedTextItem[]): string {
  let text = "";
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (index > 0) {
      const previous = items[index - 1];
      const gap = item.x - (previous.x + previous.width);
      const threshold = Math.min(previous.fontSize, item.fontSize) * 0.16;
      const endsWithSpace = /\s$/.test(text);
      const startsWithSpace = /^\s/.test(item.text);
      if (gap > threshold && !endsWithSpace && !startsWithSpace) text += " ";
    }
    text += item.text;
  }
  return text.replace(/\s+/g, " ").trim();
}

function medianBy<T>(values: T[], select: (value: T) => number): number {
  const numbers = values.map(select).sort((a, b) => a - b);
  return numbers[Math.floor(numbers.length / 2)];
}

/* -------------------------------------------------------------------------- */
/* Table detection                                                            */
/* -------------------------------------------------------------------------- */

interface ColumnGap {
  start: number;
  end: number;
}

/**
 * Detects tabular regions.
 *
 * A run of consecutive lines forms a table when they share the same vertical
 * whitespace corridors — the gaps between columns. This catches borderless
 * tables, which vector-graphics detection would miss entirely.
 */
function detectTables(lines: AnalyzedLine[], pageWidth: number): Array<{ start: number; end: number; edges: number[] }> {
  const candidates: Array<{ start: number; end: number; edges: number[] }> = [];
  let index = 0;

  while (index < lines.length) {
    const gapsForLine = lines.map(lineGaps);
    const startGaps = gapsForLine[index];
    if (startGaps.length === 0) {
      index++;
      continue;
    }

    let end = index;
    let sharedGaps = startGaps;

    while (end + 1 < lines.length) {
      const next = gapsForLine[end + 1];
      if (!next.length) break;
      // Rows must stay vertically adjacent; a large jump ends the table.
      const verticalGap = lines[end + 1].baseline - lines[end].baseline;
      if (verticalGap > lines[end].fontSize * 3.2) break;

      const merged = intersectGaps(sharedGaps, next);
      if (!merged.length) break;
      sharedGaps = merged;
      end++;
    }

    const rowCount = end - index + 1;
    // Two rows with one corridor is usually a label/value pair, not a table.
    if (rowCount >= 3 && sharedGaps.length >= 1) {
      candidates.push({ start: index, end, edges: gapsToEdges(sharedGaps, lines.slice(index, end + 1), pageWidth) });
      index = end + 1;
    } else {
      index++;
    }
  }

  return candidates;
}

/** Finds whitespace corridors inside a line that are wide enough to be columns. */
function lineGaps(line: AnalyzedLine): ColumnGap[] {
  const gaps: ColumnGap[] = [];
  // Require a gap several spaces wide so ordinary word spacing never qualifies.
  const minimum = Math.max(line.fontSize * 1.4, 10);

  for (let index = 1; index < line.items.length; index++) {
    const previous = line.items[index - 1];
    const current = line.items[index];
    const start = previous.x + previous.width;
    const end = current.x;
    if (end - start >= minimum) gaps.push({ start, end });
  }
  return gaps;
}

/** Keeps only corridors that overlap between two lines. */
function intersectGaps(left: ColumnGap[], right: ColumnGap[]): ColumnGap[] {
  const result: ColumnGap[] = [];
  for (const a of left) {
    for (const b of right) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end - start > 4) result.push({ start, end });
    }
  }
  return result;
}

/** Converts shared corridors into absolute column boundaries. */
function gapsToEdges(gaps: ColumnGap[], lines: AnalyzedLine[], pageWidth: number): number[] {
  const left = Math.min(...lines.map((line) => line.x));
  const right = Math.max(...lines.map((line) => line.right));
  const centers = gaps
    .map((gap) => (gap.start + gap.end) / 2)
    .sort((a, b) => a - b)
    .filter((value, index, all) => index === 0 || value - all[index - 1] > 6);

  return [Math.max(0, left), ...centers, Math.min(pageWidth, right)];
}

/** Splits a line's fragments into cells using the detected column edges. */
function splitIntoCells(line: AnalyzedLine, edges: number[]): AnalyzedLine[][] {
  const cells: AnalyzedLine[][] = edges.slice(0, -1).map(() => []);

  for (let column = 0; column < edges.length - 1; column++) {
    const start = edges[column];
    const end = edges[column + 1];
    const items = line.items.filter((item) => {
      const center = item.x + item.width / 2;
      // Include the left-most edge so nothing is dropped.
      return center >= (column === 0 ? -Infinity : start) && center < (column === edges.length - 2 ? Infinity : end);
    });
    if (items.length) cells[column] = [finalizeLine(items)];
  }

  return cells;
}

/* -------------------------------------------------------------------------- */
/* Paragraph assembly                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Groups lines into paragraphs and classifies headings and list items.
 *
 * A new paragraph starts on a larger-than-normal vertical gap, a change of
 * indentation, a font-size change, or an explicit list marker.
 */
function buildParagraphs(lines: AnalyzedLine[], bodyFontSize: number, pageWidth: number): AnalyzedParagraph[] {
  const paragraphs: AnalyzedParagraph[] = [];
  let current: AnalyzedLine[] = [];
  let previousGap = 0;

  const flush = (spaceBefore: number) => {
    if (!current.length) return;
    paragraphs.push(makeParagraph(current, bodyFontSize, pageWidth, spaceBefore));
    current = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!current.length) {
      current = [line];
      continue;
    }

    const previous = current[current.length - 1];
    const gap = line.baseline - previous.baseline;
    const naturalLeading = Math.max(previous.fontSize, line.fontSize) * 1.32;

    const sizeChanged = Math.abs(line.fontSize - previous.fontSize) > Math.max(0.6, previous.fontSize * 0.14);
    const startsList = Boolean(detectListMarker(line));
    const indentJump = line.x - previous.x > previous.fontSize * 0.9;
    // A short previous line that ends a sentence implies a paragraph break.
    const previousEnded =
      /[.!?:;]["')\]]?$/.test(previous.text) && previous.right < maxRight(lines) - previous.fontSize * 2.2;

    const breaks =
      gap > naturalLeading * 1.24 ||
      sizeChanged ||
      startsList ||
      indentJump ||
      (previousEnded && gap > naturalLeading * 1.02);

    if (breaks) {
      flush(previousGap);
      previousGap = Math.max(0, gap - naturalLeading);
      current = [line];
    } else {
      current.push(line);
    }
  }
  flush(previousGap);

  return paragraphs;
}

function maxRight(lines: AnalyzedLine[]): number {
  return Math.max(...lines.map((line) => line.right));
}

function makeParagraph(
  lines: AnalyzedLine[],
  bodyFontSize: number,
  pageWidth: number,
  spaceBefore: number
): AnalyzedParagraph {
  const first = lines[0];
  const left = Math.min(...lines.map((line) => line.x));
  const right = Math.max(...lines.map((line) => line.right));
  const list = detectListMarker(first);

  return {
    kind: "paragraph",
    lines,
    align: detectAlignment(lines, pageWidth),
    headingLevel: detectHeadingLevel(lines, bodyFontSize),
    indentLeft: left,
    // A first-line indent only exists when later lines sit further left.
    indentFirstLine: lines.length > 1 ? first.x - left : 0,
    spaceBefore,
    list: list || undefined,
    top: first.baseline - first.ascent,
    bottom: lines[lines.length - 1].baseline + lines[lines.length - 1].descent,
    left,
    right,
  };
}

/**
 * Infers alignment from line geometry.
 * Centred text has balanced margins; justified text has flush right edges on
 * every line except the last.
 */
function detectAlignment(lines: AnalyzedLine[], pageWidth: number): HorizontalAlignment {
  const left = Math.min(...lines.map((line) => line.x));
  const right = Math.max(...lines.map((line) => line.right));
  const leftMargin = left;
  const rightMargin = pageWidth - right;
  const fontSize = lines[0].fontSize;

  // Centred: comparable margins on both sides, and not full width.
  if (
    Math.abs(leftMargin - rightMargin) < fontSize * 0.9 &&
    leftMargin > fontSize * 1.6 &&
    right - left < pageWidth * 0.92
  ) {
    return "center";
  }

  // Right aligned: a real left margin with almost none on the right.
  if (leftMargin > pageWidth * 0.35 && rightMargin < fontSize * 1.2) return "right";

  if (lines.length >= 3) {
    const bodyLines = lines.slice(0, -1);
    const rights = bodyLines.map((line) => line.right);
    const spread = Math.max(...rights) - Math.min(...rights);
    if (spread < fontSize * 0.5) return "justify";
  }

  return "left";
}

/**
 * Classifies headings by relative font size and weight.
 * Absolute sizes are meaningless across documents, so everything is measured
 * against the page's dominant body size.
 */
function detectHeadingLevel(lines: AnalyzedLine[], bodyFontSize: number): number | undefined {
  if (lines.length > 3) return undefined;
  const line = lines[0];
  const ratio = line.fontSize / bodyFontSize;
  const allBold = line.items.every((item) => item.font.bold);
  const text = lines.map((entry) => entry.text).join(" ");

  // Long runs of text are body copy regardless of styling.
  if (text.length > 200) return undefined;
  if (/[.!?]\s/.test(text) && ratio < 1.15) return undefined;

  if (ratio >= 1.85) return 1;
  if (ratio >= 1.5) return 2;
  if (ratio >= 1.26) return 3;
  if (ratio >= 1.12) return allBold ? 3 : 4;
  if (allBold && ratio >= 0.98 && text.length < 120) return 4;
  return undefined;
}

/** Recognises a leading bullet or numbering marker. */
function detectListMarker(
  line: AnalyzedLine
): { ordered: boolean; marker: string; level: number } | null {
  const first = line.items[0];
  if (!first) return null;
  const token = first.text.trim().split(/\s+/)[0] || "";
  if (!token) return null;

  const level = Math.max(0, Math.min(4, Math.floor(line.x / 24)));
  if (BULLET_CHARACTERS.test(token)) return { ordered: false, marker: "\u2022", level };
  if (ORDERED_MARKER.test(token) && line.items.length > 1) {
    return { ordered: true, marker: token, level };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Most common font size on the page, weighted by character count. */
export function estimateBodyFontSize(lines: AnalyzedLine[]): number {
  const weights = new Map<number, number>();
  for (const line of lines) {
    const rounded = Math.round(line.fontSize * 2) / 2;
    weights.set(rounded, (weights.get(rounded) || 0) + line.text.length);
  }
  let best = 11;
  let bestWeight = -1;
  for (const [size, weight] of weights) {
    if (weight > bestWeight) {
      best = size;
      bestWeight = weight;
    }
  }
  return best || 11;
}

/** Analyses one page into ordered paragraphs and tables. */
export function analyzePage(page: ExtractedPage): {
  blocks: AnalyzedBlock[];
  bodyFontSize: number;
} {
  const lines = buildLines(page.items);
  if (!lines.length) return { blocks: [], bodyFontSize: 11 };

  const bodyFontSize = estimateBodyFontSize(lines);
  const tables = detectTables(lines, page.width);
  const blocks: AnalyzedBlock[] = [];

  let cursor = 0;
  for (const table of tables) {
    if (table.start > cursor) {
      blocks.push(...buildParagraphs(lines.slice(cursor, table.start), bodyFontSize, page.width));
    }
    const rows = lines.slice(table.start, table.end + 1).map((line) => splitIntoCells(line, table.edges));
    blocks.push({
      kind: "table",
      rows,
      columnEdges: table.edges,
      top: lines[table.start].baseline - lines[table.start].ascent,
      bottom: lines[table.end].baseline + lines[table.end].descent,
      left: table.edges[0],
      right: table.edges[table.edges.length - 1],
    });
    cursor = table.end + 1;
  }
  if (cursor < lines.length) {
    blocks.push(...buildParagraphs(lines.slice(cursor), bodyFontSize, page.width));
  }

  return { blocks, bodyFontSize };
}

/** Converts a line's fragments into styled runs, merging identical styling. */
export function lineToRuns(line: AnalyzedLine, stripListMarker = false): TextRunModel[] {
  const runs: TextRunModel[] = [];
  let items = line.items;

  if (stripListMarker && items.length > 1) {
    const [first, ...rest] = items;
    const withoutMarker = first.text.trim().replace(/^\S+\s*/, "");
    items = withoutMarker ? [{ ...first, text: withoutMarker }, ...rest] : rest;
  }

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const baseSize = line.fontSize;
    // Small text raised above the baseline is superscript.
    const offset = line.baseline - item.baseline;
    const superscript = item.fontSize < baseSize * 0.86 && offset > baseSize * 0.14;
    const subscript = item.fontSize < baseSize * 0.86 && offset < -baseSize * 0.1;

    let text = item.text;
    if (index > 0) {
      const previous = items[index - 1];
      const gap = item.x - (previous.x + previous.width);
      if (gap > Math.min(previous.fontSize, item.fontSize) * 0.16 && !/\s$/.test(runs.at(-1)?.text || "") && !/^\s/.test(text)) {
        text = ` ${text}`;
      }
    }

    const run: TextRunModel = {
      text,
      fontFamily: item.font.family,
      fontSize: superscript || subscript ? Math.round(baseSize * 10) / 10 : Math.round(item.fontSize * 10) / 10,
      bold: item.font.bold,
      italic: item.font.italic,
      color: item.color,
      superscript,
      subscript,
    };

    const previousRun = runs.at(-1);
    if (
      previousRun &&
      previousRun.fontFamily === run.fontFamily &&
      previousRun.fontSize === run.fontSize &&
      previousRun.bold === run.bold &&
      previousRun.italic === run.italic &&
      previousRun.color === run.color &&
      previousRun.superscript === run.superscript &&
      previousRun.subscript === run.subscript
    ) {
      previousRun.text += run.text;
    } else {
      runs.push(run);
    }
  }

  return runs.filter((run) => run.text.length > 0);
}
