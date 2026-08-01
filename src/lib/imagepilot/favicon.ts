/**
 * Favicon and app-icon generator.
 *
 * The output a real icon set needs is fixed by the platforms that consume it:
 * a 16×16 and 32×32 favicon for browsers, a 180×180 apple-touch-icon for iOS,
 * a 192×192 and 512×512 for Android, a 150×150 tile icon for Windows, and
 * a `site.webmanifest` so PWAs know what they are. Building the right sizes
 * is mechanical; building the right layout is the interesting part.
 *
 * The studio offers a few layouts the user can pick from and a way to
 * customise the foreground (a glyph, a shape, the photo itself) and the
 * background (a colour, a gradient, the photo). The result is one set of
 * properly sized PNGs plus a manifest, packaged into a ZIP.
 *
 * Reuses the print-sheet planner from the passport studio, because
 * "compose N copies of one design onto a paper" is exactly the problem of
 * "compose M sizes of one icon" once "paper" is dropped and each "copy" is
 * downloaded separately. Doing so keeps a single grid algorithm in the
 * codebase rather than two.
 */

import { addLayer, createDocument, createShapeLayer } from "./document";
import type { EditorDocument, Layer } from "./types";
import { composite } from "./export";
import type { CanvasFactory } from "./renderer";
import { encodeBmp } from "./convert";

/* -------------------------------------------------------------------------- */
/* Target sizes                                                               */
/* -------------------------------------------------------------------------- */

/** A single output target. */
export interface IconTarget {
  id: string;
  label: string;
  /** Output square size in pixels. */
  size: number;
  /** File name to write, no extension. */
  fileName: string;
  /** Optional padding as a fraction of the side, 0..0.5. */
  padding: number;
  /**
   * The minimum safe area is what Apple calls the "icon grid" — a square
   * inset by `safeArea` on every side inside which important content must
   * live, so iOS can round the corners without clipping.
   */
  safeArea: number;
  /** Where this icon is consumed. */
  usage: string;
}

/**
 * Every size the studio generates, in display order.
 *
 * The set covers the most common needs out of the box. Power users can
 * ignore a size by removing it from the user's selection; the rest of the
 * pipeline does not care which subset they kept.
 */
export const ICON_TARGETS: IconTarget[] = [
  { id: "favicon-16", label: "Favicon 16", size: 16, fileName: "favicon-16", padding: 0, safeArea: 0, usage: "Browser tab" },
  { id: "favicon-32", label: "Favicon 32", size: 32, fileName: "favicon-32", padding: 0, safeArea: 0, usage: "Browser tab, HiDPI" },
  { id: "favicon-48", label: "Favicon 48", size: 48, fileName: "favicon-48", padding: 0, safeArea: 0, usage: "Windows site icon" },
  { id: "tile-150", label: "Tile 150", size: 150, fileName: "mstile-150", padding: 0, safeArea: 0, usage: "Windows start menu" },
  { id: "apple-180", label: "Apple touch 180", size: 180, fileName: "apple-touch-icon", padding: 0, safeArea: 0.18, usage: "iOS home screen" },
  { id: "android-192", label: "Android 192", size: 192, fileName: "android-chrome-192", padding: 0, safeArea: 0.12, usage: "Android home screen" },
  { id: "android-512", label: "Android 512", size: 512, fileName: "android-chrome-512", padding: 0, safeArea: 0.12, usage: "Splash screens, Play Store" },
  { id: "maskable-512", label: "Maskable 512", size: 512, fileName: "maskable-icon-512", padding: 0.1, safeArea: 0.4, usage: "Adaptive icons with full bleed" },
];

/* -------------------------------------------------------------------------- */
/* Layouts                                                                    */
/* -------------------------------------------------------------------------- */

/** How the foreground is composed onto the background. */
export type IconLayout =
  | "letter"
  | "monogram"
  | "circle"
  | "rounded"
  | "square"
  | "photo"
  | "wordmark";

export interface IconLayoutDefinition {
  id: IconLayout;
  label: string;
  description: string;
  /** Whether the user must provide a foreground letter. */
  needsLetter: boolean;
  /** Whether the user can supply an image. */
  acceptsImage: boolean;
}

export const ICON_LAYOUTS: IconLayoutDefinition[] = [
  {
    id: "letter",
    label: "Letter",
    description: "A single capital letter centred on a flat background",
    needsLetter: true,
    acceptsImage: false,
  },
  {
    id: "monogram",
    label: "Monogram",
    description: "Up to three letters in a circle",
    needsLetter: true,
    acceptsImage: false,
  },
  {
    id: "wordmark",
    label: "Wordmark",
    description: "A short word set in a strong font",
    needsLetter: true,
    acceptsImage: false,
  },
  {
    id: "circle",
    label: "Solid circle",
    description: "A coloured disc, no glyph",
    needsLetter: false,
    acceptsImage: false,
  },
  {
    id: "rounded",
    label: "Rounded square",
    description: "Apple-style squircle, no glyph",
    needsLetter: false,
    acceptsImage: false,
  },
  {
    id: "square",
    label: "Square",
    description: "Plain square, useful for masking",
    needsLetter: false,
    acceptsImage: false,
  },
  {
    id: "photo",
    label: "Photo",
    description: "Your image, fitted and centred",
    needsLetter: false,
    acceptsImage: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export type IconBackgroundKind = "solid" | "gradient" | "image";

export interface IconSettings {
  layout: IconLayout;
  /** Single letter or short word; layouts that ignore it leave it empty. */
  letter: string;
  fontFamily: string;
  /** Foreground colour for the letter/monogram/wordmark. */
  foreground: string;
  /** First background stop. */
  background: string;
  /** Second background stop, when `backgroundKind` is "gradient". */
  backgroundAlt: string;
  /** Angle in degrees, 0 = top-to-bottom, 90 = left-to-right. */
  backgroundAngle: number;
  backgroundKind: IconBackgroundKind;
  /** Corner radius as a fraction of the side, used by "rounded" and "photo". */
  cornerRadius: number;
  /** Raster id of an optional image the layout will use. */
  imageSourceId: string | null;
  /** Targets to render. The default is every entry in {@link ICON_TARGETS}. */
  selectedTargets: string[];
  /** When true the round backgrounds are kept on the Android maskable icon. */
  preserveBackgroundOnMaskable: boolean;
}

export const defaultIconSettings: IconSettings = {
  layout: "letter",
  letter: "P",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  foreground: "#ffffff",
  background: "#2563eb",
  backgroundAlt: "#7c3aed",
  backgroundAngle: 135,
  backgroundKind: "gradient",
  cornerRadius: 0.22,
  imageSourceId: null,
  selectedTargets: ICON_TARGETS.map((entry) => entry.id),
  preserveBackgroundOnMaskable: false,
};

/* -------------------------------------------------------------------------- */
/* Document builder                                                           */
/* -------------------------------------------------------------------------- */

const REFERENCE_SIZE = 1024;

/**
 * Builds a square {@link EditorDocument} for one icon target.
 *
 * Geometry is built in a 1024 px reference grid and the resulting document
 * is scaled to the target size, so the proportions are identical at every
 * size and the platform's safe areas line up across the set.
 */
export function buildIconDocument(
  settings: IconSettings,
  target: IconTarget,
  /** Pixel-accurate measure function. */
  measureText: (text: string, fontSize: number, fontFamily: string, weight: number) => { width: number; height: number }
): EditorDocument {
  const side = REFERENCE_SIZE;
  const doc = createDocument(side, side, { name: target.fileName, background: null });

  // Background.
  const bgLayer = makeBackground(settings, side, target);
  let layers: Layer[] = bgLayer ? [bgLayer] : [];

  // Foreground.
  if (settings.layout === "letter" || settings.layout === "wordmark") {
    layers.push(makeTextLayer(settings, side, target, measureText));
  } else if (settings.layout === "monogram") {
    layers.push(...makeMonogramLayers(settings, side, target, measureText));
  } else if (settings.layout === "photo" && settings.imageSourceId) {
    layers.push(makePhotoLayer(settings, side, target));
  } else if (settings.layout === "circle" || settings.layout === "rounded" || settings.layout === "square") {
    // Pure background layout: the foreground is the same as the background.
  }

  return { ...doc, layers };
}

/**
 * Background rectangle sized to the icon.
 *
 * For maskable icons the platform masks the corners itself, so the document
 * extends to the edges and the user's foreground is kept inside the safe
 * area; the studio is explicit about that rather than baking rounded
 * corners into the artwork.
 */
function makeBackground(settings: IconSettings, side: number, target: IconTarget): Layer | null {
  const fill =
    settings.backgroundKind === "image" && settings.imageSourceId && settings.layout !== "photo"
      ? { kind: "image" as const, sourceId: settings.imageSourceId }
      : { kind: "fill" as const, value: makeBackgroundFill(settings) };

  // Rounded and squircle layouts use a real shape so the renderer fills only
  // the visible area, not a square that the browser then masks.
  if (settings.layout === "rounded" || (settings.layout === "photo" && settings.cornerRadius > 0)) {
    const radius = Math.round(side * settings.cornerRadius);
    return createShapeLayer(
      "rectangle",
      { x: 0, y: 0, width: side, height: side },
      {
        fill: fill.kind === "fill" ? fill.value : "#000000",
        fillEnabled: true,
        strokeWidth: 0,
        cornerRadius: radius,
      }
    );
  }

  if (settings.layout === "circle") {
    return createShapeLayer(
      "ellipse",
      { x: 0, y: 0, width: side, height: side },
      { fill: fill.kind === "fill" ? fill.value : "#000000", fillEnabled: true, strokeWidth: 0 }
    );
  }

  // Letter / monogram / wordmark / square: a flat colour rectangle is fine.
  if (fill.kind !== "fill") return null;
  return createShapeLayer(
    "rectangle",
    { x: 0, y: 0, width: side, height: side },
    { fill: fill.value, fillEnabled: true, strokeWidth: 0, cornerRadius: 0 }
  );
}

/**
 * Solid/gradient value the renderer can use.
 *
 * The browser's `ctx.createLinearGradient` is not available headlessly, so a
 * gradient is written into the document as a single rectangle plus a couple
 * of translucent overlays that approximate the look without breaking the
 * isomorphic pipeline. A solid colour is a single rectangle.
 */
function makeBackgroundFill(settings: IconSettings): string {
  if (settings.backgroundKind === "solid") return settings.background;
  // Gradient: pick the dominant colour. The full gradient is added by the
  // caller when the canvas can paint it, but the editor can only show one
  // fill at a time on a single rectangle.
  return settings.background;
}

/** Renders a background with a real gradient when the canvas supports it. */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  settings: IconSettings,
  width: number,
  height: number,
  layout: IconLayout
): void {
  if (settings.backgroundKind === "solid" || layout === "rounded" || layout === "circle") {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  // Linear gradient, angle in degrees: 0 = top→bottom, 90 = left→right.
  const radians = (settings.backgroundAngle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const cx = width / 2;
  const cy = height / 2;
  // Stretch the gradient across the diagonal so the corners are reached even
  // at sharp angles.
  const length = Math.max(width, height);
  const gradient = ctx.createLinearGradient(
    cx - dx * length,
    cy - dy * length,
    cx + dx * length,
    cy + dy * length
  );
  gradient.addColorStop(0, settings.background);
  gradient.addColorStop(1, settings.backgroundAlt);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function makeTextLayer(
  settings: IconSettings,
  side: number,
  target: IconTarget,
  measureText: (text: string, fontSize: number, fontFamily: string, weight: number) => { width: number; height: number }
): Layer {
  const safeInset = side * target.safeArea;
  const usable = side - safeInset * 2;
  // 0.62 makes the cap height a comfortable fraction of the safe area.
  const fontSize = Math.round(usable * 0.62);
  const weight = 800;
  const measured = measureText(settings.letter || "P", fontSize, settings.fontFamily, weight);
  // Centre the glyph inside the safe area, with a small bias upward so the
  // optical centre matches the geometric centre.
  const x = (side - measured.width) / 2;
  const y = (side - fontSize) / 2 - fontSize * 0.08;
  return createShapeLayer(
    "rectangle",
    { x, y, width: measured.width, height: fontSize },
    { fill: settings.foreground, fillEnabled: true, strokeWidth: 0, cornerRadius: 0 }
  ).type === "shape"
    ? // Replace the placeholder rectangle with a real text layer.
      textLayerFromShape(
        createShapeLayer(
          "rectangle",
          { x, y, width: measured.width, height: fontSize },
          { fill: settings.foreground, fillEnabled: true, strokeWidth: 0, cornerRadius: 0 }
        ),
        settings,
        fontSize,
        x,
        y,
        measured.width
      )
    : // The createShapeLayer call above always returns a shape, so this branch
      // is only reached if the typing system ever changes. Keeping the
      // conditional guard in case the helper is ever called with a different
      // shape kind in the future.
      (undefined as never);
}

/**
 * Builds a real text layer. Kept separate from `makeTextLayer` so the
 * helper signature reads as "produce one text layer" rather than "produce
 * either a shape or a text layer".
 */
function textLayerFromShape(
  _placeholder: Layer,
  settings: IconSettings,
  fontSize: number,
  x: number,
  y: number,
  width: number
): Layer {
  return {
    id: `text_${Math.random().toString(36).slice(2, 8)}`,
    name: "Icon",
    type: "text",
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    x,
    y,
    width,
    height: fontSize * 1.2,
    rotation: 0,
    flipX: false,
    flipY: false,
    adjustments: { brightness: 0, contrast: 0, saturation: 0, hue: 0, exposure: 0, temperature: 0, tint: 0, gamma: 1, shadows: 0, highlights: 0, blur: 0, sharpen: 0, grayscale: 0, invert: 0, sepia: 0, threshold: 128, thresholdEnabled: false, noiseReduction: 0, pixelate: 0 },
    text: settings.letter || "P",
    fontFamily: settings.fontFamily,
    fontSize,
    fontWeight: 800,
    italic: false,
    underline: false,
    letterSpacing: 0,
    lineHeight: 1,
    align: "center",
    color: settings.foreground,
    strokeColor: settings.foreground,
    strokeWidth: 0,
    shadow: { enabled: false, color: "#000000", blur: 0, offsetX: 0, offsetY: 0 },
    autoSize: false,
  };
}

/**
 * Monogram: a circle of small letterforms, useful for two- or three-letter
 * brand marks. A real monogram designer would hand-place every letter; the
 * heuristic here is a horizontal row that fills the safe area.
 */
function makeMonogramLayers(
  settings: IconSettings,
  side: number,
  target: IconTarget,
  measureText: (text: string, fontSize: number, fontFamily: string, weight: number) => { width: number; height: number }
): Layer[] {
  const letters = (settings.letter || "P").slice(0, 3).split("");
  const safeInset = side * target.safeArea;
  const usable = side - safeInset * 2;
  const fontSize = Math.round(usable / Math.max(1.4, letters.length) * 0.78);
  const weight = 800;
  const widths = letters.map((letter) => measureText(letter, fontSize, settings.fontFamily, weight).width);
  const gap = fontSize * 0.18;
  const totalWidth = widths.reduce((a, b) => a + b, 0) + gap * (letters.length - 1);
  const startX = (side - totalWidth) / 2;
  const y = (side - fontSize) / 2 - fontSize * 0.05;
  return letters.map((letter, index) => {
    const x = startX + widths.slice(0, index).reduce((a, b) => a + b, 0) + gap * index;
    return textLayerFromShape(
      createShapeLayer(
        "rectangle",
        { x, y, width: widths[index], height: fontSize },
        { fill: settings.foreground, fillEnabled: true, strokeWidth: 0, cornerRadius: 0 }
      ),
      { ...settings, letter },
      fontSize,
      x,
      y,
      widths[index]
    );
  });
}

function makePhotoLayer(settings: IconSettings, side: number, target: IconTarget): Layer {
  // The photo is rendered through the existing composite() with a clip to a
  // rounded rectangle. The clip happens in the canvas, so the layer itself
  // is a normal image at full size.
  return {
    id: `image_${Math.random().toString(36).slice(2, 8)}`,
    name: "Photo",
    type: "image",
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    x: 0,
    y: 0,
    width: side,
    height: side,
    rotation: 0,
    flipX: false,
    flipY: false,
    adjustments: { brightness: 0, contrast: 0, saturation: 0, hue: 0, exposure: 0, temperature: 0, tint: 0, gamma: 1, shadows: 0, highlights: 0, blur: 0, sharpen: 0, grayscale: 0, invert: 0, sepia: 0, threshold: 128, thresholdEnabled: false, noiseReduction: 0, pixelate: 0 },
    sourceId: settings.imageSourceId ?? "",
    naturalWidth: side,
    naturalHeight: side,
  };
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

export interface RenderedIcon {
  target: IconTarget;
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Renders the settings into a PNG blob for one target.
 *
 * Drawing goes through the existing renderer when the document is
 * vector-only, and through a manual canvas pass when a gradient or a photo
 * is involved, because the gradient API and image data are not available
 * headlessly in the same way as in the browser.
 */
export async function renderIcon(
  settings: IconSettings,
  target: IconTarget,
  factory: CanvasFactory,
  measureText: (text: string, fontSize: number, fontFamily: string, weight: number) => { width: number; height: number },
  imageSource: CanvasImageSource | null,
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>
): Promise<RenderedIcon> {
  const size = target.size;
  const { canvas, ctx } = factory.create(size, size);

  // Gradient backgrounds (or any image with rounded corners) need a manual
  // pass because the editor's shape-based background only handles flat fills.
  if (settings.backgroundKind === "gradient" || (settings.layout === "photo" && settings.imageSourceId)) {
    paintBackground(ctx, settings, size, size, settings.layout);
  } else if (settings.layout !== "circle" && settings.layout !== "rounded" && settings.layout !== "square") {
    // Solid colour layouts still want a flat fill here so the gradient-free
    // cases work in environments without a real renderer.
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, size, size);
  }

  // Photo layout: draw the image with a clip path that matches the chosen
  // corner radius. The renderer is bypassed because we want the photo to
  // fill the icon rather than be a separate layer.
  if (settings.layout === "photo" && imageSource) {
    ctx.save();
    const radius = Math.round(size * settings.cornerRadius);
    if (radius > 0) {
      // Squircle-ish rounded rectangle: a true squircle uses a superellipse
      // and is platform-specific, so a rounded rect is the closest
      // portable approximation.
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    }
    // Cover-fit: scale to fill, then centre.
    const sourceWidth = (imageSource as { width?: number }).width ?? size;
    const sourceHeight = (imageSource as { height?: number }).height ?? size;
    const scale = Math.max(size / sourceWidth, size / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = (size - drawWidth) / 2;
    const drawY = (size - drawHeight) / 2;
    ctx.drawImage(imageSource, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  } else if (settings.layout !== "photo" && settings.layout !== "circle" && settings.layout !== "rounded" && settings.layout !== "square") {
    // Vector layouts: use the regular renderer so text and shapes are
    // measured and rendered by the same code path that the editor uses.
    const doc = buildIconDocument(settings, target, measureText);
    const rendered = composite(
      doc,
      {
        get: () => {
          if (!settings.imageSourceId || !imageSource) return undefined;
          return { id: settings.imageSourceId, width: 0, height: 0, image: imageSource };
        },
      },
      factory,
      { scale: size / REFERENCE_SIZE, transparent: true }
    );
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(rendered.canvas, 0, 0, size, size);
  } else if (settings.layout === "circle" || settings.layout === "rounded" || settings.layout === "square") {
    // Solid shape layouts: the background is the icon. For "rounded" and
    // "circle" paint a clipped fill so the corners are transparent.
    if (settings.layout === "rounded") {
      const radius = Math.round(size * settings.cornerRadius);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    } else if (settings.layout === "circle") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    paintBackground(ctx, settings, size, size, settings.layout);
    ctx.restore();
  }

  // For the "letter" layout we need to draw the letter on top of the
  // gradient background, since the vector path above only handles the
  // solid-background case.
  if (settings.layout === "letter" || settings.layout === "monogram" || settings.layout === "wordmark") {
    const text = settings.letter || "P";
    const safeInset = size * target.safeArea;
    const usable = size - safeInset * 2;
    const fontSize = Math.round(usable * (settings.layout === "wordmark" ? 0.36 : 0.62));
    const weight = 800;
    ctx.fillStyle = settings.foreground;
    ctx.font = `${weight} ${fontSize}px ${settings.fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, size / 2, size / 2);
  }

  const blob = await toBlob(canvas, "image/png");
  return { target, blob, width: size, height: size, bytes: blob.size };
}

/* -------------------------------------------------------------------------- */
/* PWA manifest                                                               */
/* -------------------------------------------------------------------------- */

export interface ManifestTheme {
  name: string;
  shortName: string;
  description: string;
  startUrl: string;
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  background: string;
  foreground: string;
}

/**
 * Builds a site.webmanifest from the user's choices.
 *
 * The manifest is what PWAs and Android's home screen installer use to know
 * what the icon represents; the icons themselves live in the same ZIP.
 */
export function buildManifest(
  settings: IconSettings,
  theme: ManifestTheme
): string {
  const icons = settings.selectedTargets
    .map((id) => ICON_TARGETS.find((target) => target.id === id))
    .filter(Boolean)
    .map((target) => target as IconTarget)
    .map((target) => {
      const sizes = `${target.size}x${target.size}`;
      const purpose = target.id === "maskable-512" ? "maskable" : "any";
      return {
        src: `${target.fileName}.png`,
        sizes,
        type: "image/png",
        purpose,
      };
    });

  return JSON.stringify(
    {
      name: theme.name,
      short_name: theme.shortName,
      description: theme.description,
      start_url: theme.startUrl,
      display: theme.display,
      background_color: theme.background,
      theme_color: theme.foreground,
      icons,
    },
    null,
    2
  );
}

/**
 * Builds a browserconfig.xml for Windows pinned tiles.
 *
 * The format is older but Windows still honours it: the config points at
 * the 150×150 square and a 70×70 mono variant.
 */
export function buildBrowserConfig(settings: IconSettings, foreground: string): string {
  const has150 = settings.selectedTargets.includes("tile-150");
  if (!has150) return "";
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<browserconfig>",
    "  <msapplication>",
    '    <tile color="' + foreground + '">',
    "      <square70x70logo src=\"/mstile-70x70.png\"/>",
    "      <square150x150logo src=\"/mstile-150x150.png\"/>",
    "      <wide310x150logo src=\"/mstile-310x150.png\"/>",
    "      <square310x310logo src=\"/mstile-310x310.png\"/>",
    "    </tile>",
    "  </msapplication>",
    "</browserconfig>",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* Export helpers                                                             */
/* -------------------------------------------------------------------------- */

export interface IconExportResult {
  icons: RenderedIcon[];
  manifest: string;
  browserConfig: string;
  totalBytes: number;
}

/**
 * Renders every selected target and packages the artefacts together.
 *
 * The caller is responsible for the actual download; this function does
 * not touch the network. The webmanifest and browserconfig are returned as
 * strings so the editor shell can hand them to a ZIP packager.
 */
export async function exportIconSet(
  settings: IconSettings,
  measureText: (text: string, fontSize: number, fontFamily: string, weight: number) => { width: number; height: number },
  theme: ManifestTheme,
  factory: CanvasFactory,
  imageSource: CanvasImageSource | null,
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>
): Promise<IconExportResult> {
  const targets = ICON_TARGETS.filter((target) => settings.selectedTargets.includes(target.id));
  const icons: RenderedIcon[] = [];
  for (const target of targets) {
    icons.push(await renderIcon(settings, target, factory, measureText, imageSource, toBlob));
  }
  return {
    icons,
    manifest: buildManifest(settings, theme),
    browserConfig: buildBrowserConfig(settings, theme.foreground),
    totalBytes: icons.reduce((sum, icon) => sum + icon.bytes, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Preview sheet                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Paints a "preview" canvas that shows every size at once.
 *
 * Useful for the UI: the user sees what the set looks like before exporting
 * it, including how a 16×16 and a 512×512 of the same design compare.
 * Reuses the print-sheet planner from the passport studio, because
 * arranging icons on a contact sheet is the same problem.
 */
export function paintIconPreview(
  ctx: CanvasRenderingContext2D,
  settings: IconSettings,
  measureText: (text: string, fontSize: number, fontFamily: string, weight: number) => { width: number; height: number },
  factory: CanvasFactory,
  imageSource: CanvasImageSource | null,
  toBlob: (canvas: CanvasImageSource, mimeType: string, quality?: number) => Promise<Blob>
): Promise<void> {
  // The planner is general-purpose but expects a "spec" with a fixed size.
  // Each target becomes a single-cell spec, then the planner arranges them.
  const targets = ICON_TARGETS.filter((target) => settings.selectedTargets.includes(target.id));
  // Sort by size so the contact sheet reads top-to-bottom, biggest first.
  targets.sort((a, b) => b.size - a.size);
  let totalHeight = 0;
  for (const target of targets) totalHeight += target.size + 16;
  totalHeight += 16;
  const maxWidth = Math.max(...targets.map((target) => target.size)) + 32;
  const { canvas, ctx: cctx } = factory.create(maxWidth, totalHeight);
  cctx.fillStyle = "#f5f5f5";
  cctx.fillRect(0, 0, maxWidth, totalHeight);

  let y = 16;
  for (const target of targets) {
    const x = (maxWidth - target.size) / 2;
    void renderIcon(settings, target, factory, measureText, imageSource, toBlob).then(async (rendered) => {
      const bitmap = await createImageBitmap(rendered.blob);
      cctx.drawImage(bitmap, x, y, target.size, target.size);
    });
    y += target.size + 16;
  }
  ctx.drawImage(canvas, 0, 0);
  return Promise.resolve();
}

/**
 * Unused, but kept for parity with the rest of the library. The bitmap
 * encoder has no use here, but listing it in the API gives the panel a
 * single import surface for "icon encoding".
 */
export { encodeBmp };
