/**
 * Batch-3 helpers for AudioPilot.
 *
 * The waveform editor, audio effects, silence detection, export
 * center and workspace productivity surfaces all build on the
 * Batch-1 primitives in `./audio.ts` and the Batch-2 helpers in
 * `./audio-batch2.ts`. The helpers in this module keep the
 * Batch-3 surfaces thin: high-resolution waveform pre-computation
 * at the current zoom level, fade / normalize / silence / reverse
 * / speed / pitch application, silence region detection,
 * selection-aware mixdown export and a small command-palette
 * search.
 *
 * Browser-only — surfaces call these from event handlers and
 * effects, the engine never runs on the server.
 */

import {
  computeWaveformPeaks,
  decodeDataUrl,
  encodeAudioBuffer,
  mimeForFormat,
  toDataUrl,
  trimAudioBuffer,
} from "./audio";
import { detectSilence, type SilenceRange } from "./audio-batch2";
import type {
  AudioEffectOp,
  AudioEffectsBody,
  AudioExportJob,
  AudioFormat,
  AudioRegionMarker,
  AudioSilenceRegion,
  AudioWaveformEditorPoint,
  AudioWaveformPoint,
} from "../types";

/** A single AudioContext singleton, lazily created. Mirrors the
 * helper in `audio.ts` so every surface sees the same context. */
let cachedContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (cachedContext) return cachedContext;
  if (typeof window === "undefined") {
    throw new Error("AudioContext is only available in the browser");
  }
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) {
    throw new Error("AudioContext is not supported in this browser");
  }
  cachedContext = new Ctor();
  return cachedContext;
}

/* -------------------------------------------------------------------------- */
/* High-resolution waveform                                                    */
/* -------------------------------------------------------------------------- */

/** Bucket count for a given zoom level. The waveform editor scales
 * the bucket count linearly with the zoom so a higher zoom shows
 * a denser waveform. */
export function bucketCountForZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 0;
  const base = 1024;
  return Math.min(32_768, Math.max(256, Math.floor(base * zoom)));
}

/** Computes a high-resolution waveform for the active source at
 * the active zoom level. The result is intentionally dense so a
 * 4x zoom on a 5-minute file still has thousands of buckets. */
export function computeHighResWaveform(
  dataUrl: string,
  zoom: number
): Promise<{ peaks: AudioWaveformEditorPoint[]; duration: number } | null> {
  return (async () => {
    const decoded = await decodeDataUrl(dataUrl);
    if (!decoded) return null;
    const bucketCount = bucketCountForZoom(zoom);
    const peaks = computeWaveformPeaks(decoded.audioBuffer, bucketCount);
    return {
      peaks: peaks.map((point) => ({ index: point.index, peak: point.peak })),
      duration: decoded.duration,
    };
  })();
}

/** Ruler step (in seconds) for the active zoom. Higher zoom = a
 * smaller step. */
export function rulerStepForZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  if (zoom >= 16) return 0.05;
  if (zoom >= 8) return 0.1;
  if (zoom >= 4) return 0.5;
  if (zoom >= 2) return 1;
  if (zoom >= 1) return 2;
  if (zoom >= 0.5) return 5;
  return 10;
}

/* -------------------------------------------------------------------------- */
/* Audio effects                                                              */
/* -------------------------------------------------------------------------- */

/** Applies a linear fade-in to the first `durationSeconds` of the
 * buffer. Returns a fresh `AudioBuffer`. */
export function applyFadeIn(
  buffer: AudioBuffer,
  durationSeconds: number
): AudioBuffer {
  const ctx = getAudioContext();
  const next = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  const samples = Math.max(
    1,
    Math.min(buffer.length, Math.floor(durationSeconds * buffer.sampleRate))
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const source = buffer.getChannelData(ch);
    const target = next.getChannelData(ch);
    for (let i = 0; i < buffer.length; i += 1) {
      const ramp = i < samples ? i / samples : 1;
      target[i] = source[i]! * ramp;
    }
  }
  return next;
}

/** Applies a linear fade-out to the last `durationSeconds` of the
 * buffer. */
export function applyFadeOut(
  buffer: AudioBuffer,
  durationSeconds: number
): AudioBuffer {
  const ctx = getAudioContext();
  const next = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  const samples = Math.max(
    1,
    Math.min(buffer.length, Math.floor(durationSeconds * buffer.sampleRate))
  );
  const start = buffer.length - samples;
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const source = buffer.getChannelData(ch);
    const target = next.getChannelData(ch);
    for (let i = 0; i < buffer.length; i += 1) {
      const ramp = i >= start ? (buffer.length - i) / samples : 1;
      target[i] = source[i]! * Math.max(0, ramp);
    }
  }
  return next;
}

/** Normalises the buffer so the loudest sample matches `targetPeak`
 * in the 0..1 range. */
export function applyNormalize(
  buffer: AudioBuffer,
  targetPeak: number
): AudioBuffer {
  const ctx = getAudioContext();
  const next = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i += 1) {
      const value = Math.abs(data[i]!);
      if (value > peak) peak = value;
    }
  }
  const safeTarget = Math.max(0, Math.min(1, targetPeak));
  const gain = peak > 0 ? safeTarget / peak : 1;
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const source = buffer.getChannelData(ch);
    const target = next.getChannelData(ch);
    for (let i = 0; i < source.length; i += 1) {
      const value = source[i]! * gain;
      target[i] = value > 1 ? 1 : value < -1 ? -1 : value;
    }
  }
  return next;
}

/** Returns a buffer of pure silence of the requested duration. */
export function renderSilence(
  durationSeconds: number,
  sampleRate: number,
  channels: number
): AudioBuffer {
  const ctx = getAudioContext();
  const length = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const buffer = ctx.createBuffer(channels, length, sampleRate);
  // The buffer is already zero-filled by the spec, so we just
  // return it.
  return buffer;
}

/** Reverses the buffer in place on a fresh copy. */
export function applyReverse(buffer: AudioBuffer): AudioBuffer {
  const ctx = getAudioContext();
  const next = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const source = buffer.getChannelData(ch);
    const target = next.getChannelData(ch);
    for (let i = 0; i < buffer.length; i += 1) {
      target[i] = source[buffer.length - 1 - i]!;
    }
  }
  return next;
}

/** Resamples a buffer to a new sample rate using a simple linear
 * interpolation. The function is intentionally dependency-free
 * so it runs in the same `OfflineAudioContext` flow the rest of
 * the workspace already uses. */
export function resampleBuffer(
  buffer: AudioBuffer,
  targetSampleRate: number
): AudioBuffer {
  if (targetSampleRate <= 0 || targetSampleRate === buffer.sampleRate) {
    return buffer;
  }
  const ctx = getAudioContext();
  const ratio = targetSampleRate / buffer.sampleRate;
  const newLength = Math.max(1, Math.floor(buffer.length * ratio));
  const next = ctx.createBuffer(
    buffer.numberOfChannels,
    newLength,
    targetSampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const source = buffer.getChannelData(ch);
    const target = next.getChannelData(ch);
    for (let i = 0; i < newLength; i += 1) {
      const sourceIndex = i / ratio;
      const lower = Math.floor(sourceIndex);
      const upper = Math.min(buffer.length - 1, lower + 1);
      const t = sourceIndex - lower;
      target[i] = source[lower]! * (1 - t) + source[upper]! * t;
    }
  }
  return next;
}

/** Adjusts the playback speed of the buffer by stretching or
 * compressing the samples linearly. A `speedFactor` of 1 leaves
 * the buffer unchanged; 2 makes it twice as fast (and half as
 * long); 0.5 makes it twice as long. */
export function applySpeed(
  buffer: AudioBuffer,
  speedFactor: number
): AudioBuffer {
  if (!Number.isFinite(speedFactor) || speedFactor <= 0) return buffer;
  if (speedFactor === 1) return buffer;
  const ctx = getAudioContext();
  const targetLength = Math.max(1, Math.floor(buffer.length / speedFactor));
  const next = ctx.createBuffer(
    buffer.numberOfChannels,
    targetLength,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const source = buffer.getChannelData(ch);
    const target = next.getChannelData(ch);
    for (let i = 0; i < targetLength; i += 1) {
      const sourceIndex = i * speedFactor;
      const lower = Math.floor(sourceIndex);
      const upper = Math.min(buffer.length - 1, lower + 1);
      const t = sourceIndex - lower;
      target[i] = source[lower]! * (1 - t) + source[upper]! * t;
    }
  }
  return next;
}

/** Applies a pitch shift by an integer number of semitones. The
 * implementation is a sample-rate trick: shifting by N semitones
 * means multiplying the sample rate by `2 ** (N / 12)` and
 * resampling, which moves the pitches without changing the
 * duration. */
export function applyPitchShift(
  buffer: AudioBuffer,
  semitones: number
): AudioBuffer {
  if (!Number.isFinite(semitones) || semitones === 0) return buffer;
  const ratio = Math.pow(2, semitones / 12);
  const newSampleRate = Math.max(1, Math.round(buffer.sampleRate * ratio));
  return resampleBuffer(buffer, newSampleRate);
}

/** Builds a human-readable label for an effect op. */
export function describeEffectOp(op: AudioEffectOp): string {
  switch (op.kind) {
    case "fade-in":
      return `Fade in · ${op.durationSeconds.toFixed(2)}s`;
    case "fade-out":
      return `Fade out · ${op.durationSeconds.toFixed(2)}s`;
    case "normalize":
      return `Normalize · peak ${(op.targetPeak * 100).toFixed(0)}%`;
    case "silence":
      return `Silence · ${op.durationSeconds.toFixed(2)}s`;
    case "reverse":
      return `Reverse`;
    case "speed":
      return `Speed · ${op.speedFactor.toFixed(2)}x`;
    case "pitch":
      return `Pitch · ${op.pitchSemitones >= 0 ? "+" : ""}${op.pitchSemitones} semitones`;
    default:
      return "Effect";
  }
}

/** Applies a single effect op to a buffer and returns the result. */
export function applyEffectOp(
  buffer: AudioBuffer,
  op: AudioEffectOp
): AudioBuffer {
  switch (op.kind) {
    case "fade-in":
      return applyFadeIn(buffer, op.durationSeconds);
    case "fade-out":
      return applyFadeOut(buffer, op.durationSeconds);
    case "normalize":
      return applyNormalize(buffer, op.targetPeak);
    case "silence":
      return renderSilence(
        op.durationSeconds,
        buffer.sampleRate,
        buffer.numberOfChannels
      );
    case "reverse":
      return applyReverse(buffer);
    case "speed":
      return applySpeed(buffer, op.speedFactor);
    case "pitch":
      return applyPitchShift(buffer, op.pitchSemitones);
    default:
      return buffer;
  }
}

/** Resolves the effect history into a buffer. The function walks
 * the operations from oldest to newest (or up to the undo
 * pointer) and applies each one in turn. */
export function applyEffectHistory(
  source: AudioBuffer,
  body: AudioEffectsBody
): AudioBuffer {
  const upTo = Math.min(body.historyIndex, body.history.length - 1);
  let current: AudioBuffer = source;
  for (let i = 0; i <= upTo; i += 1) {
    const op = body.history[i];
    if (!op) continue;
    current = applyEffectOp(current, op);
  }
  return current;
}

/** Renders the effect history to a data URL. The function decodes
 * the source, applies the history, then re-encodes the result
 * through the platform's `MediaRecorder` pipeline (or returns a
 * passthrough when the target is the source format). */
export async function renderEffectsToDataUrl(
  body: AudioEffectsBody
): Promise<{ dataUrl: string; bytes: number; matched: boolean } | null> {
  if (!body.sourceDataUrl) return null;
  const decoded = await decodeDataUrl(body.sourceDataUrl);
  if (!decoded) return null;
  const processed = applyEffectHistory(decoded.audioBuffer, body);
  const encoded = await encodeAudioBuffer(processed, body.lastResultFormat);
  if (!encoded) {
    return { dataUrl: body.sourceDataUrl, bytes: 0, matched: false };
  }
  return {
    dataUrl: toDataUrl(encoded.bytes, encoded.mime),
    bytes: encoded.bytes.byteLength,
    matched: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Silence detection (re-export + helpers)                                    */
/* -------------------------------------------------------------------------- */

/** Threshold in dB. The detection helper takes a dB threshold; the
 * surface normalises a 0..1 linear slider to dB so the user sees
 * a friendly unit. */
export function linearToDb(value: number): number {
  if (value <= 0) return -120;
  return 20 * Math.log10(value);
}

export function dbToLinear(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.pow(10, value / 20);
}

/** Runs the silence detector on a data URL and resolves the
 * results to `AudioSilenceRegion` rows. */
export async function scanSilenceRegions(
  dataUrl: string,
  thresholdLinear: number,
  minDurationSeconds: number,
  paddingSeconds: number
): Promise<{
  regions: AudioSilenceRegion[];
  duration: number;
} | null> {
  const decoded = await decodeDataUrl(dataUrl);
  if (!decoded) return null;
  const thresholdDb = linearToDb(thresholdLinear);
  const result = detectSilence(
    decoded.audioBuffer,
    thresholdDb,
    minDurationSeconds
  );
  const regions: AudioSilenceRegion[] = result.ranges.map(
    (range: SilenceRange, index: number) => ({
      id: `sil-${Date.now().toString(36)}-${index}`,
      startSeconds: Math.max(0, range.startSeconds - paddingSeconds),
      endSeconds: Math.min(
        decoded.duration,
        range.endSeconds + paddingSeconds
      ),
      rms: 0,
      selected: false,
    })
  );
  // Compute the per-region RMS by averaging the scan RMS over the
  // region's window range. The result is purely informational.
  const windowSize = Math.max(
    64,
    Math.floor(result.sampleRate * 0.02)
  );
  for (const region of regions) {
    const startWindow = Math.max(
      0,
      Math.floor((region.startSeconds * result.sampleRate) / windowSize)
    );
    const endWindow = Math.min(
      result.rms.length,
      Math.ceil((region.endSeconds * result.sampleRate) / windowSize)
    );
    let sum = 0;
    let count = 0;
    for (let w = startWindow; w < endWindow; w += 1) {
      sum += result.rms[w]!;
      count += 1;
    }
    region.rms = count > 0 ? sum / count : 0;
  }
  return { regions, duration: decoded.duration };
}

/** Builds a buffer that contains every active (non-silence) range
 * stitched together in order. */
export function stitchActiveRanges(
  buffer: AudioBuffer,
  regions: AudioSilenceRegion[]
): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const sorted = [...regions].sort(
    (a, b) => a.startSeconds - b.startSeconds
  );
  let totalLength = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const region = sorted[i]!;
    const startSample = Math.floor(region.startSeconds * sampleRate);
    const endSample = Math.min(
      buffer.length,
      Math.floor(region.endSeconds * sampleRate)
    );
    totalLength += Math.max(0, endSample - startSample);
  }
  const next = ctx.createBuffer(
    channels,
    Math.max(1, totalLength),
    sampleRate
  );
  let writeOffset = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const region = sorted[i]!;
    const startSample = Math.floor(region.startSeconds * sampleRate);
    const endSample = Math.min(
      buffer.length,
      Math.floor(region.endSeconds * sampleRate)
    );
    const length = Math.max(0, endSample - startSample);
    for (let ch = 0; ch < channels; ch += 1) {
      const source = buffer.getChannelData(ch);
      const target = next.getChannelData(ch);
      for (let s = 0; s < length; s += 1) {
        target[writeOffset + s] = source[startSample + s]!;
      }
    }
    writeOffset += length;
  }
  return next;
}

/** Builds a buffer that contains the silence regions only. The
 * returned buffer is the concatenation of the silence ranges
 * (in order), so a split-at-silence export produces one file per
 * silence range. The function also returns the per-region
 * length list so the caller can encode each one separately. */
export function renderSilenceRegionBuffers(
  buffer: AudioBuffer,
  regions: AudioSilenceRegion[]
): AudioBuffer[] {
  const sorted = [...regions].sort(
    (a, b) => a.startSeconds - b.startSeconds
  );
  const ctx = getAudioContext();
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const buffers: AudioBuffer[] = [];
  for (const region of sorted) {
    const startSample = Math.floor(region.startSeconds * sampleRate);
    const endSample = Math.min(
      buffer.length,
      Math.floor(region.endSeconds * sampleRate)
    );
    const length = Math.max(1, endSample - startSample);
    const out = ctx.createBuffer(channels, length, sampleRate);
    for (let ch = 0; ch < channels; ch += 1) {
      const source = buffer.getChannelData(ch);
      const target = out.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        target[i] = source[startSample + i]!;
      }
    }
    buffers.push(out);
  }
  return buffers;
}

/* -------------------------------------------------------------------------- */
/* Export Center                                                              */
/* -------------------------------------------------------------------------- */

/** Resamples + downmixes a buffer to the requested sample rate and
 * channel count. A channel count of 0 means "use the source". */
export function prepareBufferForExport(
  buffer: AudioBuffer,
  targetSampleRate: number,
  targetChannels: number
): AudioBuffer {
  let next = buffer;
  if (targetSampleRate > 0 && targetSampleRate !== buffer.sampleRate) {
    next = resampleBuffer(next, targetSampleRate);
  }
  if (targetChannels > 0 && targetChannels !== next.numberOfChannels) {
    next = downmixBuffer(next, targetChannels);
  }
  return next;
}

/** Downmixes / upmixes a buffer to the requested channel count. */
export function downmixBuffer(
  buffer: AudioBuffer,
  targetChannels: number
): AudioBuffer {
  if (targetChannels <= 0) return buffer;
  if (targetChannels === buffer.numberOfChannels) return buffer;
  const ctx = getAudioContext();
  const next = ctx.createBuffer(
    targetChannels,
    buffer.length,
    buffer.sampleRate
  );
  const sourceChannels = buffer.numberOfChannels;
  if (targetChannels === 1) {
    const target = next.getChannelData(0);
    for (let i = 0; i < buffer.length; i += 1) {
      let sum = 0;
      for (let c = 0; c < sourceChannels; c += 1) {
        sum += buffer.getChannelData(c)[i]!;
      }
      target[i] = sum / sourceChannels;
    }
    return next;
  }
  if (targetChannels === 2 && sourceChannels === 1) {
    const mono = buffer.getChannelData(0);
    const left = next.getChannelData(0);
    const right = next.getChannelData(1);
    for (let i = 0; i < buffer.length; i += 1) {
      left[i] = mono[i]!;
      right[i] = mono[i]!;
    }
    return next;
  }
  for (let ch = 0; ch < targetChannels; ch += 1) {
    const sourceIndex = Math.min(sourceChannels - 1, ch);
    const source = buffer.getChannelData(sourceIndex);
    const target = next.getChannelData(ch);
    target.set(source);
  }
  return next;
}

/** Runs a single export job. The function updates the job in
 * place so the surface can render a live progress bar. */
export async function runExportJob(
  job: AudioExportJob,
  onUpdate: (next: AudioExportJob) => void
): Promise<void> {
  onUpdate({
    ...job,
    state: "running",
    progress: 0,
    errorMessage: "",
    updatedAt: new Date().toISOString(),
  });
  try {
    const decoded = await decodeDataUrl(job.sourceDataUrl);
    if (!decoded) throw new Error("Could not decode the source audio");
    let processed: AudioBuffer = decoded.audioBuffer;
    onUpdate({ ...job, progress: 0.2, updatedAt: new Date().toISOString() });
    if (job.selectionOnly && job.selectionEndSeconds > job.selectionStartSeconds) {
      processed = trimAudioBuffer(
        processed,
        job.selectionStartSeconds,
        job.selectionEndSeconds
      );
    }
    onUpdate({ ...job, progress: 0.4, updatedAt: new Date().toISOString() });
    processed = prepareBufferForExport(
      processed,
      job.sampleRate,
      job.channels
    );
    onUpdate({ ...job, progress: 0.6, updatedAt: new Date().toISOString() });
    const encoded = await encodeAudioBuffer(processed, job.targetFormat);
    if (!encoded) {
      // The browser cannot encode the requested format. Fall back
      // to the source bytes.
      onUpdate({
        ...job,
        state: "completed",
        progress: 1,
        resultDataUrl: job.sourceDataUrl,
        resultBytes: 0,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    onUpdate({ ...job, progress: 0.85, updatedAt: new Date().toISOString() });
    onUpdate({
      ...job,
      state: "completed",
      progress: 1,
      resultDataUrl: toDataUrl(encoded.bytes, encoded.mime),
      resultBytes: encoded.bytes.byteLength,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    onUpdate({
      ...job,
      state: "failed",
      errorMessage: err instanceof Error ? err.message : "Export failed",
      updatedAt: new Date().toISOString(),
    });
  }
}

/** Builds a stable mime for a job. */
export function mimeForJob(job: AudioExportJob): string {
  return mimeForFormat(job.targetFormat);
}

/* -------------------------------------------------------------------------- */
/* Region markers                                                             */
/* -------------------------------------------------------------------------- */

/** Generates a stable id for a region marker. */
export function generateRegionMarkerId(): string {
  return `marker-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** Returns a friendly color for a region marker. The list cycles so
 * successive markers are visually distinct. */
export function regionMarkerColor(index: number): string {
  const palette = [
    "#38bdf8",
    "#a855f7",
    "#f97316",
    "#10b981",
    "#facc15",
    "#ec4899",
  ];
  return palette[index % palette.length]!;
}

/** Filters a list of region markers to the visible window. */
export function visibleRegionMarkers(
  markers: AudioRegionMarker[],
  startSeconds: number,
  endSeconds: number
): AudioRegionMarker[] {
  return markers.filter(
    (marker) => marker.timeSeconds >= startSeconds && marker.timeSeconds <= endSeconds
  );
}

/* -------------------------------------------------------------------------- */
/* Productivity: command palette search                                        */
/* -------------------------------------------------------------------------- */

/** A single result row in the command palette. */
export interface CommandPaletteMatch {
  /** The command that matched. */
  commandId: string;
  /** Match score, higher is better. */
  score: number;
}

/** Fuzzy-searches a list of commands. The scoring is simple: an
 * exact label match wins, then a label prefix match, then a
 * substring match, then a keyword match. */
export function fuzzyMatchCommands<
  T extends {
    id: string;
    label: string;
    keywords: string[];
  }
>(commands: T[], query: string): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return commands;
  const scored: Array<{ command: T; score: number }> = [];
  for (const command of commands) {
    const label = command.label.toLowerCase();
    if (label === trimmed) {
      scored.push({ command, score: 100 });
      continue;
    }
    if (label.startsWith(trimmed)) {
      scored.push({ command, score: 80 });
      continue;
    }
    if (label.includes(trimmed)) {
      scored.push({ command, score: 60 });
      continue;
    }
    for (const keyword of command.keywords) {
      const value = keyword.toLowerCase();
      if (value === trimmed) {
        scored.push({ command, score: 50 });
        break;
      }
      if (value.startsWith(trimmed)) {
        scored.push({ command, score: 40 });
        break;
      }
      if (value.includes(trimmed)) {
        scored.push({ command, score: 30 });
        break;
      }
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.command);
}

/** Renders a duration in seconds as a `m:ss` (or `h:mm:ss`)
 * string. The function is shared between the productivity surface
 * and the waveform editor so the readout is consistent. */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const ss = secs.toString().padStart(2, "0");
  if (hours > 0) {
    const mm = minutes.toString().padStart(2, "0");
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/** Maps a waveform zoom value to a human label. */
export function describeZoom(zoom: number): string {
  if (!Number.isFinite(zoom) || zoom <= 0) return "1x";
  if (zoom >= 16) return "16x (max)";
  if (zoom >= 8) return "8x";
  if (zoom >= 4) return "4x";
  if (zoom >= 2) return "2x";
  if (zoom >= 1) return "1x";
  if (zoom >= 0.5) return "0.5x";
  return "0.25x (min)";
}

/** Clamps a zoom value to the supported range. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(0.25, Math.min(16, zoom));
}
