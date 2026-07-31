/**
 * Engine registry and selection.
 *
 * Selection is centralised here so the UI never needs to know which engines
 * exist. Registering a future OCR engine is a one-line change and requires no
 * UI work: the badge, messaging and conversion flow all read from the outcome
 * this module returns.
 */

import type { TextQualityReport } from "../text-quality";
import { nativePdfEngine } from "./native-engine";
import type { ConversionEngine, EngineId, OutputFormat } from "./types";

const SPEED_RANK: Record<ConversionEngine["capabilities"]["relativeSpeed"], number> = {
  fast: 0,
  moderate: 1,
  slow: 2,
};

const engines = new Map<EngineId, ConversionEngine>();

/** Adds an engine, replacing any previous registration with the same id. */
export function registerEngine(engine: ConversionEngine): void {
  engines.set(engine.id, engine);
}

export function getEngine(id: EngineId): ConversionEngine | undefined {
  return engines.get(id);
}

export function listEngines(): ConversionEngine[] {
  return [...engines.values()];
}

// The native engine is always present; OCR engines register themselves when
// they are added to the product.
registerEngine(nativePdfEngine);

export interface EngineSelection {
  /** The engine to run, or null when nothing available can do the job. */
  engine: ConversionEngine | null;
  /** Engines that could handle the document but are not yet available. */
  unavailableCandidates: ConversionEngine[];
  /** True when the document needs OCR and no OCR engine is installed. */
  requiresOcr: boolean;
}

/**
 * Chooses the best available engine for a document.
 *
 * Preference order: privacy-preserving first (documents stay on-device), then
 * fastest. This keeps the native engine the default for readable PDFs even
 * once OCR engines exist.
 */
export async function selectEngine(
  output: OutputFormat,
  quality: TextQualityReport
): Promise<EngineSelection> {
  const capable = listEngines().filter((engine) => engine.canHandle({ output, quality }));

  const available: ConversionEngine[] = [];
  const unavailable: ConversionEngine[] = [];
  for (const engine of capable) {
    if (await engine.isAvailable()) available.push(engine);
    else unavailable.push(engine);
  }

  available.sort((first, second) => {
    if (first.capabilities.privacyPreserving !== second.capabilities.privacyPreserving) {
      return first.capabilities.privacyPreserving ? -1 : 1;
    }
    return (
      SPEED_RANK[first.capabilities.relativeSpeed] - SPEED_RANK[second.capabilities.relativeSpeed]
    );
  });

  return {
    engine: available[0] || null,
    unavailableCandidates: unavailable,
    requiresOcr: quality.strategy === "ocr-required",
  };
}
