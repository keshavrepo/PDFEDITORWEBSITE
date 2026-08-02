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
  DEFAULT_CONVERTER_BODY,
  DEFAULT_PLAYER_BODY,
  DEFAULT_RECORDER_BODY,
  DEFAULT_TRIMMER_BODY,
  asConverterBody,
  asPlayerBody,
  asRecorderBody,
  asTrimmerBody,
  cloneConverterBody,
  clonePlayerBody,
  cloneRecorderBody,
  cloneTrimmerBody,
} from "./bodies";
import type {
  AudioPlayerBody,
  AudioRecorderBody,
  AudioSessionCategory,
  AudioSessionKind,
  AudioTemplate,
  AudioTrimmerBody,
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
  clonePlayerBody,
  cloneTrimmerBody,
  cloneConverterBody,
  cloneRecorderBody,
  DEFAULT_PLAYER_BODY,
  DEFAULT_TRIMMER_BODY,
  DEFAULT_CONVERTER_BODY,
  DEFAULT_RECORDER_BODY,
};

export type {
  AudioPlayerBody,
  AudioTrimmerBody,
  AudioConverterBody,
  AudioRecorderBody,
};
