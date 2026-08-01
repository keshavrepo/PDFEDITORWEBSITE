/**
 * Parses WordprocessingML into the shared {@link FlowDocument} model.
 *
 * Handles the constructs that carry meaning in real documents: styles and
 * style inheritance, direct formatting, numbering, tables (including merges),
 * inline and floating images, hyperlinks, headings, and section geometry.
 */

import {
  OpcPackage,
  attr,
  children,
  findAll,
  findDeep,
  findFirst,
  isToggleOn,
  nodeName,
  numAttr,
  resolvePartPath,
  textContent,
  type XmlNode,
  type XmlNodes,
} from "./opc";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_PAGE_HEIGHT,
  DEFAULT_PAGE_MARGIN,
  DEFAULT_PAGE_WIDTH,
  emuToPoints,
  halfPointsToPoints,
  twipsToPoints,
} from "../constants";
import { conversionErrors } from "../errors";
import { detectImageFormat, readImageSize } from "../image-codec";
import type {
  DocumentMetadata,
  FlowBlock,
  FlowDocument,
  FlowSection,
  FlowTableCell,
  HorizontalAlignment,
  RasterImage,
  TextRunModel,
} from "../types";

const DOCUMENT_PART = "word/document.xml";

interface RunFormatting {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  superscript?: boolean;
  subscript?: boolean;
  hidden?: boolean;
}

interface ParagraphFormatting {
  align?: HorizontalAlignment;
  indentLeft?: number;
  indentFirstLine?: number;
  indentHanging?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  lineHeight?: number;
  outlineLevel?: number;
  numberingId?: number;
  numberingLevel?: number;
  pageBreakBefore?: boolean;
}

interface StyleDefinition {
  id: string;
  basedOn?: string;
  name?: string;
  run: RunFormatting;
  paragraph: ParagraphFormatting;
}

interface NumberingLevel {
  format: string;
  text: string;
  start: number;
  indentLeft?: number;
}

interface DocxContext {
  package: OpcPackage;
  styles: Map<string, StyleDefinition>;
  defaultRun: RunFormatting;
  defaultParagraph: ParagraphFormatting;
  /** numId -> level -> definition */
  numbering: Map<number, Map<number, NumberingLevel>>;
  relationships: Map<string, { target: string; external: boolean }>;
  images: Map<string, RasterImage>;
  /** Live counters so ordered lists number correctly across the document. */
  counters: Map<string, number>;
}

const ALIGNMENT_MAP: Record<string, HorizontalAlignment> = {
  left: "left",
  start: "left",
  center: "center",
  centre: "center",
  right: "right",
  end: "right",
  both: "justify",
  distribute: "justify",
};

/* -------------------------------------------------------------------------- */
/* Style handling                                                             */
/* -------------------------------------------------------------------------- */

function readRunFormatting(rPr: XmlNode | undefined): RunFormatting {
  if (!rPr) return {};
  const kids = children(rPr);
  const format: RunFormatting = {};

  const fonts = findFirst(kids, "w:rFonts");
  if (fonts) {
    format.fontFamily =
      attr(fonts, "w:ascii") || attr(fonts, "w:hAnsi") || attr(fonts, "w:cs") || attr(fonts, "w:eastAsia");
  }

  const size = findFirst(kids, "w:sz");
  const sizeValue = size ? numAttr(size, "w:val") : undefined;
  if (sizeValue !== undefined) format.fontSize = halfPointsToPoints(sizeValue);

  const bold = findFirst(kids, "w:b");
  if (bold) format.bold = isToggleOn(bold);
  const italic = findFirst(kids, "w:i");
  if (italic) format.italic = isToggleOn(italic);
  const strike = findFirst(kids, "w:strike");
  if (strike) format.strike = isToggleOn(strike);
  const hidden = findFirst(kids, "w:vanish");
  if (hidden) format.hidden = isToggleOn(hidden);

  const underline = findFirst(kids, "w:u");
  if (underline) {
    const value = attr(underline, "w:val");
    format.underline = value !== undefined && value !== "none";
  }

  const color = findFirst(kids, "w:color");
  const colorValue = color ? attr(color, "w:val") : undefined;
  if (colorValue && /^[0-9a-f]{6}$/i.test(colorValue)) format.color = colorValue.toUpperCase();

  const vertAlign = findFirst(kids, "w:vertAlign");
  const vertValue = vertAlign ? attr(vertAlign, "w:val") : undefined;
  if (vertValue === "superscript") format.superscript = true;
  if (vertValue === "subscript") format.subscript = true;

  return format;
}

function readParagraphFormatting(pPr: XmlNode | undefined): ParagraphFormatting {
  if (!pPr) return {};
  const kids = children(pPr);
  const format: ParagraphFormatting = {};

  const jc = findFirst(kids, "w:jc");
  const jcValue = jc ? attr(jc, "w:val") : undefined;
  if (jcValue && ALIGNMENT_MAP[jcValue]) format.align = ALIGNMENT_MAP[jcValue];

  const indent = findFirst(kids, "w:ind");
  if (indent) {
    const left = numAttr(indent, "w:left") ?? numAttr(indent, "w:start");
    const firstLine = numAttr(indent, "w:firstLine");
    const hanging = numAttr(indent, "w:hanging");
    if (left !== undefined) format.indentLeft = twipsToPoints(left);
    if (firstLine !== undefined) format.indentFirstLine = twipsToPoints(firstLine);
    if (hanging !== undefined) format.indentHanging = twipsToPoints(hanging);
  }

  const spacing = findFirst(kids, "w:spacing");
  if (spacing) {
    const before = numAttr(spacing, "w:before");
    const after = numAttr(spacing, "w:after");
    const line = numAttr(spacing, "w:line");
    const rule = attr(spacing, "w:lineRule");
    if (before !== undefined) format.spaceBefore = twipsToPoints(before);
    if (after !== undefined) format.spaceAfter = twipsToPoints(after);
    if (line !== undefined) {
      // `auto` expresses a multiple in 240ths; the others are absolute twips.
      format.lineHeight = rule === "exact" || rule === "atLeast" ? twipsToPoints(line) / 12 : line / 240;
    }
  }

  const outline = findFirst(kids, "w:outlineLvl");
  const outlineValue = outline ? numAttr(outline, "w:val") : undefined;
  if (outlineValue !== undefined) format.outlineLevel = outlineValue + 1;

  const numPr = findFirst(kids, "w:numPr");
  if (numPr) {
    const numId = findFirst(children(numPr), "w:numId");
    const ilvl = findFirst(children(numPr), "w:ilvl");
    const id = numId ? numAttr(numId, "w:val") : undefined;
    if (id !== undefined) format.numberingId = id;
    format.numberingLevel = ilvl ? numAttr(ilvl, "w:val") ?? 0 : 0;
  }

  if (findFirst(kids, "w:pageBreakBefore")) format.pageBreakBefore = true;

  return format;
}

async function loadStyles(pkg: OpcPackage): Promise<{
  styles: Map<string, StyleDefinition>;
  defaultRun: RunFormatting;
  defaultParagraph: ParagraphFormatting;
}> {
  const styles = new Map<string, StyleDefinition>();
  let defaultRun: RunFormatting = {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
  };
  let defaultParagraph: ParagraphFormatting = {};

  const xml = await pkg.readXml("word/styles.xml");
  if (!xml) return { styles, defaultRun, defaultParagraph };

  const root = findFirst(xml, "w:styles");
  if (!root) return { styles, defaultRun, defaultParagraph };
  const kids = children(root);

  const docDefaults = findFirst(kids, "w:docDefaults");
  if (docDefaults) {
    const runDefault = findDeep(children(docDefaults), "w:rPr");
    const paragraphDefault = findDeep(children(docDefaults), "w:pPr");
    defaultRun = { ...defaultRun, ...readRunFormatting(runDefault) };
    defaultParagraph = { ...defaultParagraph, ...readParagraphFormatting(paragraphDefault) };
  }

  for (const style of findAll(kids, "w:style")) {
    const id = attr(style, "w:styleId");
    if (!id) continue;
    const styleKids = children(style);
    const basedOn = findFirst(styleKids, "w:basedOn");
    const name = findFirst(styleKids, "w:name");

    styles.set(id, {
      id,
      basedOn: basedOn ? attr(basedOn, "w:val") : undefined,
      name: name ? attr(name, "w:val") : undefined,
      run: readRunFormatting(findFirst(styleKids, "w:rPr")),
      paragraph: readParagraphFormatting(findFirst(styleKids, "w:pPr")),
    });
  }

  return { styles, defaultRun, defaultParagraph };
}

/** Resolves a style chain into effective formatting. */
function resolveStyle(
  context: DocxContext,
  styleId: string | undefined
): { run: RunFormatting; paragraph: ParagraphFormatting } {
  const run: RunFormatting = {};
  const paragraph: ParagraphFormatting = {};
  const chain: StyleDefinition[] = [];

  let current = styleId ? context.styles.get(styleId) : undefined;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.unshift(current);
    current = current.basedOn ? context.styles.get(current.basedOn) : undefined;
  }

  // Base styles first so derived styles win.
  for (const style of chain) {
    Object.assign(run, definedOnly(style.run));
    Object.assign(paragraph, definedOnly(style.paragraph));
  }
  return { run, paragraph };
}

function definedOnly<T extends object>(value: T): Partial<T> {
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) output[key] = entry;
  }
  return output as Partial<T>;
}

/* -------------------------------------------------------------------------- */
/* Numbering                                                                  */
/* -------------------------------------------------------------------------- */

async function loadNumbering(pkg: OpcPackage): Promise<Map<number, Map<number, NumberingLevel>>> {
  const result = new Map<number, Map<number, NumberingLevel>>();
  const xml = await pkg.readXml("word/numbering.xml");
  if (!xml) return result;

  const root = findFirst(xml, "w:numbering");
  if (!root) return result;
  const kids = children(root);

  // abstractNumId -> levels
  const abstract = new Map<number, Map<number, NumberingLevel>>();
  for (const node of findAll(kids, "w:abstractNum")) {
    const id = numAttr(node, "w:abstractNumId");
    if (id === undefined) continue;
    const levels = new Map<number, NumberingLevel>();

    for (const lvl of findAll(children(node), "w:lvl")) {
      const level = numAttr(lvl, "w:ilvl");
      if (level === undefined) continue;
      const lvlKids = children(lvl);
      const format = findFirst(lvlKids, "w:numFmt");
      const text = findFirst(lvlKids, "w:lvlText");
      const start = findFirst(lvlKids, "w:start");
      const indent = findDeep(lvlKids, "w:ind");

      levels.set(level, {
        format: (format ? attr(format, "w:val") : undefined) || "bullet",
        text: (text ? attr(text, "w:val") : undefined) || "\u2022",
        start: (start ? numAttr(start, "w:val") : undefined) ?? 1,
        indentLeft: indent ? twipsToPoints(numAttr(indent, "w:left") ?? 0) : undefined,
      });
    }
    abstract.set(id, levels);
  }

  // num -> abstractNum, honouring level overrides.
  for (const node of findAll(kids, "w:num")) {
    const numId = numAttr(node, "w:numId");
    if (numId === undefined) continue;
    const link = findFirst(children(node), "w:abstractNumId");
    const abstractId = link ? numAttr(link, "w:val") : undefined;
    if (abstractId === undefined) continue;

    const levels = new Map(abstract.get(abstractId) || []);
    for (const override of findAll(children(node), "w:lvlOverride")) {
      const level = numAttr(override, "w:ilvl");
      if (level === undefined) continue;
      const startOverride = findFirst(children(override), "w:startOverride");
      const existing = levels.get(level);
      const startValue = startOverride ? numAttr(startOverride, "w:val") : undefined;
      if (existing && startValue !== undefined) {
        levels.set(level, { ...existing, start: startValue });
      }
    }
    result.set(numId, levels);
  }

  return result;
}

const ROMAN = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
  [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
] as const;

function toRoman(value: number): string {
  let remaining = value;
  let output = "";
  for (const [amount, numeral] of ROMAN) {
    while (remaining >= amount) {
      output += numeral;
      remaining -= amount;
    }
  }
  return output;
}

function formatNumber(value: number, format: string): string {
  switch (format) {
    case "decimalZero":
      return value.toString().padStart(2, "0");
    case "upperLetter":
      return String.fromCharCode(64 + ((value - 1) % 26) + 1);
    case "lowerLetter":
      return String.fromCharCode(96 + ((value - 1) % 26) + 1);
    case "upperRoman":
      return toRoman(value).toUpperCase();
    case "lowerRoman":
      return toRoman(value);
    default:
      return String(value);
  }
}

/** Produces the visible marker, advancing the live counters. */
function resolveMarker(
  context: DocxContext,
  numberingId: number,
  level: number
): { ordered: boolean; marker: string; indentLeft?: number } | null {
  const levels = context.numbering.get(numberingId);
  const definition = levels?.get(level);
  if (!definition) return null;

  if (definition.format === "none") return null;
  if (definition.format === "bullet") {
    // Word stores Wingdings glyphs here; normalise to portable bullets.
    const raw = definition.text.trim();
    const marker = /^[\uF000-\uF0FF]$/.test(raw) || !raw ? ["\u2022", "\u25E6", "\u25AA"][level % 3] : raw;
    return { ordered: false, marker, indentLeft: definition.indentLeft };
  }

  const key = `${numberingId}:${level}`;
  const next = (context.counters.get(key) ?? definition.start - 1) + 1;
  context.counters.set(key, next);

  // Deeper levels restart when an ancestor advances.
  for (const [existing] of context.counters) {
    const [id, existingLevel] = existing.split(":").map(Number);
    if (id === numberingId && existingLevel > level) context.counters.delete(existing);
  }

  // `%1.` style templates reference each ancestor level.
  const marker = definition.text.replace(/%(\d)/g, (_, group: string) => {
    const referenced = Number(group) - 1;
    if (referenced === level) return formatNumber(next, definition.format);
    const ancestor = context.counters.get(`${numberingId}:${referenced}`);
    const ancestorLevel = levels?.get(referenced);
    return formatNumber(ancestor ?? ancestorLevel?.start ?? 1, ancestorLevel?.format || "decimal");
  });

  return { ordered: true, marker, indentLeft: definition.indentLeft };
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

async function loadImage(context: DocxContext, embedId: string): Promise<RasterImage | null> {
  const cached = context.images.get(embedId);
  if (cached) return cached;

  const relationship = context.relationships.get(embedId);
  if (!relationship || relationship.external) return null;

  const path = resolvePartPath(DOCUMENT_PART, relationship.target);
  const bytes = await context.package.readBinary(path);
  if (!bytes) return null;

  const format = detectImageFormat(bytes);
  // PDF embedding supports PNG and JPEG; other formats are skipped rather than
  // silently corrupting the output.
  if (format !== "png" && format !== "jpeg") return null;

  const size = readImageSize(bytes, format);
  const image: RasterImage = {
    data: bytes,
    format,
    pixelWidth: size?.width || 0,
    pixelHeight: size?.height || 0,
  };
  context.images.set(embedId, image);
  return image;
}

/** Reads an inline or floating drawing. */
async function parseDrawing(context: DocxContext, drawing: XmlNode): Promise<FlowBlock | null> {
  const extent = findDeep(children(drawing), "wp:extent");
  const blip = findDeep(children(drawing), "a:blip");
  if (!blip) return null;

  const embedId = attr(blip, "r:embed") || attr(blip, "r:link");
  if (!embedId) return null;

  const image = await loadImage(context, embedId);
  if (!image) return null;

  const cx = extent ? numAttr(extent, "cx") : undefined;
  const cy = extent ? numAttr(extent, "cy") : undefined;
  // Fall back to intrinsic size at 96 DPI when the extent is missing.
  const width = cx ? emuToPoints(cx) : (image.pixelWidth * 72) / 96;
  const height = cy ? emuToPoints(cy) : (image.pixelHeight * 72) / 96;

  return {
    kind: "image",
    image,
    width: Math.max(1, width),
    height: Math.max(1, height),
    align: "left",
  };
}

/* -------------------------------------------------------------------------- */
/* Paragraphs, runs and tables                                                */
/* -------------------------------------------------------------------------- */

function buildRun(text: string, format: RunFormatting): TextRunModel {
  return {
    text,
    fontFamily: format.fontFamily || DEFAULT_FONT_FAMILY,
    fontSize: format.fontSize ?? DEFAULT_FONT_SIZE,
    bold: Boolean(format.bold),
    italic: Boolean(format.italic),
    color: format.color || "000000",
    underline: format.underline,
    strike: format.strike,
    superscript: format.superscript,
    subscript: format.subscript,
  };
}

async function parseParagraph(context: DocxContext, paragraph: XmlNode): Promise<FlowBlock[]> {
  const kids = children(paragraph);
  const pPr = findFirst(kids, "w:pPr");
  const styleNode = pPr ? findFirst(children(pPr), "w:pStyle") : undefined;
  const styleId = styleNode ? attr(styleNode, "w:val") : undefined;

  const resolved = resolveStyle(context, styleId);
  const direct = readParagraphFormatting(pPr);
  const paragraphFormat: ParagraphFormatting = {
    ...context.defaultParagraph,
    ...resolved.paragraph,
    ...definedOnly(direct),
  };

  const paragraphRunFormat: RunFormatting = {
    ...context.defaultRun,
    ...resolved.run,
    ...definedOnly(readRunFormatting(pPr ? findFirst(children(pPr), "w:rPr") : undefined)),
  };

  const blocks: FlowBlock[] = [];
  const runs: TextRunModel[] = [];
  const emitted: FlowBlock[] = [];

  const pushRuns = async (nodes: XmlNodes, inheritedFormat: RunFormatting) => {
    for (const node of nodes) {
      const name = nodeName(node);

      if (name === "w:r") {
        const runKids = children(node);
        const runFormat: RunFormatting = {
          ...inheritedFormat,
          ...definedOnly(readRunFormatting(findFirst(runKids, "w:rPr"))),
        };
        if (runFormat.hidden) continue;

        for (const child of runKids) {
          const childName = nodeName(child);
          if (childName === "w:t") {
            runs.push(buildRun(textContent([child]), runFormat));
          } else if (childName === "w:tab") {
            runs.push(buildRun("\t", runFormat));
          } else if (childName === "w:br") {
            const type = attr(child, "w:type");
            if (type === "page") {
              // A page break inside a paragraph splits it.
              emitted.push({ kind: "page-break" });
            } else {
              runs.push(buildRun("\n", runFormat));
            }
          } else if (childName === "w:drawing" || childName === "w:pict") {
            const image = await parseDrawing(context, child);
            if (image) emitted.push(image);
          } else if (childName === "w:noBreakHyphen") {
            runs.push(buildRun("\u2011", runFormat));
          } else if (childName === "w:sym") {
            const char = attr(child, "w:char");
            if (char) runs.push(buildRun(String.fromCharCode(parseInt(char, 16)), runFormat));
          }
        }
        continue;
      }

      if (name === "w:hyperlink" || name === "w:smartTag" || name === "w:sdt") {
        // Containers: recurse so their runs are preserved.
        const container = name === "w:sdt" ? findDeep(children(node), "w:sdtContent") : node;
        await pushRuns(children(container || node), inheritedFormat);
        continue;
      }

      if (name === "w:ins") {
        // Accepted tracked insertions are part of the text.
        await pushRuns(children(node), inheritedFormat);
        continue;
      }
      // `w:del` (tracked deletions) is intentionally skipped.
    }
  };

  await pushRuns(kids, paragraphRunFormat);

  if (paragraphFormat.pageBreakBefore) blocks.push({ kind: "page-break" });

  let list: { ordered: boolean; level: number; marker: string } | undefined;
  let listIndent: number | undefined;
  if (paragraphFormat.numberingId !== undefined) {
    const marker = resolveMarker(
      context,
      paragraphFormat.numberingId,
      paragraphFormat.numberingLevel || 0
    );
    if (marker) {
      list = {
        ordered: marker.ordered,
        level: paragraphFormat.numberingLevel || 0,
        marker: marker.marker,
      };
      listIndent = marker.indentLeft;
    }
  }

  const hasText = runs.some((run) => run.text.length > 0);
  const headingLevel =
    paragraphFormat.outlineLevel && paragraphFormat.outlineLevel <= 6
      ? paragraphFormat.outlineLevel
      : headingFromStyleName(context, styleId);

  if (hasText || (!emitted.length && !blocks.length)) {
    const indentLeft = paragraphFormat.indentLeft ?? listIndent ?? 0;
    blocks.push({
      kind: "paragraph",
      runs: runs.length ? runs : [buildRun("", paragraphRunFormat)],
      align: paragraphFormat.align || "left",
      headingLevel,
      indentLeft,
      indentFirstLine:
        (paragraphFormat.indentFirstLine ?? 0) - (paragraphFormat.indentHanging ?? 0),
      spaceBefore: paragraphFormat.spaceBefore ?? 0,
      spaceAfter: paragraphFormat.spaceAfter ?? 0,
      lineHeight: paragraphFormat.lineHeight ?? 1.15,
      list,
    });
  }

  blocks.push(...emitted);
  return blocks;
}

function headingFromStyleName(context: DocxContext, styleId: string | undefined): number | undefined {
  if (!styleId) return undefined;
  const style = context.styles.get(styleId);
  const name = (style?.name || styleId).toLowerCase().replace(/\s+/g, "");
  const match = name.match(/^heading(\d)$/);
  if (match) return Number(match[1]);
  if (name === "title") return 1;
  if (name === "subtitle") return 2;
  return undefined;
}

async function parseTable(context: DocxContext, table: XmlNode): Promise<FlowBlock> {
  const kids = children(table);
  const grid = findFirst(kids, "w:tblGrid");
  const columnWidths = grid
    ? findAll(children(grid), "w:gridCol").map((col) => twipsToPoints(numAttr(col, "w:w") ?? 0))
    : [];

  const tblPr = findFirst(kids, "w:tblPr");
  const borders = tblPr ? findFirst(children(tblPr), "w:tblBorders") : undefined;
  const hasBorders = Boolean(borders) && !isBorderNone(borders);

  // `w:tblW` decides how the grid columns should be interpreted. With `pct` or
  // `auto` the grid values are only proportions, so absolute widths would be
  // meaningless (producers commonly emit 100 twips per column).
  const tblW = tblPr ? findFirst(children(tblPr), "w:tblW") : undefined;
  const widthType = tblW ? attr(tblW, "w:type") : undefined;
  const rawWidth = tblW ? attr(tblW, "w:w") : undefined;
  const widthPercent =
    widthType === "pct" && rawWidth
      ? // Percentages are either "100%" or fiftieths of a percent.
        Math.min(100, rawWidth.endsWith("%") ? parseFloat(rawWidth) : Number(rawWidth) / 50)
      : undefined;
  const proportionalColumns = widthType === "pct" || widthType === "auto" || !widthType;

  const rows: FlowTableCell[][] = [];
  for (const row of findAll(kids, "w:tr")) {
    const cells: FlowTableCell[] = [];
    for (const cell of findAll(children(row), "w:tc")) {
      const cellKids = children(cell);
      const tcPr = findFirst(cellKids, "w:tcPr");
      const span = tcPr ? findFirst(children(tcPr), "w:gridSpan") : undefined;
      const merge = tcPr ? findFirst(children(tcPr), "w:vMerge") : undefined;
      const shade = tcPr ? findFirst(children(tcPr), "w:shd") : undefined;
      const fill = shade ? attr(shade, "w:fill") : undefined;

      const blocks: FlowBlock[] = [];
      for (const child of cellKids) {
        const name = nodeName(child);
        if (name === "w:p") blocks.push(...(await parseParagraph(context, child)));
        else if (name === "w:tbl") blocks.push(await parseTable(context, child));
      }

      const mergeValue = merge ? attr(merge, "w:val") : undefined;
      cells.push({
        blocks,
        colSpan: span ? numAttr(span, "w:val") ?? 1 : 1,
        rowSpan: 1,
        fill: fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toUpperCase() !== "AUTO" ? fill.toUpperCase() : undefined,
        verticalMerge: merge ? (mergeValue === "restart" ? "restart" : "continue") : undefined,
      });
    }
    if (cells.length) rows.push(cells);
  }

  resolveVerticalMerges(rows);
  return {
    kind: "table",
    rows,
    columnWidths,
    hasBorders,
    proportionalColumns,
    widthPercent,
  };
}

function isBorderNone(borders: XmlNode | undefined): boolean {
  if (!borders) return true;
  return children(borders).every((border) => {
    const value = attr(border, "w:val");
    return value === "none" || value === "nil";
  });
}

/** Converts Word's continuation markers into concrete row spans. */
function resolveVerticalMerges(rows: FlowTableCell[][]): void {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    for (let cellIndex = 0; cellIndex < rows[rowIndex].length; cellIndex++) {
      const cell = rows[rowIndex][cellIndex];
      if (cell.verticalMerge !== "restart") continue;

      let span = 1;
      for (let next = rowIndex + 1; next < rows.length; next++) {
        const candidate = rows[next][cellIndex];
        if (!candidate || candidate.verticalMerge !== "continue") break;
        span++;
      }
      cell.rowSpan = span;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Sections and metadata                                                      */
/* -------------------------------------------------------------------------- */

function readSectionGeometry(sectPr: XmlNode | undefined): Omit<FlowSection, "blocks"> {
  const fallback = {
    pageWidth: DEFAULT_PAGE_WIDTH,
    pageHeight: DEFAULT_PAGE_HEIGHT,
    margins: {
      top: DEFAULT_PAGE_MARGIN,
      right: DEFAULT_PAGE_MARGIN,
      bottom: DEFAULT_PAGE_MARGIN,
      left: DEFAULT_PAGE_MARGIN,
    },
  };
  if (!sectPr) return fallback;

  const kids = children(sectPr);
  const size = findFirst(kids, "w:pgSz");
  const margin = findFirst(kids, "w:pgMar");

  const width = size ? numAttr(size, "w:w") : undefined;
  const height = size ? numAttr(size, "w:h") : undefined;
  const landscape = size ? attr(size, "w:orient") === "landscape" : false;

  let pageWidth = width ? twipsToPoints(width) : fallback.pageWidth;
  let pageHeight = height ? twipsToPoints(height) : fallback.pageHeight;
  // Some producers set the orientation flag without swapping the dimensions.
  if (landscape && pageHeight > pageWidth) {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }

  return {
    pageWidth,
    pageHeight,
    margins: {
      top: Math.abs(margin ? twipsToPoints(numAttr(margin, "w:top") ?? 1440) : DEFAULT_PAGE_MARGIN),
      right: Math.abs(margin ? twipsToPoints(numAttr(margin, "w:right") ?? 1440) : DEFAULT_PAGE_MARGIN),
      bottom: Math.abs(margin ? twipsToPoints(numAttr(margin, "w:bottom") ?? 1440) : DEFAULT_PAGE_MARGIN),
      left: Math.abs(margin ? twipsToPoints(numAttr(margin, "w:left") ?? 1440) : DEFAULT_PAGE_MARGIN),
    },
  };
}

async function readMetadata(pkg: OpcPackage): Promise<DocumentMetadata> {
  const xml = await pkg.readXml("docProps/core.xml");
  if (!xml) return {};
  const root = findFirst(xml, "cp:coreProperties");
  if (!root) return {};
  const kids = children(root);

  const read = (name: string) => {
    const node = findFirst(kids, name);
    const value = node ? textContent([node]).trim() : "";
    return value || undefined;
  };
  const keywords = read("cp:keywords");

  return {
    title: read("dc:title"),
    author: read("dc:creator"),
    subject: read("dc:subject"),
    creator: read("dc:creator"),
    keywords: keywords ? keywords.split(/[,;]\s*/).filter(Boolean) : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Parses a .docx package into the shared flow model. */
export async function parseDocx(data: Uint8Array): Promise<FlowDocument> {
  const pkg = await OpcPackage.open(data);
  const documentXml = await pkg.readXml(DOCUMENT_PART);
  if (!documentXml) throw conversionErrors.corrupted("Word (.docx)");

  const root = findFirst(documentXml, "w:document");
  const body = root ? findFirst(children(root), "w:body") : undefined;
  if (!body) throw conversionErrors.corrupted("Word (.docx)");

  const { styles, defaultRun, defaultParagraph } = await loadStyles(pkg);
  const relationshipTable = await pkg.relationships(DOCUMENT_PART);

  const context: DocxContext = {
    package: pkg,
    styles,
    defaultRun,
    defaultParagraph,
    numbering: await loadNumbering(pkg),
    relationships: new Map(
      [...relationshipTable].map(([id, value]) => [id, { target: value.target, external: value.external }])
    ),
    images: new Map(),
    counters: new Map(),
  };

  const bodyChildren = children(body);
  const sections: FlowSection[] = [];
  let blocks: FlowBlock[] = [];

  for (const node of bodyChildren) {
    const name = nodeName(node);

    if (name === "w:p") {
      const pPr = findFirst(children(node), "w:pPr");
      const sectPr = pPr ? findFirst(children(pPr), "w:sectPr") : undefined;
      blocks.push(...(await parseParagraph(context, node)));

      // A sectPr inside a paragraph closes the current section.
      if (sectPr) {
        sections.push({ ...readSectionGeometry(sectPr), blocks });
        blocks = [];
      }
      continue;
    }

    if (name === "w:tbl") {
      blocks.push(await parseTable(context, node));
      continue;
    }

    if (name === "w:sectPr") {
      sections.push({ ...readSectionGeometry(node), blocks });
      blocks = [];
    }
  }

  if (blocks.length || !sections.length) {
    const finalSectPr = findAll(bodyChildren, "w:sectPr").at(-1);
    sections.push({ ...readSectionGeometry(finalSectPr), blocks });
  }

  const hasContent = sections.some((section) =>
    section.blocks.some(
      (block) =>
        (block.kind === "paragraph" && block.runs.some((run) => run.text.trim())) ||
        block.kind === "image" ||
        block.kind === "table"
    )
  );
  if (!hasContent) throw conversionErrors.noContent("Word (.docx)");

  return { sections, metadata: await readMetadata(pkg) };
}
