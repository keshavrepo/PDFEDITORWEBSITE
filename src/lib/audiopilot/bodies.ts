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
  AudioFormat,
  AudioLibraryBody,
  AudioLibraryEntry,
  AudioMergeTimelinePoint,
  AudioMergeTrack,
  AudioMergerBody,
  AudioMetadataEditorBody,
  AudioMetadataTag,
  AudioPlayerBody,
  AudioRecording,
  AudioSessionCategory,
  AudioSessionKind,
  AudioSplitMarker,
  AudioSplitSegment,
  AudioSplitterBody,
  AudioTrimOp,
  AudioTrimmerBody,
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
  AudioFormat,
  AudioLibraryBody,
  AudioLibraryEntry,
  AudioMergeTimelinePoint,
  AudioMergeTrack,
  AudioMergerBody,
  AudioMetadataEditorBody,
  AudioMetadataTag,
  AudioPlayerBody,
  AudioRecording,
  AudioSessionCategory,
  AudioSessionDefinition,
  AudioSessionKind,
  AudioSessionMeta,
  AudioSessionSummary,
  AudioSplitMarker,
  AudioSplitSegment,
  AudioSplitterBody,
  AudioTemplate,
  AudioTrimOp,
  AudioTrimmerBody,
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
    isFavorite: body.isFavorite,
  };
}
