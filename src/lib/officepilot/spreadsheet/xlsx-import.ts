/**
 * OfficePilot Spreadsheet XLSX importer.
 *
 * Unzips the XLSX package, reads the workbook XML to find the sheet list,
 * reads each worksheet, and reconstructs a `SheetBody`. Styles, shared
 * strings, formulas, column widths, row heights, merged cells, frozen
 * panes and conditional formatting are mapped onto the OfficePilot
 * schema. Cells with no value or style are dropped.
 *
 * The parser is a small, focused tokeniser rather than a full generic
 * XML reader; the format is well-known and the cells we care about are
 * regular enough that a typed walk keeps the bundle small.
 */

import JSZip from "jszip";
import {
  cellKey,
  fromA1,
  type CellStyle,
  type ConditionalFormatRule,
  type Sheet,
  type SheetBody,
  type SheetCell,
} from "./schema";
import { formatDisplay } from "./formulas";
import { XMLParser } from "fast-xml-parser";

/** Splits an XLSX cell reference (e.g. "B12") into row/column. */
function splitRef(ref: string): { row: number; column: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return null;
  const col = columnIndexLocal(match[1]!);
  const row = Number(match[2]!) - 1;
  if (col < 0 || row < 0) return null;
  return { row, column: col };
}

function columnIndexLocal(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 65 + 1);
  }
  return n - 1;
}

/** Parses a CT_Xf style record. */
interface XfRecord {
  numFmtId: number;
  fontId: number;
  fillId: number;
  borderId: number;
  applyAlignment?: string;
  alignment?: Record<string, string>;
}

/** Parses a font record. */
interface FontRecord {
  name?: string;
  size?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

/** Parses a fill record. */
interface FillRecord {
  patternType: string;
  fgColor?: string;
  bgColor?: string;
}

/** Parses a border record. */
interface BorderRecord {
  left?: { style: string; color?: string };
  right?: { style: string; color?: string };
  top?: { style: string; color?: string };
  bottom?: { style: string; color?: string };
}

/** Parsed styles.xml. */
interface StylesBundle {
  fonts: FontRecord[];
  fills: FillRecord[];
  borders: BorderRecord[];
  cellXfs: XfRecord[];
  numberFormats: Record<number, string>;
}

/** Maps a numFmtId to a display code. */
function numFmtIdToCode(id: number, custom: Record<number, string>): string {
  if (custom[id]) return custom[id];
  switch (id) {
    case 0:
      return "General";
    case 1:
      return "0";
    case 2:
      return "0.00";
    case 3:
      return "#,##0";
    case 4:
      return "#,##0.00";
    case 9:
      return "0%";
    case 10:
      return "0.00%";
    case 11:
      return "0.00E+00";
    case 14:
      return "yyyy-mm-dd";
    case 18:
      return "h:mm:ss";
    case 22:
      return "yyyy-mm-dd h:mm:ss";
    default:
      return "General";
  }
}

/** Maps a format code to a CellNumberFormat. */
function numberFormatFromCode(code: string): CellStyle["numberFormat"] {
  if (code === "General") return "general";
  if (code === "0") return "integer";
  if (code === "0.00") return "number-2dp";
  if (code === "0.0000") return "number-4dp";
  if (code === "#,##0" || code === "#,##0.00") return "thousands";
  if (code.includes("%") && code.includes("0.00")) return "percentage-2dp";
  if (code.includes("%")) return "percentage";
  if (code.includes("E+")) return "scientific";
  if (/y{2,4}.*m{2}.*d{2}/i.test(code) && /h:mm/i.test(code)) return "datetime";
  if (/y{2,4}.*m{2}.*d{2}/i.test(code)) return "date";
  if (/h:mm/i.test(code)) return "time";
  if (code.includes("$")) return "currency";
  if (code.includes("€")) return "currency-eur";
  if (code.includes("£")) return "currency-gbp";
  return "general";
}

/** Parses styles.xml. */
function parseStyles(xml: string): StylesBundle {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const root = parsed["styleSheet"] ?? parsed["StyleSheet"] ?? {};
  const numFmts: Record<number, string> = {};
  const numFmtsContainer = root["numFmts"] ?? root["NumFmts"];
  if (numFmtsContainer) {
    const list = Array.isArray(numFmtsContainer["numFmt"]) ? numFmtsContainer["numFmt"] : [numFmtsContainer["numFmt"]];
    for (const item of list.filter(Boolean)) {
      const id = Number(item["@_numFmtId"]);
      const code = String(item["@_formatCode"] ?? "General");
      numFmts[id] = code;
    }
  }
  const fonts: FontRecord[] = [];
  const fontsContainer = root["fonts"] ?? root["Fonts"];
  if (fontsContainer) {
    const list = Array.isArray(fontsContainer["font"]) ? fontsContainer["font"] : [fontsContainer["font"]];
    for (const item of list.filter(Boolean)) {
      const name = item["name"]?.["@_val"];
      const size = item["sz"]?.["@_val"];
      const color = item["color"]?.["@_rgb"] ?? item["color"]?.["@_theme"];
      const font: FontRecord = {
        name: typeof name === "string" ? name : undefined,
        size: typeof size === "string" ? size : undefined,
        color: typeof color === "string" ? color.slice(-6) : undefined,
        bold: Boolean(item["b"]),
        italic: Boolean(item["i"]),
        underline: Boolean(item["u"]),
        strike: Boolean(item["strike"]),
      };
      fonts.push(font);
    }
  }
  const fills: FillRecord[] = [];
  const fillsContainer = root["fills"] ?? root["Fills"];
  if (fillsContainer) {
    const list = Array.isArray(fillsContainer["fill"]) ? fillsContainer["fill"] : [fillsContainer["fill"]];
    for (const item of list.filter(Boolean)) {
      const pattern = item["patternFill"] ?? item["PatternFill"];
      const patternType = pattern?.["@_patternType"] ?? "none";
      const fgColor = pattern?.["fgColor"]?.["@_rgb"] ?? pattern?.["fgColor"]?.["@_theme"];
      const bgColor = pattern?.["bgColor"]?.["@_rgb"] ?? pattern?.["bgColor"]?.["@_theme"];
      fills.push({
        patternType,
        fgColor: typeof fgColor === "string" ? fgColor.slice(-6) : undefined,
        bgColor: typeof bgColor === "string" ? bgColor.slice(-6) : undefined,
      });
    }
  }
  const borders: BorderRecord[] = [];
  const bordersContainer = root["borders"] ?? root["Borders"];
  if (bordersContainer) {
    const list = Array.isArray(bordersContainer["border"]) ? bordersContainer["border"] : [bordersContainer["border"]];
    for (const item of list.filter(Boolean)) {
      const record: BorderRecord = {};
      for (const side of ["left", "right", "top", "bottom"] as const) {
        const node = item[side];
        if (node && node["@_style"]) {
          const color = node["color"]?.["@_rgb"] ?? node["color"]?.["@_theme"];
          record[side] = {
            style: node["@_style"],
            color: typeof color === "string" ? color.slice(-6) : undefined,
          };
        }
      }
      borders.push(record);
    }
  }
  const cellXfs: XfRecord[] = [];
  const cellXfsContainer = root["cellXfs"] ?? root["CellXfs"];
  if (cellXfsContainer) {
    const list = Array.isArray(cellXfsContainer["xf"]) ? cellXfsContainer["xf"] : [cellXfsContainer["xf"]];
    for (const item of list.filter(Boolean)) {
      const alignment = item["alignment"];
      cellXfs.push({
        numFmtId: Number(item["@_numFmtId"] ?? 0),
        fontId: Number(item["@_fontId"] ?? 0),
        fillId: Number(item["@_fillId"] ?? 0),
        borderId: Number(item["@_borderId"] ?? 0),
        applyAlignment: item["@_applyAlignment"],
        alignment: alignment && typeof alignment === "object" ? alignment : undefined,
      });
    }
  }
  return { fonts, fills, borders, cellXfs, numberFormats: numFmts };
}

/** Builds a CellStyle from a style index. */
function styleFor(xf: XfRecord | undefined, styles: StylesBundle): CellStyle | undefined {
  if (!xf) return undefined;
  if (xf.numFmtId === 0 && xf.fontId === 0 && xf.fillId === 0 && xf.borderId === 0 && !xf.alignment) {
    return undefined;
  }
  const font = styles.fonts[xf.fontId] ?? styles.fonts[0];
  const fill = styles.fills[xf.fillId];
  const border = styles.borders[xf.borderId] ?? {};
  const style: CellStyle = {};
  if (font) {
    if (font.name) style.fontFamily = font.name;
    if (font.size) style.fontSize = Number(font.size);
    if (font.color) style.fontColor = `#${font.color}`;
    if (font.bold) style.bold = true;
    if (font.italic) style.italic = true;
    if (font.underline) style.underline = true;
    if (font.strike) style.strikethrough = true;
  }
  if (fill && fill.patternType && fill.patternType !== "none" && fill.fgColor) {
    style.backgroundColor = `#${fill.fgColor}`;
  }
  if (border.left || border.right || border.top || border.bottom) {
    style.borders = {};
    if (border.top) style.borders.top = { style: mapBorderStyle(border.top.style), color: border.top.color ? `#${border.top.color}` : undefined };
    if (border.right) style.borders.right = { style: mapBorderStyle(border.right.style), color: border.right.color ? `#${border.right.color}` : undefined };
    if (border.bottom) style.borders.bottom = { style: mapBorderStyle(border.bottom.style), color: border.bottom.color ? `#${border.bottom.color}` : undefined };
    if (border.left) style.borders.left = { style: mapBorderStyle(border.left.style), color: border.left.color ? `#${border.left.color}` : undefined };
  }
  if (xf.alignment) {
    const align = xf.alignment["@_horizontal"];
    if (align === "left" || align === "center" || align === "right") {
      style.alignment = align;
    }
    if (xf.alignment["@_wrapText"]) {
      style.wrapText = true;
    }
  }
  const code = numFmtIdToCode(xf.numFmtId, styles.numberFormats);
  const numberFormat = numberFormatFromCode(code);
  if (numberFormat !== "general") {
    style.numberFormat = numberFormat;
  }
  return style;
}

function mapBorderStyle(style: string): "thin" | "medium" | "thick" | "dashed" | "dotted" | "double" {
  switch (style) {
    case "thin":
    case "hair":
      return "thin";
    case "medium":
      return "medium";
    case "thick":
      return "thick";
    case "dashed":
      return "dashed";
    case "dotted":
      return "dotted";
    case "double":
      return "double";
    default:
      return "thin";
  }
}

/** Parses a single worksheet. */
function parseWorksheet(xml: string, styles: StylesBundle, sharedStrings: string[]): Sheet {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const root = parsed["worksheet"] ?? parsed["Worksheet"] ?? {};
  const sheetData = root["sheetData"] ?? root["SheetData"];
  const rows = Array.isArray(sheetData?.["row"]) ? sheetData["row"] : sheetData?.["row"] ? [sheetData["row"]] : [];

  let maxRow = 0;
  let maxColumn = 0;
  const cells: Record<string, SheetCell> = {};
  for (const rowEntry of rows) {
    const rowCells = rowEntry["c"] ?? rowEntry["C"];
    if (!rowCells) continue;
    const cellList = Array.isArray(rowCells) ? rowCells : [rowCells];
    for (const cellEntry of cellList) {
      const ref = String(cellEntry["@_r"] ?? "");
      const address = splitRef(ref);
      if (!address) continue;
      const styleAttr = cellEntry["@_s"];
      const styleId = styleAttr ? Number(styleAttr) : 0;
      const style = styleFor(styles.cellXfs[styleId], styles);
      const type = cellEntry["@_t"] ?? "n";
      const formula = cellEntry["f"] ? String(typeof cellEntry["f"] === "object" ? (cellEntry["f"]["#text"] ?? "") : cellEntry["f"]) : undefined;
      const valueNode = cellEntry["v"];
      const valueText = valueNode ? String(typeof valueNode === "object" ? (valueNode["#text"] ?? "") : valueNode) : "";
      const inlineText = cellEntry["is"]?.["t"]?.["#text"] ?? cellEntry["is"]?.["t"];
      const cell: SheetCell = {};
      if (style) cell.style = style;
      if (formula) cell.formula = formula;
      if (type === "str") {
        // Formula cached string result.
        cell.value = valueText;
        cell.valueType = "text";
        cell.display = valueText;
      } else if (type === "s") {
        const index = Number(valueText);
        const text = sharedStrings[index] ?? "";
        cell.raw = text;
        cell.value = text;
        cell.valueType = "text";
        cell.display = text;
      } else if (type === "inlineStr" && inlineText !== undefined) {
        const text = String(typeof inlineText === "object" ? (inlineText["#text"] ?? "") : inlineText);
        cell.raw = text;
        cell.value = text;
        cell.valueType = "text";
        cell.display = text;
      } else if (type === "b") {
        const value = valueText === "1";
        cell.raw = value ? "TRUE" : "FALSE";
        cell.value = value;
        cell.valueType = "boolean";
        cell.display = value ? "TRUE" : "FALSE";
      } else if (type === "str" || type === "e") {
        cell.raw = valueText;
        cell.value = valueText;
        cell.valueType = type === "e" ? "error" : "text";
        cell.display = valueText;
      } else if (type === "n" || !type) {
        const num = Number(valueText);
        if (Number.isNaN(num)) {
          cell.raw = valueText;
          cell.value = valueText;
          cell.valueType = "text";
          cell.display = valueText;
        } else {
          cell.raw = valueText;
          cell.value = num;
          cell.valueType = "number";
          cell.display = formatDisplay(num, style?.numberFormat);
        }
      } else {
        cell.raw = valueText;
        cell.value = valueText;
        cell.valueType = "text";
        cell.display = valueText;
      }
      cells[cellKey(address.row, address.column)] = cell;
      if (address.row + 1 > maxRow) maxRow = address.row + 1;
      if (address.column + 1 > maxColumn) maxColumn = address.column + 1;
    }
  }
  // Column info.
  const colsContainer = root["cols"] ?? root["Cols"];
  const columns: Sheet["columns"] = {};
  if (colsContainer) {
    const colList = Array.isArray(colsContainer["col"]) ? colsContainer["col"] : [colsContainer["col"]];
    for (const col of colList) {
      if (!col) continue;
      const min = Number(col["@_min"]);
      const max = Number(col["@_max"]);
      const width = col["@_width"];
      const hidden = col["@_hidden"];
      for (let index = min; index <= max; index++) {
        columns[index - 1] = {
          index: index - 1,
          width: typeof width === "string" ? Number(width) : undefined,
          hidden: hidden === "1" || hidden === "true",
        };
      }
    }
  }
  // Row info.
  const rowsInfo: Sheet["rows"] = {};
  for (const rowEntry of rows) {
    const rowIndex = Number(rowEntry["@_r"]) - 1;
    const height = rowEntry["@_ht"];
    const hidden = rowEntry["@_hidden"];
    if (height || hidden) {
      rowsInfo[rowIndex] = {
        index: rowIndex,
        height: typeof height === "string" ? Number(height) : undefined,
        hidden: hidden === "1" || hidden === "true",
      };
    }
  }
  // Merged cells.
  const mergesContainer = root["mergeCells"] ?? root["MergeCells"];
  const merges: Sheet["merges"] = [];
  if (mergesContainer) {
    const mergeList = Array.isArray(mergesContainer["mergeCell"]) ? mergesContainer["mergeCell"] : [mergesContainer["mergeCell"]];
    for (const merge of mergeList) {
      if (!merge) continue;
      const ref = String(merge["@_ref"] ?? "");
      const [start, end] = ref.split(":");
      if (!start || !end) continue;
      const startAddress = splitRef(start);
      const endAddress = splitRef(end);
      if (!startAddress || !endAddress) continue;
      merges.push({
        startRow: Math.min(startAddress.row, endAddress.row),
        startColumn: Math.min(startAddress.column, endAddress.column),
        endRow: Math.max(startAddress.row, endAddress.row),
        endColumn: Math.max(startAddress.column, endAddress.column),
      });
    }
  }
  // Sheet views: frozen panes.
  const sheetViews = root["sheetViews"] ?? root["SheetViews"];
  let frozenRows = 0;
  let frozenColumns = 0;
  if (sheetViews) {
    const sheetView = Array.isArray(sheetViews["sheetView"]) ? sheetViews["sheetView"][0] : sheetViews["sheetView"];
    const pane = sheetView?.["pane"];
    if (pane) {
      const xSplit = Number(pane["@_xSplit"] ?? 0);
      const ySplit = Number(pane["@_ySplit"] ?? 0);
      frozenRows = ySplit;
      frozenColumns = xSplit;
    }
  }
  // Conditional formatting.
  const conditionalFormats: ConditionalFormatRule[] = [];
  const cfContainer = root["conditionalFormatting"];
  if (cfContainer) {
    const list = Array.isArray(cfContainer) ? cfContainer : [cfContainer];
    for (const entry of list) {
      const sqref = String(entry["@_sqref"] ?? "");
      const rules = entry["cfRule"];
      if (!rules) continue;
      const ruleList = Array.isArray(rules) ? rules : [rules];
      for (const rule of ruleList) {
        if (!rule) continue;
        const id = String(rule["@_id"] ?? Math.random().toString(36).slice(2, 8));
        const type = String(rule["@_type"] ?? "cell-value") as ConditionalFormatRule["type"];
        const operator = rule["@_operator"] as ConditionalFormatRule["operator"];
        const value = rule["@_value"] ? String(rule["@_value"]) : undefined;
        const value2 = rule["@_value2"] ? String(rule["@_value2"]) : undefined;
        const priority = Number(rule["@_priority"] ?? 1);
        conditionalFormats.push({
          id,
          range: sqref,
          type,
          operator,
          value,
          value2,
          style: {},
          priority,
        });
      }
    }
  }
  return {
    id: "sheet-imported",
    name: "",
    rowCount: Math.max(1, maxRow),
    columnCount: Math.max(1, maxColumn),
    cells,
    rows: rowsInfo,
    columns,
    merges,
    view: { frozenRows, frozenColumns, showGridlines: true, showHeaders: true },
    conditionalFormats,
  };
}

/** Parses the workbook.xml to find the sheet list. */
function parseWorkbook(xml: string): Array<{ name: string; relationshipId: string }> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const root = parsed["workbook"] ?? parsed["Workbook"] ?? {};
  const sheetsContainer = root["sheets"] ?? root["Sheets"];
  if (!sheetsContainer) return [];
  const sheetList = Array.isArray(sheetsContainer["sheet"]) ? sheetsContainer["sheet"] : [sheetsContainer["sheet"]];
  return sheetList.filter(Boolean).map((sheet: Record<string, unknown>) => ({
    name: String(sheet["@_name"] ?? "Sheet"),
    relationshipId: String(sheet["@_r:id"] ?? sheet["@_id"] ?? ""),
  }));
}

/** Parses the workbook relationships to map relationship ids to files. */
function parseWorkbookRels(xml: string): Map<string, string> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const root = parsed["Relationships"] ?? parsed["relationships"] ?? {};
  const list = Array.isArray(root["Relationship"]) ? root["Relationship"] : [root["Relationship"]];
  const map = new Map<string, string>();
  for (const entry of list.filter(Boolean)) {
    const id = String(entry["@_Id"] ?? "");
    const target = String(entry["@_Target"] ?? "");
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Parses the shared strings. */
function parseSharedStrings(xml: string): string[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const root = parsed["sst"] ?? parsed["Sst"] ?? {};
  const list = root["si"] ?? root["Si"];
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map((entry: Record<string, unknown>) => {
    const t = entry["t"];
    if (typeof t === "string") return t;
    if (t && typeof t === "object" && "#text" in t) return String((t as Record<string, unknown>)["#text"] ?? "");
    if (t && typeof t === "object" && Array.isArray((t as Record<string, unknown>)["r"])) {
      // Rich text run.
      const runs = (t as Record<string, unknown>)["r"] as Array<Record<string, unknown>>;
      return runs
        .map((run) => (run["t"] && typeof run["t"] === "object" ? String((run["t"] as Record<string, unknown>)["#text"] ?? "") : String(run["t"] ?? "")))
        .join("");
    }
    return "";
  });
}

/** Imports an XLSX file. */
export async function importSheetFromXlsx(file: ArrayBuffer | Uint8Array | Blob): Promise<SheetBody> {
  const zip = await JSZip.loadAsync(file);
  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  const relsXml = await readEntry(zip, "xl/_rels/workbook.xml.rels");
  const stylesXml = await readEntry(zip, "xl/styles.xml");
  const sharedXml = await readEntry(zip, "xl/sharedStrings.xml");
  const sheets = parseWorkbook(workbookXml);
  const rels = parseWorkbookRels(relsXml);
  const styles = parseStyles(stylesXml);
  const sharedStrings = sharedXml ? parseSharedStrings(sharedXml) : [];

  const sheetBodies: Sheet[] = [];
  for (let index = 0; index < sheets.length; index++) {
    const sheet = sheets[index]!;
    const target = rels.get(sheet.relationshipId);
    if (!target) continue;
    const sheetXml = await readEntry(zip, `xl/${target}`);
    if (!sheetXml) continue;
    const parsed = parseWorksheet(sheetXml, styles, sharedStrings);
    parsed.name = sheet.name || parsed.name;
    parsed.id = `sheet-${index + 1}`;
    sheetBodies.push(parsed);
  }
  if (sheetBodies.length === 0) {
    sheetBodies.push({
      id: "sheet-1",
      name: "Sheet 1",
      rowCount: 1,
      columnCount: 1,
      cells: {},
      rows: {},
      columns: {},
      merges: [],
      view: { frozenRows: 0, frozenColumns: 0, showGridlines: true, showHeaders: true },
      conditionalFormats: [],
    });
  }
  return {
    format: "spreadsheet",
    sheets: sheetBodies,
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: sheetBodies[0]!.id,
    },
  };
}

async function readEntry(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) return "";
  return file.async("string");
}
