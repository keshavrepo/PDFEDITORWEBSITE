/**
 * OfficePilot Presentation statistics.
 */

import { countWords } from "./blocks";
import type { PresentationBody, PresentationStats } from "./schema";

export function computePresentationStats(body: PresentationBody): PresentationStats {
  let totalBlocks = 0;
  let totalCharacters = 0;
  let imageCount = 0;
  let shapeCount = 0;
  let tableCount = 0;
  for (const slide of body.slides) {
    totalBlocks += slide.blocks.length;
    totalCharacters += slide.title.length;
    if (slide.subtitle) totalCharacters += slide.subtitle.length;
    if (slide.notes) totalCharacters += slide.notes.length;
    for (const block of slide.blocks) {
      if (block.type === "image") imageCount += 1;
      if (block.type === "shape") shapeCount += 1;
      if (block.type === "table") tableCount += 1;
      if (block.type === "text") {
        for (const run of block.runs) totalCharacters += run.text.length;
      }
      if (block.type === "bullets") {
        for (const item of block.items) {
          for (const run of item) totalCharacters += run.text.length;
        }
      }
    }
  }
  return {
    slideCount: body.slides.length,
    totalBlocks,
    totalWords: countWords(body),
    totalCharacters,
    imageCount,
    shapeCount,
    tableCount,
  };
}
