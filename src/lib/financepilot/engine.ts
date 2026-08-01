/**
 * FinancePilot calculation engine.
 *
 * The engine is a thin layer over the IndexedDB-backed storage that adds
 * the business rules every product needs: id generation, initial title,
 * the version counter, the calculation engine and the recent-calculations
 * mirror in the server database.
 *
 * Server-side code that needs to read recent calculations uses the
 * `listRecentCalculations` helper in `recent.ts`; this module is the
 * client-side counterpart that the workspace shell calls when a user
 * creates, opens, saves or closes a calculation.
 */

import { getCalculator } from "./calculators";
import { createBlankBody, loadTemplateBody } from "./templates";
import {
  autosaveCalculation as storageAutosave,
  createCalculation as storageCreate,
  deleteCalculation as storageDelete,
  duplicateCalculation as storageDuplicate,
  generateCalculationId,
  getCalculation as storageGet,
  listCalculations as storageList,
  renameCalculation as storageRename,
  saveCalculation as storageSave,
} from "./client-storage";
import type {
  FinanceCalculation,
  FinanceCalculationCategory,
  FinanceCalculationSummary,
  FinanceCalculatorKind,
  FinanceTemplate,
} from "./types";

/** Title used when the user has not typed one yet. */
function defaultTitle(
  kind: FinanceCalculatorKind,
  category: FinanceCalculationCategory
): string {
  const calculator = getCalculator(kind);
  if (calculator) {
    if (category === "blank") return `Untitled ${calculator.name}`;
    return `Untitled ${calculatorCategoryTitle(category)} ${calculator.name}`;
  }
  if (category === "blank") return "Untitled calculation";
  return `Untitled ${calculatorCategoryTitle(category)}`;
}

/** Title-cased category, used in default calculation titles. */
function calculatorCategoryTitle(category: FinanceCalculationCategory): string {
  const text = category.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Creates a fresh calculation. The optional `template` argument loads a
 * starter body and category; without it, the calculation is blank.
 */
export async function createFinanceCalculation(
  kind: FinanceCalculatorKind,
  options: { template?: FinanceTemplate; title?: string } = {}
): Promise<FinanceCalculation> {
  const template = options.template;
  const category = template?.category ?? "blank";
  const body = template ? loadTemplateBody(template) : createBlankBody(kind);
  const now = new Date().toISOString();
  const id = generateCalculationId(kind);
  const calculation: FinanceCalculation = {
    meta: {
      id,
      kind,
      title: options.title?.trim() || defaultTitle(kind, category),
      category,
      createdAt: now,
      updatedAt: now,
      autosavedAt: null,
      version: 1,
      size: 0,
    },
    body,
  };
  const result = await storageCreate(calculation);
  if (!result.ok) {
    // Storage failure should be rare in the browser; fall back to a
    // in-memory calculation so the editor still opens.
    return {
      ...calculation,
      meta: { ...calculation.meta, size: JSON.stringify(calculation).length },
    };
  }
  return result.calculation;
}

/** Opens a calculation by id. Returns `null` if it does not exist locally. */
export async function openFinanceCalculation(
  id: string
): Promise<FinanceCalculation | null> {
  return storageGet(id);
}

/**
 * Saves a calculation. The caller passes the full calculation; the engine
 * bumps the version and the timestamps, then writes through.
 */
export async function saveFinanceCalculation(
  calculation: FinanceCalculation
): Promise<FinanceCalculation> {
  const result = await storageSave(calculation);
  if (!result.ok) return calculation;
  await recordRecentCalculation(result.calculation);
  return result.calculation;
}

/** Autosaves a calculation, skipping the write when the body is unchanged. */
export async function autosaveFinanceCalculation(
  calculation: FinanceCalculation
): Promise<FinanceCalculation> {
  const result = await storageAutosave(calculation);
  if (!result.ok) return calculation;
  await recordRecentCalculation(result.calculation);
  return result.calculation;
}

/** Renames a calculation. Returns the updated summary or `null`. */
export async function renameFinanceCalculation(
  id: string,
  title: string
): Promise<FinanceCalculationSummary | null> {
  const summary = await storageRename(id, title);
  if (summary) {
    const existing = await storageGet(id);
    if (existing) await recordRecentCalculation(existing);
  }
  return summary;
}

/** Duplicates a calculation and returns the new calculation. */
export async function duplicateFinanceCalculation(
  id: string
): Promise<FinanceCalculation | null> {
  const copy = await storageDuplicate(id);
  if (copy) await recordRecentCalculation(copy);
  return copy;
}

/** Soft-deletes a calculation. */
export async function deleteFinanceCalculation(
  id: string
): Promise<boolean> {
  const ok = await storageDelete(id);
  if (ok) {
    try {
      await fetch(`/api/finance/calculations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort: the dashboard mirror may be slightly stale until the
      // next page load rebuilds it.
    }
  }
  return ok;
}

/** Lists recent calculation summaries, newest first. */
export async function listFinanceCalculations(
  options: { kind?: FinanceCalculatorKind; limit?: number } = {}
): Promise<FinanceCalculationSummary[]> {
  const { summaries } = await storageList(options);
  return summaries;
}

/**
 * Best-effort mirror of a calculation into the server-side
 * recent-calculations table. Failures here never surface to the user
 * because the calculation is already saved locally.
 */
async function recordRecentCalculation(
  calculation: FinanceCalculation
): Promise<void> {
  try {
    await fetch("/api/finance/calculations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: calculation.meta.id,
        kind: calculation.meta.kind,
        title: calculation.meta.title,
        category: calculation.meta.category,
        version: calculation.meta.version,
        size: calculation.meta.size,
        updatedAt: calculation.meta.updatedAt,
      }),
    });
  } catch {
    // The local copy is the source of truth; the mirror is a hint.
  }
}
