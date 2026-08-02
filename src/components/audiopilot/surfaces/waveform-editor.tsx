"use client";

/**
 * Waveform Editor — AudioPilot surface.
 *
 * Renders a high-resolution waveform for the active source,
 * supports zoom in / out, horizontal scroll, a timeline ruler,
 * a click-and-drag selection, a playback cursor that follows
 * the audio and user-placed region markers.
 *
 * The editor reuses the same IndexedDB store every other
 * surface uses, so the source, the zoom level, the scroll
 * offset, the selection and the markers all survive a reload.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Crosshair,
  FileUp,
  MapPin,
  Pause,
  Play,
  Plus,
  Star,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asWaveformEditorBody,
  clampZoom,
  computeHighResWaveform,
  describeZoom,
  formatAudioDuration,
  formatTimecode,
  generateRegionMarkerId,
  loadAudioFile,
  regionMarkerColor,
  rulerStepForZoom,
  type AudioRegionMarker,
} from "@/lib/audiopilot";
import type {
  AudioSession,
  AudioWaveformEditorBody,
} from "@/lib/audiopilot";

interface AudioWaveformEditorSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 16;

export function AudioWaveformEditorSurface({
  session,
  onChange,
}: AudioWaveformEditorSurfaceProps) {
  const body = asWaveformEditorBody(session.body);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [importing, setImporting] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(body.cursorSeconds);

  const commit = useCallback(
    (next: AudioWaveformEditorBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioWaveformEditorBody>(
      field: K,
      value: AudioWaveformEditorBody[K]
    ) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Handles the file input. */
  const onFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      setImporting(true);
      try {
        const loaded = await loadAudioFile(file);
        if (!loaded) {
          toast({
            message: "That file could not be decoded.",
            tone: "error",
          });
          return;
        }
        const peaks = await computeHighResWaveform(
          loaded.dataUrl,
          body.zoom || 1
        );
        const next: AudioWaveformEditorBody = {
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          durationSeconds: loaded.decoded.duration,
          bucketCount: peaks?.peaks.length ?? 0,
          waveform: peaks?.peaks ?? [],
          zoom: body.zoom || 1,
          scrollSeconds: 0,
          selection: null,
          markers: [],
          cursorSeconds: 0,
          isPlaying: false,
          rulerStepSeconds: rulerStepForZoom(body.zoom || 1),
          isFavorite: body.isFavorite,
        };
        commit(next);
        setCurrentTime(0);
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
    [body.isFavorite, body.zoom, commit, toast]
  );

  /** Recomputes the high-res waveform at the new zoom level. */
  useEffect(() => {
    if (!body.sourceDataUrl) return;
    let cancelled = false;
    (async () => {
      setDecoding(true);
      try {
        const result = await computeHighResWaveform(
          body.sourceDataUrl,
          body.zoom
        );
        if (cancelled || !result) return;
        commit({
          ...body,
          bucketCount: result.peaks.length,
          waveform: result.peaks,
          rulerStepSeconds: rulerStepForZoom(body.zoom),
        });
      } finally {
        if (!cancelled) setDecoding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // We only want to recompute when the source or the zoom changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.sourceDataUrl, body.zoom]);

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
      if (audioRef.current) {
        const t = audioRef.current.currentTime;
        setCurrentTime(t);
        if (Math.abs(t - body.cursorSeconds) > 0.25) {
          commit({ ...body, cursorSeconds: t });
        }
      }
    }
    function onEnded() {
      setIsPlaying(false);
    }
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Toggle play. */
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

  /** Sets the audio source's `currentTime` from a click on the waveform. */
  const handleWaveformClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || body.durationSeconds <= 0) return;
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const time = Math.max(0, Math.min(body.durationSeconds, ratio * body.durationSeconds));
      audio.currentTime = time;
      setCurrentTime(time);
    },
    [body.durationSeconds]
  );

  /** Computes the visible window. The canvas paints the full
   * waveform but the horizontal scroll keeps the active zoom
   * centred on the playhead. */
  const visibleStart = body.scrollSeconds;
  const visibleEnd = Math.min(
    body.durationSeconds,
    visibleStart + body.durationSeconds / body.zoom
  );
  const visibleDuration = Math.max(0.001, visibleEnd - visibleStart);

  /** Builds the ruler ticks. */
  const rulerTicks = useMemo(() => {
    if (body.durationSeconds <= 0) return [] as number[];
    const step = body.rulerStepSeconds || 1;
    const startTick = Math.floor(visibleStart / step) * step;
    const ticks: number[] = [];
    for (let t = startTick; t <= visibleEnd + 0.0001; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [body.durationSeconds, body.rulerStepSeconds, visibleStart, visibleEnd]);

  /** Builds the marker positions for the visible window. */
  const visibleMarkers = useMemo(
    () =>
      body.markers
        .filter(
          (m) => m.timeSeconds >= visibleStart && m.timeSeconds <= visibleEnd
        )
        .sort((a, b) => a.timeSeconds - b.timeSeconds),
    [body.markers, visibleStart, visibleEnd]
  );

  /** Sets the selection on a click. */
  const handleSetSelection = useCallback(
    (start: number, end: number) => {
      const safeStart = Math.max(0, Math.min(body.durationSeconds, start));
      const safeEnd = Math.max(safeStart, Math.min(body.durationSeconds, end));
      if (safeEnd <= safeStart) {
        updateField("selection", null);
        return;
      }
      updateField("selection", { startSeconds: safeStart, endSeconds: safeEnd });
    },
    [body.durationSeconds, updateField]
  );

  /** Adds a region marker at the current playhead. */
  const addMarkerAtPlayhead = useCallback(
    (label: string) => {
      const marker: AudioRegionMarker = {
        id: generateRegionMarkerId(),
        label: label.trim() || `Marker ${body.markers.length + 1}`,
        timeSeconds: currentTime,
        color: regionMarkerColor(body.markers.length),
      };
      commit({ ...body, markers: [...body.markers, marker] });
    },
    [body, commit, currentTime]
  );

  /** Removes a region marker. */
  const removeMarker = useCallback(
    (id: string) => {
      commit({
        ...body,
        markers: body.markers.filter((m) => m.id !== id),
      });
    },
    [body, commit]
  );

  /** Updates the zoom. */
  const setZoom = useCallback(
    (zoom: number) => {
      const next = clampZoom(zoom);
      updateField("zoom", next);
      // Keep the playhead centred on the new visible window.
      const audio = audioRef.current;
      if (audio && body.durationSeconds > 0) {
        const visibleLen = body.durationSeconds / next;
        const desired = Math.max(
          0,
          Math.min(
            body.durationSeconds - visibleLen,
            audio.currentTime - visibleLen / 2
          )
        );
        updateField("scrollSeconds", desired);
      }
    },
    [body.durationSeconds, updateField]
  );

  /** Scrolls the canvas horizontally by a fraction of the visible
   * window. */
  const scrollBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      const visibleLen = body.durationSeconds / body.zoom;
      const max = Math.max(0, body.durationSeconds - visibleLen);
      const next = Math.max(
        0,
        Math.min(max, body.scrollSeconds + deltaSeconds)
      );
      commit({ ...body, scrollSeconds: next });
      if (audio) {
        audio.currentTime = Math.max(
          0,
          Math.min(body.durationSeconds, next + visibleLen / 2)
        );
      }
    },
    [body, commit]
  );

  const hasSource = body.sourceDataUrl.length > 0;
  const selection = body.selection;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Crosshair
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              {body.fileName || "Untitled audio"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} · {formatAudioDuration(body.durationSeconds)} · {body.waveform.length} buckets · {describeZoom(body.zoom)}
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
                    isFavorite: body.isFavorite,
                  });
                  setCurrentTime(0);
                }}
                aria-label="Clear"
                title="Clear"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-8 w-8"
            onClick={togglePlay}
            disabled={!hasSource}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setZoom(body.zoom / 1.5)}
              disabled={body.zoom <= MIN_ZOOM + 0.001}
              className="rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3 w-3" aria-hidden="true" />
            </button>
            <span className="px-1.5 tabular-nums font-medium">
              {describeZoom(body.zoom)}
            </span>
            <button
              type="button"
              onClick={() => setZoom(body.zoom * 1.5)}
              disabled={body.zoom >= MAX_ZOOM - 0.001}
              className="rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          <span className="tabular-nums text-xs font-medium">
            {formatTimecode(currentTime)} / {formatTimecode(body.durationSeconds)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => scrollBy(-visibleDuration * 0.5)}
              disabled={!hasSource}
            >
              ‹‹
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => scrollBy(visibleDuration * 0.5)}
              disabled={!hasSource}
            >
              ››
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => {
                handleSetSelection(currentTime, body.durationSeconds);
              }}
              disabled={!hasSource}
            >
              Select to end
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => updateField("selection", null)}
              disabled={!hasSource}
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Clear selection
            </Button>
          </div>
        </div>

        <WaveformCanvas
          peaks={body.waveform}
          selection={selection}
          markers={visibleMarkers}
          cursor={body.durationSeconds > 0 ? currentTime / body.durationSeconds : 0}
          onClick={handleWaveformClick}
          onSelect={handleSetSelection}
          selectionMode={true}
          durationSeconds={body.durationSeconds}
          visibleStart={visibleStart}
          visibleEnd={visibleEnd}
          isDecoding={decoding}
          disabled={!hasSource}
        />

        <Ruler
          durationSeconds={body.durationSeconds}
          visibleStart={visibleStart}
          visibleEnd={visibleEnd}
          rulerTicks={rulerTicks}
          disabled={!hasSource}
        />
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Region markers</h3>
        {body.markers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No markers yet. Add one at the playhead to label a verse, chorus,
            cue or any other section.
          </p>
        ) : (
          <ul className="space-y-1">
            {body.markers
              .slice()
              .sort((a, b) => a.timeSeconds - b.timeSeconds)
              .map((marker) => (
                <li
                  key={marker.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: marker.color || "#38bdf8" }}
                    aria-hidden="true"
                  />
                  <span className="font-medium">{marker.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimecode(marker.timeSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const audio = audioRef.current;
                      if (audio) {
                        audio.currentTime = marker.timeSeconds;
                        setCurrentTime(marker.timeSeconds);
                      }
                    }}
                    className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Jump to marker"
                  >
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMarker(marker.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Remove marker"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
          </ul>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const label = String(data.get("label") ?? "").trim();
            addMarkerAtPlayhead(label);
            form.reset();
          }}
          className="mt-2 flex items-center gap-2"
        >
          <Input
            name="label"
            placeholder="Marker label"
            className="h-8 max-w-xs text-xs"
            disabled={!hasSource}
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={!hasSource}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add at playhead
          </Button>
        </form>
      </Card>

      {hasSource && (
        <audio
          ref={audioRef}
          src={body.sourceDataUrl}
          preload="metadata"
          className="sr-only"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Waveform canvas                                                            */
/* -------------------------------------------------------------------------- */

interface WaveformCanvasProps {
  peaks: { index: number; peak: number }[];
  selection: { startSeconds: number; endSeconds: number } | null;
  markers: AudioRegionMarker[];
  cursor: number;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSelect: (start: number, end: number) => void;
  selectionMode: boolean;
  durationSeconds: number;
  visibleStart: number;
  visibleEnd: number;
  isDecoding: boolean;
  disabled: boolean;
}

function WaveformCanvas({
  peaks,
  selection,
  markers,
  cursor,
  onClick,
  onSelect,
  durationSeconds,
  visibleStart,
  visibleEnd,
  isDecoding,
  disabled,
}: WaveformCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<"start" | "end" | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (disabled) return;
    function onMove(event: MouseEvent | TouchEvent) {
      const container = containerRef.current;
      if (!container || dragging.current !== "end" || startRef.current === null) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const clientX =
        "touches" in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = visibleStart + ratio * (visibleEnd - visibleStart);
      onSelect(startRef.current, time);
    }
    function onUp() {
      dragging.current = null;
      startRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    }
    if (dragging.current === "end") {
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
  }, [disabled, onSelect, visibleEnd, visibleStart]);

  const handlePointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const time = visibleStart + ratio * (visibleEnd - visibleStart);
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        dragging.current = "end";
        startRef.current = time;
        onSelect(time, time);
        return;
      }
      onClick(event);
    },
    [disabled, onClick, onSelect, visibleEnd, visibleStart]
  );

  const visibleDuration = Math.max(0.001, visibleEnd - visibleStart);
  const startRatio =
    selection && durationSeconds > 0
      ? Math.max(0, (selection.startSeconds - visibleStart) / visibleDuration)
      : 0;
  const endRatio =
    selection && durationSeconds > 0
      ? Math.max(0, (selection.endSeconds - visibleStart) / visibleDuration)
      : 0;

  return (
    <div
      ref={containerRef}
      className="relative h-32 cursor-crosshair select-none overflow-hidden rounded-md border border-border bg-muted/30"
      onMouseDown={handlePointerDown}
    >
      {peaks.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
          {isDecoding
            ? "Computing high-resolution waveform…"
            : disabled
              ? "Import an audio file to render the waveform"
              : "No waveform data"}
        </div>
      ) : (
        <div className="flex h-full items-end gap-[1px] px-0">
          {peaks.map((peak, index) => {
            const r = (index + 0.5) / peaks.length;
            const inSelection =
              selection !== null &&
              r * durationSeconds >= selection.startSeconds &&
              r * durationSeconds <= selection.endSeconds;
            const inVisible =
              r * durationSeconds >= visibleStart &&
              r * durationSeconds <= visibleEnd;
            if (!inVisible) {
              return <div key={index} className="w-0.5 shrink-0" />;
            }
            const h = Math.max(2, Math.round(peak.peak * 120));
            return (
              <div
                key={index}
                className={
                  inSelection
                    ? "flex-1 rounded-sm bg-primary"
                    : "flex-1 rounded-sm bg-muted-foreground/60"
                }
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
      )}
      {/* Selection overlay. */}
      {selection && durationSeconds > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 border-l-2 border-r-2 border-primary"
          style={{
            left: `${startRatio * 100}%`,
            right: `${(1 - endRatio) * 100}%`,
            background:
              "linear-gradient(180deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0.18) 100%)",
          }}
        />
      )}
      {/* Markers. */}
      {markers.map((marker) => {
        const ratio =
          (marker.timeSeconds - visibleStart) / Math.max(0.001, visibleDuration);
        if (ratio < 0 || ratio > 1) return null;
        return (
          <div
            key={marker.id}
            className="pointer-events-none absolute inset-y-0 w-px"
            style={{
              left: `${ratio * 100}%`,
              background: marker.color || "#38bdf8",
            }}
            aria-label={marker.label}
          >
            <span
              className="absolute -top-1 left-1 rounded-sm bg-background px-1 text-[9px]"
              style={{ color: marker.color || "#38bdf8" }}
            >
              {marker.label}
            </span>
          </div>
        );
      })}
      {/* Playhead. */}
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
        style={{ left: `${Math.max(0, Math.min(1, cursor)) * 100}%` }}
      />
    </div>
  );
}

interface RulerProps {
  durationSeconds: number;
  visibleStart: number;
  visibleEnd: number;
  rulerTicks: number[];
  disabled: boolean;
}

function Ruler({
  durationSeconds,
  visibleStart,
  visibleEnd,
  rulerTicks,
  disabled,
}: RulerProps) {
  if (durationSeconds <= 0 || disabled) {
    return (
      <div className="mt-1 h-5 rounded-sm border border-border bg-muted/30 text-center text-[10px] text-muted-foreground">
        —
      </div>
    );
  }
  const visibleDuration = Math.max(0.001, visibleEnd - visibleStart);
  return (
    <div className="relative mt-1 h-5 rounded-sm border border-border bg-muted/30 text-[10px] text-muted-foreground">
      {rulerTicks.map((tick) => {
        const ratio = (tick - visibleStart) / visibleDuration;
        if (ratio < -0.001 || ratio > 1.001) return null;
        return (
          <div
            key={tick}
            className="absolute inset-y-0 flex flex-col items-center"
            style={{ left: `${ratio * 100}%` }}
          >
            <span className="mt-0.5 h-2 w-px bg-muted-foreground/50" />
            <span className="-translate-x-1/2 transform text-[9px] tabular-nums">
              {formatTimecode(tick)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
