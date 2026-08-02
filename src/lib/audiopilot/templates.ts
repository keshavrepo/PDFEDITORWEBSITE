/**
 * AudioPilot template registry.
 *
 * The template list is product metadata: it tells the new-session
 * menu what is available, what category it belongs to, and what
 * the starter body looks like. Starter bodies are loaded lazily
 * from the runtime so the directory stays small and a session
 * kind never imports a body it does not need.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * `templates.ts` shape.
 */

import { sessionCategoryOrder } from "./sessions";
import {
  DEFAULT_BATCH_BODY,
  DEFAULT_CONVERTER_BODY,
  DEFAULT_EFFECTS_BODY,
  DEFAULT_EXPORT_CENTER_BODY,
  DEFAULT_LIBRARY_BODY,
  DEFAULT_MERGER_BODY,
  DEFAULT_METADATA_EDITOR_BODY,
  DEFAULT_PLAYER_BODY,
  DEFAULT_PRODUCTIVITY_BODY,
  DEFAULT_RECORDER_BODY,
  DEFAULT_SILENCE_BODY,
  DEFAULT_SPLITTER_BODY,
  DEFAULT_TRIMMER_BODY,
  DEFAULT_WAVEFORM_EDITOR_BODY,
  asBatchBody,
  asConverterBody,
  asEffectsBody,
  asExportCenterBody,
  asLibraryBody,
  asMergerBody,
  asMetadataEditorBody,
  asPlayerBody,
  asProductivityBody,
  asRecorderBody,
  asSilenceBody,
  asSplitterBody,
  asTrimmerBody,
  asWaveformEditorBody,
  cloneBatchBody,
  cloneConverterBody,
  cloneEffectsBody,
  cloneExportCenterBody,
  cloneLibraryBody,
  cloneMergerBody,
  cloneMetadataEditorBody,
  clonePlayerBody,
  cloneProductivityBody,
  cloneRecorderBody,
  cloneSilenceBody,
  cloneSplitterBody,
  cloneTrimmerBody,
  cloneWaveformEditorBody,
} from "./bodies";
import type {
  AudioBatchBody,
  AudioEffectsBody,
  AudioExportCenterBody,
  AudioLibraryBody,
  AudioMergerBody,
  AudioMetadataEditorBody,
  AudioPlayerBody,
  AudioProductivityBody,
  AudioRecorderBody,
  AudioSessionCategory,
  AudioSessionKind,
  AudioSilenceBody,
  AudioSplitterBody,
  AudioTemplate,
  AudioTrimmerBody,
  AudioWaveformEditorBody,
  AudioConverterBody,
} from "./types";

/**
 * Returns the default body for a session kind.
 *
 * Each registered kind maps to its typed default body so the
 * new-session menu and the runtime both speak the same schema.
 */
export function createBlankBody(kind: AudioSessionKind): unknown {
  switch (kind) {
    case "player":
      return clonePlayerBody(DEFAULT_PLAYER_BODY);
    case "trimmer":
      return cloneTrimmerBody(DEFAULT_TRIMMER_BODY);
    case "converter":
      return cloneConverterBody(DEFAULT_CONVERTER_BODY);
    case "recorder":
      return cloneRecorderBody(DEFAULT_RECORDER_BODY);
    case "merger":
      return cloneMergerBody(DEFAULT_MERGER_BODY);
    case "splitter":
      return cloneSplitterBody(DEFAULT_SPLITTER_BODY);
    case "metadata":
      return cloneMetadataEditorBody(DEFAULT_METADATA_EDITOR_BODY);
    case "batch":
      return cloneBatchBody(DEFAULT_BATCH_BODY);
    case "library":
      return cloneLibraryBody(DEFAULT_LIBRARY_BODY);
    case "waveform-editor":
      return cloneWaveformEditorBody(DEFAULT_WAVEFORM_EDITOR_BODY);
    case "effects":
      return cloneEffectsBody(DEFAULT_EFFECTS_BODY);
    case "silence":
      return cloneSilenceBody(DEFAULT_SILENCE_BODY);
    case "export-center":
      return cloneExportCenterBody(DEFAULT_EXPORT_CENTER_BODY);
    case "productivity":
      return cloneProductivityBody(DEFAULT_PRODUCTIVITY_BODY);
    case "blank":
    case "custom":
    default:
      return {
        kind,
        notes: "",
        fields: {},
      };
  }
}

/** Static template descriptors. Every session kind ships a default. */
export const templates: AudioTemplate[] = [
  {
    id: "audio-blank",
    kind: "blank",
    category: "blank",
    name: "Blank session",
    description: "An empty session ready for any future audio tool.",
    hasStarter: true,
    highlights: ["Single screen", "Default fields", "Saves as you type"],
  },
  ...sessionCategoryOrder
    .filter((category) => category !== "blank" && category !== "custom")
    .map<AudioTemplate>((category) => ({
      id: `audio-${category}`,
      kind: category,
      category,
      name: `${category.charAt(0).toUpperCase()}${category.slice(1)} session`,
      description: `A blank ${category} session with the standard fields ready for the ${category} tool.`,
      hasStarter: true,
      highlights: ["Single screen", "Default fields", "Saves as you type"],
    })),
];

/** Templates for a given session kind, including the session-kind template itself. */
export function templatesForKind(kind: AudioSessionKind): AudioTemplate[] {
  return templates.filter((template) => template.kind === kind);
}

/** Loads a starter body for a template. */
export function loadTemplateBody(template: AudioTemplate): unknown {
  return createBlankBody(template.kind);
}

/** Re-exported normalisers so callers do not have to import the bodies file. */
export {
  asPlayerBody,
  asTrimmerBody,
  asConverterBody,
  asRecorderBody,
  asMergerBody,
  asSplitterBody,
  asMetadataEditorBody,
  asBatchBody,
  asLibraryBody,
  asWaveformEditorBody,
  asEffectsBody,
  asSilenceBody,
  asExportCenterBody,
  asProductivityBody,
  clonePlayerBody,
  cloneTrimmerBody,
  cloneConverterBody,
  cloneRecorderBody,
  cloneMergerBody,
  cloneSplitterBody,
  cloneMetadataEditorBody,
  cloneBatchBody,
  cloneLibraryBody,
  cloneWaveformEditorBody,
  cloneEffectsBody,
  cloneSilenceBody,
  cloneExportCenterBody,
  cloneProductivityBody,
  DEFAULT_PLAYER_BODY,
  DEFAULT_TRIMMER_BODY,
  DEFAULT_CONVERTER_BODY,
  DEFAULT_RECORDER_BODY,
  DEFAULT_MERGER_BODY,
  DEFAULT_SPLITTER_BODY,
  DEFAULT_METADATA_EDITOR_BODY,
  DEFAULT_BATCH_BODY,
  DEFAULT_LIBRARY_BODY,
  DEFAULT_WAVEFORM_EDITOR_BODY,
  DEFAULT_EFFECTS_BODY,
  DEFAULT_SILENCE_BODY,
  DEFAULT_EXPORT_CENTER_BODY,
  DEFAULT_PRODUCTIVITY_BODY,
};

export type {
  AudioPlayerBody,
  AudioTrimmerBody,
  AudioConverterBody,
  AudioRecorderBody,
  AudioMergerBody,
  AudioSplitterBody,
  AudioMetadataEditorBody,
  AudioBatchBody,
  AudioLibraryBody,
  AudioWaveformEditorBody,
  AudioEffectsBody,
  AudioSilenceBody,
  AudioExportCenterBody,
  AudioProductivityBody,
};
