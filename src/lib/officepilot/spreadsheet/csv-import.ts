/**
 * OfficePilot Spreadsheet CSV importer.
 *
 * Hand-rolled CSV parser supporting quoted fields, escaped quotes and
 * CRLF/LF line endings. Tab-separated values are also supported (Excel
 * emits TSV when the user copies from the clipboard). The output is a
 * fresh `SheetBody` with a single sheet.
 */

import { cellKey, columnLetter, type CellAddress, type Sheet, type SheetBody, type SheetCell } from "./schema";

/** Returns true if `value` looks like TSV (contains a tab). */
function looksLikeTsv(value: string): boolean {
  return value.includes("\t") && !value.includes(",");
}

/** Tokenises a CSV/TSV string into rows of cells. */
function tokenise(input: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === separator) {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // Skip.
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Coerces a raw cell string to a typed value. */
function coerceCell(raw: string): SheetCell {
  const trimmed = raw.trim();
  if (trimmed === "") return { raw: "" };
  if (trimmed === "TRUE" || trimmed === "true") return { raw: trimmed, value: true, valueType: "boolean", display: "TRUE" };
  if (trimmed === "FALSE" || trimmed === "false") return { raw: trimmed, value: false, valueType: "boolean", display: "FALSE" };
  // Strip thousands separators only when there are no thousands groups.
  const numeric = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(trimmed);
  if (numeric) {
    const cleaned = trimmed.replace(/,/g, "");
    const n = Number(cleaned);
    if (!Number.isNaN(n)) return { raw: trimmed, value: n, valueType: "number", display: String(n) };
  }
  return { raw: trimmed, value: trimmed, valueType: "text", display: trimmed };
}

/** Parses a CSV/TSV string into a SheetBody. */
export function importSheetFromText(input: string, options: { name?: string; separator?: "auto" | "," | "\t" } = {}): SheetBody {
  const separator = options.separator === "auto" || options.separator === undefined
    ? looksLikeTsv(input) ? "\t" : ","
    : options.separator;
  const rows = tokenise(input, separator);
  let maxColumns = 0;
  const cells: Sheet["cells"] = {};
  for (let row = 0; row < rows.length; row++) {
    const rowData = rows[row]!;
    for (let column = 0; column < rowData.length; column++) {
      const value = rowData[column] ?? "";
      const coerced = coerceCell(value);
      if (coerced.raw === "") continue;
      cells[cellKey(row, column)] = coerced;
      if (column + 1 > maxColumns) maxColumns = column + 1;
    }
  }
  const sheet: Sheet = {
    id: "sheet-1",
    name: options.name ?? "Sheet 1",
    rowCount: Math.max(1, rows.length),
    columnCount: Math.max(1, maxColumns),
    cells,
    rows: {},
    columns: {},
    merges: [],
    view: { frozenRows: 0, frozenColumns: 0, showGridlines: true, showHeaders: true },
    conditionalFormats: [],
  };
  return {
    format: "spreadsheet",
    sheets: [sheet],
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: "sheet-1",
    },
  };
}
