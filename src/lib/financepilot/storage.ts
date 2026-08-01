/**
 * FinancePilot calculation storage.
 *
 * Calculations are stored in the browser (IndexedDB) so they are always
 * available offline and never have to round-trip a server. The platform
 * keeps a small "recent calculations" mirror in the server database, so
 * the dashboard, file manager and search can list them without reading
 * the IndexedDB on every visit.
 *
 * This file only describes the storage layer. The actual IndexedDB code
 * lives in `client-storage.ts`; that file is loaded only in the browser so
 * the server bundle never imports `indexedDB`.
 */

import type {
  FinanceCalculation,
  FinanceCalculationSummary,
  FinanceCalculatorKind,
} from "./types";

/** The IndexedDB database name. Stable across versions. */
export const STORAGE_DATABASE = "launchstack-financepilot";

/** Object store name. One per database, keyed by calculation id. */
export const STORAGE_STORE = "calculations";

/** The current schema version. Bumped when the body shape changes. */
export const STORAGE_VERSION = 1;

/** Maximum calculation size, in bytes, that the storage will accept. */
export const MAX_CALCULATION_BYTES = 4 * 1024 * 1024;

/** Maximum number of calculations stored locally. Older ones are evicted. */
export const MAX_LOCAL_CALCULATIONS = 200;

/** Maximum age in days of a calculation that the storage will retain. */
export const MAX_LOCAL_AGE_DAYS = 90;

/** A request to list recent calculations. */
export interface ListCalculationsOptions {
  kind?: FinanceCalculatorKind;
  limit?: number;
}

/** Result of listing calculations, sorted newest first. */
export interface ListCalculationsResult {
  summaries: FinanceCalculationSummary[];
  total: number;
}

/** Outcome of a save attempt. */
export type SaveResult =
  | { ok: true; calculation: FinanceCalculation }
  | { ok: false; reason: "too-large" | "invalid" | "missing-id" | "io" };

/** Outcome of an autosave attempt. */
export type AutosaveResult = SaveResult | { ok: false; reason: "noop" };
