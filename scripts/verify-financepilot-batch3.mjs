#!/usr/bin/env node
/**
 * Batch 3 verification harness for FinancePilot.
 *
 * Exercises the four investment & retirement modules (Retirement
 * Planner, Investment Planner, Goal Planner, Financial Dashboard)
 * through the actual runtime that ships to the browser. Asserts on
 * the registry, every module's input shape and summary, the line-item
 * filters, the persistence round-trip and the PDF export HTML.
 *
 * Run with: `node scripts/verify-financepilot-batch3.mjs`
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

console.log("\n\x1b[1mFinancePilot Batch 3 — investment & retirement verification\x1b[0m\n");

/* -------------------------------------------------------------------------- */
/*  Registry & descriptors                                                    */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mRegistry\x1b[0m");

test("Four investment & retirement modules are registered", () => {
  const expected = ["retirement", "investment", "goal", "dashboard"];
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

test("Four investment & retirement templates are registered", () => {
  const ids = templates.templates.map((t) => t.id);
  for (const id of ["finance-retirement", "finance-investment", "finance-goal", "finance-dashboard"]) {
    assert(ids.includes(id), `missing template ${id}`);
  }
});

test("createBlankBody returns the runtime defaults for every batch-3 kind", () => {
  const cases = [
    { kind: "retirement", expected: "currentAge" },
    { kind: "investment", expected: "targetAmount" },
    { kind: "goal", expected: "goals" },
    { kind: "dashboard", expected: "totalAssets" },
  ];
  for (const { kind, expected } of cases) {
    const body = templates.createBlankBody(kind);
    assert(body && typeof body === "object", `createBlankBody(${kind}) returned ${body}`);
    assert(expected in body, `createBlankBody(${kind}) missing field ${expected}`);
  }
});

test("dispatch routes every batch-3 kind to its evaluator", () => {
  for (const kind of ["retirement", "investment", "goal", "dashboard"]) {
    const dispatch = runtime.dispatch({ meta: { kind } });
    assert(dispatch.kind === kind, `dispatch mismatch: ${dispatch.kind} vs ${kind}`);
    assert(typeof dispatch.evaluate === "function", `dispatch missing evaluator for ${kind}`);
  }
});

/* -------------------------------------------------------------------------- */
/*  Retirement Planner                                                        */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mRetirement planner\x1b[0m");

test("Default retirement body covers the canonical 30 → 60 plan", () => {
  const body = runtime.defaultRetirementBody();
  assert(body.currentAge === 30, `currentAge: ${body.currentAge}`);
  assert(body.retirementAge === 60, `retirementAge: ${body.retirementAge}`);
  assert(body.monthlyContribution > 0, "monthly contribution");
  assert(body.expectedReturn > 0, "expected return");
  assert(body.inflationRate > 0, "inflation rate");
});

test("summariseRetirement projects 30 years and a positive corpus", () => {
  const body = runtime.defaultRetirementBody();
  const summary = runtime.summariseRetirement(body);
  assert(summary.yearsToRetirement === 30, `yearsToRetirement: ${summary.yearsToRetirement}`);
  assert(summary.corpusAtRetirement > 0, `corpusAtRetirement: ${summary.corpusAtRetirement}`);
  assert(summary.requiredCorpus > 0, `requiredCorpus: ${summary.requiredCorpus}`);
  assert(summary.yearly.length === 30, `expected 30 yearly rows, got ${summary.yearly.length}`);
  for (let i = 1; i < summary.yearly.length; i++) {
    assert(
      summary.yearly[i].balance >= summary.yearly[i - 1].balance,
      `year ${i + 1} regressed`
    );
  }
});

test("evaluateRetirement returns corpus, required corpus, monthly income and on-track flag", () => {
  const calculation = {
    meta: { id: "r", kind: "retirement", title: "R", category: "retirement", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultRetirementBody(),
  };
  const result = runtime.evaluateRetirement(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of [
    "Years to retirement",
    "Corpus at retirement",
    "Required corpus",
    "Inflation-adjusted corpus",
    "Estimated monthly income",
    "Surplus / shortfall",
    "On track",
  ]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 2, `expected 2 series, got ${result.series.length}`);
});

test("evaluateRetirement rejects a retirement age below the current age", () => {
  const calculation = {
    meta: { id: "r0", kind: "retirement", title: "R0", category: "retirement", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { ...runtime.defaultRetirementBody(), currentAge: 60, retirementAge: 50 },
  };
  const result = runtime.evaluateRetirement(calculation);
  assert(!result.ok, "expected failure");
  assert(/retirement/i.test(result.error ?? ""), `unexpected error: ${result.error}`);
});

/* -------------------------------------------------------------------------- */
/*  Investment Planner                                                        */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mInvestment planner\x1b[0m");

test("Default investment body has a moderate risk profile and a 3-asset allocation", () => {
  const body = runtime.defaultInvestmentBody();
  assert(body.goalName.length > 0, "goal name");
  assert(body.targetAmount > 0, "target amount");
  assert(body.timeHorizon > 0, "time horizon");
  assert(body.riskProfile === "moderate", `riskProfile: ${body.riskProfile}`);
  assert(body.allocation.length === 3, `allocation: ${body.allocation.length}`);
});

test("RISK_DEFAULTS maps risk profile to a default expected return", () => {
  assert(runtime.RISK_DEFAULTS.conservative < runtime.RISK_DEFAULTS.moderate, "conservative < moderate");
  assert(runtime.RISK_DEFAULTS.moderate < runtime.RISK_DEFAULTS.aggressive, "moderate < aggressive");
});

test("summariseInvestment computes a portfolio-weighted expected return", () => {
  const body = runtime.defaultInvestmentBody();
  const summary = runtime.summariseInvestment(body);
  // 60% equity (12%) + 30% debt (7%) + 10% gold (8%) = 60*0.12 + 30*0.07 + 10*0.08 = 7.2 + 2.1 + 0.8 = 10.1
  approx(summary.expectedReturn, 10.1, 0.05, "weighted return");
  assert(summary.futureValue > 0, `futureValue: ${summary.futureValue}`);
  assert(summary.totalContribution === body.monthlyContribution * body.timeHorizon * 12, "total contribution");
  assert(summary.suggestedMonthly > 0, "suggested monthly");
});

test("customReturn overrides the allocation-weighted expected return", () => {
  const body = { ...runtime.defaultInvestmentBody(), customReturn: 14 };
  const summary = runtime.summariseInvestment(body);
  approx(summary.expectedReturn, 14, 0.001, "custom return");
});

test("evaluateInvestment returns goal, risk, projection and on-track flag", () => {
  const calculation = {
    meta: { id: "i", kind: "investment", title: "I", category: "investment", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultInvestmentBody(),
  };
  const result = runtime.evaluateInvestment(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of [
    "Goal",
    "Risk profile",
    "Time horizon",
    "Expected return",
    "Projected value",
    "Total contribution",
    "Estimated returns",
    "Progress",
    "Suggested monthly",
    "On track",
  ]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 3, `expected 3 series, got ${result.series.length}`);
});

test("evaluateInvestment rejects a zero target or zero horizon", () => {
  const zeroTarget = {
    meta: { id: "z", kind: "investment", title: "Z", category: "investment", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { ...runtime.defaultInvestmentBody(), targetAmount: 0 },
  };
  assert(!runtime.evaluateInvestment(zeroTarget).ok, "expected failure for zero target");
  const zeroHorizon = {
    meta: { id: "zh", kind: "investment", title: "ZH", category: "investment", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { ...runtime.defaultInvestmentBody(), timeHorizon: 0 },
  };
  assert(!runtime.evaluateInvestment(zeroHorizon).ok, "expected failure for zero horizon");
});

/* -------------------------------------------------------------------------- */
/*  Goal Planner                                                              */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mGoal planner\x1b[0m");

test("Default goal body ships three sample goals with mixed priorities", () => {
  const body = runtime.defaultGoalBody();
  assert(body.goals.length === 3, `goals: ${body.goals.length}`);
  const priorities = new Set(body.goals.map((goal) => goal.priority));
  assert(priorities.size >= 2, `priorities: ${[...priorities].join(",")}`);
});

test("summariseGoals aggregates totals and per-goal on-track flag", () => {
  const body = runtime.defaultGoalBody();
  const summary = runtime.summariseGoals(body);
  assert(summary.totalGoals === 3, `totalGoals: ${summary.totalGoals}`);
  assert(summary.totalTarget > 0, `totalTarget: ${summary.totalTarget}`);
  assert(summary.totalCurrent > 0, `totalCurrent: ${summary.totalCurrent}`);
  assert(summary.totalRequired === summary.totalTarget - summary.totalCurrent, "totalRequired");
  assert(summary.totalMonthly > 0, "totalMonthly");
  for (const goal of summary.goals) {
    assert(goal.progress >= 0 && goal.progress <= 1.5, `progress: ${goal.progress}`);
    assert(typeof goal.onTrack === "boolean", "onTrack");
    assert(/^\d{4}-\d{2}-\d{2}$/.test(goal.estimatedCompletion), `completion: ${goal.estimatedCompletion}`);
  }
});

test("evaluateGoal returns the totals, the priority count and the on-track count", () => {
  const calculation = {
    meta: { id: "g", kind: "goal", title: "G", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultGoalBody(),
  };
  const result = runtime.evaluateGoal(calculation);
  assert(result.ok, "evaluation must succeed");
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
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 2, `expected 2 series, got ${result.series.length}`);
});

test("evaluateGoal rejects an empty goal list", () => {
  const calculation = {
    meta: { id: "g0", kind: "goal", title: "G0", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { goals: [] },
  };
  const result = runtime.evaluateGoal(calculation);
  assert(!result.ok, "expected failure");
  assert(/goal/i.test(result.error ?? ""), `unexpected error: ${result.error}`);
});

/* -------------------------------------------------------------------------- */
/*  Financial Dashboard                                                       */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mFinancial dashboard\x1b[0m");

test("Default dashboard body has assets, liabilities, savings and history", () => {
  const body = runtime.defaultDashboardBody();
  assert(body.totalAssets > 0, "totalAssets");
  assert(body.totalLiabilities > 0, "totalLiabilities");
  assert(body.monthlySavings > 0, "monthlySavings");
  assert(body.history.length > 0, "history");
  assert(body.savingsHistory.length > 0, "savingsHistory");
  assert(body.insights.length > 0, "insights");
});

test("summariseDashboard computes net worth, savings rate and budget status", () => {
  const body = runtime.defaultDashboardBody();
  const summary = runtime.summariseDashboard(body);
  assert(summary.netWorth === body.totalAssets - body.totalLiabilities, "netWorth");
  approx(summary.savingsRate, body.monthlySavings / body.monthlyIncome, 0.001, "savingsRate");
  assert(["surplus", "balanced", "deficit"].includes(summary.budgetStatus), `budgetStatus: ${summary.budgetStatus}`);
  assert(summary.investmentCoverage > 0, "investmentCoverage");
});

test("evaluateDashboard returns assets, liabilities, net worth and budget status", () => {
  const calculation = {
    meta: { id: "d", kind: "dashboard", title: "D", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultDashboardBody(),
  };
  const result = runtime.evaluateDashboard(calculation);
  assert(result.ok, "evaluation must succeed");
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
  ]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 2, `expected 2 series, got ${result.series.length}`);
});

/* -------------------------------------------------------------------------- */
/*  Persistence (save → reload)                                                */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mPersistence (save → reopen)\x1b[0m");

test("Calculation body survives a JSON round-trip for every batch-3 module", () => {
  const cases = [
    { kind: "retirement", body: runtime.defaultRetirementBody() },
    { kind: "investment", body: runtime.defaultInvestmentBody() },
    { kind: "goal", body: runtime.defaultGoalBody() },
    { kind: "dashboard", body: runtime.defaultDashboardBody() },
  ];
  for (const { kind, body } of cases) {
    const calculation = {
      meta: {
        id: `save-${kind}`,
        kind,
        title: `${kind} test`,
        category: "savings",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        autosavedAt: "2026-01-01T00:00:01Z",
        version: 2,
        size: 1024,
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

test("buildFinancePrintHtml produces a complete HTML document for every batch-3 module", () => {
  for (const kind of ["retirement", "investment", "goal", "dashboard"]) {
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
        size: 512,
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
        { label: "Title", value: calc.name },
        { label: "Kind", value: kind },
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
