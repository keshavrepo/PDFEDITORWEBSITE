/**
 * Body-schema helpers for the AudioPilot surfaces.
 *
 * Every AudioPilot surface coerces an unknown body into a typed
 * envelope. The helpers live here so each surface reads as
 * "render the typed body" and the type guards / normalisers do not
 * have to be duplicated.
 *
 * Mirrors the WebPilot / SocialPilot / FinancePilot / DevPilot
 * `bodies.ts` shape.
 */

import type {
  AudioBatchBody,
  AudioBatchFile,
  AudioBatchItem,
  AudioBatchMode,
  AudioConverterBody,
  AudioCoverArt,
  AudioDownloadEntry,
  AudioEffectOp,
  AudioEffectsBody,
  AudioExportCenterBody,
  AudioExportJob,
  AudioFormat,
  AudioLibraryBody,
  AudioLibraryEntry,
  AudioMergeTimelinePoint,
  AudioMergeTrack,
  AudioMergerBody,
  AudioMetadataEditorBody,
  AudioMetadataTag,
  AudioPlayerBody,
  AudioProductivityBody,
  AudioProductivityCommand,
  AudioProductivityQuickAction,
  AudioProductivityRecent,
  AudioRecording,
  AudioRegionMarker,
  AudioSessionCategory,
  AudioSessionKind,
  AudioSilenceBody,
  AudioSilenceRegion,
  AudioSplitMarker,
  AudioSplitSegment,
  AudioSplitterBody,
  AudioTrimOp,
  AudioTrimmerBody,
  AudioWaveformEditorBody,
  AudioWaveformEditorPoint,
  AudioWaveformEditorSelection,
  AudioWaveformPoint,
  AudioRecorderBody,
} from "./types";

export type {
  AudioBatchBody,
  AudioBatchFile,
  AudioBatchItem,
  AudioBatchMode,
  AudioConverterBody,
  AudioCoverArt,
  AudioDownloadEntry,
  AudioEffectOp,
  AudioEffectsBody,
  AudioExportCenterBody,
  AudioExportJob,
  AudioFormat,
  AudioLibraryBody,
  AudioLibraryEntry,
  AudioMergeTimelinePoint,
  AudioMergeTrack,
  AudioMergerBody,
  AudioMetadataEditorBody,
  AudioMetadataTag,
  AudioPlayerBody,
  AudioProductivityBody,
  AudioProductivityCommand,
  AudioProductivityQuickAction,
  AudioProductivityRecent,
  AudioRecording,
  AudioRegionMarker,
  AudioSessionCategory,
  AudioSessionDefinition,
  AudioSessionKind,
  AudioSessionMeta,
  AudioSessionSummary,
  AudioSilenceBody,
  AudioSilenceRegion,
  AudioSplitMarker,
  AudioSplitSegment,
  AudioSplitterBody,
  AudioTemplate,
  AudioTrimOp,
  AudioTrimmerBody,
  AudioWaveformEditorBody,
  AudioWaveformEditorPoint,
  AudioWaveformEditorSelection,
  AudioWaveformPoint,
  AudioRecorderBody,
} from "./types";

const AUDIO_FORMATS: AudioFormat[] = ["mp3", "wav", "ogg", "flac", "aac"];
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const TRIM_PRECISIONS = [0.01, 0.05, 0.1];

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function asAudioFormat(value: unknown): AudioFormat {
  return (AUDIO_FORMATS as string[]).includes(value as string)
    ? (value as AudioFormat)
    : "wav";
}

function asAudioSessionCategory(
  value: unknown
): AudioSessionCategory {
  switch (value) {
    case "player":
    case "trimmer":
    case "converter":
    case "recorder":
    case "merger":
    case "splitter":
    case "metadata":
    case "batch":
    case "library":
    case "custom":
      return value;
    case "blank":
    default:
      return "blank";
  }
}

function asWaveformPoint(value: unknown): AudioWaveformPoint | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.index !== "number" || typeof record.peak !== "number") {
    return null;
  }
  return {
    index: clampNumber(record.index, 0, 1_000_000, 0),
    peak: clampNumber(record.peak, 0, 1, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Audio Player                                                                */
/* -------------------------------------------------------------------------- */

export const DEFAULT_PLAYER_BODY: AudioPlayerBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  artist: "",
  trackTitle: "",
  album: "",
  durationSeconds: 0,
  waveformBuckets: 0,
  waveform: [],
  playbackSpeed: 1,
  volume: 0.8,
  muted: false,
  loop: false,
  currentTimeSeconds: 0,
  isFavorite: false,
};

export function asPlayerBody(value: unknown): AudioPlayerBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_PLAYER_BODY };
  const record = value as Record<string, unknown>;
  const waveform = Array.isArray(record.waveform)
    ? (record.waveform as unknown[])
        .map((entry) => asWaveformPoint(entry))
        .filter((entry): entry is AudioWaveformPoint => Boolean(entry))
    : [];
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    artist: typeof record.artist === "string" ? record.artist : "",
    trackTitle:
      typeof record.trackTitle === "string" ? record.trackTitle : "",
    album: typeof record.album === "string" ? record.album : "",
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    waveformBuckets: clampNumber(record.waveformBuckets, 0, 64_000, 0),
    waveform,
    playbackSpeed: (PLAYBACK_SPEEDS as number[]).includes(
      record.playbackSpeed as number
    )
      ? (record.playbackSpeed as number)
      : 1,
    volume: clampNumber(record.volume, 0, 1, 0.8),
    muted: record.muted === true,
    loop: record.loop === true,
    currentTimeSeconds: clampNumber(
      record.currentTimeSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    isFavorite: record.isFavorite === true,
  };
}

export function clonePlayerBody(body: AudioPlayerBody): AudioPlayerBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    artist: body.artist,
    trackTitle: body.trackTitle,
    album: body.album,
    durationSeconds: body.durationSeconds,
    waveformBuckets: body.waveformBuckets,
    waveform: body.waveform.map((point) => ({ ...point })),
    playbackSpeed: body.playbackSpeed,
    volume: body.volume,
    muted: body.muted,
    loop: body.loop,
    currentTimeSeconds: body.currentTimeSeconds,
    isFavorite: body.isFavorite,
  };
}

/* -------------------------------------------------------------------------- */
/* Audio Trimmer                                                               */
/* -------------------------------------------------------------------------- */

function asTrimOp(value: unknown): AudioTrimOp | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  return {
    id: record.id,
    startSeconds: clampNumber(record.startSeconds, 0, 24 * 60 * 60, 0),
    endSeconds: clampNumber(record.endSeconds, 0, 24 * 60 * 60, 0),
    appliedAt:
      typeof record.appliedAt === "string"
        ? record.appliedAt
        : new Date().toISOString(),
  };
}

export const DEFAULT_TRIMMER_BODY: AudioTrimmerBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  startSeconds: 0,
  endSeconds: 0,
  precision: 0.05,
  history: [],
  historyIndex: -1,
  lastExportDataUrl: "",
  lastExportFormat: "wav",
  lastExportAt: "",
  isFavorite: false,
};

export function asTrimmerBody(value: unknown): AudioTrimmerBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_TRIMMER_BODY };
  const record = value as Record<string, unknown>;
  const history = Array.isArray(record.history)
    ? (record.history as unknown[])
        .map((entry) => asTrimOp(entry))
        .filter((entry): entry is AudioTrimOp => Boolean(entry))
        .slice(-100)
    : [];
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    startSeconds: clampNumber(record.startSeconds, 0, 24 * 60 * 60, 0),
    endSeconds: clampNumber(record.endSeconds, 0, 24 * 60 * 60, 0),
    precision: (TRIM_PRECISIONS as number[]).includes(record.precision as number)
      ? (record.precision as number)
      : 0.05,
    history,
    historyIndex: clampNumber(record.historyIndex, -1, history.length, -1),
    lastExportDataUrl:
      typeof record.lastExportDataUrl === "string"
        ? record.lastExportDataUrl
        : "",
    lastExportFormat: asAudioFormat(record.lastExportFormat),
    lastExportAt:
      typeof record.lastExportAt === "string" ? record.lastExportAt : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneTrimmerBody(body: AudioTrimmerBody): AudioTrimmerBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    durationSeconds: body.durationSeconds,
    startSeconds: body.startSeconds,
    endSeconds: body.endSeconds,
    precision: body.precision,
    history: body.history.map((entry) => ({ ...entry })),
    historyIndex: body.historyIndex,
    lastExportDataUrl: body.lastExportDataUrl,
    lastExportFormat: body.lastExportFormat,
    lastExportAt: body.lastExportAt,
    isFavorite: body.isFavorite,
  };
}

/* -------------------------------------------------------------------------- */
/* Audio Converter                                                             */
/* -------------------------------------------------------------------------- */

function asMetadataTag(value: unknown): AudioMetadataTag | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.key !== "string") {
    return null;
  }
  return {
    id: record.id,
    key: record.key,
    value: typeof record.value === "string" ? record.value : "",
  };
}

export const DEFAULT_CONVERTER_BODY: AudioConverterBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  sourceDurationSeconds: 0,
  sourceSampleRate: 44_100,
  sourceChannels: 2,
  targetFormat: "mp3",
  targetBitrateKbps: 192,
  metadata: [],
  lastConvertedAt: "",
  lastConvertedDataUrl: "",
  lastConvertedFormat: "mp3",
  lastConvertedSize: 0,
  isFavorite: false,
};

export function asConverterBody(value: unknown): AudioConverterBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_CONVERTER_BODY };
  const record = value as Record<string, unknown>;
  const metadata = Array.isArray(record.metadata)
    ? (record.metadata as unknown[])
        .map((entry) => asMetadataTag(entry))
        .filter((entry): entry is AudioMetadataTag => Boolean(entry))
        .slice(0, 20)
    : [];
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    sourceDurationSeconds: clampNumber(
      record.sourceDurationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    sourceSampleRate: clampNumber(
      record.sourceSampleRate,
      1_000,
      384_000,
      44_100
    ),
    sourceChannels: clampNumber(record.sourceChannels, 1, 8, 2),
    targetFormat: asAudioFormat(record.targetFormat),
    targetBitrateKbps: clampNumber(
      record.targetBitrateKbps,
      32,
      320,
      192
    ),
    metadata,
    lastConvertedAt:
      typeof record.lastConvertedAt === "string" ? record.lastConvertedAt : "",
    lastConvertedDataUrl:
      typeof record.lastConvertedDataUrl === "string"
        ? record.lastConvertedDataUrl
        : "",
    lastConvertedFormat: asAudioFormat(record.lastConvertedFormat),
    lastConvertedSize: clampNumber(record.lastConvertedSize, 0, 1_000_000_000, 0),
    isFavorite: record.isFavorite === true,
  };
}

export function cloneConverterBody(body: AudioConverterBody): AudioConverterBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    sourceDurationSeconds: body.sourceDurationSeconds,
    sourceSampleRate: body.sourceSampleRate,
    sourceChannels: body.sourceChannels,
    targetFormat: body.targetFormat,
    targetBitrateKbps: body.targetBitrateKbps,
    metadata: body.metadata.map((entry) => ({ ...entry })),
    lastConvertedAt: body.lastConvertedAt,
    lastConvertedDataUrl: body.lastConvertedDataUrl,
    lastConvertedFormat: body.lastConvertedFormat,
    lastConvertedSize: body.lastConvertedSize,
    isFavorite: body.isFavorite,
  };
}

/* -------------------------------------------------------------------------- */
/* Recorder                                                                    */
/* -------------------------------------------------------------------------- */

function asRecording(value: unknown): AudioRecording | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.dataUrl !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    startedAt:
      typeof record.startedAt === "string"
        ? record.startedAt
        : new Date().toISOString(),
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    dataUrl: record.dataUrl,
    format: asAudioFormat(record.format),
    size: clampNumber(record.size, 0, 1_000_000_000, 0),
    isFavorite: record.isFavorite === true,
  };
}

export const DEFAULT_RECORDER_BODY: AudioRecorderBody = {
  deviceId: "",
  monitor: false,
  sampleRate: 0,
  recordings: [],
  selectedRecordingId: "",
  isFavorite: false,
};

export function asRecorderBody(value: unknown): AudioRecorderBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_RECORDER_BODY };
  const record = value as Record<string, unknown>;
  const recordings = Array.isArray(record.recordings)
    ? (record.recordings as unknown[])
        .map((entry) => asRecording(entry))
        .filter((entry): entry is AudioRecording => Boolean(entry))
        .slice(0, 50)
    : [];
  return {
    deviceId: typeof record.deviceId === "string" ? record.deviceId : "",
    monitor: record.monitor === true,
    sampleRate: clampNumber(record.sampleRate, 0, 384_000, 0),
    recordings,
    selectedRecordingId:
      typeof record.selectedRecordingId === "string"
        ? record.selectedRecordingId
        : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneRecorderBody(body: AudioRecorderBody): AudioRecorderBody {
  return {
    deviceId: body.deviceId,
    monitor: body.monitor,
    sampleRate: body.sampleRate,
    recordings: body.recordings.map((recording) => ({ ...recording })),
    selectedRecordingId: body.selectedRecordingId,
    isFavorite: body.isFavorite,
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 2: merger, splitter, metadata editor, batch processing, library     */
/* -------------------------------------------------------------------------- */

function asMergeTrack(value: unknown): AudioMergeTrack | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.dataUrl !== "string"
  ) {
    return null;
  }
  const waveform = Array.isArray(record.waveform)
    ? (record.waveform as unknown[])
        .map((entry) => asWaveformPoint(entry))
        .filter((entry): entry is AudioWaveformPoint => Boolean(entry))
    : [];
  return {
    id: record.id,
    name: record.name,
    dataUrl: record.dataUrl,
    format: asAudioFormat(record.format),
    size: clampNumber(record.size, 0, 1_000_000_000, 0),
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    volume: clampNumber(record.volume, 0, 1, 1),
    pan: clampNumber(record.pan, -1, 1, 0),
    muted: record.muted === true,
    waveform,
    addedAt:
      typeof record.addedAt === "string"
        ? record.addedAt
        : new Date().toISOString(),
  };
}

function asMergeTimelinePoint(value: unknown): AudioMergeTimelinePoint | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.trackId !== "string") return null;
  return {
    trackId: record.trackId,
    startSeconds: clampNumber(record.startSeconds, 0, 24 * 60 * 60, 0),
    endSeconds: clampNumber(record.endSeconds, 0, 24 * 60 * 60, 0),
    fadeInSeconds: clampNumber(record.fadeInSeconds, 0, 60, 0),
    fadeOutSeconds: clampNumber(record.fadeOutSeconds, 0, 60, 0),
  };
}

export const DEFAULT_MERGER_BODY: AudioMergerBody = {
  tracks: [],
  gapSeconds: 0,
  crossfadeSeconds: 0,
  outputFormat: "wav",
  outputSampleRate: 0,
  outputBitrateKbps: 192,
  timeline: [],
  totalDurationSeconds: 0,
  lastExportDataUrl: "",
  lastExportAt: "",
  isFavorite: false,
};

export function asMergerBody(value: unknown): AudioMergerBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_MERGER_BODY };
  const record = value as Record<string, unknown>;
  const tracks = Array.isArray(record.tracks)
    ? (record.tracks as unknown[])
        .map((entry) => asMergeTrack(entry))
        .filter((entry): entry is AudioMergeTrack => Boolean(entry))
        .slice(0, 50)
    : [];
  const timeline = Array.isArray(record.timeline)
    ? (record.timeline as unknown[])
        .map((entry) => asMergeTimelinePoint(entry))
        .filter((entry): entry is AudioMergeTimelinePoint => Boolean(entry))
    : [];
  return {
    tracks,
    gapSeconds: clampNumber(record.gapSeconds, 0, 60, 0),
    crossfadeSeconds: clampNumber(record.crossfadeSeconds, 0, 30, 0),
    outputFormat: asAudioFormat(record.outputFormat),
    outputSampleRate: clampNumber(record.outputSampleRate, 0, 384_000, 0),
    outputBitrateKbps: clampNumber(
      record.outputBitrateKbps,
      32,
      320,
      192
    ),
    timeline,
    totalDurationSeconds: clampNumber(
      record.totalDurationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    lastExportDataUrl:
      typeof record.lastExportDataUrl === "string"
        ? record.lastExportDataUrl
        : "",
    lastExportAt:
      typeof record.lastExportAt === "string" ? record.lastExportAt : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneMergerBody(body: AudioMergerBody): AudioMergerBody {
  return {
    tracks: body.tracks.map((track) => ({
      ...track,
      waveform: track.waveform.map((point) => ({ ...point })),
    })),
    gapSeconds: body.gapSeconds,
    crossfadeSeconds: body.crossfadeSeconds,
    outputFormat: body.outputFormat,
    outputSampleRate: body.outputSampleRate,
    outputBitrateKbps: body.outputBitrateKbps,
    timeline: body.timeline.map((entry) => ({ ...entry })),
    totalDurationSeconds: body.totalDurationSeconds,
    lastExportDataUrl: body.lastExportDataUrl,
    lastExportAt: body.lastExportAt,
    isFavorite: body.isFavorite,
  };
}

function asSplitMarker(value: unknown): AudioSplitMarker | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  return {
    id: record.id,
    timeSeconds: clampNumber(record.timeSeconds, 0, 24 * 60 * 60, 0),
    label: typeof record.label === "string" ? record.label : "",
  };
}

function asSplitSegment(value: unknown): AudioSplitSegment | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    startSeconds: clampNumber(record.startSeconds, 0, 24 * 60 * 60, 0),
    endSeconds: clampNumber(record.endSeconds, 0, 24 * 60 * 60, 0),
    format: asAudioFormat(record.format),
    isSilence: record.isSilence === true,
    selected: record.selected !== false,
  };
}

export const DEFAULT_SPLITTER_BODY: AudioSplitterBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  mode: "time",
  everySeconds: 30,
  equalParts: 4,
  silenceThresholdDb: -40,
  silenceMinDurationSeconds: 0.5,
  markers: [],
  segments: [],
  lastSplitAt: "",
  lastExportFormat: "wav",
  isFavorite: false,
};

export function asSplitterBody(value: unknown): AudioSplitterBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_SPLITTER_BODY };
  const record = value as Record<string, unknown>;
  const markers = Array.isArray(record.markers)
    ? (record.markers as unknown[])
        .map((entry) => asSplitMarker(entry))
        .filter((entry): entry is AudioSplitMarker => Boolean(entry))
        .slice(0, 200)
    : [];
  const segments = Array.isArray(record.segments)
    ? (record.segments as unknown[])
        .map((entry) => asSplitSegment(entry))
        .filter((entry): entry is AudioSplitSegment => Boolean(entry))
        .slice(0, 200)
    : [];
  const mode =
    record.mode === "markers" ||
    record.mode === "equal" ||
    record.mode === "silence"
      ? record.mode
      : "time";
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    mode,
    everySeconds: clampNumber(record.everySeconds, 1, 3600, 30),
    equalParts: clampNumber(record.equalParts, 2, 100, 4),
    silenceThresholdDb: clampNumber(
      record.silenceThresholdDb,
      -120,
      0,
      -40
    ),
    silenceMinDurationSeconds: clampNumber(
      record.silenceMinDurationSeconds,
      0.05,
      30,
      0.5
    ),
    markers,
    segments,
    lastSplitAt:
      typeof record.lastSplitAt === "string" ? record.lastSplitAt : "",
    lastExportFormat: asAudioFormat(record.lastExportFormat),
    isFavorite: record.isFavorite === true,
  };
}

export function cloneSplitterBody(body: AudioSplitterBody): AudioSplitterBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    durationSeconds: body.durationSeconds,
    mode: body.mode,
    everySeconds: body.everySeconds,
    equalParts: body.equalParts,
    silenceThresholdDb: body.silenceThresholdDb,
    silenceMinDurationSeconds: body.silenceMinDurationSeconds,
    markers: body.markers.map((entry) => ({ ...entry })),
    segments: body.segments.map((entry) => ({ ...entry })),
    lastSplitAt: body.lastSplitAt,
    lastExportFormat: body.lastExportFormat,
    isFavorite: body.isFavorite,
  };
}

function asCoverArt(value: unknown): AudioCoverArt | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.dataUrl !== "string" ||
    typeof record.mime !== "string"
  ) {
    return null;
  }
  return {
    dataUrl: record.dataUrl,
    mime: record.mime,
    size: clampNumber(record.size, 0, 1_000_000_000, 0),
    width:
      typeof record.width === "number" && Number.isFinite(record.width)
        ? record.width
        : undefined,
    height:
      typeof record.height === "number" && Number.isFinite(record.height)
        ? record.height
        : undefined,
  };
}

export const DEFAULT_METADATA_EDITOR_BODY: AudioMetadataEditorBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  title: "",
  artist: "",
  album: "",
  genre: "",
  year: "",
  trackNumber: "",
  comments: "",
  coverArt: null,
  lastSavedAt: "",
  lastExportDataUrl: "",
  isFavorite: false,
};

export function asMetadataEditorBody(
  value: unknown
): AudioMetadataEditorBody {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_METADATA_EDITOR_BODY };
  const record = value as Record<string, unknown>;
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    title: typeof record.title === "string" ? record.title : "",
    artist: typeof record.artist === "string" ? record.artist : "",
    album: typeof record.album === "string" ? record.album : "",
    genre: typeof record.genre === "string" ? record.genre : "",
    year: typeof record.year === "string" ? record.year : "",
    trackNumber:
      typeof record.trackNumber === "string" ? record.trackNumber : "",
    comments: typeof record.comments === "string" ? record.comments : "",
    coverArt: asCoverArt(record.coverArt),
    lastSavedAt:
      typeof record.lastSavedAt === "string" ? record.lastSavedAt : "",
    lastExportDataUrl:
      typeof record.lastExportDataUrl === "string"
        ? record.lastExportDataUrl
        : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneMetadataEditorBody(
  body: AudioMetadataEditorBody
): AudioMetadataEditorBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    title: body.title,
    artist: body.artist,
    album: body.album,
    genre: body.genre,
    year: body.year,
    trackNumber: body.trackNumber,
    comments: body.comments,
    coverArt: body.coverArt ? { ...body.coverArt } : null,
    lastSavedAt: body.lastSavedAt,
    lastExportDataUrl: body.lastExportDataUrl,
    isFavorite: body.isFavorite,
  };
}

function asBatchFile(value: unknown): AudioBatchFile | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.fileName !== "string" ||
    typeof record.dataUrl !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    fileName: record.fileName,
    format: asAudioFormat(record.format),
    dataUrl: record.dataUrl,
    size: clampNumber(record.size, 0, 1_000_000_000, 0),
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
  };
}

function asBatchItem(value: unknown): AudioBatchItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const file = asBatchFile(record.file);
  if (!file) return null;
  if (typeof record.id !== "string") return null;
  return {
    id: record.id,
    file,
    targetFormat: asAudioFormat(record.targetFormat),
    targetBitrateKbps: clampNumber(
      record.targetBitrateKbps,
      32,
      320,
      192
    ),
    renameTo: typeof record.renameTo === "string" ? record.renameTo : file.fileName,
    metadataTitle:
      typeof record.metadataTitle === "string" ? record.metadataTitle : "",
    metadataArtist:
      typeof record.metadataArtist === "string" ? record.metadataArtist : "",
    metadataAlbum:
      typeof record.metadataAlbum === "string" ? record.metadataAlbum : "",
    metadataYear:
      typeof record.metadataYear === "string" ? record.metadataYear : "",
    metadataComments:
      typeof record.metadataComments === "string"
        ? record.metadataComments
        : "",
    exportName:
      typeof record.exportName === "string"
        ? record.exportName
        : file.fileName,
    status:
      record.status === "running" ||
      record.status === "done" ||
      record.status === "error" ||
      record.status === "cancelled"
        ? record.status
        : "pending",
    progress: clampNumber(record.progress, 0, 1, 0),
    outputDataUrl:
      typeof record.outputDataUrl === "string" ? record.outputDataUrl : "",
    outputFormat: asAudioFormat(record.outputFormat),
    outputSize: clampNumber(record.outputSize, 0, 1_000_000_000, 0),
    errorMessage:
      typeof record.errorMessage === "string" ? record.errorMessage : "",
    finishedAt:
      typeof record.finishedAt === "string" ? record.finishedAt : "",
  };
}

export const DEFAULT_BATCH_BODY: AudioBatchBody = {
  mode: "convert",
  running: false,
  cancelled: false,
  currentIndex: 0,
  progress: 0,
  items: [],
  startedAt: "",
  finishedAt: "",
  lastZipDataUrl: "",
  isFavorite: false,
};

export function asBatchBody(value: unknown): AudioBatchBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_BATCH_BODY };
  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? (record.items as unknown[])
        .map((entry) => asBatchItem(entry))
        .filter((entry): entry is AudioBatchItem => Boolean(entry))
        .slice(0, 100)
    : [];
  const mode =
    record.mode === "rename" ||
    record.mode === "metadata" ||
    record.mode === "export"
      ? record.mode
      : "convert";
  return {
    mode,
    running: record.running === true,
    cancelled: record.cancelled === true,
    currentIndex: clampNumber(record.currentIndex, 0, items.length, 0),
    progress: clampNumber(record.progress, 0, 1, 0),
    items,
    startedAt: typeof record.startedAt === "string" ? record.startedAt : "",
    finishedAt:
      typeof record.finishedAt === "string" ? record.finishedAt : "",
    lastZipDataUrl:
      typeof record.lastZipDataUrl === "string" ? record.lastZipDataUrl : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneBatchBody(body: AudioBatchBody): AudioBatchBody {
  return {
    mode: body.mode,
    running: body.running,
    cancelled: body.cancelled,
    currentIndex: body.currentIndex,
    progress: body.progress,
    items: body.items.map((entry) => ({
      ...entry,
      file: { ...entry.file },
    })),
    startedAt: body.startedAt,
    finishedAt: body.finishedAt,
    lastZipDataUrl: body.lastZipDataUrl,
    isFavorite: body.isFavorite,
  };
}

function asDownloadEntry(value: unknown): AudioDownloadEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.label !== "string" ||
    typeof record.fileName !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    label: record.label,
    fileName: record.fileName,
    format: asAudioFormat(record.format),
    bytes: clampNumber(record.bytes, 0, 1_000_000_000, 0),
    exportedAt:
      typeof record.exportedAt === "string"
        ? record.exportedAt
        : new Date().toISOString(),
    sourceSessionId:
      typeof record.sourceSessionId === "string"
        ? record.sourceSessionId
        : "",
    note: typeof record.note === "string" ? record.note : "",
  };
}

function asLibraryEntry(value: unknown): AudioLibraryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.dataUrl !== "string"
  ) {
    return null;
  }
  const tags = Array.isArray(record.tags)
    ? (record.tags as unknown[]).filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  return {
    id: record.id,
    name: record.name,
    dataUrl: record.dataUrl,
    format: asAudioFormat(record.format),
    size: clampNumber(record.size, 0, 1_000_000_000, 0),
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    title: typeof record.title === "string" ? record.title : "",
    artist: typeof record.artist === "string" ? record.artist : "",
    album: typeof record.album === "string" ? record.album : "",
    addedAt:
      typeof record.addedAt === "string"
        ? record.addedAt
        : new Date().toISOString(),
    lastOpenedAt:
      typeof record.lastOpenedAt === "string"
        ? record.lastOpenedAt
        : new Date(0).toISOString(),
    openCount: clampNumber(record.openCount, 0, 1_000_000, 0),
    isFavorite: record.isFavorite === true,
    tags,
  };
}

const LIBRARY_SORT_FIELDS = new Set([
  "addedAt",
  "name",
  "size",
  "durationSeconds",
  "lastOpenedAt",
] as const);

export const DEFAULT_LIBRARY_BODY: AudioLibraryBody = {
  entries: [],
  search: "",
  sortField: "addedAt",
  sortDirection: "desc",
  formatFilter: "",
  favoritesOnly: false,
  selectedEntryId: "",
  downloads: [],
  isFavorite: false,
};

export function asLibraryBody(value: unknown): AudioLibraryBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_LIBRARY_BODY };
  const record = value as Record<string, unknown>;
  const entries = Array.isArray(record.entries)
    ? (record.entries as unknown[])
        .map((entry) => asLibraryEntry(entry))
        .filter((entry): entry is AudioLibraryEntry => Boolean(entry))
        .slice(0, 200)
    : [];
  const sortFieldRaw = record.sortField;
  const sortField = (
    LIBRARY_SORT_FIELDS as Set<AudioLibraryBody["sortField"]>
  ).has(sortFieldRaw as AudioLibraryBody["sortField"])
    ? (sortFieldRaw as AudioLibraryBody["sortField"])
    : "addedAt";
  const downloads = Array.isArray(record.downloads)
    ? (record.downloads as unknown[])
        .map((entry) => asDownloadEntry(entry))
        .filter((entry): entry is AudioDownloadEntry => Boolean(entry))
        .slice(0, 100)
    : [];
  return {
    entries,
    search: typeof record.search === "string" ? record.search : "",
    sortField,
    sortDirection: record.sortDirection === "asc" ? "asc" : "desc",
    formatFilter:
      typeof record.formatFilter === "string" ? record.formatFilter : "",
    favoritesOnly: record.favoritesOnly === true,
    selectedEntryId:
      typeof record.selectedEntryId === "string" ? record.selectedEntryId : "",
    downloads,
    isFavorite: record.isFavorite === true,
  };
}

export function cloneLibraryBody(body: AudioLibraryBody): AudioLibraryBody {
  return {
    entries: body.entries.map((entry) => ({ ...entry, tags: [...entry.tags] })),
    search: body.search,
    sortField: body.sortField,
    sortDirection: body.sortDirection,
    formatFilter: body.formatFilter,
    favoritesOnly: body.favoritesOnly,
    selectedEntryId: body.selectedEntryId,
    downloads: body.downloads.map((entry) => ({ ...entry })),
    isFavorite: body.isFavorite,
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 3: Waveform Editor + Effects + Silence + Export + Productivity       */
/* -------------------------------------------------------------------------- */

function asWaveformEditorPoint(
  value: unknown
): AudioWaveformEditorPoint | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.index !== "number" || typeof record.peak !== "number") {
    return null;
  }
  return {
    index: clampNumber(record.index, 0, 1_000_000, 0),
    peak: clampNumber(record.peak, 0, 1, 0),
  };
}

function asRegionMarker(value: unknown): AudioRegionMarker | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.label !== "string") {
    return null;
  }
  return {
    id: record.id,
    label: record.label,
    timeSeconds: clampNumber(record.timeSeconds, 0, 24 * 60 * 60, 0),
    color: typeof record.color === "string" ? record.color : "",
  };
}

function asWaveformEditorSelection(
  value: unknown
): AudioWaveformEditorSelection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.startSeconds !== "number" ||
    typeof record.endSeconds !== "number"
  ) {
    return null;
  }
  const start = clampNumber(record.startSeconds, 0, 24 * 60 * 60, 0);
  const end = clampNumber(record.endSeconds, 0, 24 * 60 * 60, 0);
  if (end <= start) return null;
  return { startSeconds: start, endSeconds: end };
}

export const DEFAULT_WAVEFORM_EDITOR_BODY: AudioWaveformEditorBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  bucketCount: 0,
  waveform: [],
  zoom: 1,
  scrollSeconds: 0,
  selection: null,
  markers: [],
  cursorSeconds: 0,
  isPlaying: false,
  rulerStepSeconds: 1,
  isFavorite: false,
};

export function asWaveformEditorBody(
  value: unknown
): AudioWaveformEditorBody {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_WAVEFORM_EDITOR_BODY };
  const record = value as Record<string, unknown>;
  const waveform = Array.isArray(record.waveform)
    ? (record.waveform as unknown[])
        .map((entry) => asWaveformEditorPoint(entry))
        .filter(
          (entry): entry is AudioWaveformEditorPoint => Boolean(entry)
        )
    : [];
  const markers = Array.isArray(record.markers)
    ? (record.markers as unknown[])
        .map((entry) => asRegionMarker(entry))
        .filter((entry): entry is AudioRegionMarker => Boolean(entry))
        .slice(0, 64)
    : [];
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    bucketCount: clampNumber(record.bucketCount, 0, 64_000, 0),
    waveform,
    zoom: clampNumber(record.zoom, 0.25, 32, 1),
    scrollSeconds: clampNumber(record.scrollSeconds, 0, 24 * 60 * 60, 0),
    selection: asWaveformEditorSelection(record.selection),
    markers,
    cursorSeconds: clampNumber(record.cursorSeconds, 0, 24 * 60 * 60, 0),
    isPlaying: record.isPlaying === true,
    rulerStepSeconds: clampNumber(record.rulerStepSeconds, 0.01, 60, 1),
    isFavorite: record.isFavorite === true,
  };
}

export function cloneWaveformEditorBody(
  body: AudioWaveformEditorBody
): AudioWaveformEditorBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    durationSeconds: body.durationSeconds,
    bucketCount: body.bucketCount,
    waveform: body.waveform.map((point) => ({ ...point })),
    zoom: body.zoom,
    scrollSeconds: body.scrollSeconds,
    selection: body.selection ? { ...body.selection } : null,
    markers: body.markers.map((marker) => ({ ...marker })),
    cursorSeconds: body.cursorSeconds,
    isPlaying: body.isPlaying,
    rulerStepSeconds: body.rulerStepSeconds,
    isFavorite: body.isFavorite,
  };
}

const EFFECT_KINDS = new Set([
  "fade-in",
  "fade-out",
  "normalize",
  "silence",
  "reverse",
  "speed",
  "pitch",
] as const);

function asEffectOp(value: unknown): AudioEffectOp | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  const kindRaw = record.kind;
  const kind = (EFFECT_KINDS as Set<string>).has(kindRaw as string)
    ? (kindRaw as AudioEffectOp["kind"])
    : "fade-in";
  return {
    id: record.id,
    kind,
    durationSeconds: clampNumber(record.durationSeconds, 0, 24 * 60 * 60, 0),
    speedFactor: clampNumber(record.speedFactor, 0.25, 4, 1),
    pitchSemitones: clampNumber(record.pitchSemitones, -24, 24, 0),
    targetPeak: clampNumber(record.targetPeak, 0, 1, 0.95),
    appliedAt:
      typeof record.appliedAt === "string"
        ? record.appliedAt
        : new Date().toISOString(),
    note: typeof record.note === "string" ? record.note : "",
  };
}

export const DEFAULT_EFFECTS_BODY: AudioEffectsBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  fadeInSeconds: 0.5,
  fadeOutSeconds: 0.5,
  targetPeak: 0.95,
  silenceDurationSeconds: 1,
  speedFactor: 1,
  pitchSemitones: 0,
  history: [],
  historyIndex: -1,
  lastResultDataUrl: "",
  lastResultFormat: "wav",
  lastResultAt: "",
  isFavorite: false,
};

export function asEffectsBody(value: unknown): AudioEffectsBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_EFFECTS_BODY };
  const record = value as Record<string, unknown>;
  const history = Array.isArray(record.history)
    ? (record.history as unknown[])
        .map((entry) => asEffectOp(entry))
        .filter((entry): entry is AudioEffectOp => Boolean(entry))
        .slice(-100)
    : [];
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    fadeInSeconds: clampNumber(record.fadeInSeconds, 0, 60, 0.5),
    fadeOutSeconds: clampNumber(record.fadeOutSeconds, 0, 60, 0.5),
    targetPeak: clampNumber(record.targetPeak, 0, 1, 0.95),
    silenceDurationSeconds: clampNumber(
      record.silenceDurationSeconds,
      0,
      24 * 60 * 60,
      1
    ),
    speedFactor: clampNumber(record.speedFactor, 0.25, 4, 1),
    pitchSemitones: clampNumber(record.pitchSemitones, -24, 24, 0),
    history,
    historyIndex: clampNumber(record.historyIndex, -1, history.length, -1),
    lastResultDataUrl:
      typeof record.lastResultDataUrl === "string"
        ? record.lastResultDataUrl
        : "",
    lastResultFormat: asAudioFormat(record.lastResultFormat),
    lastResultAt:
      typeof record.lastResultAt === "string" ? record.lastResultAt : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneEffectsBody(body: AudioEffectsBody): AudioEffectsBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    durationSeconds: body.durationSeconds,
    fadeInSeconds: body.fadeInSeconds,
    fadeOutSeconds: body.fadeOutSeconds,
    targetPeak: body.targetPeak,
    silenceDurationSeconds: body.silenceDurationSeconds,
    speedFactor: body.speedFactor,
    pitchSemitones: body.pitchSemitones,
    history: body.history.map((entry) => ({ ...entry })),
    historyIndex: body.historyIndex,
    lastResultDataUrl: body.lastResultDataUrl,
    lastResultFormat: body.lastResultFormat,
    lastResultAt: body.lastResultAt,
    isFavorite: body.isFavorite,
  };
}

function asSilenceRegion(value: unknown): AudioSilenceRegion | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  return {
    id: record.id,
    startSeconds: clampNumber(record.startSeconds, 0, 24 * 60 * 60, 0),
    endSeconds: clampNumber(record.endSeconds, 0, 24 * 60 * 60, 0),
    rms: clampNumber(record.rms, 0, 1, 0),
    selected: record.selected === true,
  };
}

export const DEFAULT_SILENCE_BODY: AudioSilenceBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  threshold: 0.02,
  minDurationSeconds: 0.5,
  paddingSeconds: 0.05,
  regions: [],
  activeRegionId: "",
  lastResultDataUrl: "",
  lastResultAt: "",
  isFavorite: false,
};

export function asSilenceBody(value: unknown): AudioSilenceBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_SILENCE_BODY };
  const record = value as Record<string, unknown>;
  const regions = Array.isArray(record.regions)
    ? (record.regions as unknown[])
        .map((entry) => asSilenceRegion(entry))
        .filter((entry): entry is AudioSilenceRegion => Boolean(entry))
        .slice(0, 200)
    : [];
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    threshold: clampNumber(record.threshold, 0, 1, 0.02),
    minDurationSeconds: clampNumber(
      record.minDurationSeconds,
      0.05,
      60,
      0.5
    ),
    paddingSeconds: clampNumber(record.paddingSeconds, 0, 5, 0.05),
    regions,
    activeRegionId:
      typeof record.activeRegionId === "string" ? record.activeRegionId : "",
    lastResultDataUrl:
      typeof record.lastResultDataUrl === "string"
        ? record.lastResultDataUrl
        : "",
    lastResultAt:
      typeof record.lastResultAt === "string" ? record.lastResultAt : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneSilenceBody(body: AudioSilenceBody): AudioSilenceBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    durationSeconds: body.durationSeconds,
    threshold: body.threshold,
    minDurationSeconds: body.minDurationSeconds,
    paddingSeconds: body.paddingSeconds,
    regions: body.regions.map((entry) => ({ ...entry })),
    activeRegionId: body.activeRegionId,
    lastResultDataUrl: body.lastResultDataUrl,
    lastResultAt: body.lastResultAt,
    isFavorite: body.isFavorite,
  };
}

const EXPORT_JOB_STATES = new Set([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const);

function asExportJob(value: unknown): AudioExportJob | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.label !== "string") {
    return null;
  }
  const state = (EXPORT_JOB_STATES as Set<string>).has(record.state as string)
    ? (record.state as AudioExportJob["state"])
    : "pending";
  return {
    id: record.id,
    label: record.label,
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    targetFormat: asAudioFormat(record.targetFormat),
    bitrateKbps: clampNumber(record.bitrateKbps, 32, 320, 192),
    sampleRate: clampNumber(record.sampleRate, 0, 384_000, 0),
    channels: clampNumber(record.channels, 0, 8, 0),
    selectionOnly: record.selectionOnly === true,
    selectionStartSeconds: clampNumber(
      record.selectionStartSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    selectionEndSeconds: clampNumber(
      record.selectionEndSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    state,
    progress: clampNumber(record.progress, 0, 1, 0),
    resultDataUrl:
      typeof record.resultDataUrl === "string" ? record.resultDataUrl : "",
    resultBytes: clampNumber(record.resultBytes, 0, 1_000_000_000, 0),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
    errorMessage:
      typeof record.errorMessage === "string" ? record.errorMessage : "",
  };
}

export const DEFAULT_EXPORT_CENTER_BODY: AudioExportCenterBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  sourceSampleRate: 44_100,
  sourceChannels: 2,
  selectionOnly: false,
  selectionStartSeconds: 0,
  selectionEndSeconds: 0,
  jobs: [],
  runningJobId: "",
  isFavorite: false,
};

export function asExportCenterBody(
  value: unknown
): AudioExportCenterBody {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_EXPORT_CENTER_BODY };
  const record = value as Record<string, unknown>;
  const jobs = Array.isArray(record.jobs)
    ? (record.jobs as unknown[])
        .map((entry) => asExportJob(entry))
        .filter((entry): entry is AudioExportJob => Boolean(entry))
        .slice(0, 32)
    : [];
  return {
    sourceDataUrl:
      typeof record.sourceDataUrl === "string" ? record.sourceDataUrl : "",
    sourceFormat: asAudioFormat(record.sourceFormat),
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    durationSeconds: clampNumber(
      record.durationSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    sourceSampleRate: clampNumber(
      record.sourceSampleRate,
      1_000,
      384_000,
      44_100
    ),
    sourceChannels: clampNumber(record.sourceChannels, 1, 8, 2),
    selectionOnly: record.selectionOnly === true,
    selectionStartSeconds: clampNumber(
      record.selectionStartSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    selectionEndSeconds: clampNumber(
      record.selectionEndSeconds,
      0,
      24 * 60 * 60,
      0
    ),
    jobs,
    runningJobId:
      typeof record.runningJobId === "string" ? record.runningJobId : "",
    isFavorite: record.isFavorite === true,
  };
}

export function cloneExportCenterBody(
  body: AudioExportCenterBody
): AudioExportCenterBody {
  return {
    sourceDataUrl: body.sourceDataUrl,
    sourceFormat: body.sourceFormat,
    fileName: body.fileName,
    durationSeconds: body.durationSeconds,
    sourceSampleRate: body.sourceSampleRate,
    sourceChannels: body.sourceChannels,
    selectionOnly: body.selectionOnly,
    selectionStartSeconds: body.selectionStartSeconds,
    selectionEndSeconds: body.selectionEndSeconds,
    jobs: body.jobs.map((job) => ({ ...job })),
    runningJobId: body.runningJobId,
    isFavorite: body.isFavorite,
  };
}

function asProductivityRecent(value: unknown): AudioProductivityRecent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.kind !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    title: record.title,
    kind: record.kind,
    openedAt:
      typeof record.openedAt === "string"
        ? record.openedAt
        : new Date().toISOString(),
  };
}

function asProductivityCommand(
  value: unknown
): AudioProductivityCommand | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.label !== "string") {
    return null;
  }
  return {
    id: record.id,
    label: record.label,
    category: typeof record.category === "string" ? record.category : "",
    shortcut: typeof record.shortcut === "string" ? record.shortcut : "",
    keywords: Array.isArray(record.keywords)
      ? (record.keywords as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
    lastInvokedAt:
      typeof record.lastInvokedAt === "string"
        ? record.lastInvokedAt
        : "",
  };
}

function asProductivityQuickAction(
  value: unknown
): AudioProductivityQuickAction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.label !== "string" ||
    typeof record.target !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    label: record.label,
    description:
      typeof record.description === "string" ? record.description : "",
    target: record.target,
    shortcut: typeof record.shortcut === "string" ? record.shortcut : "",
  };
}

export const DEFAULT_PRODUCTIVITY_BODY: AudioProductivityBody = {
  paletteOpen: false,
  paletteQuery: "",
  recent: [],
  quickActions: [],
  autosaveEnabled: true,
  autosaveIntervalMs: 1500,
  wordWrap: true,
  theme: "system",
  minimap: true,
  indent: 2,
  findShortcut: true,
  isFavorite: false,
};

export function asProductivityBody(
  value: unknown
): AudioProductivityBody {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_PRODUCTIVITY_BODY };
  const record = value as Record<string, unknown>;
  const recent = Array.isArray(record.recent)
    ? (record.recent as unknown[])
        .map((entry) => asProductivityRecent(entry))
        .filter(
          (entry): entry is AudioProductivityRecent => Boolean(entry)
        )
        .slice(0, 12)
    : [];
  const quickActions = Array.isArray(record.quickActions)
    ? (record.quickActions as unknown[])
        .map((entry) => asProductivityQuickAction(entry))
        .filter(
          (entry): entry is AudioProductivityQuickAction => Boolean(entry)
        )
    : [];
  return {
    paletteOpen: record.paletteOpen === true,
    paletteQuery:
      typeof record.paletteQuery === "string" ? record.paletteQuery : "",
    recent,
    quickActions,
    autosaveEnabled: record.autosaveEnabled !== false,
    autosaveIntervalMs: clampNumber(
      record.autosaveIntervalMs,
      250,
      60_000,
      1500
    ),
    wordWrap: record.wordWrap !== false,
    theme:
      record.theme === "light" || record.theme === "dark"
        ? record.theme
        : "system",
    minimap: record.minimap !== false,
    indent: clampNumber(record.indent, 0, 8, 2),
    findShortcut: record.findShortcut !== false,
    isFavorite: record.isFavorite === true,
  };
}

export function cloneProductivityBody(
  body: AudioProductivityBody
): AudioProductivityBody {
  return {
    paletteOpen: body.paletteOpen,
    paletteQuery: body.paletteQuery,
    recent: body.recent.map((entry) => ({ ...entry })),
    quickActions: body.quickActions.map((entry) => ({ ...entry })),
    autosaveEnabled: body.autosaveEnabled,
    autosaveIntervalMs: body.autosaveIntervalMs,
    wordWrap: body.wordWrap,
    theme: body.theme,
    minimap: body.minimap,
    indent: body.indent,
    findShortcut: body.findShortcut,
    isFavorite: body.isFavorite,
  };
}
