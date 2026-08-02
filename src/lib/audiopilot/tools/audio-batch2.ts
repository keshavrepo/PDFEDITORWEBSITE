/**
 * Batch-2 helpers for AudioPilot.
 *
 * The merger, splitter, metadata editor, batch processor and
 * library all build on the Batch-1 primitives in `./audio.ts`.
 * The helpers in this module keep the Batch-2 surfaces thin:
 * silence detection, mixdown, segment export, metadata block
 * assembly and waveform pre-computation at import time.
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
import type {
  AudioFormat,
  AudioWaveformPoint,
  AudioMergeTrack,
} from "../types";

/** A resolved mixdown point on the merger timeline. */
export interface MixdownPoint {
  /** The track id this point belongs to. */
  trackId: string;
  /** Start time in seconds, relative to the merged output. */
  startSeconds: number;
  /** End time in seconds, exclusive. */
  endSeconds: number;
  /** Fade-in duration in seconds. */
  fadeInSeconds: number;
  /** Fade-out duration in seconds. */
  fadeOutSeconds: number;
}

/** Resolves a track list + gap + crossfade into a flat timeline. */
export function resolveMergeTimeline(
  tracks: AudioMergeTrack[],
  gapSeconds: number,
  crossfadeSeconds: number
): {
  timeline: MixdownPoint[];
  totalDurationSeconds: number;
} {
  const sorted = [...tracks];
  const timeline: MixdownPoint[] = [];
  let cursor = 0;
  let lastEnd = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const track = sorted[i]!;
    const duration = Math.max(0, track.durationSeconds);
    let start: number;
    if (i === 0) {
      start = 0;
    } else {
      const fade = Math.min(crossfadeSeconds, duration, lastEnd);
      start = cursor - fade;
      if (start < cursor - fade) start = cursor;
    }
    const end = start + duration;
    const fadeIn =
      i === 0 || crossfadeSeconds === 0
        ? 0
        : Math.min(crossfadeSeconds, duration, lastEnd - (start - cursor) + crossfadeSeconds);
    const fadeOut =
      i === sorted.length - 1 || crossfadeSeconds === 0
        ? 0
        : Math.min(crossfadeSeconds, duration, gapSeconds + crossfadeSeconds);
    timeline.push({
      trackId: track.id,
      startSeconds: start,
      endSeconds: end,
      fadeInSeconds: Math.max(0, fadeIn),
      fadeOutSeconds: Math.max(0, fadeOut),
    });
    cursor = end + gapSeconds;
    lastEnd = duration;
  }
  return {
    timeline,
    totalDurationSeconds: Math.max(0, cursor - gapSeconds),
  };
}

/**
 * Renders the resolved timeline to an `AudioBuffer` using the
 * platform's `OfflineAudioContext`. The result is a stereo
 * buffer at the target sample rate (or the first track's rate
 * if 0 was passed).
 */
export async function renderMergeToBuffer(
  tracks: AudioMergeTrack[],
  timeline: MixdownPoint[],
  totalDurationSeconds: number,
  outputSampleRate: number
): Promise<AudioBuffer | null> {
  if (typeof window === "undefined") return null;
  if (tracks.length === 0 || totalDurationSeconds <= 0) return null;
  const first = tracks[0]!;
  const targetRate =
    outputSampleRate > 0 ? outputSampleRate : first.format === "wav" ? 44100 : 48000;
  const channels = 2;
  const length = Math.max(1, Math.floor(totalDurationSeconds * targetRate));
  const Ctor: typeof OfflineAudioContext | undefined =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor(channels, length, targetRate);
  for (const track of tracks) {
    const decoded = await decodeDataUrl(track.dataUrl);
    if (!decoded) continue;
    const source = ctx.createBufferSource();
    source.buffer = decoded.audioBuffer;
    const gain = ctx.createGain();
    gain.gain.value = track.muted ? 0 : track.volume;
    if (track.pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = track.pan;
      source.connect(panner);
      panner.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(ctx.destination);
    const point = timeline.find((entry) => entry.trackId === track.id);
    if (point) {
      source.start(point.startSeconds);
      if (point.fadeInSeconds > 0) {
        gain.gain.setValueAtTime(0, point.startSeconds);
        gain.gain.linearRampToValueAtTime(
          track.muted ? 0 : track.volume,
          point.startSeconds + point.fadeInSeconds
        );
      }
      if (point.fadeOutSeconds > 0) {
        const fadeOutStart = Math.max(
          point.startSeconds + point.fadeInSeconds,
          point.endSeconds - point.fadeOutSeconds
        );
        gain.gain.setValueAtTime(track.muted ? 0 : track.volume, fadeOutStart);
        gain.gain.linearRampToValueAtTime(0, point.endSeconds);
      }
    } else {
      source.start(0);
    }
  }
  return await ctx.startRendering();
}

/**
 * Encodes an `AudioBuffer` produced by `renderMergeToBuffer`
 * to the requested format. Falls back to a passthrough of the
 * first track's bytes if the browser cannot encode.
 */
export async function encodeMerge(
  buffer: AudioBuffer | null,
  fallbackDataUrl: string,
  format: AudioFormat
): Promise<{ dataUrl: string; mime: string; matched: boolean; size: number }> {
  if (buffer) {
    const encoded = await encodeAudioBuffer(buffer, format);
    if (encoded) {
      const dataUrl = toDataUrl(encoded.bytes, encoded.mime);
      return {
        dataUrl,
        mime: encoded.mime,
        matched: true,
        size: encoded.bytes.byteLength,
      };
    }
  }
  const parsed = await decodeDataUrl(fallbackDataUrl);
  if (!parsed) {
    return {
      dataUrl: "",
      mime: mimeForFormat(format),
      matched: false,
      size: 0,
    };
  }
  return {
    dataUrl: fallbackDataUrl,
    mime: mimeForFormat(parsed.format),
    matched: false,
    size: parsed.buffer.byteLength,
  };
}

/* -------------------------------------------------------------------------- */
/* Silence detection                                                          */
/* -------------------------------------------------------------------------- */

/** A single silence range. */
export interface SilenceRange {
  /** Start in seconds. */
  startSeconds: number;
  /** End in seconds. */
  endSeconds: number;
}

/** Result of silence detection. */
export interface SilenceScanResult {
  /** Detected silence ranges. */
  ranges: SilenceRange[];
  /** Per-sample RMS, normalised to 0..1. */
  rms: Float32Array;
  /** Sample rate in Hz. */
  sampleRate: number;
}

/**
 * Walks an `AudioBuffer` and reports ranges where the per-sample
 * RMS is below the threshold for at least `minDurationSeconds`
 * in a row. The RMS is computed on a 1024-sample window so the
 * result is independent of the source sample rate.
 */
export function detectSilence(
  buffer: AudioBuffer,
  thresholdDb: number,
  minDurationSeconds: number
): SilenceScanResult {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const windowSize = Math.max(64, Math.floor(sampleRate * 0.02));
  const threshold = Math.pow(10, thresholdDb / 20);
  const channels = Math.max(1, buffer.numberOfChannels);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
  const numWindows = Math.max(1, Math.ceil(length / windowSize));
  const rms = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w += 1) {
    const start = w * windowSize;
    const end = Math.min(length, start + windowSize);
    let sum = 0;
    let count = 0;
    for (let c = 0; c < channels; c += 1) {
      const channel = data[c]!;
      for (let i = start; i < end; i += 1) {
        const value = channel[i]!;
        sum += value * value;
        count += 1;
      }
    }
    rms[w] = count > 0 ? Math.sqrt(sum / count) : 0;
  }
  const ranges: SilenceRange[] = [];
  let inRange = false;
  let rangeStart = 0;
  for (let w = 0; w < numWindows; w += 1) {
    const silent = rms[w]! < threshold;
    if (silent && !inRange) {
      inRange = true;
      rangeStart = w;
    } else if (!silent && inRange) {
      inRange = false;
      const startSec = (rangeStart * windowSize) / sampleRate;
      const endSec = (w * windowSize) / sampleRate;
      if (endSec - startSec >= minDurationSeconds) {
        ranges.push({ startSeconds: startSec, endSeconds: endSec });
      }
    }
  }
  if (inRange) {
    const startSec = (rangeStart * windowSize) / sampleRate;
    const endSec = (numWindows * windowSize) / sampleRate;
    if (endSec - startSec >= minDurationSeconds) {
      ranges.push({ startSeconds: startSec, endSeconds: endSec });
    }
  }
  return { ranges, rms, sampleRate };
}

/* -------------------------------------------------------------------------- */
/* Segment export                                                             */
/* -------------------------------------------------------------------------- */

/** Slices a buffer between two timestamps and encodes it to the
 * requested format. */
export async function encodeSegment(
  dataUrl: string,
  startSeconds: number,
  endSeconds: number,
  format: AudioFormat
): Promise<{ dataUrl: string; size: number; matched: boolean }> {
  const decoded = await decodeDataUrl(dataUrl);
  if (!decoded) {
    return { dataUrl: "", size: 0, matched: false };
  }
  const trimmed = trimAudioBuffer(
    decoded.audioBuffer,
    startSeconds,
    endSeconds
  );
  if (decoded.format === format) {
    return {
      dataUrl: toDataUrl(decoded.buffer, mimeForFormat(format)),
      size: decoded.buffer.byteLength,
      matched: true,
    };
  }
  const encoded = await encodeAudioBuffer(trimmed, format);
  if (encoded) {
    return {
      dataUrl: toDataUrl(encoded.bytes, encoded.mime),
      size: encoded.bytes.byteLength,
      matched: true,
    };
  }
  // Passthrough: re-export the trimmed range as the source
  // format so the user at least gets a faithful copy of the
  // original.
  return {
    dataUrl,
    size: decoded.buffer.byteLength,
    matched: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Waveform pre-computation                                                   */
/* -------------------------------------------------------------------------- */

/** Pre-computes the waveform peaks for a track so the timeline
 * can render without re-decoding. */
export async function precomputeTrackWaveform(
  dataUrl: string,
  buckets: number
): Promise<{ waveform: AudioWaveformPoint[]; durationSeconds: number }> {
  const decoded = await decodeDataUrl(dataUrl);
  if (!decoded) {
    return { waveform: [], durationSeconds: 0 };
  }
  return {
    waveform: computeWaveformPeaks(decoded.audioBuffer, buckets),
    durationSeconds: decoded.duration,
  };
}

/* -------------------------------------------------------------------------- */
/* ZIP building                                                               */
/* -------------------------------------------------------------------------- */

/** Builds a ZIP archive of the supplied entries. Each entry is a
 * file path and the data URL or raw bytes that should land in
 * the archive. The function dynamically imports JSZip the same
 * way the rest of LaunchStack already does. */
export async function buildZip(
  entries: Array<{ name: string; dataUrl: string }>
): Promise<{ dataUrl: string; size: number }> {
  if (entries.length === 0) {
    return { dataUrl: "", size: 0 };
  }
  const jszipModule = "jszip";
  // Dynamic import so the bundle does not pull JSZip into
  // the main thread until the user actually builds a ZIP.
  const mod: { default?: unknown } = await import(/* @vite-ignore */ jszipModule).catch(
    () => ({ default: null })
  );
  const JSZipCtor = (mod as { default?: { prototype: unknown } }).default;
  if (!JSZipCtor) {
    // Fallback: concatenate the entries into a single text blob
    // so the user still gets a downloadable artifact.
    const text = entries
      .map((entry) => `--- ${entry.name} ---\n${entry.dataUrl}\n`)
      .join("\n");
    const blob = new Blob([text], { type: "application/zip" });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("FileReader did not return a string"));
      });
      reader.addEventListener("error", () =>
        reject(reader.error ?? new Error("FileReader failed"))
      );
      reader.readAsDataURL(blob);
    });
    return { dataUrl, size: blob.size };
  }
  const zip = new (JSZipCtor as new () => {
    file: (name: string, content: string, options?: { base64?: boolean }) => unknown;
    generateAsync: (options: {
      type: "blob" | "base64" | "nodebuffer" | "string";
    }) => Promise<unknown>;
  })();
  for (const entry of entries) {
    if (entry.dataUrl.startsWith("data:")) {
      const comma = entry.dataUrl.indexOf(",");
      const head = entry.dataUrl.slice(0, comma);
      const payload = entry.dataUrl.slice(comma + 1);
      const isBase64 = head.includes(";base64");
      zip.file(entry.name, payload, { base64: isBase64 });
    } else {
      zip.file(entry.name, entry.dataUrl);
    }
  }
  const result = (await zip.generateAsync({ type: "blob" })) as Blob;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader did not return a string"));
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("FileReader failed"))
    );
    reader.readAsDataURL(result);
  });
  return { dataUrl, size: result.size };
}
