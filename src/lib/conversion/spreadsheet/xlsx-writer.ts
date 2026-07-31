/**
 * Minimal SpreadsheetML (.xlsx) writer.
 *
 * Produces a real, editable workbook: inline strings for text, native numeric
 * cells for numbers, column widths, and a small style table for bold headers.
 * Written directly rather than via a spreadsheet library because the output
 * shape is fixed and the repository already ships JSZip.
 */

import JSZip from "jszip";
import type { SheetCell, SheetModel } from "./types";

/** Converts a zero-based column index into an A1-style column name. */
export function columnName(index: number): string {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

/** Escapes text for XML content. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // XML 1.0 forbids these outright; strip rather than emit an invalid file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** Sanitises a sheet name against Excel's naming rules. */
function safeSheetName(name: string, index: number): string {
  const cleaned = (name || `Sheet${index + 1}`).replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || `Sheet${index + 1}`).slice(0, 31);
}

/**
 * Style indices written into `styles.xml`.
 * 0 = default, 1 = bold, 2 = bold + fill (header), 3 = wrapped text,
 * 4 = thousands with two decimals, 5 = bold thousands with two decimals.
 */
const STYLE_DEFAULT = 0;
const STYLE_BOLD = 1;
const STYLE_HEADER = 2;
const STYLE_WRAP = 3;
const STYLE_NUMBER = 4;
const STYLE_NUMBER_BOLD = 5;

/** True when a format code asks for grouped thousands and decimals. */
function wantsGroupedNumber(format: string | undefined): boolean {
  return Boolean(format && format.includes("#,##") && format.includes(".0"));
}

function styleIndexFor(cell: SheetCell, isHeaderRow: boolean): number {
  if (isHeaderRow) return STYLE_HEADER;
  if (wantsGroupedNumber(cell.style?.numberFormat)) {
    return cell.style?.bold ? STYLE_NUMBER_BOLD : STYLE_NUMBER;
  }
  if (cell.style?.bold) return STYLE_BOLD;
  if (cell.style?.wrapText) return STYLE_WRAP;
  return STYLE_DEFAULT;
}

function buildSheetXml(sheet: SheetModel, headerRow: number | null): string {
  // Group cells by row so the XML stays in document order.
  const rows = new Map<number, SheetCell[]>();
  for (const cell of sheet.cells) {
    const list = rows.get(cell.row);
    if (list) list.push(cell);
    else rows.set(cell.row, [cell]);
  }

  const sortedRows = [...rows.entries()].sort((a, b) => a[0] - b[0]);

  const cols = sheet.columnWidths.size
    ? `<cols>${[...sheet.columnWidths.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(
          ([index, width]) =>
            `<col min="${index + 1}" max="${index + 1}" width="${Math.max(4, Math.min(width, 255)).toFixed(2)}" customWidth="1"/>`
        )
        .join("")}</cols>`
    : "";

  const body = sortedRows
    .map(([rowIndex, cells]) => {
      const isHeader = headerRow !== null && rowIndex === headerRow;
      const cellXml = cells
        .sort((a, b) => a.column - b.column)
        .map((cell) => {
          const reference = `${columnName(cell.column)}${cell.row + 1}`;
          const style = styleIndexFor(cell, isHeader);
          const styleAttribute = style ? ` s="${style}"` : "";

          if (cell.type === "number" && typeof cell.value === "number" && Number.isFinite(cell.value)) {
            return `<c r="${reference}"${styleAttribute}><v>${cell.value}</v></c>`;
          }
          if (cell.type === "boolean" && typeof cell.value === "boolean") {
            return `<c r="${reference}"${styleAttribute} t="b"><v>${cell.value ? 1 : 0}</v></c>`;
          }
          if (!cell.text) return `<c r="${reference}"${styleAttribute}/>`;
          // Inline strings keep the writer stateless: no shared string table.
          return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.text)}</t></is></c>`;
        })
        .join("");

      const height = sheet.rowHeights.get(rowIndex);
      const heightAttribute = height ? ` ht="${height.toFixed(2)}" customHeight="1"` : "";
      return `<row r="${rowIndex + 1}"${heightAttribute}>${cellXml}</row>`;
    })
    .join("");

  const merges = sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges
        .map(
          (merge) =>
            `<mergeCell ref="${columnName(merge.firstColumn)}${merge.firstRow + 1}:${columnName(merge.lastColumn)}${merge.lastRow + 1}"/>`
        )
        .join("")}</mergeCells>`
    : "";

  const lastReference = `${columnName(Math.max(0, sheet.columnCount - 1))}${Math.max(1, sheet.rowCount)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastReference}"/><sheetViews><sheetView workbookViewId="0"${
    headerRow !== null ? `><pane ySplit="${headerRow + 1}" topLeftCell="A${headerRow + 2}" activePane="bottomLeft" state="frozen"/></sheetView` : "/"
  }></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body}</sheetData>${merges}</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEEFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export interface WriteXlsxOptions {
  title?: string;
  author?: string;
  /** Row index to freeze and style as a header, per sheet. */
  headerRows?: Array<number | null>;
}

/** Builds a complete .xlsx package from the sheet models. */
export async function writeXlsx(
  sheets: SheetModel[],
  options: WriteXlsxOptions = {}
): Promise<Uint8Array> {
  const zip = new JSZip();
  const names = sheets.map((sheet, index) => safeSheetName(sheet.name, index));

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
      .map(
        (_, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
  );

  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}</sheets></workbook>`
  );

  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
      )
      .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );

  zip.file("xl/styles.xml", STYLES_XML);

  sheets.forEach((sheet, index) => {
    zip.file(
      `xl/worksheets/sheet${index + 1}.xml`,
      buildSheetXml(sheet, options.headerRows?.[index] ?? null)
    );
  });

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(
      options.title || "Converted spreadsheet"
    )}</dc:title><dc:creator>${escapeXml(options.author || "PDFPilot")}</dc:creator><cp:lastModifiedBy>PDFPilot</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`
  );

  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PDFPilot</Application></Properties>`
  );

  const blob = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return blob;
}
