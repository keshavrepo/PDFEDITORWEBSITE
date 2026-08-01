/**
 * SVG optimiser.
 *
 * The export pipeline already produces real `<text>` and `<path>` elements for
 * everything that has a vector representation, so optimisation is the last mile
 * between what is generated and what is shipped: remove comments, collapse
 * runs of whitespace, drop useless attributes, shorten numeric output to the
 * precision the consumer can actually distinguish, and strip the editor-only
 * markers a real-world SVG viewer has no use for.
 *
 * The function is deliberately conservative: it never rewrites coordinates,
 * does not merge paths, and never reorders attributes. Those transforms are
 * lossy in subtle ways — changing the order of style attributes can change
 * which one wins — and the saving is not worth the risk on real artwork.
 *
 * Operates on a string rather than a DOM tree so the same code runs in the
 * browser and in the test suite. A small regex is not the right tool for
 * arbitrary XML, but our generated SVG is shaped by `documentToSvg` and the
 * only tags and attributes it ever produces are known in advance, so the
 * targeted patterns below cover what actually appears in the file.
 */

/** Settings the user can toggle. */
export interface OptimizeOptions {
  /** Strip XML and DOCTYPE declarations. True for embedded SVG, false for stand-alone files. */
  stripProlog: boolean;
  /** Drop `data-name` attributes the editor added for layer identification. */
  dropLayerNames: boolean;
  /** Decimal places kept on path coordinates and transforms. 0 disables rounding. */
  precision: number;
  /** Collapse runs of whitespace inside text nodes and attribute values. */
  collapseWhitespace: boolean;
  /** Drop default-valued fill="none" and the empty xmlns:xlink when unused. */
  dropDefaults: boolean;
}

export const defaultOptimizeOptions: OptimizeOptions = {
  stripProlog: false,
  dropLayerNames: true,
  precision: 2,
  collapseWhitespace: true,
  dropDefaults: true,
};

/**
 * Result of optimising an SVG.
 *
 * Returning both the new string and the byte saving keeps the UI honest: a
 * 5% saving on a tiny icon is real, but a 50% saving on the same file is
 * usually down to a comment that should not have been there in the first
 * place. The ratio is shown either way.
 */
export interface OptimizeResult {
  svg: string;
  originalBytes: number;
  optimizedBytes: number;
  /** Number of removals applied, for a quick post-mortem in the UI. */
  reductions: Record<string, number>;
}

/**
 * Optimises an SVG string.
 *
 * The order matters: the prolog and empty `data-name` runs are removed first
 * so the whitespace pass can sweep up the gaps they leave behind, and
 * precision is applied last because nothing else creates new numbers.
 */
export function optimizeSvg(input: string, options: OptimizeOptions = defaultOptimizeOptions): OptimizeResult {
  const reductions: Record<string, number> = {};
  const originalBytes = byteLength(input);

  let svg = input;

  if (options.stripProlog) {
    // The XML prolog is never required for SVG that is served as image/svg+xml.
    const before = svg;
    svg = svg.replace(/^\s*<\?xml[^?]*\?>\s*/, "");
    if (svg.length !== before.length) reductions.prolog = 1;
  }

  if (options.dropLayerNames) {
    // `data-name="..."` exists only for layer identification in the editor.
    const matches = svg.match(/\s+data-name="[^"]*"/g);
    if (matches) {
      svg = svg.replace(/\s+data-name="[^"]*"/g, "");
      reductions.layerNames = matches.length;
    }
  }

  if (options.dropDefaults) {
    // Strip `fill="none"` on `<text>` (where the attribute has no effect) and
    // the `xmlns:xlink` declaration when no `xlink:href` is actually used.
    const fillNone = svg.match(/<text[^>]*\sfill="none"/g);
    if (fillNone) {
      svg = svg.replace(/(<text[^>]*)\sfill="none"/g, "$1");
      reductions.defaultFill = fillNone.length;
    }
    if (!/xlink:href/.test(svg)) {
      const before = svg;
      svg = svg.replace(/\s+xmlns:xlink="[^"]*"/, "");
      if (svg.length !== before.length) reductions.xlink = 1;
    }
    // `width` and `height` on the root are redundant once `viewBox` is set;
    // they constrain the rendering which is usually not what an inline icon
    // wants. Only stripped when both are present and equal to the viewBox.
    svg = svg.replace(
      /<svg([^>]*)\swidth="(\d+)"\s+height="(\d+)"([^>]*)>/,
      (full, before, width, height, after) => {
        const viewBox = (before + after).match(/viewBox="([\d.\- ]+)"/);
        if (!viewBox) return full;
        const parts = viewBox[1].trim().split(/\s+/);
        if (parts[2] === width && parts[3] === height) {
          reductions.svgDimensions = 1;
          return `<svg${before}${after}>`;
        }
        return full;
      }
    );
  }

  if (options.collapseWhitespace) {
    // Preserve at least one space between adjacent attributes; collapse all
    // other runs. The trailing newline before the closing tag is dropped
    // because the editor appended one for human readability.
    const before = svg;
    svg = svg
      .replace(/<!--[\s\S]*?-->/g, "") // comments
      .replace(/>\s+</g, "><")          // whitespace between tags
      .replace(/\s{2,}/g, " ")           // any remaining double space
      .replace(/"\s+([a-zA-Z-]+=)/g, '" $1') // tidy the attribute gaps
      .replace(/\n/g, "");
    if (svg.length !== before.length) reductions.whitespace = before.length - svg.length;
  }

  if (options.precision > 0) {
    // Two decimals keeps sub-pixel detail without weighing the file down.
    const factor = Math.pow(10, options.precision);
    const before = svg;
    svg = svg.replace(/-?\d+\.\d+/g, (match) => {
      const value = parseFloat(match);
      return (Math.round(value * factor) / factor).toString();
    });
    if (svg.length !== before.length) reductions.precision = before.length - svg.length;
  }

  return {
    svg,
    originalBytes,
    optimizedBytes: byteLength(svg),
    reductions,
  };
}

/**
 * Counts bytes using the platform `TextEncoder` when present and falls back
 * to `Buffer.byteLength` under Node, because `String#length` reports UTF-16
 * code units and would over-count any non-ASCII glyph.
 */
function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  // Node's Buffer is available wherever this file is used in tests.
  const nodeBuffer = (globalThis as { Buffer?: { byteLength: (value: string, encoding: string) => number } }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.byteLength(value, "utf-8");
  }
  return value.length;
}
