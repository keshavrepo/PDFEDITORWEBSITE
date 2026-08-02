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
  AudioConverterBody,
  AudioFormat,
  AudioMetadataTag,
  AudioPlayerBody,
  AudioRecording,
  AudioSessionCategory,
  AudioSessionKind,
  AudioTrimOp,
  AudioTrimmerBody,
  AudioWaveformPoint,
  AudioRecorderBody,
} from "./types";

export type {
  AudioConverterBody,
  AudioFormat,
  AudioMetadataTag,
  AudioPlayerBody,
  AudioRecording,
  AudioSessionCategory,
  AudioSessionDefinition,
  AudioSessionKind,
  AudioSessionMeta,
  AudioSessionSummary,
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
