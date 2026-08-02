/**
 * AudioPilot session registry.
 *
 * The foundation ships with a list of session categories. Each future
 * session registers itself in the `sessions` array and gets picked up
 * by the workspace shell, the search index and the products page.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * `sessions.ts` shape: a small typed array and a couple of lookup
 * helpers, so a reader who knows one product knows them all.
 */

import type {
  AudioSessionCategory,
  AudioSessionDefinition,
  AudioSessionKind,
} from "./types";

/** Session categories in the order they appear in the new-session menu. */
export const sessionCategoryOrder: AudioSessionCategory[] = [
  "blank",
  "player",
  "trimmer",
  "converter",
  "recorder",
  "custom",
];

/** Human-readable label for a category. */
export const sessionCategoryLabels: Record<AudioSessionCategory, string> = {
  blank: "Blank",
  player: "Player",
  trimmer: "Trimmer",
  converter: "Converter",
  recorder: "Recorder",
  custom: "Custom",
};

/** Short description for each category, used as the menu section header. */
export const sessionCategoryDescriptions: Record<
  AudioSessionCategory,
  string
> = {
  blank: "Start from an empty session",
  player:
    "Audio Player — play, pause, stop, seek, volume, mute, playback speed, loop, current time, duration and waveform preview",
  trimmer:
    "Audio Trimmer — trim start, trim end, precision controls, live preview, undo, redo and export",
  converter:
    "Audio Converter — MP3, WAV, OGG, FLAC, AAC import and export with metadata preservation where the format supports it",
  recorder:
    "Recorder — microphone recording with pause, resume, stop, playback and save to the same IndexedDB store",
  custom: "Anything else you build",
};

/**
 * Registered sessions.
 *
 * The array is the single source of truth for which sessions the
 * workspace shell mounts, which sessions the products page lists,
 * and which sessions the search index surfaces. Adding a new
 * session means appending one descriptor here.
 */
export const sessions: AudioSessionDefinition[] = [
  {
    id: "audio-dashboard",
    kind: "dashboard",
    slug: "dashboard",
    name: "Workspace dashboard",
    tagline: "A one-page summary of your AudioPilot workspace",
    description:
      "The AudioPilot Workspace Dashboard surfaces every important surface in one place: recent sessions, recent and favourite recordings, the active favourite tools, the favourite-tool registry, the per-tool usage breakdown, and quick links to every other AudioPilot surface. The dashboard is the default landing surface for every AudioPilot session.",
    intro:
      "Open the Workspace Dashboard to see every AudioPilot surface in one place. The dashboard reads from the same IndexedDB-backed store the rest of the workspace uses, so the data is always in sync.",
    defaultCategory: "blank",
    keywords: ["dashboard", "summary", "AudioPilot"],
    highlights: [
      "Recent sessions",
      "Recent and favourite recordings",
      "Favourite tools",
      "Quick links to every surface",
    ],
    toolCount: 1,
  },
  {
    id: "audio-blank",
    kind: "blank",
    slug: "",
    name: "Blank session",
    tagline: "Start from an empty canvas",
    description:
      "An empty AudioPilot session ready for any future audio tool. The workspace saves automatically, mirrors to the server, and lets you organise the session with tags and favourites.",
    intro:
      "Create a blank AudioPilot session. The workspace will hold the body, save it automatically, and surface it on the dashboard. Future audio tools will replace this blank with their own surface.",
    defaultCategory: "blank",
    keywords: ["blank", "session", "AudioPilot"],
    highlights: ["Empty body", "Autosaves", "Mirrored to the dashboard"],
    toolCount: 1,
  },
  {
    id: "audio-player",
    kind: "player",
    slug: "player",
    name: "Audio Player",
    tagline:
      "Play, pause, stop, seek, volume, mute, playback speed, loop, current time, duration and waveform preview",
    description:
      "A professional Audio Player for AudioPilot. Open any MP3, WAV, OGG, FLAC or AAC file, see the waveform preview, scrub through it, control the playback speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x), set the volume, mute, loop, and read the current time and total duration. The Player uses the platform's `AudioContext` for decoding and the same IndexedDB store the rest of the workspace uses, so sessions survive a reload.",
    intro:
      "Open the Audio Player to play any MP3, WAV, OGG, FLAC or AAC file. The Player decodes the file through the browser's `AudioContext`, paints a waveform preview from the decoded samples, and gives you the full set of professional transport controls: play, pause, stop, seek, volume, mute, playback speed, loop, current time and total duration. Save the session, favourite it, or move on to the Trimmer, Converter or Recorder.",
    defaultCategory: "player",
    keywords: [
      "audio",
      "player",
      "playback",
      "waveform",
      "mp3",
      "wav",
      "ogg",
      "flac",
      "aac",
      "AudioPilot",
    ],
    highlights: [
      "MP3, WAV, OGG, FLAC and AAC playback",
      "Waveform preview derived from the decoded samples",
      "Play, pause, stop, seek, volume, mute, loop, current time, duration",
      "Playback speed 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x",
      "Persists playback state between sessions",
    ],
    toolCount: 1,
  },
  {
    id: "audio-trimmer",
    kind: "trimmer",
    slug: "trimmer",
    name: "Audio Trimmer",
    tagline:
      "Trim start, trim end, precision controls, live preview, undo, redo and export",
    description:
      "A professional Audio Trimmer for AudioPilot. Open any MP3, WAV, OGG, FLAC or AAC file, set the trim start and trim end on a waveform, choose a precision (fine or coarse), preview the trimmed range, undo / redo every change, and export the result to the same source format. The Trimmer keeps a per-session undo / redo stack so every adjustment is reversible.",
    intro:
      "Open the Audio Trimmer to cut an audio file down to the section you need. Drag the trim handles on the waveform preview, switch the precision to fine-tune, hit play to preview, undo if you missed, and export when the cut is right. The export is the same source format the input was, so the file you download is the file you trimmed.",
    defaultCategory: "trimmer",
    keywords: [
      "audio",
      "trimmer",
      "trim",
      "cut",
      "waveform",
      "export",
      "AudioPilot",
    ],
    highlights: [
      "Trim start and trim end on a waveform preview",
      "Precision controls: fine (0.01s) and coarse (0.1s)",
      "Live preview plays just the trimmed range",
      "Per-session undo / redo stack",
      "Export to the same source format",
    ],
    toolCount: 1,
  },
  {
    id: "audio-converter",
    kind: "converter",
    slug: "converter",
    name: "Audio Converter",
    tagline:
      "MP3, WAV, OGG, FLAC, AAC import and export with metadata preservation where possible",
    description:
      "A professional Audio Converter for AudioPilot. Import a file in any of MP3, WAV, OGG, FLAC or AAC, pick a target format, optionally set a target bitrate, attach metadata (artist, title, album, year, composer, genre, …), and export. The Converter reuses the platform's `MediaRecorder` for in-browser re-encoding and falls back to a passthrough when the requested target is not supported, with a clear message in the toast.",
    intro:
      "Open the Audio Converter to turn a file from one format to another. Pick a target format, attach metadata, choose a bitrate, hit convert, and download. The Converter preserves the most useful metadata fields and reports the converted size and timestamp in the surface.",
    defaultCategory: "converter",
    keywords: [
      "audio",
      "converter",
      "mp3",
      "wav",
      "ogg",
      "flac",
      "aac",
      "metadata",
      "AudioPilot",
    ],
    highlights: [
      "MP3, WAV, OGG, FLAC and AAC import and export",
      "Target bitrate from 32 to 320 kbps",
      "Metadata editor: artist, title, album, year, genre, composer, free-form",
      "Best-effort re-encoding through the platform's MediaRecorder",
      "Reports converted size and last-converted timestamp",
    ],
    toolCount: 1,
  },
  {
    id: "audio-recorder",
    kind: "recorder",
    slug: "recorder",
    name: "Recorder",
    tagline:
      "Microphone recording with pause, resume, stop, playback and save",
    description:
      "A professional Recorder for AudioPilot. Pick a microphone, hit record, pause and resume as you go, stop, preview the capture, and save it to the same IndexedDB store the rest of the workspace uses. The Recorder keeps the most recent captures, lets you rename and delete them, and exposes the raw audio data URL so future tools can re-encode or re-use the capture.",
    intro:
      "Open the Recorder to capture audio from your microphone. Hit record to start, pause to step away, resume to keep going, stop to finish, and save to add the capture to your workspace. The Recorder stores every capture in IndexedDB so the next session can replay it without re-recording.",
    defaultCategory: "recorder",
    keywords: [
      "audio",
      "recorder",
      "microphone",
      "record",
      "pause",
      "resume",
      "playback",
      "AudioPilot",
    ],
    highlights: [
      "Microphone capture through the platform's MediaRecorder",
      "Pause, resume, stop and a live time readout",
      "Inline playback with the same transport controls as the Player",
      "Save the capture to the workspace IndexedDB store",
      "Most-recent captures list with rename, delete and favourite",
    ],
    toolCount: 1,
  },
];

/** All non-dashboard sessions, used for the tool switcher. */
export const focusedSessions = sessions.filter(
  (session) => session.slug !== "dashboard" && session.slug !== ""
);

export function getSession(
  kind: AudioSessionKind
): AudioSessionDefinition | undefined {
  return sessions.find((session) => session.kind === kind);
}

export function getSessionBySlug(
  slug: string
): AudioSessionDefinition | undefined {
  return sessions.find((session) => session.slug === slug);
}

/** Route for a session, e.g. `/audiopilot/player`. */
export function sessionHref(session: AudioSessionDefinition): string {
  return session.slug ? `/audiopilot/${session.slug}` : "/audiopilot";
}

/** Sessions for the directory, sorted by their category order. */
export function sessionsForCategory(
  category: AudioSessionCategory
): AudioSessionDefinition[] {
  return sessions.filter((session) => session.defaultCategory === category);
}
