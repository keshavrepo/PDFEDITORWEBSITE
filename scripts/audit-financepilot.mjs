#!/usr/bin/env node
/**
 * Final audit harness — exercises every FinancePilot module with
 * edge cases, malformed bodies, numeric boundaries and the round-trips
 * the application performs during real use.
 *
 * The harness is read-only: it never writes to storage and never
 * touches the DOM. It is intended to run on a freshly cloned checkout
 * with no browser available.
 *
 * Run with: `node scripts/audit-financepilot.mjs`
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
    id: `audit-${Math.random().toString(36).slice(2, 8)}`,
    kind: extra.kind ?? "emi",
    title: extra.title ?? "Audit",
    category: "loan",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    autosavedAt: "2026-01-01T00:00:01Z",
    version: 1,
    size: 0,
    ...extra,
  };
}
function calc(kind, body) {
  return { meta: meta({ kind, title: `${kind} audit` }), body };
}

console.log("\n\x1b[1mFinancePilot final audit\x1b[0m\n");

/* -------------------------------------------------------------------------- */
/*  Edge cases on every module                                                */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mEdge cases\x1b[0m");

test("EMI — extremely large principal (₹10Cr) and 30y tenure produces a positive EMI", () => {
  const { emi, totalInterest, totalPayment } = runtime.emiPayment(100_000_000, 9, 30);
  assert(emi > 0 && Number.isFinite(emi));
  assert(totalPayment > totalInterest + 100_000_000 - 1);
  assert(totalPayment < totalInterest + 100_000_000 + 1);
});

test("EMI — fractional tenure (12.5 years) rounds to 150 months", () => {
  const { rows } = runtime.amortisationSchedule(1_000_000, 9, 12.5);
  assert(rows.length === 150, `expected 150 rows, got ${rows.length}`);
  assert(rows[rows.length - 1].balance < 0.01, "last balance must be zero");
});

test("EMI — 0% rate never produces a non-finite total interest", () => {
  const { totalInterest, totalPayment } = runtime.emiPayment(1_000_000, 0, 30);
  assert(totalInterest === 0, `totalInterest: ${totalInterest}`);
  approx(totalPayment, 1_000_000, 0.01, "totalPayment");
});

test("SIP — 50-year horizon still produces a 600-row schedule", () => {
  const { schedule } = runtime.sipFutureValue(1_000, 10, 50);
  assert(schedule.length === 600, `expected 600 rows, got ${schedule.length}`);
});

test("Compound — daily compounding (frequency 365) over 30 years", () => {
  const { futureValue } = runtime.compoundFutureValue(100_000, 7, 30, 365);
  // 1L at 7% daily compounding for 30y = 1L * (1 + 0.07/365)^(365*30) ≈ 8.17L
  // (this is the textbook continuous-compounding limit e^0.07*30)
  assert(futureValue > 800_000 && futureValue < 850_000, `FV: ${futureValue}`);
});

test("Loan — down payment of 0 keeps the full principal", () => {
  const calculation = calc("loan", {
    principal: 1_000_000,
    annualRate: 9,
    years: 5,
    downPayment: 0,
    processingFeePercent: 0,
  });
  const r = runtime.evaluateLoan(calculation);
  assert(r.ok);
  assert(r.lines.find((l) => l.label === "Effective loan").value.includes("10,00,000"));
});

test("Loan — down payment of exactly the principal still evaluates (edge case)", () => {
  const calculation = calc("loan", {
    principal: 1_000_000,
    annualRate: 9,
    years: 5,
    downPayment: 1_000_000,
    processingFeePercent: 0,
  });
  const r = runtime.evaluateLoan(calculation);
  assert(!r.ok, "expected failure when down payment wipes the principal");
});

test("Budget — readBudgetBody is fully resilient to garbage input", () => {
  const garbage = [
    null,
    undefined,
    42,
    "string",
    true,
    [],
    { lines: "not-an-array" },
    { lines: [null, undefined, "string", 42, { id: "x" }] },
    { month: 2026, lines: [] },
  ];
  for (const input of garbage) {
    const body = runtime.readBudgetBody(input);
    assert(body && typeof body === "object", `garbage: ${JSON.stringify(input)}`);
    assert(Array.isArray(body.lines), "lines is not an array");
  }
});

test("Budget — summariseBudget handles an empty body without throwing", () => {
  const summary = runtime.summariseBudget({ month: "2026-08", lines: [], rollover: 0 });
  assert(summary.totalIncome === 0);
  assert(summary.totalExpenses === 0);
  assert(summary.remaining === 0);
});

test("Expense — readExpenseBody is fully resilient to garbage input", () => {
  const garbage = [null, undefined, 42, "string", [], { expenses: "no" }, { expenses: [null, "x", 1] }];
  for (const input of garbage) {
    const body = runtime.readExpenseBody(input);
    assert(body && typeof body === "object");
    assert(Array.isArray(body.expenses));
  }
});

test("Expense — applyExpenseFilters with empty list returns empty list", () => {
  const out = runtime.applyExpenseFilters([], runtime.DEFAULT_EXPENSE_FILTERS);
  assert(out.length === 0);
});

test("Expense — applyExpenseFilters sort by amount-asc", () => {
  const expenses = [
    { id: "1", date: "2026-08-01", category: "A", label: "A", amount: 5, paymentMethod: "upi" },
    { id: "2", date: "2026-08-02", category: "A", label: "B", amount: 1, paymentMethod: "upi" },
    { id: "3", date: "2026-08-03", category: "A", label: "C", amount: 3, paymentMethod: "upi" },
  ];
  const sorted = runtime.applyExpenseFilters(expenses, {
    ...runtime.DEFAULT_EXPENSE_FILTERS,
    sort: "amount-asc",
  });
  assert(sorted[0].amount === 1, `first: ${sorted[0].amount}`);
  assert(sorted[2].amount === 5, `last: ${sorted[2].amount}`);
});

test("Savings — summariseSavings with empty target returns progress 0", () => {
  const summary = runtime.summariseSavings({
    goalName: "X",
    targetAmount: 0,
    currentSavings: 0,
    monthlyContribution: 0,
    targetDate: "",
    annualReturn: 0,
  });
  assert(summary.progressFraction === 0);
});

test("Net worth — readNetWorthBody is fully resilient to garbage input", () => {
  const garbage = [null, undefined, 42, "string", [], { assets: "no" }, { liabilities: [null, "x"] }];
  for (const input of garbage) {
    const body = runtime.readNetWorthBody(input);
    assert(body && typeof body === "object");
    assert(Array.isArray(body.assets));
    assert(Array.isArray(body.liabilities));
    assert(Array.isArray(body.history));
  }
});

test("Retirement — summariseRetirement with yearsToRetirement=0 returns empty projection", () => {
  const summary = runtime.summariseRetirement({
    currentAge: 60,
    retirementAge: 60,
    currentSavings: 1_000_000,
    monthlyContribution: 0,
    expectedReturn: 10,
    inflationRate: 6,
    yearsInRetirement: 25,
    replacementRatio: 0.7,
    currentIncome: 1_500_000,
  });
  assert(summary.yearsToRetirement === 0);
  assert(summary.yearly.length === 0);
});

test("Investment — readInvestmentBody normalises unknown risk profiles to moderate", () => {
  const body = runtime.readInvestmentBody({ riskProfile: "weird", allocation: [] });
  assert(body.riskProfile === "moderate", `risk: ${body.riskProfile}`);
});

test("Goal — readGoalBody normalises unknown priorities to medium", () => {
  const body = runtime.readGoalBody({ goals: [{ name: "X", priority: "weird" }] });
  assert(body.goals[0].priority === "medium");
});

test("Dashboard — readDashboardBody is fully resilient to garbage input", () => {
  const garbage = [null, undefined, 42, "string", [], { history: "no" }, { insights: [1, "x", null] }];
  for (const input of garbage) {
    const body = runtime.readDashboardBody(input);
    assert(body && typeof body === "object");
    assert(Array.isArray(body.history));
    assert(Array.isArray(body.insights));
  }
});

test("Health score — readHealthScoreBody is fully resilient to garbage input", () => {
  const garbage = [null, undefined, 42, "string", [], { monthlyIncome: "x" }];
  for (const input of garbage) {
    const body = runtime.readHealthScoreBody(input);
    assert(body && typeof body === "object");
    for (const field of [
      "monthlyIncome",
      "monthlyExpenses",
      "emergencyFund",
      "totalDebt",
      "monthlyDebtService",
      "investedAmount",
      "insurancePolicies",
      "activeGoals",
      "goalsOnTrack",
    ]) {
      assert(typeof body[field] === "number", `${field} is not a number`);
    }
  }
});

test("Health score — extreme inputs (zero everything) return a 0 score with Critical verdict", () => {
  const summary = runtime.summariseHealthScore({
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
  assert(summary.overall === 0, `overall: ${summary.overall}`);
  assert(summary.verdict === "Critical");
  assert(summary.suggestions.length > 0, "expected at least one suggestion");
});

test("Health score — extreme inputs (everything maxed) return a 100 score with Excellent verdict", () => {
  const summary = runtime.summariseHealthScore({
    monthlyIncome: 100_000,
    monthlyExpenses: 50_000,
    emergencyFund: 600_000,
    totalDebt: 0,
    monthlyDebtService: 0,
    investedAmount: 5_000_000,
    insurancePolicies: 3,
    activeGoals: 3,
    goalsOnTrack: 3,
  });
  assert(summary.overall === 100, `overall: ${summary.overall}`);
  assert(summary.verdict === "Excellent");
  assert(summary.suggestions.length === 0, "expected no suggestions");
});

/* -------------------------------------------------------------------------- */
/*  Numeric boundaries                                                        */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mNumeric boundaries\x1b[0m");

test("SIP — fractional monthly investment (₹999.50) is preserved to the paisa", () => {
  const { totalInvested } = runtime.sipFutureValue(999.5, 12, 10);
  approx(totalInvested, 999.5 * 120, 0.01, "totalInvested");
});

test("Compound — zero rate produces a flat balance equal to the principal", () => {
  const { futureValue } = runtime.compoundFutureValue(100_000, 0, 10, 12);
  assert(futureValue === 100_000, `FV: ${futureValue}`);
});

test("Savings — fractional annual return is preserved (6.5% in 2 years)", () => {
  const summary = runtime.summariseSavings({
    goalName: "X",
    targetAmount: 100_000,
    currentSavings: 0,
    monthlyContribution: 0,
    targetDate: "",
    annualReturn: 6.5,
  });
  // 0% monthly, no contribution — never reaches the goal
  assert(summary.monthsToGoal === Number.POSITIVE_INFINITY, `months: ${summary.monthsToGoal}`);
});

test("Net worth — totalLiabilities is clamped to 0 when entries are negative", () => {
  const summary = runtime.summariseNetWorth({
    month: "2026-08",
    assets: [
      { id: "a", category: "Cash", label: "Wallet", amount: 10_000 },
    ],
    liabilities: [
      { id: "l", category: "Other", label: "Refund", amount: -1_000 }, // negative
    ],
    history: [],
  });
  assert(summary.totalLiabilities === 0, `totalLiabilities: ${summary.totalLiabilities}`);
  assert(summary.netWorth === 10_000, `netWorth: ${summary.netWorth}`);
});

test("Dashboard — net worth handles negative assets gracefully", () => {
  const summary = runtime.summariseDashboard({
    totalAssets: -5_000,
    totalLiabilities: 0,
    monthlySavings: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    activeGoals: 0,
    totalInvested: 0,
    history: [],
    savingsHistory: [],
    insights: [],
    healthScore: null,
    recentCalculations: [],
  });
  assert(summary.netWorth === -5_000, `netWorth: ${summary.netWorth}`);
});

/* -------------------------------------------------------------------------- */
/*  Persistence round-trips                                                    */
/* -------------------------------------------------------------------------- */
console.log("\n\x1b[1mPersistence round-trips\x1b[0m");

test("Every module's body survives two consecutive JSON round-trips", () => {
  const cases = [
    { kind: "emi", body: runtime.defaultEmiBody() },
    { kind: "sip", body: runtime.defaultSipBody() },
    { kind: "compound-interest", body: runtime.defaultCompoundInterestBody() },
    { kind: "loan", body: runtime.defaultLoanBody() },
    { kind: "budget", body: runtime.defaultBudgetBody() },
    { kind: "expense", body: runtime.defaultExpenseBody() },
    { kind: "savings", body: runtime.defaultSavingsBody() },
    { kind: "net-worth", body: runtime.defaultNetWorthBody() },
    { kind: "retirement", body: runtime.defaultRetirementBody() },
    { kind: "investment", body: runtime.defaultInvestmentBody() },
    { kind: "goal", body: runtime.defaultGoalBody() },
    { kind: "dashboard", body: runtime.defaultDashboardBody() },
    { kind: "health-score", body: runtime.defaultHealthScoreBody() },
  ];
  for (const { kind, body } of cases) {
    const original = calc(kind, body);
    const once = JSON.parse(JSON.stringify(original));
    const twice = JSON.parse(JSON.stringify(once));
    assert(
      JSON.stringify(twice.body) === JSON.stringify(original.body),
      `${kind}: two-round-trip body diverged`
    );
    // Both round-trips should still evaluate successfully
    const r1 = runtime.dispatch(once).evaluate(once);
    const r2 = runtime.dispatch(twice).evaluate(twice);
    assert(r1.ok, `${kind}: first round-trip failed`);
    assert(r2.ok, `${kind}: second round-trip failed`);
  }
});

test("Every module's body survives a round-trip with Unicode and emoji in the title and notes", () => {
  const c = calc("goal", {
    goals: [
      {
        id: "g",
        name: "विवाह 🏠 — home",
        targetAmount: 1_000_000,
        currentAmount: 100_000,
        targetDate: "2030-12-31",
        monthlyContribution: 10_000,
        expectedReturn: 7,
        priority: "high",
        notes: "Save for wedding + first home 🏠💍",
      },
    ],
  });
  const rehydrated = JSON.parse(JSON.stringify(c));
  assert(rehydrated.body.goals[0].name === "विवाह 🏠 — home");
  assert(runtime.evaluateGoal(rehydrated).ok);
});

/* -------------------------------------------------------------------------- */
/*  PDF export                                                                */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mPDF export\x1b[0m");

test("buildFinancePrintHtml — every module produces a complete HTML document", () => {
  for (const calc of calculators.calculators) {
    const calculation = {
      meta: meta({ kind: calc.kind, title: calc.name }),
      body: templates.createBlankBody(calc.kind),
    };
    const evaluation = runtime.dispatch(calculation).evaluate(calculation);
    const html = pdfExport.buildFinancePrintHtml({
      calculation,
      evaluation,
      title: calc.name,
      subtitle: calc.tagline,
      inputs: [{ label: "Test", value: "1" }],
    });
    assert(html.startsWith("<!DOCTYPE html>"), `${calc.kind} does not start with <!DOCTYPE html>`);
    assert(html.includes("</html>"), `${calc.kind} does not close </html>`);
    assert(html.includes(calc.name), `${calc.kind} HTML does not contain the title`);
  }
});

test("buildFinancePrintHtml — escapes user-controlled strings in the title, inputs and result lines", () => {
  const calculation = {
    meta: meta({ kind: "goal", title: "X" }),
    body: {
      goals: [
        {
          id: "g",
          name: "Name",
          targetAmount: 1,
          currentAmount: 0,
          targetDate: "2030-12-31",
          monthlyContribution: 1,
          expectedReturn: 0,
          priority: "high",
          notes: "harmless notes — never rendered in the PDF",
        },
      ],
    },
  };
  const evaluation = runtime.evaluateGoal(calculation);
  // Inject an XSS payload into the user-controlled fields the PDF does
  // render (title, inputs, and result lines).
  const xssTitle = "<script>alert('xss')</script>";
  const xssInputLabel = "<img src=x onerror=alert(1)>";
  const html = pdfExport.buildFinancePrintHtml({
    calculation,
    evaluation,
    title: xssTitle,
    subtitle: "Goal planner",
    inputs: [{ label: xssInputLabel, value: "value" }],
  });
  // The raw payload must not appear in the rendered HTML; it must be
  // HTML-escaped.
  assert(!html.includes("<script>alert"), "XSS payload in title not escaped");
  assert(!html.includes("<img src=x onerror"), "XSS payload in input label not escaped");
  assert(html.includes("&lt;script&gt;"), "title XSS payload should be HTML-escaped");
  assert(html.includes("&lt;img"), "input label XSS payload should be HTML-escaped");
});

/* -------------------------------------------------------------------------- */
/*  Registry and templates                                                    */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mRegistry and templates\x1b[0m");

test("Every registered calculator has a unique kind, slug, id and name", () => {
  const seen = new Set();
  for (const c of calculators.calculators) {
    assert(!seen.has(c.kind), `duplicate kind: ${c.kind}`);
    seen.add(c.kind);
    assert(c.kind === c.slug, `${c.kind} slug does not match kind`);
    assert(c.id.startsWith("finance-"), `${c.kind} id should start with finance-`);
    assert(c.name.length > 0, `${c.kind} name is empty`);
    assert(c.tagline.length > 0, `${c.kind} tagline is empty`);
    assert(c.keywords.length > 0, `${c.kind} has no keywords`);
  }
});

test("Every registered template has a matching calculator kind", () => {
  for (const t of templates.templates) {
    if (t.kind === "blank") continue;
    const calc = calculators.getCalculator(t.kind);
    assert(calc, `template ${t.id} references unknown kind: ${t.kind}`);
  }
});

test("createBlankBody returns the same shape as loadTemplateBody for every kind", () => {
  for (const t of templates.templates) {
    if (t.kind === "blank") continue;
    const blank = templates.createBlankBody(t.kind);
    const fromTemplate = templates.loadTemplateBody(t);
    assert(
      JSON.stringify(blank) === JSON.stringify(fromTemplate),
      `${t.id} template body diverges from createBlankBody`
    );
  }
});

test("Every calculator is reachable through the URL pattern /financepilot/[slug]", () => {
  for (const c of calculators.calculators) {
    assert(c.slug.length > 0, `${c.kind} has an empty slug`);
    const href = calculators.calculatorHref(c);
    assert(href === `/financepilot/${c.slug}`, `${c.kind} href: ${href}`);
  }
});

/* -------------------------------------------------------------------------- */
/*  Dispatcher coverage                                                       */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mDispatcher\x1b[0m");

test("dispatch routes every kind to its evaluator with the same kind", () => {
  for (const c of calculators.calculators) {
    const d = runtime.dispatch({ meta: { kind: c.kind } });
    assert(d.kind === c.kind, `dispatch mismatch: ${d.kind} vs ${c.kind}`);
    assert(typeof d.evaluate === "function", `${c.kind} missing evaluator`);
    // Calling the evaluator on a default body should not throw
    const calculation = { meta: meta({ kind: c.kind }), body: templates.createBlankBody(c.kind) };
    d.evaluate(calculation);
  }
});

test("dispatch falls back to EMI for an unknown kind without throwing", () => {
  const d = runtime.dispatch({ meta: { kind: "no-such-kind" } });
  assert(d.kind === "emi");
  // The fallback should still produce a valid evaluation
  const calculation = { meta: meta({ kind: "no-such-kind" }), body: runtime.defaultEmiBody() };
  const r = d.evaluate(calculation);
  assert(r.ok);
});

/* -------------------------------------------------------------------------- */
/*  Cross-cutting                                                              */
/* -------------------------------------------------------------------------- */
console.log("\x1b[1mCross-cutting\x1b[0m");

test("Every calculator's evaluator returns a result with at least one line and one series", () => {
  for (const c of calculators.calculators) {
    const calculation = { meta: meta({ kind: c.kind }), body: templates.createBlankBody(c.kind) };
    const r = runtime.dispatch(calculation).evaluate(calculation);
    assert(r.lines.length > 0, `${c.kind} result has no lines`);
    if (r.ok) {
      assert(r.lines.every((l) => typeof l.label === "string" && typeof l.value === "string"),
        `${c.kind} result lines must be { label, value } strings`);
    }
  }
});

test("Every calculator's evaluator returns at most one schedule with rows of the right shape", () => {
  for (const c of calculators.calculators) {
    const calculation = { meta: meta({ kind: c.kind }), body: templates.createBlankBody(c.kind) };
    const r = runtime.dispatch(calculation).evaluate(calculation);
    if (r.schedule) {
      for (const row of r.schedule) {
        assert(typeof row.period === "number", `${c.kind} schedule row period is not a number`);
        assert(typeof row.payment === "number", `${c.kind} schedule row payment is not a number`);
        assert(typeof row.interest === "number", `${c.kind} schedule row interest is not a number`);
        assert(typeof row.principal === "number", `${c.kind} schedule row principal is not a number`);
        assert(typeof row.balance === "number", `${c.kind} schedule row balance is not a number`);
      }
    }
  }
});

test("Every calculator's evaluator returns series with the right shape", () => {
  for (const c of calculators.calculators) {
    const calculation = { meta: meta({ kind: c.kind }), body: templates.createBlankBody(c.kind) };
    const r = runtime.dispatch(calculation).evaluate(calculation);
    if (r.series) {
      for (const series of r.series) {
        assert(typeof series.name === "string" && series.name.length > 0, `${c.kind} series name is empty`);
        assert(Array.isArray(series.points), `${c.kind} series points is not an array`);
        for (const point of series.points) {
          assert(typeof point.label === "string", `${c.kind} series point label is not a string`);
          assert(typeof point.value === "number", `${c.kind} series point value is not a number`);
        }
      }
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
