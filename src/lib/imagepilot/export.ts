/**
 * Export pipeline.
 *
 * Raster formats are composited through the same renderer the canvas uses, so
 * what is exported is exactly what was on screen. SVG takes a different route:
 * shapes and text are emitted as real vector elements and only image layers
 * are embedded as bitmaps, which keeps the useful half of the document
 * scalable and editable in a vector program.
 */

import { EXPORT_FORMATS, EXPORT_RASTER_CAP } from "./constants";
import { measureTextLayer, renderDocument, type CanvasFactory } from "./renderer";
import { hasAdjustments, toCssFilter } from "./adjustments";
import { optimizeSvg } from "./svg";
import type {
  EditorDocument,
  ExportFormat,
  Layer,
  RasterLookup,
  Rect,
  ShapeLayer,
  TextLayer,
} from "./types";

export interface ExportOptions {
  format: ExportFormat;
  /** 0.1..1, honoured by JPEG and WEBP. */
  quality: number;
  /** Multiplies the document size; 2 exports at twice the resolution. */
  scale: number;
  /** Background painted under formats without an alpha channel. */
  matte: string;
  /** Drops the document background so PNG/WEBP export transparent. */
  transparent: boolean;
  /** Restricts the export to a region of the canvas. */
  region?: Rect;
  /** Base name, without extension. */
  fileName: string;
}

export const defaultExportOptions: ExportOptions = {
  format: "png",
  quality: 0.92,
  scale: 1,
  matte: "#ffffff",
  transparent: false,
  fileName: "imagepilot-export",
};

export interface ExportResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
}

export function formatDescriptor(format: ExportFormat) {
  return EXPORT_FORMATS.find((entry) => entry.value === format) ?? EXPORT_FORMATS[0];
}

/**
 * Caps the export scale so a large canvas cannot request a buffer the browser
 * will refuse to allocate.
 */
export function clampExportScale(doc: EditorDocument, region: Rect | undefined, scale: number): number {
  const width = region?.width ?? doc.width;
  const height = region?.height ?? doc.height;
  const longest = Math.max(width, height);
  if (longest <= 0) return 1;
  return Math.max(0.05, Math.min(scale, EXPORT_RASTER_CAP / longest));
}

/* -------------------------------------------------------------------------- */
/* Raster export                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Composites the document into an offscreen canvas.
 *
 * Exposed separately from {@link exportDocument} because the clipboard and the
 * preview thumbnail need the same pixels without the encoding step.
 */
export function composite(
  doc: EditorDocument,
  rasters: RasterLookup,
  factory: CanvasFactory,
  options: {
    scale?: number;
    transparent?: boolean;
    matte?: string;
    region?: Rect;
  } = {}
): { canvas: CanvasImageSource; ctx: CanvasRenderingContext2D; width: number; height: number } {
  const scale = options.scale ?? 1;
  const region = options.region;
  const width = Math.max(1, Math.round((region?.width ?? doc.width) * scale));
  const height = Math.max(1, Math.round((region?.height ?? doc.height) * scale));

  const target = factory.create(width, height);

  if (!options.transparent && options.matte) {
    target.ctx.fillStyle = options.matte;
    target.ctx.fillRect(0, 0, width, height);
  }

  if (region) {
    // Render the whole document into a full-size buffer, then copy out the
    // requested region. Translating the renderer instead would move the
    // clipping rectangle with it and crop the wrong content.
    const full = factory.create(
      Math.max(1, Math.round(doc.width * scale)),
      Math.max(1, Math.round(doc.height * scale))
    );
    renderDocument(full.ctx, doc, rasters, {
      scale,
      transparent: options.transparent,
      canvasFactory: factory,
      filterScale: scale,
    });
    target.ctx.drawImage(
      full.canvas,
      region.x * scale,
      region.y * scale,
      width,
      height,
      0,
      0,
      width,
      height
    );
  } else {
    const layer = factory.create(width, height);
    renderDocument(layer.ctx, doc, rasters, {
      scale,
      transparent: options.transparent,
      canvasFactory: factory,
      filterScale: scale,
    });
    target.ctx.drawImage(layer.canvas, 0, 0);
  }

  return { canvas: target.canvas, ctx: target.ctx, width, height };
}

/* -------------------------------------------------------------------------- */
/* SVG export                                                                 */
/* -------------------------------------------------------------------------- */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function round(value: number): string {
  // Three decimals is well below a device pixel and keeps the file small.
  return (Math.round(value * 1000) / 1000).toString();
}

/**
 * SVG transform matching {@link applyLayerTransform} in the renderer.
 *
 * Written in the same order (translate → rotate → mirror → corner) so vector
 * output lands in exactly the same place as the canvas render.
 */
function layerTransform(layer: Layer): string {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const parts = [`translate(${round(cx)} ${round(cy)})`];
  if (layer.rotation) parts.push(`rotate(${round(layer.rotation)})`);
  if (layer.flipX || layer.flipY) {
    parts.push(`scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})`);
  }
  parts.push(`translate(${round(-layer.width / 2)} ${round(-layer.height / 2)})`);
  return parts.join(" ");
}

/** SVG path data for a shape, mirroring `shapePath` in the renderer. */
function shapePathData(layer: ShapeLayer): string {
  const w = layer.width;
  const h = layer.height;
  const cx = w / 2;
  const cy = h / 2;

  switch (layer.shape) {
    case "rectangle": {
      const r = Math.max(0, Math.min(layer.cornerRadius, Math.min(w, h) / 2));
      if (r <= 0) return `M0 0 H${round(w)} V${round(h)} H0 Z`;
      return [
        `M${round(r)} 0`,
        `H${round(w - r)}`,
        `Q${round(w)} 0 ${round(w)} ${round(r)}`,
        `V${round(h - r)}`,
        `Q${round(w)} ${round(h)} ${round(w - r)} ${round(h)}`,
        `H${round(r)}`,
        `Q0 ${round(h)} 0 ${round(h - r)}`,
        `V${round(r)}`,
        `Q0 0 ${round(r)} 0`,
        "Z",
      ].join(" ");
    }

    case "ellipse": {
      const rx = Math.max(0.01, w / 2);
      const ry = Math.max(0.01, h / 2);
      // Two arcs, because a single 360° arc is degenerate in SVG.
      return [
        `M${round(cx - rx)} ${round(cy)}`,
        `A${round(rx)} ${round(ry)} 0 1 0 ${round(cx + rx)} ${round(cy)}`,
        `A${round(rx)} ${round(ry)} 0 1 0 ${round(cx - rx)} ${round(cy)}`,
        "Z",
      ].join(" ");
    }

    case "line":
      return `M0 0 L${round(w)} ${round(h)}`;

    case "arrow": {
      const length = Math.hypot(w, h) || 1;
      const head = Math.max(6, Math.min(length * layer.arrowHeadSize, length * 0.9));
      const ux = w / length;
      const uy = h / length;
      const baseX = w - ux * head;
      const baseY = h - uy * head;
      const px = -uy;
      const py = ux;
      const halfWidth = head * 0.45;
      return [
        `M0 0 L${round(baseX)} ${round(baseY)}`,
        `M${round(baseX + px * halfWidth)} ${round(baseY + py * halfWidth)}`,
        `L${round(w)} ${round(h)}`,
        `L${round(baseX - px * halfWidth)} ${round(baseY - py * halfWidth)}`,
        "Z",
      ].join(" ");
    }

    case "polygon": {
      const sides = Math.max(3, Math.min(24, Math.round(layer.sides)));
      const points: string[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        points.push(`${round(cx + Math.cos(angle) * (w / 2))} ${round(cy + Math.sin(angle) * (h / 2))}`);
      }
      return `M${points.join(" L")} Z`;
    }

    case "star": {
      const count = Math.max(3, Math.min(24, Math.round(layer.sides)));
      const inner = Math.max(0.05, Math.min(0.95, layer.innerRadius));
      const points: string[] = [];
      for (let i = 0; i < count * 2; i++) {
        const radius = i % 2 === 0 ? 1 : inner;
        const angle = (i / (count * 2)) * Math.PI * 2 - Math.PI / 2;
        points.push(
          `${round(cx + Math.cos(angle) * (w / 2) * radius)} ${round(cy + Math.sin(angle) * (h / 2) * radius)}`
        );
      }
      return `M${points.join(" L")} Z`;
    }

    default:
      return "";
  }
}

function shapeToSvg(layer: ShapeLayer): string {
  const data = shapePathData(layer);
  if (!data) return "";

  const attrs: string[] = [`d="${data}"`];

  if (layer.shape === "arrow") {
    attrs.push(`fill="${layer.strokeWidth > 0 ? layer.strokeColor : layer.fill}"`);
  } else if (layer.fillEnabled && layer.shape !== "line") {
    attrs.push(`fill="${layer.fill}"`);
  } else {
    attrs.push('fill="none"');
  }

  if (layer.strokeWidth > 0) {
    attrs.push(`stroke="${layer.strokeColor}"`);
    attrs.push(`stroke-width="${round(layer.strokeWidth)}"`);
    attrs.push('stroke-linejoin="round"');
    attrs.push('stroke-linecap="round"');
  }

  return `<path ${attrs.join(" ")} />`;
}

/**
 * Emits a text layer as real `<text>` elements.
 *
 * Each measured line becomes its own element rather than using `tspan`
 * offsets, because that reproduces the canvas layout exactly, including
 * wrapping decisions the renderer already made.
 */
function textToSvg(layer: TextLayer, ctx: CanvasRenderingContext2D | null): string {
  const lines = ctx
    ? measureTextLayer(ctx, layer).lines
    : layer.text.split("\n").map((text) => ({ text, width: 0 }));
  const lineHeight = layer.fontSize * layer.lineHeight;

  const anchor = layer.align === "center" ? "middle" : layer.align === "right" ? "end" : "start";
  const boxWidth = layer.autoSize
    ? Math.max(1, ...lines.map((line) => line.width || 0))
    : layer.width;
  const anchorX = layer.align === "center" ? boxWidth / 2 : layer.align === "right" ? boxWidth : 0;

  const style = [
    `font-family:${layer.fontFamily.replace(/"/g, "'")}`,
    `font-size:${round(layer.fontSize)}px`,
    `font-weight:${layer.fontWeight}`,
    layer.italic ? "font-style:italic" : "",
    layer.underline ? "text-decoration:underline" : "",
    layer.letterSpacing ? `letter-spacing:${round(layer.letterSpacing)}px` : "",
  ]
    .filter(Boolean)
    .join(";");

  const strokeAttrs =
    layer.strokeWidth > 0
      ? ` stroke="${layer.strokeColor}" stroke-width="${round(layer.strokeWidth)}" paint-order="stroke fill" stroke-linejoin="round"`
      : "";

  return lines
    .map((line, index) => {
      if (!line.text) return "";
      const y = index * lineHeight + layer.fontSize * 0.8;
      return `<text x="${round(anchorX)}" y="${round(y)}" fill="${layer.color}" text-anchor="${anchor}" style="${style}"${strokeAttrs}>${escapeXml(line.text)}</text>`;
    })
    .filter(Boolean)
    .join("");
}

/**
 * Serialises the document as SVG.
 *
 * Image layers are embedded as data URIs supplied by the caller, because
 * encoding a bitmap needs a canvas the pure serialiser does not own.
 */
export function documentToSvg(
  doc: EditorDocument,
  imageHrefs: Map<string, string>,
  ctx: CanvasRenderingContext2D | null,
  options: { transparent?: boolean } = {}
): string {
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">`
  );
  parts.push(`<title>${escapeXml(doc.name)}</title>`);

  if (doc.background && !options.transparent) {
    parts.push(`<rect x="0" y="0" width="${doc.width}" height="${doc.height}" fill="${doc.background}" />`);
  }

  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    if (layer.width <= 0 || layer.height <= 0) continue;

    let body = "";
    if (layer.type === "shape") body = shapeToSvg(layer);
    else if (layer.type === "text") body = textToSvg(layer, ctx);
    else {
      const href = imageHrefs.get(layer.id);
      if (!href) continue;
      body = `<image x="0" y="0" width="${round(layer.width)}" height="${round(layer.height)}" preserveAspectRatio="none" xlink:href="${href}" />`;
    }

    if (!body) continue;

    const groupAttrs = [`transform="${layerTransform(layer)}"`];
    if (layer.opacity < 1) groupAttrs.push(`opacity="${round(layer.opacity)}"`);
    if (layer.blendMode !== "normal") {
      groupAttrs.push(`style="mix-blend-mode:${layer.blendMode}"`);
    }
    // Adjustments on a vector layer are reproduced with a CSS filter, which is
    // the closest an SVG viewer can get to the canvas pipeline. Image layers
    // are already baked, so they need no filter.
    if (layer.type !== "image" && hasAdjustments(layer.adjustments)) {
      const filter = toCssFilter(layer.adjustments);
      if (filter !== "none") groupAttrs.push(`filter="${filter}"`);
    }
    groupAttrs.push(`data-name="${escapeXml(layer.name)}"`);

    parts.push(`<g ${groupAttrs.join(" ")}>${body}</g>`);
  }

  parts.push("</svg>");
  return parts.join("\n");
}

/* -------------------------------------------------------------------------- */
/* File naming                                                                */
/* -------------------------------------------------------------------------- */

/** Strips characters that browsers or filesystems reject in a download name. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || "imagepilot-export";
}

export function exportFileName(base: string, format: ExportFormat): string {
  const descriptor = formatDescriptor(format);
  return `${sanitizeFileName(base)}.${descriptor.extension}`;
}

/* -------------------------------------------------------------------------- */
/* SVG optimisation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Re-exported from a sibling module so callers do not need to know that the
 * optimiser lives in its own file.
 */
export { optimizeSvg, defaultOptimizeOptions, type OptimizeOptions, type OptimizeResult } from "./svg";

/**
 * Convenience wrapper that combines {@link documentToSvg} and the optimiser.
 *
 * The image hrefs are encoded once, the resulting SVG is optimised, and the
 * byte saving is reported back so the UI can show "from 48 kB to 32 kB"
 * rather than just the final size.
 */
export function exportOptimizedSvg(
  doc: EditorDocument,
  imageHrefs: Map<string, string>,
  ctx: CanvasRenderingContext2D | null,
  options: { transparent?: boolean } = {},
  optimizeOptions?: import("./svg").OptimizeOptions
): {
  svg: string;
  optimized: import("./svg").OptimizeResult;
} {
  const svg = documentToSvg(doc, imageHrefs, ctx, options);
  const optimized = optimizeSvg(svg, optimizeOptions);
  return { svg: optimized.svg, optimized };
}
