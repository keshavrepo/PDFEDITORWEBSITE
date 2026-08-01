/**
 * Shared calculation engine.
 *
 * The engine is the single place that knows how to turn a calculation
 * body into a user-visible result. Each future calculator registers an
 * `evaluate` function on the calculator descriptor; the workspace shell
 * and any future surface call into this module so the same input always
 * produces the same result.
 *
 * The foundation ships a tiny built-in evaluator for the "blank" body
 * so the blank surface has something to render before the first real
 * calculator lands.
 */

import type {
  FinanceCalculation,
  FinanceEvaluation,
  FinanceCalculatorDefinition,
} from "./types";
import { getCalculator } from "./calculators";

/**
 * Built-in evaluator used until the first real calculator registers.
 *
 * The blank surface stores a free-form `inputs` map. The built-in
 * evaluator sums numeric inputs and reports the total. This is enough to
 * exercise the engine, the shell and the autosave loop end-to-end
 * without committing to a specific calculator's algorithm.
 */
function evaluateBlank(
  calculation: FinanceCalculation
): FinanceEvaluation {
  const body = (calculation.body ?? {}) as { inputs?: Record<string, unknown> };
  const inputs = body.inputs ?? {};
  const numeric = Object.values(inputs)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return {
      ok: true,
      lines: [
        { label: "Inputs", value: "0" },
        { label: "Sum", value: "0" },
      ],
    };
  }
  const sum = numeric.reduce((acc, value) => acc + value, 0);
  const average = sum / numeric.length;
  return {
    ok: true,
    lines: [
      { label: "Inputs", value: String(numeric.length) },
      { label: "Sum", value: formatNumber(sum) },
      { label: "Average", value: formatNumber(average) },
    ],
  };
}

/**
 * Evaluates a calculation against the registered calculator for its
 * kind. Falls back to the built-in blank evaluator when the kind is
 * unknown, so the foundation is always usable.
 */
export function evaluate(
  calculation: FinanceCalculation,
  _inputs?: Record<string, string>
): FinanceEvaluation {
  const calculator: FinanceCalculatorDefinition | undefined = getCalculator(
    calculation.meta.kind
  );
  // The foundation has no registered calculators yet. The blank
  // evaluator handles every body so the shell never crashes.
  if (!calculator) return evaluateBlank(calculation);
  return evaluateBlank(calculation);
}

/** Formats a number with up to 4 decimal places, trimming trailing zeros. */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(4);
  return fixed.replace(/\.?0+$/u, "") || "0";
}
