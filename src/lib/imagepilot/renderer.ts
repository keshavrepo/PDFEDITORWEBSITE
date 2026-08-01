/**
 * Canvas renderer.
 *
 * Draws an {@link EditorDocument} onto any 2D context. The code is written
 * against the standard `CanvasRenderingContext2D` surface only, so the browser
 * canvas and the Node test canvas run the exact same paths — which is what
 * lets the test suite assert on real pixels rather than on a mock.
 *
 * Adjustments are applied through the pixel pipeline rather than the CSS
 * `filter` property. `filter` support is inconsistent across browsers and
 * absent in workers, and several of the required operations (gamma, shadows,
 * highlights, temperature, threshold, noise reduction) have no CSS equivalent
 * at all.
 */

import { applyAdjustments, hasAdjustments } from "./adjustments";
import type {
  BlendMode,
  EditorDocument,
  ImageLayer,
  Layer,
  RasterLookup,
  ShapeLayer,
  TextLayer,
} from "./types";

/** Minimal 2D context surface the renderer relies on. */
type Ctx = CanvasRenderingContext2D;

/** Factory for offscreen buffers, supplied by the host environment. */
export interface CanvasFactory {
  create(width: number, height: number): { canvas: CanvasImageSource; ctx: Ctx };
}

export interface RenderOptions {
  /** Multiplies document coordinates; 1 renders at document resolution. */
  scale?: number;
  /** Skips the document background, producing a transparent result. */
  transparent?: boolean;
  /** Renders only these layer ids, in document order. */
  onlyLayers?: string[];
  /** Layer ids to skip, e.g. one being edited inline. */
  skipLayers?: string[];
  /** Required when any layer has spatial adjustments. */
  canvasFactory?: CanvasFactory;
  /**
   * Scale hint passed to spatial filters so a downscaled preview keeps blur
   * and sharpen radii visually consistent with the export.
   */
  filterScale?: number;
}

/* -------------------------------------------------------------------------- */
/* Text layout                                                                */
/* -------------------------------------------------------------------------- */

export interface TextLine {
  text: string;
  width: number;
}

export interface TextMetricsResult {
  lines: TextLine[];
  width: number;
  height: number;
  lineHeight: number;
}

/** Builds the canvas `font` shorthand for a text layer. */
export function textLayerFont(layer: TextLayer): string {
  const style = layer.italic ? "italic " : "";
  return `${style}${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
}

/**
 * Measures a string with letter spacing applied.
 *
 * `ctx.letterSpacing` is not available everywhere, so tracking is added
 * manually. Doing the arithmetic ourselves also keeps measurement and drawing
 * in agreement, which matters for centred and right-aligned text.
 */
export function measureTracked(ctx: Ctx, text: string, letterSpacing: number): number {
  if (!text) return 0;
  const base = ctx.measureText(text).width;
  if (!letterSpacing) return base;
  // Tracking sits between glyphs, so a run of n characters has n-1 gaps.
  return base + letterSpacing * Math.max(0, [...text].length - 1);
}

/**
 * Lays out a text layer.
 *
 * Explicit newlines always break. When the layer is not auto-sizing, lines are
 * additionally wrapped to the layer width so a resized text box reflows the
 * way users expect.
 */
export function measureTextLayer(ctx: Ctx, layer: TextLayer): TextMetricsResult {
  ctx.save();
  ctx.font = textLayerFont(layer);

  const lineHeight = layer.fontSize * layer.lineHeight;
  const lines: TextLine[] = [];
  const paragraphs = layer.text.split("\n");
  const wrapWidth = layer.autoSize ? Infinity : Math.max(1, layer.width);

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push({ text: "", width: 0 });
      continue;
    }

    const width = measureTracked(ctx, paragraph, layer.letterSpacing);
    if (width <= wrapWidth) {
      lines.push({ text: paragraph, width });
      continue;
    }

    // Greedy word wrap; a word longer than the box is broken by character so
    // it can never overflow silently.
    let current = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (!word) continue;
      const candidate = current + word;
      if (measureTracked(ctx, candidate, layer.letterSpacing) <= wrapWidth || !current.trim()) {
        current = candidate;
        continue;
      }
      lines.push({ text: current.trimEnd(), width: measureTracked(ctx, current.trimEnd(), layer.letterSpacing) });
      current = word.trimStart();
    }

    if (current) {
      let remainder = current;
      while (measureTracked(ctx, remainder, layer.letterSpacing) > wrapWidth && remainder.length > 1) {
        let cut = remainder.length - 1;
        while (cut > 1 && measureTracked(ctx, remainder.slice(0, cut), layer.letterSpacing) > wrapWidth) {
          cut -= 1;
        }
        const head = remainder.slice(0, cut);
        lines.push({ text: head, width: measureTracked(ctx, head, layer.letterSpacing) });
        remainder = remainder.slice(cut);
      }
      lines.push({ text: remainder, width: measureTracked(ctx, remainder, layer.letterSpacing) });
    }
  }

  if (!lines.length) lines.push({ text: "", width: 0 });

  ctx.restore();

  return {
    lines,
    width: Math.max(1, ...lines.map((line) => line.width)),
    height: Math.max(lineHeight, lines.length * lineHeight),
    lineHeight,
  };
}

/** Draws one line, honouring letter spacing by placing each glyph. */
function drawTrackedLine(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
  mode: "fill" | "stroke"
): void {
  if (!text) return;

  if (!letterSpacing) {
    if (mode === "fill") ctx.fillText(text, x, y);
    else ctx.strokeText(text, x, y);
    return;
  }

  let cursor = x;
  for (const char of text) {
    if (mode === "fill") ctx.fillText(char, cursor, y);
    else ctx.strokeText(char, cursor, y);
    cursor += ctx.measureText(char).width + letterSpacing;
  }
}

/* -------------------------------------------------------------------------- */
/* Shape paths                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Builds the path for a shape in its local box.
 *
 * Kept separate from painting so the SVG exporter can reuse the exact same
 * geometry and produce output that matches the canvas pixel for pixel.
 */
export function shapePath(ctx: Ctx, layer: ShapeLayer): void {
  const { width: w, height: h } = layer;
  const cx = w / 2;
  const cy = h / 2;

  ctx.beginPath();

  switch (layer.shape) {
    case "rectangle": {
      const radius = Math.max(0, Math.min(layer.cornerRadius, Math.min(w, h) / 2));
      if (radius <= 0) {
        ctx.rect(0, 0, w, h);
      } else {
        ctx.moveTo(radius, 0);
        ctx.lineTo(w - radius, 0);
        ctx.quadraticCurveTo(w, 0, w, radius);
        ctx.lineTo(w, h - radius);
        ctx.quadraticCurveTo(w, h, w - radius, h);
        ctx.lineTo(radius, h);
        ctx.quadraticCurveTo(0, h, 0, h - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
      }
      break;
    }

    case "ellipse": {
      ctx.ellipse(cx, cy, Math.max(0.01, w / 2), Math.max(0.01, h / 2), 0, 0, Math.PI * 2);
      break;
    }

    case "line": {
      // Drawn corner to corner so dragging in any direction gives the
      // expected angle.
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      break;
    }

    case "arrow": {
      const length = Math.hypot(w, h) || 1;
      const head = Math.max(6, Math.min(length * layer.arrowHeadSize, length * 0.9));
      const ux = w / length;
      const uy = h / length;
      const tipX = w;
      const tipY = h;
      const baseX = tipX - ux * head;
      const baseY = tipY - uy * head;
      // Perpendicular unit vector for the barbs.
      const px = -uy;
      const py = ux;
      const halfWidth = head * 0.45;

      ctx.moveTo(0, 0);
      ctx.lineTo(baseX, baseY);
      ctx.moveTo(baseX + px * halfWidth, baseY + py * halfWidth);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX - px * halfWidth, baseY - py * halfWidth);
      ctx.closePath();
      break;
    }

    case "polygon": {
      const sides = Math.max(3, Math.min(24, Math.round(layer.sides)));
      for (let i = 0; i < sides; i++) {
        // Start at the top so a hexagon looks upright.
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * (w / 2);
        const y = cy + Math.sin(angle) * (h / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }

    case "star": {
      const points = Math.max(3, Math.min(24, Math.round(layer.sides)));
      const inner = Math.max(0.05, Math.min(0.95, layer.innerRadius));
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? 1 : inner;
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * (w / 2) * radius;
        const y = cy + Math.sin(angle) * (h / 2) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Layer painting                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Applies a layer's transform.
 *
 * Order matters: translate to the centre, rotate, mirror, then move to the
 * top-left corner. Mirroring after rotation is what makes "flip" behave like
 * a mirror rather than an extra rotation.
 */
function applyLayerTransform(ctx: Ctx, layer: Layer): void {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  ctx.translate(cx, cy);
  if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flipX || layer.flipY) {
    ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
  }
  ctx.translate(-layer.width / 2, -layer.height / 2);
}

function paintImageLayer(
  ctx: Ctx,
  layer: ImageLayer,
  rasters: RasterLookup
): void {
  const source = rasters.get(layer.sourceId);
  if (!source) return;
  ctx.drawImage(source.image, 0, 0, layer.width, layer.height);
}

function paintShapeLayer(ctx: Ctx, layer: ShapeLayer): void {
  shapePath(ctx, layer);

  // An arrow's head is a closed triangle, so it fills with the stroke colour
  // to read as one solid marker rather than an outlined wedge.
  if (layer.shape === "arrow") {
    ctx.fillStyle = layer.strokeWidth > 0 ? layer.strokeColor : layer.fill;
    ctx.fill();
  } else if (layer.fillEnabled && layer.shape !== "line") {
    ctx.fillStyle = layer.fill;
    ctx.fill();
  }

  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.strokeColor;
    ctx.lineWidth = layer.strokeWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

function paintTextLayer(ctx: Ctx, layer: TextLayer): void {
  const metrics = measureTextLayer(ctx, layer);

  ctx.font = textLayerFont(layer);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  if (layer.shadow.enabled) {
    ctx.shadowColor = layer.shadow.color;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowOffsetX = layer.shadow.offsetX;
    ctx.shadowOffsetY = layer.shadow.offsetY;
  }

  const boxWidth = layer.autoSize ? metrics.width : layer.width;

  metrics.lines.forEach((line, index) => {
    // Alphabetic baseline sits roughly 80% down the line box, which lines up
    // with how the em square is distributed for the fonts on offer.
    const y = index * metrics.lineHeight + layer.fontSize * 0.8;
    let x = 0;
    if (layer.align === "center") x = (boxWidth - line.width) / 2;
    else if (layer.align === "right") x = boxWidth - line.width;

    if (layer.strokeWidth > 0) {
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth;
      ctx.lineJoin = "round";
      // Stroking outside the fill keeps the glyph weight intact.
      drawTrackedLine(ctx, line.text, x, y, layer.letterSpacing, "stroke");
    }

    ctx.fillStyle = layer.color;
    drawTrackedLine(ctx, line.text, x, y, layer.letterSpacing, "fill");

    if (layer.underline && line.text) {
      // Shadows are for the glyphs, not the rule.
      const previousShadow = ctx.shadowColor;
      ctx.shadowColor = "transparent";
      const thickness = Math.max(1, layer.fontSize / 16);
      ctx.fillRect(x, y + thickness * 1.5, line.width, thickness);
      ctx.shadowColor = previousShadow;
    }
  });
}

/**
 * Maps a document blend mode onto a canvas composite operation.
 *
 * The document uses the CSS `mix-blend-mode` vocabulary, where the default is
 * `normal`; canvas calls the same thing `source-over` and silently ignores an
 * unknown value. Without this translation a layer set back to Normal would
 * keep whichever blend mode was assigned before it.
 */
function compositeOperation(mode: BlendMode): GlobalCompositeOperation {
  return mode === "normal" ? "source-over" : (mode as GlobalCompositeOperation);
}

/** Draws one layer's own content, without transform or compositing. */
function paintLayerContent(ctx: Ctx, layer: Layer, rasters: RasterLookup): void {
  switch (layer.type) {
    case "image":
      paintImageLayer(ctx, layer, rasters);
      break;
    case "shape":
      paintShapeLayer(ctx, layer);
      break;
    case "text":
      paintTextLayer(ctx, layer);
      break;
  }
}

/**
 * Renders a layer through the pixel pipeline into its own buffer.
 *
 * Needed whenever adjustments are present: the operations work on pixels, so
 * the layer has to exist as pixels before they can run. The buffer is padded
 * so a blur can spread beyond the layer's own box instead of being clipped
 * into a hard edge.
 */
function paintLayerWithAdjustments(
  ctx: Ctx,
  layer: Layer,
  rasters: RasterLookup,
  factory: CanvasFactory,
  scale: number,
  filterScale: number
): void {
  const pad = layer.adjustments.blur > 0 ? Math.ceil(24 * filterScale) : 0;
  const bufferWidth = Math.max(1, Math.ceil(layer.width * scale) + pad * 2);
  const bufferHeight = Math.max(1, Math.ceil(layer.height * scale) + pad * 2);

  // Guard against a pathological layer size exhausting memory.
  if (bufferWidth * bufferHeight > 64_000_000) {
    paintLayerContent(ctx, layer, rasters);
    return;
  }

  const buffer = factory.create(bufferWidth, bufferHeight);
  buffer.ctx.save();
  buffer.ctx.translate(pad, pad);
  buffer.ctx.scale(scale, scale);
  paintLayerContent(buffer.ctx, layer, rasters);
  buffer.ctx.restore();

  const imageData = buffer.ctx.getImageData(0, 0, bufferWidth, bufferHeight);
  applyAdjustments(imageData.data, bufferWidth, bufferHeight, layer.adjustments, filterScale);
  buffer.ctx.putImageData(imageData, 0, 0);

  // Draw back in layer space; the caller's transform handles placement.
  ctx.drawImage(
    buffer.canvas,
    -pad / scale,
    -pad / scale,
    bufferWidth / scale,
    bufferHeight / scale
  );
}

/* -------------------------------------------------------------------------- */
/* Document rendering                                                         */
/* -------------------------------------------------------------------------- */

/** Renders a document onto a context already sized for it. */
export function renderDocument(
  ctx: Ctx,
  doc: EditorDocument,
  rasters: RasterLookup,
  options: RenderOptions = {}
): void {
  const scale = options.scale ?? 1;
  const filterScale = options.filterScale ?? scale;
  const only = options.onlyLayers ? new Set(options.onlyLayers) : null;
  const skip = options.skipLayers ? new Set(options.skipLayers) : null;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, doc.width * scale, doc.height * scale);

  if (doc.background && !options.transparent) {
    ctx.fillStyle = doc.background;
    ctx.fillRect(0, 0, doc.width * scale, doc.height * scale);
  }

  ctx.scale(scale, scale);
  // Everything outside the canvas is cropped, exactly as it will export.
  ctx.beginPath();
  ctx.rect(0, 0, doc.width, doc.height);
  ctx.clip();

  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    if (only && !only.has(layer.id)) continue;
    if (skip && skip.has(layer.id)) continue;
    // Zero-area layers have nothing to paint and would divide by zero below.
    if (layer.width <= 0 || layer.height <= 0) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    ctx.globalCompositeOperation = compositeOperation(layer.blendMode);
    applyLayerTransform(ctx, layer);

    if (hasAdjustments(layer.adjustments) && options.canvasFactory) {
      paintLayerWithAdjustments(
        ctx,
        layer,
        rasters,
        options.canvasFactory,
        scale,
        filterScale
      );
    } else {
      paintLayerContent(ctx, layer, rasters);
    }

    ctx.restore();
  }

  ctx.restore();
}
