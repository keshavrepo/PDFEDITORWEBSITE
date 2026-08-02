"use client";

/**
 * Audio Player — AudioPilot surface.
 *
 * Loads a single audio file (MP3, WAV, OGG, FLAC, AAC), decodes it
 * through the platform's `AudioContext`, paints a waveform preview
 * from the decoded samples, and gives the user the full set of
 * professional transport controls: play, pause, stop, seek, volume,
 * mute, playback speed, loop, current time, duration.
 *
 * Reuses the same IndexedDB-backed session body every other
 * AudioPilot surface uses, so the player state survives a reload.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FileAudio,
  FileUp,
  Repeat,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asPlayerBody,
  computeWaveformPeaks,
  decodeDataUrl,
  DEFAULT_WAVEFORM_BUCKETS,
  formatAudioDuration,
  loadAudioFile,
  mimeForFormat,
  parseDataUrl,
  shortId,
  toDataUrl,
  type AudioFormat,
} from "@/lib/audiopilot";
import type {
  AudioPlayerBody,
  AudioSession,
} from "@/lib/audiopilot";
import {
  SpeedPicker,
  TransportControls,
  VolumeSlider,
} from "./shared/transport";

interface AudioPlayerSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AudioPlayerSurface({
  session,
  onChange,
}: AudioPlayerSurfaceProps) {
  const body = asPlayerBody(session.body);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(body.currentTimeSeconds);
  const [duration, setDuration] = useState(body.durationSeconds);
  const [importing, setImporting] = useState(false);
  const [decoding, setDecoding] = useState(false);

  /** Persists a new body on the session. */
  const commit = useCallback(
    (next: AudioPlayerBody) => {
      onChange({ ...session, body: next });
    },
    [onChange, session]
  );

  /** Loads a file from the file input. */
  const handleFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const loaded = await loadAudioFile(file);
        if (!loaded) {
          toast({
            message:
              "That file could not be decoded. Try MP3, WAV, OGG, FLAC or AAC.",
            tone: "error",
          });
          return;
        }
        const peaks = computeWaveformPeaks(
          loaded.decoded.audioBuffer,
          DEFAULT_WAVEFORM_BUCKETS
        );
        const next: AudioPlayerBody = {
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          artist: body.artist,
          trackTitle: body.trackTitle || loaded.fileName,
          album: body.album,
          durationSeconds: loaded.decoded.duration,
          waveformBuckets: peaks.length,
          waveform: peaks,
          playbackSpeed: body.playbackSpeed || 1,
          volume: body.volume ?? 0.8,
          muted: body.muted ?? false,
          loop: body.loop ?? false,
          currentTimeSeconds: 0,
          isFavorite: body.isFavorite,
        };
        commit(next);
        toast({
          message: `Imported ${loaded.fileName} (${formatAudioDuration(
            loaded.decoded.duration
          )})`,
          tone: "success",
        });
      } finally {
        setImporting(false);
      }
    },
    [body, commit, toast]
  );

  /** Handles the file input change. */
  const onFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) await handleFile(file);
      event.target.value = "";
    },
    [handleFile]
  );

  /** Updates a single field. */
  const updateField = useCallback(
    <K extends keyof AudioPlayerBody>(field: K, value: AudioPlayerBody[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Plays or pauses the active audio. */
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => {
        toast({ message: "Could not start playback.", tone: "error" });
      });
    } else {
      audio.pause();
    }
  }, [toast]);

  /** Stops the active audio and rewinds to 0. */
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
  }, []);

  /** Resets the playhead to the start without stopping. */
  const reset = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  }, []);

  /** Seeks by `delta` seconds. */
  const seekBy = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.duration || 0, audio.currentTime + delta)
    );
  }, []);

  /** Syncs the audio element with the body. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = body.muted ? 0 : body.volume;
    audio.playbackRate = body.playbackSpeed;
    audio.loop = body.loop;
  }, [body.muted, body.volume, body.playbackSpeed, body.loop]);

  /** Subscribes to the audio element's lifecycle. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onPlay() {
      setIsPlaying(true);
    }
    function onPause() {
      setIsPlaying(false);
    }
    function onTime() {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    }
    function onMeta() {
      if (audioRef.current) setDuration(audioRef.current.duration || 0);
    }
    function onEnded() {
      setIsPlaying(false);
    }
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  /** Persists the current playhead back into the body every second. */
  useEffect(() => {
    if (!body.sourceDataUrl) return;
    const id = window.setTimeout(() => {
      if (Math.abs(currentTime - body.currentTimeSeconds) > 0.5) {
        commit({ ...body, currentTimeSeconds: currentTime });
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [body, commit, currentTime]);

  /** Keyboard shortcuts on the player. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [role='textbox']")) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekBy(-5);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        seekBy(5);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        reset();
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        const audio = audioRef.current;
        if (audio) audio.currentTime = audio.duration || 0;
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reset, seekBy, togglePlay]);

  /** Decodes the data URL on demand so the duration is correct. */
  useEffect(() => {
    if (!body.sourceDataUrl) return;
    if (duration > 0 && Math.abs(duration - body.durationSeconds) < 0.01) {
      return;
    }
    let cancelled = false;
    (async () => {
      setDecoding(true);
      try {
        const decoded = await decodeDataUrl(body.sourceDataUrl);
        if (cancelled) return;
        if (decoded) setDuration(decoded.duration);
      } finally {
        if (!cancelled) setDecoding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [body.sourceDataUrl, body.durationSeconds, duration]);

  /** When the user changes the source, the cached peaks are re-built. */
  useEffect(() => {
    if (!body.sourceDataUrl) return;
    if (body.waveform.length > 0) return;
    let cancelled = false;
    (async () => {
      const decoded = await decodeDataUrl(body.sourceDataUrl);
      if (cancelled || !decoded) return;
      const peaks = computeWaveformPeaks(
        decoded.audioBuffer,
        DEFAULT_WAVEFORM_BUCKETS
      );
      commit({
        ...body,
        durationSeconds: decoded.duration,
        waveform: peaks,
        waveformBuckets: peaks.length,
      });
    })();
    return () => {
      cancelled = true;
    };
    // We only want to recompute when the source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.sourceDataUrl]);

  /** Sets the audio source's `currentTime` from a click on the waveform. */
  const handleWaveformSeek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || duration <= 0) return;
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      audio.currentTime = Math.max(0, Math.min(duration, ratio * duration));
    },
    [duration]
  );

  const hasSource = body.sourceDataUrl.length > 0;
  const mime = hasSource ? parseDataUrl(body.sourceDataUrl)?.mime ?? mimeForFormat(body.sourceFormat) : undefined;
  const sourceLabel = body.fileName || "Untitled audio";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FileAudio className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {sourceLabel}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} · {formatAudioDuration(duration || body.durationSeconds)} · {body.waveform.length} buckets
            </p>
          </div>
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={onFileInput}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              {importing ? "Importing…" : "Import audio"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => updateField("isFavorite", !body.isFavorite)}
              aria-label={body.isFavorite ? "Unfavourite" : "Favourite"}
            >
              <Star
                className={
                  body.isFavorite
                    ? "h-3.5 w-3.5 fill-primary text-primary"
                    : "h-3.5 w-3.5"
                }
                aria-hidden="true"
              />
            </Button>
            {hasSource && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  commit({
                    ...DEFAULT_BODY_RESET,
                    isFavorite: body.isFavorite,
                  });
                  setCurrentTime(0);
                  setDuration(0);
                }}
                aria-label="Clear audio"
                title="Clear audio"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <WaveformCanvas
          waveform={body.waveform}
          progress={duration > 0 ? currentTime / duration : 0}
          onSeek={handleWaveformSeek}
          disabled={!hasSource}
          isDecoding={decoding}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <TransportControls
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onStop={stop}
            onReset={reset}
            showReset
            disabled={!hasSource}
          />
          <span className="tabular-nums text-xs font-medium">
            {formatAudioDuration(currentTime)} / {formatAudioDuration(duration || body.durationSeconds)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <VolumeSlider
              volume={body.volume}
              muted={body.muted}
              onVolumeChange={(v) => updateField("volume", v)}
              onMuteToggle={() => updateField("muted", !body.muted)}
              disabled={!hasSource}
            />
            <button
              type="button"
              onClick={() => updateField("loop", !body.loop)}
              className={
                body.loop
                  ? "inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"
                  : "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              }
              aria-pressed={body.loop}
              aria-label={body.loop ? "Disable loop" : "Enable loop"}
            >
              <Repeat className="h-3 w-3" aria-hidden="true" />
              Loop
            </button>
            <SpeedPicker
              value={body.playbackSpeed}
              onChange={(v) => updateField("playbackSpeed", v)}
              disabled={!hasSource}
            />
          </div>
        </div>

        {hasSource && (
          <audio
            ref={audioRef}
            src={body.sourceDataUrl}
            preload="metadata"
            className="sr-only"
          >
            {mime ? <source src={body.sourceDataUrl} type={mime} /> : null}
          </audio>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Metadata</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Title"
            value={body.trackTitle}
            onChange={(v) => updateField("trackTitle", v)}
            placeholder="Track title"
          />
          <Field
            label="Artist"
            value={body.artist}
            onChange={(v) => updateField("artist", v)}
            placeholder="Artist"
          />
          <Field
            label="Album"
            value={body.album}
            onChange={(v) => updateField("album", v)}
            placeholder="Album"
          />
          <Field
            label="File name"
            value={body.fileName}
            readOnly
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden="true" />
          The player reads the format, duration, sample rate and channels
          from the decoded buffer. The metadata fields are stored on the
          session body so they survive a reload.
        </p>
      </Card>
    </div>
  );
}

const DEFAULT_BODY_RESET: AudioPlayerBody = {
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

interface WaveformCanvasProps {
  waveform: { index: number; peak: number }[];
  progress: number;
  onSeek: (event: React.MouseEvent<HTMLDivElement>) => void;
  disabled: boolean;
  isDecoding: boolean;
}

function WaveformCanvas({
  waveform,
  progress,
  onSeek,
  disabled,
  isDecoding,
}: WaveformCanvasProps) {
  const height = 96;
  const bars = useMemo(() => {
    if (waveform.length === 0) return null;
    return waveform.map((point) => point.peak);
  }, [waveform]);
  if (!bars || bars.length === 0) {
    return (
      <div
        className={
          "flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[11px] text-muted-foreground " +
          (disabled ? "" : "cursor-pointer")
        }
        onClick={disabled ? undefined : onSeek}
      >
        {isDecoding
          ? "Decoding audio…"
          : disabled
            ? "Import an audio file to render the waveform"
            : "Click to seek"}
      </div>
    );
  }
  return (
    <div
      className="relative h-24 cursor-pointer overflow-hidden rounded-md border border-border bg-muted/30"
      onClick={onSeek}
      role="slider"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Waveform"
      tabIndex={0}
    >
      <div className="flex h-full items-end gap-[1px] px-1">
        {bars.map((peak, index) => {
          const barProgress = (index + 0.5) / bars.length;
          const past = barProgress <= progress;
          const h = Math.max(2, Math.round(peak * (height - 8)));
          return (
            <div
              key={index}
              className={
                past
                  ? "flex-1 rounded-sm bg-primary"
                  : "flex-1 rounded-sm bg-muted-foreground/50"
              }
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

function Field({ label, value, onChange, placeholder, readOnly }: FieldProps) {
  return (
    <label className="block text-[11px] font-medium text-muted-foreground">
      {label}
      <Input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="mt-1 h-8 text-xs"
      />
    </label>
  );
}
