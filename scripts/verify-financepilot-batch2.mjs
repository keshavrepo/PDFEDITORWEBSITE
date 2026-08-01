#!/usr/bin/env node
/**
 * Batch 2 verification harness for FinancePilot.
 *
 * Exercises the four personal-finance modules (Budget, Expense,
 * Savings, Net Worth) through the actual runtime that ships to the
 * browser. Asserts on the registry, every module's input shape and
 * summary, the line-item filters, the persistence round-trip and the
 * PDF export HTML.
 *
 * Run with: `node scripts/verify-financepilot-batch2.mjs`
 */

import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register();

const runtime = require(join(projectRoot, "src/lib/financepilot/calculator-runtime.ts"));
const pdfExport = require(join(projectRoot, "src/lib/financepilot/pdf-export.ts"));
const templates = require(join(projectRoot, "src/lib/financepilot/templates.ts"));
const calculators = require(join(projectRoot, "src/lib/financepilot/calculators.ts"));

const results = { passed: 0, failed: 0, failures: [] };

function test(name, run) {
  try {
    run();
    results.passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (error) {
    results.failed++;
    results.failures.push({ name, error });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${error.message}\x1b[0m`);
  }
}

function approx(actual, expected, tolerance, label) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
}

console.log("\n\x1b[1mFinancePilot Batch 2 — personal finance verification\x1b[0m\n");

/* -------------------------------------------------------------------------- */
/*  Registry & descriptors                                                    */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mRegistry\x1b[0m");

test("Four personal-finance modules are registered", () => {
  const expected = ["budget", "expense", "savings", "net-worth"];
  const kinds = calculators.calculators.map((c) => c.kind);
  for (const kind of expected) {
    assert(kinds.includes(kind), `missing kind: ${kind}; got ${JSON.stringify(kinds)}`);
  }
  for (const kind of expected) {
    const calc = calculators.getCalculator(kind);
    assert(calc, `no descriptor for ${kind}`);
    assert(typeof calc.slug === "string" && calc.slug.length > 0, `calculator ${kind} missing slug`);
    assert(calc.slug === kind, `slug for ${kind} should match: ${calc.slug}`);
  }
});

test("Four personal-finance templates are registered", () => {
  const ids = templates.templates.map((t) => t.id);
  for (const id of ["finance-budget", "finance-expense", "finance-savings", "finance-net-worth"]) {
    assert(ids.includes(id), `missing template ${id}`);
  }
});

test("createBlankBody returns the runtime defaults for every personal-finance kind", () => {
  const cases = [
    { kind: "budget", expected: "lines" },
    { kind: "expense", expected: "expenses" },
    { kind: "savings", expected: "targetAmount" },
    { kind: "net-worth", expected: "assets" },
  ];
  for (const { kind, expected } of cases) {
    const body = templates.createBlankBody(kind);
    assert(body && typeof body === "object", `createBlankBody(${kind}) returned ${body}`);
    assert(expected in body, `createBlankBody(${kind}) missing field ${expected}`);
  }
});

test("dispatch routes every personal-finance kind to its evaluator", () => {
  for (const kind of ["budget", "expense", "savings", "net-worth"]) {
    const dispatch = runtime.dispatch({ meta: { kind } });
    assert(dispatch.kind === kind, `dispatch mismatch: ${dispatch.kind} vs ${kind}`);
    assert(typeof dispatch.evaluate === "function", `dispatch missing evaluator for ${kind}`);
  }
});

/* -------------------------------------------------------------------------- */
/*  Budget                                                                    */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mBudget planner\x1b[0m");

test("Default budget body has income, fixed and variable lines", () => {
  const body = runtime.defaultBudgetBody();
  assert(typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month), `month: ${body.month}`);
  const kinds = new Set(body.lines.map((line) => line.kind));
  assert(kinds.has("income") && kinds.has("fixed") && kinds.has("variable"), `kinds: ${[...kinds].join(",")}`);
});

test("summariseBudget produces non-negative totals and a category breakdown", () => {
  const body = runtime.defaultBudgetBody();
  const summary = runtime.summariseBudget(body);
  assert(summary.totalIncome > 0, `totalIncome: ${summary.totalIncome}`);
  assert(summary.totalFixed > 0, `totalFixed: ${summary.totalFixed}`);
  assert(summary.totalVariable > 0, `totalVariable: ${summary.totalVariable}`);
  assert(
    summary.totalExpenses === summary.totalFixed + summary.totalVariable,
    `totalExpenses mismatch: ${summary.totalExpenses} vs ${summary.totalFixed + summary.totalVariable}`
  );
  assert(
    summary.remaining === summary.totalIncome - summary.totalExpenses + body.rollover,
    `remaining mismatch: ${summary.remaining}`
  );
  assert(summary.variableByCategory.length > 0, "expected at least one variable category");
});

test("evaluateBudget returns income, fixed, variable, total expenses and remaining", () => {
  const calculation = {
    meta: { id: "b", kind: "budget", title: "B", category: "budget", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultBudgetBody(),
  };
  const result = runtime.evaluateBudget(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Month", "Income", "Fixed expenses", "Variable expenses", "Total expenses", "Remaining"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length >= 3, `expected at least 3 series, got ${result.series.length}`);
});

test("readBudgetBody normalises unknown line kinds to variable", () => {
  const body = runtime.readBudgetBody({
    month: "2026-08",
    lines: [
      { id: "x-1", kind: "weird", category: "Other", label: "Test", amount: 100 },
      { id: "x-2", category: "Salary", label: "Income line", amount: 50_000 },
    ],
  });
  assert(body.lines.length === 2, `expected 2 lines, got ${body.lines.length}`);
  assert(body.lines[0].kind === "variable", `expected kind=variable, got ${body.lines[0].kind}`);
  assert(body.lines[1].kind === "variable", `expected kind=variable for missing kind, got ${body.lines[1].kind}`);
});

/* -------------------------------------------------------------------------- */
/*  Expense                                                                   */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mExpense tracker\x1b[0m");

test("Default expense body has 8 sample entries across categories and methods", () => {
  const body = runtime.defaultExpenseBody();
  assert(body.expenses.length === 8, `expected 8 entries, got ${body.expenses.length}`);
  const categories = new Set(body.expenses.map((e) => e.category));
  assert(categories.size >= 4, `expected at least 4 distinct categories, got ${categories.size}`);
  const methods = new Set(body.expenses.map((e) => e.paymentMethod));
  assert(methods.size >= 2, `expected at least 2 distinct payment methods, got ${methods.size}`);
});

test("summariseExpenses totals all amounts and groups by category", () => {
  const body = runtime.defaultExpenseBody();
  const summary = runtime.summariseExpenses(body.expenses);
  const manualTotal = body.expenses.reduce((acc, e) => acc + e.amount, 0);
  approx(summary.total, manualTotal, 0.01, "summary total");
  assert(summary.count === body.expenses.length, "summary count");
  assert(summary.byCategory.length > 0, "byCategory");
  assert(summary.byMethod.length > 0, "byMethod");
  assert(summary.byDay.length > 0, "byDay");
});

test("applyExpenseFilters filters by category and search, sorts by amount", () => {
  const body = runtime.defaultExpenseBody();
  const onlyGroceries = runtime.applyExpenseFilters(body.expenses, {
    ...runtime.DEFAULT_EXPENSE_FILTERS,
    category: "Groceries",
  });
  assert(onlyGroceries.every((e) => e.category === "Groceries"), "all entries must be Groceries");
  const sortedByAmountDesc = runtime.applyExpenseFilters(body.expenses, {
    ...runtime.DEFAULT_EXPENSE_FILTERS,
    sort: "amount-desc",
  });
  for (let i = 1; i < sortedByAmountDesc.length; i++) {
    assert(
      sortedByAmountDesc[i - 1].amount >= sortedByAmountDesc[i].amount,
      `not sorted by amount desc at ${i}`
    );
  }
  const search = runtime.applyExpenseFilters(body.expenses, {
    ...runtime.DEFAULT_EXPENSE_FILTERS,
    query: "fuel",
  });
  assert(search.length === 1, `expected exactly one "fuel" match, got ${search.length}`);
});

test("evaluateExpense returns month, count, total and average", () => {
  const calculation = {
    meta: { id: "x", kind: "expense", title: "X", category: "budget", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultExpenseBody(),
  };
  const result = runtime.evaluateExpense(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Month", "Entries", "Total spend", "Average"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 2, `expected 2 series, got ${result.series.length}`);
});

/* -------------------------------------------------------------------------- */
/*  Savings                                                                   */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mSavings planner\x1b[0m");

test("Default savings body has a 2-year emergency fund plan", () => {
  const body = runtime.defaultSavingsBody();
  assert(body.goalName.length > 0, "goal name");
  assert(body.targetAmount > 0, "target amount");
  assert(body.currentSavings >= 0, "current savings");
  assert(body.monthlyContribution > 0, "monthly contribution");
  assert(/\d{4}-\d{2}-\d{2}/.test(body.targetDate), `target date: ${body.targetDate}`);
});

test("summariseSavings projects a non-decreasing yearly balance", () => {
  const body = runtime.defaultSavingsBody();
  const summary = runtime.summariseSavings(body);
  assert(summary.monthsToGoal > 0, `monthsToGoal: ${summary.monthsToGoal}`);
  assert(summary.yearly.length > 0, "yearly projection must be non-empty");
  for (let i = 1; i < summary.yearly.length; i++) {
    assert(
      summary.yearly[i].balance >= summary.yearly[i - 1].balance,
      `year ${i + 1} balance regressed: ${summary.yearly[i].balance} < ${summary.yearly[i - 1].balance}`
    );
  }
  assert(/^\d{4}-\d{2}-\d{2}$/.test(summary.estimatedCompletion), `estimated completion: ${summary.estimatedCompletion}`);
});

test("evaluateSavings returns goal, target, current, progress, months to goal and on-track flag", () => {
  const calculation = {
    meta: { id: "sv", kind: "savings", title: "SV", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultSavingsBody(),
  };
  const result = runtime.evaluateSavings(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Goal", "Target", "Current", "Progress", "Months to goal", "Estimated completion", "On track"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 2, `expected 2 series, got ${result.series.length}`);
});

test("evaluateSavings rejects a zero target amount", () => {
  const calculation = {
    meta: { id: "sv0", kind: "savings", title: "SV0", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { goalName: "X", targetAmount: 0, currentSavings: 100, monthlyContribution: 100, targetDate: "2026-12-31", annualReturn: 0 },
  };
  const result = runtime.evaluateSavings(calculation);
  assert(!result.ok, "expected failure");
  assert(/target/i.test(result.error ?? ""), `unexpected error: ${result.error}`);
});

/* -------------------------------------------------------------------------- */
/*  Net worth                                                                 */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mNet worth tracker\x1b[0m");

test("Default net-worth body has 6 assets, 3 liabilities and a 6-month history", () => {
  const body = runtime.defaultNetWorthBody();
  assert(body.assets.length === 6, `assets: ${body.assets.length}`);
  assert(body.liabilities.length === 3, `liabilities: ${body.liabilities.length}`);
  assert(body.history.length === 6, `history: ${body.history.length}`);
});

test("summariseNetWorth computes net worth and category breakdowns", () => {
  const body = runtime.defaultNetWorthBody();
  const summary = runtime.summariseNetWorth(body);
  assert(summary.totalAssets === body.assets.reduce((acc, a) => acc + a.amount, 0), "totalAssets");
  assert(summary.totalLiabilities === body.liabilities.reduce((acc, l) => acc + l.amount, 0), "totalLiabilities");
  assert(summary.netWorth === summary.totalAssets - summary.totalLiabilities, "netWorth");
  assert(summary.byAssetCategory.length > 0, "byAssetCategory");
  assert(summary.byLiabilityCategory.length > 0, "byLiabilityCategory");
  assert(summary.history.length > 0, "history");
});

test("evaluateNetWorth returns assets, liabilities and net worth lines", () => {
  const calculation = {
    meta: { id: "nw", kind: "net-worth", title: "NW", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultNetWorthBody(),
  };
  const result = runtime.evaluateNetWorth(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Month", "Total assets", "Total liabilities", "Net worth"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 3, `expected 3 series, got ${result.series.length}`);
});

/* -------------------------------------------------------------------------- */
/*  Persistence (save → reload)                                                */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mPersistence (save → reopen)\x1b[0m");

test("Calculation body survives a JSON round-trip for every personal-finance module", () => {
  const cases = [
    { kind: "budget", body: runtime.defaultBudgetBody() },
    { kind: "expense", body: runtime.defaultExpenseBody() },
    { kind: "savings", body: runtime.defaultSavingsBody() },
    { kind: "net-worth", body: runtime.defaultNetWorthBody() },
  ];
  for (const { kind, body } of cases) {
    const calculation = {
      meta: {
        id: `save-${kind}`,
        kind,
        title: `${kind} test`,
        category: "budget",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        autosavedAt: "2026-01-01T00:00:01Z",
        version: 2,
        size: 512,
      },
      body,
    };
    const json = JSON.stringify(calculation);
    const rehydrated = JSON.parse(json);
    assert(rehydrated.meta.id === calculation.meta.id, `${kind}: id lost`);
    assert(rehydrated.meta.autosavedAt === calculation.meta.autosavedAt, `${kind}: autosavedAt lost`);
    assert(JSON.stringify(rehydrated.body) === JSON.stringify(calculation.body), `${kind}: body lost`);
    const result = runtime.dispatch(rehydrated).evaluate(rehydrated);
    assert(result.ok, `${kind}: rehydrated evaluation failed`);
  }
});

/* -------------------------------------------------------------------------- */
/*  PDF export                                                                 */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mPDF export (print-to-PDF)\x1b[0m");

test("buildFinancePrintHtml produces a complete HTML document for every personal-finance module", () => {
  for (const kind of ["budget", "expense", "savings", "net-worth"]) {
    const calc = calculators.getCalculator(kind);
    const calculation = {
      meta: {
        id: `pdf-${kind}`,
        kind,
        title: calc.name,
        category: calc.defaultCategory,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        autosavedAt: "2026-01-01T00:00:01Z",
        version: 1,
        size: 256,
      },
      body: templates.createBlankBody(kind),
    };
    const evaluation = runtime.dispatch(calculation).evaluate(calculation);
    const html = pdfExport.buildFinancePrintHtml({
      calculation,
      evaluation,
      title: calc.name,
      subtitle: calc.tagline,
      inputs: [
        { label: "Month", value: (calculation.body && calculation.body.month) || "—" },
        { label: "Title", value: calc.name },
      ],
    });
    for (const fragment of ["<!DOCTYPE html>", "<html", "<head>", "<body", calc.name, "FinancePilot"]) {
      assert(html.includes(fragment), `PDF HTML for ${kind} missing ${fragment}`);
    }
  }
});

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */
console.log(
  `\n\x1b[1mResults\x1b[0m  ${results.passed} passed, ${results.failed} failed\n`
);

if (results.failures.length) {
  console.log("\x1b[31mFailures:\x1b[0m");
  for (const failure of results.failures) {
    console.log(`  ${failure.name}`);
    console.log(`    ${failure.error.message}`);
  }
}

process.exit(results.failed > 0 ? 1 : 0);
