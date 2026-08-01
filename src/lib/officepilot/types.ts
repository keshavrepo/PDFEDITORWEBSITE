/**
 * Shared types for the OfficePilot workspace.
 *
 * OfficePilot is a single workspace that hosts three editor kinds (word,
 * spreadsheet, presentation) on top of one engine. The engine only cares about
 * an abstract `OfficeDocument`; the editor kinds extend that with their own
 * body schema. The workspace shell, storage layer and shortcut system are all
 * keyed off these types.
 */

/** The three editor kinds OfficePilot can host. */
export type OfficeEditorKind = "word" | "spreadsheet" | "presentation";

/** File extensions OfficePilot can read and write natively. */
export type OfficeFileExtension = "docx" | "xlsx" | "pptx" | "txt" | "csv";

/** A user-visible document category. Maps to the template categories. */
export type OfficeDocumentCategory =
  | "blank"
  | "resume"
  | "invoice"
  | "letter"
  | "business-letter"
  | "cover-letter"
  | "meeting-notes"
  | "budget"
  | "planner"
  | "monthly-planner"
  | "checklist"
  | "presentation"
  | "report";

/** Persistent metadata stored alongside the document body. */
export interface OfficeDocumentMeta {
  /** Stable id; used as the IndexedDB key and the audit trail. */
  id: string;
  /** Editor kind this document belongs to. */
  kind: OfficeEditorKind;
  /** Free-text title shown in tabs and the file manager. */
  title: string;
  /** Document category, used for templates and the new-document menu. */
  category: OfficeDocumentCategory;
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
 * A document stored in OfficePilot.
 *
 * The body is intentionally `unknown` because the three editor kinds shape
 * it differently (rich text runs, cell matrix, slide list). Every editor
 * guards the shape at the boundary.
 */
export interface OfficeDocument {
  meta: OfficeDocumentMeta;
  body: unknown;
}

/** A short summary of a document used in lists and the file manager. */
export interface OfficeDocumentSummary {
  id: string;
  kind: OfficeEditorKind;
  title: string;
  category: OfficeDocumentCategory;
  updatedAt: string;
  autosavedAt: string | null;
  version: number;
  size: number;
}

/** Static template descriptor. Bodies are loaded lazily. */
export interface OfficeTemplate {
  id: string;
  kind: OfficeEditorKind;
  category: OfficeDocumentCategory;
  name: string;
  description: string;
  /** Whether a starter body is available locally. */
  hasStarter: boolean;
  /** Marketing-grade highlights shown on the template card. */
  highlights: string[];
}

/** Identifies a slot the workspace hosts. */
export type OfficeEditorSlot = "primary";

/** A workspace descriptor, mirroring ImagePilot's `WorkspaceDefinition`. */
export interface OfficeEditorDefinition {
  id: string;
  kind: OfficeEditorKind;
  /** Route segment under `/officepilot`. Empty for the default editor. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  /** Default file extension for the kind. */
  extension: OfficeFileExtension;
  /** MIME type used when exporting the canonical file. */
  mimeType: string;
  /** Default document category when the user starts a blank document. */
  defaultCategory: OfficeDocumentCategory;
  /** Search keywords, mirroring the rest of the platform. */
  keywords: string[];
  /** Short bullets shown on the product page. */
  highlights: string[];
  /** Marketing-grade word count for the product card. */
  toolCount: number;
}
