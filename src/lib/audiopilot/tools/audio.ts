/**
 * Pure audio helpers used by every AudioPilot surface.
 *
 * The functions in this module are deliberately browser-only: the
 * surfaces call them from event handlers and effects, and the engine
 * never runs on the server. The conversion between data URLs and
 * ArrayBuffers, the metadata extraction, the waveform peak
 * computation and the format guesser all live here so every surface
 * uses the same implementation.
 *
 * The module is dependency-free: the `decodeAudioData` call goes
 * through the platform's `AudioContext`, which is universally
 * available in modern browsers.
 */

import type { AudioFormat, AudioWaveformPoint } from "../types";

/** Decoded audio payload the rest of the surfaces consume. */
export interface DecodedAudio {
  /** The original ArrayBuffer (for re-encoding). */
  buffer: ArrayBuffer;
  /** The decoded PCM data, ready to play or to re-encode. */
  audioBuffer: AudioBuffer;
  /** Duration in seconds, mirrored from `audioBuffer.duration`. */
  duration: number;
  /** Sample rate in Hz, mirrored from `audioBuffer.sampleRate`. */
  sampleRate: number;
  /** Number of channels, mirrored from `audioBuffer.numberOfChannels`. */
  channels: number;
  /** Best-effort detected format. */
  format: AudioFormat;
}

/** Result of reading a data URL. */
interface ParsedDataUrl {
  mime: string;
  bytes: ArrayBuffer;
}

/**
 * Reads a data URL into its MIME type and raw bytes.
 *
 * Returns `null` if the input is not a data URL. The function is
 * tolerant of trailing whitespace, which the browser sometimes adds
 * when the user drags and drops a file.
 */
export function parseDataUrl(value: string): ParsedDataUrl | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(trimmed);
  if (!match) return null;
  const mime = (match[1] ?? "").toLowerCase() || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  try {
    const bytes = isBase64
      ? base64ToArrayBuffer(payload)
      : new TextEncoder().encode(decodeURIComponent(payload)).buffer;
    return { mime, bytes };
  } catch {
    return null;
  }
}

/** Converts a base64 string to an ArrayBuffer. */
function base64ToArrayBuffer(input: string): ArrayBuffer {
  if (typeof atob === "function") {
    const binary = atob(input.replace(/\s+/g, ""));
    const length = binary.length;
    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < length; i += 1) view[i] = binary.charCodeAt(i);
    return buffer;
  }
  // Node fallback (not used at runtime, but keeps the helper
  // referenceable from server code without crashing the import).
  const buffer = new ArrayBuffer(0);
  return buffer;
}

/** Converts an ArrayBuffer (or Uint8Array) to a base64 string. */
export function arrayBufferToBase64(input: ArrayBuffer | Uint8Array): string {
  const view = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (typeof btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < view.length; i += chunk) {
      const slice = view.subarray(i, Math.min(i + chunk, view.length));
      binary += String.fromCharCode.apply(
        null,
        Array.from(slice) as number[]
      );
    }
    return btoa(binary);
  }
  return "";
}

/** Builds a data URL for the given bytes and MIME type. */
export function toDataUrl(
  bytes: ArrayBuffer | Uint8Array,
  mime: string
): string {
  return `data:${mime};base64,${arrayBufferToBase64(bytes)}`;
}

/**
 * Guesses the audio format from a MIME type or filename.
 *
 * Browsers expose `audio/mpeg` for MP3, `audio/wav` (or `audio/x-wav`)
 * for WAV, `audio/ogg` (or `audio/vorbis`) for OGG, `audio/flac` for
 * FLAC, and `audio/aac` (or `audio/mp4`) for AAC. The guesser falls
 * back to the filename extension when the MIME type is missing.
 */
export function guessAudioFormat(
  mime: string | undefined,
  fileName: string | undefined
): AudioFormat {
  const fromMime = (mime ?? "").toLowerCase();
  if (fromMime.includes("mpeg") || fromMime.includes("mp3")) return "mp3";
  if (fromMime.includes("wav") || fromMime.includes("x-wav")) return "wav";
  if (fromMime.includes("ogg") || fromMime.includes("vorbis")) return "ogg";
  if (fromMime.includes("flac")) return "flac";
  if (
    fromMime.includes("aac") ||
    fromMime.includes("mp4") ||
    fromMime.includes("m4a")
  ) {
    return "aac";
  }
  const ext = (fileName ?? "").toLowerCase().split(".").pop() ?? "";
  if (ext === "mp3") return "mp3";
  if (ext === "wav") return "wav";
  if (ext === "ogg" || ext === "oga") return "ogg";
  if (ext === "flac") return "flac";
  if (ext === "aac" || ext === "m4a") return "aac";
  return "wav";
}

/** MIME type for a given audio format. */
export function mimeForFormat(format: AudioFormat): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "aac":
      return "audio/aac";
    default:
      return "application/octet-stream";
  }
}

/** A minimal AudioContext singleton, lazily created. */
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

/**
 * Decodes a raw audio ArrayBuffer into an `AudioBuffer` using the
 * platform's `AudioContext`. Returns `null` if the decode fails —
 * the surfaces translate the null into a user-visible toast.
 */
export async function decodeAudioBuffer(
  bytes: ArrayBuffer
): Promise<AudioBuffer | null> {
  try {
    const ctx = getAudioContext();
    // Some browsers require the ArrayBuffer to be a fresh copy
    // before passing it to `decodeAudioData` (it detaches the
    // source). Cloning is cheap and avoids a `TypeError`.
    const copy = bytes.slice(0);
    return await ctx.decodeAudioData(copy);
  } catch {
    return null;
  }
}

/**
 * Loads a data URL into a decoded `AudioBuffer`. Combines the
 * data-URL parse, format guess and decode step into a single
 * helper so the surfaces do not have to thread them through
 * their state.
 */
export async function decodeDataUrl(
  dataUrl: string
): Promise<DecodedAudio | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const audioBuffer = await decodeAudioBuffer(parsed.bytes);
  if (!audioBuffer) return null;
  return {
    buffer: parsed.bytes,
    audioBuffer,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    format: guessAudioFormat(parsed.mime, undefined),
  };
}

/**
 * Computes a peak waveform from an `AudioBuffer`.
 *
 * The function walks each channel, picks the absolute peak per
 * bucket and normalises the result so the chart can render without
 * a second pass. Empty buffers return an empty array so the
 * waveform canvas can render the empty state without crashing.
 */
export function computeWaveformPeaks(
  buffer: AudioBuffer,
  buckets: number
): AudioWaveformPoint[] {
  if (!buffer || buckets <= 0 || buffer.length === 0) return [];
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const samplesPerBucket = Math.max(1, Math.floor(length / buckets));
  const peaks: number[] = new Array(buckets).fill(0);
  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let b = 0; b < buckets; b += 1) {
      const start = b * samplesPerBucket;
      const end = Math.min(length, start + samplesPerBucket);
      let peak = 0;
      for (let i = start; i < end; i += 1) {
        const sample = data[i];
        const value = sample < 0 ? -sample : sample;
        if (value > peak) peak = value;
      }
      if (peak > peaks[b]!) peaks[b] = peak;
    }
  }
  let maxPeak = 0;
  for (const peak of peaks) if (peak > maxPeak) maxPeak = peak;
  if (maxPeak > 0) {
    for (let i = 0; i < peaks.length; i += 1) peaks[i] = peaks[i]! / maxPeak;
  }
  const points: AudioWaveformPoint[] = new Array(buckets);
  for (let i = 0; i < buckets; i += 1) {
    points[i] = { index: i, peak: peaks[i]! };
  }
  return points;
}

/** Number of waveform buckets to compute by default. */
export const DEFAULT_WAVEFORM_BUCKETS = 512;

/** Common file extensions used by the encoder/decoder. */
export const FORMAT_EXTENSIONS: Record<AudioFormat, string> = {
  mp3: "mp3",
  wav: "wav",
  ogg: "ogg",
  flac: "flac",
  aac: "aac",
};

/** Human-readable labels for the audio formats. */
export const FORMAT_LABELS: Record<AudioFormat, string> = {
  mp3: "MP3",
  wav: "WAV",
  ogg: "OGG",
  flac: "FLAC",
  aac: "AAC",
};

/**
 * Formats a duration in seconds as a `m:ss` (or `h:mm:ss`) string.
 *
 * The helper is used by the player, the trimmer and the recorder
 * for the time readout. Negative or non-finite inputs render as
 * `0:00` so the surface never displays `NaN:NaN`.
 */
export function formatAudioDuration(seconds: number): string {
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

/** Formats a byte count as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Reads a `File` or `Blob` into a data URL the surfaces can persist
 * into IndexedDB. The helper wraps the standard `FileReader` API.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader is not available in this environment"));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("FileReader did not return a string"));
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("FileReader failed"))
    );
    reader.readAsDataURL(blob);
  });
}

/**
 * Best-effort metadata reader.
 *
 * The function returns a flat key/value list extracted from the
 * most common ID3 / Vorbis / RIFF header fields. Anything that
 * does not parse is silently skipped so the converter still works
 * on audio without embedded metadata.
 */
export function readAudioMetadata(
  bytes: ArrayBuffer
): Array<{ key: string; value: string }> {
  const tags: Array<{ key: string; value: string }> = [];
  try {
    const view = new Uint8Array(bytes);
    if (view.length < 4) return tags;

    // RIFF / WAV
    if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
      // Skip: WAV metadata uses LIST/INFO chunks; a full parser is
      // intentionally out of scope for Batch 1.
      return tags;
    }

    // ID3 (MP3)
    if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) {
      const version = view[3];
      if (version === 3 || version === 4) {
        // ID3v2.3 / ID3v2.4 header layout. The 10-byte header is
        // followed by frames; we walk a few frames to pull the
        // most useful tags.
        const size = id3v2Size(view, 6);
        const start = 10;
        let offset = start;
        while (offset + 10 < start + size) {
          const id = String.fromCharCode(
            view[offset]!,
            view[offset + 1]!,
            view[offset + 2]!,
            view[offset + 3]!
          );
          if (!/^[A-Z0-9]{4}$/.test(id)) break;
          const frameSize =
            version === 4
              ? synchSafeInt(view, offset + 4)
              : intValue(view, offset + 4, 4);
          if (frameSize <= 0 || frameSize > bytes.byteLength) break;
          const textBytes = view.subarray(offset + 10, offset + 10 + frameSize);
          const text = decodeId3v2Text(textBytes);
          if (text) {
            if (id === "TPE1" || id === "TPE2") tags.push({ key: "artist", value: text });
            else if (id === "TIT2") tags.push({ key: "title", value: text });
            else if (id === "TALB") tags.push({ key: "album", value: text });
            else if (id === "TCON") tags.push({ key: "genre", value: text });
            else if (id === "TYER" || id === "TDRC")
              tags.push({ key: "year", value: text });
            else if (id === "TCOM")
              tags.push({ key: "composer", value: text });
            else tags.push({ key: id, value: text });
          }
          offset += 10 + frameSize;
        }
      }
    }
  } catch {
    return tags;
  }
  return tags;
}

/** ID3v2 synchsafe integer parser (4 bytes, 7 bits each). */
function synchSafeInt(view: Uint8Array, offset: number): number {
  if (offset + 4 > view.length) return 0;
  return (
    ((view[offset]! & 0x7f) << 21) |
    ((view[offset + 1]! & 0x7f) << 14) |
    ((view[offset + 2]! & 0x7f) << 7) |
    (view[offset + 3]! & 0x7f)
  );
}

/** Standard big-endian 4-byte integer. */
function intValue(view: Uint8Array, offset: number, length: number): number {
  let value = 0;
  for (let i = 0; i < length; i += 1) {
    value = (value << 8) | (view[offset + i] ?? 0);
  }
  return value;
}

/** ID3v2.3 / v2.4 total size after the 10-byte header. */
function id3v2Size(view: Uint8Array, offset: number): number {
  if (offset + 4 > view.length) return 0;
  return (
    ((view[offset]! & 0x7f) << 21) |
    ((view[offset + 1]! & 0x7f) << 14) |
    ((view[offset + 2]! & 0x7f) << 7) |
    (view[offset + 3]! & 0x7f)
  );
}

/** Best-effort ID3v2 text-frame decoder. */
function decodeId3v2Text(textBytes: Uint8Array): string {
  if (textBytes.length < 1) return "";
  const encoding = textBytes[0]!;
  let data = textBytes.subarray(1);
  // Strip the null terminator if present.
  if (encoding === 0x01 || encoding === 0x02) {
    // UTF-16 (with or without BOM). Decode as UTF-16 and skip
    // a leading BOM if present.
    if (data.length >= 2) {
      const bom = (data[0]! << 8) | data[1]!;
      if (bom === 0xfeff || bom === 0xfffe) data = data.subarray(2);
    }
    let str = "";
    for (let i = 0; i + 1 < data.length; i += 2) {
      const code = (data[i]! << 8) | data[i + 1]!;
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str;
  }
  if (encoding === 0x03) {
    // UTF-8 in ID3v2.4
    return new TextDecoder("utf-8").decode(data).replace(/\0+$/, "");
  }
  // Latin-1 fallback
  let str = "";
  for (let i = 0; i < data.length; i += 1) {
    const code = data[i]!;
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

/**
 * Re-encodes an `AudioBuffer` into a target format.
 *
 * The browser's `AudioContext` does not expose a public encoder, so
 * the surfaces re-use the platform's native `MediaRecorder` where
 * the target format is supported (webm/ogg), and falls back to a
 * passthrough for `wav` (a no-op that re-wraps the source bytes).
 * For `mp3`, `flac` and `aac` the function returns a copy of the
 * original bytes so the file is still downloadable — the surfaces
 * surface a "best-effort" hint in the toast.
 */
export interface EncodeResult {
  /** Encoded audio bytes. */
  bytes: ArrayBuffer;
  /** MIME type the encoder produced. */
  mime: string;
  /** True if the encoder honoured the target format. */
  matched: boolean;
  /** True if the encoder re-wrapped the source rather than re-encoding. */
  passthrough: boolean;
}

/**
 * Re-encodes an `AudioBuffer` using the browser's `MediaRecorder`.
 * Returns `null` when the browser cannot encode the requested
 * format; the surfaces fall back to the source bytes in that case.
 */
export async function encodeAudioBuffer(
  buffer: AudioBuffer,
  target: AudioFormat
): Promise<EncodeResult | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = mediaRecorderCandidatesFor(target);
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const destination = ctx.createMediaStreamDestination();
  source.connect(destination);
  const mime = candidates[0];
  if (!mime) return null;
  const recorder = new MediaRecorder(destination.stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  });
  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener("stop", () => resolve());
  });
  recorder.start();
  source.start();
  await new Promise<void>((resolve) => source.addEventListener("ended", () => resolve(), { once: true }));
  recorder.stop();
  await stopped;
  const blob = new Blob(chunks, { type: mime });
  const bytes = await blob.arrayBuffer();
  return { bytes, mime, matched: true, passthrough: false };
}

function mediaRecorderCandidatesFor(target: AudioFormat): string[] {
  if (typeof MediaRecorder === "undefined") return [];
  const isSupported = (mime: string) => {
    try {
      return MediaRecorder.isTypeSupported(mime);
    } catch {
      return false;
    }
  };
  const map: Record<AudioFormat, string[]> = {
    mp3: ["audio/mpeg", "audio/mp3"],
    wav: ["audio/wav", "audio/wave"],
    ogg: ["audio/ogg;codecs=opus", "audio/ogg"],
    flac: ["audio/flac"],
    aac: ["audio/aac", "audio/mp4;codecs=mp4a.40.2"],
  };
  return map[target].filter((mime) => isSupported(mime));
}

/**
 * Re-encodes a source data URL to a target format.
 *
 * The helper combines the decode + re-encode pipeline so the
 * converter surface has a single call to make. If the browser
 * cannot encode the target, the source bytes are returned
 * untouched and `matched` is `false` so the surface can
 * surface a "best-effort" message in the toast.
 */
export async function convertDataUrl(
  dataUrl: string,
  target: AudioFormat
): Promise<EncodeResult> {
  const decoded = await decodeDataUrl(dataUrl);
  if (!decoded) {
    return {
      bytes: new ArrayBuffer(0),
      mime: mimeForFormat(target),
      matched: false,
      passthrough: true,
    };
  }
  if (decoded.format === target) {
    return {
      bytes: decoded.buffer,
      mime: mimeForFormat(target),
      matched: true,
      passthrough: true,
    };
  }
  const encoded = await encodeAudioBuffer(decoded.audioBuffer, target);
  if (!encoded) {
    return {
      bytes: decoded.buffer,
      mime: mimeForFormat(decoded.format),
      matched: false,
      passthrough: true,
    };
  }
  return encoded;
}

/**
 * Decodes a File picked from an `<input type="file">` into the
 * shape the surfaces need. The helper is the only place the
 * `File` API is touched, so the rest of the workspace stays
 * platform-agnostic.
 */
export async function loadAudioFile(file: File): Promise<{
  dataUrl: string;
  format: AudioFormat;
  fileName: string;
  decoded: DecodedAudio;
} | null> {
  if (!file) return null;
  const dataUrl = await blobToDataUrl(file);
  const decoded = await decodeDataUrl(dataUrl);
  if (!decoded) return null;
  return {
    dataUrl,
    format: guessAudioFormat(file.type, file.name),
    fileName: file.name,
    decoded,
  };
}

/**
 * Trims an `AudioBuffer` between two timestamps. The implementation
 * is sample-accurate: it walks the source samples and copies the
 * range into a fresh `AudioBuffer` whose `sampleRate` matches the
 * source. The function returns the trimmed `AudioBuffer` and the
 * caller encodes it to the target format.
 */
export function trimAudioBuffer(
  buffer: AudioBuffer,
  startSeconds: number,
  endSeconds: number
): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = buffer.sampleRate;
  const start = Math.max(0, Math.min(buffer.duration, startSeconds));
  const end = Math.max(start, Math.min(buffer.duration, endSeconds));
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(
    buffer.length,
    Math.max(startSample, Math.floor(end * sampleRate))
  );
  const length = Math.max(1, endSample - startSample);
  const trimmed = ctx.createBuffer(
    buffer.numberOfChannels,
    length,
    sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const source = buffer.getChannelData(ch).subarray(startSample, endSample);
    const target = trimmed.getChannelData(ch);
    target.set(source);
  }
  return trimmed;
}

/** Generates a short random id for in-memory op ids. */
export function shortId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
