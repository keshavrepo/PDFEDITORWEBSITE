/**
 * Viewport maths, transform handles and snapping.
 *
 * Everything the canvas needs to translate between screen pixels and document
 * pixels lives here, kept pure so the behaviour can be reasoned about (and
 * tested) without a DOM.
 */

import { MAX_ZOOM, MIN_ZOOM, SNAP_THRESHOLD, ZOOM_STEPS } from "./constants";
import { layerBounds } from "./document";
import type {
  EditorDocument,
  Layer,
  Point,
  Rect,
  TransformHandle,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Viewport                                                                   */
/* -------------------------------------------------------------------------- */

export interface Viewport {
  /** Document pixels per screen pixel. */
  zoom: number;
  /** Screen-space offset of the document origin, before zoom. */
  panX: number;
  panY: number;
}

export function documentToScreen(view: Viewport, x: number, y: number): Point {
  return { x: x * view.zoom + view.panX, y: y * view.zoom + view.panY };
}

export function screenToDocument(view: Viewport, x: number, y: number): Point {
  return { x: (x - view.panX) / view.zoom, y: (y - view.panY) / view.zoom };
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** Next zoom stop above or below the current level. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  if (direction > 0) {
    for (const step of ZOOM_STEPS) if (step > zoom * 1.001) return step;
    return MAX_ZOOM;
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < zoom * 0.999) return ZOOM_STEPS[i];
  }
  return MIN_ZOOM;
}

/**
 * Zooms while keeping a screen point fixed.
 *
 * This is what makes wheel-zoom feel anchored: the pixel under the cursor
 * stays under the cursor.
 */
export function zoomAtPoint(view: Viewport, zoom: number, screenX: number, screenY: number): Viewport {
  const next = clampZoom(zoom);
  const before = screenToDocument(view, screenX, screenY);
  return {
    zoom: next,
    panX: screenX - before.x * next,
    panY: screenY - before.y * next,
  };
}

/** Zoom and pan that centres the document in the given viewport. */
export function fitToViewport(
  doc: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  padding = 48
): Viewport {
  const available = {
    width: Math.max(1, viewportWidth - padding * 2),
    height: Math.max(1, viewportHeight - padding * 2),
  };
  // Never scale a small document up past 100%; that only makes it blurry.
  const zoom = clampZoom(
    Math.min(available.width / doc.width, available.height / doc.height, 1)
  );
  return {
    zoom,
    panX: (viewportWidth - doc.width * zoom) / 2,
    panY: (viewportHeight - doc.height * zoom) / 2,
  };
}

/** Viewport centring the document at a fixed zoom level. */
export function centerAtZoom(
  doc: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  zoom: number
): Viewport {
  const next = clampZoom(zoom);
  return {
    zoom: next,
    panX: (viewportWidth - doc.width * next) / 2,
    panY: (viewportHeight - doc.height * next) / 2,
  };
}

/* -------------------------------------------------------------------------- */
/* Transform handles                                                          */
/* -------------------------------------------------------------------------- */

export const RESIZE_HANDLES: TransformHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Cursor for each handle, rotated to match the layer's own rotation. */
export function handleCursor(handle: TransformHandle, rotation: number): string {
  if (handle === "rotate") return "grab";

  const angles: Record<Exclude<TransformHandle, "rotate">, number> = {
    n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
  };
  const cursors = [
    "ns-resize", "nesw-resize", "ew-resize", "nwse-resize",
    "ns-resize", "nesw-resize", "ew-resize", "nwse-resize",
  ];
  const angle = (angles[handle] + rotation + 360) % 360;
  // Each cursor covers a 45° arc, offset by half so the boundaries land
  // between the eight compass directions.
  return cursors[Math.round(angle / 45) % 8];
}

/** Handle positions in document space, accounting for rotation. */
export function handlePositions(layer: Layer): Record<TransformHandle, Point> {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const radians = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const local = (lx: number, ly: number): Point => {
    const dx = lx - layer.width / 2;
    const dy = ly - layer.height / 2;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };

  const w = layer.width;
  const h = layer.height;

  return {
    nw: local(0, 0),
    n: local(w / 2, 0),
    ne: local(w, 0),
    e: local(w, h / 2),
    se: local(w, h),
    s: local(w / 2, h),
    sw: local(0, h),
    w: local(0, h / 2),
    // Rotation grip sits above the top edge, scaled by nothing so the caller
    // can offset it consistently in screen space.
    rotate: local(w / 2, 0),
  };
}

/**
 * Applies a resize drag.
 *
 * The drag delta is rotated into the layer's own frame first, so dragging the
 * east handle of a 30°-rotated layer widens it along its own axis rather than
 * along the screen's.
 */
export function resizeLayer(
  layer: Layer,
  handle: TransformHandle,
  deltaX: number,
  deltaY: number,
  options: { preserveRatio?: boolean; fromCenter?: boolean } = {}
): Rect {
  const radians = (-layer.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localDx = deltaX * cos - deltaY * sin;
  const localDy = deltaX * sin + deltaY * cos;

  let left = 0;
  let top = 0;
  let right = layer.width;
  let bottom = layer.height;

  const affectsLeft = handle === "nw" || handle === "w" || handle === "sw";
  const affectsRight = handle === "ne" || handle === "e" || handle === "se";
  const affectsTop = handle === "nw" || handle === "n" || handle === "ne";
  const affectsBottom = handle === "sw" || handle === "s" || handle === "se";

  if (affectsLeft) left += localDx;
  if (affectsRight) right += localDx;
  if (affectsTop) top += localDy;
  if (affectsBottom) bottom += localDy;

  if (options.fromCenter) {
    // Mirror the drag on the opposite edge so the centre stays put.
    if (affectsLeft) right -= localDx;
    if (affectsRight) left -= localDx;
    if (affectsTop) bottom -= localDy;
    if (affectsBottom) top -= localDy;
  }

  let width = right - left;
  let height = bottom - top;

  if (options.preserveRatio && layer.width > 0 && layer.height > 0) {
    const ratio = layer.width / layer.height;
    const corner = affectsLeft !== affectsRight && affectsTop !== affectsBottom;

    if (corner) {
      // Follow whichever axis the user moved further, so the drag feels direct.
      if (Math.abs(width / ratio) > Math.abs(height)) height = width / ratio;
      else width = height * ratio;
    } else if (affectsLeft || affectsRight) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }

    if (affectsLeft) left = right - width;
    else right = left + width;
    if (affectsTop) top = bottom - height;
    else bottom = top + height;

    if (options.fromCenter) {
      const cx = layer.width / 2;
      const cy = layer.height / 2;
      left = cx - width / 2;
      right = cx + width / 2;
      top = cy - height / 2;
      bottom = cy + height / 2;
    }
  }

  // A minimum of one pixel avoids a zero-area layer the user can never grab
  // again, and a negative size that would mirror the content unexpectedly.
  width = Math.max(1, right - left);
  height = Math.max(1, bottom - top);

  // Convert the new local box back to document space through the layer's
  // unchanged centre.
  const oldCenterX = layer.x + layer.width / 2;
  const oldCenterY = layer.y + layer.height / 2;
  const newLocalCenterX = left + width / 2;
  const newLocalCenterY = top + height / 2;
  const offsetX = newLocalCenterX - layer.width / 2;
  const offsetY = newLocalCenterY - layer.height / 2;
  const forward = (layer.rotation * Math.PI) / 180;
  const fcos = Math.cos(forward);
  const fsin = Math.sin(forward);
  const centerX = oldCenterX + offsetX * fcos - offsetY * fsin;
  const centerY = oldCenterY + offsetX * fsin + offsetY * fcos;

  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

/** Rotation in degrees from the layer centre to a document point. */
export function rotationTowards(layer: Layer, pointX: number, pointY: number): number {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  // Offset by 90° because the grip sits above the layer, not to its right.
  const degrees = (Math.atan2(pointY - cy, pointX - cx) * 180) / Math.PI + 90;
  return ((degrees % 360) + 360) % 360;
}

/* -------------------------------------------------------------------------- */
/* Snapping                                                                   */
/* -------------------------------------------------------------------------- */

export interface SnapGuide {
  axis: "x" | "y";
  /** Document coordinate of the guide line. */
  position: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/**
 * Snaps a moving box to the canvas edges, canvas centre, the grid and the
 * other layers' edges and centres.
 *
 * The threshold is expressed in screen pixels and converted here, so snapping
 * feels equally sticky at every zoom level.
 */
export function snapRect(
  rect: Rect,
  doc: EditorDocument,
  options: {
    zoom: number;
    excludeIds?: string[];
    gridSize?: number;
    snapToGrid?: boolean;
    snapToObjects?: boolean;
  }
): SnapResult {
  const threshold = SNAP_THRESHOLD / options.zoom;
  const exclude = new Set(options.excludeIds ?? []);

  const targetsX: number[] = [];
  const targetsY: number[] = [];

  // Canvas edges and centre are always available.
  targetsX.push(0, doc.width / 2, doc.width);
  targetsY.push(0, doc.height / 2, doc.height);

  if (options.snapToObjects !== false) {
    for (const layer of doc.layers) {
      if (exclude.has(layer.id) || !layer.visible) continue;
      const bounds = layerBounds(layer);
      targetsX.push(bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width);
      targetsY.push(bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height);
    }
  }

  if (options.snapToGrid && options.gridSize && options.gridSize > 0) {
    const size = options.gridSize;
    for (const edge of [rect.x, rect.x + rect.width / 2, rect.x + rect.width]) {
      targetsX.push(Math.round(edge / size) * size);
    }
    for (const edge of [rect.y, rect.y + rect.height / 2, rect.y + rect.height]) {
      targetsY.push(Math.round(edge / size) * size);
    }
  }

  const guides: SnapGuide[] = [];
  let bestX: { delta: number; position: number } | null = null;
  let bestY: { delta: number; position: number } | null = null;

  // Each edge of the moving box is tested against each target; the closest
  // match within the threshold wins.
  const movingX = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
  const movingY = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];

  for (const target of targetsX) {
    for (const edge of movingX) {
      const delta = target - edge;
      if (Math.abs(delta) > threshold) continue;
      if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) {
        bestX = { delta, position: target };
      }
    }
  }

  for (const target of targetsY) {
    for (const edge of movingY) {
      const delta = target - edge;
      if (Math.abs(delta) > threshold) continue;
      if (!bestY || Math.abs(delta) < Math.abs(bestY.delta)) {
        bestY = { delta, position: target };
      }
    }
  }

  if (bestX) guides.push({ axis: "x", position: bestX.position });
  if (bestY) guides.push({ axis: "y", position: bestY.position });

  return {
    x: rect.x + (bestX?.delta ?? 0),
    y: rect.y + (bestY?.delta ?? 0),
    guides,
  };
}

/* -------------------------------------------------------------------------- */
/* Rulers                                                                     */
/* -------------------------------------------------------------------------- */

export interface RulerTick {
  /** Screen position along the ruler. */
  position: number;
  /** Document coordinate at that position. */
  value: number;
  major: boolean;
}

/**
 * Chooses a tick interval that stays legible at any zoom.
 *
 * Steps follow a 1–2–5 progression, the standard choice for rulers and chart
 * axes because every step divides cleanly into the next.
 */
export function rulerStep(zoom: number): { minor: number; major: number } {
  const targetScreenSpacing = 8;
  const raw = targetScreenSpacing / zoom;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const normalized = raw / magnitude;
  const minor = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  return { minor, major: minor * 10 };
}

/** Ticks covering a ruler of `length` screen pixels. */
export function rulerTicks(
  view: Viewport,
  axis: "x" | "y",
  length: number
): RulerTick[] {
  const { minor, major } = rulerStep(view.zoom);
  const pan = axis === "x" ? view.panX : view.panY;
  const startValue = Math.floor(-pan / view.zoom / minor) * minor;
  const endValue = (length - pan) / view.zoom;

  const ticks: RulerTick[] = [];
  // Hard cap: a very small zoom with a very large canvas would otherwise
  // generate an unbounded list.
  const maxTicks = 2000;

  for (let value = startValue, i = 0; value <= endValue && i < maxTicks; value += minor, i++) {
    const position = value * view.zoom + pan;
    if (position < -minor * view.zoom || position > length + minor * view.zoom) continue;
    // Floating point accumulation makes an exact modulo test unreliable.
    const isMajor = Math.abs(value % major) < minor / 100 || Math.abs(Math.abs(value % major) - major) < minor / 100;
    ticks.push({ position, value, major: isMajor });
  }

  return ticks;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

/** Normalises a drag between two points into a positive-area rectangle. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Clamps a rectangle so it stays inside the canvas. */
export function clampRectToDocument(rect: Rect, doc: { width: number; height: number }): Rect {
  const width = Math.max(1, Math.min(rect.width, doc.width));
  const height = Math.max(1, Math.min(rect.height, doc.height));
  return {
    x: Math.max(0, Math.min(rect.x, doc.width - width)),
    y: Math.max(0, Math.min(rect.y, doc.height - height)),
    width,
    height,
  };
}

/** Applies an aspect ratio to a rectangle, keeping its centre. */
export function applyAspectRatio(rect: Rect, ratio: number | null): Rect {
  if (!ratio || ratio <= 0) return rect;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  // Preserve area so the crop box does not jump in size when a ratio is
  // chosen; only its proportions change.
  const area = Math.max(1, rect.width * rect.height);
  const height = Math.sqrt(area / ratio);
  const width = height * ratio;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
