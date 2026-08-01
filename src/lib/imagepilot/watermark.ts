/**
 * Watermark engine.
 *
 * Watermarks are produced as ordinary editor layers rather than being painted
 * directly onto pixels. That single decision is what makes the studio reuse
 * the whole editor for free: a watermark can be nudged, restyled, undone and
 * re-exported through exactly the same code paths as any other layer, and the
 * batch runner is simply "build these layers over each image and composite".
 */

import { createId } from "./document";
import { createAdjustments } from "./adjustments";
import type {
  EditorDocument,
  ImageLayer,
  Layer,
  RasterSource,
  TextLayer,
} from "./types";

export type WatermarkKind = "text" | "image";

/** Nine-point placement grid, plus tiling. */
export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "tile";

export interface WatermarkSettings {
  kind: WatermarkKind;
  /** Text content when `kind` is "text". */
  text: string;
  fontFamily: string;
  fontWeight: number;
  color: string;
  /** Outline drawn behind the fill so light text stays legible on light images. */
  strokeColor: string;
  strokeWidth: number;
  /** Raster id of the logo when `kind` is "image". */
  imageSourceId: string | null;
  /** 0..1. */
  opacity: number;
  /** Degrees, clockwise. */
  rotation: number;
  /**
   * Size as a fraction of the image's shorter side (0.02..1). Expressing it
   * relatively is what lets one setting apply sensibly across a batch of
   * mixed-resolution images.
   */
  scale: number;
  position: WatermarkPosition;
  /** Inset from the edge, as a fraction of the shorter side. */
  margin: number;
  /** Gap between tiles, as a fraction of the watermark's own size. */
  tileGap: number;
}

export const defaultWatermarkSettings: WatermarkSettings = {
  kind: "text",
  text: "© Your Name",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontWeight: 700,
  color: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 0,
  imageSourceId: null,
  opacity: 0.45,
  rotation: 0,
  scale: 0.08,
  position: "bottom-right",
  margin: 0.04,
  tileGap: 0.6,
};

/** Layers carry this marker so the studio can replace them wholesale. */
export const WATERMARK_LAYER_PREFIX = "Watermark";

function isWatermarkLayer(layer: Layer): boolean {
  return layer.name.startsWith(WATERMARK_LAYER_PREFIX);
}

/** Removes any previously generated watermark layers. */
export function stripWatermarks(doc: EditorDocument): EditorDocument {
  const layers = doc.layers.filter((layer) => !isWatermarkLayer(layer));
  return layers.length === doc.layers.length ? doc : { ...doc, layers };
}

/**
 * Anchor point for a single watermark, in document coordinates.
 *
 * Returns the top-left corner for a box of the given size.
 */
function anchorFor(
  position: Exclude<WatermarkPosition, "tile">,
  docWidth: number,
  docHeight: number,
  width: number,
  height: number,
  margin: number
): { x: number; y: number } {
  const left = margin;
  const centerX = (docWidth - width) / 2;
  const right = docWidth - width - margin;
  const top = margin;
  const middleY = (docHeight - height) / 2;
  const bottom = docHeight - height - margin;

  switch (position) {
    case "top-left":
      return { x: left, y: top };
    case "top-center":
      return { x: centerX, y: top };
    case "top-right":
      return { x: right, y: top };
    case "middle-left":
      return { x: left, y: middleY };
    case "center":
      return { x: centerX, y: middleY };
    case "middle-right":
      return { x: right, y: middleY };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom-center":
      return { x: centerX, y: bottom };
    case "bottom-right":
    default:
      return { x: right, y: bottom };
  }
}

/**
 * Intrinsic size of one watermark instance.
 *
 * Text is measured through the caller-supplied measurer so the result matches
 * what the renderer will actually draw; a logo keeps its own aspect ratio.
 */
function watermarkSize(
  settings: WatermarkSettings,
  docWidth: number,
  docHeight: number,
  measureText: (fontSize: number) => number,
  logo: RasterSource | undefined
): { width: number; height: number; fontSize: number } {
  const shorter = Math.min(docWidth, docHeight);

  if (settings.kind === "text") {
    // `scale` is the cap height relative to the shorter side.
    const fontSize = Math.max(6, shorter * settings.scale);
    const width = Math.max(1, measureText(fontSize));
    // 1.25em box keeps descenders inside the layer.
    return { width, height: fontSize * 1.25, fontSize };
  }

  if (!logo) return { width: 0, height: 0, fontSize: 0 };

  const target = shorter * settings.scale * 4;
  const ratio = logo.width / Math.max(1, logo.height);
  // Fit the logo's longest side to the target so tall and wide logos read at
  // a comparable visual weight.
  const width = ratio >= 1 ? target : target * ratio;
  const height = ratio >= 1 ? target / ratio : target;
  return { width, height, fontSize: 0 };
}

function makeTextLayer(
  settings: WatermarkSettings,
  rect: { x: number; y: number; width: number; height: number },
  fontSize: number,
  index: number
): TextLayer {
  return {
    id: createId("layer"),
    name: `${WATERMARK_LAYER_PREFIX}${index ? ` ${index}` : ""}`,
    type: "text",
    visible: true,
    locked: false,
    opacity: settings.opacity,
    blendMode: "normal",
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: settings.rotation,
    flipX: false,
    flipY: false,
    adjustments: createAdjustments(),
    text: settings.text,
    fontFamily: settings.fontFamily,
    fontSize,
    fontWeight: settings.fontWeight,
    italic: false,
    underline: false,
    letterSpacing: 0,
    lineHeight: 1.2,
    align: "center",
    color: settings.color,
    strokeColor: settings.strokeColor,
    strokeWidth: settings.strokeWidth,
    shadow: { enabled: false, color: "#00000080", blur: 8, offsetX: 2, offsetY: 2 },
    // Fixed size: the box is positioned deliberately, so it must not resize
    // itself and drift away from the anchor.
    autoSize: false,
  };
}

function makeImageLayer(
  settings: WatermarkSettings,
  rect: { x: number; y: number; width: number; height: number },
  logo: RasterSource,
  index: number
): ImageLayer {
  return {
    id: createId("layer"),
    name: `${WATERMARK_LAYER_PREFIX}${index ? ` ${index}` : ""}`,
    type: "image",
    visible: true,
    locked: false,
    opacity: settings.opacity,
    blendMode: "normal",
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: settings.rotation,
    flipX: false,
    flipY: false,
    adjustments: createAdjustments(),
    sourceId: logo.id,
    naturalWidth: logo.width,
    naturalHeight: logo.height,
  };
}

/**
 * Builds the layers for a watermark over a document of the given size.
 *
 * Returned as plain layers so the caller can append them to any document —
 * the live preview and the batch runner use the identical call.
 */
export function buildWatermarkLayers(
  settings: WatermarkSettings,
  docWidth: number,
  docHeight: number,
  measureText: (fontSize: number) => number,
  logo?: RasterSource
): Layer[] {
  if (settings.kind === "text" && !settings.text.trim()) return [];
  if (settings.kind === "image" && !logo) return [];

  const size = watermarkSize(settings, docWidth, docHeight, measureText, logo);
  if (size.width <= 0 || size.height <= 0) return [];

  const shorter = Math.min(docWidth, docHeight);
  const margin = shorter * settings.margin;

  if (settings.position !== "tile") {
    const anchor = anchorFor(
      settings.position,
      docWidth,
      docHeight,
      size.width,
      size.height,
      margin
    );
    const rect = { ...anchor, width: size.width, height: size.height };
    return [
      settings.kind === "text"
        ? makeTextLayer(settings, rect, size.fontSize, 0)
        : makeImageLayer(settings, rect, logo!, 0),
    ];
  }

  /* Tiling. */
  const gapX = size.width * (1 + settings.tileGap);
  const gapY = size.height * (1 + settings.tileGap);
  if (gapX <= 0 || gapY <= 0) return [];

  // A rotated tile sweeps a larger area, so the grid is overscanned to make
  // sure the corners are still covered once each tile is turned.
  const diagonal = Math.hypot(docWidth, docHeight);
  const startX = (docWidth - diagonal) / 2;
  const startY = (docHeight - diagonal) / 2;
  const columns = Math.ceil(diagonal / gapX) + 1;
  const rows = Math.ceil(diagonal / gapY) + 1;

  // Hard cap: a tiny scale on a large canvas would otherwise generate tens of
  // thousands of layers and lock the browser up.
  const MAX_TILES = 400;
  if (columns * rows > MAX_TILES) {
    const factor = Math.sqrt((columns * rows) / MAX_TILES);
    return buildWatermarkLayers(
      { ...settings, tileGap: (1 + settings.tileGap) * factor - 1 },
      docWidth,
      docHeight,
      measureText,
      logo
    );
  }

  const layers: Layer[] = [];
  let index = 1;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // Offset alternate rows so the pattern reads as a weave rather than a
      // grid, which is both harder to crop out and better looking.
      const offset = row % 2 === 0 ? 0 : gapX / 2;
      const rect = {
        x: startX + column * gapX + offset,
        y: startY + row * gapY,
        width: size.width,
        height: size.height,
      };

      // Skip tiles whose bounding box misses the canvas entirely.
      if (
        rect.x + rect.width < -gapX ||
        rect.y + rect.height < -gapY ||
        rect.x > docWidth + gapX ||
        rect.y > docHeight + gapY
      ) {
        continue;
      }

      layers.push(
        settings.kind === "text"
          ? makeTextLayer(settings, rect, size.fontSize, index)
          : makeImageLayer(settings, rect, logo!, index)
      );
      index++;
    }
  }

  return layers;
}

/** Replaces the watermark layers on a document with a freshly built set. */
export function applyWatermark(
  doc: EditorDocument,
  settings: WatermarkSettings,
  measureText: (fontSize: number) => number,
  logo?: RasterSource
): EditorDocument {
  const base = stripWatermarks(doc);
  const layers = buildWatermarkLayers(
    settings,
    base.width,
    base.height,
    measureText,
    logo
  );
  return { ...base, layers: [...base.layers, ...layers] };
}

/** Placement options offered by the UI, in reading order. */
export const WATERMARK_POSITIONS: Array<{ value: WatermarkPosition; label: string }> = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "middle-left", label: "Middle left" },
  { value: "center", label: "Centre" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "tile", label: "Tiled" },
];
