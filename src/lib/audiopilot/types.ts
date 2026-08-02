/**
 * Shared types for the AudioPilot workspace.
 *
 * AudioPilot is a single audio workspace that hosts every future
 * audio tool (player, trimmer, converter, recorder, …) on top of
 * one engine. The engine only cares about an abstract `AudioSession`;
 * each tool kind declares its own body shape through the session
 * descriptor. The workspace shell, storage layer and search index
 * are all keyed off these types.
 *
 * AudioPilot reuses the same patterns as OfficePilot, SocialPilot,
 * FinancePilot, DevPilot and WebPilot so a reader who knows one
 * product knows them all.
 */

/** The session kinds AudioPilot can host. */
export type AudioSessionKind = string;

/** A category for a session, surfaced in the new-session menu. */
export type AudioSessionCategory =
  | "blank"
  | "player"
  | "trimmer"
  | "converter"
  | "recorder"
  | "custom";

/** Audio formats AudioPilot can read and write. */
export type AudioFormat = "mp3" | "wav" | "ogg" | "flac" | "aac";

/** Persistent metadata stored alongside the session body. */
export interface AudioSessionMeta {
  /** Stable id; used as the IndexedDB key and the audit trail. */
  id: string;
  /** Session kind this session belongs to. */
  kind: AudioSessionKind;
  /** Free-text title shown in tabs and the file manager. */
  title: string;
  /** Session category, used for templates and the new-session menu. */
  category: AudioSessionCategory;
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
  /** Optional user tags, lowercase, free-text. */
  tags?: string[];
  /** Whether the user has favourited this session. */
  isFavorite: boolean;
}

/**
 * A session stored in AudioPilot.
 *
 * The body is intentionally `unknown` because each session kind shapes
 * it differently. Every session guard the shape at the boundary.
 */
export interface AudioSession {
  meta: AudioSessionMeta;
  body: unknown;
}

/** A short summary of a session used in lists and the file manager. */
export interface AudioSessionSummary {
  id: string;
  kind: AudioSessionKind;
  title: string;
  category: AudioSessionCategory;
  updatedAt: string;
  autosavedAt: string | null;
  version: number;
  size: number;
  isFavorite: boolean;
}

/** Static template descriptor. Bodies are loaded lazily. */
export interface AudioTemplate {
  id: string;
  kind: AudioSessionKind;
  category: AudioSessionCategory;
  name: string;
  description: string;
  /** Whether a starter body is available locally. */
  hasStarter: boolean;
  /** Marketing-grade highlights shown on the template card. */
  highlights: string[];
}

/**
 * A session descriptor.
 *
 * Each future session registers one of these. The workspace shell reads
 * the array to decide which surface to mount, which tab to default to,
 * and what to show in the directory.
 */
export interface AudioSessionDefinition {
  id: string;
  kind: AudioSessionKind;
  /** Route segment under `/audiopilot`. Empty for the default. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  /** Default category when the user starts a blank session. */
  defaultCategory: AudioSessionCategory;
  /** Search keywords, mirroring the rest of the platform. */
  keywords: string[];
  /** Short bullets shown on the product page. */
  highlights: string[];
  /** Marketing-grade count for the product card. */
  toolCount: number;
}

/* -------------------------------------------------------------------------- */
/* Audio Player body                                                          */
/* -------------------------------------------------------------------------- */

/** A single point on the waveform preview. The peak values are normalised
 * to the 0..1 range so the chart can render without rescaling. */
export interface AudioWaveformPoint {
  /** 1-based sample bucket. */
  index: number;
  /** Normalised peak in the 0..1 range. */
  peak: number;
}

/** The Audio Player body. The source audio is stored as a data URL so
 * the surface can be reopened without re-uploading. The waveform is
 * pre-computed on import so the canvas can paint without re-decoding. */
export interface AudioPlayerBody {
  /** The source audio as a data URL, including the MIME type prefix. */
  sourceDataUrl: string;
  /** The detected audio format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Optional artist tag from the imported metadata. */
  artist: string;
  /** Optional title tag from the imported metadata. */
  trackTitle: string;
  /** Optional album tag from the imported metadata. */
  album: string;
  /** Total duration in seconds. */
  durationSeconds: number;
  /** Number of waveform buckets (typically 256..2048). */
  waveformBuckets: number;
  /** Pre-computed waveform peaks, one per bucket. */
  waveform: AudioWaveformPoint[];
  /** Currently selected playback speed multiplier. */
  playbackSpeed: number;
  /** Current volume in 0..1. */
  volume: number;
  /** Whether the audio is muted. */
  muted: boolean;
  /** Whether the audio should loop. */
  loop: boolean;
  /** The current playhead position in seconds, persisted between sessions. */
  currentTimeSeconds: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Audio Trimmer body                                                         */
/* -------------------------------------------------------------------------- */

/** A single trim operation in the undo / redo stack. */
export interface AudioTrimOp {
  id: string;
  /** Trim start in seconds. */
  startSeconds: number;
  /** Trim end in seconds. */
  endSeconds: number;
  /** When the operation was recorded. */
  appliedAt: string;
}

/** The Audio Trimmer body. The trim surface operates on a copy of the
 * source so the user's source file is never destroyed. */
export interface AudioTrimmerBody {
  /** The source audio as a data URL, including the MIME type prefix. */
  sourceDataUrl: string;
  /** The detected audio format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Total source duration in seconds. */
  durationSeconds: number;
  /** Trim start in seconds. */
  startSeconds: number;
  /** Trim end in seconds. */
  endSeconds: number;
  /** Precision for the trim handles — 0.01 is fine, 0.1 is coarse. */
  precision: number;
  /** The current undo / redo stack, newest last. */
  history: AudioTrimOp[];
  /** Pointer into the history stack. -1 means the user is past the end. */
  historyIndex: number;
  /** Last exported data URL, if any. */
  lastExportDataUrl: string;
  /** Last exported format. */
  lastExportFormat: AudioFormat;
  /** When the last export happened. */
  lastExportAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Audio Converter body                                                       */
/* -------------------------------------------------------------------------- */

/** A single tag in the metadata block. */
export interface AudioMetadataTag {
  /** Stable id. */
  id: string;
  /** Tag key (e.g. "artist", "title", "album", "comment"). */
  key: string;
  /** Tag value. */
  value: string;
}

/** The Audio Converter body. The converter reads one source format and
 * writes a different target format, preserving metadata where the format
 * supports it. */
export interface AudioConverterBody {
  /** The source audio as a data URL, including the MIME type prefix. */
  sourceDataUrl: string;
  /** The detected source format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Source duration in seconds, captured at import time. */
  sourceDurationSeconds: number;
  /** Source sample rate in Hz, captured at import time. */
  sourceSampleRate: number;
  /** Source number of channels, captured at import time. */
  sourceChannels: number;
  /** The target format. */
  targetFormat: AudioFormat;
  /** Bitrate in kbps; 0 means "let the encoder choose". */
  targetBitrateKbps: number;
  /** The metadata block the user wants on the export. */
  metadata: AudioMetadataTag[];
  /** When the last conversion ran. */
  lastConvertedAt: string;
  /** Last converted data URL, if any. */
  lastConvertedDataUrl: string;
  /** Last converted format. */
  lastConvertedFormat: AudioFormat;
  /** Last converted size in bytes. */
  lastConvertedSize: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Recorder body                                                              */
/* -------------------------------------------------------------------------- */

/** A single recording session inside the Recorder body. */
export interface AudioRecording {
  /** Stable id. */
  id: string;
  /** Display name. */
  name: string;
  /** Recording start timestamp. */
  startedAt: string;
  /** Total duration in seconds. */
  durationSeconds: number;
  /** The recorded audio as a data URL, including the MIME type prefix. */
  dataUrl: string;
  /** Detected audio format (typically webm / ogg / wav depending on the browser). */
  format: AudioFormat;
  /** Approximate size in bytes. */
  size: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** The Recorder body. The recorder holds the most recent recordings so
 * the user can play, rename or delete them without re-recording. */
export interface AudioRecorderBody {
  /** Microphone device id; empty string means "default". */
  deviceId: string;
  /** Whether the recorder should echo-monitor. */
  monitor: boolean;
  /** Sample rate hint in Hz. 0 means "let the browser choose". */
  sampleRate: number;
  /** All recordings the user has captured, newest first. Capped at 50. */
  recordings: AudioRecording[];
  /** The id of the currently-selected recording, for the details panel. */
  selectedRecordingId: string;
  /** Favourite flag. */
  isFavorite: boolean;
}
