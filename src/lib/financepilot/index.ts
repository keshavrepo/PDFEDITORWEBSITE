/**
 * FinancePilot public surface.
 *
 * Components import from this file rather than the underlying modules, so
 * the engine can move pieces between files without breaking every caller.
 */

export * from "./types";
export * from "./calculators";
export * from "./calculator-runtime";
export * from "./templates";
export * from "./engine";
export * from "./evaluate";
export * from "./pdf-export";
export {
  STORAGE_DATABASE,
  STORAGE_STORE,
  STORAGE_VERSION,
  MAX_CALCULATION_BYTES,
  MAX_LOCAL_AGE_DAYS,
  MAX_LOCAL_CALCULATIONS,
} from "./storage";
export type {
  ListCalculationsOptions,
  ListCalculationsResult,
  SaveResult,
  AutosaveResult,
} from "./storage";
