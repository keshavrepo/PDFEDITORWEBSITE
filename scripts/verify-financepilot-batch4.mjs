#!/usr/bin/env node
/**
 * Batch 4 verification harness for FinancePilot.
 *
 * Exercises the four Batch-4 features through the actual production
 * runtime:
 *
 *  1. Goals Planner — already exists; the harness asserts the spec
 *     items (target amount, current savings, monthly contribution,
 *     expected return, target date) all show up in the result lines
 *     and the projected completion.
 *  2. Net Worth Tracker — already exists; the harness asserts the
 *     new spec categories (Cash, Savings, Investments, Property,
 *     Gold, Vehicles, Loans, Credit Cards, Mortgage) are present
 *     and the existing categories still work.
 *  3. Financial Health Score — new; 6 categories, weighted overall,
 *     suggestions.
 *  4. Dashboard Integration — new fields: health score, recent
 *     calculations, quick actions.
 *
 * Run with: `node scripts/verify-financepilot-batch4.mjs`
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
function meta(extra = {}) {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    kind: extra.kind ?? "health-score",
    title: extra.title ?? "Test",
    category: "savings",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    autosavedAt: "2026-01-01T00:00:01Z",
    version: 1,
    size: 0,
    ...extra,
  };
}
function calc(kind, body) {
  return { meta: meta({ kind, title: `${kind} test` }), body };
}

console.log("\n\x1b[1mFinancePilot Batch 4 — professional features verification\x1b[0m\n");

/* -------------------------------------------------------------------------- */
/*  Goals Planner — already a module, this verifies it covers the spec items */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mGoals planner\x1b[0m");

test("GoalItem supports every spec field (targetAmount, currentAmount, monthlyContribution, expectedReturn, targetDate)", () => {
  const body = runtime.defaultGoalBody();
  for (const goal of body.goals) {
    assert(typeof goal.targetAmount === "number" && goal.targetAmount > 0, `targetAmount: ${goal.targetAmount}`);
    assert(typeof goal.currentAmount === "number" && goal.currentAmount >= 0, `currentAmount: ${goal.currentAmount}`);
    assert(typeof goal.monthlyContribution === "number" && goal.monthlyContribution > 0, `monthlyContribution: ${goal.monthlyContribution}`);
    assert(typeof goal.expectedReturn === "number" && goal.expectedReturn >= 0, `expectedReturn: ${goal.expectedReturn}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate), `targetDate: ${goal.targetDate}`);
  }
});

test("summariseGoals reports progress, remaining amount, remaining months and projected completion", () => {
  const body = runtime.defaultGoalBody();
  const summary = runtime.summariseGoals(body);
  assert(summary.goals.length === 3, `expected 3 goals, got ${summary.goals.length}`);
  for (const entry of summary.goals) {
    assert(entry.progress >= 0 && entry.progress <= 1.5, `progress: ${entry.progress}`);
    assert(entry.monthsToGoal >= 0, `monthsToGoal: ${entry.monthsToGoal}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(entry.estimatedCompletion), `completion: ${entry.estimatedCompletion}`);
    // Remaining amount = target - current
    const remaining = entry.goal.targetAmount - entry.goal.currentAmount;
    assert(remaining >= 0, `remaining: ${remaining}`);
  }
});

test("evaluateGoal shows the totals and the on-track count", () => {
  const calculation = calc("goal", runtime.defaultGoalBody());
  const result = runtime.evaluateGoal(calculation);
  assert(result.ok);
  const labels = result.lines.map((l) => l.label);
  for (const expected of [
    "Active goals",
    "Total target",
    "Total current",
    "Total required",
    "Total monthly",
    "High priority",
    "On track",
  ]) {
    assert(labels.includes(expected), `result lines missing: ${expected}`);
  }
});

/* -------------------------------------------------------------------------- */
/*  Net Worth Tracker                                                          */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mNet worth tracker\x1b[0m");

test("Net worth asset categories include every spec name (Cash, Savings, Investments, Property, Gold, Vehicles)", () => {
  for (const spec of ["Cash", "Savings", "Investments", "Property", "Gold", "Vehicles", "Other"]) {
    assert(
      runtime.NET_WORTH_ASSET_CATEGORIES.includes(spec),
      `asset category missing: ${spec}`
    );
  }
});

test("Net worth liability categories include every spec name (Loans, Credit Cards, Mortgage, Other)", () => {
  for (const spec of ["Loans", "Credit Cards", "Mortgage", "Other"]) {
    assert(
      runtime.NET_WORTH_LIABILITY_CATEGORIES.includes(spec),
      `liability category missing: ${spec}`
    );
  }
});

test("Net worth chart splits assets and liabilities (3 series)", () => {
  const r = runtime.evaluateNetWorth(calc("net-worth", runtime.defaultNetWorthBody()));
  assert(r.ok);
  assert(r.series.length === 3, `expected 3 series, got ${r.series.length}`);
  assert(r.series[0].name === "Net worth");
  assert(r.series[1].name === "Assets");
  assert(r.series[2].name === "Liabilities");
});

test("Asset allocation pie sums to the total assets", () => {
  const body = runtime.defaultNetWorthBody();
  const summary = runtime.summariseNetWorth(body);
  const pieTotal = summary.byAssetCategory.reduce((acc, entry) => acc + entry.amount, 0);
  approx(pieTotal, summary.totalAssets, 0.01, "asset pie total");
});

test("Liability breakdown pie sums to the total liabilities", () => {
  const body = runtime.defaultNetWorthBody();
  const summary = runtime.summariseNetWorth(body);
  const pieTotal = summary.byLiabilityCategory.reduce((acc, entry) => acc + entry.amount, 0);
  approx(pieTotal, summary.totalLiabilities, 0.01, "liability pie total");
});

/* -------------------------------------------------------------------------- */
/*  Financial Health Score                                                    */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mFinancial health score\x1b[0m");

test("Default health score body has every required input", () => {
  const body = runtime.defaultHealthScoreBody();
  assert(typeof body.monthlyIncome === "number");
  assert(typeof body.monthlyExpenses === "number");
  assert(typeof body.emergencyFund === "number");
  assert(typeof body.totalDebt === "number");
  assert(typeof body.monthlyDebtService === "number");
  assert(typeof body.investedAmount === "number");
  assert(typeof body.insurancePolicies === "number");
  assert(typeof body.activeGoals === "number");
  assert(typeof body.goalsOnTrack === "number");
});

test("summariseHealthScore returns an overall score in the 0..100 range with 6 categories", () => {
  const body = runtime.defaultHealthScoreBody();
  const summary = runtime.summariseHealthScore(body);
  assert(summary.overall >= 0 && summary.overall <= 100, `overall: ${summary.overall}`);
  assert(summary.categories.length === 6, `expected 6 categories, got ${summary.categories.length}`);
  for (const entry of summary.categories) {
    assert(entry.score >= 0 && entry.score <= 100, `${entry.name} score: ${entry.score}`);
    assert(["Excellent", "Good", "Fair", "Weak", "Critical"].includes(entry.verdict), `${entry.name} verdict: ${entry.verdict}`);
  }
});

test("Each category covers one of the spec axes (Emergency, Debt, Savings, Investment, Insurance, Goal)", () => {
  const summary = runtime.summariseHealthScore(runtime.defaultHealthScoreBody());
  const names = summary.categories.map((c) => c.name);
  for (const expected of [
    "Emergency Fund",
    "Debt Ratio",
    "Savings Rate",
    "Investment Ratio",
    "Insurance Coverage",
    "Goal Progress",
  ]) {
    assert(names.includes(expected), `category missing: ${expected}; got ${names.join(", ")}`);
  }
});

test("Overall score is a weighted average of the 6 category scores", () => {
  const body = runtime.defaultHealthScoreBody();
  const summary = runtime.summariseHealthScore(body);
  const expected =
    summary.categories[0].score * 0.25 +
    summary.categories[1].score * 0.2 +
    summary.categories[2].score * 0.2 +
    summary.categories[3].score * 0.15 +
    summary.categories[4].score * 0.1 +
    summary.categories[5].score * 0.1;
  approx(summary.overall, expected, 0.5, "weighted average");
});

test("Emergency fund score: 6 months of expenses → 100, 0 months → 0", () => {
  const sixMonths = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    monthlyExpenses: 50_000,
    emergencyFund: 300_000,
  });
  const sixMonthsScore = sixMonths.categories.find((c) => c.name === "Emergency Fund");
  assert(sixMonthsScore.score === 100, `6 months: ${sixMonthsScore.score}`);

  const zero = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    emergencyFund: 0,
  });
  const zeroScore = zero.categories.find((c) => c.name === "Emergency Fund");
  assert(zeroScore.score === 0, `0 months: ${zeroScore.score}`);
});

test("Debt ratio score: 20% of annual income → 100, 200% → 0", () => {
  const healthy = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    monthlyIncome: 100_000,
    monthlyDebtService: 0,
    totalDebt: 240_000,
  });
  const healthyScore = healthy.categories.find((c) => c.name === "Debt Ratio");
  assert(healthyScore.score === 100, `20%: ${healthyScore.score}`);

  const heavy = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    monthlyIncome: 100_000,
    monthlyDebtService: 0,
    totalDebt: 2_400_000,
  });
  const heavyScore = heavy.categories.find((c) => c.name === "Debt Ratio");
  assert(heavyScore.score === 0, `200%: ${heavyScore.score}`);
});

test("Savings rate score: 30% of income → 100, 0% → 0", () => {
  const excellent = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    monthlyIncome: 100_000,
    monthlyExpenses: 70_000,
  });
  const excellentScore = excellent.categories.find((c) => c.name === "Savings Rate");
  assert(excellentScore.score === 100, `30%: ${excellentScore.score}`);

  const zero = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    monthlyIncome: 100_000,
    monthlyExpenses: 100_000,
  });
  const zeroScore = zero.categories.find((c) => c.name === "Savings Rate");
  assert(zeroScore.score === 0, `0%: ${zeroScore.score}`);
});

test("Investment ratio score: 3× annual income → 100, 0× → 0", () => {
  const excellent = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    monthlyIncome: 100_000,
    investedAmount: 3_600_000,
  });
  const excellentScore = excellent.categories.find((c) => c.name === "Investment Ratio");
  assert(excellentScore.score === 100, `3×: ${excellentScore.score}`);

  const zero = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    investedAmount: 0,
  });
  const zeroScore = zero.categories.find((c) => c.name === "Investment Ratio");
  assert(zeroScore.score === 0, `0: ${zeroScore.score}`);
});

test("Insurance score: 3 policies → 100, 0 → 0", () => {
  const excellent = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    insurancePolicies: 3,
  });
  const excellentScore = excellent.categories.find((c) => c.name === "Insurance Coverage");
  assert(excellentScore.score === 100, `3: ${excellentScore.score}`);

  const zero = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    insurancePolicies: 0,
  });
  const zeroScore = zero.categories.find((c) => c.name === "Insurance Coverage");
  assert(zeroScore.score === 0, `0: ${zeroScore.score}`);
});

test("Goal progress score: 3/3 on track → 100, 0/3 → 0", () => {
  const excellent = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    activeGoals: 3,
    goalsOnTrack: 3,
  });
  const excellentScore = excellent.categories.find((c) => c.name === "Goal Progress");
  assert(excellentScore.score === 100, `3/3: ${excellentScore.score}`);

  const zero = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    activeGoals: 3,
    goalsOnTrack: 0,
  });
  const zeroScore = zero.categories.find((c) => c.name === "Goal Progress");
  assert(zeroScore.score === 0, `0/3: ${zeroScore.score}`);
});

test("Overall verdict label matches the overall score band", () => {
  const excellent = runtime.summariseHealthScore({
    ...runtime.defaultHealthScoreBody(),
    monthlyIncome: 100_000,
    monthlyExpenses: 60_000,
    emergencyFund: 600_000,
    totalDebt: 200_000,
    monthlyDebtService: 20_000,
    investedAmount: 3_600_000,
    insurancePolicies: 3,
    activeGoals: 3,
    goalsOnTrack: 3,
  });
  assert(excellent.verdict === "Excellent", `verdict: ${excellent.verdict}`);
  assert(excellent.overall >= 85, `overall: ${excellent.overall}`);

  const critical = runtime.summariseHealthScore({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    emergencyFund: 0,
    totalDebt: 0,
    monthlyDebtService: 0,
    investedAmount: 0,
    insurancePolicies: 0,
    activeGoals: 0,
    goalsOnTrack: 0,
  });
  assert(critical.verdict === "Critical", `verdict: ${critical.verdict}`);
  assert(critical.overall === 0, `overall: ${critical.overall}`);
});

test("Improvement suggestions are non-empty when at least one category is below 100", () => {
  const body = runtime.defaultHealthScoreBody();
  const summary = runtime.summariseHealthScore(body);
  // The default body has 2/3 goals on track so goal progress is not 100; at
  // least one suggestion should be present.
  const allPerfect = summary.categories.every((c) => c.score === 100);
  if (allPerfect) {
    assert(summary.suggestions.length === 0, "perfect score should have no suggestions");
  } else {
    assert(summary.suggestions.length > 0, "expected at least one suggestion");
  }
});

test("evaluateHealthScore returns an Overall score line and 6 category lines", () => {
  const calculation = calc("health-score", runtime.defaultHealthScoreBody());
  const result = runtime.evaluateHealthScore(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of [
    "Overall score",
    "Verdict",
    "Emergency Fund",
    "Debt Ratio",
    "Savings Rate",
    "Investment Ratio",
    "Insurance Coverage",
    "Goal Progress",
  ]) {
    assert(labels.includes(expected), `result lines missing: ${expected}`);
  }
  assert(result.series.length === 1, `expected 1 series, got ${result.series.length}`);
  assert(result.series[0].name === "Score");
  assert(result.series[0].points.length === 6, `expected 6 category points`);
});

test("save / reopen — health score body survives a JSON round-trip", () => {
  const original = calc("health-score", runtime.defaultHealthScoreBody());
  const rehydrated = JSON.parse(JSON.stringify(original));
  assert(runtime.dispatch(rehydrated).evaluate(rehydrated).ok);
});

test("export PDF — buildFinancePrintHtml returns a complete HTML document for the health score", () => {
  const c = calc("health-score", runtime.defaultHealthScoreBody());
  const evaluation = runtime.evaluateHealthScore(c);
  const html = pdfExport.buildFinancePrintHtml({
    calculation: c,
    evaluation,
    title: "Health",
    subtitle: "Financial health score",
    inputs: [{ label: "Score", value: `${evaluation.lines[0].value}` }],
  });
  assert(html.startsWith("<!DOCTYPE html>"));
  assert(html.includes("Health"));
});

/* -------------------------------------------------------------------------- */
/*  Dashboard integration                                                     */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mDashboard integration\x1b[0m");

test("Default dashboard body has the new health score, recent calculations and quick actions fields", () => {
  const body = runtime.defaultDashboardBody();
  assert(typeof body.healthScore === "number", `healthScore: ${body.healthScore}`);
  assert(body.healthScore >= 0 && body.healthScore <= 100, `healthScore: ${body.healthScore}`);
  assert(Array.isArray(body.recentCalculations), "recentCalculations is not an array");
  assert(body.recentCalculations.length > 0, "recentCalculations is empty");
  for (const entry of body.recentCalculations) {
    assert(typeof entry.title === "string" && entry.title.length > 0, `title: ${entry.title}`);
    assert(typeof entry.kind === "string" && entry.kind.length > 0, `kind: ${entry.kind}`);
    assert(typeof entry.updatedAt === "string", `updatedAt: ${entry.updatedAt}`);
  }
});

test("readDashboardBody is resilient to missing new fields", () => {
  const empty = runtime.readDashboardBody({});
  assert(empty.healthScore === runtime.defaultDashboardBody().healthScore);
  assert(Array.isArray(empty.recentCalculations));
});

test("evaluateDashboard surfaces the health score in the result lines", () => {
  const calculation = calc("dashboard", runtime.defaultDashboardBody());
  const result = runtime.evaluateDashboard(calculation);
  assert(result.ok);
  const labels = result.lines.map((l) => l.label);
  for (const expected of [
    "Total assets",
    "Total liabilities",
    "Net worth",
    "Monthly income",
    "Monthly expenses",
    "Monthly savings",
    "Savings rate",
    "Budget status",
    "Active goals",
    "Total invested",
    "Health score",
    "Recent calculations",
  ]) {
    assert(labels.includes(expected), `result lines missing: ${expected}`);
  }
});

test("summariseDashboard surfaces the new fields", () => {
  const body = runtime.defaultDashboardBody();
  const summary = runtime.summariseDashboard(body);
  assert(summary.healthScore === body.healthScore);
  assert(summary.recentCalculations.length === body.recentCalculations.length);
});

test("save / reopen — dashboard body with new fields survives a JSON round-trip", () => {
  const original = calc("dashboard", runtime.defaultDashboardBody());
  const rehydrated = JSON.parse(JSON.stringify(original));
  assert(rehydrated.body.healthScore === original.body.healthScore);
  assert(rehydrated.body.recentCalculations.length === original.body.recentCalculations.length);
  assert(runtime.dispatch(rehydrated).evaluate(rehydrated).ok);
});

test("export PDF — dashboard PDF with new fields renders a complete HTML document", () => {
  const c = calc("dashboard", runtime.defaultDashboardBody());
  const evaluation = runtime.evaluateDashboard(c);
  const html = pdfExport.buildFinancePrintHtml({
    calculation: c,
    evaluation,
    title: "Dashboard",
    subtitle: "Financial dashboard",
    inputs: [{ label: "Health score", value: "72 / 100" }],
  });
  assert(html.startsWith("<!DOCTYPE html>"));
  assert(html.includes("Dashboard"));
  assert(html.includes("Health score"));
});

/* -------------------------------------------------------------------------- */
/*  Cross-cutting                                                             */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mCross-cutting\x1b[0m");

test("Health score calculator is registered with a matching kind and slug", () => {
  const calc = calculators.getCalculator("health-score");
  assert(calc, "health-score calculator is not registered");
  assert(calc.kind === "health-score");
  assert(calc.slug === "health-score");
  assert(calc.name === "Financial Health Score");
  assert(calc.keywords.includes("health score"));
});

test("Health score template is registered and the body is the default", () => {
  const t = templates.templates.find((entry) => entry.id === "finance-health-score");
  assert(t, "template is not registered");
  const body = templates.loadTemplateBody(t);
  assert(body && typeof body === "object", "template body is not an object");
  const defaults = runtime.defaultHealthScoreBody();
  assert(JSON.stringify(body) === JSON.stringify(defaults), "template body does not match the default");
});

test("dispatch — health-score kind resolves to its evaluator", () => {
  const dispatch = runtime.dispatch({ meta: { kind: "health-score" } });
  assert(dispatch.kind === "health-score");
  assert(typeof dispatch.evaluate === "function");
});

test("createBlankBody returns the default health score body", () => {
  const body = templates.createBlankBody("health-score");
  assert(body && typeof body === "object");
  assert(JSON.stringify(body) === JSON.stringify(runtime.defaultHealthScoreBody()));
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
