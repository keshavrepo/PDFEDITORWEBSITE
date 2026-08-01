/**
 * OfficePilot Spreadsheet starter bodies.
 *
 * Real starter workbooks for the templates shipped by OfficePilot. The
 * foundation already routes these through the templates registry; the
 * real bodies let the user open a budget, planner, checklist or invoice
 * and see a populated grid rather than a blank sheet.
 */

import { cellKey, type Sheet, type SheetBody } from "./schema";

/** A blank workbook with a single 100x26 sheet. */
export function buildBlankSheetBody(): SheetBody {
  return {
    format: "spreadsheet",
    sheets: [createSheet("Sheet 1", 100, 26, {})],
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: "sheet-1",
    },
  };
}

/** A household budget with categories, amounts, totals, and a balance. */
export function buildBudgetSheetBody(): SheetBody {
  const cells: Sheet["cells"] = {};
  // Header row.
  const header = (text: string) => ({
    raw: text,
    value: text,
    valueType: "text" as const,
    display: text,
    style: { bold: true, backgroundColor: "#0a0a0a", fontColor: "#fafafa", alignment: "left" as const },
  });
  const text = (text: string) => ({
    raw: text,
    value: text,
    valueType: "text" as const,
    display: text,
  });
  const num = (value: number) => ({
    raw: String(value),
    value,
    valueType: "number" as const,
    display: String(value),
    style: { numberFormat: "currency" as const },
  });
  const formula = (formula: string) => ({
    formula,
    style: { bold: true, numberFormat: "currency" as const },
  });
  const rows = [
    { label: "Salary", amount: 5200 },
    { label: "Freelance", amount: 1200 },
    { label: "Investments", amount: 350 },
    { label: "Other", amount: 0 },
  ];
  cells[cellKey(0, 0)] = header("Category");
  cells[cellKey(0, 1)] = header("Amount");
  rows.forEach((row, index) => {
    cells[cellKey(index + 1, 0)] = text(row.label);
    cells[cellKey(index + 1, 1)] = num(row.amount);
  });
  cells[cellKey(rows.length + 1, 0)] = { ...text("Total income"), style: { bold: true } };
  cells[cellKey(rows.length + 1, 1)] = formula(`SUM(B2:B${rows.length + 1})`);

  const expenses = [
    { label: "Rent", amount: 1800 },
    { label: "Utilities", amount: 240 },
    { label: "Groceries", amount: 520 },
    { label: "Transport", amount: 180 },
    { label: "Dining", amount: 320 },
    { label: "Subscriptions", amount: 90 },
    { label: "Other", amount: 0 },
  ];
  const expenseStart = rows.length + 3;
  cells[cellKey(expenseStart, 0)] = { ...text("Expenses"), style: { bold: true, fontSize: 14 } };
  cells[cellKey(expenseStart + 1, 0)] = header("Category");
  cells[cellKey(expenseStart + 1, 1)] = header("Amount");
  expenses.forEach((row, index) => {
    cells[cellKey(expenseStart + 2 + index, 0)] = text(row.label);
    cells[cellKey(expenseStart + 2 + index, 1)] = num(row.amount);
  });
  const totalRow = expenseStart + 2 + expenses.length;
  cells[cellKey(totalRow, 0)] = { ...text("Total expenses"), style: { bold: true } };
  cells[cellKey(totalRow, 1)] = formula(`SUM(B${expenseStart + 2}:B${totalRow})`);

  // Balance.
  const balanceRow = totalRow + 2;
  cells[cellKey(balanceRow, 0)] = { ...text("Net"), style: { bold: true, fontSize: 12 } };
  cells[cellKey(balanceRow, 1)] = formula(`B${rows.length + 2}-B${totalRow}`);

  return {
    format: "spreadsheet",
    sheets: [createSheet("Budget", 60, 6, cells, { frozenRows: 1 })],
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: "sheet-1",
    },
  };
}

/** A weekly planner with days as rows and hour columns. */
export function buildPlannerSheetBody(): SheetBody {
  const cells: Sheet["cells"] = {};
  const header = (text: string) => ({
    raw: text,
    value: text,
    valueType: "text" as const,
    display: text,
    style: { bold: true, backgroundColor: "#f5f5f5" },
  });
  const text = (value: string) => ({
    raw: value,
    value: value,
    valueType: "text" as const,
    display: value,
  });
  const hours = ["", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM"];
  hours.forEach((hour, index) => {
    cells[cellKey(0, index)] = header(hour);
  });
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  days.forEach((day, rowIndex) => {
    cells[cellKey(rowIndex + 1, 0)] = { ...text(day), style: { bold: true, backgroundColor: "#fafafa" } };
  });
  return {
    format: "spreadsheet",
    sheets: [createSheet("Week", 30, hours.length, cells, { frozenRows: 1, frozenColumns: 1 })],
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: "sheet-1",
    },
  };
}

/** A reusable task checklist. */
export function buildChecklistSheetBody(): SheetBody {
  const cells: Sheet["cells"] = {};
  const header = (text: string) => ({
    raw: text,
    value: text,
    valueType: "text" as const,
    display: text,
    style: { bold: true, backgroundColor: "#0a0a0a", fontColor: "#fafafa" },
  });
  const text = (value: string) => ({
    raw: value,
    value: value,
    valueType: "text" as const,
    display: value,
  });
  const bool = (value: boolean) => ({
    raw: value ? "TRUE" : "FALSE",
    value,
    valueType: "boolean" as const,
    display: value ? "TRUE" : "FALSE",
    style: { alignment: "center" as const },
  });
  cells[cellKey(0, 0)] = header("Task");
  cells[cellKey(0, 1)] = header("Done");
  cells[cellKey(0, 2)] = header("Owner");
  cells[cellKey(0, 3)] = header("Due");
  const items = [
    ["Draft project plan", false, "Alex", "2024-12-01"],
    ["Review last release", true, "Priya", "2024-12-02"],
    ["Send invoice", false, "Jordan", "2024-12-03"],
    ["Schedule sync", false, "Sam", "2024-12-04"],
    ["Publish launch post", false, "Maya", "2024-12-05"],
  ];
  items.forEach(([task, done, owner, due], index) => {
    cells[cellKey(index + 1, 0)] = text(task as string);
    cells[cellKey(index + 1, 1)] = bool(done as boolean);
    cells[cellKey(index + 1, 2)] = text(owner as string);
    cells[cellKey(index + 1, 3)] = text(due as string);
  });
  return {
    format: "spreadsheet",
    sheets: [createSheet("Checklist", 60, 6, cells, { frozenRows: 1 })],
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: "sheet-1",
    },
  };
}

/** A simple invoice with line items, totals, and a tax line. */
export function buildInvoiceSheetBody(): SheetBody {
  const cells: Sheet["cells"] = {};
  const header = (text: string) => ({
    raw: text,
    value: text,
    valueType: "text" as const,
    display: text,
    style: { bold: true, backgroundColor: "#0a0a0a", fontColor: "#fafafa" },
  });
  const text = (value: string) => ({
    raw: value,
    value: value,
    valueType: "text" as const,
    display: value,
  });
  const num = (value: number) => ({
    raw: String(value),
    value,
    valueType: "number" as const,
    display: String(value),
    style: { numberFormat: "currency" as const },
  });
  const formula = (formula: string) => ({
    formula,
    style: { numberFormat: "currency" as const },
  });
  cells[cellKey(0, 0)] = { ...text("INVOICE"), style: { bold: true, fontSize: 18 } };
  cells[cellKey(1, 0)] = text("Invoice #:");
  cells[cellKey(1, 1)] = text("INV-001");
  cells[cellKey(2, 0)] = text("Date:");
  cells[cellKey(2, 1)] = text(new Date().toISOString().slice(0, 10));
  cells[cellKey(3, 0)] = text("Due:");
  cells[cellKey(3, 1)] = text("Net 30");

  cells[cellKey(5, 0)] = header("Description");
  cells[cellKey(5, 1)] = header("Quantity");
  cells[cellKey(5, 2)] = header("Rate");
  cells[cellKey(5, 3)] = header("Amount");
  const items = [
    ["Design services", 12, 150],
    ["Implementation", 30, 150],
    ["Project management", 8, 120],
  ];
  items.forEach(([desc, qty, rate], index) => {
    const row = 6 + index;
    cells[cellKey(row, 0)] = text(desc as string);
    cells[cellKey(row, 1)] = num(qty as number);
    cells[cellKey(row, 2)] = num(rate as number);
    cells[cellKey(row, 3)] = formula(`B${row + 1}*C${row + 1}`);
  });
  const subtotalRow = 6 + items.length;
  cells[cellKey(subtotalRow, 2)] = { ...text("Subtotal"), style: { bold: true } };
  cells[cellKey(subtotalRow, 3)] = formula(`SUM(D7:D${subtotalRow})`);
  const taxRow = subtotalRow + 1;
  cells[cellKey(taxRow, 2)] = { ...text("Tax (10%)"), style: { bold: true } };
  cells[cellKey(taxRow, 3)] = formula(`D${subtotalRow + 1}*0.1`);
  const totalRow = taxRow + 1;
  cells[cellKey(totalRow, 2)] = { ...text("Total"), style: { bold: true, fontSize: 12 } };
  cells[cellKey(totalRow, 3)] = formula(`D${subtotalRow + 1}+D${taxRow + 1}`);
  return {
    format: "spreadsheet",
    sheets: [createSheet("Invoice", 50, 6, cells, { frozenRows: 6 })],
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: "sheet-1",
    },
  };
}

/** A monthly planner with weeks as columns and days as rows. */
export function buildMonthlyPlannerSheetBody(): SheetBody {
  const cells: Sheet["cells"] = {};
  const header = (text: string) => ({
    raw: text,
    value: text,
    valueType: "text" as const,
    display: text,
    style: { bold: true, backgroundColor: "#0a0a0a", fontColor: "#fafafa", alignment: "center" as const },
  });
  const text = (value: string) => ({
    raw: value,
    value: value,
    valueType: "text" as const,
    display: value,
  });
  const labels = ["", "Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
  labels.forEach((label, column) => {
    cells[cellKey(0, column)] = header(label);
  });
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  days.forEach((day, rowIndex) => {
    cells[cellKey(rowIndex + 1, 0)] = { ...text(day), style: { bold: true, backgroundColor: "#fafafa" } };
  });
  return {
    format: "spreadsheet",
    sheets: [createSheet("Month", 14, labels.length, cells, { frozenRows: 1, frozenColumns: 1 })],
    settings: {
      fontFamily: "Inter",
      fontSize: 11,
      cellPadding: 4,
      locale: "en-US",
      activeSheetId: "sheet-1",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Internals                                                                  */
/* -------------------------------------------------------------------------- */

function createSheet(
  name: string,
  rowCount: number,
  columnCount: number,
  cells: Sheet["cells"],
  view: Partial<Sheet["view"]> = {}
): Sheet {
  return {
    id: "sheet-1",
    name,
    rowCount,
    columnCount,
    cells,
    rows: {},
    columns: {},
    merges: [],
    view: { frozenRows: 0, frozenColumns: 0, showGridlines: true, showHeaders: true, ...view },
    conditionalFormats: [],
  };
}
