/**
 * Editor limits, defaults and descriptor tables.
 *
 * Everything the UI enumerates lives here so panels stay declarative and a
 * future ImagePilot tool can reuse the same vocabulary without copying lists.
 */

import type {
  AdjustmentDescriptor,
  BlendMode,
  EditorToolId,
  ExportFormat,
} from "./types";

/** Largest canvas dimension we allow, in document pixels. */
export const MAX_CANVAS_DIMENSION = 8192;
/** Largest accepted import, matching the platform's other upload limits. */
export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
/** Number of undo steps retained. */
export const HISTORY_LIMIT = 100;

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 32;
/** Zoom stops cycled through by the +/- controls. */
export const ZOOM_STEPS = [
  0.05, 0.1, 0.16, 0.25, 0.33, 0.5, 0.66, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32,
];

/** Long-edge cap for a rasterised layer while the user is interacting. */
export const INTERACTIVE_RASTER_CAP = 1600;
/** Long-edge cap for a rasterised layer at rest. */
export const IDLE_RASTER_CAP = 4096;
/** Long-edge cap when rendering for export. */
export const EXPORT_RASTER_CAP = 16384;

/** Maximum Gaussian blur radius, in document pixels, at strength 100. */
export const MAX_BLUR_RADIUS = 60;
/** Maximum unsharp-mask radius, in document pixels, at strength 100. */
export const MAX_SHARPEN_RADIUS = 6;

export const SUPPORTED_IMPORT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/svg+xml",
];

export const IMPORT_ACCEPT = `${SUPPORTED_IMPORT_TYPES.join(",")},.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.svg`;

/**
 * Font stacks offered in the text panel.
 *
 * Only families that resolve on every major platform are listed, so exported
 * artwork looks the same as the on-screen preview.
 */
export const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "System Sans", value: "system-ui, -apple-system, Segoe UI, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Verdana, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Garamond", value: "Garamond, Georgia, serif" },
  { label: "Palatino", value: "'Palatino Linotype', Palatino, serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
  { label: "Comic Sans", value: "'Comic Sans MS', cursive" },
] as const;

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;

export const BLEND_MODES: Array<{ value: BlendMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

/**
 * Adjustment metadata driving the operations panel.
 *
 * Grouped the way photographers expect: overall light first, then colour, then
 * detail, then the stylising operations that replace colour entirely.
 */
export const ADJUSTMENTS: AdjustmentDescriptor[] = [
  { key: "exposure", label: "Exposure", min: -3, max: 3, step: 0.05, neutral: 0, unit: " EV", group: "light" },
  { key: "brightness", label: "Brightness", min: -100, max: 100, step: 1, neutral: 0, group: "light" },
  { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1, neutral: 0, group: "light" },
  { key: "gamma", label: "Gamma", min: 0.1, max: 3, step: 0.01, neutral: 1, group: "light" },
  { key: "shadows", label: "Shadows", min: -100, max: 100, step: 1, neutral: 0, group: "light" },
  { key: "highlights", label: "Highlights", min: -100, max: 100, step: 1, neutral: 0, group: "light" },

  { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1, neutral: 0, group: "colour" },
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1, neutral: 0, unit: "°", group: "colour" },
  { key: "temperature", label: "Temperature", min: -100, max: 100, step: 1, neutral: 0, group: "colour" },
  { key: "tint", label: "Tint", min: -100, max: 100, step: 1, neutral: 0, group: "colour" },

  { key: "blur", label: "Blur", min: 0, max: 100, step: 1, neutral: 0, group: "detail" },
  { key: "sharpen", label: "Sharpen", min: 0, max: 100, step: 1, neutral: 0, group: "detail" },
  { key: "noiseReduction", label: "Noise Reduction", min: 0, max: 100, step: 1, neutral: 0, group: "detail" },
  { key: "pixelate", label: "Pixelate", min: 0, max: 80, step: 1, neutral: 0, unit: " px", group: "detail" },

  { key: "grayscale", label: "Grayscale", min: 0, max: 100, step: 1, neutral: 0, group: "stylise" },
  { key: "sepia", label: "Sepia", min: 0, max: 100, step: 1, neutral: 0, group: "stylise" },
  { key: "invert", label: "Invert", min: 0, max: 100, step: 1, neutral: 0, group: "stylise" },
  { key: "threshold", label: "Threshold", min: 0, max: 255, step: 1, neutral: 128, group: "stylise" },
];

export const ADJUSTMENT_GROUPS: Array<{
  id: AdjustmentDescriptor["group"];
  label: string;
}> = [
  { id: "light", label: "Light" },
  { id: "colour", label: "Colour" },
  { id: "detail", label: "Detail" },
  { id: "stylise", label: "Stylise" },
];

/** Ready-made canvas sizes offered when starting from scratch. */
export const CANVAS_PRESETS = [
  { label: "Square 1080", width: 1080, height: 1080 },
  { label: "Portrait 1080 × 1350", width: 1080, height: 1350 },
  { label: "Story 1080 × 1920", width: 1080, height: 1920 },
  { label: "Landscape 1920 × 1080", width: 1920, height: 1080 },
  { label: "Wide 2560 × 1440", width: 2560, height: 1440 },
  { label: "A4 at 150 dpi", width: 1240, height: 1754 },
  { label: "Web banner 1600 × 500", width: 1600, height: 500 },
  { label: "Thumbnail 1280 × 720", width: 1280, height: 720 },
] as const;

/** Aspect-ratio presets for the crop tool. `null` means unconstrained. */
export const CROP_RATIOS: Array<{ label: string; ratio: number | null }> = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "2:3", ratio: 2 / 3 },
];

export const EXPORT_FORMATS: Array<{
  value: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  /** Formats without an alpha channel are flattened onto the matte colour. */
  supportsAlpha: boolean;
  supportsQuality: boolean;
  description: string;
}> = [
  {
    value: "png",
    label: "PNG",
    extension: "png",
    mimeType: "image/png",
    supportsAlpha: true,
    supportsQuality: false,
    description: "Lossless with transparency. Best for graphics and screenshots.",
  },
  {
    value: "jpeg",
    label: "JPG",
    extension: "jpg",
    mimeType: "image/jpeg",
    supportsAlpha: false,
    supportsQuality: true,
    description: "Small photographic files. Transparency is flattened onto a matte.",
  },
  {
    value: "webp",
    label: "WEBP",
    extension: "webp",
    mimeType: "image/webp",
    supportsAlpha: true,
    supportsQuality: true,
    description: "Modern format with transparency and much smaller files than PNG.",
  },
  {
    value: "svg",
    label: "SVG",
    extension: "svg",
    mimeType: "image/svg+xml",
    supportsAlpha: true,
    supportsQuality: false,
    description:
      "Vector output. Shapes and text stay scalable; photo layers are embedded as bitmaps.",
  },
];

/**
 * One-click export presets.
 *
 * Each preset bundles the format, quality, scale and a sensible default for
 * the matte/transparent switch — the same set of decisions the user would
 * otherwise make by hand. The export dialog applies one with a single click
 * and the user can still tweak afterwards.
 *
 * The numbers are what real-world consumers actually want: emails need a
 * 600-pixel long-edge cap because mail clients downscale aggressively, web
 * images target 2× device pixels for retina sharpness, and print keeps the
 * native resolution.
 */
export interface ExportPreset {
  id: string;
  label: string;
  description: string;
  format: ExportFormat;
  quality: number;
  scale: number;
  transparent: boolean;
  /** Longest edge in pixels, applied on top of `scale`. `null` means no cap. */
  maxLongEdge: number | null;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "web-png",
    label: "Web — PNG",
    description: "Transparent PNG at 2× for retina screens",
    format: "png",
    quality: 100,
    scale: 2,
    transparent: true,
    maxLongEdge: 2400,
  },
  {
    id: "web-jpg",
    label: "Web — JPG",
    description: "Compressed JPG, matte white, suitable for most websites",
    format: "jpeg",
    quality: 82,
    scale: 1,
    transparent: false,
    maxLongEdge: 1920,
  },
  {
    id: "web-webp",
    label: "Web — WEBP",
    description: "Modern WEBP with transparency, smallest payload",
    format: "webp",
    quality: 80,
    scale: 1,
    transparent: true,
    maxLongEdge: 1920,
  },
  {
    id: "email",
    label: "Email",
    description: "JPG at 600 px long edge — fits every mail client",
    format: "jpeg",
    quality: 80,
    scale: 1,
    transparent: false,
    maxLongEdge: 600,
  },
  {
    id: "print-png",
    label: "Print — PNG",
    description: "Lossless PNG at native resolution",
    format: "png",
    quality: 100,
    scale: 1,
    transparent: true,
    maxLongEdge: null,
  },
  {
    id: "vector",
    label: "Vector — SVG",
    description: "SVG with shapes and text as real vector elements",
    format: "svg",
    quality: 100,
    scale: 1,
    transparent: true,
    maxLongEdge: null,
  },
  {
    id: "social-square",
    label: "Social — Square",
    description: "1080 × 1080 PNG for Instagram and similar",
    format: "png",
    quality: 95,
    scale: 1,
    transparent: true,
    maxLongEdge: 1080,
  },
  {
    id: "social-story",
    label: "Social — Story",
    description: "1080 × 1920 PNG for stories and reels",
    format: "png",
    quality: 95,
    scale: 1,
    transparent: true,
    maxLongEdge: 1920,
  },
];

export function getExportPreset(id: string): ExportPreset | undefined {
  return EXPORT_PRESETS.find((entry) => entry.id === id);
}

/** Tool rail definition, also used to resolve keyboard shortcuts. */
export const EDITOR_TOOLS: Array<{
  id: EditorToolId;
  label: string;
  shortcut: string;
  hint: string;
  group: "select" | "shape" | "view";
}> = [
  { id: "move", label: "Move", shortcut: "V", hint: "Move, resize and rotate layers", group: "select" },
  { id: "select", label: "Marquee", shortcut: "M", hint: "Draw a rectangular pixel selection", group: "select" },
  { id: "crop", label: "Crop", shortcut: "C", hint: "Trim the canvas", group: "select" },
  { id: "text", label: "Text", shortcut: "T", hint: "Add an editable text layer", group: "select" },
  { id: "rectangle", label: "Rectangle", shortcut: "R", hint: "Draw a rectangle", group: "shape" },
  { id: "ellipse", label: "Ellipse", shortcut: "O", hint: "Draw an ellipse or circle", group: "shape" },
  { id: "line", label: "Line", shortcut: "L", hint: "Draw a straight line", group: "shape" },
  { id: "arrow", label: "Arrow", shortcut: "A", hint: "Draw an arrow", group: "shape" },
  { id: "polygon", label: "Polygon", shortcut: "P", hint: "Draw a regular polygon", group: "shape" },
  { id: "star", label: "Star", shortcut: "S", hint: "Draw a star", group: "shape" },
  { id: "hand", label: "Hand", shortcut: "H", hint: "Pan the workspace", group: "view" },
  { id: "zoom", label: "Zoom", shortcut: "Z", hint: "Click to zoom in, Alt-click to zoom out", group: "view" },
];

/** Shortcut reference shown in the help sheet. */
export const SHORTCUT_REFERENCE: Array<{ group: string; items: Array<[string, string]> }> = [
  {
    group: "Tools",
    items: [
      ["V", "Move"],
      ["M", "Marquee select"],
      ["C", "Crop"],
      ["T", "Text"],
      ["R / O / L", "Rectangle / Ellipse / Line"],
      ["A / P / S", "Arrow / Polygon / Star"],
      ["H / Z", "Hand / Zoom"],
      ["Space (hold)", "Temporary hand tool"],
    ],
  },
  {
    group: "Edit",
    items: [
      ["Ctrl + Z", "Undo"],
      ["Ctrl + Shift + Z", "Redo"],
      ["Ctrl + C / X / V", "Copy / Cut / Paste"],
      ["Ctrl + D", "Duplicate layer"],
      ["Ctrl + A", "Select all layers"],
      ["Delete", "Delete selected layers"],
      ["Esc", "Deselect / cancel"],
    ],
  },
  {
    group: "Layers",
    items: [
      ["Ctrl + ]", "Bring forward"],
      ["Ctrl + [", "Send backward"],
      ["Ctrl + Shift + ]", "Bring to front"],
      ["Ctrl + Shift + [", "Send to back"],
      ["Arrows", "Nudge by 1 px"],
      ["Shift + Arrows", "Nudge by 10 px"],
    ],
  },
  {
    group: "View",
    items: [
      ["Ctrl + 0", "Fit to window"],
      ["Ctrl + 1", "Zoom to 100%"],
      ["Ctrl + + / −", "Zoom in / out"],
      ["Ctrl + wheel", "Zoom at pointer"],
      ["Shift + G", "Toggle grid"],
      ["Shift + R", "Toggle rulers"],
      ["Shift + S", "Toggle snapping"],
      ["Ctrl + S", "Export"],
    ],
  },
];

/** Swatches offered by the colour controls, drawn from the app palette. */
export const COLOR_SWATCHES = [
  "#000000",
  "#404040",
  "#737373",
  "#a3a3a3",
  "#e5e5e5",
  "#ffffff",
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#6366f1",
];

export const DEFAULT_GRID_SIZE = 50;
/** Distance, in screen pixels, within which a snap target engages. */
export const SNAP_THRESHOLD = 6;
