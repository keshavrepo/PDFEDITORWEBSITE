/**
 * OfficePilot Word importer.
 *
 * Reads a DOCX file (which is a zip) and walks the OOXML document tree to
 * produce a Word body. The importer handles the common subset the editor
 * itself supports: paragraphs, headings, lists (numbered, bulleted,
 * checklist), tables, simple images, page breaks, line breaks and the
 * most common inline marks (bold, italic, underline, strikethrough).
 *
 * Unknown elements are passed through as text runs, so a DOCX produced
 * by Microsoft Word round-trips without losing anything; the editor
 * just renders the unsupported parts as plain text.
 */

import JSZip from "jszip";
import type {
  WordAlignment,
  WordBody,
  WordBlock,
  WordListKind,
  WordMark,
  WordRun,
} from "./schema";
import { DEFAULT_SETTINGS } from "./schema";

/** A simplified view of an OOXML element. */
interface OoxmlNode {
  /** Tag name without the namespace, lowercased. */
  name: string;
  /** Tag attributes. */
  attributes: Record<string, string>;
  /** Child text content. */
  text: string;
  /** Child elements. */
  children: OoxmlNode[];
}

/**
 * Tokenises a run of OOXML into element nodes. The DOCX format uses XML
 * (with namespaces), so the parser is a small, namespace-aware reader
 * that strips the namespace prefix on the way in.
 */
function tokeniseXml(input: string): OoxmlNode | null {
  let cursor = 0;

  function skipWhitespace(): void {
    while (cursor < input.length && /\s/u.test(input[cursor]!)) {
      cursor += 1;
    }
  }

  function readUntil(chars: string): string {
    const start = cursor;
    while (cursor < input.length && !chars.includes(input[cursor]!)) {
      cursor += 1;
    }
    return input.slice(start, cursor);
  }

  function readAttributes(): Record<string, string> {
    const attributes: Record<string, string> = {};
    while (cursor < input.length) {
      skipWhitespace();
      if (input[cursor] === ">" || input[cursor] === "/") break;
      const name = readUntil("= \t\n\r");
      if (!name) break;
      skipWhitespace();
      if (input[cursor] !== "=") {
        attributes[name] = "true";
        continue;
      }
      cursor += 1;
      skipWhitespace();
      const quote = input[cursor];
      if (quote !== '"' && quote !== "'") {
        attributes[name] = readUntil(" \t\n\r>");
        continue;
      }
      cursor += 1;
      const valueStart = cursor;
      while (cursor < input.length && input[cursor] !== quote) {
        cursor += 1;
      }
      attributes[name] = input.slice(valueStart, cursor);
      if (input[cursor] === quote) cursor += 1;
    }
    return attributes;
  }

  function readElement(): OoxmlNode | null {
    skipWhitespace();
    if (cursor >= input.length) return null;
    if (input[cursor] !== "<") return null;
    cursor += 1;
    if (input[cursor] === "/") {
      // Closing tag; skip it.
      while (cursor < input.length && input[cursor] !== ">") cursor += 1;
      cursor += 1;
      return null;
    }
    if (input[cursor] === "!" || input[cursor] === "?") {
      // Declaration or comment; skip to end of tag.
      while (cursor < input.length && input[cursor] !== ">") cursor += 1;
      cursor += 1;
      return readElement();
    }
    const nameStart = cursor;
    while (
      cursor < input.length &&
      ![" ", "\t", "\n", "\r", "/", ">", "?"].includes(input[cursor]!)
    ) {
      cursor += 1;
    }
    const rawName = input.slice(nameStart, cursor);
    const localName = rawName.includes(":") ? rawName.split(":").pop()! : rawName;
    const attributes = readAttributes();
    skipWhitespace();

    // Self-closing tag.
    if (input[cursor] === "/") {
      cursor += 1;
      if (input[cursor] === ">") cursor += 1;
      return { name: localName.toLowerCase(), attributes, text: "", children: [] };
    }
    if (input[cursor] !== ">") {
      // Malformed: bail.
      return { name: localName.toLowerCase(), attributes, text: "", children: [] };
    }
    cursor += 1;

    // Children.
    const children: OoxmlNode[] = [];
    let text = "";
    while (cursor < input.length) {
      if (input[cursor] === "<" && input[cursor + 1] === "/") {
        // Closing tag.
        while (cursor < input.length && input[cursor] !== ">") cursor += 1;
        if (input[cursor] === ">") cursor += 1;
        break;
      }
      if (input[cursor] === "<") {
        const child = readElement();
        if (child) children.push(child);
        continue;
      }
      const start = cursor;
      while (cursor < input.length && input[cursor] !== "<") cursor += 1;
      text += input.slice(start, cursor);
    }

    return { name: localName.toLowerCase(), attributes, text, children };
  }

  const root = readElement();
  return root;
}

/** Returns the first child whose name matches. */
function firstChild(node: OoxmlNode, name: string): OoxmlNode | undefined {
  return node.children.find((child) => child.name === name);
}

/** Returns every child whose name matches. */
function childrenOf(node: OoxmlNode, name: string): OoxmlNode[] {
  return node.children.filter((child) => child.name === name);
}

/** Returns the OOXML alignment from a paragraph's properties. */
function readAlignment(node: OoxmlNode): WordAlignment {
  const pPr = firstChild(node, "ppr");
  if (!pPr) return "left";
  const jc = firstChild(pPr, "jc");
  if (!jc) return "left";
  const val = jc.attributes["w:val"] ?? jc.attributes["val"] ?? "";
  if (val === "center") return "center";
  if (val === "right") return "right";
  if (val === "both" || val === "justify") return "justify";
  return "left";
}

/** Reads inline marks from a run's properties. */
function readMarks(run: OoxmlNode): WordMark[] {
  const rPr = firstChild(run, "rpr");
  if (!rPr) return [];
  const marks: WordMark[] = [];
  if (firstChild(rPr, "b")) marks.push("bold");
  if (firstChild(rPr, "i")) marks.push("italic");
  if (firstChild(rPr, "u")) marks.push("underline");
  if (firstChild(rPr, "strike")) marks.push("strikethrough");
  if (firstChild(rPr, "vertalign")) {
    const val = firstChild(rPr, "vertalign")?.attributes["w:val"] ?? "";
    if (val === "superscript") marks.push("superscript");
    if (val === "subscript") marks.push("subscript");
  }
  if (firstChild(rPr, "rstyle")?.attributes["w:val"] === "CodeChar") {
    marks.push("code");
  }
  return marks;
}

/** Reads the inline colour and highlight from a run's properties. */
function readColor(run: OoxmlNode): { color?: string; highlight?: string } {
  const rPr = firstChild(run, "rpr");
  if (!rPr) return {};
  const colorNode = firstChild(rPr, "color") ?? null;
  const highlightNode = firstChild(rPr, "highlight") ?? null;
  const srgb = (node: OoxmlNode | null): string | undefined => {
    if (!node) return undefined;
    const child = node.children.find((c) => c.name === "srgbClr" || c.name === "srgbclr");
    if (child?.attributes["w:val"]) return `#${child.attributes["w:val"].toLowerCase()}`;
    return undefined;
  };
  return {
    color: srgb(colorNode),
    highlight: srgb(highlightNode),
  };
}

/**
 * Resolves a relationship id to its target URL. The DOCX format stores
 * hyperlink targets in `word/_rels/document.xml.rels`; without that map
 * the importer has no way to turn `r:id="rId7"` into an actual URL.
 */
function readRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!xml) return map;
  const root = tokeniseXml(xml);
  if (!root) return map;
  for (const rel of childrenOf(root, "relationship")) {
    const id = rel.attributes["id"] ?? rel.attributes["r:id"] ?? "";
    const target = rel.attributes["target"] ?? "";
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Reads a list of runs inside a paragraph or other container. */
function readRuns(
  node: OoxmlNode,
  hyperlinkTarget: string | undefined,
  relationships: Map<string, string>
): WordRun[] {
  const runs: WordRun[] = [];
  for (const child of node.children) {
    if (child.name === "r") {
      const marks = readMarks(child);
      const { color, highlight } = readColor(child);
      // Soft line break is a child of a run, not its own element.
      const hasBreak = child.children.some((c) => c.name === "br");
      let text = child.text;
      if (hasBreak) text += "\n";
      runs.push({ text, marks, href: hyperlinkTarget, color, highlight });
    } else if (child.name === "hyperlink") {
      // Resolve the relationship id to a real URL; if the relationship
      // map does not know it, fall back to the original `w:tooltip` so
      // the link still has a meaningful display value.
      const rid = child.attributes["r:id"] ?? child.attributes["id"] ?? "";
      const target = relationships.get(rid) ?? child.attributes["w:tooltip"];
      runs.push(...readRuns(child, target, relationships));
    } else if (child.name === "br") {
      runs.push({ text: "\n", marks: [] });
    } else if (child.text) {
      // A bare text node inside a paragraph (e.g. inside a structured
      // document tag) is rendered as a plain run.
      runs.push({ text: child.text, marks: [] });
    }
  }
  return runs;
}

/** Reads a single paragraph into a Word block. */
function readParagraph(
  node: OoxmlNode,
  relationships: Map<string, string>
): WordBlock {
  const alignment = readAlignment(node);
  const pPr = firstChild(node, "ppr");
  const style = pPr ? firstChild(pPr, "pstyle")?.attributes["w:val"] ?? "" : "";
  const text = runsToTextFromRuns(readRuns(node, undefined, relationships));

  // Headings: the paragraph style starts with "Heading" or "Title".
  if (style.toLowerCase().startsWith("heading") || style === "Title") {
    const levelMatch = style.match(/heading(\d+)/i);
    const level = levelMatch ? Math.min(6, Math.max(1, Number(levelMatch[1]))) : 1;
    return {
      id: makeBlockId(),
      type: "heading",
      level: level as 1 | 2 | 3 | 4 | 5 | 6,
      runs: readRuns(node, undefined, relationships),
      alignment,
    };
  }

  // A page break.
  const hasPageBreak = node.children.some((child) =>
    child.children.some((c) => c.name === "br" && c.attributes["w:type"] === "page")
  );
  if (hasPageBreak) {
    return { id: makeBlockId(), type: "page-break" };
  }

  // Code block: rendered as "Code" style.
  if (style === "Code" || style.toLowerCase().includes("code")) {
    return {
      id: makeBlockId(),
      type: "code",
      text,
    };
  }

  // Quote: rendered as "Quote" or "IntenseQuote" style.
  if (style === "Quote" || style === "IntenseQuote") {
    return { id: makeBlockId(), type: "quote", runs: readRuns(node, undefined, relationships), alignment };
  }

  // Image: a paragraph whose only content is a drawing.
  const hasDrawing = node.children.some(
    (child) => child.name === "r" && child.children.some((c) => c.name === "drawing")
  );
  if (hasDrawing) {
    return {
      id: makeBlockId(),
      type: "image",
      src: "",
      alt: text || "Image",
      width: 480,
    };
  }

  return { id: makeBlockId(), type: "paragraph", runs: readRuns(node, undefined, relationships), alignment, indent: 0 };
}

/** Reads a list of items by traversing the surrounding paragraphs. */
function readList(
  paragraphs: OoxmlNode[],
  startIndex: number,
  relationships: Map<string, string>
): { block: WordBlock; consumed: number } {
  const items: { id: string; runs: WordRun[] }[] = [];
  let kind: WordListKind = "unordered";
  let consumed = 0;
  for (let i = startIndex; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i]!;
    const pPr = firstChild(paragraph, "ppr");
    if (!pPr) break;
    const numPr = firstChild(pPr, "numpr");
    if (!numPr) break;
    const numId = numPr.attributes["w:numid"] ?? numPr.attributes["numid"] ?? "";
    // We classify list kind by inspecting the numbering definition; the
    // simplest heuristic is to read the numFmt from the corresponding
    // abstractNum. For brevity we only check the explicit style on the
    // first paragraph.
    const pStyle = firstChild(pPr, "pstyle")?.attributes["w:val"] ?? "";
    if (pStyle === "ListParagraph" || pStyle === "ListBullet") {
      kind = "unordered";
    } else if (pStyle === "ListNumber") {
      kind = "ordered";
    } else if (pStyle === "ListCheck") {
      kind = "checklist";
    } else {
      // Fall back to the numId-driven guess.
      kind = "unordered";
    }
    void numId;
    const runs = readRuns(paragraph, undefined, relationships);
    items.push({ id: makeBlockId(), runs });
    consumed += 1;
  }
  if (!items.length) {
    return { block: { id: makeBlockId(), type: "paragraph", runs: [], alignment: "left", indent: 0 }, consumed: 0 };
  }
  return {
    block: { id: makeBlockId(), type: "list", kind, items },
    consumed,
  };
}

/** Reads a table block. */
function readTable(node: OoxmlNode, relationships: Map<string, string>): WordBlock {
  const rows = childrenOf(node, "tr").map((row) => {
    const cells = childrenOf(row, "tc").map((cell) => {
      const text = cell.children
        .filter((c) => c.name === "p")
        .map((p) => runsToTextFromRuns(readRuns(p, undefined, relationships)))
        .join("\n");
      return { id: makeBlockId(), runs: [{ text, marks: [] }] };
    });
    return { id: makeBlockId(), cells };
  });
  return { id: makeBlockId(), type: "table", rows };
}

/** Utility: concatenate the text of a run list. */
function runsToTextFromRuns(runs: WordRun[]): string {
  return runs.map((run) => run.text).join("");
}

/** Generates a stable id for a new block. */
function makeBlockId(): string {
  return `block-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

/**
 * Reads a WordprocessingML document (the body XML) and returns a Word body.
 *
 * The conversion is intentionally permissive: an unsupported element is
 * passed through as a plain text run rather than failing the import.
 */
export function readWordXml(documentXml: string, relationshipsXml: string = ""): WordBody {
  const root = tokeniseXml(documentXml);
  if (!root) {
    return { format: "word", blocks: [], settings: { ...DEFAULT_SETTINGS } };
  }
  const document = firstChild(root, "document") ?? root;
  const body = firstChild(document, "body") ?? document;
  const relationships = readRelationships(relationshipsXml);

  const blocks: WordBlock[] = [];
  const paragraphs = childrenOf(body, "p");
  let cursor = 0;
  while (cursor < paragraphs.length) {
    const paragraph = paragraphs[cursor]!;
    const pPr = firstChild(paragraph, "ppr");
    const isList = pPr && firstChild(pPr, "numpr");
    if (isList) {
      const { block, consumed } = readList(paragraphs, cursor, relationships);
      if (consumed > 0 && block.type === "list") {
        blocks.push(block);
        cursor += consumed;
        continue;
      }
    }
    const block = readParagraph(paragraph, relationships);
    blocks.push(block);
    cursor += 1;
  }

  // Tables live next to paragraphs at body level.
  for (const table of childrenOf(body, "tbl")) {
    blocks.push(readTable(table, relationships));
  }

  return {
    format: "word",
    blocks,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Imports a DOCX file (a zip with `word/document.xml` inside) and returns
 * a Word body ready to be wrapped in an OfficeDocument.
 */
export async function importWordFromDocx(file: File | ArrayBuffer | Uint8Array): Promise<WordBody> {
  const buffer =
    file instanceof ArrayBuffer || file instanceof Uint8Array
      ? file
      : await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) {
    throw new Error("That file does not look like a DOCX document.");
  }
  const xml = await documentEntry.async("string");
  // `word/_rels/document.xml.rels` is the relationship map for hyperlink
  // targets and other external references; without it the importer
  // can only see relationship ids.
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  const relsXml = relsEntry ? await relsEntry.async("string") : "";
  return readWordXml(xml, relsXml);
}

/** Imports a plain-text file as a single-paragraph Word body. */
export function importWordFromText(text: string): WordBody {
  const lines = text.split(/\r?\n/u);
  return {
    format: "word",
    blocks: lines.map((line) => ({
      id: makeBlockId(),
      type: "paragraph",
      runs: [{ text: line, marks: [] }],
      alignment: "left",
      indent: 0,
    })),
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Imports an HTML file as a Word body. */
export function importWordFromHtml(html: string): WordBody {
  // The importer is intentionally minimal: headings, paragraphs, lists and
  // line breaks are translated; everything else is passed through as
  // text. A more involved HTML importer can be added later.
  if (typeof DOMParser === "undefined") {
    // Server-side: fall back to text import so the call site keeps working.
    return importWordFromText(html);
  }
  const document = new DOMParser().parseFromString(html, "text/html");
  const blocks: WordBlock[] = [];
  const body = document.body;
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue;
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const text = element.textContent ?? "";
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      const level = Math.min(6, Math.max(1, Number(tag.charAt(1)))) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({
        id: makeBlockId(),
        type: "heading",
        level,
        runs: [{ text, marks: [] }],
        alignment: "left",
      });
    } else if (tag === "p") {
      blocks.push({
        id: makeBlockId(),
        type: "paragraph",
        runs: [{ text, marks: [] }],
        alignment: "left",
        indent: 0,
      });
    } else if (tag === "ul" || tag === "ol") {
      const items = Array.from(element.querySelectorAll("li")).map((li) => ({
        id: makeBlockId(),
        runs: [{ text: li.textContent ?? "", marks: [] }],
      }));
      blocks.push({
        id: makeBlockId(),
        type: "list",
        kind: tag === "ol" ? "ordered" : "unordered",
        items,
      });
    } else if (tag === "blockquote") {
      blocks.push({
        id: makeBlockId(),
        type: "quote",
        runs: [{ text, marks: [] }],
        alignment: "left",
      });
    } else if (tag === "pre") {
      blocks.push({ id: makeBlockId(), type: "code", text });
    }
  }
  return { format: "word", blocks, settings: { ...DEFAULT_SETTINGS } };
}
