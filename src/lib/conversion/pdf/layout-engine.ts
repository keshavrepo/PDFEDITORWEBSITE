/**
 * Line-breaking and pagination for reflowable content.
 *
 * Word documents describe content as a stream, so the converter must perform
 * the layout the word processor would normally do: measure runs, break lines at
 * legal points, keep styling intact across breaks, and flow onto new pages.
 */

import type { PDFFont } from "pdf-lib";
import { sanitizeForPdf } from "./font-registry";
import type { TextRunModel } from "../types";

export interface MeasuredRun extends TextRunModel {
  /** Sanitised text actually drawn into the PDF. */
  safeText: string;
  font: PDFFont;
  width: number;
}

export interface LaidOutLine {
  runs: MeasuredRun[];
  width: number;
  ascent: number;
  descent: number;
  height: number;
}

export type FontResolver = (run: TextRunModel) => Promise<PDFFont>;

/** Scale factors applied to a run's size for super/subscript. */
const SCRIPT_SCALE = 0.62;
const SCRIPT_RISE = 0.34;
const SUBSCRIPT_DROP = 0.16;

export function effectiveFontSize(run: TextRunModel): number {
  return run.superscript || run.subscript ? run.fontSize * SCRIPT_SCALE : run.fontSize;
}

export function baselineOffset(run: TextRunModel): number {
  if (run.superscript) return run.fontSize * SCRIPT_RISE;
  if (run.subscript) return -run.fontSize * SUBSCRIPT_DROP;
  return 0;
}

/** Safe width measurement; pdf-lib throws on unencodable input. */
export function measureText(font: PDFFont, text: string, size: number): number {
  if (!text) return 0;
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    // Fall back to an average-width estimate rather than failing the document.
    return text.length * size * 0.5;
  }
}

interface Token {
  text: string;
  run: TextRunModel;
  font: PDFFont;
  width: number;
  /** Whitespace tokens collapse at line ends. */
  isSpace: boolean;
  isNewline: boolean;
}

/**
 * Splits runs into breakable tokens.
 *
 * Breaks are permitted at whitespace and after hyphens/slashes, matching how
 * word processors handle long compound terms and URLs.
 */
async function tokenize(runs: TextRunModel[], resolveFont: FontResolver): Promise<Token[]> {
  const tokens: Token[] = [];

  for (const run of runs) {
    const font = await resolveFont(run);
    const size = effectiveFontSize(run);
    const safe = sanitizeForPdf(run.text);
    if (!safe) continue;

    // Keep whitespace as its own token so trailing spaces can be dropped.
    const parts = safe.split(/(\n|\t|[ ]+)/);
    for (const part of parts) {
      if (!part) continue;

      if (part === "\n") {
        tokens.push({ text: "", run, font, width: 0, isSpace: false, isNewline: true });
        continue;
      }
      if (part === "\t") {
        // Render tabs as a fixed advance; PDF has no tab stops.
        const width = measureText(font, "    ", size);
        tokens.push({ text: "    ", run, font, width, isSpace: true, isNewline: false });
        continue;
      }
      if (/^[ ]+$/.test(part)) {
        tokens.push({
          text: part,
          run,
          font,
          width: measureText(font, part, size),
          isSpace: true,
          isNewline: false,
        });
        continue;
      }

      // Sub-split on hyphen/slash boundaries, keeping the separator attached.
      for (const chunk of part.split(/(?<=[-/\u2013\u2014])/)) {
        if (!chunk) continue;
        tokens.push({
          text: chunk,
          run,
          font,
          width: measureText(font, chunk, size),
          isSpace: false,
          isNewline: false,
        });
      }
    }
  }

  return tokens;
}

/** Splits a token that cannot fit on any line (long URLs, unbroken strings). */
function splitOversizedToken(token: Token, maxWidth: number): Token[] {
  const size = effectiveFontSize(token.run);
  const pieces: Token[] = [];
  let current = "";

  for (const character of token.text) {
    const candidate = current + character;
    if (current && measureText(token.font, candidate, size) > maxWidth) {
      pieces.push({
        ...token,
        text: current,
        width: measureText(token.font, current, size),
      });
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) {
    pieces.push({ ...token, text: current, width: measureText(token.font, current, size) });
  }
  return pieces.length ? pieces : [token];
}

function tokenToRun(token: Token): MeasuredRun {
  return {
    ...token.run,
    safeText: token.text,
    font: token.font,
    width: token.width,
  };
}

/** Merges adjacent tokens that share identical styling. */
function mergeRuns(tokens: Token[]): MeasuredRun[] {
  const runs: MeasuredRun[] = [];

  for (const token of tokens) {
    const previous = runs.at(-1);
    if (
      previous &&
      previous.font === token.font &&
      previous.fontSize === token.run.fontSize &&
      previous.color === token.run.color &&
      previous.underline === token.run.underline &&
      previous.strike === token.run.strike &&
      previous.superscript === token.run.superscript &&
      previous.subscript === token.run.subscript
    ) {
      previous.safeText += token.text;
      previous.width += token.width;
    } else {
      runs.push(tokenToRun(token));
    }
  }
  return runs;
}

function finalizeLine(tokens: Token[]): LaidOutLine {
  // Trailing whitespace must not affect alignment or width.
  const trimmed = [...tokens];
  while (trimmed.length && trimmed[trimmed.length - 1].isSpace) trimmed.pop();

  const runs = mergeRuns(trimmed);
  const width = runs.reduce((sum, run) => sum + run.width, 0);

  let ascent = 0;
  let descent = 0;
  for (const token of tokens.length ? tokens : trimmed) {
    const size = effectiveFontSize(token.run);
    const rise = baselineOffset(token.run);
    ascent = Math.max(ascent, size * 0.86 + Math.max(0, rise));
    descent = Math.max(descent, size * 0.26 + Math.max(0, -rise));
  }
  if (!ascent) ascent = 10;

  return { runs, width, ascent, descent, height: ascent + descent };
}

/** Breaks runs into lines that fit `maxWidth`. */
export async function layoutLines(
  runs: TextRunModel[],
  maxWidth: number,
  resolveFont: FontResolver,
  firstLineIndent = 0
): Promise<LaidOutLine[]> {
  const tokens = await tokenize(runs, resolveFont);
  if (!tokens.length) return [];

  const lines: LaidOutLine[] = [];
  let current: Token[] = [];
  let currentWidth = 0;
  let available = Math.max(1, maxWidth - Math.max(0, firstLineIndent));

  const pushLine = () => {
    lines.push(finalizeLine(current));
    current = [];
    currentWidth = 0;
    available = Math.max(1, maxWidth);
  };

  for (const token of tokens) {
    if (token.isNewline) {
      pushLine();
      continue;
    }

    // Never start a line with whitespace.
    if (token.isSpace && !current.length) continue;

    if (currentWidth + token.width <= available || !current.length) {
      // A single token wider than the line must be split by character.
      if (!current.length && token.width > available && !token.isSpace) {
        const pieces = splitOversizedToken(token, available);
        for (let index = 0; index < pieces.length; index++) {
          current = [pieces[index]];
          currentWidth = pieces[index].width;
          if (index < pieces.length - 1) pushLine();
        }
        continue;
      }
      current.push(token);
      currentWidth += token.width;
    } else {
      pushLine();
      if (token.isSpace) continue;
      if (token.width > available) {
        const pieces = splitOversizedToken(token, available);
        for (let index = 0; index < pieces.length; index++) {
          current = [pieces[index]];
          currentWidth = pieces[index].width;
          if (index < pieces.length - 1) pushLine();
        }
        continue;
      }
      current.push(token);
      currentWidth = token.width;
    }
  }

  if (current.length) pushLine();
  return lines.filter((line, index) => line.runs.length > 0 || index < lines.length - 1);
}
