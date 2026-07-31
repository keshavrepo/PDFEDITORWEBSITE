/**
 * Open Packaging Conventions (OPC) helpers.
 *
 * DOCX and PPTX are ZIP packages whose parts reference each other through
 * `.rels` files. Resolving those relationships correctly is what makes images
 * and slide layouts load, so it is handled once here for both formats.
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { conversionErrors } from "../errors";

/** Node shape produced by fast-xml-parser in `preserveOrder` mode. */
export interface XmlNode {
  [key: string]: unknown;
  ":@"?: Record<string, string>;
}

export type XmlNodes = XmlNode[];

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // Whitespace is significant in `w:t` / `a:t` elements.
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  // Required for numeric character references such as `&#x2022;`, which OOXML
  // uses heavily for bullet glyphs and symbols.
  htmlEntities: true,
});

export function parseXml(xml: string): XmlNodes {
  try {
    return parser.parse(xml) as XmlNodes;
  } catch (error) {
    throw conversionErrors.corrupted("document", error);
  }
}

/** Returns the element name of a node, ignoring the attribute container. */
export function nodeName(node: XmlNode): string {
  for (const key of Object.keys(node)) {
    if (key !== ":@") return key;
  }
  return "";
}

/** Returns a node's children. */
export function children(node: XmlNode): XmlNodes {
  const name = nodeName(node);
  const value = node[name];
  return Array.isArray(value) ? (value as XmlNodes) : [];
}

export function attributes(node: XmlNode): Record<string, string> {
  return node[":@"] || {};
}

export function attr(node: XmlNode, name: string): string | undefined {
  return attributes(node)[name];
}

/** Numeric attribute reader that ignores malformed values. */
export function numAttr(node: XmlNode, name: string): number | undefined {
  const raw = attr(node, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Direct children matching a tag name. */
export function findAll(nodes: XmlNodes, name: string): XmlNodes {
  return nodes.filter((node) => nodeName(node) === name);
}

export function findFirst(nodes: XmlNodes, name: string): XmlNode | undefined {
  return nodes.find((node) => nodeName(node) === name);
}

/** Depth-first search for the first descendant with the given tag name. */
export function findDeep(nodes: XmlNodes, name: string): XmlNode | undefined {
  for (const node of nodes) {
    if (nodeName(node) === name) return node;
    const found = findDeep(children(node), name);
    if (found) return found;
  }
  return undefined;
}

/** Concatenated `#text` content of a subtree. */
export function textContent(nodes: XmlNodes): string {
  let output = "";
  for (const node of nodes) {
    if ("#text" in node) {
      output += String(node["#text"] ?? "");
      continue;
    }
    output += textContent(children(node));
  }
  return output;
}

/** True when an OOXML on/off toggle element means "on". */
export function isToggleOn(node: XmlNode | undefined): boolean {
  if (!node) return false;
  const value = attr(node, "w:val") ?? attr(node, "val");
  if (value === undefined) return true; // Presence alone means enabled.
  return value !== "0" && value !== "false" && value !== "off";
}

/* -------------------------------------------------------------------------- */
/* Package access                                                             */
/* -------------------------------------------------------------------------- */

export interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

export class OpcPackage {
  private constructor(private readonly zip: JSZip) {}

  static async open(data: Uint8Array): Promise<OpcPackage> {
    try {
      const zip = await JSZip.loadAsync(data);
      if (!zip.file("[Content_Types].xml")) {
        throw conversionErrors.corrupted("Office");
      }
      return new OpcPackage(zip);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error) throw error;
      throw conversionErrors.corrupted("Office", error);
    }
  }

  has(path: string): boolean {
    return this.zip.file(path) !== null;
  }

  async readText(path: string): Promise<string | null> {
    const file = this.zip.file(path);
    if (!file) return null;
    return file.async("string");
  }

  async readXml(path: string): Promise<XmlNodes | null> {
    const text = await this.readText(path);
    return text === null ? null : parseXml(text);
  }

  async readBinary(path: string): Promise<Uint8Array | null> {
    const file = this.zip.file(path);
    if (!file) return null;
    return file.async("uint8array");
  }

  list(prefix: string): string[] {
    return Object.keys(this.zip.files).filter((name) => name.startsWith(prefix));
  }

  /** Loads the relationship table belonging to a part. */
  async relationships(partPath: string): Promise<Map<string, Relationship>> {
    const relsPath = relationshipPath(partPath);
    const map = new Map<string, Relationship>();
    const xml = await this.readXml(relsPath);
    if (!xml) return map;

    const root = findFirst(xml, "Relationships");
    if (!root) return map;

    for (const node of findAll(children(root), "Relationship")) {
      const id = attr(node, "Id");
      const target = attr(node, "Target");
      if (!id || !target) continue;
      map.set(id, {
        id,
        type: attr(node, "Type") || "",
        target,
        external: attr(node, "TargetMode") === "External",
      });
    }
    return map;
  }
}

/** `word/document.xml` -> `word/_rels/document.xml.rels` */
export function relationshipPath(partPath: string): string {
  const index = partPath.lastIndexOf("/");
  const directory = index === -1 ? "" : partPath.slice(0, index);
  const file = index === -1 ? partPath : partPath.slice(index + 1);
  return `${directory ? `${directory}/` : ""}_rels/${file}.rels`;
}

/** Resolves a relationship target against the part that declared it. */
export function resolvePartPath(sourcePart: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);

  const index = sourcePart.lastIndexOf("/");
  const base = index === -1 ? "" : sourcePart.slice(0, index);
  const segments = base ? base.split("/") : [];

  for (const segment of target.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}
