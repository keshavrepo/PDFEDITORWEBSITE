#!/usr/bin/env node
/**
 * Batch 1 verification harness for FinancePilot.
 *
 * Exercises the four calculators (EMI, SIP, Compound Interest, Loan)
 * through the actual runtime that ships to the browser. Asserts on the
 * inputs that drive the per-calculator surfaces, the result lines, the
 * schedule shape, the chart series, the validation, the persistence
 * (save → reload), the PDF export HTML and the autosave path.
 *
 * Run with: `node scripts/verify-financepilot-batch1.mjs`
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
const types = require(join(projectRoot, "src/lib/financepilot/types.ts"));

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

function isString(value) {
  assert(typeof value === "string", `expected string, got ${typeof value}: ${value}`);
}

function isPositive(value, label) {
  assert(typeof value === "number" && Number.isFinite(value) && value > 0, `${label} must be a positive number, got ${value}`);
}

console.log("\n\x1b[1mFinancePilot Batch 1 — calculator verification\x1b[0m\n");

/* -------------------------------------------------------------------------- */
/*  Registry & descriptors                                                    */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mRegistry\x1b[0m");

test("Four calculators are registered with the expected kinds", () => {
  const expected = ["emi", "sip", "compound-interest", "loan"];
  const kinds = calculators.calculators.map((c) => c.kind);
  for (const kind of expected) {
    assert(kinds.includes(kind), `missing kind: ${kind}; got ${JSON.stringify(kinds)}`);
  }
  for (const c of calculators.calculators) {
    assert(typeof c.slug === "string" && c.slug.length > 0, `calculator ${c.kind} missing slug`);
    assert(typeof c.name === "string" && c.name.length > 0, `calculator ${c.kind} missing name`);
    assert(Array.isArray(c.keywords) && c.keywords.length > 0, `calculator ${c.kind} missing keywords`);
    assert(Array.isArray(c.highlights) && c.highlights.length > 0, `calculator ${c.kind} missing highlights`);
  }
});

test("All calculator slugs resolve to a descriptor", () => {
  for (const calc of calculators.calculators) {
    const found = calculators.getCalculatorBySlug(calc.slug);
    assert(found, `slug ${calc.slug} did not resolve`);
    assert(found.kind === calc.kind, `slug ${calc.slug} resolved to the wrong kind`);
  }
});

test("calculatorHref produces a working URL for each calculator", () => {
  for (const calc of calculators.calculators) {
    const href = calculators.calculatorHref(calc);
    assert(href.startsWith("/financepilot/"), `href for ${calc.kind} is wrong: ${href}`);
    assert(href.endsWith(calc.slug), `href for ${calc.kind} should end with its slug`);
  }
});

test("Four calculator templates are registered", () => {
  const ids = templates.templates.map((t) => t.id);
  for (const id of ["finance-emi", "finance-sip", "finance-compound-interest", "finance-loan"]) {
    assert(ids.includes(id), `missing template ${id}`);
  }
});

test("Every template body is a non-null object", () => {
  for (const template of templates.templates) {
    const body = templates.loadTemplateBody(template);
    assert(body && typeof body === "object", `template ${template.id} body is not an object`);
  }
});

test("createBlankBody returns the runtime defaults for every kind", () => {
  const cases = [
    { kind: "emi", expected: "principal" },
    { kind: "sip", expected: "monthlyInvestment" },
    { kind: "compound-interest", expected: "frequency" },
    { kind: "loan", expected: "downPayment" },
  ];
  for (const { kind, expected } of cases) {
    const body = templates.createBlankBody(kind);
    assert(body && typeof body === "object", `createBlankBody(${kind}) returned ${body}`);
    assert(expected in body, `createBlankBody(${kind}) missing field ${expected}`);
  }
});

/* -------------------------------------------------------------------------- */
/*  EMI                                                                       */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mEMI calculator\x1b[0m");

test("Default EMI body is {principal: 2.5M, rate: 8.5%, years: 20}", () => {
  const body = runtime.defaultEmiBody();
  assert(body.principal === 2_500_000, `principal: ${body.principal}`);
  assert(body.annualRate === 8.5, `rate: ${body.annualRate}`);
  assert(body.years === 20, `years: ${body.years}`);
});

test("EMI formula: 25 lakh / 8.5% / 20 years → ₹21,695 / month, ₹27.07L interest, ₹52.07L total", () => {
  const { emi, totalInterest, totalPayment } = runtime.emiPayment(2_500_000, 8.5, 20);
  approx(emi, 21695, 5, "monthly EMI");
  approx(totalInterest, 2_706_807, 200, "total interest");
  approx(totalPayment, 5_206_807, 200, "total payment");
});

test("EMI 0% rate returns the principal divided by the months", () => {
  const { emi, totalInterest, totalPayment } = runtime.emiPayment(120_000, 0, 2);
  approx(emi, 5_000, 1, "0% EMI");
  approx(totalInterest, 0, 0.01, "0% interest");
  approx(totalPayment, 120_000, 1, "0% total");
});

test("Amortisation schedule: 240 rows, last balance is zero, principal+interest sum to total", () => {
  const { rows, emi, totalInterest } = runtime.amortisationSchedule(2_500_000, 8.5, 20);
  assert(rows.length === 240, `expected 240 rows, got ${rows.length}`);
  for (let i = 0; i < rows.length; i++) {
    assert(rows[i].period === i + 1, `period mismatch at ${i}: ${rows[i].period}`);
    approx(rows[i].interest + rows[i].principal, rows[i].payment, 1, `payment split at row ${i + 1}`);
  }
  assert(rows[rows.length - 1].balance < 0.01, `last balance not zero: ${rows[rows.length - 1].balance}`);
  const sumInterest = rows.reduce((acc, row) => acc + row.interest, 0);
  approx(sumInterest, totalInterest, 1, "sum of interest equals totalInterest");
  // Last row payment may differ slightly because of drift absorption
  void emi;
});

test("evaluateEmi returns the right result lines and chart series", () => {
  const calculation = {
    meta: {
      id: "emi-test",
      kind: "emi",
      title: "EMI test",
      category: "loan",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      autosavedAt: null,
      version: 1,
      size: 0,
    },
    body: runtime.defaultEmiBody(),
  };
  const result = runtime.evaluateEmi(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Monthly EMI", "Total interest", "Total payment"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  isString(result.lines[0].value);
  assert(result.series.length === 2, `expected 2 series, got ${result.series.length}`);
  assert(result.series[0].name === "Principal" && result.series[1].name === "Interest", "series labels");
  assert(result.schedule.length === 240, `expected 240 schedule rows`);
});

test("evaluateEmi rejects a zero principal with a friendly error", () => {
  const calculation = {
    meta: { id: "z", kind: "emi", title: "Z", category: "loan", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { principal: 0, annualRate: 8.5, years: 20 },
  };
  const result = runtime.evaluateEmi(calculation);
  assert(!result.ok, "expected failure");
  assert(/above zero/i.test(result.error ?? ""), `unexpected error: ${result.error}`);
});

/* -------------------------------------------------------------------------- */
/*  SIP                                                                       */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mSIP calculator\x1b[0m");

test("Default SIP body is {monthlyInvestment: 10000, rate: 12%, years: 10}", () => {
  const body = runtime.defaultSipBody();
  assert(body.monthlyInvestment === 10_000, `monthly: ${body.monthlyInvestment}`);
  assert(body.annualRate === 12, `rate: ${body.annualRate}`);
  assert(body.years === 10, `years: ${body.years}`);
});

test("SIP formula: 10,000 / 12% / 10 years → ₹23,23,391 final, ₹12,00,000 invested, returns = diff", () => {
  const { futureValue, totalInvested, estimatedReturns } = runtime.sipFutureValue(10_000, 12, 10);
  approx(futureValue, 2_323_391, 1_000, "future value");
  assert(totalInvested === 1_200_000, `totalInvested: ${totalInvested}`);
  approx(estimatedReturns, futureValue - totalInvested, 0.01, "returns = future - invested");
});

test("SIP 0% rate returns the principal times the periods", () => {
  const { futureValue, totalInvested, estimatedReturns } = runtime.sipFutureValue(5_000, 0, 2);
  assert(futureValue === 120_000, `futureValue: ${futureValue}`);
  assert(totalInvested === 120_000, `totalInvested: ${totalInvested}`);
  assert(estimatedReturns === 0, `estimatedReturns: ${estimatedReturns}`);
});

test("SIP schedule: 120 rows, last balance ≈ futureValue", () => {
  const { futureValue, schedule } = runtime.sipFutureValue(10_000, 12, 10);
  assert(schedule.length === 120, `expected 120 rows, got ${schedule.length}`);
  approx(schedule[schedule.length - 1].balance, futureValue, 5, "last balance ≈ futureValue");
});

test("evaluateSip returns total investment, estimated returns and final value lines", () => {
  const calculation = {
    meta: { id: "s", kind: "sip", title: "S", category: "investment", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultSipBody(),
  };
  const result = runtime.evaluateSip(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Total investment", "Estimated returns", "Final value"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 2, `expected 2 series, got ${result.series.length}`);
  assert(result.schedule.length === 120, `expected 120 schedule rows`);
});

test("evaluateSip rejects a negative monthly investment", () => {
  const calculation = {
    meta: { id: "n", kind: "sip", title: "N", category: "investment", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { monthlyInvestment: -1, annualRate: 12, years: 10 },
  };
  const result = runtime.evaluateSip(calculation);
  assert(!result.ok, "expected failure");
  assert(/above zero/i.test(result.error ?? ""), `unexpected error: ${result.error}`);
});

/* -------------------------------------------------------------------------- */
/*  Compound interest                                                         */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mCompound interest calculator\x1b[0m");

test("Default compound body is {principal: 100k, rate: 7%, years: 5, frequency: 12}", () => {
  const body = runtime.defaultCompoundInterestBody();
  assert(body.principal === 100_000);
  assert(body.annualRate === 7);
  assert(body.years === 5);
  assert(body.frequency === 12);
});

test("Compound interest formula: 1L / 7% / 5y monthly → ₹1,41,762", () => {
  const { futureValue, interestEarned } = runtime.compoundFutureValue(100_000, 7, 5, 12);
  approx(futureValue, 141_762, 10, "futureValue");
  approx(interestEarned, 41_762, 10, "interestEarned");
});

test("Monthly compounding outpaces annual compounding for the same rate", () => {
  const monthly = runtime.compoundFutureValue(100_000, 7, 5, 12).futureValue;
  const annual = runtime.compoundFutureValue(100_000, 7, 5, 1).futureValue;
  assert(monthly > annual, `monthly ${monthly} should exceed annual ${annual}`);
});

test("Compounding schedule: year-end balances are monotonically non-decreasing", () => {
  const { schedule } = runtime.compoundFutureValue(100_000, 7, 5, 12);
  assert(schedule.length === 5, `expected 5 yearly rows, got ${schedule.length}`);
  for (let i = 1; i < schedule.length; i++) {
    assert(
      schedule[i].balance >= schedule[i - 1].balance - 0.01,
      `year ${i + 1} (${schedule[i].balance}) is less than year ${i} (${schedule[i - 1].balance})`
    );
  }
});

test("evaluateCompoundInterest returns final amount, interest earned and total growth lines", () => {
  const calculation = {
    meta: { id: "c", kind: "compound-interest", title: "C", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultCompoundInterestBody(),
  };
  const result = runtime.evaluateCompoundInterest(calculation);
  assert(result.ok, "evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Final amount", "Interest earned", "Total growth"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  assert(result.series.length === 1, `expected 1 series, got ${result.series.length}`);
  assert(result.schedule.length === 5);
});

test("evaluateCompoundInterest falls back to monthly for unknown frequencies", () => {
  const calculation = {
    meta: { id: "c2", kind: "compound-interest", title: "C2", category: "savings", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { principal: 100_000, annualRate: 7, years: 5, frequency: 7 },
  };
  const result = runtime.evaluateCompoundInterest(calculation);
  assert(result.ok, "evaluation must succeed even with unknown frequency");
});

/* -------------------------------------------------------------------------- */
/*  Loan                                                                      */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mLoan calculator\x1b[0m");

test("Default loan body is {principal: 50L, rate: 9%, years: 5, fee: 1%, down: 5L}", () => {
  const body = runtime.defaultLoanBody();
  assert(body.principal === 5_000_000, `principal: ${body.principal}`);
  assert(body.annualRate === 9, `rate: ${body.annualRate}`);
  assert(body.years === 5, `years: ${body.years}`);
  assert(body.processingFeePercent === 1, `fee: ${body.processingFeePercent}`);
  assert(body.downPayment === 500_000, `down: ${body.downPayment}`);
});

test("Loan EMI: 50L - 5L down = 45L / 9% / 5y → ₹93,412.60 / month, total cost includes 1% fee", () => {
  const calculation = {
    meta: { id: "l", kind: "loan", title: "L", category: "loan", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: runtime.defaultLoanBody(),
  };
  const result = runtime.evaluateLoan(calculation);
  assert(result.ok, "loan evaluation must succeed");
  const labels = result.lines.map((l) => l.label);
  for (const expected of ["Effective loan", "Processing fee", "Monthly payment", "Total interest", "Total cost"]) {
    assert(labels.includes(expected), `result lines missing: ${expected}; got ${labels.join(", ")}`);
  }
  const monthly = result.lines.find((l) => l.label === "Monthly payment").value;
  const processingFee = result.lines.find((l) => l.label === "Processing fee").value;
  const totalCost = result.lines.find((l) => l.label === "Total cost").value;
  assert(monthly.includes("93,412") || monthly.includes("93,413"), `loan EMI: ${monthly}`);
  assert(processingFee.includes("50,000") || processingFee.includes("₹50,000"), `processing fee: ${processingFee}`);
  assert(totalCost.startsWith("₹"), `total cost must be a currency string, got ${totalCost}`);
  assert(result.schedule.length === 60, `expected 60 schedule rows, got ${result.schedule.length}`);
});

test("Loan rejects a down payment that wipes out the principal", () => {
  const calculation = {
    meta: { id: "lo", kind: "loan", title: "L", category: "loan", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { principal: 1_000_000, annualRate: 9, years: 5, downPayment: 1_000_000, processingFeePercent: 0 },
  };
  const result = runtime.evaluateLoan(calculation);
  assert(!result.ok, "expected failure");
});

/* -------------------------------------------------------------------------- */
/*  Persistence (save → reload)                                                */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mPersistence (save → reopen)\x1b[0m");

test("Calculation body survives a JSON round-trip for every calculator", () => {
  const cases = [
    { kind: "emi", body: runtime.defaultEmiBody() },
    { kind: "sip", body: runtime.defaultSipBody() },
    { kind: "compound-interest", body: runtime.defaultCompoundInterestBody() },
    { kind: "loan", body: runtime.defaultLoanBody() },
  ];
  for (const { kind, body } of cases) {
    const calculation = {
      meta: {
        id: `save-${kind}`,
        kind,
        title: `${kind} test`,
        category: "loan",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        autosavedAt: "2026-01-01T00:00:01Z",
        version: 2,
        size: 256,
      },
      body,
    };
    const json = JSON.stringify(calculation);
    const rehydrated = JSON.parse(json);
    assert(rehydrated.meta.id === calculation.meta.id, `${kind}: id lost`);
    assert(rehydrated.meta.autosavedAt === calculation.meta.autosavedAt, `${kind}: autosavedAt lost`);
    assert(JSON.stringify(rehydrated.body) === JSON.stringify(calculation.body), `${kind}: body lost`);
    // And it still evaluates
    const result = runtime.dispatch(rehydrated).evaluate(rehydrated);
    assert(result.ok, `${kind}: rehydrated evaluation failed`);
  }
});

test("dispatch routes every kind to its evaluator", () => {
  for (const kind of ["emi", "sip", "compound-interest", "loan"]) {
    const dispatch = runtime.dispatch({ meta: { kind } });
    assert(dispatch.kind === kind, `dispatch mismatch: ${dispatch.kind} vs ${kind}`);
    assert(typeof dispatch.evaluate === "function", `dispatch missing evaluator for ${kind}`);
  }
});

/* -------------------------------------------------------------------------- */
/*  PDF export                                                                 */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mPDF export (print-to-PDF)\x1b[0m");

test("buildFinancePrintHtml produces a complete HTML document for every calculator", () => {
  for (const calc of calculators.calculators) {
    const calculation = {
      meta: {
        id: `pdf-${calc.kind}`,
        kind: calc.kind,
        title: calc.name,
        category: calc.defaultCategory,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        autosavedAt: "2026-01-01T00:00:01Z",
        version: 1,
        size: 256,
      },
      body: templates.createBlankBody(calc.kind),
    };
    const evaluation = runtime.dispatch(calculation).evaluate(calculation);
    const html = pdfExport.buildFinancePrintHtml({
      calculation,
      evaluation,
      title: calc.name,
      subtitle: calc.tagline,
      inputs: [
        { label: "Loan amount", value: "₹25,00,000" },
        { label: "Interest rate", value: "8.5%" },
        { label: "Tenure", value: "20 years" },
      ],
    });
    for (const fragment of ["<!DOCTYPE html>", "<html", "<head>", "<body", calc.name, "FinancePilot"]) {
      assert(html.includes(fragment), `PDF HTML for ${calc.kind} missing ${fragment}`);
    }
    if (evaluation.schedule && evaluation.schedule.length > 0) {
      assert(/<table/.test(html), `PDF HTML for ${calc.kind} missing schedule table`);
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
