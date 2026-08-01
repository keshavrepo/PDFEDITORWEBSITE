"use client";

/**
 * OfficePilot Word document model hook.
 *
 * Bridges the document body in IndexedDB with the React editor. Owns the
 * undo/redo history, the autosave hook and the body-level commands the
 * toolbar wires into. The actual rendering and selection live in
 * `WordEditor.tsx`; this module is the small, pure-data layer that the
 * editor and the toolbar both import.
 *
 * The surface itself receives the body through the workspace shell's
 * `document` prop. This hook reads and writes that body through
 * `onChange`, so the shell's autosave, save, rename, duplicate, delete,
 * tab management and the file manager all keep working without any
 * change.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfficeDocument } from "@/lib/officepilot";
import {
  asWordBody,
  DEFAULT_WORD_BODY,
  type WordBlock,
  type WordBody,
} from "@/lib/officepilot/word/schema";
import {
  insertBlock,
  removeBlock,
  replaceBlock,
  splitParagraph,
  toggleMark,
  setAlignment,
  setHeadingLevel,
  setRunColor,
  setIndent,
  setLineSpacing,
  setFontFamily,
  setFontSize,
  setLanguage,
  setPageMargins,
  setPageNumber,
  setPageSize,
  convertToCode,
  convertToList,
  convertToQuote,
  replaceInBody,
  makeBlockId,
} from "@/lib/officepilot/word/blocks";
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "@/lib/officepilot/word/history";
import { exportWordToText } from "@/lib/officepilot/word/text-exporters";

/** A coarse pointer to a place inside the document. */
export interface DocumentSelection {
  /** Index of the block in the body. */
  blockIndex: number;
  /** Index of the run inside the block (where applicable). */
  runIndex: number;
  /** Character offset inside the run. */
  offset: number;
}

/** Editor commands the toolbar (and keyboard shortcuts) fire at the model. */
export interface WordEditorCommands {
  /** Returns the current body. */
  getBody: () => WordBody;
  /** Returns the current selection. */
  getSelection: () => DocumentSelection | null;
  /** Sets the selection. */
  setSelection: (next: DocumentSelection | null) => void;
  /** Returns the active block. */
  getActiveBlock: () => WordBlock | null;
  /** Pushes a new body. */
  setBody: (next: WordBody, label: string) => void;
  /** Toggles an inline mark on the active block. */
  toggleMark: (mark: "bold" | "italic" | "underline" | "strikethrough" | "superscript" | "subscript" | "code") => void;
  /** Sets the inline font colour on the active block (pass null to clear). */
  setColor: (color: string | null) => void;
  /** Sets the inline highlight colour on the active block (pass null to clear). */
  setHighlight: (color: string | null) => void;
  /** Sets the alignment of the active block. */
  setAlignment: (alignment: "left" | "center" | "right" | "justify") => void;
  /** Sets the heading level of the active block. */
  setHeadingLevel: (level: 1 | 2 | 3 | 4 | 5 | 6 | null) => void;
  /** Sets the indent of the active paragraph. */
  setIndent: (delta: number) => void;
  /** Converts the active block to a list. */
  convertToList: (kind: "ordered" | "unordered" | "checklist") => void;
  /** Converts the active block to a quote. */
  convertToQuote: () => void;
  /** Converts the active block to a code block. */
  convertToCode: () => void;
  /** Inserts a page break at the cursor. */
  insertPageBreak: () => void;
  /** Inserts a table at the cursor. */
  insertTable: (rows: number, columns: number) => void;
  /** Inserts an image at the cursor. */
  insertImage: (src: string, alt: string, width: number) => void;
  /** Toggles a hyperlink on the active selection. */
  setHyperlink: (href: string | null) => void;
  /** Sets the document-wide font family. */
  setFontFamily: (family: string) => void;
  /** Sets the document-wide font size. */
  setFontSize: (size: number) => void;
  /** Sets the document-wide line spacing. */
  setLineSpacing: (spacing: 1 | 1.15 | 1.5 | 2) => void;
  /** Sets the document language. */
  setLanguage: (language: string) => void;
  /** Sets the page size. */
  setPageSize: (size: { widthMm: number; heightMm: number }) => void;
  /** Sets the page margins. */
  setPageMargins: (margins: {
    marginTopMm?: number;
    marginRightMm?: number;
    marginBottomMm?: number;
    marginLeftMm?: number;
  }) => void;
  /** Toggles the page number in the footer. */
  setPageNumber: (enabled: boolean) => void;
  /** Splits the current paragraph at the caret. */
  split: () => void;
  /** Inserts a new paragraph below the current one. */
  insertParagraphBelow: () => void;
  /** Deletes the active block. */
  deleteActive: () => void;
  /** Undo. */
  undo: () => void;
  /** Redo. */
  redo: () => void;
  /** Returns true if there is something to undo. */
  canUndo: () => boolean;
  /** Returns true if there is something to redo. */
  canRedo: () => boolean;
  /** Replaces text across the document. Returns the number of replacements. */
  replaceAll: (search: string, replacement: string, caseSensitive: boolean) => number;
  /** Returns the plain-text version of the document. */
  exportText: () => string;
}

interface UseWordEditorModelOptions {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

interface UseWordEditorModelResult {
  body: WordBody;
  setBody: (next: WordBody, label?: string) => void;
  selection: DocumentSelection | null;
  setSelection: (next: DocumentSelection | null) => void;
  commands: WordEditorCommands;
  /** Pushes a new history entry without changing the body. */
  recordHistory: (label: string) => void;
  /** True if the body has pending changes since the last history snapshot. */
  isDirty: boolean;
  /** True if the next call to `setBody` should be coalesced with the previous one. */
  coalesceNext: boolean;
}

export function useWordEditorModel({
  document,
  onChange,
}: UseWordEditorModelOptions): UseWordEditorModelResult {
  // The body the model is currently editing. Kept in state so the editor
  // re-renders on every change, but the source of truth is the body the
  // workspace shell hands us through `document`.
  const [body, setBodyState] = useState<WordBody>(() => asWordBody(document.body));
  const [history, setHistory] = useState<HistoryState>(() => createHistory());
  const [selection, setSelection] = useState<DocumentSelection | null>(null);

  // Resync the local body when the workspace shell hands us a new document
  // (e.g. a tab switch or a duplicate). Skip the resync when the shell is
  // mirroring back a body we just wrote; a deep compare is too expensive
  // for large documents, so we compare a stable id-derived fingerprint.
  const lastSeenId = useRef<string | null>(null);
  const lastWrittenId = useRef<string | null>(null);
  useEffect(() => {
    if (lastWrittenId.current === document.meta.id) {
      lastWrittenId.current = null;
      return;
    }
    if (lastSeenId.current === document.meta.id) return;
    lastSeenId.current = document.meta.id;
    setBodyState(asWordBody(document.body));
    setHistory(createHistory());
  }, [document.meta.id, document.body]);

  /** Writes a new body and reports the change to the workspace shell. */
  const writeBody = useCallback(
    (next: WordBody) => {
      lastWrittenId.current = document.meta.id;
      setBodyState(next);
      onChange({ ...document, body: next });
    },
    [document, onChange]
  );

  /** Pushes a new body and records it in the history. */
  const commitBody = useCallback(
    (next: WordBody, label: string, coalesce: boolean) => {
      setHistory((current) => pushHistory(current, next, { label, coalesce }));
      writeBody(next);
    },
    [writeBody]
  );

  const setBody = useCallback(
    (next: WordBody, label = "Edit") => {
      commitBody(next, label, false);
    },
    [commitBody]
  );

  const recordHistory = useCallback(
    (label: string) => {
      setHistory((current) => pushHistory(current, body, { label, coalesce: false }));
    },
    [body]
  );

  /** Returns the block at the current selection (or the first block). */
  const getActiveBlock = useCallback((): WordBlock | null => {
    if (selection) return body.blocks[selection.blockIndex] ?? null;
    return body.blocks[0] ?? null;
  }, [body.blocks, selection]);

  // Command factory: builds a small object of imperative methods that the
  // toolbar and the keyboard handler call. Each command is a thin wrapper
  // around the pure functions in `blocks.ts`.
  const commands = useMemo<WordEditorCommands>(() => {
    const selectionFor = (): DocumentSelection | null => selection;
    const activeBlockIndex = (): number => {
      if (selection) return selection.blockIndex;
      return Math.max(0, Math.min(body.blocks.length - 1, 0));
    };
    return {
      getBody: () => body,
      getSelection: () => selectionFor(),
      setSelection: (next) => setSelection(next),
      getActiveBlock: () => getActiveBlock(),
      setBody: (next, label) => setBody(next, label),
      toggleMark: (mark) => {
        const index = activeBlockIndex();
        const next = toggleMark(body, index, mark);
        if (next !== body) commitBody(next, "Mark", true);
      },
      setAlignment: (alignment) => {
        const index = activeBlockIndex();
        const next = setAlignment(body, index, alignment);
        if (next !== body) commitBody(next, "Align", false);
      },
      setHeadingLevel: (level) => {
        const index = activeBlockIndex();
        const next = setHeadingLevel(body, index, level);
        if (next !== body) commitBody(next, "Style", false);
      },
      setColor: (color) => {
        const index = activeBlockIndex();
        const next = setRunColor(body, index, "color", color);
        if (next !== body) commitBody(next, "Colour", false);
      },
      setHighlight: (color) => {
        const index = activeBlockIndex();
        const next = setRunColor(body, index, "highlight", color);
        if (next !== body) commitBody(next, "Highlight", false);
      },
      setIndent: (delta) => {
        const index = activeBlockIndex();
        const block = body.blocks[index];
        if (!block || block.type !== "paragraph") return;
        const next = setIndent(body, index, block.indent + delta);
        if (next !== body) commitBody(next, "Indent", true);
      },
      convertToList: (kind) => {
        const index = activeBlockIndex();
        const next = convertToList(body, index, kind);
        if (next !== body) commitBody(next, "List", false);
      },
      convertToQuote: () => {
        const index = activeBlockIndex();
        const next = convertToQuote(body, index);
        if (next !== body) commitBody(next, "Quote", false);
      },
      convertToCode: () => {
        const index = activeBlockIndex();
        const next = convertToCode(body, index);
        if (next !== body) commitBody(next, "Code", false);
      },
      insertPageBreak: () => {
        const index = activeBlockIndex();
        const next = insertBlock(body, index + 1, {
          id: makeBlockId("page-break"),
          type: "page-break",
        });
        commitBody(next, "Page break", false);
      },
      insertTable: (rows, columns) => {
        const index = activeBlockIndex();
        const blockId = makeBlockId("table");
        const newTable: WordBlock = {
          id: blockId,
          type: "table",
          rows: Array.from({ length: rows }).map((_, rowIndex) => ({
            id: makeBlockId("row"),
            cells: Array.from({ length: columns }).map(() => ({
              id: makeBlockId("cell"),
              runs: rowIndex === 0 ? [{ text: "Header", marks: [] }] : [{ text: "", marks: [] }],
            })),
          })),
        };
        const next = insertBlock(body, index + 1, newTable);
        commitBody(next, "Table", false);
      },
      insertImage: (src, alt, width) => {
        const index = activeBlockIndex();
        const newImage: WordBlock = {
          id: makeBlockId("image"),
          type: "image",
          src,
          alt,
          width,
        };
        const next = insertBlock(body, index + 1, newImage);
        commitBody(next, "Image", false);
      },
      setHyperlink: (href) => {
        const index = activeBlockIndex();
        const block = body.blocks[index];
        if (!block) return;
        if (block.type !== "paragraph" && block.type !== "heading" && block.type !== "quote") {
          return;
        }
        const runs = block.runs.map((run) => ({ ...run, href: href ?? undefined }));
        const next = replaceBlock(body, index, { ...block, runs });
        if (next !== body) commitBody(next, "Link", true);
      },
      setFontFamily: (family) => {
        const next = setFontFamily(body, family);
        if (next !== body) commitBody(next, "Font", false);
      },
      setFontSize: (size) => {
        const next = setFontSize(body, size);
        if (next !== body) commitBody(next, "Size", false);
      },
      setLineSpacing: (spacing) => {
        const next = setLineSpacing(body, spacing);
        if (next !== body) commitBody(next, "Spacing", false);
      },
      setLanguage: (language) => {
        const next = setLanguage(body, language);
        if (next !== body) commitBody(next, "Language", false);
      },
      setPageSize: (size) => {
        const next = setPageSize(body, size);
        if (next !== body) commitBody(next, "Page size", false);
      },
      setPageMargins: (margins) => {
        const next = setPageMargins(body, margins);
        if (next !== body) commitBody(next, "Margins", false);
      },
      setPageNumber: (enabled) => {
        const next = setPageNumber(body, enabled);
        if (next !== body) commitBody(next, "Page number", false);
      },
      split: () => {
        const index = activeBlockIndex();
        if (!selection) {
          // No selection; insert a fresh paragraph below the active block.
          const next = insertBlock(body, index + 1, {
            id: makeBlockId("paragraph"),
            type: "paragraph",
            runs: [{ text: "", marks: [] }],
            alignment: "left",
            indent: 0,
          });
          commitBody(next, "Enter", false);
          setSelection({ blockIndex: index + 1, runIndex: 0, offset: 0 });
          return;
        }
        const block = body.blocks[index];
        if (!block || (block.type !== "paragraph" && block.type !== "heading")) {
          return;
        }
        const { body: next, newIndex } = splitParagraph(
          body,
          index,
          selection.runIndex,
          selection.offset
        );
        if (next !== body) commitBody(next, "Enter", false);
        setSelection({ blockIndex: newIndex, runIndex: 0, offset: 0 });
      },
      insertParagraphBelow: () => {
        const index = activeBlockIndex();
        const next = insertBlock(body, index + 1, {
          id: makeBlockId("paragraph"),
          type: "paragraph",
          runs: [{ text: "", marks: [] }],
          alignment: "left",
          indent: 0,
        });
        commitBody(next, "Enter", false);
        setSelection({ blockIndex: index + 1, runIndex: 0, offset: 0 });
      },
      deleteActive: () => {
        const index = activeBlockIndex();
        if (body.blocks.length <= 1) return;
        // If the block is empty, just remove it; otherwise clear it and
        // move the cursor to the previous block.
        const block = body.blocks[index];
        if (!block) return;
        if (
          block.type === "paragraph" &&
          block.runs.length === 1 &&
          block.runs[0]?.text === ""
        ) {
          const next = removeBlock(body, index);
          commitBody(next, "Delete", false);
          setSelection({
            blockIndex: Math.max(0, index - 1),
            runIndex: 0,
            offset: 0,
          });
        } else if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
          const cleared: WordBlock = { ...block, runs: [{ text: "", marks: [] }] };
          const next = replaceBlock(body, index, cleared);
          commitBody(next, "Clear", false);
        } else {
          const next = removeBlock(body, index);
          commitBody(next, "Delete", false);
        }
      },
      undo: () => {
        const result = undoHistory(history, body);
        if (!result) return;
        setHistory(result.history);
        writeBody(result.body);
        setSelection(null);
      },
      redo: () => {
        const result = redoHistory(history, body);
        if (!result) return;
        setHistory(result.history);
        writeBody(result.body);
        setSelection(null);
      },
      canUndo: () => canUndo(history),
      canRedo: () => canRedo(history),
      replaceAll: (search, replacement, caseSensitive) => {
        const result = replaceInBody(body, search, replacement, caseSensitive);
        if (result.count > 0) commitBody(result.body, "Replace", false);
        return result.count;
      },
      exportText: () => exportWordToText(body),
    };
    // `setBody` is `commitBody`; the linter cannot follow the indirection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, commitBody, getActiveBlock, history, selection, writeBody]);

  const isDirty = history.past.length > 0;
  const coalesceNext = isDirty;

  // Return only what callers need; commands is the API surface used by the
  // toolbar. The history and selection are exposed so the surface can wire
  // its own UI elements (e.g. a history menu) without re-implementing the
  // command set.
  return {
    body,
    setBody,
    selection,
    setSelection,
    commands,
    recordHistory,
    isDirty,
    coalesceNext,
  };
}

/** Re-exports so the editor module can wire a single import. */
export { DEFAULT_WORD_BODY };
export type { WordBlock, WordBody, WordRun, WordMark, WordAlignment, WordListKind, WordLineSpacing } from "@/lib/officepilot/word/schema";
