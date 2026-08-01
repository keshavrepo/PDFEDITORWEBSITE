/**
 * Shared types for the FinancePilot workspace.
 *
 * FinancePilot is a single workspace that hosts many financial calculators
 * (loan, mortgage, compound interest, …) on top of one engine. The engine
 * only cares about an abstract `FinanceCalculation`; each calculator kind
 * declares its own input schema and result shape through the calculator
 * descriptor. The workspace shell, storage layer and search index are
 * all keyed off these types.
 */

/** The calculator kinds FinancePilot can host. */
export type FinanceCalculatorKind = string;

/** A category for a calculation, surfaced in the new-calculation menu. */
export type FinanceCalculationCategory =
  | "blank"
  | "loan"
  | "mortgage"
  | "compound-interest"
  | "savings"
  | "investment"
  | "tax"
  | "currency"
  | "budget"
  | "invoice"
  | "roi"
  | "break-even"
  | "discount"
  | "tip"
  | "retirement"
  | "debt"
  | "cash-flow"
  | "custom";

/** File extensions FinancePilot can export. */
export type FinanceFileExtension = "json" | "csv" | "pdf";

/** Persistent metadata stored alongside the calculation body. */
export interface FinanceCalculationMeta {
  /** Stable id; used as the IndexedDB key and the audit trail. */
  id: string;
  /** Calculator kind this calculation belongs to. */
  kind: FinanceCalculatorKind;
  /** Free-text title shown in tabs and the file manager. */
  title: string;
  /** Calculation category, used for templates and the new-calculation menu. */
  category: FinanceCalculationCategory;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the last user edit. */
  updatedAt: string;
  /**
   * ISO timestamp of the last successful autosave. Separated from
   * `updatedAt` so the version-ready architecture can compare what the user
   * touched against what was committed to storage.
   */
  autosavedAt: string | null;
  /**
   * Monotonically increasing version. Bumped on every save (manual or
   * automatic) so a future history UI can render diffs without a bespoke
   * engine — the body itself is the source of truth.
   */
  version: number;
  /** Bytes of the in-memory body. Approximate; for status readouts only. */
  size: number;
  /** Optional language tag for spellcheck or accessibility hints. */
  language?: string;
  /**
   * Optional user tags, lowercase, free-text. Surfaced in the file manager
   * filter; never used for routing or permission decisions.
   */
  tags?: string[];
}

/**
 * A calculation stored in FinancePilot.
 *
 * The body is intentionally `unknown` because each calculator kind shapes
 * it differently (loan inputs, mortgage amortisation, savings schedule, …).
 * Every calculator guards the shape at the boundary and the engine is
 * the single place that knows how to evaluate the result.
 */
export interface FinanceCalculation {
  meta: FinanceCalculationMeta;
  body: unknown;
}

/** A short summary of a calculation used in lists and the file manager. */
export interface FinanceCalculationSummary {
  id: string;
  kind: FinanceCalculatorKind;
  title: string;
  category: FinanceCalculationCategory;
  updatedAt: string;
  autosavedAt: string | null;
  version: number;
  size: number;
}

/** Static template descriptor. Bodies are loaded lazily. */
export interface FinanceTemplate {
  id: string;
  kind: FinanceCalculatorKind;
  category: FinanceCalculationCategory;
  name: string;
  description: string;
  /** Whether a starter body is available locally. */
  hasStarter: boolean;
  /** Marketing-grade highlights shown on the template card. */
  highlights: string[];
}

/**
 * A calculator descriptor.
 *
 * Each future calculator registers one of these. The workspace shell reads
 * the array to decide which surface to mount, which tab to default to, and
 * what to show in the directory. The shape mirrors ImagePilot's
 * `WorkspaceDefinition` and OfficePilot's `OfficeEditorDefinition` so a
 * reader who knows one product knows all three.
 */
export interface FinanceCalculatorDefinition {
  id: string;
  kind: FinanceCalculatorKind;
  /** Route segment under `/financepilot`. Empty for the default calculator. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  /** Default category when the user starts a blank calculation. */
  defaultCategory: FinanceCalculationCategory;
  /** Search keywords, mirroring the rest of the platform. */
  keywords: string[];
  /** Short bullets shown on the product page. */
  highlights: string[];
  /** Marketing-grade count for the product card. */
  toolCount: number;
}

/**
 * The output of a single evaluation.
 *
 * The engine is the single place that knows how to compute a result from
 * a calculation body; the workspace shell never reads `body` directly.
 * Each calculator registers an `evaluate` function on the calculator
 * descriptor and returns a typed `FinanceEvaluation`.
 */
export interface FinanceEvaluation {
  /** Whether the evaluation succeeded. */
  ok: boolean;
  /** Human-readable result lines, ready for the properties panel. */
  lines: Array<{ label: string; value: string }>;
  /** Optional error message when `ok` is false. */
  error?: string;
  /** Optional amortisation schedule for loan-style calculators. */
  schedule?: FinanceScheduleRow[];
  /** Optional chart-friendly series for visualisations. */
  series?: FinanceChartSeries[];
}

export interface FinanceScheduleRow {
  /** 1-based period number. */
  period: number;
  /** Payment for the period. */
  payment: number;
  /** Interest portion of the payment. */
  interest: number;
  /** Principal portion of the payment. */
  principal: number;
  /** Outstanding balance after the payment. */
  balance: number;
}

export interface FinanceChartSeries {
  name: string;
  points: Array<{ label: string; value: number }>;
}
