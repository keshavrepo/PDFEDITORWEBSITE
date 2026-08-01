/**
 * OfficePilot Spreadsheet → XLSX exporter.
 *
 * XLSX is just a ZIP of XML files. We assemble the package in memory and
 * hand it to JSZip. The format is the standard OOXML spreadsheet shape:
 * a workbook that references shared strings, a styles sheet and a sheet
 * per worksheet. The exporter is intentionally focused on round-tripping
 * the data OfficePilot supports: cell values, formulas, number formats,
 * borders, fonts, fills, alignment, column widths, row heights, frozen
 * panes, sheet names and multi-sheet workbooks. Conditional formatting
 * is mapped onto OOXML `<conditionalFormatting>` elements.
 */

import JSZip from "jszip";
import {
  columnLetter,
  type CellAddress,
  type CellBorder,
  type CellBorderStyle,
  type CellStyle,
  type ConditionalFormatRule,
  type Sheet,
  type SheetBody,
  type SheetCell,
} from "./schema";

/** Escapes a string for inclusion in an XML document. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Escapes a string for inclusion in an XML attribute. */
function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A registry of shared strings. */
class SharedStrings {
  private items: string[] = [];
  private map = new Map<string, number>();

  /** Returns the index of a string, adding it if not present. */
  intern(value: string): number {
    const existing = this.map.get(value);
    if (existing !== undefined) return existing;
    const index = this.items.length;
    this.items.push(value);
    this.map.set(value, index);
    return index;
  }

  /** The current item count. */
  get count(): number {
    return this.items.length;
  }

  /** The XML representation. */
  toXml(): string {
    const parts: string[] = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' +
        this.items.length +
        '" uniqueCount="' +
        this.items.length +
        '">',
    ];
    for (const item of this.items) {
      parts.push(`<si><t xml:space="preserve">${escapeXml(item)}</t></si>`);
    }
    parts.push("</sst>");
    return parts.join("");
  }
}

/** A style registry. */
class Styles {
  fonts: Array<Record<string, string>> = [{ name: "Calibri", size: "11" }];
  fills: Array<Record<string, string>> = [{ patternType: "none" }, { patternType: "gray125" }];
  borders: Array<{
    left?: CellBorder;
    right?: CellBorder;
    top?: CellBorder;
    bottom?: CellBorder;
  }> = [{}];
  numberFormats: Array<{ id: number; code: string }> = [];
  cellXfs: Array<{
    fontId: number;
    fillId: number;
    borderId: number;
    numFmtId: number;
    alignment?: string;
    applyAlignment?: string;
  }> = [{ fontId: 0, fillId: 0, borderId: 0, numFmtId: 0 }];

  /** Number-format id for a code, registering a custom one if needed. */
  private numFmtForCode(code: string): number {
    const known: Record<string, number> = {
      General: 0,
      "0": 1,
      "0.00": 2,
      "#,##0": 3,
      "#,##0.00": 4,
      "0%": 9,
      "0.00%": 10,
      "0.00E+00": 11,
      "yyyy-mm-dd": 14,
      "h:mm:ss": 18,
      "yyyy-mm-dd h:mm:ss": 22,
    };
    const builtin = known[code];
    if (builtin !== undefined) return builtin;
    let nextId = 164;
    for (const existing of this.numberFormats) {
      if (existing.id >= nextId) nextId = existing.id + 1;
    }
    this.numberFormats.push({ id: nextId, code });
    return nextId;
  }

  /** Registers a style and returns its cellXfs id. */
  registerStyle(style: CellStyle | undefined): number {
    if (!style) return 0;
    // Build font.
    const fontRecord: Record<string, string> = { name: "Calibri", size: "11" };
    if (style.fontFamily) fontRecord.name = style.fontFamily;
    if (style.fontSize) fontRecord.size = String(style.fontSize);
    if (style.fontColor) fontRecord.color = style.fontColor.replace(/^#/, "");
    if (style.bold) fontRecord.bold = "1";
    if (style.italic) fontRecord.italic = "1";
    if (style.underline) fontRecord.underline = "1";
    if (style.strikethrough) fontRecord.strike = "1";
    const fontId = this.registerOrFind(this.fonts, fontRecord);

    // Fill.
    const fillRecord: Record<string, string> = { patternType: "solid" };
    if (style.backgroundColor) fillRecord.fgColor = style.backgroundColor.replace(/^#/, "");
    else fillRecord.patternType = "none";
    const fillId = this.registerOrFind(this.fills, fillRecord);

    // Border.
    const borderRecord: {
      left?: CellBorder;
      right?: CellBorder;
      top?: CellBorder;
      bottom?: CellBorder;
    } = {};
    if (style.borders) {
      if (style.borders.top) borderRecord.top = style.borders.top;
      if (style.borders.right) borderRecord.right = style.borders.right;
      if (style.borders.bottom) borderRecord.bottom = style.borders.bottom;
      if (style.borders.left) borderRecord.left = style.borders.left;
    }
    const borderId = this.registerOrFind(this.borders, borderRecord);

    // Number format.
    const code = numberFormatCode(style.numberFormat);
    const numFmtId = this.numFmtForCode(code);

    // Alignment.
    const alignmentRecord: Record<string, string> = {};
    if (style.alignment) {
      alignmentRecord.horizontal = style.alignment;
    }
    if (style.wrapText) {
      alignmentRecord.wrapText = "1";
    }
    const alignmentXml =
      Object.keys(alignmentRecord).length > 0 ? alignmentRecord : undefined;

    const xfRecord = {
      fontId,
      fillId,
      borderId,
      numFmtId,
      alignment: alignmentXml ? mapToAttr(alignmentXml) : undefined,
      applyAlignment: alignmentXml ? "1" : undefined,
    };
    return this.registerOrFind(this.cellXfs, xfRecord);
  }

  /** Register-or-find helper. */
  private registerOrFind<T>(list: T[], item: T): number {
    const key = JSON.stringify(item);
    for (let i = 0; i < list.length; i++) {
      if (JSON.stringify(list[i]) === key) return i;
    }
    list.push(item);
    return list.length - 1;
  }

  /** The XML representation. */
  toXml(): string {
    const parts: string[] = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      `<numFmts count="${this.numberFormats.length}">`,
    ];
    for (const nf of this.numberFormats) {
      parts.push(`<numFmt numFmtId="${nf.id}" formatCode="${escapeXmlAttr(nf.code)}"/>`);
    }
    parts.push("</numFmts>");
    parts.push(`<fonts count="${this.fonts.length}">`);
    for (const font of this.fonts) {
      parts.push(
        `<font>${fontXml(font)}</font>`
      );
    }
    parts.push("</fonts>");
    parts.push(`<fills count="${this.fills.length}">`);
    for (const fill of this.fills) {
      parts.push(`<fill>${fillXml(fill)}</fill>`);
    }
    parts.push("</fills>");
    parts.push(`<borders count="${this.borders.length}">`);
    for (const border of this.borders) {
      parts.push(`<border>${borderXml(border)}</border>`);
    }
    parts.push("</borders>");
    parts.push(`<cellXfs count="${this.cellXfs.length}">`);
    for (const xf of this.cellXfs) {
      parts.push(xfRecord(xf));
    }
    parts.push("</cellXfs>");
    parts.push("</styleSheet>");
    return parts.join("");
  }
}

function mapToAttr(record: Record<string, string>): string {
  return Object.entries(record)
    .map(([k, v]) => `${k}="${escapeXmlAttr(v)}"`)
    .join(" ");
}

function fontXml(font: Record<string, string>): string {
  const parts: string[] = [`<sz val="${escapeXmlAttr(font.size ?? "11")}"/>`];
  if (font.color) {
    parts.push(`<color rgb="FF${escapeXmlAttr(font.color)}"/>`);
  }
  parts.push(`<name val="${escapeXmlAttr(font.name ?? "Calibri")}"/>`);
  if (font.bold) parts.push("<b/>");
  if (font.italic) parts.push("<i/>");
  if (font.underline) parts.push('<u val="single"/>');
  if (font.strike) parts.push("<strike/>");
  return parts.join("");
}

function fillXml(fill: Record<string, string>): string {
  const pattern = fill.patternType ?? "none";
  const fg = fill.fgColor ? `<fgColor rgb="FF${escapeXmlAttr(fill.fgColor)}"/>` : "";
  const bg = fill.bgColor ? `<bgColor rgb="FF${escapeXmlAttr(fill.bgColor)}"/>` : "";
  return `<patternFill patternType="${escapeXmlAttr(pattern)}">${fg}${bg}</patternFill>`;
}

function borderXml(border: {
  left?: CellBorder;
  right?: CellBorder;
  top?: CellBorder;
  bottom?: CellBorder;
}): string {
  const parts: string[] = [];
  for (const side of ["left", "right", "top", "bottom"] as const) {
    const b = border[side];
    parts.push(`<${side}>${borderSideXml(b)}</${side}>`);
  }
  parts.push("<diagonal/>");
  return parts.join("");
}

function borderSideXml(border: CellBorder | undefined): string {
  if (!border) return "";
  const color = border.color ? border.color.replace(/^#/, "") : "000000";
  return `<border style="${escapeXmlAttr(border.style)}"><color rgb="FF${escapeXmlAttr(color)}"/></border>`;
}

function xfRecord(xf: {
  fontId: number;
  fillId: number;
  borderId: number;
  numFmtId: number;
  alignment?: string;
  applyAlignment?: string;
}): string {
  const attrs = [
    `numFmtId="${xf.numFmtId}"`,
    `fontId="${xf.fontId}"`,
    `fillId="${xf.fillId}"`,
    `borderId="${xf.borderId}"`,
    'xfId="0"',
  ];
  if (xf.applyAlignment) attrs.push('applyAlignment="1"');
  if (xf.alignment) {
    return `<xf ${attrs.join(" ")}><alignment ${xf.alignment}/></xf>`;
  }
  return `<xf ${attrs.join(" ")}/>`;
}

function numberFormatCode(format: string | undefined): string {
  if (!format || format === "general") return "General";
  switch (format) {
    case "number":
    case "number-2dp":
      return "0.00";
    case "number-4dp":
      return "0.0000";
    case "integer":
      return "0";
    case "thousands":
      return "#,##0.00";
    case "currency":
      return '"$"#,##0.00';
    case "currency-eur":
      return '"€"#,##0.00';
    case "currency-gbp":
      return '"£"#,##0.00';
    case "percentage":
      return "0%";
    case "percentage-2dp":
      return "0.00%";
    case "scientific":
      return "0.00E+00";
    case "date":
      return "yyyy-mm-dd";
    case "time":
      return "h:mm:ss";
    case "datetime":
      return "yyyy-mm-dd h:mm:ss";
    default:
      return "General";
  }
}

/** Builds a sheet XML. */
function buildSheetXml(
  sheet: Sheet,
  sheetIndex: number,
  shared: SharedStrings,
  styles: Styles,
  workbook: SheetBody
): string {
  const showGridLines = sheet.view.showGridlines ? "1" : "0";
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    `<dimension ref="A1:${escapeXmlAttr(buildDimension(sheet))}"/>`,
    `<sheetViews><sheetView showGridLines="${showGridLines}" tabSelected="${sheetIndex === 0 ? "1" : "0"}" workbookViewId="0">`,
  ];
  if (sheet.view.frozenRows || sheet.view.frozenColumns) {
    const xSplit = sheet.view.frozenColumns;
    const ySplit = sheet.view.frozenRows;
    parts.push(
      `<pane xSplit="${xSplit}" ySplit="${ySplit}" topLeftCell="${escapeXmlAttr(
        columnLetter(xSplit) + (ySplit + 1)
      )}" activePane="bottomRight" state="frozen"/>`
    );
  }
  parts.push("</sheetView></sheetViews>");
  parts.push(`<sheetFormatPr defaultRowHeight="15"/>`);

  // Column widths.
  const columnInfo = Object.values(sheet.columns);
  if (columnInfo.length > 0) {
    parts.push("<cols>");
    for (const col of columnInfo.sort((a, b) => a.index - b.index)) {
      const min = col.index + 1;
      const max = col.index + 1;
      const width = col.width ?? 9;
      const hidden = col.hidden ? ' hidden="1"' : "";
      const customWidth = width !== 9 ? ` customWidth="1"` : "";
      parts.push(`<col min="${min}" max="${max}" width="${width}"${customWidth}${hidden}/>`);
    }
    parts.push("</cols>");
  }

  // Sheet data.
  parts.push("<sheetData>");
  const rows = collectRows(sheet);
  for (const rowIndex of rows) {
    const rowInfo = sheet.rows[rowIndex];
    const height = rowInfo?.height;
    const hidden = rowInfo?.hidden;
    const attrs: string[] = [`r="${rowIndex + 1}"`];
    if (height && height !== 15) {
      attrs.push(`ht="${height}" customHeight="1"`);
    }
    if (hidden) attrs.push('hidden="1"');
    parts.push(`<row ${attrs.join(" ")}>`);
    for (const key of Object.keys(sheet.cells)) {
      const [r, c] = key.split(":").map(Number);
      if (r !== rowIndex) continue;
      const cell = sheet.cells[key]!;
      parts.push(cellXml(cell, r, c, shared, styles));
    }
    parts.push("</row>");
  }
  parts.push("</sheetData>");

  // Merged cells.
  if (sheet.merges.length > 0) {
    parts.push(`<mergeCells count="${sheet.merges.length}">`);
    for (const merge of sheet.merges) {
      parts.push(
        `<mergeCell ref="${escapeXmlAttr(
          `${columnLetter(merge.startColumn)}${merge.startRow + 1}:${columnLetter(merge.endColumn)}${merge.endRow + 1}`
        )}"/>`
      );
    }
    parts.push("</mergeCells>");
  }

  // Conditional formatting.
  for (const rule of sheet.conditionalFormats) {
    parts.push(buildConditionalFormat(rule));
  }

  parts.push("</worksheet>");
  return parts.join("");
}

function buildDimension(sheet: Sheet): string {
  let maxRow = 0;
  let maxColumn = 0;
  for (const key of Object.keys(sheet.cells)) {
    const [r, c] = key.split(":").map(Number);
    if (typeof r === "number" && r > maxRow) maxRow = r;
    if (typeof c === "number" && c > maxColumn) maxColumn = c;
  }
  return `${columnLetter(0)}1:${columnLetter(Math.max(maxColumn, 0))}${Math.max(maxRow, 0) + 1}`;
}

function collectRows(sheet: Sheet): number[] {
  const set = new Set<number>();
  for (const key of Object.keys(sheet.cells)) {
    const [r] = key.split(":").map(Number);
    if (typeof r === "number") set.add(r);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function cellXml(cell: SheetCell, row: number, column: number, shared: SharedStrings, styles: Styles): string {
  const ref = `${columnLetter(column)}${row + 1}`;
  const styleId = styles.registerStyle(cell.style);
  const styleAttr = styleId > 0 ? ` s="${styleId}"` : "";
  if (cell.formula) {
    // Formula cells: include the formula and the cached value. The type
    // attribute tells Excel how to interpret the cached value.
    const cached = cell.value;
    if (typeof cached === "number") {
      return `<c r="${ref}"${styleAttr}><f>${escapeXml(cell.formula)}</f><v>${cached}</v></c>`;
    }
    if (typeof cached === "boolean") {
      return `<c r="${ref}"${styleAttr} t="b"><f>${escapeXml(cell.formula)}</f><v>${cached ? 1 : 0}</v></c>`;
    }
    if (typeof cached === "string" && cached.length > 0) {
      // Inline string for formula results so the file is portable
      // without forcing the consumer to walk the shared strings table.
      return `<c r="${ref}"${styleAttr} t="str"><f>${escapeXml(cell.formula)}</f><v>${escapeXml(cached)}</v></c>`;
    }
    return `<c r="${ref}"${styleAttr}><f>${escapeXml(cell.formula)}</f></c>`;
  }
  if (cell.raw === undefined) {
    return `<c r="${ref}"${styleAttr}/>`;
  }
  if (typeof cell.value === "number") {
    return `<c r="${ref}"${styleAttr}><v>${cell.value}</v></c>`;
  }
  if (typeof cell.value === "boolean") {
    return `<c r="${ref}"${styleAttr} t="b"><v>${cell.value ? 1 : 0}</v></c>`;
  }
  if (cell.value !== undefined) {
    const text = String(cell.value);
    const id = shared.intern(text);
    return `<c r="${ref}"${styleAttr} t="s"><v>${id}</v></c>`;
  }
  // String value.
  const text = cell.raw;
  const id = shared.intern(text);
  return `<c r="${ref}"${styleAttr} t="s"><v>${id}</v></c>`;
}

function buildConditionalFormat(rule: ConditionalFormatRule): string {
  const parts: string[] = [`<conditionalFormatting sqref="${escapeXmlAttr(rule.range)}">`];
  const attrs: string[] = [
    `type="${escapeXmlAttr(rule.type)}"`,
    `priority="${rule.priority}"`,
    `dxfId="0"`,
  ];
  if (rule.operator) {
    attrs.push(`operator="${escapeXmlAttr(rule.operator)}"`);
  }
  parts.push(`<cfRule ${attrs.join(" ")}/>`);
  parts.push("</conditionalFormatting>");
  return parts.join("");
}

/** Builds the workbook XML. */
function buildWorkbookXml(body: SheetBody, sheetRelationships: Array<{ id: string; sheetId: number; name: string; relationshipId: string }>): string {
  const activeId = body.settings.activeSheetId;
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<sheets>",
  ];
  for (const sheet of sheetRelationships) {
    parts.push(
      `<sheet name="${escapeXmlAttr(sheet.name)}" sheetId="${sheet.sheetId}" r:id="${sheet.relationshipId}"/>`
    );
  }
  parts.push("</sheets>");
  parts.push(`<bookViews><workbookView activeTab="${Math.max(0, body.sheets.findIndex((s) => s.id === activeId))}"/></bookViews>`);
  parts.push("</workbook>");
  return parts.join("");
}

/** Builds the workbook relationships. */
function buildWorkbookRels(sheetRelationships: Array<{ id: string; sheetId: number; name: string; relationshipId: string }>): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>',
  ];
  for (const sheet of sheetRelationships) {
    parts.push(
      `<Relationship Id="${sheet.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheet.sheetId}.xml"/>`
    );
  }
  parts.push("</Relationships>");
  return parts.join("");
}

/** Builds the root rels. */
function buildRootRels(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    "</Relationships>",
  ].join("");
}

/** Builds the content types. */
function buildContentTypes(sheetCount: number): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
  ];
  for (let i = 1; i <= sheetCount; i++) {
    parts.push(
      `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    );
  }
  parts.push("</Types>");
  return parts.join("");
}

/** Returns the XLSX file as a Blob. */
export async function exportSheetToXlsx(body: SheetBody, _meta: { title: string }): Promise<Blob> {
  const shared = new SharedStrings();
  const styles = new Styles();
  const sheetRelationships = body.sheets.map((sheet, index) => ({
    id: sheet.id,
    sheetId: index + 1,
    name: sheet.name,
    relationshipId: `rId${index + 3}`,
  }));

  // Generate sheet XMLs first so the shared strings and styles registries
  // are populated before we write their XML.
  const sheetXmls = body.sheets.map((sheet, index) => ({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    xml: buildSheetXml(sheet, index, shared, styles, body),
  }));

  const zip = new JSZip();
  zip.file("[Content_Types].xml", buildContentTypes(body.sheets.length));
  zip.file("_rels/.rels", buildRootRels());
  zip.file("xl/workbook.xml", buildWorkbookXml(body, sheetRelationships));
  zip.file("xl/_rels/workbook.xml.rels", buildWorkbookRels(sheetRelationships));
  zip.file("xl/styles.xml", styles.toXml());
  zip.file("xl/sharedStrings.xml", shared.toXml());

  for (const entry of sheetXmls) {
    zip.file(entry.name, entry.xml);
  }

  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
