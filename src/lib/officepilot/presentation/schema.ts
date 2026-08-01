/**
 * OfficePilot Presentation document schema.
 *
 * A presentation is a list of slides. Each slide has a title, a body
 * (rich content with text, images, shapes, tables and notes), a
 * background, theme metadata and a transition. The schema is small
 * enough to round-trip through a typed emitter that produces a real
 * PPTX via `pptxgenjs`.
 */

/** A presentation theme. Themes are shared across the whole deck. */
export type PresentationTheme =
  | "minimal"
  | "bold"
  | "editorial"
  | "corporate"
  | "midnight"
  | "sunset";

/** A slide transition. */
export type PresentationTransition = "none" | "fade" | "slide" | "zoom" | "push";

/** A text-style run. */
export interface PresentationRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  font?: string;
  href?: string;
}

/** A presentation shape kind. */
export type PresentationShapeKind =
  | "rectangle"
  | "rounded-rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "triangle";

/** A shape on a slide. */
export interface PresentationShape {
  id: string;
  type: "shape";
  kind: PresentationShapeKind;
  /** Position in slide coordinates (percentage of slide width/height, 0-100). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Fill colour, hex. */
  fill?: string;
  /** Stroke colour, hex. */
  stroke?: string;
  /** Stroke width in points. */
  strokeWidth?: number;
  /** Optional text inside the shape. */
  text?: PresentationRun[];
}

/** An image on a slide. */
export interface PresentationImage {
  id: string;
  type: "image";
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A table on a slide. */
export interface PresentationTable {
  id: string;
  type: "table";
  x: number;
  y: number;
  width: number;
  /** 2D array of cell strings. */
  rows: string[][];
  /** First row is treated as a header. */
  header: boolean;
  /** Optional header fill colour, hex. */
  headerFill?: string;
}

/** A content block on a slide. */
export type PresentationBlock =
  | { id: string; type: "text"; runs: PresentationRun[] }
  | { id: string; type: "bullets"; items: PresentationRun[][] }
  | PresentationShape
  | PresentationImage
  | PresentationTable;

/** A presentation slide. */
export interface PresentationSlide {
  id: string;
  /** Slide title shown in the deck outline. */
  title: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** Content blocks rendered in reading order. */
  blocks: PresentationBlock[];
  /** Background override. */
  background?: PresentationBackground;
  /** Per-slide transition. */
  transition: PresentationTransition;
  /** Speaker notes. */
  notes: string;
  /** Optional layout name (e.g. "title", "section", "content"). */
  layout: string;
}

/** A presentation background. */
export interface PresentationBackground {
  kind: "color" | "gradient";
  /** Color or first gradient stop. */
  color: string;
  /** Optional second gradient stop. */
  color2?: string;
  /** Gradient angle in degrees. */
  angle?: number;
}

/** Deck-level settings. */
export interface PresentationDeckSettings {
  theme: PresentationTheme;
  /** Default font family for the deck. */
  fontFamily: string;
  /** Default font colour. */
  fontColor: string;
  /** Default background. */
  background: PresentationBackground;
  /** Aspect ratio: "16:9" or "4:3". */
  aspect: "16:9" | "4:3";
}

/** The body of a presentation document. */
export interface PresentationBody {
  format: "presentation";
  slides: PresentationSlide[];
  settings: PresentationDeckSettings;
}

/** Document-wide statistics. */
export interface PresentationStats {
  slideCount: number;
  totalBlocks: number;
  totalWords: number;
  totalCharacters: number;
  imageCount: number;
  shapeCount: number;
  tableCount: number;
}

/** A type guard. */
export function isPresentationBody(body: unknown): body is PresentationBody {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as { format?: unknown; slides?: unknown; settings?: unknown };
  if (candidate.format !== "presentation") return false;
  if (!Array.isArray(candidate.slides)) return false;
  if (typeof candidate.settings !== "object" || candidate.settings === null) return false;
  return true;
}

/** The default deck settings. */
export const DEFAULT_DECK_SETTINGS: PresentationDeckSettings = {
  theme: "minimal",
  fontFamily: "Inter",
  fontColor: "#0a0a0a",
  background: { kind: "color", color: "#ffffff" },
  aspect: "16:9",
};

/** Theme palettes. */
export const PRESENTATION_THEMES: Record<
  PresentationTheme,
  { name: string; background: PresentationBackground; fontColor: string; accent: string }
> = {
  minimal: {
    name: "Minimal",
    background: { kind: "color", color: "#ffffff" },
    fontColor: "#0a0a0a",
    accent: "#0a0a0a",
  },
  bold: {
    name: "Bold",
    background: { kind: "color", color: "#0a0a0a" },
    fontColor: "#fafafa",
    accent: "#facc15",
  },
  editorial: {
    name: "Editorial",
    background: { kind: "color", color: "#faf7f2" },
    fontColor: "#1c1917",
    accent: "#a16207",
  },
  corporate: {
    name: "Corporate",
    background: { kind: "color", color: "#0f172a" },
    fontColor: "#f1f5f9",
    accent: "#38bdf8",
  },
  midnight: {
    name: "Midnight",
    background: { kind: "gradient", color: "#0f172a", color2: "#1e1b4b", angle: 135 },
    fontColor: "#e2e8f0",
    accent: "#a78bfa",
  },
  sunset: {
    name: "Sunset",
    background: { kind: "gradient", color: "#fde68a", color2: "#fb923c", angle: 135 },
    fontColor: "#1c1917",
    accent: "#dc2626",
  },
};

/** Default starting slide. */
export function createDefaultSlide(): PresentationSlide {
  return {
    id: `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: "Untitled slide",
    subtitle: "",
    blocks: [{ id: `block-${Date.now().toString(36)}`, type: "text", runs: [{ text: "Click to add content" }] }],
    transition: "fade",
    notes: "",
    layout: "content",
  };
}

/** The default body. */
export const DEFAULT_PRESENTATION_BODY: PresentationBody = {
  format: "presentation",
  slides: [createDefaultSlide()],
  settings: { ...DEFAULT_DECK_SETTINGS },
};

/** Coerces an unknown body into a PresentationBody. */
export function asPresentationBody(body: unknown): PresentationBody {
  if (isPresentationBody(body)) return body;
  return {
    format: "presentation",
    slides: [createDefaultSlide()],
    settings: { ...DEFAULT_DECK_SETTINGS },
  };
}
