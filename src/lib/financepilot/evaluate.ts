/**
 * Shared calculation engine.
 *
 * The engine is the single place that knows how to turn a calculation
 * body into a user-visible result. Each calculator registers its
 * `evaluate` function in `calculator-runtime`; the workspace shell and
 * any future surface call into this module so the same input always
 * produces the same result.
 *
 * The foundation shipped a tiny built-in evaluator for the "blank" body
 * so the blank surface had something to render before the first real
 * calculator landed. With batch 1 in place, every registered kind
 * dispatches to its runtime evaluator; the blank fallback is kept for
 * `kind === "blank"` only.
 */

import type {
  FinanceCalculation,
  FinanceEvaluation,
} from "./types";
import { dispatch } from "./calculator-runtime";

/**
 * Built-in evaluator for the "blank" body.
 *
 * The blank surface stores a free-form `inputs` map. The built-in
 * evaluator sums numeric inputs and reports the total. It is also the
 * fallback for any kind that has not been wired up yet.
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
 * Evaluates a calculation against the registered runtime for its kind.
 *
 * Falls back to the built-in blank evaluator when the kind is unknown,
 * so the foundation is always usable.
 */
export function evaluate(
  calculation: FinanceCalculation
): FinanceEvaluation {
  if (calculation.meta.kind === "blank") return evaluateBlank(calculation);
  const runtime = dispatch(calculation);
  return runtime.evaluate(calculation);
}

/** Formats a number with up to 4 decimal places, trimming trailing zeros. */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(4);
  return fixed.replace(/\.?0+$/u, "") || "0";
}
