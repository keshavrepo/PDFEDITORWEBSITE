/**
 * Inspection helpers for generated OOXML files.
 *
 * Tests assert on real document structure — paragraphs, runs, tables, images
 * and slide contents — rather than just checking that bytes were produced.
 */

import JSZip from "jszip";

/** Opens an OOXML package and returns the JSZip archive. */
export async function openPackage(bytes) {
  return JSZip.loadAsync(bytes);
}

/** Confirms the package is a well-formed OPC container. */
export async function assertValidPackage(bytes, requiredParts) {
  const zip = await openPackage(bytes);
  const names = Object.keys(zip.files);

  if (!names.includes("[Content_Types].xml")) {
    throw new Error("Missing [Content_Types].xml — not a valid OOXML package");
  }
  for (const part of requiredParts) {
    if (!names.some((name) => name === part || name.startsWith(part))) {
      throw new Error(`Missing required part: ${part}`);
    }
  }

  // Every XML part must parse.
  for (const name of names) {
    if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
    const xml = await zip.file(name).async("string");
    assertWellFormedXml(xml, name);
  }
  return zip;
}

/**
 * Lightweight well-formedness check.
 * Verifies tag balance and that the declaration is intact, which catches the
 * corruption modes that make Word or PowerPoint refuse to open a file.
 */
export function assertWellFormedXml(xml, partName) {
  if (!xml.startsWith("<?xml")) {
    throw new Error(`${partName}: missing XML declaration`);
  }
  const stack = [];
  const tagPattern = /<\/?([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(xml)) !== null) {
    const [full, name, , selfClosing] = match;
    if (full.startsWith("<?") || full.startsWith("<!")) continue;
    if (full.startsWith("</")) {
      const open = stack.pop();
      if (open !== name) {
        throw new Error(`${partName}: tag mismatch, expected </${open}> but found </${name}>`);
      }
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  if (stack.length) {
    throw new Error(`${partName}: unclosed tags ${stack.join(", ")}`);
  }
}

const stripTags = (xml) => xml.replace(/<[^>]+>/g, "");

/** Extracts readable text from every `w:t` element, in document order. */
export async function readDocxText(bytes) {
  const zip = await openPackage(bytes);
  const xml = await zip.file("word/document.xml").async("string");
  const matches = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
  return matches.map((match) => decodeXmlEntities(match[1])).join("");
}

/** Returns per-paragraph text for order-sensitive assertions. */
export async function readDocxParagraphs(bytes) {
  const zip = await openPackage(bytes);
  const xml = await zip.file("word/document.xml").async("string");
  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g)];
  return paragraphs.map((match) =>
    [...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((run) => decodeXmlEntities(run[1]))
      .join("")
  );
}

/** Summarises the generated Word document. */
export async function summarizeDocx(bytes) {
  const zip = await openPackage(bytes);
  const xml = await zip.file("word/document.xml").async("string");
  // Packages contain an explicit directory entry for `word/media/`; count only
  // the real image parts inside it.
  const media = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/media/") && !zip.files[name].dir
  );

  return {
    text: await readDocxText(bytes),
    paragraphs: await readDocxParagraphs(bytes),
    paragraphCount: (xml.match(/<w:p[\s>]/g) || []).length,
    tableCount: (xml.match(/<w:tbl>/g) || []).length,
    rowCount: (xml.match(/<w:tr[\s>]/g) || []).length,
    cellCount: (xml.match(/<w:tc>/g) || []).length,
    imageCount: media.length,
    sectionCount: (xml.match(/<w:sectPr>/g) || []).length,
    fonts: [...new Set([...xml.matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]))],
    boldRuns: (xml.match(/<w:b\/>/g) || []).length,
    italicRuns: (xml.match(/<w:i\/>/g) || []).length,
    headings: [...xml.matchAll(/w:val="Heading(\d)"/g)].map((m) => Number(m[1])),
    colors: [...new Set([...xml.matchAll(/<w:color w:val="([^"]+)"/g)].map((m) => m[1]))],
    numbering: (xml.match(/<w:numPr>/g) || []).length,
    media,
  };
}

/** Summarises the generated PowerPoint presentation. */
export async function summarizePptx(bytes) {
  const zip = await openPackage(bytes);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideIndex(a) - slideIndex(b));

  const slides = [];
  for (const name of slideNames) {
    const xml = await zip.file(name).async("string");
    slides.push({
      name,
      text: [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1])),
      shapeCount: (xml.match(/<p:sp>/g) || []).length,
      pictureCount: (xml.match(/<p:pic>/g) || []).length,
      tableCount: (xml.match(/<a:tbl>/g) || []).length,
      rowCount: (xml.match(/<a:tr\b/g) || []).length,
      fonts: [...new Set([...xml.matchAll(/typeface="([^"]+)"/g)].map((m) => m[1]))],
      bold: (xml.match(/b="1"/g) || []).length,
    });
  }

  const presentation = await zip.file("ppt/presentation.xml").async("string");
  const sizeMatch = presentation.match(/<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);

  return {
    slides,
    slideCount: slides.length,
    media: Object.keys(zip.files).filter(
      (name) => name.startsWith("ppt/media/") && !zip.files[name].dir
    ),
    slideWidthEmu: sizeMatch ? Number(sizeMatch[1]) : 0,
    slideHeightEmu: sizeMatch ? Number(sizeMatch[2]) : 0,
  };
}

function slideIndex(name) {
  const match = name.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}
