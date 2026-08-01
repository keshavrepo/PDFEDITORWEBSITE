/**
 * OfficePilot Word block operations.
 *
 * Pure functions over the Word body model. Used by the editor to mutate
 * the document, by the undo/redo history, and by the importer to clean
 * up tree-walk artefacts. Every function is deterministic so the editor
 * can diff before/after for the "no-op autosave" check.
 */

import type {
  WordAlignment,
  WordBlock,
  WordBody,
  WordListKind,
  WordMark,
  WordRun,
} from "./schema";

/** A position inside the block list. */
export interface BlockPosition {
  /** Index of the block in the body. */
  index: number;
  /** Optional offset inside the block, for fine-grained undo. */
  offset?: number;
}

/** Generates a fresh block id. */
export function makeBlockId(prefix = "block"): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/** Clones a block with a fresh id. */
export function cloneBlock<T extends WordBlock>(block: T, idPrefix?: string): T {
  return {
    ...block,
    id: makeBlockId(idPrefix ?? block.type),
  } as T;
}

/** Returns a deep clone of the body. */
export function cloneBody(body: WordBody): WordBody {
  return {
    ...body,
    blocks: body.blocks.map((block) => cloneBlock(block) as WordBlock),
    settings: {
      ...body.settings,
      page: { ...body.settings.page },
      header: {
        left: [...body.settings.header.left],
        center: [...body.settings.header.center],
        right: [...body.settings.header.right],
      },
      footer: {
        left: [...body.settings.footer.left],
        center: [...body.settings.footer.center],
        right: [...body.settings.footer.right],
      },
    },
  };
}

/** Returns the block at a given index. */
export function blockAt(body: WordBody, index: number): WordBlock | undefined {
  return body.blocks[index];
}

/** Returns a new body with one block replaced. */
export function replaceBlock(
  body: WordBody,
  index: number,
  block: WordBlock
): WordBody {
  if (index < 0 || index >= body.blocks.length) return body;
  const next = body.blocks.slice();
  next[index] = block;
  return { ...body, blocks: next };
}

/** Returns a new body with a block inserted at an index. */
export function insertBlock(body: WordBody, index: number, block: WordBlock): WordBody {
  const next = body.blocks.slice();
  next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
  return { ...body, blocks: next };
}

/** Returns a new body with a block removed. */
export function removeBlock(body: WordBody, index: number): WordBody {
  if (index < 0 || index >= body.blocks.length) return body;
  const next = body.blocks.slice();
  next.splice(index, 1);
  return { ...body, blocks: next };
}

/** Returns a new body with blocks in the given range moved to a new position. */
export function moveBlockRange(
  body: WordBody,
  start: number,
  end: number,
  to: number
): WordBody {
  if (start < 0 || end >= body.blocks.length || start > end) return body;
  const next = body.blocks.slice();
  const block = next.splice(start, end - start + 1)[0]!;
  const target = to > start ? to - 1 : to;
  next.splice(Math.max(0, Math.min(target, next.length)), 0, block);
  return { ...body, blocks: next };
}

/** Concatenates two adjacent text blocks into a single paragraph. */
export function mergeAdjacentParagraphs(
  body: WordBody,
  firstIndex: number
): WordBody {
  const first = body.blocks[firstIndex];
  const second = body.blocks[firstIndex + 1];
  if (!first || !second) return body;
  if (first.type !== "paragraph" || second.type !== "paragraph") return body;
  const merged: WordBlock = {
    ...first,
    runs: [...first.runs, ...second.runs],
  };
  const next = body.blocks.slice();
  next.splice(firstIndex, 2, merged);
  return { ...body, blocks: next };
}

/** Splits a paragraph at a run offset. */
export function splitParagraph(
  body: WordBody,
  blockIndex: number,
  runIndex: number,
  textOffset: number
): { body: WordBody; newIndex: number } {
  const block = body.blocks[blockIndex];
  if (!block || (block.type !== "paragraph" && block.type !== "heading")) {
    return { body, newIndex: blockIndex };
  }
  const runs = block.runs.slice();
  const target = runs[runIndex];
  if (!target) return { body, newIndex: blockIndex };
  const before: WordRun = { text: target.text.slice(0, textOffset), marks: target.marks, href: target.href };
  const after: WordRun = { text: target.text.slice(textOffset), marks: target.marks, href: target.href };
  const beforeRuns = [...runs.slice(0, runIndex), before].filter((run) => run.text.length > 0 || run.href);
  const afterRuns = [after, ...runs.slice(runIndex + 1)].filter((run) => run.text.length > 0 || run.href);

  const next = body.blocks.slice();
  const updated: WordBlock = { ...block, runs: beforeRuns };
  const created: WordBlock = {
    id: makeBlockId(block.type),
    type: "paragraph",
    runs: afterRuns,
    alignment: block.alignment,
    indent: block.type === "paragraph" ? block.indent : 0,
  };
  next.splice(blockIndex, 1, updated, created);
  return { body: { ...body, blocks: next }, newIndex: blockIndex + 1 };
}

/** Returns the alignment for a block, falling back to "left". */
export function getAlignment(block: WordBlock): WordAlignment {
  if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
    return block.alignment;
  }
  return "left";
}

/** Returns a new body with a block's alignment changed. */
export function setAlignment(body: WordBody, index: number, alignment: WordAlignment): WordBody {
  const block = body.blocks[index];
  if (!block) return body;
  if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
    return replaceBlock(body, index, { ...block, alignment });
  }
  return body;
}

/** Returns a new body with one or more marks toggled on a run. */
export function toggleMark(body: WordBody, index: number, mark: WordMark, value?: boolean): WordBody {
  const block = body.blocks[index];
  if (!block) return body;
  const toggleRun = (run: WordRun): WordRun => {
    const has = run.marks.includes(mark);
    const should = value ?? !has;
    if (should && !has) return { ...run, marks: [...run.marks, mark] };
    if (!should && has) return { ...run, marks: run.marks.filter((m) => m !== mark) };
    return run;
  };
  if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
    return replaceBlock(body, index, { ...block, runs: block.runs.map(toggleRun) });
  }
  if (block.type === "list") {
    return replaceBlock(body, index, {
      ...block,
      items: block.items.map((item) => ({ ...item, runs: item.runs.map(toggleRun) })),
    });
  }
  return body;
}

/** Sets or clears the inline font colour for the active block. */
export function setRunColor(
  body: WordBody,
  index: number,
  field: "color" | "highlight",
  value: string | null
): WordBody {
  const block = body.blocks[index];
  if (!block) return body;
  const update = (run: WordRun): WordRun => {
    if (value === null) {
      if (run[field] === undefined) return run;
      const next: WordRun = { ...run };
      delete next[field];
      return next;
    }
    return { ...run, [field]: value };
  };
  if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
    return replaceBlock(body, index, {
      ...block,
      runs:
        block.runs.length > 0
          ? block.runs.map(update)
          : [{ text: "", marks: [], [field]: value ?? undefined } as WordRun],
    });
  }
  if (block.type === "list") {
    return replaceBlock(body, index, {
      ...block,
      items: block.items.map((item) => ({
        ...item,
        runs:
          item.runs.length > 0
            ? item.runs.map(update)
            : [{ text: "", marks: [], [field]: value ?? undefined } as WordRun],
      })),
    });
  }
  return body;
}

/** Returns a new body with the paragraph at `index` set to the given heading level. */
export function setHeadingLevel(
  body: WordBody,
  index: number,
  level: 1 | 2 | 3 | 4 | 5 | 6 | null
): WordBody {
  const block = body.blocks[index];
  if (!block) return body;
  if (level === null) {
    // Demote to a paragraph.
    if (block.type === "heading") {
      return replaceBlock(body, index, {
        id: block.id,
        type: "paragraph",
        runs: block.runs,
        alignment: block.alignment,
        indent: 0,
      });
    }
    return body;
  }
  if (block.type === "paragraph" || block.type === "heading") {
    return replaceBlock(body, index, {
      id: block.id,
      type: "heading",
      level,
      runs: block.runs,
      alignment: block.alignment,
    });
  }
  return body;
}

/** Returns a new body with a block converted to a list. */
export function convertToList(body: WordBody, index: number, kind: WordListKind): WordBody {
  const block = body.blocks[index];
  if (!block) return body;
  if (block.type === "list") {
    return replaceBlock(body, index, { ...block, kind });
  }
  const runs =
    block.type === "paragraph" || block.type === "heading" || block.type === "quote"
      ? block.runs
      : block.type === "code"
        ? [{ text: block.text, marks: [] }]
        : [];
  return replaceBlock(body, index, {
    id: makeBlockId("list"),
    type: "list",
    kind,
    items: [{ id: makeBlockId("item"), runs }],
  });
}

/** Returns a new body with a block converted to a quote. */
export function convertToQuote(body: WordBody, index: number): WordBody {
  const block = body.blocks[index];
  if (!block) return body;
  if (block.type === "paragraph" || block.type === "heading") {
    return replaceBlock(body, index, {
      id: makeBlockId("quote"),
      type: "quote",
      runs: block.runs,
      alignment: block.alignment,
    });
  }
  return body;
}

/** Returns a new body with a block converted to a code block. */
export function convertToCode(body: WordBody, index: number): WordBody {
  const block = body.blocks[index];
  if (!block) return body;
  const text =
    block.type === "paragraph" || block.type === "heading" || block.type === "quote"
      ? block.runs.map((run) => run.text).join("")
      : block.type === "code"
        ? block.text
        : "";
  return replaceBlock(body, index, { id: makeBlockId("code"), type: "code", text });
}

/** Returns a new body with a block's indent changed. */
export function setIndent(body: WordBody, index: number, indent: number): WordBody {
  const block = body.blocks[index];
  if (!block || block.type !== "paragraph") return body;
  const clamped = Math.max(0, Math.min(8, indent));
  return replaceBlock(body, index, { ...block, indent: clamped });
}

/** Returns a new body with the document-wide line spacing set. */
export function setLineSpacing(body: WordBody, spacing: 1 | 1.15 | 1.5 | 2): WordBody {
  return { ...body, settings: { ...body.settings, lineSpacing: spacing } };
}

/** Returns a new body with the document-wide font family set. */
export function setFontFamily(body: WordBody, family: string): WordBody {
  return { ...body, settings: { ...body.settings, fontFamily: family } };
}

/** Returns a new body with the document-wide font size set. */
export function setFontSize(body: WordBody, size: number): WordBody {
  const clamped = Math.max(6, Math.min(96, Math.round(size)));
  return { ...body, settings: { ...body.settings, fontSize: clamped } };
}

/** Returns a new body with the document language set. */
export function setLanguage(body: WordBody, language: string): WordBody {
  return { ...body, settings: { ...body.settings, language } };
}

/** Returns a new body with the page size set. */
export function setPageSize(
  body: WordBody,
  size: { widthMm: number; heightMm: number }
): WordBody {
  return {
    ...body,
    settings: {
      ...body.settings,
      page: { ...body.settings.page, widthMm: size.widthMm, heightMm: size.heightMm },
    },
  };
}

/** Returns a new body with the page margins set. */
export function setPageMargins(body: WordBody, margins: {
  marginTopMm?: number;
  marginRightMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
}): WordBody {
  return {
    ...body,
    settings: {
      ...body.settings,
      page: {
        ...body.settings.page,
        marginTopMm: margins.marginTopMm ?? body.settings.page.marginTopMm,
        marginRightMm: margins.marginRightMm ?? body.settings.page.marginRightMm,
        marginBottomMm: margins.marginBottomMm ?? body.settings.page.marginBottomMm,
        marginLeftMm: margins.marginLeftMm ?? body.settings.page.marginLeftMm,
      },
    },
  };
}

/** Toggles the page-number placeholder in the footer. */
export function setPageNumber(body: WordBody, enabled: boolean): WordBody {
  return { ...body, settings: { ...body.settings, pageNumber: enabled } };
}

/** Returns a new body with a single run of text replaced across the document. */
export function replaceInBody(
  body: WordBody,
  search: string,
  replacement: string,
  caseSensitive: boolean
): { body: WordBody; count: number } {
  if (!search) return { body, count: 0 };
  let count = 0;
  const compare = (a: string, b: string) =>
    caseSensitive ? a.includes(b) : a.toLowerCase().includes(b.toLowerCase());
  const replaceInRuns = (runs: WordRun[]): WordRun[] => {
    const next: WordRun[] = [];
    for (const run of runs) {
      if (!compare(run.text, search)) {
        next.push(run);
        continue;
      }
      const parts: WordRun[] = [];
      let remaining = run.text;
      const re = new RegExp(escapeRegExp(search), caseSensitive ? "g" : "gi");
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(run.text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            text: run.text.slice(lastIndex, match.index),
            marks: run.marks,
            href: run.href,
          });
        }
        parts.push({
          text: replacement,
          marks: run.marks,
          href: run.href,
        });
        count += 1;
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < run.text.length) {
        parts.push({
          text: run.text.slice(lastIndex),
          marks: run.marks,
          href: run.href,
        });
      }
      next.push(...parts);
    }
    return next;
  };
  const blocks = body.blocks.map((block): WordBlock => {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
      return { ...block, runs: replaceInRuns(block.runs) };
    }
    if (block.type === "list") {
      return {
        ...block,
        items: block.items.map((item) => ({ ...item, runs: replaceInRuns(item.runs) })),
      };
    }
    if (block.type === "table") {
      return {
        ...block,
        rows: block.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => ({ ...cell, runs: replaceInRuns(cell.runs) })),
        })),
      };
    }
    if (block.type === "code" && compare(block.text, search)) {
      const re = new RegExp(escapeRegExp(search), caseSensitive ? "g" : "gi");
      count += (block.text.match(re) ?? []).length;
      return { ...block, text: block.text.replace(re, replacement) };
    }
    return block;
  });
  return { body: { ...body, blocks }, count };
}

/** Escapes a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Returns the text of a block as plain string. */
export function blockPlainText(block: WordBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
      return block.runs.map((run) => run.text).join("");
    case "list":
      return block.items.map((item) => item.runs.map((run) => run.text).join("")).join("\n");
    case "code":
      return block.text;
    case "table":
      return block.rows.map((row) => row.cells.map((cell) => cell.runs.map((run) => run.text).join("")).join("\t")).join("\n");
    case "image":
      return block.alt;
    case "page-break":
      return "";
    default:
      return "";
  }
}
