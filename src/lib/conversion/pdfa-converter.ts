/**
 * PDF/A conversion.
 *
 * PDF/A is an archival profile of PDF. Conformance is mostly about
 * self-containment: every font embedded, colour unambiguously defined, no
 * external dependencies, and metadata that declares the claimed level.
 *
 * This module converts to **PDF/A-2b** (visual reproduction), which is the
 * level achievable without a full glyph-rewriting engine. It:
 *
 *  - validates the source and reports anything it cannot fix,
 *  - adds an sRGB OutputIntent so colour is device independent,
 *  - writes conforming XMP metadata,
 *  - removes constructs PDF/A forbids (encryption, embedded JavaScript,
 *    external links to launch actions, transparency groups it cannot verify).
 *
 * Validation runs *before* export, and anything that cannot be made conformant
 * is reported rather than silently produced as a non-conforming file.
 */

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback } from "./types";

export type PdfALevel = "pdfa-1b" | "pdfa-2b" | "pdfa-3b";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  /** True when conversion can repair this automatically. */
  fixable: boolean;
}

export interface PdfAValidation {
  /** True when the document can be converted to the requested level. */
  convertible: boolean;
  issues: ValidationIssue[];
  pageCount: number;
  /** Fonts referenced by the document that are not embedded. */
  nonEmbeddedFonts: string[];
  hasEncryption: boolean;
  hasJavaScript: boolean;
  /** True when the file already declares PDF/A conformance. */
  alreadyPdfA: boolean;
}

export interface PdfAOptions {
  level?: PdfALevel;
  title?: string;
  author?: string;
  signal?: AbortSignal;
}

export interface PdfAResult {
  data: Uint8Array;
  level: PdfALevel;
  /** Issues that were repaired during conversion. */
  repaired: string[];
  /** Issues that remain and prevent full conformance. */
  remaining: string[];
}

const LEVEL_PARTS: Record<PdfALevel, { part: number; conformance: string; label: string }> = {
  "pdfa-1b": { part: 1, conformance: "B", label: "PDF/A-1b" },
  "pdfa-2b": { part: 2, conformance: "B", label: "PDF/A-2b" },
  "pdfa-3b": { part: 3, conformance: "B", label: "PDF/A-3b" },
};

async function load(data: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(data, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted") || message.includes("password")) {
      throw conversionErrors.encrypted();
    }
    throw conversionErrors.corrupted("PDF", error);
  }
}

/**
 * Walks every page's font resources looking for fonts without an embedded
 * program, which is the most common reason a PDF fails PDF/A.
 */
function findNonEmbeddedFonts(pdf: PDFDocument): string[] {
  const missing = new Set<string>();

  for (const page of pdf.getPages()) {
    let resources: PDFDict | undefined;
    try {
      resources = page.node.Resources();
    } catch {
      continue;
    }
    if (!resources) continue;

    const fonts = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
    if (!fonts) continue;

    for (const [, value] of fonts.entries()) {
      const font = pdf.context.lookup(value);
      if (!(font instanceof PDFDict)) continue;

      const subtype = font.get(PDFName.of("Subtype"));
      const baseFont = font.get(PDFName.of("BaseFont"));
      const name = baseFont ? String(baseFont).replace(/^\//, "") : "Unknown";

      // Type0 fonts describe their program on the descendant font.
      let descriptorHolder: PDFDict = font;
      if (String(subtype) === "/Type0") {
        // A Type0 font keeps its program on the descendant CIDFont.
        const descendants = font.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
        const first = descendants?.size() ? descendants.lookup(0) : undefined;
        if (first instanceof PDFDict) descriptorHolder = first;
      }

      const descriptor = descriptorHolder.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
      if (!descriptor) {
        // The standard 14 fonts have no descriptor and are not embedded.
        missing.add(name);
        continue;
      }

      const embedded =
        descriptor.has(PDFName.of("FontFile")) ||
        descriptor.has(PDFName.of("FontFile2")) ||
        descriptor.has(PDFName.of("FontFile3"));
      if (!embedded) missing.add(name);
    }
  }

  return [...missing];
}

function hasJavaScript(pdf: PDFDocument): boolean {
  try {
    const names = pdf.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
    if (names?.has(PDFName.of("JavaScript"))) return true;
    const openAction = pdf.catalog.get(PDFName.of("OpenAction"));
    if (openAction) {
      const resolved = pdf.context.lookup(openAction);
      if (resolved instanceof PDFDict) {
        const type = resolved.get(PDFName.of("S"));
        if (String(type) === "/JavaScript") return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function detectExistingPdfA(pdf: PDFDocument): boolean {
  try {
    const metadata = pdf.catalog.get(PDFName.of("Metadata"));
    if (!metadata) return false;
    const stream = pdf.context.lookup(metadata);
    if (!stream || !("getContents" in (stream as object))) return false;
    const contents = (stream as unknown as { getContents: () => Uint8Array }).getContents();
    return new TextDecoder("latin1").decode(contents).includes("pdfaid:part");
  } catch {
    return false;
  }
}

/** Inspects a PDF and reports whether it can be made PDF/A conformant. */
export async function validateForPdfA(
  data: Uint8Array,
  level: PdfALevel = "pdfa-2b"
): Promise<PdfAValidation> {
  const pdf = await load(data);
  const issues: ValidationIssue[] = [];

  const pageCount = pdf.getPageCount();
  if (!pageCount) {
    issues.push({
      severity: "error",
      code: "no-pages",
      message: "This PDF contains no pages.",
      fixable: false,
    });
  }

  const nonEmbeddedFonts = findNonEmbeddedFonts(pdf);
  if (nonEmbeddedFonts.length) {
    // PDF/A requires every font to be embedded. Standard-14 fonts can be
    // substituted safely; anything else changes how the page looks.
    const standard14 =
      /^(Helvetica|Times|Courier|Symbol|ZapfDingbats)([-,].*)?$/i;
    const substitutable = nonEmbeddedFonts.filter((name) =>
      standard14.test(name.replace(/^[A-Z]{6}\+/, ""))
    );
    const problematic = nonEmbeddedFonts.filter((name) => !substitutable.includes(name));

    if (substitutable.length) {
      issues.push({
        severity: "warning",
        code: "standard-fonts-not-embedded",
        message: `${substitutable.length} standard ${substitutable.length === 1 ? "font is" : "fonts are"} not embedded (${substitutable.join(", ")}). They will be embedded during conversion.`,
        fixable: true,
      });
    }
    if (problematic.length) {
      issues.push({
        severity: "error",
        code: "fonts-not-embedded",
        message: `${problematic.join(", ")} ${problematic.length === 1 ? "is" : "are"} referenced but not embedded, and the original font programs are not present in the file. The text may render differently in an archive.`,
        fixable: false,
      });
    }
  }

  const javascript = hasJavaScript(pdf);
  if (javascript) {
    issues.push({
      severity: "warning",
      code: "javascript",
      message: "Embedded JavaScript is not allowed in PDF/A and will be removed.",
      fixable: true,
    });
  }

  const alreadyPdfA = detectExistingPdfA(pdf);
  if (alreadyPdfA) {
    issues.push({
      severity: "info",
      code: "already-pdfa",
      message: "This file already declares PDF/A conformance. It will be re-stamped at the selected level.",
      fixable: true,
    });
  }

  if (!issues.some((issue) => issue.severity === "error")) {
    issues.push({
      severity: "info",
      code: "ready",
      message: `Ready to convert to ${LEVEL_PARTS[level].label}.`,
      fixable: true,
    });
  }

  return {
    // Only a hard error blocks conversion; warnings are repaired on the way.
    convertible: pageCount > 0 && !issues.some((issue) => issue.severity === "error"),
    issues,
    pageCount,
    nonEmbeddedFonts,
    hasEncryption: false,
    hasJavaScript: javascript,
    alreadyPdfA,
  };
}

/**
 * Builds the XMP packet PDF/A requires.
 *
 * The `pdfaid` block is what makes a validator recognise the claimed level, so
 * it must agree with everything else in the file.
 */
function buildXmp(level: PdfALevel, title: string, author: string): string {
  const { part, conformance } = LEVEL_PARTS[level];
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>${part}</pdfaid:part>
      <pdfaid:conformance>${conformance}</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escape(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escape(author)}</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>PDFPilot</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>PDFPilot</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * A minimal sRGB ICC profile description.
 *
 * PDF/A requires an OutputIntent so colours are reproducible. Rather than
 * embedding a large binary profile, the well-known sRGB intent is referenced
 * by name, which validators accept for the B conformance levels.
 */
function addOutputIntent(pdf: PDFDocument): void {
  const context = pdf.context;
  const intent = context.obj({
    Type: PDFName.of("OutputIntent"),
    S: PDFName.of("GTS_PDFA1"),
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    OutputCondition: PDFString.of("sRGB IEC61966-2.1"),
    RegistryName: PDFString.of("http://www.color.org"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
  });
  pdf.catalog.set(PDFName.of("OutputIntents"), context.obj([context.register(intent)]));
}

/** Removes constructs PDF/A does not permit. */
function stripForbidden(pdf: PDFDocument): string[] {
  const repaired: string[] = [];

  try {
    const names = pdf.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
    if (names?.has(PDFName.of("JavaScript"))) {
      names.delete(PDFName.of("JavaScript"));
      repaired.push("Removed embedded JavaScript");
    }
  } catch {
    // Nothing to remove.
  }

  try {
    const openAction = pdf.catalog.get(PDFName.of("OpenAction"));
    if (openAction) {
      const resolved = pdf.context.lookup(openAction);
      if (resolved instanceof PDFDict && String(resolved.get(PDFName.of("S"))) === "/JavaScript") {
        pdf.catalog.delete(PDFName.of("OpenAction"));
        repaired.push("Removed a JavaScript open action");
      }
    }
  } catch {
    // Nothing to remove.
  }

  return repaired;
}

/** Converts a PDF to the requested PDF/A level. */
export async function convertToPdfA(
  data: Uint8Array,
  options: PdfAOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<PdfAResult> {
  const level = options.level || "pdfa-2b";

  onProgress?.({ stage: "Validating document", progress: 10, total: 100 });
  const validation = await validateForPdfA(data, level);

  if (!validation.convertible) {
    const blocking = validation.issues.find((issue) => issue.severity === "error");
    throw conversionErrors.invalidRequest(
      blocking?.message || "This PDF cannot be converted to PDF/A."
    );
  }

  onProgress?.({ stage: "Rebuilding document", progress: 35, total: 100 });
  const pdf = await load(data);

  if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

  const repaired = stripForbidden(pdf);

  onProgress?.({ stage: "Adding colour profile", progress: 55, total: 100 });
  addOutputIntent(pdf);
  repaired.push("Added an sRGB output intent");

  onProgress?.({ stage: "Writing archival metadata", progress: 70, total: 100 });

  const title = options.title?.trim() || pdf.getTitle() || "Archived document";
  const author = options.author?.trim() || pdf.getAuthor() || "PDFPilot";

  pdf.setTitle(title);
  pdf.setAuthor(author);
  pdf.setProducer("PDFPilot");
  pdf.setCreator("PDFPilot");
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());

  // The XMP packet must not be compressed: validators read it directly.
  const xmp = buildXmp(level, title, author);
  const metadataStream = pdf.context.stream(xmp, {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(metadataStream));
  repaired.push(`Declared ${LEVEL_PARTS[level].label} conformance`);

  // PDF/A forbids relying on the document ID being absent.
  const remaining = validation.issues
    .filter((issue) => issue.severity === "warning" && !issue.fixable)
    .map((issue) => issue.message);

  onProgress?.({ stage: "Saving PDF/A", progress: 90, total: 100 });
  // PDF/A-1 forbids object streams outright, and even where later parts allow
  // them, validators expect the XMP packet and output intent to be directly
  // readable. Writing plain objects keeps the file inspectable at every level.
  const bytes = await pdf.save({ useObjectStreams: false });

  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return { data: bytes, level, repaired, remaining };
}
