/**
 * OfficePilot Spreadsheet text-based exporters.
 *
 * CSV, plain text and HTML. PDF export uses the browser's print API
 * against a rendered HTML preview, so it lives next to the HTML
 * exporter.
 */

import { type Sheet, type SheetBody, type SheetCell, type CellStyle } from "./schema";
import { getActiveSheet, cellText } from "./cells";

/** Escapes a CSV cell. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds a CSV string from a sheet. */
function buildCsv(sheet: Sheet, separator: string = ","): string {
  let maxRow = 0;
  let maxColumn = 0;
  for (const key of Object.keys(sheet.cells)) {
    const [r, c] = key.split(":").map(Number);
    if (typeof r === "number" && r + 1 > maxRow) maxRow = r + 1;
    if (typeof c === "number" && c + 1 > maxColumn) maxColumn = c + 1;
  }
  const rows: string[] = [];
  for (let row = 0; row < maxRow; row++) {
    const cells: string[] = [];
    for (let column = 0; column < maxColumn; column++) {
      const cell = sheet.cells[`${row}:${column}`];
      cells.push(csvEscape(cell ? cellText(cell) : ""));
    }
    rows.push(cells.join(separator));
  }
  return rows.join("\r\n");
}

/** Returns a CSV blob for a single sheet. */
export function exportSheetToCsv(body: SheetBody): Blob {
  const sheet = getActiveSheet(body);
  const csv = buildCsv(sheet);
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

/** Returns a TSV blob for a single sheet. */
export function exportSheetToTsv(body: SheetBody): Blob {
  const sheet = getActiveSheet(body);
  const tsv = buildCsv(sheet, "\t");
  return new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8" });
}

/** Returns a plain text blob. */
export function exportSheetToText(body: SheetBody): Blob {
  const sheet = getActiveSheet(body);
  return new Blob([buildCsv(sheet, "\t")], { type: "text/plain;charset=utf-8" });
}

/** Returns a self-contained HTML blob for the active sheet. */
export function exportSheetToHtml(body: SheetBody, meta: { title: string }): Blob {
  const sheet = getActiveSheet(body);
  const html = buildSheetHtml(sheet, body.settings.fontFamily, body.settings.fontSize);
  const full = `<!doctype html>
<html lang="${body.settings.locale}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.title)}</title>
<style>${sheetHtmlStyles(body.settings.fontFamily, body.settings.fontSize)}</style>
</head>
<body>
<main>
<h1>${escapeHtml(meta.title)}</h1>
${html}
</main>
</body>
</html>`;
  return new Blob([full], { type: "text/html;charset=utf-8" });
}

function sheetHtmlStyles(family: string, size: number): string {
  return `
    body { font-family: ${family}, system-ui, sans-serif; color: #0a0a0a; background: #fff; margin: 0; padding: 32px; }
    main { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    table { border-collapse: collapse; font-size: ${size}pt; }
    th, td { border: 1px solid #e5e5e5; padding: 4px 8px; min-width: 64px; height: 22px; }
    th { background: #f5f5f5; font-weight: 600; text-align: left; }
    .row-header { background: #f5f5f5; font-weight: 600; text-align: right; }
  `;
}

function buildSheetHtml(sheet: Sheet, family: string, size: number): string {
  const { rowCount, columnCount, cells, columns, rows, merges } = sheet;
  const mergeMap: Record<string, { skip: boolean; rowspan: number; colspan: number; origin: boolean }> = {};
  for (const merge of merges) {
    for (let row = merge.startRow; row <= merge.endRow; row++) {
      for (let column = merge.startColumn; column <= merge.endColumn; column++) {
        const isOrigin = row === merge.startRow && column === merge.startColumn;
        mergeMap[`${row}:${column}`] = {
          skip: !isOrigin,
          rowspan: merge.endRow - merge.startRow + 1,
          colspan: merge.endColumn - merge.startColumn + 1,
          origin: isOrigin,
        };
      }
    }
  }
  const parts: string[] = ['<table>'];
  parts.push("<thead><tr><th></th>");
  for (let column = 0; column < columnCount; column++) {
    parts.push(`<th>${columnLetter(column)}</th>`);
  }
  parts.push("</tr></thead>");
  parts.push("<tbody>");
  for (let row = 0; row < rowCount; row++) {
    if (rows[row]?.hidden) continue;
    const rowStyle = rows[row]?.height ? ` style="height:${rows[row]!.height}pt"` : "";
    parts.push(`<tr${rowStyle}><th class="row-header">${row + 1}</th>`);
    for (let column = 0; column < columnCount; column++) {
      const key = `${row}:${column}`;
      if (mergeMap[key]?.skip) continue;
      const cell = cells[key];
      const text = cell ? cellText(cell) : "";
      const style = cellStyleToHtml(cell?.style);
      const colspanAttr = mergeMap[key]?.colspan && mergeMap[key].colspan > 1 ? ` colspan="${mergeMap[key]!.colspan}"` : "";
      const rowspanAttr = mergeMap[key]?.rowspan && mergeMap[key].rowspan > 1 ? ` rowspan="${mergeMap[key]!.rowspan}"` : "";
      parts.push(`<td${colspanAttr}${rowspanAttr}${style}>${escapeHtml(text)}</td>`);
    }
    parts.push("</tr>");
  }
  parts.push("</tbody></table>");
  return parts.join("");
}

function cellStyleToHtml(style: CellStyle | undefined): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.fontFamily) parts.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize}pt`);
  if (style.fontColor) parts.push(`color:${style.fontColor}`);
  if (style.backgroundColor) parts.push(`background:${style.backgroundColor}`);
  if (style.bold) parts.push("font-weight:600");
  if (style.italic) parts.push("font-style:italic");
  if (style.underline) parts.push("text-decoration:underline");
  if (style.strikethrough) parts.push("text-decoration:line-through");
  if (style.alignment) parts.push(`text-align:${style.alignment}`);
  if (style.wrapText) parts.push("white-space:pre-wrap");
  if (style.borders) {
    if (style.borders.top) parts.push(`border-top:${borderStyle(style.borders.top)}`);
    if (style.borders.right) parts.push(`border-right:${borderStyle(style.borders.right)}`);
    if (style.borders.bottom) parts.push(`border-bottom:${borderStyle(style.borders.bottom)}`);
    if (style.borders.left) parts.push(`border-left:${borderStyle(style.borders.left)}`);
  }
  if (parts.length === 0) return "";
  return ` style="${parts.join(";")}"`;
}

function borderStyle(border: { style: string; color?: string }): string {
  const color = border.color ?? "#000";
  return `${cssBorderWidth(border.style)} solid ${color}`;
}

function cssBorderWidth(style: string): string {
  switch (style) {
    case "thin":
      return "1px";
    case "medium":
      return "2px";
    case "thick":
      return "3px";
    default:
      return "1px";
  }
}

function columnLetter(column: number): string {
  let letter = "";
  let n = column;
  while (true) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return letter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Triggers the browser's print dialog with a styled HTML preview. */
export function printSheetDocument(body: SheetBody, meta: { title: string }): void {
  if (typeof document === "undefined") return;
  const html = exportSheetToHtml(body, meta);
  void html; // Body for syntax check.
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) {
    // Fallback: write to current window via a hidden iframe and print.
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      document.body.removeChild(frame);
      return;
    }
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    doc.head.appendChild(link);
    const fullHtml = `<!doctype html><html><head>${sheetHtmlStyles(body.settings.fontFamily, body.settings.fontSize)}</head><body><main><h1>${escapeHtml(meta.title)}</h1>${buildSheetHtml(getActiveSheet(body), body.settings.fontFamily, body.settings.fontSize)}</main></body></html>`;
    doc.open();
    doc.write(fullHtml);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
    return;
  }
  win.document.open();
  const fullHtml = `<!doctype html><html><head><title>${escapeHtml(meta.title)}</title>${sheetHtmlStyles(body.settings.fontFamily, body.settings.fontSize)}</head><body><main><h1>${escapeHtml(meta.title)}</h1>${buildSheetHtml(getActiveSheet(body), body.settings.fontFamily, body.settings.fontSize)}</main></body></html>`;
  win.document.write(fullHtml);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}
