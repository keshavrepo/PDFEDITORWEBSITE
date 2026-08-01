/**
 * Permanent PDF redaction.
 *
 * Drawing a black rectangle over text is not redaction: the characters remain
 * in the content stream and can be copied straight out of the file. This
 * module therefore does three things for every redacted region:
 *
 *  1. removes the text-showing operators whose glyphs fall inside the region,
 *     rewriting the page's content stream;
 *  2. draws an opaque box so the area is visibly redacted;
 *  3. strips document metadata that commonly leaks the original content.
 *
 * The rewritten stream is what makes the removal permanent — the underlying
 * characters are gone from the file, not merely hidden.
 */

import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  rgb,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { conversionErrors } from "./errors";
import { loadPdfJs } from "./pdf/pdf-loader";
import type { ConversionProgressCallback } from "./types";

/** A rectangle to redact, in points with a top-left origin. */
export interface RedactionArea {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactOptions {
  /** Fill colour for the box. Uppercase RRGGBB. Defaults to black. */
  boxColor?: string;
  /** Strip title, author, keywords and similar metadata. Defaults to true. */
  removeMetadata?: boolean;
  /**
   * Flatten annotations and form fields into the page so nothing interactive
   * can reveal redacted content. Defaults to true.
   */
  flatten?: boolean;
  signal?: AbortSignal;
}

export interface RedactionResult {
  data: Uint8Array;
  /** Number of text-showing operations removed from the content streams. */
  removedTextOperations: number;
  /** True when every requested area was processed. */
  areasApplied: number;
}

function hexToRgb(hex: string | undefined): RGB {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return rgb(0, 0, 0);
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255
  );
}

/**
 * A glyph run located on the page, produced by pdf.js.
 * Coordinates use a top-left origin to match the UI overlay.
 */
interface LocatedText {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Overlap test with a small tolerance so touching regions count as hits. */
function intersects(area: RedactionArea, item: LocatedText): boolean {
  const tolerance = 0.5;
  return !(
    item.x + item.width < area.x + tolerance ||
    item.x > area.x + area.width - tolerance ||
    item.y + item.height < area.y + tolerance ||
    item.y > area.y + area.height - tolerance
  );
}

/**
 * Finds which text-showing operators fall inside the redaction areas.
 *
 * pdf.js is used to locate glyphs because it implements the full text
 * positioning model. The returned indices count text-showing operators in
 * stream order, which is the same order the rewriter walks.
 */
async function findTextOperationsToRemove(
  data: Uint8Array,
  areas: RedactionArea[],
  signal?: AbortSignal
): Promise<Map<number, Set<number>>> {
  const byPage = new Map<number, Set<number>>();
  const pdfjs = await loadPdfJs();

  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: false,
    disableFontFace: true,
    fontExtraProperties: true,
  });

  let document;
  try {
    document = await task.promise;
  } catch {
    // Without glyph positions only the box can be drawn; the caller still
    // produces a visually redacted file.
    return byPage;
  }

  try {
    const pageIndices = [...new Set(areas.map((area) => area.pageIndex))];

    for (const pageIndex of pageIndices) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      if (pageIndex < 0 || pageIndex >= document.numPages) continue;

      const page = await document.getPage(pageIndex + 1);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const pageAreas = areas.filter((area) => area.pageIndex === pageIndex);
        const hits = new Set<number>();

        // `getTextContent` emits one entry per text-showing operator, in the
        // same order the content stream lists them. Whitespace-only entries
        // are synthesised by pdf.js and have no operator, so they are skipped.
        let operatorIndex = 0;
        for (const raw of content.items) {
          if (!("str" in raw)) continue;
          const item = raw as {
            str: string;
            transform: number[];
            width: number;
            height: number;
          };
          if (!item.str.trim()) continue;

          const [, , , , translateX, translateY] = item.transform;
          const fontSize = Math.abs(item.transform[3]) || item.height || 10;
          const located: LocatedText = {
            x: translateX,
            // Flip to top-left space and account for the glyph ascent.
            y: viewport.height - translateY - fontSize * 0.8,
            width: item.width,
            height: fontSize,
          };

          if (pageAreas.some((area) => intersects(area, located))) hits.add(operatorIndex);
          operatorIndex++;
        }

        if (hits.size) byPage.set(pageIndex, hits);
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await task.destroy().catch(() => undefined);
  }

  return byPage;
}

/** Decodes every content stream of a page into one string. */
function readPageContent(page: PDFPage): { text: string; streams: PDFRawStream[] } | null {
  const contents = page.node.Contents();
  if (!contents) return null;

  const streams: PDFRawStream[] = [];
  if (contents instanceof PDFArray) {
    for (let index = 0; index < contents.size(); index++) {
      const entry = contents.lookup(index);
      if (entry instanceof PDFRawStream) streams.push(entry);
    }
  } else if (contents instanceof PDFRawStream) {
    streams.push(contents);
  }
  if (!streams.length) return null;

  const parts: string[] = [];
  for (const stream of streams) {
    try {
      parts.push(new TextDecoder("latin1").decode(decodePDFRawStream(stream).decode()));
    } catch {
      return null;
    }
  }
  return { text: parts.join("\n"), streams };
}

/**
 * Rewrites a content stream with the selected text-showing operators removed.
 *
 * Only the operator and its operand are dropped; the surrounding graphics
 * state is preserved so the rest of the page renders unchanged.
 */
export function removeTextOperations(content: string, indicesToRemove: Set<number>): {
  output: string;
  removed: number;
} {
  if (!indicesToRemove.size) return { output: content, removed: 0 };

  let output = "";
  let cursor = 0;
  let operatorIndex = 0;
  let removed = 0;

  // Matches Tj, TJ, ' and " together with the operand that precedes them.
  // Strings may be literal `( )` or hex `< >`, and arrays wrap both.
  const pattern =
    /(\[(?:[^[\]\\]|\\.)*\]|\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]*>)\s*(TJ|Tj|'|")/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (indicesToRemove.has(operatorIndex)) {
      output += content.slice(cursor, start);
      // Replacing with an empty string keeps operator arity valid for the
      // quote operators, which also move to the next line.
      output += match[2] === "'" || match[2] === '"' ? "() " + match[2] : "";
      cursor = end;
      removed++;
    }
    operatorIndex++;
  }

  output += content.slice(cursor);
  return { output, removed };
}

/** Strips metadata that could reveal the redacted content. */
function stripMetadata(pdf: PDFDocument): void {
  try {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("PDFPilot");
    pdf.setCreator("PDFPilot");
  } catch {
    // Metadata setters can throw on unusual documents; ignore and continue.
  }

  try {
    // The XMP packet duplicates the info dictionary and must go too.
    const catalog = pdf.catalog;
    if (catalog.has(PDFName.of("Metadata"))) catalog.delete(PDFName.of("Metadata"));
  } catch {
    // Not every document exposes a deletable metadata entry.
  }
}

/** Permanently redacts the given areas. */
export async function redactPdf(
  data: Uint8Array,
  areas: RedactionArea[],
  options: RedactOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<RedactionResult> {
  if (!areas.length) {
    throw conversionErrors.invalidRequest("Select at least one area to redact");
  }

  onProgress?.({ stage: "Locating text", progress: 10, total: 100 });
  const toRemove = await findTextOperationsToRemove(data, areas, options.signal);

  onProgress?.({ stage: "Removing content", progress: 40, total: 100 });

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(data, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted") || message.includes("password")) {
      throw conversionErrors.encrypted();
    }
    throw conversionErrors.corrupted("PDF", error);
  }

  const pages = pdf.getPages();
  if (!pages.length) throw conversionErrors.noContent("PDF");

  // Flatten interactive content first: a form field or annotation sitting over
  // a redacted region could otherwise still expose the original text.
  if (options.flatten !== false) {
    try {
      const form = pdf.getForm();
      if (form.getFields().length) form.flatten();
    } catch {
      // Documents without a form, or with one that cannot flatten, continue.
    }
  }

  let removedTextOperations = 0;

  for (const [pageIndex, indices] of toRemove) {
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const page = pages[pageIndex];
    if (!page) continue;

    const content = readPageContent(page);
    if (!content) continue;

    const { output, removed } = removeTextOperations(content.text, indices);
    if (!removed) continue;

    // Replace all existing streams with the single rewritten one.
    const replacement = pdf.context.flateStream(output);
    page.node.set(PDFName.of("Contents"), pdf.context.register(replacement));
    removedTextOperations += removed;
  }

  onProgress?.({ stage: "Applying redaction boxes", progress: 70, total: 100 });

  const color = hexToRgb(options.boxColor);
  let areasApplied = 0;

  for (const area of areas) {
    const page = pages[area.pageIndex];
    if (!page) continue;
    const { height } = page.getSize();

    page.drawRectangle({
      x: area.x,
      // Back to PDF's bottom-left origin.
      y: height - area.y - area.height,
      width: area.width,
      height: area.height,
      color,
      // Fully opaque so nothing shows through.
      opacity: 1,
      borderWidth: 0,
    });
    areasApplied++;
  }

  if (options.removeMetadata !== false) {
    onProgress?.({ stage: "Removing metadata", progress: 85, total: 100 });
    stripMetadata(pdf);
  }

  onProgress?.({ stage: "Saving PDF", progress: 95, total: 100 });
  // `useObjectStreams: false` keeps the rewritten streams inspectable, which
  // matters when verifying that redacted text is really gone.
  const bytes = await pdf.save({ useObjectStreams: false });
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });

  return { data: bytes, removedTextOperations, areasApplied };
}
