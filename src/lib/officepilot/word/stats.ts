/**
 * Word document statistics.
 *
 * Single pass over the block list to count characters, words, blocks and
 * page breaks. The "characters" figure follows the convention of
 * Microsoft Word: it counts visible characters including spaces, minus
 * the trailing spaces of every run, so it matches what the user sees
 * in the status bar.
 */

import type {
  WordBody,
  WordBlock,
  WordRun,
  WordStats,
} from "./schema";

/** Walks a runs array and returns the concatenated text. */
export function runsToText(runs: WordRun[]): string {
  return runs.map((run) => run.text).join("");
}

/** Computes the count of characters inside a run, trimmed of trailing space. */
function runCharacters(run: WordRun): number {
  return run.text.replace(/[ \t]+$/u, "").length;
}

/** Counts the words inside a text. */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}

/** Counts characters and words across a block. */
function countBlock(
  block: WordBlock
): { characters: number; charactersWithSpaces: number; words: number; blocks: number; pageBreaks: number } {
  switch (block.type) {
    case "paragraph":
    case "heading": {
      const text = runsToText(block.runs);
      const characters = block.runs.reduce((sum, run) => sum + runCharacters(run), 0);
      return {
        characters,
        charactersWithSpaces: text.length,
        words: countWords(text),
        blocks: 1,
        pageBreaks: 0,
      };
    }
    case "list": {
      const characters = block.items.reduce(
        (sum, item) =>
          sum + item.runs.reduce((itemSum, run) => itemSum + runCharacters(run), 0),
        0
      );
      const charactersWithSpaces = block.items
        .map((item) => runsToText(item.runs))
        .join(" ")
        .length;
      const words = block.items.reduce(
        (sum, item) => sum + countWords(runsToText(item.runs)),
        0
      );
      return {
        characters,
        charactersWithSpaces,
        words,
        blocks: 1,
        pageBreaks: 0,
      };
    }
    case "quote": {
      const text = runsToText(block.runs);
      return {
        characters: block.runs.reduce((sum, run) => sum + runCharacters(run), 0),
        charactersWithSpaces: text.length,
        words: countWords(text),
        blocks: 1,
        pageBreaks: 0,
      };
    }
    case "code": {
      return {
        characters: block.text.length,
        charactersWithSpaces: block.text.length,
        words: countWords(block.text),
        blocks: 1,
        pageBreaks: 0,
      };
    }
    case "table": {
      let characters = 0;
      let charactersWithSpaces = 0;
      let words = 0;
      for (const row of block.rows) {
        for (const cell of row.cells) {
          const text = runsToText(cell.runs);
          characters += cell.runs.reduce(
            (sum, run) => sum + runCharacters(run),
            0
          );
          charactersWithSpaces += text.length;
          words += countWords(text);
        }
      }
      return {
        characters,
        charactersWithSpaces,
        words,
        blocks: 1,
        pageBreaks: 0,
      };
    }
    case "image":
      return { characters: 0, charactersWithSpaces: 0, words: 0, blocks: 1, pageBreaks: 0 };
    case "page-break":
      return { characters: 0, charactersWithSpaces: 0, words: 0, blocks: 1, pageBreaks: 1 };
    default:
      return { characters: 0, charactersWithSpaces: 0, words: 0, blocks: 1, pageBreaks: 0 };
  }
}

/**
 * Computes a stats object for a Word body.
 *
 * The "blocks" count is the number of top-level blocks; the "pages" figure
 * is approximated by counting the number of explicit page breaks plus a
 * 1-page minimum.
 */
export function computeWordStats(body: WordBody): WordStats {
  let characters = 0;
  let charactersWithSpaces = 0;
  let words = 0;
  let blocks = 0;
  let pageBreaks = 0;

  for (const block of body.blocks) {
    const tally = countBlock(block);
    characters += tally.characters;
    charactersWithSpaces += tally.charactersWithSpaces;
    words += tally.words;
    blocks += tally.blocks;
    pageBreaks += tally.pageBreaks;
  }

  // A full text body usually fits in about 400 words per page; the
  // approximation below is close enough for the status bar.
  const estimatedPages = Math.max(1, pageBreaks + 1, Math.ceil(words / 400) || 1);
  const readingTimeMinutes = Math.max(1, Math.round(words / 220));

  return {
    blocks,
    characters,
    charactersWithSpaces,
    words,
    pages: estimatedPages,
    readingTimeMinutes,
  };
}
