/**
 * Pluggable conversion engine contract.
 *
 * The UI talks only to this interface, so additional engines — Tesseract,
 * PaddleOCR, Google Cloud Vision, Azure Document Intelligence — can be
 * registered later without any UI change. Each engine declares what it can
 * handle and how much it costs to run; the registry picks the best available
 * engine for the document at hand.
 */

import type { ConversionProgressCallback, DocumentMetadata } from "../types";
import type { TextQualityReport } from "../text-quality";

export type EngineId =
  | "native-pdf"
  | "tesseract-ocr"
  | "paddle-ocr"
  | "google-vision-ocr"
  | "azure-ocr";

export type OutputFormat = "docx" | "pptx" | "pdf";

/** Where an engine runs, which determines its privacy characteristics. */
export type ExecutionEnvironment = "browser" | "server" | "third-party-api";

export interface EngineCapabilities {
  /** Output formats this engine can produce. */
  outputs: OutputFormat[];
  /**
   * True when the engine can recover text from page images. Only OCR engines
   * can, and only they can handle scanned or legacy-font documents.
   */
  opticalCharacterRecognition: boolean;
  /** Engine keeps document bytes on the user's device. */
  privacyPreserving: boolean;
  /** Rough relative speed, used to prefer the fastest capable engine. */
  relativeSpeed: "fast" | "moderate" | "slow";
  /** BCP-47 language tags the engine can recognise, when constrained. */
  languages?: string[];
}

export interface EngineConversionRequest {
  data: Uint8Array;
  output: OutputFormat;
  /** Quality report for the source document, when already computed. */
  quality?: TextQualityReport;
  signal?: AbortSignal;
  onProgress?: ConversionProgressCallback;
}

export interface EngineConversionResult {
  data: Uint8Array;
  engine: EngineId;
  metadata?: DocumentMetadata;
}

/**
 * A conversion backend.
 *
 * Implementations must be side-effect free until `convert` is called so the
 * registry can inspect and rank them cheaply.
 */
export interface ConversionEngine {
  readonly id: EngineId;
  readonly name: string;
  readonly description: string;
  readonly environment: ExecutionEnvironment;
  readonly capabilities: EngineCapabilities;

  /**
   * Whether the engine is usable right now. OCR engines that need a model
   * download, an API key or a network connection report `false` until
   * configured, which keeps unavailable options out of the UI.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Whether this engine can convert a specific document. The quality report
   * lets an engine decline work it would handle badly — the native engine
   * declines documents whose text layer cannot be trusted.
   */
  canHandle(request: { output: OutputFormat; quality: TextQualityReport }): boolean;

  convert(request: EngineConversionRequest): Promise<EngineConversionResult>;
}
