"use client";

/**
 * OfficePilot Presentation document model hook.
 *
 * Bridges the document body in IndexedDB with the React editor. Owns the
 * undo/redo history, the autosave hook and the body-level commands the
 * toolbar wires into.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfficeDocument } from "@/lib/officepilot";
import {
  asPresentationBody,
  type PresentationBackground,
  type PresentationBlock,
  type PresentationBody,
  type PresentationSlide,
  type PresentationTheme,
  type PresentationTransition,
} from "@/lib/officepilot/presentation/schema";
import {
  addBlock,
  addSlide,
  duplicateSlide,
  makeBlockId,
  makeSlideId,
  removeBlock,
  removeSlide,
  reorderSlide,
  replaceBlock,
  setDeckAspect,
  setDeckBackground,
  setDeckFontFamily,
  setDeckSettings,
  setSlideBackground,
  setSlideNotes,
  setSlideTitle,
  setSlideTransition,
  setTheme,
  updateSlide,
} from "@/lib/officepilot/presentation/blocks";
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "@/lib/officepilot/presentation/history";

export interface PresentationEditorCommands {
  getBody: () => PresentationBody;
  setBody: (next: PresentationBody, label: string) => void;
  getActiveSlide: () => PresentationSlide | null;
  getActiveIndex: () => number;
  setActiveIndex: (index: number) => void;
  addSlide: (at?: number) => void;
  removeSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  reorderSlide: (from: number, to: number) => void;
  setTitle: (index: number, title: string) => void;
  setSubtitle: (index: number, subtitle: string) => void;
  setNotes: (index: number, notes: string) => void;
  setTransition: (index: number, transition: PresentationTransition) => void;
  setBackground: (index: number, background: PresentationBackground | undefined) => void;
  setTheme: (theme: PresentationTheme) => void;
  setDeckBackground: (background: PresentationBackground) => void;
  setDeckFontFamily: (family: string) => void;
  setDeckAspect: (aspect: "16:9" | "4:3") => void;
  addBlock: (slideIndex: number, block: PresentationBlock, at?: number) => void;
  removeBlock: (slideIndex: number, blockId: string) => void;
  replaceBlock: (slideIndex: number, blockId: string, replacement: PresentationBlock) => void;
  /** Inserts a text block with a single run. */
  addText: (slideIndex: number, text: string) => void;
  /** Inserts a bullet list block. */
  addBullets: (slideIndex: number, items: string[][]) => void;
  /** Inserts a shape. */
  addShape: (slideIndex: number, kind: "rectangle" | "rounded-rectangle" | "ellipse" | "line" | "arrow" | "triangle", fill?: string) => void;
  /** Inserts an image. */
  addImage: (slideIndex: number, src: string, alt: string) => void;
  /** Inserts a table. */
  addTable: (slideIndex: number, rows: string[][]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

interface UsePresentationEditorModelOptions {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

export function usePresentationEditorModel({ document, onChange }: UsePresentationEditorModelOptions) {
  const [body, setBodyState] = useState<PresentationBody>(() => asPresentationBody(document.body));
  const [history, setHistory] = useState<HistoryState>(() => createHistory());
  const [activeIndex, setActiveIndex] = useState(0);

  // Resync when the shell hands us a new document.
  const lastSeenId = useRef<string | null>(null);
  const lastWrittenId = useRef<string | null>(null);
  useEffect(() => {
    if (lastWrittenId.current === document.meta.id) {
      lastWrittenId.current = null;
      return;
    }
    if (lastSeenId.current === document.meta.id) return;
    lastSeenId.current = document.meta.id;
    setBodyState(asPresentationBody(document.body));
    setHistory(createHistory());
    setActiveIndex(0);
  }, [document.meta.id, document.body]);

  const writeBody = useCallback(
    (next: PresentationBody) => {
      lastWrittenId.current = document.meta.id;
      setBodyState(next);
      onChange({ ...document, body: next });
    },
    [document, onChange]
  );

  const commitBody = useCallback(
    (next: PresentationBody, label: string) => {
      setHistory((current) => pushHistory(current, next, { label }));
      writeBody(next);
    },
    [writeBody]
  );

  const setBody = useCallback(
    (next: PresentationBody, label: string) => {
      commitBody(next, label);
    },
    [commitBody]
  );

  const commands = useMemo<PresentationEditorCommands>(() => {
    const getActiveIndex = () => {
      if (activeIndex < 0) return 0;
      if (activeIndex >= body.slides.length) return Math.max(0, body.slides.length - 1);
      return activeIndex;
    };
    return {
      getBody: () => body,
      setBody,
      getActiveSlide: () => body.slides[getActiveIndex()] ?? null,
      getActiveIndex,
      setActiveIndex,
      addSlide: (at) => {
        const index = at ?? body.slides.length;
        const next = addSlide(body, index);
        commitBody(next, "Add slide");
        setActiveIndex(index);
      },
      removeSlide: (index) => {
        const next = removeSlide(body, index);
        if (next === body) return;
        commitBody(next, "Remove slide");
        setActiveIndex(Math.min(activeIndex, next.slides.length - 1));
      },
      duplicateSlide: (index) => {
        const next = duplicateSlide(body, index);
        if (next === body) return;
        commitBody(next, "Duplicate slide");
        setActiveIndex(index + 1);
      },
      reorderSlide: (from, to) => {
        const next = reorderSlide(body, from, to);
        if (next === body) return;
        commitBody(next, "Reorder");
        setActiveIndex(to);
      },
      setTitle: (index, title) => {
        const next = setSlideTitle(body, index, title);
        if (next !== body) commitBody(next, "Title");
      },
      setSubtitle: (index, subtitle) => {
        const next = updateSlide(body, index, { subtitle });
        if (next !== body) commitBody(next, "Subtitle");
      },
      setNotes: (index, notes) => {
        const next = setSlideNotes(body, index, notes);
        if (next !== body) commitBody(next, "Notes");
      },
      setTransition: (index, transition) => {
        const next = setSlideTransition(body, index, transition);
        if (next !== body) commitBody(next, "Transition");
      },
      setBackground: (index, background) => {
        const next = setSlideBackground(body, index, background);
        if (next !== body) commitBody(next, "Background");
      },
      setTheme: (theme) => {
        const next = setTheme(body, theme);
        if (next !== body) commitBody(next, "Theme");
      },
      setDeckBackground: (background) => {
        const next = setDeckBackground(body, background);
        if (next !== body) commitBody(next, "Background");
      },
      setDeckFontFamily: (family) => {
        const next = setDeckFontFamily(body, family);
        if (next !== body) commitBody(next, "Font");
      },
      setDeckAspect: (aspect) => {
        const next = setDeckAspect(body, aspect);
        if (next !== body) commitBody(next, "Aspect");
      },
      addBlock: (slideIndex, block, at) => {
        const next = addBlock(body, slideIndex, block, at);
        if (next !== body) commitBody(next, "Add block");
      },
      removeBlock: (slideIndex, blockId) => {
        const next = removeBlock(body, slideIndex, blockId);
        if (next !== body) commitBody(next, "Remove block");
      },
      replaceBlock: (slideIndex, blockId, replacement) => {
        const next = replaceBlock(body, slideIndex, blockId, replacement);
        if (next !== body) commitBody(next, "Edit block");
      },
      addText: (slideIndex, text) => {
        const block: PresentationBlock = {
          id: makeBlockId(),
          type: "text",
          runs: [{ text }],
        };
        const next = addBlock(body, slideIndex, block);
        if (next !== body) commitBody(next, "Add text");
      },
      addBullets: (slideIndex, items) => {
        const block: PresentationBlock = {
          id: makeBlockId(),
          type: "bullets",
          items: items.map((item) => item.map((text) => ({ text }))),
        };
        const next = addBlock(body, slideIndex, block);
        if (next !== body) commitBody(next, "Add bullets");
      },
      addShape: (slideIndex, kind, fill) => {
        const block: PresentationBlock = {
          id: makeBlockId(),
          type: "shape",
          kind,
          x: 30,
          y: 35,
          width: 40,
          height: 18,
          fill: fill ?? "#0a0a0a",
          text: [],
        };
        const next = addBlock(body, slideIndex, block);
        if (next !== body) commitBody(next, "Add shape");
      },
      addImage: (slideIndex, src, alt) => {
        const block: PresentationBlock = {
          id: makeBlockId(),
          type: "image",
          src,
          alt,
          x: 20,
          y: 20,
          width: 60,
          height: 40,
        };
        const next = addBlock(body, slideIndex, block);
        if (next !== body) commitBody(next, "Add image");
      },
      addTable: (slideIndex, rows) => {
        const block: PresentationBlock = {
          id: makeBlockId(),
          type: "table",
          x: 5,
          y: 25,
          width: 90,
          rows,
          header: rows.length > 1,
          headerFill: "#0a0a0a",
        };
        const next = addBlock(body, slideIndex, block);
        if (next !== body) commitBody(next, "Add table");
      },
      undo: () => {
        const result = undoHistory(history, body);
        if (!result) return;
        setHistory(result.history);
        writeBody(result.body);
      },
      redo: () => {
        const result = redoHistory(history, body);
        if (!result) return;
        setHistory(result.history);
        writeBody(result.body);
      },
      canUndo: () => canUndo(history),
      canRedo: () => canRedo(history),
    };
  }, [activeIndex, body, commitBody, history, setBody, writeBody]);

  return { body, setBody, activeIndex, setActiveIndex, commands };
}

export { makeSlideId, setDeckSettings, makeBlockId };
