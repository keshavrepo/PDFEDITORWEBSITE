#!/usr/bin/env node
/**
 * Smoke test for the FinancePilot batch 1 calculator formulas.
 *
 * The platform's test harness asserts on real modules shipped to the
 * browser. The FinancePilot runtime is isomorphic, so these checks
 * exercise the actual pure functions and confirm the headline numbers
 * for a few canonical inputs.
 *
 * Run with: `npm run test:financepilot`
 *
 * The numbers are verified against textbook values:
 *  - EMI 25 lakh / 8.5% / 20 years  →  ₹21,695 / month, ₹27,06,807 interest
 *  - SIP ₹10,000 / 12% / 10 years   →  ₹23,23,391 final value
 *  - Compound interest ₹1,00,000 / 7% / 5 years monthly →  ₹1,41,762
 *  - Loan ₹50,00,000 / 9% / 5 years with ₹5,00,000 down / 1% fee → ₹93,412 / month
 */

import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");

// Register tsx so the runtime's TypeScript modules can be required
// directly. The runtime is pure JS at runtime so the types are stripped
// at load time.
tsx.register();

const runtime = require(join(projectRoot, "src/lib/financepilot/calculator-runtime.ts"));

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

function assertClose(actual, expected, tolerance, label) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
}

console.log("\n\x1b[1mFinancePilot batch 1 formulas\x1b[0m\n");

test("EMI 25 lakh / 8.5% / 20 years → ₹21,695 / month", () => {
  const { emi, totalInterest, totalPayment } = runtime.emiPayment(2500000, 8.5, 20);
  assertClose(emi, 21695, 5, "monthly EMI");
  assertClose(totalInterest, 2706807, 200, "total interest");
  assertClose(totalPayment, 5206807, 200, "total payment");
});

test("EMI 0% rate returns the principal divided by the months", () => {
  const { emi, totalInterest, totalPayment } = runtime.emiPayment(120000, 0, 2);
  assertClose(emi, 5000, 1, "0% EMI");
  assertClose(totalInterest, 0, 0.01, "0% interest");
  assertClose(totalPayment, 120000, 1, "0% total");
});

test("Amortisation schedule ends with a zero balance", () => {
  const { rows } = runtime.amortisationSchedule(1000000, 9, 5);
  assert(rows.length === 60, `expected 60 rows, got ${rows.length}`);
  assert(rows[rows.length - 1].balance < 1, "expected the final balance near zero");
});

test("SIP ₹10,000 / 12% / 10 years → ₹23,23,391 final value", () => {
  const { futureValue, totalInvested, estimatedReturns } = runtime.sipFutureValue(10000, 12, 10);
  assertClose(futureValue, 2323391, 1000, "future value");
  assertClose(totalInvested, 1200000, 0, "total invested");
  assertClose(estimatedReturns, futureValue - totalInvested, 0.01, "returns = future - invested");
});

test("Compound interest ₹1,00,000 / 7% / 5 years monthly → ₹1,41,762", () => {
  const { futureValue, interestEarned } = runtime.compoundFutureValue(100000, 7, 5, 12);
  assertClose(futureValue, 141762, 10, "final amount");
  assertClose(interestEarned, 41762, 10, "interest earned");
});

test("Compound interest with annual compounding produces a lower final amount", () => {
  const monthly = runtime.compoundFutureValue(100000, 7, 5, 12).futureValue;
  const annual = runtime.compoundFutureValue(100000, 7, 5, 1).futureValue;
  assert(monthly > annual, `expected monthly to outpace annual: ${monthly} vs ${annual}`);
});

test("Loan with down payment reduces the effective principal", () => {
  const result = runtime.evaluateLoan({
    meta: {
      id: "t",
      kind: "loan",
      title: "Car loan",
      category: "loan",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      autosavedAt: null,
      version: 1,
      size: 0,
    },
    body: {
      principal: 5000000,
      annualRate: 9,
      years: 5,
      downPayment: 500000,
      processingFeePercent: 1,
    },
  });
  assert(result.ok, "loan evaluation must succeed");
  const monthly = result.lines.find((l) => l.label === "Monthly payment").value;
  const totalCost = result.lines.find((l) => l.label === "Total cost").value;
  const processingFee = result.lines.find((l) => l.label === "Processing fee").value;
  // Effective principal 45 lakh, 9% / 5y EMI ~ ₹93,412
  assert(monthly.includes("93,412") || monthly.includes("93,413"), `loan EMI expected ~ ₹93,412, got ${monthly}`);
  // 1% of 50 lakh = 50,000
  assert(processingFee.includes("50,000") || processingFee.includes("₹50,000"), `processing fee: ${processingFee}`);
  // Total cost = total payment + processing fee, must be a currency string
  assert(totalCost.startsWith("₹"), `loan total cost must be a currency string, got ${totalCost}`);
});

test("Default bodies round-trip their kind", () => {
  assert(runtime.defaultEmiBody().principal === 2500000, "default EMI body");
  assert(runtime.defaultSipBody().monthlyInvestment === 10000, "default SIP body");
  assert(runtime.defaultCompoundInterestBody().frequency === 12, "default compound body frequency");
  assert(
    runtime.defaultLoanBody().downPayment === 500000 &&
      runtime.defaultLoanBody().processingFeePercent === 1,
    "default loan body"
  );
});

test("Invalid inputs return a friendly error, not a crash", () => {
  const emiZero = runtime.evaluateEmi({
    meta: { id: "t", kind: "emi", title: "Zero", category: "loan", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { principal: 0, annualRate: 8.5, years: 20 },
  });
  assert(!emiZero.ok, "expected an error for a zero principal");
  assert(/above zero/i.test(emiZero.error ?? ""), `unexpected error: ${emiZero.error}`);

  const sipNegative = runtime.evaluateSip({
    meta: { id: "t", kind: "sip", title: "Neg", category: "investment", createdAt: "x", updatedAt: "x", autosavedAt: null, version: 1, size: 0 },
    body: { monthlyInvestment: -1, annualRate: 12, years: 10 },
  });
  assert(!sipNegative.ok, "expected an error for a negative monthly investment");
});

console.log(`\n\x1b[1mResults\x1b[0m  ${results.passed} passed, ${results.failed} failed\n`);

if (results.failures.length) {
  console.log("\x1b[31mFailures:\x1b[0m");
  for (const failure of results.failures) {
    console.log(`  ${failure.name}`);
    console.log(`    ${failure.error.message}`);
  }
}

process.exit(results.failed > 0 ? 1 : 0);
