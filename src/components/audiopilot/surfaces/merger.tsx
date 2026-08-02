"use client";

/**
 * Audio Merger — AudioPilot surface.
 *
 * Combines several audio files into a single mixdown. The user
 * adds tracks from the file input or the Audio Library, reorders
 * and removes them on the timeline, sets the gap and the
 * crossfade, previews the result, and exports the merged buffer
 * through the platform's `OfflineAudioContext`.
 *
 * The merger reuses the existing IndexedDB store, the waveform
 * pre-computation helper and the re-encoding pipeline the
 * Converter / Trimmer / Recorder already use.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Library,
  Pause,
  Play,
  Plus,
  Settings2,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asMergerBody,
  encodeMerge,
  formatAudioDuration,
  formatBytes,
  FORMAT_LABELS,
  loadAudioFile,
  precomputeTrackWaveform,
  renderMergeToBuffer,
  resolveMergeTimeline,
  shortId,
  toDataUrl,
  trimAudioBuffer,
  type AudioFormat,
} from "@/lib/audiopilot";
import type {
  AudioLibraryEntry,
  AudioMergeTrack,
  AudioMergerBody,
  AudioSession,
} from "@/lib/audiopilot";
import { LibraryPicker } from "./shared/library-picker";

interface AudioMergerSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const DEFAULT_BODY_RESET: AudioMergerBody = {
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

export function AudioMergerSurface({
  session,
  onChange,
}: AudioMergerSurfaceProps) {
  const body = asMergerBody(session.body);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [rendering, setRendering] = useState(false);

  const commit = useCallback(
    (next: AudioMergerBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioMergerBody>(field: K, value: AudioMergerBody[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Resolves the timeline whenever the inputs change. */
  const resolved = useMemo(
    () => resolveMergeTimeline(body.tracks, body.gapSeconds, body.crossfadeSeconds),
    [body.tracks, body.gapSeconds, body.crossfadeSeconds]
  );

  /** Persists the resolved timeline. */
  useEffect(() => {
    if (
      JSON.stringify(resolved.timeline) === JSON.stringify(body.timeline) &&
      resolved.totalDurationSeconds === body.totalDurationSeconds
    ) {
      return;
    }
    commit({
      ...body,
      timeline: resolved.timeline,
      totalDurationSeconds: resolved.totalDurationSeconds,
    });
    // We only want to recompute when the resolved timeline
    // changes, not on every body update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  /** Adds a track from a File. */
  const onFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;
      setImporting(true);
      try {
        const next: AudioMergeTrack[] = [...body.tracks];
        for (const file of files) {
          const loaded = await loadAudioFile(file);
          if (!loaded) {
            toast({
              message: `${file.name} could not be decoded.`,
              tone: "error",
            });
            continue;
          }
          const { waveform, durationSeconds } = await precomputeTrackWaveform(
            loaded.dataUrl,
            256
          );
          next.push({
            id: shortId("trk"),
            name: file.name,
            dataUrl: loaded.dataUrl,
            format: loaded.format,
            size: loaded.decoded.buffer.byteLength,
            durationSeconds: durationSeconds || loaded.decoded.duration,
            volume: 1,
            pan: 0,
            muted: false,
            waveform,
            addedAt: new Date().toISOString(),
          });
        }
        commit({ ...body, tracks: next });
        toast({
          message: `Imported ${files.length} file${files.length === 1 ? "" : "s"}`,
          tone: "success",
        });
      } finally {
        setImporting(false);
      }
    },
    [body, commit, toast]
  );

  /** Adds a track from the library. */
  const onPick = useCallback(
    (entry: AudioLibraryEntry) => {
      setIsPicking(false);
      const next: AudioMergeTrack = {
        id: shortId("trk"),
        name: entry.name,
        dataUrl: entry.dataUrl,
        format: entry.format,
        size: entry.size,
        durationSeconds: entry.durationSeconds,
        volume: 1,
        pan: 0,
        muted: false,
        waveform: [],
        addedAt: new Date().toISOString(),
      };
      commit({ ...body, tracks: [...body.tracks, next] });
      toast({ message: `Added ${entry.name}`, tone: "success" });
    },
    [body, commit, toast]
  );

  /** Reorders a track up or down. */
  const moveTrack = useCallback(
    (id: string, delta: number) => {
      const index = body.tracks.findIndex((track) => track.id === id);
      if (index < 0) return;
      const next = index + delta;
      if (next < 0 || next >= body.tracks.length) return;
      const reordered = [...body.tracks];
      const [track] = reordered.splice(index, 1);
      if (!track) return;
      reordered.splice(next, 0, track);
      commit({ ...body, tracks: reordered });
    },
    [body, commit]
  );

  /** Removes a track. */
  const removeTrack = useCallback(
    (id: string) => {
      commit({
        ...body,
        tracks: body.tracks.filter((track) => track.id !== id),
      });
    },
    [body, commit]
  );

  /** Updates a track field. */
  const updateTrack = useCallback(
    (id: string, patch: Partial<AudioMergeTrack>) => {
      commit({
        ...body,
        tracks: body.tracks.map((track) =>
          track.id === id ? { ...track, ...patch } : track
        ),
      });
    },
    [body, commit]
  );

  /** Builds the preview mixdown. */
  const buildPreview = useCallback(async () => {
    if (body.tracks.length === 0) return;
    setRendering(true);
    try {
      const buffer = await renderMergeToBuffer(
        body.tracks,
        body.timeline,
        body.totalDurationSeconds,
        body.outputSampleRate
      );
      const fallback = body.tracks[0]?.dataUrl ?? "";
      const result = await encodeMerge(
        buffer,
        fallback,
        body.outputFormat
      );
      setPreviewDataUrl(result.dataUrl);
    } finally {
      setRendering(false);
    }
  }, [body.tracks, body.timeline, body.totalDurationSeconds, body.outputSampleRate, body.outputFormat]);

  /** Toggles playback on the preview. */
  const togglePlay = useCallback(() => {
    const audio = previewRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => {
        toast({ message: "Could not start preview.", tone: "error" });
      });
    } else {
      audio.pause();
    }
  }, [toast]);

  /** Stops the preview. */
  const stopPreview = useCallback(() => {
    const audio = previewRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPreviewTime(0);
  }, []);

  /** Subscribes to the preview audio element. */
  useEffect(() => {
    const audio = previewRef.current;
    if (!audio) return;
    function onPlay() {
      setPreviewing(true);
    }
    function onPause() {
      setPreviewing(false);
    }
    function onTime() {
      if (previewRef.current) setPreviewTime(previewRef.current.currentTime);
    }
    function onMeta() {
      if (previewRef.current) setPreviewDuration(previewRef.current.duration || 0);
    }
    function onEnded() {
      setPreviewing(false);
      setPreviewTime(0);
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
  }, [previewDataUrl]);

  /** Exports the merged mixdown to a file download. */
  const exportMixdown = useCallback(async () => {
    if (body.tracks.length === 0) return;
    setRendering(true);
    try {
      const buffer = await renderMergeToBuffer(
        body.tracks,
        body.timeline,
        body.totalDurationSeconds,
        body.outputSampleRate
      );
      const fallback = body.tracks[0]?.dataUrl ?? "";
      const result = await encodeMerge(
        buffer,
        fallback,
        body.outputFormat
      );
      if (!result.dataUrl) {
        toast({ message: "Could not build the mixdown.", tone: "error" });
        return;
      }
      const link = window.document.createElement("a");
      link.href = result.dataUrl;
      link.download = `merged.${body.outputFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      commit({
        ...body,
        lastExportDataUrl: result.dataUrl,
        lastExportAt: new Date().toISOString(),
      });
      toast({
        message: result.matched
          ? `Exported merged.${body.outputFormat} (${formatBytes(result.size)})`
          : "Browser cannot encode this format natively; exported the source instead.",
        tone: result.matched ? "success" : "info",
      });
    } finally {
      setRendering(false);
    }
  }, [body, commit, toast]);

  /** Clears every track. */
  const clearAll = useCallback(() => {
    commit({ ...body, tracks: [] });
  }, [body, commit]);

  const hasTracks = body.tracks.length > 0;

  if (isPicking) {
    return (
      <LibraryPicker
        surface="merger"
        onPick={onPick}
        onCancel={() => setIsPicking(false)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Settings2
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              Audio Merger
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.tracks.length} track{body.tracks.length === 1 ? "" : "s"} ·{" "}
              gap {body.gapSeconds.toFixed(2)}s · crossfade{" "}
              {body.crossfadeSeconds.toFixed(2)}s · total{" "}
              {formatAudioDuration(body.totalDurationSeconds)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
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
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {importing ? "Importing…" : "Import"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => setIsPicking(true)}
            >
              <Library className="h-3.5 w-3.5" aria-hidden="true" />
              From library
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
            {hasTracks && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={clearAll}
                aria-label="Clear all tracks"
                title="Clear all tracks"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Tracks</h3>
        {!hasTracks ? (
          <p className="text-[11px] text-muted-foreground">
            Add at least one track to begin. Drag-free reordering, per-track
            volume / pan and a mixdown preview ship with the merger.
          </p>
        ) : (
          <ul className="space-y-2">
            {body.tracks.map((track, index) => {
              const point = body.timeline.find((entry) => entry.trackId === track.id);
              return (
                <li
                  key={track.id}
                  className="rounded-md border border-border bg-background p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {track.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {track.format.toUpperCase()} ·{" "}
                      {formatAudioDuration(track.durationSeconds)} ·{" "}
                      {formatBytes(track.size)}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => moveTrack(track.id, -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => moveTrack(track.id, 1)}
                        disabled={index === body.tracks.length - 1}
                        aria-label="Move down"
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() =>
                          updateTrack(track.id, { muted: !track.muted })
                        }
                        aria-label={track.muted ? "Unmute" : "Mute"}
                      >
                        {track.muted ? (
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removeTrack(track.id)}
                        aria-label="Remove track"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Volume
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={track.volume}
                        onChange={(event) =>
                          updateTrack(track.id, {
                            volume: Number(event.target.value),
                          })
                        }
                        className="mt-1 h-1 w-full accent-primary"
                        aria-label={`${track.name} volume`}
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Pan
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.05}
                        value={track.pan}
                        onChange={(event) =>
                          updateTrack(track.id, {
                            pan: Number(event.target.value),
                          })
                        }
                        className="mt-1 h-1 w-full accent-primary"
                        aria-label={`${track.name} pan`}
                      />
                    </label>
                    <div className="text-[10px] text-muted-foreground">
                      Start{" "}
                      <span className="text-foreground">
                        {point ? formatAudioDuration(point.startSeconds) : "—"}
                      </span>{" "}
                      · End{" "}
                      <span className="text-foreground">
                        {point ? formatAudioDuration(point.endSeconds) : "—"}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Layout</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gap (s)
            </label>
            <Input
              type="number"
              value={body.gapSeconds}
              min={0}
              max={60}
              step={0.1}
              onChange={(event) =>
                updateField("gapSeconds", Number(event.target.value))
              }
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Crossfade (s)
            </label>
            <Input
              type="number"
              value={body.crossfadeSeconds}
              min={0}
              max={30}
              step={0.1}
              onChange={(event) =>
                updateField("crossfadeSeconds", Number(event.target.value))
              }
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Output format
            </label>
            <select
              value={body.outputFormat}
              onChange={(event) =>
                updateField("outputFormat", event.target.value as AudioFormat)
              }
              className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            >
              {(["mp3", "wav", "ogg", "flac", "aac"] as AudioFormat[]).map(
                (format) => (
                  <option key={format} value={format}>
                    {FORMAT_LABELS[format]}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Bitrate
            </label>
            <Input
              type="number"
              value={body.outputBitrateKbps}
              min={32}
              max={320}
              step={32}
              onChange={(event) =>
                updateField("outputBitrateKbps", Number(event.target.value))
              }
              className="mt-1 h-8 text-xs"
            />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Preview</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={buildPreview}
            disabled={!hasTracks || rendering}
          >
            {rendering ? "Building…" : "Build mixdown"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={togglePlay}
            disabled={!previewDataUrl}
          >
            {previewing ? (
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {previewing ? "Pause" : "Play"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8"
            onClick={stopPreview}
            disabled={!previewDataUrl}
            aria-label="Stop preview"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <span className="tabular-nums text-xs font-medium">
            {formatAudioDuration(previewTime)} /{" "}
            {formatAudioDuration(previewDuration || body.totalDurationSeconds)}
          </span>
          <Button
            size="sm"
            variant="default"
            className="ml-auto h-8 gap-1.5 px-2.5 text-xs"
            onClick={exportMixdown}
            disabled={!hasTracks || rendering}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {rendering ? "Rendering…" : "Export mixdown"}
          </Button>
        </div>
        {previewDataUrl && (
          <audio
            ref={previewRef}
            src={previewDataUrl}
            preload="metadata"
            className="mt-2 h-9 w-full"
            controls
          />
        )}
      </Card>
    </div>
  );
}
