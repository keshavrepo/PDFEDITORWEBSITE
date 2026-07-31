/**
 * ImagePilot editor document model.
 *
 * The model is deliberately plain JSON: layers hold geometry, styling and
 * adjustment values, while pixel data lives outside the document in a raster
 * store keyed by `sourceId`. Keeping bitmaps out of the document makes history
 * snapshots cheap (a structural clone of a few kilobytes) and lets the same
 * document be rendered by the browser canvas and by the headless test
 * renderer without change.
 */

/* -------------------------------------------------------------------------- */
/* Adjustments                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Non-destructive image operations applied to a single layer.
 *
 * Every value is stored in the same units the UI shows, so a panel slider maps
 * straight onto a field with no translation layer in between.
 */
export interface Adjustments {
  /** -100..100, additive lift applied after exposure. */
  brightness: number;
  /** -100..100, classic S-curve around mid grey. */
  contrast: number;
  /** -100..100, chroma scaling around luminance. */
  saturation: number;
  /** -180..180 degrees of hue rotation. */
  hue: number;
  /** -3..3 stops. */
  exposure: number;
  /** -100..100, negative cools (blue), positive warms (amber). */
  temperature: number;
  /** -100..100, negative green, positive magenta. */
  tint: number;
  /** 0.1..3, values below 1 darken midtones. */
  gamma: number;
  /** -100..100, lifts or crushes the dark end only. */
  shadows: number;
  /** -100..100, recovers or blows out the bright end only. */
  highlights: number;
  /** 0..100, Gaussian blur radius as a percentage of the maximum. */
  blur: number;
  /** 0..100, unsharp mask amount. */
  sharpen: number;
  /** 0..100, blend towards luminance. */
  grayscale: number;
  /** 0..100, blend towards the negative. */
  invert: number;
  /** 0..100, blend towards the sepia matrix. */
  sepia: number;
  /** 0..255 cut point; only applied when `thresholdEnabled` is set. */
  threshold: number;
  thresholdEnabled: boolean;
  /** 0..100, edge-preserving median blend. */
  noiseReduction: number;
}

export const defaultAdjustments: Readonly<Adjustments> = Object.freeze({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  gamma: 1,
  shadows: 0,
  highlights: 0,
  blur: 0,
  sharpen: 0,
  grayscale: 0,
  invert: 0,
  sepia: 0,
  threshold: 128,
  thresholdEnabled: false,
  noiseReduction: 0,
});

/** Metadata describing every adjustment, used to build the panel generically. */
export interface AdjustmentDescriptor {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Value that counts as "off"; the reset button restores it. */
  neutral: number;
  /** Optional unit suffix shown next to the value. */
  unit?: string;
  group: "light" | "colour" | "detail" | "stylise";
}

/* -------------------------------------------------------------------------- */
/* Layers                                                                     */
/* -------------------------------------------------------------------------- */

export type LayerType = "image" | "text" | "shape";

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  /** Hidden layers are skipped when rendering and exporting. */
  visible: boolean;
  /** Locked layers cannot be moved, transformed or deleted from the canvas. */
  locked: boolean;
  /** 0..1. */
  opacity: number;
  blendMode: BlendMode;
  /** Left edge in document coordinates, before rotation. */
  x: number;
  /** Top edge in document coordinates, before rotation. */
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, around the layer centre. */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  adjustments: Adjustments;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  /** Key into the raster store. */
  sourceId: string;
  /** Intrinsic pixel size of the source, used for "reset to original size". */
  naturalWidth: number;
  naturalHeight: number;
}

export type TextAlign = "left" | "center" | "right";

export interface TextShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  /** Extra tracking in pixels, may be negative. */
  letterSpacing: number;
  /** Multiplier applied to the font size. */
  lineHeight: number;
  align: TextAlign;
  color: string;
  strokeColor: string;
  /** 0 disables the stroke. */
  strokeWidth: number;
  shadow: TextShadow;
  /**
   * When true the layer box tracks the measured text, which is what users
   * expect until they explicitly resize the box.
   */
  autoSize: boolean;
}

export type ShapeKind =
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "polygon"
  | "star";

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  /** Shapes with no fill are stroke-only outlines. */
  fillEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  /** Rectangles only. Clamped to half the shorter side when rendering. */
  cornerRadius: number;
  /** Polygons and stars: 3..24. */
  sides: number;
  /** Stars only: 0.1..0.9 as a fraction of the outer radius. */
  innerRadius: number;
  /** Arrows only: head length as a fraction of the shape's longest side. */
  arrowHeadSize: number;
}

export type Layer = ImageLayer | TextLayer | ShapeLayer;

/* -------------------------------------------------------------------------- */
/* Document                                                                   */
/* -------------------------------------------------------------------------- */

export interface EditorDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  /** CSS colour, or null for a transparent canvas. */
  background: string | null;
  /** Bottom-most layer first, matching painter's order. */
  layers: Layer[];
}

/** Rectangular pixel selection in document coordinates. */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* -------------------------------------------------------------------------- */
/* Raster sources                                                             */
/* -------------------------------------------------------------------------- */

/** Anything `CanvasRenderingContext2D.drawImage` accepts. */
export type DrawableSource = CanvasImageSource;

export interface RasterSource {
  id: string;
  width: number;
  height: number;
  image: DrawableSource;
}

/** Read-only view of the raster store handed to the renderer. */
export interface RasterLookup {
  get(id: string): RasterSource | undefined;
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                      */
/* -------------------------------------------------------------------------- */

export type EditorToolId =
  | "move"
  | "select"
  | "crop"
  | "text"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "polygon"
  | "star"
  | "hand"
  | "zoom";

export type ExportFormat = "png" | "jpeg" | "webp" | "svg";

/** Handle identifiers for the transform box, in reading order. */
export type TransformHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
