/**
 * Document and layer operations.
 *
 * Every function here is pure: it takes a document and returns a new one. That
 * is what makes the history stack trivially correct — a snapshot is just the
 * previous return value, with no risk of a mutation leaking backwards through
 * the undo stack.
 */

import { MAX_CANVAS_DIMENSION } from "./constants";
import { createAdjustments } from "./adjustments";
import type {
  EditorDocument,
  ImageLayer,
  Layer,
  Rect,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Identifiers                                                                */
/* -------------------------------------------------------------------------- */

let idCounter = 0;

/**
 * Short unique id.
 *
 * `crypto.randomUUID` is used when available; the counter fallback keeps ids
 * unique in the headless test renderer, where the document never leaves the
 * process.
 */
export function createId(prefix: string): string {
  idCounter += 1;
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}${idCounter.toString(36)}`;
}

/* -------------------------------------------------------------------------- */
/* Construction                                                               */
/* -------------------------------------------------------------------------- */

export function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_CANVAS_DIMENSION, Math.round(value)));
}

export function createDocument(
  width: number,
  height: number,
  options: { name?: string; background?: string | null } = {}
): EditorDocument {
  return {
    id: createId("doc"),
    name: options.name ?? "Untitled",
    width: clampDimension(width),
    height: clampDimension(height),
    background: options.background === undefined ? "#ffffff" : options.background,
    layers: [],
  };
}

function baseLayer(name: string, rect: Rect) {
  return {
    id: createId("layer"),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal" as const,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: 0,
    flipX: false,
    flipY: false,
    adjustments: createAdjustments(),
  };
}

export function createImageLayer(
  name: string,
  sourceId: string,
  rect: Rect,
  natural: { width: number; height: number }
): ImageLayer {
  return {
    ...baseLayer(name, rect),
    type: "image",
    sourceId,
    naturalWidth: natural.width,
    naturalHeight: natural.height,
  };
}

export function createTextLayer(
  text: string,
  rect: Rect,
  overrides: Partial<TextLayer> = {}
): TextLayer {
  return {
    ...baseLayer(text.split("\n")[0].slice(0, 40) || "Text", rect),
    type: "text",
    text,
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: 48,
    fontWeight: 600,
    italic: false,
    underline: false,
    letterSpacing: 0,
    lineHeight: 1.2,
    align: "left",
    color: "#111111",
    strokeColor: "#ffffff",
    strokeWidth: 0,
    shadow: { enabled: false, color: "#00000080", blur: 8, offsetX: 2, offsetY: 2 },
    autoSize: true,
    ...overrides,
  };
}

const SHAPE_NAMES: Record<ShapeKind, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  arrow: "Arrow",
  polygon: "Polygon",
  star: "Star",
};

export function createShapeLayer(
  shape: ShapeKind,
  rect: Rect,
  overrides: Partial<ShapeLayer> = {}
): ShapeLayer {
  // Lines and arrows read as strokes, so they default to no fill.
  const strokeOnly = shape === "line" || shape === "arrow";
  return {
    ...baseLayer(SHAPE_NAMES[shape], rect),
    type: "shape",
    shape,
    fill: "#2563eb",
    fillEnabled: !strokeOnly,
    strokeColor: strokeOnly ? "#2563eb" : "#1e40af",
    strokeWidth: strokeOnly ? 4 : 0,
    cornerRadius: 0,
    sides: shape === "star" ? 5 : 6,
    innerRadius: 0.45,
    arrowHeadSize: 0.25,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Layer lookup                                                               */
/* -------------------------------------------------------------------------- */

export function findLayer(doc: EditorDocument, id: string): Layer | undefined {
  return doc.layers.find((layer) => layer.id === id);
}

export function layerIndex(doc: EditorDocument, id: string): number {
  return doc.layers.findIndex((layer) => layer.id === id);
}

/** Generates a non-colliding name, e.g. "Rectangle 2". */
export function uniqueLayerName(doc: EditorDocument, base: string): string {
  const existing = new Set(doc.layers.map((layer) => layer.name));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/* -------------------------------------------------------------------------- */
/* Mutations (all returning new documents)                                    */
/* -------------------------------------------------------------------------- */

/** Adds a layer on top, or at `index` when given. */
export function addLayer(
  doc: EditorDocument,
  layer: Layer,
  index?: number
): EditorDocument {
  const layers = [...doc.layers];
  const named = { ...layer, name: uniqueLayerName(doc, layer.name) };
  if (index === undefined || index >= layers.length) layers.push(named);
  else layers.splice(Math.max(0, index), 0, named);
  return { ...doc, layers };
}

export function updateLayer(
  doc: EditorDocument,
  id: string,
  patch: Partial<Layer> | ((layer: Layer) => Partial<Layer>)
): EditorDocument {
  let changed = false;
  const layers = doc.layers.map((layer) => {
    if (layer.id !== id) return layer;
    const resolved = typeof patch === "function" ? patch(layer) : patch;
    changed = true;
    // The cast is safe because callers only ever patch fields belonging to the
    // layer's own variant; the discriminant is never in `patch`.
    return { ...layer, ...resolved } as Layer;
  });
  return changed ? { ...doc, layers } : doc;
}

export function updateLayers(
  doc: EditorDocument,
  ids: string[],
  patch: (layer: Layer) => Partial<Layer>
): EditorDocument {
  const target = new Set(ids);
  if (!target.size) return doc;
  const layers = doc.layers.map((layer) =>
    target.has(layer.id) ? ({ ...layer, ...patch(layer) } as Layer) : layer
  );
  return { ...doc, layers };
}

export function removeLayers(doc: EditorDocument, ids: string[]): EditorDocument {
  const target = new Set(ids);
  const layers = doc.layers.filter((layer) => !target.has(layer.id) || layer.locked);
  return layers.length === doc.layers.length ? doc : { ...doc, layers };
}

/** Duplicates layers, placing each copy directly above its original. */
export function duplicateLayers(
  doc: EditorDocument,
  ids: string[],
  offset = 16
): { document: EditorDocument; newIds: string[] } {
  const target = new Set(ids);
  const layers: Layer[] = [];
  const newIds: string[] = [];

  for (const layer of doc.layers) {
    layers.push(layer);
    if (!target.has(layer.id)) continue;
    const copy: Layer = {
      ...structuredCloneLayer(layer),
      id: createId("layer"),
      name: `${layer.name} copy`,
      x: layer.x + offset,
      y: layer.y + offset,
      // A duplicate has to be editable, otherwise the user has to unlock it
      // before they can place it.
      locked: false,
    };
    layers.push(copy);
    newIds.push(copy.id);
  }

  return { document: { ...doc, layers }, newIds };
}

/** Deep copy of a layer, safe for structured values like the text shadow. */
export function structuredCloneLayer<T extends Layer>(layer: T): T {
  const copy = { ...layer, adjustments: { ...layer.adjustments } };
  if (copy.type === "text") {
    return { ...copy, shadow: { ...copy.shadow } } as T;
  }
  return copy as T;
}

export type ReorderMode = "front" | "back" | "forward" | "backward";

/**
 * Moves layers in z-order.
 *
 * Multi-layer moves keep the relative order of the moved group, which is what
 * a user expects when they select three shapes and press "bring to front".
 */
export function reorderLayers(
  doc: EditorDocument,
  ids: string[],
  mode: ReorderMode
): EditorDocument {
  const target = new Set(ids);
  if (!target.size) return doc;

  const moving = doc.layers.filter((layer) => target.has(layer.id));
  const staying = doc.layers.filter((layer) => !target.has(layer.id));
  if (!moving.length) return doc;

  if (mode === "front") return { ...doc, layers: [...staying, ...moving] };
  if (mode === "back") return { ...doc, layers: [...moving, ...staying] };

  const layers = [...doc.layers];
  const indices = layers
    .map((layer, index) => (target.has(layer.id) ? index : -1))
    .filter((index) => index >= 0);

  if (mode === "forward") {
    // Walk from the top so shifting one layer never displaces the next.
    for (let i = indices.length - 1; i >= 0; i--) {
      const index = indices[i];
      if (index >= layers.length - 1) continue;
      if (target.has(layers[index + 1].id)) continue;
      [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
    }
  } else {
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      if (index <= 0) continue;
      if (target.has(layers[index - 1].id)) continue;
      [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
    }
  }

  return { ...doc, layers };
}

/** Moves a layer to an explicit position, used by drag-and-drop reordering. */
export function moveLayerToIndex(
  doc: EditorDocument,
  id: string,
  targetIndex: number
): EditorDocument {
  const from = layerIndex(doc, id);
  if (from < 0) return doc;
  const layers = [...doc.layers];
  const [layer] = layers.splice(from, 1);
  const to = Math.max(0, Math.min(layers.length, targetIndex));
  layers.splice(to, 0, layer);
  return { ...doc, layers };
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                   */
/* -------------------------------------------------------------------------- */

/** Axis-aligned bounding box of a layer, accounting for its rotation. */
export function layerBounds(layer: Layer): Rect {
  if (!layer.rotation) {
    return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  }
  const radians = (layer.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = layer.width * cos + layer.height * sin;
  const height = layer.width * sin + layer.height * cos;
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Union of several layers' bounds; null when the list is empty. */
export function unionBounds(layers: Layer[]): Rect | null {
  if (!layers.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    const bounds = layerBounds(layer);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Transforms a document point into a layer's unrotated local space. */
export function toLayerSpace(layer: Layer, x: number, y: number): { x: number; y: number } {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  if (!layer.rotation) return { x: x - layer.x, y: y - layer.y };
  const radians = (-layer.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: dx * cos - dy * sin + layer.width / 2,
    y: dx * sin + dy * cos + layer.height / 2,
  };
}

/** True when a document point falls inside a layer, rotation included. */
export function hitTestLayer(layer: Layer, x: number, y: number): boolean {
  const local = toLayerSpace(layer, x, y);
  // Thin lines need a usable grab area regardless of their bounding box.
  const pad = layer.type === "shape" && (layer.shape === "line" || layer.shape === "arrow") ? 6 : 0;
  return (
    local.x >= -pad &&
    local.y >= -pad &&
    local.x <= layer.width + pad &&
    local.y <= layer.height + pad
  );
}

/** Topmost layer at a point, skipping hidden layers. */
export function pickLayer(
  doc: EditorDocument,
  x: number,
  y: number,
  options: { includeLocked?: boolean } = {}
): Layer | undefined {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i];
    if (!layer.visible) continue;
    if (layer.locked && !options.includeLocked) continue;
    if (hitTestLayer(layer, x, y)) return layer;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Canvas operations                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Crops the canvas, translating every layer so the visible result is
 * unchanged apart from the trimmed edges.
 */
export function cropDocument(doc: EditorDocument, rect: Rect): EditorDocument {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const width = clampDimension(rect.width);
  const height = clampDimension(rect.height);

  return {
    ...doc,
    width,
    height,
    layers: doc.layers.map((layer) => ({ ...layer, x: layer.x - x, y: layer.y - y })),
  };
}

/**
 * Resizes the canvas.
 *
 * With `scaleLayers` the whole composition is scaled, which is what "resize
 * image" means; without it the canvas grows or shrinks around the existing
 * content, which is "resize canvas".
 */
export function resizeDocument(
  doc: EditorDocument,
  width: number,
  height: number,
  scaleLayers: boolean
): EditorDocument {
  const nextWidth = clampDimension(width);
  const nextHeight = clampDimension(height);
  if (!scaleLayers) return { ...doc, width: nextWidth, height: nextHeight };

  const scaleX = nextWidth / doc.width;
  const scaleY = nextHeight / doc.height;
  const uniform = Math.min(scaleX, scaleY);

  return {
    ...doc,
    width: nextWidth,
    height: nextHeight,
    layers: doc.layers.map((layer) => {
      const scaled = {
        ...layer,
        x: layer.x * scaleX,
        y: layer.y * scaleY,
        width: layer.width * scaleX,
        height: layer.height * scaleY,
      };
      // Type scales with the smaller axis so glyphs never distort.
      if (scaled.type === "text") {
        return {
          ...scaled,
          fontSize: scaled.fontSize * uniform,
          letterSpacing: scaled.letterSpacing * uniform,
          strokeWidth: scaled.strokeWidth * uniform,
        };
      }
      if (scaled.type === "shape") {
        return {
          ...scaled,
          strokeWidth: scaled.strokeWidth * uniform,
          cornerRadius: scaled.cornerRadius * uniform,
        };
      }
      return scaled;
    }),
  };
}

/** Rotates the whole canvas by a multiple of 90°. */
export function rotateDocument(doc: EditorDocument, quarterTurns: number): EditorDocument {
  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  if (turns === 0) return doc;

  let next = doc;
  for (let i = 0; i < turns; i++) next = rotateDocumentQuarter(next);
  return next;
}

/** One clockwise quarter turn. */
function rotateDocumentQuarter(doc: EditorDocument): EditorDocument {
  const width = doc.height;
  const height = doc.width;

  return {
    ...doc,
    width,
    height,
    layers: doc.layers.map((layer) => {
      // Rotate the layer centre about the canvas centre, then re-derive the
      // top-left from the swapped extents.
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      const rotatedCx = doc.height - cy;
      const rotatedCy = cx;
      return {
        ...layer,
        x: rotatedCx - layer.width / 2,
        y: rotatedCy - layer.height / 2,
        rotation: (layer.rotation + 90) % 360,
      };
    }),
  };
}

/** Mirrors the whole canvas. */
export function flipDocument(doc: EditorDocument, axis: "horizontal" | "vertical"): EditorDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) => {
      if (axis === "horizontal") {
        return {
          ...layer,
          x: doc.width - layer.x - layer.width,
          flipX: !layer.flipX,
          rotation: layer.rotation ? (360 - layer.rotation) % 360 : 0,
        };
      }
      return {
        ...layer,
        y: doc.height - layer.y - layer.height,
        flipY: !layer.flipY,
        rotation: layer.rotation ? (360 - layer.rotation) % 360 : 0,
      };
    }),
  };
}

/** Content bounding box across every visible layer, clamped to the canvas. */
export function contentBounds(doc: EditorDocument): Rect {
  const visible = doc.layers.filter((layer) => layer.visible);
  const bounds = unionBounds(visible);
  if (!bounds) return { x: 0, y: 0, width: doc.width, height: doc.height };

  const x = Math.max(0, Math.floor(bounds.x));
  const y = Math.max(0, Math.floor(bounds.y));
  const right = Math.min(doc.width, Math.ceil(bounds.x + bounds.width));
  const bottom = Math.min(doc.height, Math.ceil(bounds.y + bounds.height));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

/* -------------------------------------------------------------------------- */
/* Alignment                                                                  */
/* -------------------------------------------------------------------------- */

export type AlignMode =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

/**
 * Aligns layers.
 *
 * A single selection aligns to the canvas; several layers align to their
 * shared bounding box, which is the behaviour every design tool uses.
 */
export function alignLayers(
  doc: EditorDocument,
  ids: string[],
  mode: AlignMode
): EditorDocument {
  const selected = doc.layers.filter((layer) => ids.includes(layer.id) && !layer.locked);
  if (!selected.length) return doc;

  const frame =
    selected.length === 1
      ? { x: 0, y: 0, width: doc.width, height: doc.height }
      : unionBounds(selected)!;

  return updateLayers(doc, selected.map((layer) => layer.id), (layer) => {
    const bounds = layerBounds(layer);
    // Rotated layers are positioned by their visual box, then converted back.
    const offsetX = layer.x - bounds.x;
    const offsetY = layer.y - bounds.y;

    switch (mode) {
      case "left":
        return { x: frame.x + offsetX };
      case "center-x":
        return { x: frame.x + (frame.width - bounds.width) / 2 + offsetX };
      case "right":
        return { x: frame.x + frame.width - bounds.width + offsetX };
      case "top":
        return { y: frame.y + offsetY };
      case "center-y":
        return { y: frame.y + (frame.height - bounds.height) / 2 + offsetY };
      case "bottom":
        return { y: frame.y + frame.height - bounds.height + offsetY };
      default:
        return {};
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                              */
/* -------------------------------------------------------------------------- */

/** Deep copy used for history snapshots. */
export function cloneDocument(doc: EditorDocument): EditorDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) => structuredCloneLayer(layer)),
  };
}
