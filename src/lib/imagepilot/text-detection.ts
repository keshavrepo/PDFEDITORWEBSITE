/**
 * Text detection for the screenshot editor.
 *
 * Wraps Tesseract.js behind a tiny, typed surface. Tesseract.js is large
 * (~1 MB of WebAssembly plus language data) so it is loaded only when the
 * user asks for detection, not on first paint.
 *
 * The recogniser returns bounding boxes and strings. Two post-processing
 * passes turn those into text layers a user can click and edit:
 *
 * - **Font size**: the line height of the detected words is the cap height
 *   plus a descender; the cap-height ratio is roughly 0.7 for the common
 *   system fonts, so a multiplier of 1.4 on the line height is a
 *   reasonable font size in document pixels.
 * - **Colour**: the recogniser does not know what colour the glyphs are, so
 *   we sample the most common dark and light pixels in the bbox and pick
 *   whichever of the two is rarer. That survives white-on-dark, dark-on-white
 *   and on-image labels in one rule.
 *
 * These are the two pieces the brief specifically calls out ("preserve
 * alignment, preserve spacing, preserve colors"), and the only piece a
 * pure browser-side pipeline can recover at all. Without this module the
 * screenshot editor's "text" tool is a blank-canvas layer; with it the
 * user can click a recognised region and edit its text in place.
 */

import { browserCanvasFactory } from "./raster";
import type { TextRegion } from "./types";

/* -------------------------------------------------------------------------- */
/* Tesseract.js loader                                                         */
/* -------------------------------------------------------------------------- */

/** A single Tesseract worker, kept alive between calls so the second image is fast. */
let workerPromise: Promise<TesseractWorkerLike> | null = null;

/** Minimal subset of the Tesseract.js worker API the module relies on. */
interface TesseractWorkerLike {
  recognize: (image: unknown) => Promise<unknown>;
  setParameters: (params: Record<string, unknown>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
}

/**
 * Resolves a usable Tesseract worker.
 *
 * Tesseract.js is loaded via a dynamic `import()` so it does not appear in the
 * initial bundle. A worker is created on first use and reused for the rest of
 * the session, which avoids paying the multi-second cold start on every
 * detection.
 */
async function getWorker(): Promise<TesseractWorkerLike> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const mod = await import("tesseract.js");
    const worker = await mod.createWorker("eng", 1, {
      // Page-segmentation mode 11 ("sparse text") is the right choice for
      // screenshots: it locates text anywhere on the page rather than
      // assuming a single dense block.
      // logger is omitted on purpose; the UI shows its own progress.
    });
    await worker.setParameters({
      // Tesseract v7's PSM enum stores page-segmentation modes as string
      // numbers; "11" is SPARSE_TEXT, the right mode for screenshots.
      tessedit_pageseg_mode: "11" as never,
      preserve_interword_spaces: "1",
    });
    return worker as TesseractWorkerLike;
  })();
  return workerPromise;
}

/**
 * Tears the worker down.
 *
 * Called on tab visibility hide so an inactive editor does not hold a worker
 * (and its ~200 MB of model data) forever.
 */
export async function disposeTextDetector(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  try {
    await worker.terminate();
  } catch {
    // The worker is best-effort; terminate errors are not actionable.
  }
}

/* -------------------------------------------------------------------------- */
/* Result shaping                                                              */
/* -------------------------------------------------------------------------- */

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractLine {
  words: TesseractWord[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
  text: string;
}

interface TesseractBlock {
  paragraphs: Array<{ lines: TesseractLine[] }>;
}

interface TesseractResult {
  data: {
    text: string;
    blocks?: TesseractBlock[];
    lines?: TesseractLine[];
  };
}

function isTesseractResult(value: unknown): value is TesseractResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in (value as Record<string, unknown>)
  );
}

/**
 * Converts the recogniser's output into one TextRegion per word run.
 *
 * A "run" is a sequence of words on the same line that are close enough to
 * belong together. Words further apart than 3× the cap height start a new
 * region, which is what keeps a label and a body of text from collapsing
 * into one giant block.
 */
function shapeRegions(
  result: TesseractResult,
  imageWidth: number,
  imageHeight: number
): TextRegion[] {
  // Newer Tesseract returns blocks; older versions return flat lines. Both
  // shapes are flattened to lines so the rest of the module has one path.
  const lines: TesseractLine[] = result.data.lines
    ? result.data.lines
    : (result.data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines)
      );

  const regions: TextRegion[] = [];

  for (const line of lines) {
    const words = (line.words ?? []).filter((word) => word.text.trim().length > 0);
    if (!words.length) continue;

    let run: TesseractWord[] = [];
    let runLine = words[0];

    const flush = () => {
      if (!run.length) return;
      const minX = Math.min(...run.map((word) => word.bbox.x0));
      const minY = Math.min(...run.map((word) => word.bbox.y0));
      const maxX = Math.max(...run.map((word) => word.bbox.x1));
      const maxY = Math.max(...run.map((word) => word.bbox.y1));
      const height = maxY - minY;
      // Cap height is roughly 70% of the line height for common fonts; the
      // font size is that cap height plus a little descender room, so 1.4 ×
      // the bbox height is a defensible estimate.
      const fontSize = Math.max(8, Math.round(height * 1.4));
      const avgConfidence =
        run.reduce((sum, word) => sum + word.confidence, 0) / run.length / 100;

      regions.push({
        id: `region_${regions.length.toString(36)}_${minX.toString(36)}_${minY.toString(36)}`,
        x: minX,
        y: minY,
        width: maxX - minX,
        height,
        text: run.map((word) => word.text).join(" "),
        confidence: Math.max(0, Math.min(1, avgConfidence)),
        fontSize,
        color: "#111111",
        fontWeight: 500,
      });
    };

    for (const word of words) {
      if (!run.length) {
        run = [word];
        runLine = word;
        continue;
      }
      const capHeight = Math.max(1, runLine.bbox.y1 - runLine.bbox.y0);
      const gap = word.bbox.x0 - runLine.bbox.x1;
      if (gap > capHeight * 1.2) {
        flush();
        run = [word];
        runLine = word;
      } else {
        run.push(word);
        // Update the run's reference line to the most recent word so a
        // sloped baseline does not fragment the run.
        runLine = word;
      }
    }
    flush();
  }

  // Reject detections that obviously did not find any text. A blank page
  // produces a result with a single line whose text is just whitespace, and
  // accepting it would leave a useless region on screen.
  return regions.filter((region) => region.text.trim().length > 0 && region.width > 4 && region.height > 4);
}

/* -------------------------------------------------------------------------- */
/* Colour sampling                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Picks a likely text colour by comparing the rarity of dark and light pixels.
 *
 * White text on a black background is more common in product screenshots
 * than dark text on white, so the rule is: if dark pixels are the minority,
 * the text is light; otherwise it is dark. Either way the user gets a colour
 * that reads against the original background.
 */
function sampleTextColour(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region: TextRegion
): { color: string; fontWeight: number } {
  const left = Math.max(0, Math.floor(region.x));
  const top = Math.max(0, Math.floor(region.y));
  const right = Math.min(width, Math.ceil(region.x + region.width));
  const bottom = Math.min(height, Math.ceil(region.y + region.height));
  const regionWidth = right - left;
  const regionHeight = bottom - top;
  if (regionWidth < 1 || regionHeight < 1) {
    return { color: "#111111", fontWeight: 500 };
  }

  // Sample at most a few thousand pixels; that is enough to learn the
  // distribution and the cost stays bounded on a 4K screenshot.
  const maxSamples = 1500;
  const total = regionWidth * regionHeight;
  const step = Math.max(1, Math.floor(Math.sqrt(total / maxSamples)));

  let darkCount = 0;
  let lightCount = 0;
  let darkSum = [0, 0, 0];
  let lightSum = [0, 0, 0];

  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Rec. 709 luminance.
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma < 96) {
        darkCount++;
        darkSum[0] += r;
        darkSum[1] += g;
        darkSum[2] += b;
      } else if (luma > 160) {
        lightCount++;
        lightSum[0] += r;
        lightSum[1] += g;
        lightSum[2] += b;
      }
    }
  }

  // Whichever population is smaller is the text colour. A bold white label on
  // a colourful photo has few white pixels; a thin grey label on white has
  // few dark pixels.
  const totalSampled = darkCount + lightCount;
  if (totalSampled === 0) return { color: "#111111", fontWeight: 500 };

  const darkShare = darkCount / totalSampled;
  const textIsDark = darkShare >= 0.5;
  const target = textIsDark ? darkSum : lightSum;
  const targetCount = textIsDark ? darkCount : lightCount;
  if (targetCount === 0) {
    return { color: textIsDark ? "#000000" : "#ffffff", fontWeight: 500 };
  }

  const r = Math.round(target[0] / targetCount);
  const g = Math.round(target[1] / targetCount);
  const b = Math.round(target[2] / targetCount);

  // Heavier glyphs (e.g. 700) leave proportionally more dark pixels behind
  // than thin ones (e.g. 400), so the dark share is a noisy but cheap weight
  // hint.
  const fontWeight = darkShare > 0.65 ? 700 : darkShare > 0.45 ? 600 : 500;

  return {
    color: `#${[r, g, b]
      .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
      .join("")}`,
    fontWeight,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export interface DetectTextOptions {
  /**
   * Minimum confidence, 0..1. Words below this are dropped. Defaults to 0.4
   * which is loose enough to keep short labels but tight enough that noise
   * does not produce regions.
   */
  minConfidence?: number;
  /**
   * Caps the longest edge of the image handed to Tesseract. Tesseract is
   * accurate on small images and slow on big ones, and a screenshot is
   * rarely larger than 2400 px on its longest edge.
   */
  maxLongEdge?: number;
}

export interface DetectTextResult {
  regions: TextRegion[];
  /** Image width that was handed to Tesseract, in document pixels. */
  detectedWidth: number;
  /** Image height that was handed to Tesseract, in document pixels. */
  detectedHeight: number;
}

/**
 * Runs the OCR pass on an image and returns clickable text regions.
 *
 * The image is downscaled to `maxLongEdge` before being handed to Tesseract
 * (default 2000) so the recogniser does not spend its accuracy budget on
 * noise. The returned regions are in document coordinates, so a region
 * found at 1200×800 maps back to the source image at its native size.
 */
export async function detectTextRegions(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: DetectTextOptions = {}
): Promise<DetectTextResult> {
  const maxLongEdge = options.maxLongEdge ?? 2000;
  const minConfidence = options.minConfidence ?? 0.4;

  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = longest > maxLongEdge ? maxLongEdge / longest : 1;
  const scaledWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scaledHeight = Math.max(1, Math.round(sourceHeight * scale));

  // Render the source into an OffscreenCanvas so the recogniser can pull the
  // pixels back out without ever holding a duplicate full-size buffer.
  const buffer = browserCanvasFactory.create(scaledWidth, scaledHeight);
  buffer.ctx.imageSmoothingEnabled = true;
  buffer.ctx.imageSmoothingQuality = "high";
  buffer.ctx.drawImage(source, 0, 0, scaledWidth, scaledHeight);

  const worker = await getWorker();
  const raw = await worker.recognize(buffer.canvas);
  if (!isTesseractResult(raw)) {
    return { regions: [], detectedWidth: scaledWidth, detectedHeight: scaledHeight };
  }

  // Reshape into runs first, then back to document coordinates. The
  // recogniser works on the downscaled buffer, so every dimension is
  // multiplied by 1/scale.
  const scaledRegions = shapeRegions(raw, scaledWidth, scaledHeight)
    .filter((region) => region.confidence >= minConfidence);
  const inverse = 1 / scale;

  // Sample the colour against the *original* full-resolution image, where the
  // pixels are sharp. Otherwise the downscaled buffer would smooth the dark
  // and light populations together and the heuristic would guess wrong.
  const fullBuffer = browserCanvasFactory.create(sourceWidth, sourceHeight);
  fullBuffer.ctx.imageSmoothingEnabled = false;
  fullBuffer.ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  const fullData = fullBuffer.ctx.getImageData(0, 0, sourceWidth, sourceHeight).data;

  const regions: TextRegion[] = scaledRegions.map((region) => {
    const document = {
      ...region,
      x: region.x * inverse,
      y: region.y * inverse,
      width: region.width * inverse,
      height: region.height * inverse,
      fontSize: Math.max(8, Math.round(region.fontSize * inverse)),
    };
    const { color, fontWeight } = sampleTextColour(fullData, sourceWidth, sourceHeight, document);
    return { ...document, color, fontWeight };
  });

  return { regions, detectedWidth: sourceWidth, detectedHeight: sourceHeight };
}
