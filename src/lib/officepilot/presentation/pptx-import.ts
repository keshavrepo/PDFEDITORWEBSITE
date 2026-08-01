/**
 * OfficePilot Presentation → PPTX importer.
 *
 * Unzips the PPTX package, walks the OOXML tree, and reconstructs a
 * `PresentationBody`. The importer recognises slide titles, text
 * frames, images, shapes, tables and notes. The output is best-effort:
 * complex PowerPoint features (SmartArt, charts, animations) are
 * dropped, which is the same trade-off Excel and Word importers make.
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import {
  createDefaultSlide,
  DEFAULT_DECK_SETTINGS,
  type PresentationBlock,
  type PresentationBody,
  type PresentationRun,
  type PresentationSlide,
  type PresentationTheme,
} from "./schema";

function makeBlockId(): string {
  return `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A small typed view over the parsed XML tree. */
type XmlNode = Record<string, unknown> | undefined;

/** Returns the value at `keys[0] ?? keys[1] ...` of `node`, or undefined. */
function pick(node: unknown, ...keys: string[]): XmlNode {
  if (!node || typeof node !== "object") return undefined;
  const record = node as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined) return value as XmlNode;
  }
  return undefined;
}

/** Returns the first value at any of the given attribute-prefixed keys. */
function pickAttr(node: XmlNode, ...keys: string[]): string | undefined {
  if (!node) return undefined;
  for (const key of keys) {
    const value = node[`@_${key}`];
    if (value !== undefined) return String(value);
  }
  return undefined;
}

/** Ensures the value is an array, wrapping singletons. */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Returns the text content of an XML node, unwrapping #text. */
function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if ("#text" in record) {
      const text = record["#text"];
      if (typeof text === "string") return text;
    }
  }
  return "";
}

/** Splits a text frame's properties into runs. */
function runsFromText(text: string | undefined, properties: XmlNode): PresentationRun[] {
  if (!text) return [];
  const run: PresentationRun = { text };
  if (properties) {
    if (properties["@_b"] === "1" || properties["@_b"] === "true") run.bold = true;
    if (properties["@_i"] === "1" || properties["@_i"] === "true") run.italic = true;
    if (properties["@_u"] === "sng" || properties["@_u"] === "single") run.underline = true;
    const size = properties["@_sz"];
    if (size) {
      const sizePt = Number(size) / 100;
      if (!Number.isNaN(sizePt) && sizePt > 0) run.fontSize = sizePt;
    }
    const color = properties["color"] as XmlNode;
    const srgb = color?.["srgbClr"];
    if (srgb) {
      const val = (srgb as XmlNode)?.["@_val"];
      if (val) run.color = `#${String(val).toLowerCase()}`;
    }
  }
  return [run];
}

/** Parses a single slide XML into a PresentationSlide. */
function parseSlide(xml: string, relationships: Map<string, string>): PresentationSlide {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const root = (pick(parsed, "p:sld", "sld") ?? {}) as XmlNode;
  const cSld = pick(root, "p:cSld", "cSld") as XmlNode;
  const spTree = pick(cSld, "p:spTree", "spTree") as XmlNode;
  const spList = asArray<XmlNode>(pick(spTree, "p:sp", "sp"));
  const picList = asArray<XmlNode>(pick(spTree, "p:pic", "pic"));
  const tableList = asArray<XmlNode>(pick(spTree, "p:graphicFrame", "graphicFrame"));

  const blocks: PresentationBlock[] = [];
  let title = "";
  let subtitle = "";
  let layout = "content";

  // Walk spTree children in document order.
  type Entry = { kind: "sp" | "pic" | "table"; data: XmlNode };
  const ordered: Entry[] = [];
  for (const sp of spList) ordered.push({ kind: "sp", data: sp });
  for (const pic of picList) ordered.push({ kind: "pic", data: pic });
  for (const table of tableList) ordered.push({ kind: "table", data: table });

  for (const entry of ordered) {
    if (entry.kind === "sp") {
      const sp: XmlNode = entry.data ?? {};
      const nvSpPr = pick(sp, "p:nvSpPr", "nvSpPr");
      const ph: XmlNode = (pick(nvSpPr, "p:nvPr", "nvPr", "p:cNvPr") ?? sp?.["p:cNvPr"]) as XmlNode;
      const placeholderType = pickAttr(ph, "type");
      const txBody = pick(sp, "p:txBody", "txBody");
      const paragraphs = asArray<XmlNode>(pick(txBody, "a:p", "p"));
      const runs: PresentationRun[] = [];
      const items: PresentationRun[][] = [];
      let hasBullet = false;
      for (const para of paragraphs) {
        const paraProps = pick(para, "a:pPr", "pPr");
        const buChar = pick(paraProps, "a:buChar", "buChar");
        if (buChar) hasBullet = true;
        const textRuns = asArray<XmlNode>(pick(para, "a:r", "r"));
        const paraRuns: PresentationRun[] = [];
        for (const tr of textRuns) {
          const rPr = pick(tr, "a:rPr", "rPr");
          const t = pick(tr, "a:t", "t");
          const text = textOf(t);
          if (text) {
            paraRuns.push(...runsFromText(text, rPr));
          }
        }
        if (paraRuns.length === 0) paraRuns.push({ text: "" });
        if (hasBullet) items.push(paraRuns);
        else runs.push(...paraRuns);
      }
      if (placeholderType === "title" || placeholderType === "ctrTitle") {
        title = runs.map((run) => run.text).join("");
        layout = "title";
      } else if (placeholderType === "subTitle" || placeholderType === "subTitle2") {
        subtitle = runs.map((run) => run.text).join("");
      } else if (hasBullet) {
        blocks.push({ id: makeBlockId(), type: "bullets", items });
      } else if (runs.length > 0) {
        blocks.push({ id: makeBlockId(), type: "text", runs });
      }
    } else if (entry.kind === "pic") {
      const pic = entry.data ?? {};
      const blipFill = pick(pic, "p:blipFill", "blipFill");
      const blip = pick(blipFill, "a:blip", "blip");
      const rid = pickAttr(blip, "r:embed", "embed", "r:link", "link");
      const href = rid ? relationships.get(rid) ?? "" : "";
      const spPr = pick(pic, "p:spPr", "spPr");
      const xfrm = pick(spPr, "a:xfrm", "xfrm");
      const ext = pick(xfrm, "a:ext", "ext");
      const off = pick(xfrm, "a:off", "off");
      const nvPicPr = pick(pic, "p:nvPicPr", "nvPicPr");
      const cNvPr = pick(nvPicPr, "p:cNvPr", "cNvPr");
      const picName = pickAttr(cNvPr, "name") ?? "image";
      blocks.push({
        id: makeBlockId(),
        type: "image",
        src: href,
        alt: picName,
        x: emuToPercentX(Number(off?.["@_x"] ?? 0)),
        y: emuToPercentY(Number(off?.["@_y"] ?? 0)),
        width: emuToPercentX(Number(ext?.["@_cx"] ?? 914400)),
        height: emuToPercentY(Number(ext?.["@_cy"] ?? 914400)),
      });
    } else if (entry.kind === "table") {
      const graphic = entry.data ?? {};
      const tbl = pick(graphic, "a:tbl", "tbl");
      if (tbl) {
        const rowList = asArray<XmlNode>(pick(tbl, "a:tr", "tr"));
        const tableRows: string[][] = rowList.map((row) => {
          const cellList = asArray<XmlNode>(pick(row, "a:tc", "tc"));
          return cellList.map((cell) => {
            const paraList = asArray<XmlNode>(pick(cell, "a:p", "p"));
            return paraList
              .map((para) => {
                const textRuns = asArray<XmlNode>(pick(para, "a:r", "r"));
                return textRuns.map((run) => textOf(pick(run, "a:t", "t"))).join("");
              })
              .join(" ");
          });
        });
        blocks.push({
          id: makeBlockId(),
          type: "table",
          x: 5,
          y: 20,
          width: 90,
          rows: tableRows,
          header: tableRows.length > 1,
          headerFill: "#0a0a0a",
        });
      }
    }
  }

  return {
    id: `slide-${Math.random().toString(36).slice(2, 8)}`,
    title: title || "Untitled slide",
    subtitle,
    blocks,
    transition: "fade",
    notes: "",
    layout,
  };
}

/** Converts EMU x-coordinate to a percentage of 13.333 inch slide width. */
function emuToPercentX(emu: number): number {
  const inches = emu / 914400;
  return Math.max(0, Math.min(100, (inches / 13.333) * 100));
}

/** Converts EMU y-coordinate to a percentage of 7.5 inch slide height. */
function emuToPercentY(emu: number): number {
  const inches = emu / 914400;
  return Math.max(0, Math.min(100, (inches / 7.5) * 100));
}

/** Parses the slide notes XML. */
function parseNotes(xml: string): string {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const root = pick(parsed, "p:notes", "notes") as XmlNode;
  const cSld = pick(root, "p:cSld", "cSld") as XmlNode;
  const spTree = pick(cSld, "p:spTree", "spTree") as XmlNode;
  const firstSp = asArray<XmlNode>(pick(spTree, "p:sp", "sp"))[0];
  if (!firstSp) return "";
  const txBody = pick(firstSp, "p:txBody", "txBody") as XmlNode;
  const paragraphs = asArray<XmlNode>(pick(txBody, "a:p", "p"));
  return paragraphs
    .map((para) => {
      const textRuns = asArray<XmlNode>(pick(para, "a:r", "r"));
      return textRuns.map((run) => textOf(pick(run, "a:t", "t"))).join("");
    })
    .join("\n")
    .trim();
}

/** Parses a presentation.xml relationships file. */
function parseRelationships(xml: string): Map<string, string> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const root = pick(parsed, "Relationships", "relationships") as XmlNode;
  const list = asArray<XmlNode>(root?.["Relationship"] as XmlNode);
  const map = new Map<string, string>();
  for (const entry of list) {
    const rec = entry as Record<string, unknown>;
    const id = String(rec["@_Id"] ?? rec["@_id"] ?? "");
    const target = String(rec["@_Target"] ?? rec["@_target"] ?? "");
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Parses the presentation.xml file. */
function parsePresentation(xml: string): { slideIds: Array<{ rid: string }>; theme: PresentationTheme } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const root = pick(parsed, "p:presentation", "presentation") as XmlNode;
  const sldIdLst = pick(root, "p:sldIdLst", "sldIdLst") as XmlNode;
  const sldIdArr = asArray<XmlNode>(sldIdLst?.["p:sldId"] as XmlNode);
  const slideIds = sldIdArr.map((entry) => {
    const rec = entry as Record<string, unknown>;
    return { rid: String(rec["@_r:id"] ?? rec["@_id"] ?? "") };
  });
  return { slideIds, theme: "minimal" };
}

/** Returns a PresentationBody built from a PPTX file. */
export async function importPresentationFromPptx(file: ArrayBuffer | Uint8Array | Blob): Promise<PresentationBody> {
  const zip = await JSZip.loadAsync(file);
  const presentationXml = await readEntry(zip, "ppt/presentation.xml");
  const presentationRelsXml = await readEntry(zip, "ppt/_rels/presentation.xml.rels");
  if (!presentationXml) {
    return { format: "presentation", slides: [createDefaultSlide()], settings: { ...DEFAULT_DECK_SETTINGS } };
  }
  const presentation = parsePresentation(presentationXml);
  const presentationRels = parseRelationships(presentationRelsXml);
  const slides: PresentationSlide[] = [];
  for (let i = 0; i < presentation.slideIds.length; i++) {
    const entry = presentation.slideIds[i]!;
    const target = presentationRels.get(entry.rid);
    if (!target) continue;
    const slidePath = `ppt/${target}`;
    const slideXml = await readEntry(zip, slidePath);
    if (!slideXml) continue;
    const relsPath = `ppt/${target.replace(/[^/]+$/, (segment) => `_rels/${segment}.rels`)}`;
    const relsXml = await readEntry(zip, relsPath);
    const rels = relsXml ? parseRelationships(relsXml) : new Map<string, string>();
    // Map image relationships to data URLs (best effort).
    const resolvedRels = new Map<string, string>();
    for (const [rid, t] of rels.entries()) {
      const imagePath = `ppt/${t.replace(/^\.\//, "")}`;
      const imageBlob = zip.file(imagePath);
      if (imageBlob) {
        const data = await imageBlob.async("base64");
        const mime = mimeFor(t);
        resolvedRels.set(rid, `data:${mime};base64,${data}`);
      }
    }
    const slide = parseSlide(slideXml, resolvedRels);
    const notesPath = `ppt/notesSlides/notesSlide${i + 1}.xml`;
    const notesXml = await readEntry(zip, notesPath);
    if (notesXml) {
      slide.notes = parseNotes(notesXml);
    }
    slides.push(slide);
  }
  if (slides.length === 0) slides.push(createDefaultSlide());
  return {
    format: "presentation",
    slides,
    settings: { ...DEFAULT_DECK_SETTINGS, theme: presentation.theme },
  };
}

function mimeFor(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function readEntry(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) return "";
  return file.async("string");
}
