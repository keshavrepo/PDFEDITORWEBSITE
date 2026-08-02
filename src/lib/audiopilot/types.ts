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
  | "merger"
  | "splitter"
  | "metadata"
  | "batch"
  | "library"
  | "waveform-editor"
  | "effects"
  | "silence"
  | "export-center"
  | "productivity"
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

/* -------------------------------------------------------------------------- */
/* Batch 2: merger, splitter, metadata editor, batch processing, library     */
/* -------------------------------------------------------------------------- */

/** A single track on the Audio Merger timeline. The track holds the
 * source data URL, the decoded duration, the user-controlled
 * volume / pan and a derived waveform used by the preview
 * timeline. The track order on the body is the playback order. */
export interface AudioMergeTrack {
  /** Stable id, used as the React key and the audio element id. */
  id: string;
  /** Display name shown on the track header. */
  name: string;
  /** The track's audio as a data URL, including the MIME type prefix. */
  dataUrl: string;
  /** The detected audio format. */
  format: AudioFormat;
  /** Approximate size in bytes. */
  size: number;
  /** Source duration in seconds. */
  durationSeconds: number;
  /** Per-track volume in 0..1. */
  volume: number;
  /** Per-track pan in -1..1 (-1 = full left, 1 = full right). */
  pan: number;
  /** Whether the track is muted. */
  muted: boolean;
  /** Pre-computed waveform peaks, normalised to 0..1. */
  waveform: AudioWaveformPoint[];
  /** When the track was added. */
  addedAt: string;
}

/** A single point on the merger timeline. The merger stores the
 * resolved layout (per-track timing + crossfade) so the preview
 * can render without re-decoding. */
export interface AudioMergeTimelinePoint {
  /** Track id. */
  trackId: string;
  /** Time in seconds relative to the start of the merged output. */
  startSeconds: number;
  /** Time in seconds when the track ends (exclusive). */
  endSeconds: number;
  /** Fade-in duration in seconds (0 if the track has no fade-in). */
  fadeInSeconds: number;
  /** Fade-out duration in seconds (0 if the track has no fade-out). */
  fadeOutSeconds: number;
}

/** The Audio Merger body. The merger holds the user tracks, the
 * per-track volume / pan, the gap between tracks and the fade
 * between consecutive tracks. The preview is the resolved
 * timeline; the export runs an `OfflineAudioContext` mixdown. */
export interface AudioMergerBody {
  /** The tracks the user added, in their current order. */
  tracks: AudioMergeTrack[];
  /** Gap between tracks in seconds. */
  gapSeconds: number;
  /** Fade between consecutive tracks in seconds. */
  crossfadeSeconds: number;
  /** Master output format. */
  outputFormat: AudioFormat;
  /** Master output sample rate in Hz. 0 means "use the first track's rate". */
  outputSampleRate: number;
  /** Master output bitrate in kbps. 0 means "let the encoder choose". */
  outputBitrateKbps: number;
  /** The resolved timeline, rebuilt whenever the inputs change. */
  timeline: AudioMergeTimelinePoint[];
  /** Total merged duration in seconds, derived from the timeline. */
  totalDurationSeconds: number;
  /** Last exported data URL, if any. */
  lastExportDataUrl: string;
  /** When the last export happened. */
  lastExportAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Audio Splitter body                                                        */
/* -------------------------------------------------------------------------- */

/** A single marker on the Audio Splitter timeline. Markers are
 * added by the user at a precise timestamp; the splitter uses them
 * to cut the source into segments. */
export interface AudioSplitMarker {
  id: string;
  /** Marker time in seconds. */
  timeSeconds: number;
  /** Optional label. */
  label: string;
}

/** A single segment produced by the Audio Splitter. The segment
 * stores its own source-data-URL-free record: the source lives on
 * the body and the segment references it by start / end
 * timestamps. The segment can be exported independently. */
export interface AudioSplitSegment {
  id: string;
  /** Display name. */
  name: string;
  /** Segment start in seconds. */
  startSeconds: number;
  /** Segment end in seconds. */
  endSeconds: number;
  /** Source format. */
  format: AudioFormat;
  /** Detected silence flag (set by the "split by silence" mode). */
  isSilence: boolean;
  /** Whether the segment is selected for batch export. */
  selected: boolean;
}

/** The Audio Splitter body. The splitter holds the source audio,
 * the markers the user added, the current splitter mode and the
 * segments the current run produced. */
export interface AudioSplitterBody {
  /** The source audio as a data URL, including the MIME type prefix. */
  sourceDataUrl: string;
  /** The detected source format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Total source duration in seconds. */
  durationSeconds: number;
  /** Current splitter mode. */
  mode: "time" | "markers" | "equal" | "silence";
  /** "split by time" mode: every N seconds. */
  everySeconds: number;
  /** "split into equal parts" mode: how many parts. */
  equalParts: number;
  /** "split by silence" mode: silence threshold in dB. */
  silenceThresholdDb: number;
  /** "split by silence" mode: minimum silence duration in seconds. */
  silenceMinDurationSeconds: number;
  /** User-added markers. */
  markers: AudioSplitMarker[];
  /** The segments the current run produced. */
  segments: AudioSplitSegment[];
  /** When the last split ran. */
  lastSplitAt: string;
  /** Last export format. */
  lastExportFormat: AudioFormat;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Metadata Editor body                                                       */
/* -------------------------------------------------------------------------- */

/** Cover art stored on the Metadata Editor body. The image is kept
 * as a data URL so the editor can preview it without an extra
 * round trip to disk. The MIME type and the byte size are
 * captured for the export step. */
export interface AudioCoverArt {
  /** The cover art as a data URL, including the MIME type prefix. */
  dataUrl: string;
  /** The detected MIME type. */
  mime: string;
  /** Approximate size in bytes. */
  size: number;
  /** Width in pixels, if known. */
  width?: number;
  /** Height in pixels, if known. */
  height?: number;
}

/** The Metadata Editor body. The editor covers the standard tag
 * fields every audio format uses (Title, Artist, Album, Genre,
 * Year, Track Number, Comments) and adds cover art for the
 * formats that support it. The user can save the metadata back to
 * the same source file. */
export interface AudioMetadataEditorBody {
  /** The source audio as a data URL, including the MIME type prefix. */
  sourceDataUrl: string;
  /** The detected source format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Title tag. */
  title: string;
  /** Artist tag. */
  artist: string;
  /** Album tag. */
  album: string;
  /** Genre tag. */
  genre: string;
  /** Year tag. */
  year: string;
  /** Track number tag (string to allow "1/12" style values). */
  trackNumber: string;
  /** Comments / description tag. */
  comments: string;
  /** Optional cover art. */
  coverArt: AudioCoverArt | null;
  /** Last saved timestamp. */
  lastSavedAt: string;
  /** Last exported data URL, if any. */
  lastExportDataUrl: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batch Processing body                                                       */
/* -------------------------------------------------------------------------- */

/** The current batch job mode. */
export type AudioBatchMode = "convert" | "rename" | "metadata" | "export";

/** A single file in the batch. The file is the source the batch
 * acts on. */
export interface AudioBatchFile {
  id: string;
  fileName: string;
  format: AudioFormat;
  dataUrl: string;
  size: number;
  durationSeconds: number;
}

/** A single batch item, combining a source file, the desired
 * operation and the resolved output. The `outputDataUrl` is set
 * when the operation finishes. */
export interface AudioBatchItem {
  id: string;
  file: AudioBatchFile;
  /** Target format (convert mode). */
  targetFormat: AudioFormat;
  /** Target bitrate (convert mode). */
  targetBitrateKbps: number;
  /** New file name (rename mode). */
  renameTo: string;
  /** Title to apply (metadata mode). */
  metadataTitle: string;
  /** Artist to apply (metadata mode). */
  metadataArtist: string;
  /** Album to apply (metadata mode). */
  metadataAlbum: string;
  /** Year to apply (metadata mode). */
  metadataYear: string;
  /** Comments to apply (metadata mode). */
  metadataComments: string;
  /** Output file name (export mode). */
  exportName: string;
  /** Status of the item. */
  status: "pending" | "running" | "done" | "error" | "cancelled";
  /** Progress 0..1. */
  progress: number;
  /** Output data URL when done. */
  outputDataUrl: string;
  /** Output format when done. */
  outputFormat: AudioFormat;
  /** Output size in bytes. */
  outputSize: number;
  /** Error message when status is "error". */
  errorMessage: string;
  /** When the operation finished. */
  finishedAt: string;
}

/** The Batch Processing body. The batch holds the queue, the
 * resolved per-item results and a cancel flag. The user can
 * download the results as a ZIP once the queue finishes. */
export interface AudioBatchBody {
  /** Current batch mode. */
  mode: AudioBatchMode;
  /** Whether the batch is currently running. */
  running: boolean;
  /** Whether the batch was cancelled. */
  cancelled: boolean;
  /** The current item index (0-based) when running. */
  currentIndex: number;
  /** Overall progress 0..1. */
  progress: number;
  /** The queue. */
  items: AudioBatchItem[];
  /** When the batch started. */
  startedAt: string;
  /** When the batch finished. */
  finishedAt: string;
  /** Last downloaded ZIP data URL, if any. */
  lastZipDataUrl: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Audio Library body                                                          */
/* -------------------------------------------------------------------------- */

/** A single entry in the Audio Library. The library is the
 * "files I have imported across every AudioPilot tool" view; an
 * entry is the import record plus the per-tool favourites and
 * recent flags. */
export interface AudioLibraryEntry {
  /** Stable id. */
  id: string;
  /** Display name. */
  name: string;
  /** The audio as a data URL, including the MIME type prefix. */
  dataUrl: string;
  /** Detected format. */
  format: AudioFormat;
  /** Approximate size in bytes. */
  size: number;
  /** Duration in seconds, captured at import time. */
  durationSeconds: number;
  /** Optional title tag. */
  title: string;
  /** Optional artist tag. */
  artist: string;
  /** Optional album tag. */
  album: string;
  /** When the entry was added. */
  addedAt: string;
  /** When the entry was last opened. */
  lastOpenedAt: string;
  /** Number of times the entry has been opened. */
  openCount: number;
  /** Whether the entry is favourited. */
  isFavorite: boolean;
  /** Free-form tags for filtering. */
  tags: string[];
}

/** The Audio Library body. The library holds every imported audio
 * file, the search / sort / filter state and the favourites
 * gallery. The library powers the file picker every other
 * AudioPilot surface uses. */
export interface AudioLibraryBody {
  /** Every imported entry, newest first. Capped at 200. */
  entries: AudioLibraryEntry[];
  /** Search term. */
  search: string;
  /** Sort field. */
  sortField: "addedAt" | "name" | "size" | "durationSeconds" | "lastOpenedAt";
  /** Sort direction. */
  sortDirection: "asc" | "desc";
  /** Format filter. Empty string means "all formats". */
  formatFilter: string;
  /** Favourite-only filter. */
  favoritesOnly: boolean;
  /** Currently selected entry id, for the details panel. */
  selectedEntryId: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batch 3: waveform editor + effects + silence + export + productivity      */
/* -------------------------------------------------------------------------- */

/** A single point on a high-resolution waveform. Buckets are computed
 * from the source `AudioBuffer` and the active zoom level. */
export interface AudioWaveformEditorPoint {
  /** 1-based sample bucket. */
  index: number;
  /** Normalised peak in the 0..1 range. */
  peak: number;
}

/** A region marker the user can place on the waveform. */
export interface AudioRegionMarker {
  /** Stable id. */
  id: string;
  /** Marker label, e.g. "Intro", "Verse", "Chorus". */
  label: string;
  /** Marker time in seconds. */
  timeSeconds: number;
  /** Marker color, optional. */
  color: string;
}

/** A selection range on the waveform editor. */
export interface AudioWaveformEditorSelection {
  /** Start time in seconds. */
  startSeconds: number;
  /** End time in seconds, exclusive. */
  endSeconds: number;
}

/** The Waveform Editor body. Stores the high-resolution waveform for
 * the active source along with the zoom level, scroll offset,
 * selection, markers and the playback cursor. */
export interface AudioWaveformEditorBody {
  /** The source audio as a data URL. */
  sourceDataUrl: string;
  /** The detected audio format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Total source duration in seconds. */
  durationSeconds: number;
  /** Number of waveform buckets at the current zoom level. */
  bucketCount: number;
  /** The high-resolution waveform at the current zoom level. */
  waveform: AudioWaveformEditorPoint[];
  /** Pixels per second. Higher = more zoomed in. */
  zoom: number;
  /** Horizontal scroll offset in seconds. */
  scrollSeconds: number;
  /** Current selection, if any. */
  selection: AudioWaveformEditorSelection | null;
  /** Region markers. */
  markers: AudioRegionMarker[];
  /** Playback cursor position in seconds. */
  cursorSeconds: number;
  /** Whether the editor is currently playing. */
  isPlaying: boolean;
  /** Timeline ruler increment in seconds, derived from the zoom. */
  rulerStepSeconds: number;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single effect operation on the Effects surface. */
export interface AudioEffectOp {
  /** Stable id. */
  id: string;
  /** Effect kind. */
  kind:
    | "fade-in"
    | "fade-out"
    | "normalize"
    | "silence"
    | "reverse"
    | "speed"
    | "pitch";
  /** Optional duration in seconds (fade-in, fade-out, silence). */
  durationSeconds: number;
  /** Speed multiplier (speed effect). */
  speedFactor: number;
  /** Pitch shift in semitones (pitch effect). */
  pitchSemitones: number;
  /** Target peak in 0..1 (normalize effect). */
  targetPeak: number;
  /** When the effect was applied. */
  appliedAt: string;
  /** Free-form note. */
  note: string;
}

/** The Audio Effects body. Stores the source audio plus the per-effect
 * history. The surface renders the preview of the latest effect on
 * demand. */
export interface AudioEffectsBody {
  /** The source audio as a data URL. */
  sourceDataUrl: string;
  /** The detected audio format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Total source duration in seconds. */
  durationSeconds: number;
  /** Fade-in duration in seconds. */
  fadeInSeconds: number;
  /** Fade-out duration in seconds. */
  fadeOutSeconds: number;
  /** Normalize target peak in 0..1. */
  targetPeak: number;
  /** Silence generator duration in seconds. */
  silenceDurationSeconds: number;
  /** Speed factor (1 = unchanged). */
  speedFactor: number;
  /** Pitch shift in semitones (0 = unchanged). */
  pitchSemitones: number;
  /** Per-effect history, newest last. */
  history: AudioEffectOp[];
  /** Pointer into the history stack. -1 means the user is past the end. */
  historyIndex: number;
  /** Last effect that produced a downloadable result, if any. */
  lastResultDataUrl: string;
  /** Format of the last result. */
  lastResultFormat: AudioFormat;
  /** When the last result was produced. */
  lastResultAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single silence region detected by the Silence Detection surface. */
export interface AudioSilenceRegion {
  /** Stable id. */
  id: string;
  /** Start time in seconds. */
  startSeconds: number;
  /** End time in seconds, exclusive. */
  endSeconds: number;
  /** RMS value over the silence region. */
  rms: number;
  /** Whether the region is selected for removal. */
  selected: boolean;
}

/** The Silence Detection body. Stores the source audio and the
 * resolved silence regions. */
export interface AudioSilenceBody {
  /** The source audio as a data URL. */
  sourceDataUrl: string;
  /** The detected audio format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Total source duration in seconds. */
  durationSeconds: number;
  /** RMS threshold in 0..1. Lower = stricter. */
  threshold: number;
  /** Minimum silence duration in seconds. */
  minDurationSeconds: number;
  /** Padding in seconds added around each silence region. */
  paddingSeconds: number;
  /** Detected silence regions. */
  regions: AudioSilenceRegion[];
  /** Active region id for the "jump" actions. */
  activeRegionId: string;
  /** Last result of a split/remove action. */
  lastResultDataUrl: string;
  /** When the last action ran. */
  lastResultAt: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single export job in the Export Center queue. */
export interface AudioExportJob {
  /** Stable id. */
  id: string;
  /** Job label. */
  label: string;
  /** Source data URL. */
  sourceDataUrl: string;
  /** Source format. */
  sourceFormat: AudioFormat;
  /** Target format. */
  targetFormat: AudioFormat;
  /** Target bitrate in kbps. */
  bitrateKbps: number;
  /** Target sample rate in Hz (0 = source). */
  sampleRate: number;
  /** Target channel count (0 = source). */
  channels: number;
  /** Whether to export only the selection. */
  selectionOnly: boolean;
  /** Selection start in seconds. */
  selectionStartSeconds: number;
  /** Selection end in seconds. */
  selectionEndSeconds: number;
  /** Current job state. */
  state: "pending" | "running" | "completed" | "failed" | "cancelled";
  /** Progress in 0..1. */
  progress: number;
  /** Result data URL when completed. */
  resultDataUrl: string;
  /** Bytes written when completed. */
  resultBytes: number;
  /** When the job was last updated. */
  updatedAt: string;
  /** Free-form error message. */
  errorMessage: string;
}

/** The Export Center body. Holds the export queue and the current
 * job's progress. */
export interface AudioExportCenterBody {
  /** The source audio as a data URL. */
  sourceDataUrl: string;
  /** The detected audio format. */
  sourceFormat: AudioFormat;
  /** Original file name. */
  fileName: string;
  /** Total source duration in seconds. */
  durationSeconds: number;
  /** Source sample rate in Hz. */
  sourceSampleRate: number;
  /** Source channels. */
  sourceChannels: number;
  /** Whether to export the selection only. */
  selectionOnly: boolean;
  /** Selection start in seconds. */
  selectionStartSeconds: number;
  /** Selection end in seconds. */
  selectionEndSeconds: number;
  /** The export queue. */
  jobs: AudioExportJob[];
  /** Currently running job id, if any. */
  runningJobId: string;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A single command in the Workspace Productivity command palette. */
export interface AudioProductivityCommand {
  /** Stable id. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional category. */
  category: string;
  /** Optional keyboard shortcut. */
  shortcut?: string;
  /** Free-form keywords for fuzzy matching. */
  keywords: string[];
  /** When the command was last invoked. */
  lastInvokedAt: string;
}

/** A quick action on the Workspace Productivity surface. */
export interface AudioProductivityQuickAction {
  /** Stable id. */
  id: string;
  /** Display label. */
  label: string;
  /** Description. */
  description: string;
  /** Target slug the action opens, or a built-in action. */
  target: string;
  /** Optional shortcut. */
  shortcut?: string;
}

/** The Workspace Productivity body. The surface hosts the Command
 * Palette, the keyboard shortcut reference, the recent sessions
 * list, the quick actions row and the workspace settings. */
export interface AudioProductivityBody {
  /** Whether the command palette is currently open. */
  paletteOpen: boolean;
  /** Current palette query. */
  paletteQuery: string;
  /** Recent sessions, newest first. Cap 12. */
  recent: AudioProductivityRecent[];
  /** Quick actions. Cap 12. */
  quickActions: AudioProductivityQuickAction[];
  /** Whether autosave is enabled. */
  autosaveEnabled: boolean;
  /** Autosave interval in milliseconds. */
  autosaveIntervalMs: number;
  /** Whether word wrap is enabled by default in the editors. */
  wordWrap: boolean;
  /** Whether the user prefers a dark / light theme. */
  theme: "system" | "light" | "dark";
  /** Whether the minimap is shown. */
  minimap: boolean;
  /** The user's preferred indent width (spaces). */
  indent: number;
  /** Whether the in-editor find bar opens on Ctrl/Cmd + F. */
  findShortcut: boolean;
  /** Favourite flag. */
  isFavorite: boolean;
}

/** A recent session entry shown in the productivity surface. */
export interface AudioProductivityRecent {
  id: string;
  title: string;
  kind: string;
  openedAt: string;
}
