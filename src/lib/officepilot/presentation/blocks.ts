/**
 * OfficePilot Presentation slide operations.
 *
 * Pure functions over the PresentationBody model: add, remove, duplicate,
 * reorder, set fields, add/remove content blocks (text, bullets, images,
 * shapes, tables), set backgrounds, themes, transitions, and notes.
 *
 * Every function returns a new body. The original is never mutated so the
 * editor's undo/redo history can store a clean reference.
 */

import {
  createDefaultSlide,
  PRESENTATION_THEMES,
  type PresentationBackground,
  type PresentationBlock,
  type PresentationBody,
  type PresentationDeckSettings,
  type PresentationSlide,
  type PresentationTheme,
  type PresentationTransition,
} from "./schema";

/** Generates a fresh slide id. */
export function makeSlideId(): string {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generates a fresh block id. */
export function makeBlockId(): string {
  return `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns a new body with one slide added at the given index. */
export function addSlide(body: PresentationBody, at?: number): PresentationBody {
  const slide = createDefaultSlide();
  const index = at === undefined ? body.slides.length : at;
  const next = body.slides.slice();
  next.splice(Math.max(0, Math.min(index, next.length)), 0, slide);
  return { ...body, slides: next };
}

/** Returns a new body with the slide at the given index removed. */
export function removeSlide(body: PresentationBody, index: number): PresentationBody {
  if (body.slides.length <= 1) return body;
  if (index < 0 || index >= body.slides.length) return body;
  const next = body.slides.slice();
  next.splice(index, 1);
  return { ...body, slides: next };
}

/** Returns a new body with the slide at the given index duplicated. */
export function duplicateSlide(body: PresentationBody, index: number): PresentationBody {
  if (index < 0 || index >= body.slides.length) return body;
  const original = body.slides[index]!;
  const copy: PresentationSlide = {
    ...original,
    id: makeSlideId(),
    title: `${original.title || "Untitled"} (copy)`,
    blocks: original.blocks.map(cloneBlock),
  };
  const next = body.slides.slice();
  next.splice(index + 1, 0, copy);
  return { ...body, slides: next };
}

/** Returns a new body with a slide moved from one index to another. */
export function reorderSlide(body: PresentationBody, from: number, to: number): PresentationBody {
  if (from === to) return body;
  if (from < 0 || from >= body.slides.length) return body;
  if (to < 0 || to >= body.slides.length) return body;
  const next = body.slides.slice();
  const [slide] = next.splice(from, 1);
  if (!slide) return body;
  next.splice(to, 0, slide);
  return { ...body, slides: next };
}

/** Returns a new body with the slide at the index updated. */
export function updateSlide(body: PresentationBody, index: number, patch: Partial<PresentationSlide>): PresentationBody {
  if (index < 0 || index >= body.slides.length) return body;
  const next = body.slides.slice();
  const slide = next[index]!;
  next[index] = { ...slide, ...patch };
  return { ...body, slides: next };
}

/** Returns a new body with the title of the slide at the index changed. */
export function setSlideTitle(body: PresentationBody, index: number, title: string): PresentationBody {
  return updateSlide(body, index, { title });
}

/** Returns a new body with the notes of the slide at the index changed. */
export function setSlideNotes(body: PresentationBody, index: number, notes: string): PresentationBody {
  return updateSlide(body, index, { notes });
}

/** Returns a new body with the transition of the slide at the index changed. */
export function setSlideTransition(body: PresentationBody, index: number, transition: PresentationTransition): PresentationBody {
  return updateSlide(body, index, { transition });
}

/** Returns a new body with the background of the slide at the index changed. */
export function setSlideBackground(body: PresentationBody, index: number, background: PresentationBackground | undefined): PresentationBody {
  return updateSlide(body, index, { background });
}

/** Adds a content block to the slide. */
export function addBlock(body: PresentationBody, slideIndex: number, block: PresentationBlock, at?: number): PresentationBody {
  if (slideIndex < 0 || slideIndex >= body.slides.length) return body;
  const slide = body.slides[slideIndex]!;
  const next = slide.blocks.slice();
  next.splice(at === undefined ? next.length : at, 0, block);
  return updateSlide(body, slideIndex, { blocks: next });
}

/** Removes a block from a slide. */
export function removeBlock(body: PresentationBody, slideIndex: number, blockId: string): PresentationBody {
  if (slideIndex < 0 || slideIndex >= body.slides.length) return body;
  const slide = body.slides[slideIndex]!;
  const next = slide.blocks.filter((block) => block.id !== blockId);
  return updateSlide(body, slideIndex, { blocks: next });
}

/** Replaces a block. */
export function replaceBlock(body: PresentationBody, slideIndex: number, blockId: string, replacement: PresentationBlock): PresentationBody {
  if (slideIndex < 0 || slideIndex >= body.slides.length) return body;
  const slide = body.slides[slideIndex]!;
  const next = slide.blocks.map((block) => (block.id === blockId ? replacement : block));
  return updateSlide(body, slideIndex, { blocks: next });
}

/** Returns a new body with the deck settings updated. */
export function setDeckSettings(body: PresentationBody, patch: Partial<PresentationDeckSettings>): PresentationBody {
  return { ...body, settings: { ...body.settings, ...patch } };
}

/** Returns a new body with the deck theme changed. */
export function setTheme(body: PresentationBody, theme: PresentationTheme): PresentationBody {
  const palette = PRESENTATION_THEMES[theme];
  return {
    ...body,
    settings: {
      ...body.settings,
      theme,
      fontColor: palette.fontColor,
      background: palette.background,
    },
  };
}

/** Returns a new body with the deck background changed. */
export function setDeckBackground(body: PresentationBody, background: PresentationBackground): PresentationBody {
  return setDeckSettings(body, { background });
}

/** Returns a new body with the deck font family changed. */
export function setDeckFontFamily(body: PresentationBody, fontFamily: string): PresentationBody {
  return setDeckSettings(body, { fontFamily });
}

/** Returns a new body with the deck aspect ratio changed. */
export function setDeckAspect(body: PresentationBody, aspect: "16:9" | "4:3"): PresentationBody {
  return setDeckSettings(body, { aspect });
}

/** Computes the total word count across all slides. */
export function countWords(body: PresentationBody): number {
  let count = 0;
  for (const slide of body.slides) {
    for (const word of slide.title.split(/\s+/u)) if (word.trim()) count += 1;
    if (slide.subtitle) {
      for (const word of slide.subtitle.split(/\s+/u)) if (word.trim()) count += 1;
    }
    for (const block of slide.blocks) {
      if (block.type === "text") {
        for (const run of block.runs) {
          for (const word of run.text.split(/\s+/u)) if (word.trim()) count += 1;
        }
      } else if (block.type === "bullets") {
        for (const item of block.items) {
          for (const run of item) {
            for (const word of run.text.split(/\s+/u)) if (word.trim()) count += 1;
          }
        }
      }
    }
  }
  return count;
}

/** Clones a content block. */
function cloneBlock(block: PresentationBlock): PresentationBlock {
  if (block.type === "text") {
    return { id: makeBlockId(), type: "text", runs: block.runs.map((run) => ({ ...run })) };
  }
  if (block.type === "bullets") {
    return { id: makeBlockId(), type: "bullets", items: block.items.map((item) => item.map((run) => ({ ...run }))) };
  }
  if (block.type === "shape") {
    return { ...block, text: block.text?.map((run) => ({ ...run })) };
  }
  if (block.type === "image") {
    return { ...block };
  }
  return { ...block, rows: block.rows.map((row) => row.slice()) };
}
