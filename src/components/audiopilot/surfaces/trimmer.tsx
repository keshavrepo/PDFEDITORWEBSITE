"use client";

/**
 * Audio Trimmer — AudioPilot surface.
 *
 * Loads a single audio file, lets the user set a trim start and
 * trim end on a waveform preview, switch between fine and coarse
 * precision, preview the trimmed range, undo / redo every change
 * and export the result to the same source format.
 *
 * The trimmer keeps a per-session undo / redo stack so every
 * adjustment is reversible. The export uses the source format
 * (or the closest available `MediaRecorder` mime) so the file the
 * user downloads is a faithful copy of the trimmed range.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  FileUp,
  Pause,
  Play,
  Redo2,
  Scissors,
  Square,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asTrimmerBody,
  computeWaveformPeaks,
  decodeDataUrl,
  DEFAULT_WAVEFORM_BUCKETS,
  encodeAudioBuffer,
  formatAudioDuration,
  loadAudioFile,
  mimeForFormat,
  parseDataUrl,
  shortId,
  toDataUrl,
  trimAudioBuffer,
  type AudioFormat,
} from "@/lib/audiopilot";
import type {
  AudioSession,
  AudioTrimmerBody,
} from "@/lib/audiopilot";

interface AudioTrimmerSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const PRECISIONS = [0.01, 0.05, 0.1];

export function AudioTrimmerSurface({
  session,
  onChange,
}: AudioTrimmerSurfaceProps) {
  const body = asTrimmerBody(session.body);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [decoding, setDecoding] = useState(false);

  const commit = useCallback(
    (next: AudioTrimmerBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioTrimmerBody>(field: K, value: AudioTrimmerBody[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Handles the file input change. */
  const onFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      setDecoding(true);
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
        const next: AudioTrimmerBody = {
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          durationSeconds: loaded.decoded.duration,
          startSeconds: 0,
          endSeconds: loaded.decoded.duration,
          precision: body.precision || 0.05,
          history: [],
          historyIndex: -1,
          lastExportDataUrl: "",
          lastExportFormat: loaded.format,
          lastExportAt: "",
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
        setDecoding(false);
      }
    },
    [body.isFavorite, body.precision, commit, toast]
  );

  /** Pushes a new entry onto the undo / redo stack. */
  const recordOp = useCallback(
    (start: number, end: number) => {
      const op = {
        id: shortId("op"),
        startSeconds: start,
        endSeconds: end,
        appliedAt: new Date().toISOString(),
      };
      // Truncate the redo branch.
      const truncated = body.history.slice(0, body.historyIndex + 1);
      const nextHistory = [...truncated, op].slice(-100);
      commit({
        ...body,
        startSeconds: start,
        endSeconds: end,
        history: nextHistory,
        historyIndex: nextHistory.length - 1,
      });
    },
    [body, commit]
  );

  /** Updates start or end. */
  const updateRange = useCallback(
    (field: "startSeconds" | "endSeconds", value: number) => {
      const nextStart = field === "startSeconds" ? value : body.startSeconds;
      const nextEnd = field === "endSeconds" ? value : body.endSeconds;
      const safeStart = Math.max(
        0,
        Math.min(body.durationSeconds, nextStart)
      );
      const safeEnd = Math.max(safeStart, Math.min(body.durationSeconds, nextEnd));
      commit({
        ...body,
        startSeconds: safeStart,
        endSeconds: safeEnd,
      });
    },
    [body, commit]
  );

  /** Undo. */
  const undo = useCallback(() => {
    if (body.historyIndex <= 0) {
      toast({ message: "Nothing to undo.", tone: "info" });
      return;
    }
    const previous = body.history[body.historyIndex - 1];
    if (!previous) return;
    commit({
      ...body,
      startSeconds: previous.startSeconds,
      endSeconds: previous.endSeconds,
      historyIndex: body.historyIndex - 1,
    });
  }, [body, commit, toast]);

  /** Redo. */
  const redo = useCallback(() => {
    if (body.historyIndex >= body.history.length - 1) {
      toast({ message: "Nothing to redo.", tone: "info" });
      return;
    }
    const next = body.history[body.historyIndex + 1];
    if (!next) return;
    commit({
      ...body,
      startSeconds: next.startSeconds,
      endSeconds: next.endSeconds,
      historyIndex: body.historyIndex + 1,
    });
  }, [body, commit, toast]);

  /** Commit the current range as a history entry. */
  const commitRange = useCallback(() => {
    recordOp(body.startSeconds, body.endSeconds);
    toast({
      message: "Saved the trim range to the history stack.",
      tone: "info",
    });
  }, [body.endSeconds, body.startSeconds, recordOp, toast]);

  /** Reset. */
  const reset = useCallback(() => {
    if (!body.sourceDataUrl) return;
    commit({
      ...body,
      startSeconds: 0,
      endSeconds: body.durationSeconds,
      history: [],
      historyIndex: -1,
    });
  }, [body, commit]);

  /** Toggle play on the main source. */
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

  /** Stop. */
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
  }, []);

  /** Preview the trimmed range. */
  const previewRange = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    try {
      const decoded = await decodeDataUrl(body.sourceDataUrl);
      if (!decoded) {
        toast({
          message: "Could not decode the source for preview.",
          tone: "error",
        });
        return;
      }
      const trimmed = trimAudioBuffer(
        decoded.audioBuffer,
        body.startSeconds,
        body.endSeconds
      );
      const encoded = await encodeAudioBuffer(
        trimmed,
        decoded.format
      );
      if (!encoded) {
        toast({
          message: "Preview is not supported in this browser.",
          tone: "error",
        });
        return;
      }
      const blob = new Blob([encoded.bytes], { type: encoded.mime });
      const url = URL.createObjectURL(blob);
      const preview = previewAudioRef.current;
      if (!preview) {
        URL.revokeObjectURL(url);
        return;
      }
      preview.src = url;
      preview.currentTime = 0;
      await preview.play().catch(() => {
        toast({ message: "Could not start preview.", tone: "error" });
      });
    } catch {
      toast({ message: "Preview failed.", tone: "error" });
    }
  }, [body.sourceDataUrl, body.startSeconds, body.endSeconds, toast]);

  /** Export the trimmed range as a downloadable file. */
  const exportTrimmed = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    setIsExporting(true);
    try {
      const decoded = await decodeDataUrl(body.sourceDataUrl);
      if (!decoded) {
        toast({
          message: "Could not decode the source for export.",
          tone: "error",
        });
        return;
      }
      const trimmed = trimAudioBuffer(
        decoded.audioBuffer,
        body.startSeconds,
        body.endSeconds
      );
      const target: AudioFormat =
        decoded.format === body.sourceFormat
          ? body.sourceFormat
          : body.sourceFormat;
      const encoded = await encodeAudioBuffer(trimmed, target);
      const dataUrl = encoded
        ? toDataUrl(encoded.bytes, encoded.mime)
        : body.sourceDataUrl;
      const mime = encoded ? encoded.mime : mimeForFormat(body.sourceFormat);
      const ext = mime.split("/")[1]?.split(";")[0] || body.sourceFormat;
      const safeName = body.fileName.replace(/\.[^.]+$/, "");
      const downloadName = `${safeName || "trimmed"}-${Math.round(
        body.startSeconds
      )}-${Math.round(body.endSeconds)}.${ext}`;
      const link = window.document.createElement("a");
      link.href = dataUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      commit({
        ...body,
        lastExportDataUrl: dataUrl,
        lastExportFormat: body.sourceFormat,
        lastExportAt: new Date().toISOString(),
      });
      toast({
        message: `Exported ${downloadName}`,
        tone: "success",
      });
    } catch {
      toast({ message: "Export failed.", tone: "error" });
    } finally {
      setIsExporting(false);
    }
  }, [body, commit, toast]);

  /** Subscribes to the source audio element. */
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
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
    };
  }, []);

  /** Decodes the data URL on demand so the duration is correct. */
  useEffect(() => {
    if (!body.sourceDataUrl) return;
    if (body.durationSeconds > 0) return;
    let cancelled = false;
    (async () => {
      setDecoding(true);
      try {
        const decoded = await decodeDataUrl(body.sourceDataUrl);
        if (cancelled || !decoded) return;
        commit({
          ...body,
          durationSeconds: decoded.duration,
          endSeconds: decoded.duration,
        });
      } finally {
        if (!cancelled) setDecoding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.sourceDataUrl]);

  const hasSource = body.sourceDataUrl.length > 0;
  const startRatio =
    body.durationSeconds > 0 ? body.startSeconds / body.durationSeconds : 0;
  const endRatio =
    body.durationSeconds > 0 ? body.endSeconds / body.durationSeconds : 0;
  const trimmedDuration = body.endSeconds - body.startSeconds;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Scissors className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {body.fileName || "Untitled audio"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} · source {formatAudioDuration(body.durationSeconds)} · trim {formatAudioDuration(trimmedDuration)}
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
              disabled={decoding}
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              {decoding ? "Importing…" : "Import audio"}
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
                onClick={reset}
                aria-label="Reset"
                title="Reset"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <TrimCanvas
          sourceUrl={body.sourceDataUrl}
          startRatio={startRatio}
          endRatio={endRatio}
          currentRatio={
            body.durationSeconds > 0 ? currentTime / body.durationSeconds : 0
          }
          onStartChange={(ratio) => {
            const seconds = Math.max(
              0,
              Math.min(body.durationSeconds, ratio * body.durationSeconds)
            );
            updateRange("startSeconds", roundToPrecision(seconds, body.precision));
          }}
          onEndChange={(ratio) => {
            const seconds = Math.max(
              0,
              Math.min(body.durationSeconds, ratio * body.durationSeconds)
            );
            updateRange("endSeconds", roundToPrecision(seconds, body.precision));
          }}
          onSeek={(ratio) => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.currentTime = Math.max(
              0,
              Math.min(audio.duration || 0, ratio * (audio.duration || 0))
            );
          }}
          disabled={!hasSource}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={togglePlay}
            disabled={!hasSource}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8"
            onClick={stop}
            disabled={!hasSource}
            aria-label="Stop"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={previewRange}
            disabled={!hasSource}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Preview trim
          </Button>
          <span className="tabular-nums text-xs font-medium">
            {formatAudioDuration(currentTime)} / {formatAudioDuration(body.durationSeconds)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8"
              onClick={undo}
              disabled={body.historyIndex <= 0}
              aria-label="Undo"
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8"
              onClick={redo}
              disabled={body.historyIndex >= body.history.length - 1}
              aria-label="Redo"
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={commitRange}
              disabled={!hasSource}
            >
              Commit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={exportTrimmed}
              disabled={!hasSource || isExporting}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {isExporting ? "Exporting…" : "Export"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Trim handles</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Start (s)"
            value={body.startSeconds}
            onChange={(v) => updateRange("startSeconds", v)}
            min={0}
            max={body.durationSeconds}
            step={body.precision}
            disabled={!hasSource}
          />
          <NumberField
            label="End (s)"
            value={body.endSeconds}
            onChange={(v) => updateRange("endSeconds", v)}
            min={0}
            max={body.durationSeconds}
            step={body.precision}
            disabled={!hasSource}
          />
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">
              Precision
            </label>
            <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
              {PRECISIONS.map((precision) => (
                <button
                  key={precision}
                  type="button"
                  onClick={() => updateField("precision", precision)}
                  className={
                    body.precision === precision
                      ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                      : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  }
                >
                  {precision}s
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          History stack: {body.history.length} entries · pointer at{" "}
          {body.historyIndex + 1}.
        </p>
      </Card>

      {hasSource && (
        <>
          <audio
            ref={audioRef}
            src={body.sourceDataUrl}
            preload="metadata"
            className="sr-only"
          />
          <audio
            ref={previewAudioRef}
            preload="auto"
            className="sr-only"
            onEnded={() => setIsPlaying(false)}
          />
        </>
      )}
    </div>
  );
}

const DEFAULT_BODY_RESET: AudioTrimmerBody = {
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

/** Rounds a number to the closest multiple of `precision`. */
function roundToPrecision(value: number, precision: number): number {
  if (precision <= 0) return value;
  return Math.round(value / precision) * precision;
}

interface TrimCanvasProps {
  sourceUrl: string;
  startRatio: number;
  endRatio: number;
  currentRatio: number;
  onStartChange: (ratio: number) => void;
  onEndChange: (ratio: number) => void;
  onSeek: (ratio: number) => void;
  disabled: boolean;
}

function TrimCanvas({
  sourceUrl,
  startRatio,
  endRatio,
  currentRatio,
  onStartChange,
  onEndChange,
  onSeek,
  disabled,
}: TrimCanvasProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<"start" | "end" | null>(null);

  useEffect(() => {
    if (!sourceUrl) {
      // Empty source — clear synchronously so the canvas can show
      // the empty state without an extra render pass.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeaks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const decoded = await decodeDataUrl(sourceUrl);
      if (cancelled || !decoded) return;
      const points = computeWaveformPeaks(
        decoded.audioBuffer,
        DEFAULT_WAVEFORM_BUCKETS
      );
      if (cancelled) return;
      setPeaks(points.map((point) => point.peak));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (disabled) return;
    function onMove(event: MouseEvent | TouchEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clientX =
        "touches" in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (dragging.current === "start") onStartChange(ratio);
      else if (dragging.current === "end") onEndChange(ratio);
    }
    function onUp() {
      dragging.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    }
    if (dragging.current) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("touchmove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchend", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [disabled, onEndChange, onStartChange]);

  const onBarClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      onSeek(ratio);
    },
    [disabled, onSeek]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-24 select-none overflow-hidden rounded-md border border-border bg-muted/30"
      onClick={onBarClick}
    >
      {peaks.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
          {loading
            ? "Decoding audio…"
            : disabled
              ? "Import an audio file to enable trimming"
              : "Click to seek"}
        </div>
      ) : (
        <div className="flex h-full items-end gap-[1px] px-1">
          {peaks.map((peak, index) => {
            const r = (index + 0.5) / peaks.length;
            const inRange = r >= startRatio && r <= endRatio;
            const h = Math.max(2, Math.round(peak * 88));
            return (
              <div
                key={index}
                className={
                  inRange
                    ? "flex-1 rounded-sm bg-primary"
                    : "flex-1 rounded-sm bg-muted-foreground/40"
                }
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
      )}
      {/* Selection overlay. */}
      <div
        className="pointer-events-none absolute inset-y-0 border-l-2 border-r-2 border-primary"
        style={{
          left: `${startRatio * 100}%`,
          right: `${(1 - endRatio) * 100}%`,
          background:
            "linear-gradient(180deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0.18) 100%)",
        }}
      />
      {/* Start handle. */}
      <div
        className={
          "absolute inset-y-0 w-3 cursor-ew-resize " +
          (disabled ? "pointer-events-none opacity-50" : "")
        }
        style={{ left: `calc(${startRatio * 100}% - 6px)` }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!disabled) dragging.current = "start";
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (!disabled) dragging.current = "start";
        }}
        role="slider"
        aria-valuenow={Math.round(startRatio * 100)}
        aria-valuemin={0}
        aria-valuemax={Math.round(endRatio * 100)}
        aria-label="Trim start"
        tabIndex={disabled ? -1 : 0}
      >
        <div className="mx-auto mt-0 h-full w-1 rounded bg-primary" />
      </div>
      {/* End handle. */}
      <div
        className={
          "absolute inset-y-0 w-3 cursor-ew-resize " +
          (disabled ? "pointer-events-none opacity-50" : "")
        }
        style={{ left: `calc(${endRatio * 100}% - 6px)` }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!disabled) dragging.current = "end";
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (!disabled) dragging.current = "end";
        }}
        role="slider"
        aria-valuenow={Math.round(endRatio * 100)}
        aria-valuemin={Math.round(startRatio * 100)}
        aria-valuemax={100}
        aria-label="Trim end"
        tabIndex={disabled ? -1 : 0}
      >
        <div className="mx-auto mt-0 h-full w-1 rounded bg-primary" />
      </div>
      {/* Playhead. */}
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
        style={{ left: `${currentRatio * 100}%` }}
      />
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: NumberFieldProps) {
  return (
    <label className="block text-[11px] font-medium text-muted-foreground">
      {label}
      <Input
        type="number"
        value={Number.isFinite(value) ? value.toString() : ""}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(Math.max(min, Math.min(max, next)));
          }
        }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="mt-1 h-8 text-xs"
      />
    </label>
  );
}
