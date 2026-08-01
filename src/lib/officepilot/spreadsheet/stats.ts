/**
 * OfficePilot Spreadsheet statistics.
 *
 * Computes document-wide counts used by the properties panel and the
 * status bar. The function is pure: given the same body it always
 * returns the same counts, so it can be wrapped in `useMemo` safely.
 */

import { getActiveSheet } from "./cells";
import type { SheetBody, SheetStats } from "./schema";

/** Returns the document-wide statistics. */
export function computeSheetStats(body: SheetBody): SheetStats {
  const sheet = getActiveSheet(body);
  let filledCells = 0;
  let formulaCells = 0;
  let numericCells = 0;
  let textCells = 0;
  for (const cell of Object.values(sheet.cells)) {
    if (cell.raw !== undefined || cell.formula !== undefined) {
      filledCells += 1;
    }
    if (cell.formula) formulaCells += 1;
    if (typeof cell.value === "number") numericCells += 1;
    if (typeof cell.value === "string" && cell.valueType === "text") textCells += 1;
  }
  const totalCells = sheet.rowCount * sheet.columnCount;
  return {
    sheetCount: body.sheets.length,
    totalCells,
    filledCells,
    emptyCells: Math.max(0, totalCells - filledCells),
    formulaCells,
    numericCells,
    textCells,
    rows: sheet.rowCount,
    columns: sheet.columnCount,
  };
}
