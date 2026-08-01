/**
 * The built-in engine: direct, in-browser conversion of a PDF's existing text
 * layer.
 *
 * This is the fast path and stays the default for every document whose text
 * can be decoded. It deliberately declines documents that need OCR rather than
 * emitting a corrupted result.
 */

import { convertPdfToWord } from "../pdf-to-word";
import { convertPdfToPowerPoint } from "../pdf-to-powerpoint";
import type { TextQualityReport } from "../text-quality";
import type {
  ConversionEngine,
  EngineConversionRequest,
  EngineConversionResult,
  OutputFormat,
} from "./types";

export const nativePdfEngine: ConversionEngine = {
  id: "native-pdf",
  name: "Native conversion",
  description:
    "Converts the PDF's existing text layer directly in your browser. Fastest option, and the document never leaves your device.",
  environment: "browser",
  capabilities: {
    outputs: ["docx", "pptx"],
    opticalCharacterRecognition: false,
    privacyPreserving: true,
    relativeSpeed: "fast",
  },

  async isAvailable() {
    return true;
  },

  canHandle({ output, quality }: { output: OutputFormat; quality: TextQualityReport }) {
    if (!this.capabilities.outputs.includes(output)) return false;
    // The whole point of the quality check: never convert what we cannot read.
    return quality.strategy === "native";
  },

  async convert({
    data,
    output,
    signal,
    onProgress,
  }: EngineConversionRequest): Promise<EngineConversionResult> {
    const bytes =
      output === "pptx"
        ? await convertPdfToPowerPoint(data, { signal }, onProgress)
        : await convertPdfToWord(data, { signal }, onProgress);

    return { data: bytes, engine: "native-pdf" };
  },
};
