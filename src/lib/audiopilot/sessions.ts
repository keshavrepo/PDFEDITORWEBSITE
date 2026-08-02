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
  "merger",
  "splitter",
  "metadata",
  "batch",
  "library",
  "waveform-editor",
  "effects",
  "silence",
  "export-center",
  "productivity",
  "custom",
];

/** Human-readable label for a category. */
export const sessionCategoryLabels: Record<AudioSessionCategory, string> = {
  blank: "Blank",
  player: "Player",
  trimmer: "Trimmer",
  converter: "Converter",
  recorder: "Recorder",
  merger: "Merger",
  splitter: "Splitter",
  metadata: "Metadata",
  batch: "Batch",
  library: "Library",
  "waveform-editor": "Waveform Editor",
  effects: "Effects",
  silence: "Silence Detection",
  "export-center": "Export Center",
  productivity: "Productivity",
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
  merger:
    "Audio Merger — merge unlimited audio files, reorder tracks, remove tracks, live preview, gap between tracks, fade between tracks, export merged audio",
  splitter:
    "Audio Splitter — split by time, split by markers, split into equal parts, split by silence, preview every segment, export selected segments",
  metadata:
    "Metadata Editor — title, artist, album, genre, year, track number, comments, cover art, save metadata",
  batch:
    "Batch Processing — batch convert, batch rename, batch metadata update, batch export, progress tracking, cancel processing",
  library:
    "Audio Library — recent files, favorites, search, sort, filter, duplicate, rename, delete",
  "waveform-editor":
    "Waveform Editor — high resolution waveform, zoom in, zoom out, horizontal scroll, timeline ruler, selection visualization, playback cursor, region markers",
  effects:
    "Audio Effects — fade in, fade out, normalize volume, silence generator, reverse, speed adjustment, pitch adjustment, preview before applying, undo, redo",
  silence:
    "Silence Detection — detect silence, jump between regions, split at silence, remove silence, adjustable threshold, adjustable minimum duration",
  "export-center":
    "Export Center — export selected region, export full audio, multiple formats, bitrate, sample rate, channel selection, progress indicator, cancel",
  productivity:
    "Workspace Productivity — keyboard shortcuts, command palette, autosave improvements, recent sessions, quick actions, restore previous session",
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
  {
    id: "audio-merger",
    kind: "merger",
    slug: "merger",
    name: "Audio Merger",
    tagline:
      "Merge unlimited audio files, reorder tracks, remove tracks, live preview, gap between tracks, fade between tracks, export merged audio",
    description:
      "A professional Audio Merger for AudioPilot. Drop in any number of MP3, WAV, OGG, FLAC or AAC files, reorder and remove tracks, set the gap between tracks, set the crossfade between consecutive tracks, preview the result on a per-track timeline, and export the merged mixdown. The merger runs an `OfflineAudioContext` mixdown so the export is sample-accurate, and the result lands in the user's downloads.",
    intro:
      "Open the Audio Merger to combine several audio files into one. Add tracks, reorder them on the timeline, set the gap and the crossfade, preview the result, and export. The merger persists the queue, the per-track volume / pan and the resolved timeline to the same IndexedDB store every other surface uses.",
    defaultCategory: "merger",
    keywords: [
      "audio",
      "merger",
      "merge",
      "combine",
      "concatenate",
      "mixdown",
      "crossfade",
      "AudioPilot",
    ],
    highlights: [
      "Merge unlimited MP3, WAV, OGG, FLAC and AAC files into one",
      "Reorder and remove tracks on a per-track timeline",
      "Gap between tracks, fade-in and fade-out per track",
      "Live preview plays the resolved mixdown on the timeline",
      "Sample-accurate export through the platform's OfflineAudioContext",
    ],
    toolCount: 1,
  },
  {
    id: "audio-splitter",
    kind: "splitter",
    slug: "splitter",
    name: "Audio Splitter",
    tagline:
      "Split by time, split by markers, split into equal parts, split by silence, preview every segment, export selected segments",
    description:
      "A professional Audio Splitter for AudioPilot. Open any MP3, WAV, OGG, FLAC or AAC file, pick a mode (split by time, split by markers, split into equal parts, split by silence), preview every segment on a waveform, choose which segments to export, and download the selection. The splitter keeps the resolved segments on the session body so the user can re-export without re-running the split.",
    intro:
      "Open the Audio Splitter to cut a long audio file into segments. Add markers on the waveform, set the time interval, the equal-part count or the silence threshold, run the split, preview each segment, and export the selection. The splitter re-encodes through the platform's MediaRecorder and writes the files to the user's downloads.",
    defaultCategory: "splitter",
    keywords: [
      "audio",
      "splitter",
      "split",
      "cut",
      "markers",
      "silence",
      "segments",
      "AudioPilot",
    ],
    highlights: [
      "Split by time, by markers, into equal parts, or by silence detection",
      "Preview every segment on a waveform with start / end / duration",
      "Select which segments to export, batch export to the downloads",
      "Silence detector computes an RMS-based threshold per sample",
      "Persists the resolved segments on the session body",
    ],
    toolCount: 1,
  },
  {
    id: "audio-metadata-editor",
    kind: "metadata",
    slug: "metadata",
    name: "Metadata Editor",
    tagline:
      "Title, artist, album, genre, year, track number, comments, cover art, save metadata",
    description:
      "A professional Metadata Editor for AudioPilot. Open any MP3, WAV, OGG, FLAC or AAC file, edit the standard tag fields (title, artist, album, genre, year, track number, comments), attach cover art, and save the metadata back to the same source. The editor reuses the platform's ID3v2 metadata reader the Converter already uses and persists the changes to the same IndexedDB store.",
    intro:
      "Open the Metadata Editor to fix the tags on a file. Edit the title, artist, album, genre, year, track number and comments, attach cover art, and save. The editor re-encodes the source through the platform's MediaRecorder with the new metadata baked in.",
    defaultCategory: "metadata",
    keywords: [
      "audio",
      "metadata",
      "tags",
      "id3",
      "cover art",
      "title",
      "artist",
      "album",
      "AudioPilot",
    ],
    highlights: [
      "Standard tag fields: title, artist, album, genre, year, track number, comments",
      "Cover art: pick a JPG / PNG, the editor stores it as a data URL",
      "Save metadata: re-encodes the source with the new tags baked in",
      "Best-effort re-encoding through the platform's MediaRecorder",
      "Reports the saved timestamp on the surface",
    ],
    toolCount: 1,
  },
  {
    id: "audio-batch",
    kind: "batch",
    slug: "batch",
    name: "Batch Processing",
    tagline:
      "Batch convert, batch rename, batch metadata update, batch export, progress tracking, cancel processing",
    description:
      "A professional Batch Processing surface for AudioPilot. Drop in a queue of files, pick a mode (batch convert, batch rename, batch metadata update, batch export), watch the progress bar advance per-item, cancel the batch at any time, and download the results as a ZIP. The batch reuses the same re-encoding pipeline the Converter, Metadata Editor and Trimmer already use.",
    intro:
      "Open the Batch Processing surface to apply a single operation to a queue of files. Add files, set the per-item options, hit run, watch the progress bar advance item by item, and download the ZIP when the batch finishes. The cancel button stops the queue between items so a long batch never runs away.",
    defaultCategory: "batch",
    keywords: [
      "audio",
      "batch",
      "queue",
      "convert",
      "rename",
      "metadata",
      "export",
      "zip",
      "AudioPilot",
    ],
    highlights: [
      "Batch convert, batch rename, batch metadata update, batch export",
      "Per-item progress, overall progress, current-item indicator",
      "Cancel processing between items without losing the queue",
      "Result ZIP streamed through the platform's JSZip dependency",
      "Reuses the same IndexedDB store every other surface uses",
    ],
    toolCount: 1,
  },
  {
    id: "audio-library",
    kind: "library",
    slug: "library",
    name: "Audio Library",
    tagline:
      "Recent files, favorites, search, sort, filter, duplicate, rename, delete",
    description:
      "A professional Audio Library for AudioPilot. Browse every audio file the user has imported across the workspace, sort by date, name, size or duration, filter by format or by favourites, search the metadata, mark favourites, and rename, duplicate or delete entries. The library is the \"files I have\" view that powers the file picker every other AudioPilot surface uses.",
    intro:
      "Open the Audio Library to see every audio file you have imported. Search, sort, filter, pin favourites, and manage the entries with rename, duplicate and delete. The library is the source of truth for \"which file is in my workspace\" and every other surface reads from it.",
    defaultCategory: "library",
    keywords: [
      "audio",
      "library",
      "files",
      "favorites",
      "search",
      "sort",
      "filter",
      "AudioPilot",
    ],
    highlights: [
      "Recent files and favourites in one place",
      "Search by name, artist, album and tags",
      "Sort by date, name, size, duration or last opened",
      "Filter by format or favourites-only",
      "Rename, duplicate and delete entries inline",
    ],
    toolCount: 1,
  },
  {
    id: "audio-waveform-editor",
    kind: "waveform-editor",
    slug: "waveform-editor",
    name: "Waveform Editor",
    tagline:
      "High resolution waveform, zoom in, zoom out, horizontal scroll, timeline ruler, selection visualization, playback cursor, region markers",
    description:
      "A professional Waveform Editor for AudioPilot. Open any MP3, WAV, OGG, FLAC or AAC file, see a high-resolution waveform that scales with the active zoom level, scroll horizontally through long files, pick a selection on the timeline, drop region markers for verses / choruses / cues, and follow the playback cursor as the audio plays. The editor reuses the same IndexedDB store every other surface uses, so the source and the active selection survive a reload.",
    intro:
      "Open the Waveform Editor to inspect and edit a file with a high-resolution waveform. Zoom in to see individual transients, scroll horizontally through a long file, drop region markers on the timeline, drag out a selection, and follow the playback cursor in real time. The editor's state persists in the same IndexedDB store every other surface uses.",
    defaultCategory: "waveform-editor",
    keywords: [
      "audio",
      "waveform",
      "editor",
      "zoom",
      "scroll",
      "selection",
      "cursor",
      "marker",
      "AudioPilot",
    ],
    highlights: [
      "High-resolution waveform that scales with the active zoom",
      "Zoom in / zoom out, horizontal scroll, snap to ruler",
      "Timeline ruler with adaptive step (0.1s, 1s, 5s, 10s)",
      "Selection visualization with start and end times",
      "Playback cursor that follows the audio in real time",
      "Region markers for verses, choruses, cues, custom labels",
    ],
    toolCount: 1,
  },
  {
    id: "audio-effects",
    kind: "effects",
    slug: "effects",
    name: "Audio Effects",
    tagline:
      "Fade in, fade out, normalize volume, silence generator, reverse, speed adjustment, pitch adjustment, preview before applying, undo, redo",
    description:
      "A professional Audio Effects surface for AudioPilot. Apply fade in, fade out, normalize, silence generation, reverse, speed adjustment and pitch adjustment to any MP3, WAV, OGG, FLAC or AAC file. The surface previews the result on a temporary buffer before the user commits, keeps a per-session undo / redo stack so every adjustment is reversible, and writes the final result to the same IndexedDB store every other surface uses.",
    intro:
      "Open the Audio Effects surface to apply a single effect at a time. Set the parameters, hit preview to hear the result on a temporary buffer, hit apply to commit it, and use the undo / redo stack to walk back through every adjustment.",
    defaultCategory: "effects",
    keywords: [
      "audio",
      "effects",
      "fade",
      "normalize",
      "silence",
      "reverse",
      "speed",
      "pitch",
      "AudioPilot",
    ],
    highlights: [
      "Fade in / fade out with adjustable duration",
      "Normalize volume to a target peak (0..1)",
      "Silence generator with adjustable duration",
      "Reverse audio, speed adjustment (0.25x..4x), pitch shift (+/-24 semitones)",
      "Preview before applying, per-session undo / redo",
    ],
    toolCount: 1,
  },
  {
    id: "audio-silence-detection",
    kind: "silence",
    slug: "silence",
    name: "Silence Detection",
    tagline:
      "Detect silence, jump between silence regions, split at silence, remove silence, adjustable threshold, adjustable minimum duration",
    description:
      "A professional Silence Detection surface for AudioPilot. Run an energy-threshold walk over the source audio to find silence regions, jump between regions, split the source at every silence boundary, or remove the silence regions and stitch the active ranges back together. The threshold and the minimum silence duration are adjustable so the detector works on clean podcasts, noisy field recordings, and music alike.",
    intro:
      "Open the Silence Detection surface to find the silent parts of a file. Set the threshold and the minimum duration, run the detector, jump between regions, and either split the source at every silence or remove the silence to produce a tighter cut. The result is written to the same IndexedDB store every other surface uses.",
    defaultCategory: "silence",
    keywords: [
      "audio",
      "silence",
      "detection",
      "split",
      "remove",
      "threshold",
      "AudioPilot",
    ],
    highlights: [
      "Energy-threshold silence walk with adjustable threshold (0..1)",
      "Adjustable minimum silence duration in seconds",
      "Padding in seconds added around every region",
      "Jump between regions, select multiple regions",
      "Split at silence or remove silence to stitch the active ranges",
    ],
    toolCount: 1,
  },
  {
    id: "audio-export-center",
    kind: "export-center",
    slug: "export-center",
    name: "Export Center",
    tagline:
      "Export selected region, export full audio, multiple formats, bitrate selection, sample rate selection, channel selection, progress indicator, cancel",
    description:
      "A professional Export Center for AudioPilot. Queue one or more export jobs against a single source, export the full audio or just the active selection, pick a target format (MP3, WAV, OGG, FLAC, AAC), pick a target bitrate (32-320 kbps), pick a target sample rate and channel count, watch the progress indicator advance per-job, and cancel the queue between jobs. The Export Center reuses the same re-encoding pipeline the Converter / Trimmer / Batch Processing surfaces already use.",
    intro:
      "Open the Export Center to run one or more exports at once. Set the source, the target format, the bitrate, the sample rate and the channels, decide whether to export the selection or the full audio, and watch the progress bar advance per-job. The cancel button stops the queue between jobs so a long export never runs away.",
    defaultCategory: "export-center",
    keywords: [
      "audio",
      "export",
      "queue",
      "bitrate",
      "sample rate",
      "channels",
      "progress",
      "cancel",
      "AudioPilot",
    ],
    highlights: [
      "Export selected region or full audio",
      "MP3, WAV, OGG, FLAC, AAC export with bitrate 32-320 kbps",
      "Target sample rate 8-192 kHz and channel count 1-8",
      "Per-job progress indicator and overall progress",
      "Cancel button stops the queue between jobs",
    ],
    toolCount: 1,
  },
  {
    id: "audio-workspace-productivity",
    kind: "productivity",
    slug: "productivity",
    name: "Workspace Productivity",
    tagline:
      "Keyboard shortcuts, command palette, autosave improvements, recent sessions, quick actions, restore previous session",
    description:
      "A professional Workspace Productivity surface for AudioPilot. The user opens the Command Palette (Ctrl/Cmd + Shift + P) to fuzzy-search every command the workspace exposes, browses the recent sessions list, runs quick actions, tunes the workspace settings (autosave on / off, autosave interval, word wrap, theme, minimap, indent width, find shortcut), and restores the previous session on the next visit. The surface is the single place every other AudioPilot tool reads its defaults from.",
    intro:
      "Open the Workspace Productivity surface to tune AudioPilot. The Command Palette is the fastest way to reach any tool; the recent sessions list jumps straight back into the work in progress; the quick actions row covers the common flows; the settings panel persists through the autosave loop so the workspace looks the same on the next visit. The keyboard shortcut reference lists every shortcut the workspace exposes.",
    defaultCategory: "productivity",
    keywords: [
      "audio",
      "productivity",
      "command palette",
      "shortcut",
      "recent",
      "autosave",
      "quick action",
      "restore",
      "AudioPilot",
    ],
    highlights: [
      "Command Palette with fuzzy search (Ctrl/Cmd + Shift + P)",
      "Keyboard shortcut reference for every workspace action",
      "Recent sessions list with one-click reopen",
      "Quick actions row: open player, open trimmer, run conversion, open export",
      "Workspace settings: autosave, interval, word wrap, theme, minimap, indent, find shortcut",
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
