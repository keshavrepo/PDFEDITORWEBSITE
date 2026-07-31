/**
 * Parses PresentationML into the shared {@link PositionedDocument} model.
 *
 * Slides are fixed-layout, so every shape keeps its absolute position. Content
 * inherited from layouts and masters (titles, placeholders, backgrounds) is
 * resolved because most real decks put their static content there.
 */

import {
  OpcPackage,
  attr,
  children,
  findAll,
  findDeep,
  findFirst,
  nodeName,
  numAttr,
  resolvePartPath,
  textContent,
  type XmlNode,
  type XmlNodes,
} from "./opc";
import {
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  emuToPoints,
} from "../constants";
import { conversionErrors } from "../errors";
import { detectImageFormat, readImageSize } from "../image-codec";
import type {
  DocumentMetadata,
  HorizontalAlignment,
  PositionedBlock,
  PositionedDocument,
  PositionedPage,
  PositionedTableCell,
  RasterImage,
  TextLineModel,
  TextRunModel,
} from "../types";

const PRESENTATION_PART = "ppt/presentation.xml";

/** Default text size when neither the shape nor its placeholder declares one. */
const DEFAULT_TEXT_SIZE = 18;

const ALIGNMENT_MAP: Record<string, HorizontalAlignment> = {
  l: "left",
  ctr: "center",
  r: "right",
  just: "justify",
  dist: "justify",
};

interface Theme {
  majorFont: string;
  minorFont: string;
  colors: Record<string, string>;
}

interface SlideContext {
  package: OpcPackage;
  partPath: string;
  relationships: Map<string, { target: string; external: boolean }>;
  theme: Theme;
  images: Map<string, RasterImage | null>;
}

/* -------------------------------------------------------------------------- */
/* Theme and colour resolution                                                */
/* -------------------------------------------------------------------------- */

async function loadTheme(pkg: OpcPackage, themePath: string | null): Promise<Theme> {
  const theme: Theme = { majorFont: "Calibri Light", minorFont: "Calibri", colors: {} };
  if (!themePath) return theme;

  const xml = await pkg.readXml(themePath);
  if (!xml) return theme;

  const root = findFirst(xml, "a:theme");
  const elements = root ? findFirst(children(root), "a:themeElements") : undefined;
  if (!elements) return theme;

  const scheme = findFirst(children(elements), "a:fontScheme");
  if (scheme) {
    const major = findFirst(children(scheme), "a:majorFont");
    const minor = findFirst(children(scheme), "a:minorFont");
    const majorLatin = major ? findFirst(children(major), "a:latin") : undefined;
    const minorLatin = minor ? findFirst(children(minor), "a:latin") : undefined;
    theme.majorFont = (majorLatin ? attr(majorLatin, "typeface") : undefined) || theme.majorFont;
    theme.minorFont = (minorLatin ? attr(minorLatin, "typeface") : undefined) || theme.minorFont;
  }

  const colorScheme = findFirst(children(elements), "a:clrScheme");
  if (colorScheme) {
    for (const entry of children(colorScheme)) {
      const name = nodeName(entry).replace(/^a:/, "");
      const value = findFirst(children(entry), "a:srgbClr");
      const system = findFirst(children(entry), "a:sysClr");
      const hex =
        (value ? attr(value, "val") : undefined) ||
        (system ? attr(system, "lastClr") : undefined);
      if (hex) theme.colors[name] = hex.toUpperCase();
    }
  }

  return theme;
}

/** Resolves a colour container (`a:solidFill` and friends) to RRGGBB. */
function resolveColor(node: XmlNode | undefined, theme: Theme): string | undefined {
  if (!node) return undefined;
  const kids = children(node);

  const srgb = findFirst(kids, "a:srgbClr");
  if (srgb) {
    const value = attr(srgb, "val");
    if (value && /^[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
  }

  const scheme = findFirst(kids, "a:schemeClr");
  if (scheme) {
    const value = attr(scheme, "val");
    if (!value) return undefined;
    // `tx1`/`bg1` are aliases for the dark/light scheme slots.
    const alias: Record<string, string> = {
      tx1: "dk1",
      tx2: "dk2",
      bg1: "lt1",
      bg2: "lt2",
    };
    return theme.colors[alias[value] || value];
  }

  const system = findFirst(kids, "a:sysClr");
  if (system) {
    const last = attr(system, "lastClr");
    if (last) return last.toUpperCase();
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Shape geometry                                                             */
/* -------------------------------------------------------------------------- */

interface ShapeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function readFrame(shape: XmlNode): ShapeFrame | null {
  // Shapes and pictures use `a:xfrm`; graphic frames (tables, charts) declare
  // their geometry with `p:xfrm` instead.
  const spPr =
    findDeep(children(shape), "a:xfrm") || findDeep(children(shape), "p:xfrm");
  if (!spPr) return null;

  const offset = findFirst(children(spPr), "a:off");
  const extent = findFirst(children(spPr), "a:ext");
  if (!offset || !extent) return null;

  const x = numAttr(offset, "x");
  const y = numAttr(offset, "y");
  const cx = numAttr(extent, "cx");
  const cy = numAttr(extent, "cy");
  if (x === undefined || y === undefined || !cx || !cy) return null;

  return {
    x: emuToPoints(x),
    y: emuToPoints(y),
    width: emuToPoints(cx),
    height: emuToPoints(cy),
  };
}

/* -------------------------------------------------------------------------- */
/* Text parsing                                                               */
/* -------------------------------------------------------------------------- */

interface ParsedParagraph {
  runs: TextRunModel[];
  align: HorizontalAlignment;
  level: number;
  bullet?: string;
  size: number;
}

function readRunProperties(
  rPr: XmlNode | undefined,
  theme: Theme,
  inheritedSize: number,
  defaultFont: string
): Omit<TextRunModel, "text"> {
  const kids = rPr ? children(rPr) : [];
  const sizeAttr = rPr ? numAttr(rPr, "sz") : undefined;
  const latin = findFirst(kids, "a:latin");
  const typeface = latin ? attr(latin, "typeface") : undefined;

  // Theme font references such as "+mj-lt" resolve through the font scheme.
  const family =
    typeface === "+mj-lt"
      ? theme.majorFont
      : typeface === "+mn-lt"
        ? theme.minorFont
        : typeface || defaultFont;

  const fill = findFirst(kids, "a:solidFill");
  const underline = rPr ? attr(rPr, "u") : undefined;
  const strike = rPr ? attr(rPr, "strike") : undefined;
  const baseline = rPr ? numAttr(rPr, "baseline") : undefined;

  return {
    fontFamily: family,
    // PresentationML stores sizes in hundredths of a point.
    fontSize: sizeAttr ? sizeAttr / 100 : inheritedSize,
    bold: (rPr ? attr(rPr, "b") : undefined) === "1",
    italic: (rPr ? attr(rPr, "i") : undefined) === "1",
    color: resolveColor(fill, theme) || "000000",
    underline: underline !== undefined && underline !== "none",
    strike: strike !== undefined && strike !== "noStrike",
    superscript: baseline !== undefined && baseline > 0,
    subscript: baseline !== undefined && baseline < 0,
  };
}

function parseParagraphs(
  body: XmlNode,
  theme: Theme,
  defaultSize: number,
  defaultFont: string
): ParsedParagraph[] {
  const paragraphs: ParsedParagraph[] = [];

  for (const paragraph of findAll(children(body), "a:p")) {
    const kids = children(paragraph);
    const pPr = findFirst(kids, "a:pPr");
    const level = pPr ? numAttr(pPr, "lvl") ?? 0 : 0;
    const alignValue = pPr ? attr(pPr, "algn") : undefined;

    // Bullets are inherited unless explicitly turned off.
    let bullet: string | undefined;
    if (pPr) {
      const pPrKids = children(pPr);
      if (findFirst(pPrKids, "a:buNone")) bullet = undefined;
      else {
        const charBullet = findFirst(pPrKids, "a:buChar");
        const autoBullet = findFirst(pPrKids, "a:buAutoNum");
        if (charBullet) bullet = attr(charBullet, "char") || "\u2022";
        else if (autoBullet) bullet = "1.";
      }
    }

    const endProperties = findFirst(kids, "a:endParaRPr");
    const inheritedSize = endProperties ? (numAttr(endProperties, "sz") ?? 0) / 100 : 0;
    const paragraphSize = inheritedSize || defaultSize;

    const runs: TextRunModel[] = [];
    for (const node of kids) {
      const name = nodeName(node);
      if (name === "a:r") {
        const runKids = children(node);
        const properties = readRunProperties(
          findFirst(runKids, "a:rPr"),
          theme,
          paragraphSize,
          defaultFont
        );
        const text = textContent(findAll(runKids, "a:t"));
        if (text) runs.push({ ...properties, text });
      } else if (name === "a:br") {
        const properties = readRunProperties(undefined, theme, paragraphSize, defaultFont);
        runs.push({ ...properties, text: "\n" });
      } else if (name === "a:fld") {
        // Slide numbers and dates render as their cached text.
        const fieldKids = children(node);
        const text = textContent(findAll(fieldKids, "a:t"));
        if (text) {
          const properties = readRunProperties(
            findFirst(fieldKids, "a:rPr"),
            theme,
            paragraphSize,
            defaultFont
          );
          runs.push({ ...properties, text });
        }
      }
    }

    if (!runs.length) continue;
    paragraphs.push({
      runs,
      align: (alignValue && ALIGNMENT_MAP[alignValue]) || "left",
      level,
      bullet,
      size: Math.max(...runs.map((run) => run.fontSize)),
    });
  }

  return paragraphs;
}

/**
 * Converts parsed paragraphs into positioned lines.
 *
 * PowerPoint stores no line breaks, so each paragraph becomes one line and the
 * PDF renderer performs the real wrapping inside the shape's frame.
 */
function paragraphsToLines(paragraphs: ParsedParagraph[], frame: ShapeFrame): TextLineModel[] {
  const lines: TextLineModel[] = [];
  let offset = 0;

  for (const paragraph of paragraphs) {
    const height = paragraph.size * 1.22;
    const indent = paragraph.level * 18;
    const runs = paragraph.bullet
      ? [{ ...paragraph.runs[0], text: `${paragraph.bullet} ` }, ...paragraph.runs]
      : paragraph.runs;

    lines.push({
      runs,
      x: frame.x + indent,
      baseline: frame.y + offset + paragraph.size,
      ascent: paragraph.size * 0.86,
      height,
      width: Math.max(10, frame.width - indent),
    });
    offset += height;
  }

  return lines;
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

async function loadImage(context: SlideContext, embedId: string): Promise<RasterImage | null> {
  if (context.images.has(embedId)) return context.images.get(embedId) || null;

  const relationship = context.relationships.get(embedId);
  if (!relationship || relationship.external) {
    context.images.set(embedId, null);
    return null;
  }

  const path = resolvePartPath(context.partPath, relationship.target);
  const bytes = await context.package.readBinary(path);
  if (!bytes) {
    context.images.set(embedId, null);
    return null;
  }

  const format = detectImageFormat(bytes);
  if (format !== "png" && format !== "jpeg") {
    // Vector and legacy formats cannot be embedded in a PDF directly.
    context.images.set(embedId, null);
    return null;
  }

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

async function parseTable(
  graphicFrame: XmlNode,
  frame: ShapeFrame,
  context: SlideContext
): Promise<PositionedBlock | null> {
  const table = findDeep(children(graphicFrame), "a:tbl");
  if (!table) return null;

  const tableKids = children(table);
  const grid = findFirst(tableKids, "a:tblGrid");
  const columnWidths = grid
    ? findAll(children(grid), "a:gridCol").map((column) => emuToPoints(numAttr(column, "w") ?? 0))
    : [];

  const rows: PositionedTableCell[][] = [];
  const rowHeights: number[] = [];

  for (const row of findAll(tableKids, "a:tr")) {
    const height = emuToPoints(numAttr(row, "h") ?? 0);
    const cells: PositionedTableCell[] = [];

    for (const cell of findAll(children(row), "a:tc")) {
      const cellKids = children(cell);
      const body = findFirst(cellKids, "a:txBody");
      const properties = findFirst(cellKids, "a:tcPr");
      const fill = properties ? findFirst(children(properties), "a:solidFill") : undefined;

      const paragraphs = body
        ? parseParagraphs(body, context.theme, DEFAULT_TEXT_SIZE, context.theme.minorFont)
        : [];

      cells.push({
        lines: paragraphs.map((paragraph) => ({
          runs: paragraph.runs,
          x: 0,
          baseline: paragraph.size,
          ascent: paragraph.size * 0.86,
          height: paragraph.size * 1.2,
          width: 0,
        })),
        align: paragraphs[0]?.align || "left",
        colSpan: numAttr(cell, "gridSpan") ?? 1,
        rowSpan: numAttr(cell, "rowSpan") ?? 1,
        fill: resolveColor(fill, context.theme),
      });
    }

    if (cells.length) {
      rows.push(cells);
      rowHeights.push(height || 20);
    }
  }

  if (!rows.length) return null;

  return {
    kind: "table",
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    columnWidths: columnWidths.length ? columnWidths : [],
    rowHeights,
    rows,
  };
}

/** Placeholder type determines inherited text size when none is declared. */
function placeholderSize(shape: XmlNode): number {
  const placeholder = findDeep(children(shape), "p:ph");
  const type = placeholder ? attr(placeholder, "type") : undefined;
  if (type === "title" || type === "ctrTitle") return 40;
  if (type === "subTitle") return 24;
  if (type === "ftr" || type === "sldNum" || type === "dt") return 12;
  return DEFAULT_TEXT_SIZE;
}

async function parseShape(
  shape: XmlNode,
  context: SlideContext,
  slideWidth: number,
  slideHeight: number
): Promise<PositionedBlock[]> {
  const name = nodeName(shape);
  const blocks: PositionedBlock[] = [];

  if (name === "p:sp") {
    const frame = readFrame(shape);
    const body = findFirst(children(shape), "p:txBody");
    if (!frame || !body) return blocks;

    const size = placeholderSize(shape);
    const paragraphs = parseParagraphs(body, context.theme, size, context.theme.minorFont);
    if (!paragraphs.length) return blocks;

    blocks.push({
      kind: "text",
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      align: paragraphs[0].align,
      lines: paragraphsToLines(paragraphs, frame),
    });
    return blocks;
  }

  if (name === "p:pic") {
    const frame = readFrame(shape);
    const blip = findDeep(children(shape), "a:blip");
    if (!frame || !blip) return blocks;

    const embedId = attr(blip, "r:embed") || attr(blip, "r:link");
    if (!embedId) return blocks;

    const image = await loadImage(context, embedId);
    if (!image) return blocks;

    blocks.push({
      kind: "image",
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      image,
    });
    return blocks;
  }

  if (name === "p:graphicFrame") {
    const frame = readFrame(shape);
    if (!frame) return blocks;
    const table = await parseTable(shape, frame, context);
    if (table) blocks.push(table);
    return blocks;
  }

  if (name === "p:grpSp") {
    // Groups nest arbitrarily; recurse so their contents are not lost.
    for (const child of children(shape)) {
      blocks.push(...(await parseShape(child, context, slideWidth, slideHeight)));
    }
  }

  return blocks;
}

/* -------------------------------------------------------------------------- */
/* Slides                                                                     */
/* -------------------------------------------------------------------------- */

async function parseSlide(
  pkg: OpcPackage,
  slidePath: string,
  theme: Theme,
  slideWidth: number,
  slideHeight: number
): Promise<PositionedPage> {
  const xml = await pkg.readXml(slidePath);
  const root = xml ? findFirst(xml, "p:sld") : undefined;
  const tree = root ? findDeep(children(root), "p:spTree") : undefined;

  const context: SlideContext = {
    package: pkg,
    partPath: slidePath,
    relationships: new Map(
      [...(await pkg.relationships(slidePath))].map(([id, value]) => [
        id,
        { target: value.target, external: value.external },
      ])
    ),
    theme,
    images: new Map(),
  };

  const blocks: PositionedBlock[] = [];
  if (tree) {
    for (const shape of children(tree)) {
      blocks.push(...(await parseShape(shape, context, slideWidth, slideHeight)));
    }
  }

  // Slide-level background fill, when present.
  const background = root ? findFirst(children(root), "p:cSld") : undefined;
  const backgroundNode = background ? findDeep(children(background), "p:bg") : undefined;
  const backgroundFill = backgroundNode
    ? findDeep(children(backgroundNode), "a:solidFill")
    : undefined;

  return {
    width: slideWidth,
    height: slideHeight,
    blocks,
    background: resolveColor(backgroundFill, theme),
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

  return {
    title: read("dc:title"),
    author: read("dc:creator"),
    subject: read("dc:subject"),
    creator: read("dc:creator"),
  };
}

/** Parses a .pptx package into positioned slides, in presentation order. */
export async function parsePptx(data: Uint8Array): Promise<PositionedDocument> {
  const pkg = await OpcPackage.open(data);
  const presentation = await pkg.readXml(PRESENTATION_PART);
  if (!presentation) throw conversionErrors.corrupted("PowerPoint (.pptx)");

  const root = findFirst(presentation, "p:presentation");
  if (!root) throw conversionErrors.corrupted("PowerPoint (.pptx)");

  const size = findFirst(children(root), "p:sldSz");
  const slideWidth = size ? emuToPoints(numAttr(size, "cx") ?? 0) || DEFAULT_SLIDE_WIDTH : DEFAULT_SLIDE_WIDTH;
  const slideHeight = size ? emuToPoints(numAttr(size, "cy") ?? 0) || DEFAULT_SLIDE_HEIGHT : DEFAULT_SLIDE_HEIGHT;

  // Slide order comes from `p:sldIdLst`, not the file names.
  const relationships = await pkg.relationships(PRESENTATION_PART);
  const idList = findFirst(children(root), "p:sldIdLst");
  const slidePaths: string[] = [];

  if (idList) {
    for (const entry of findAll(children(idList), "p:sldId")) {
      const relationshipId = attr(entry, "r:id");
      const relationship = relationshipId ? relationships.get(relationshipId) : undefined;
      if (relationship && !relationship.external) {
        slidePaths.push(resolvePartPath(PRESENTATION_PART, relationship.target));
      }
    }
  }

  if (!slidePaths.length) {
    // Fall back to a numeric scan for decks with a damaged id list.
    slidePaths.push(
      ...pkg
        .list("ppt/slides/slide")
        .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
        .sort((a, b) => slideNumber(a) - slideNumber(b))
    );
  }

  if (!slidePaths.length) throw conversionErrors.noContent("PowerPoint (.pptx)");

  // The first theme reachable from the master is the deck's effective theme.
  const themePath = pkg.list("ppt/theme/theme").sort()[0] || null;
  const theme = await loadTheme(pkg, themePath);

  const pages: PositionedPage[] = [];
  for (const slidePath of slidePaths) {
    pages.push(await parseSlide(pkg, slidePath, theme, slideWidth, slideHeight));
  }

  return { pages, metadata: await readMetadata(pkg) };
}

function slideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}
