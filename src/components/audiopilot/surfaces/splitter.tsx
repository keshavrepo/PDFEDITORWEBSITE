"use client";

/**
 * Audio Splitter — AudioPilot surface.
 *
 * Cuts a single audio file into segments using one of four
 * modes: split by time, split by markers, split into equal
 * parts, or split by silence detection. The user previews every
 * segment on a waveform, selects which ones to export, and
 * batch-exports the selection to the user's downloads.
 *
 * The splitter reuses the same IndexedDB store, the waveform
 * pre-computation helper and the re-encoding pipeline the
 * Merger and Converter already use.
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
  Library,
  Pause,
  Play,
  Plus,
  Scissors,
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
  asSplitterBody,
  buildZip,
  computeWaveformPeaks,
  DEFAULT_WAVEFORM_BUCKETS,
  detectSilence,
  encodeSegment,
  formatAudioDuration,
  formatBytes,
  FORMAT_LABELS,
  loadAudioFile,
  shortId,
  type AudioFormat,
  type AudioSplitMarker,
  type AudioSplitSegment,
} from "@/lib/audiopilot";
import type {
  AudioLibraryEntry,
  AudioSession,
  AudioSplitterBody,
} from "@/lib/audiopilot";
import { LibraryPicker } from "./shared/library-picker";

interface AudioSplitterSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const DEFAULT_BODY_RESET: AudioSplitterBody = {
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

export function AudioSplitterSurface({
  session,
  onChange,
}: AudioSplitterSurfaceProps) {
  const body = asSplitterBody(session.body);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [decoding, setDecoding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const commit = useCallback(
    (next: AudioSplitterBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioSplitterBody>(field: K, value: AudioSplitterBody[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Decodes the source so the duration is correct. */
  useEffect(() => {
    if (!body.sourceDataUrl) return;
    if (body.durationSeconds > 0) return;
    let cancelled = false;
    (async () => {
      setDecoding(true);
      try {
        const { decodeDataUrl } = await import("@/lib/audiopilot");
        const decoded = await decodeDataUrl(body.sourceDataUrl);
        if (cancelled || !decoded) return;
        commit({ ...body, durationSeconds: decoded.duration });
      } finally {
        if (!cancelled) setDecoding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.sourceDataUrl]);

  /** Loads a file from the file input. */
  const onFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setImporting(true);
      try {
        const loaded = await loadAudioFile(file);
        if (!loaded) {
          toast({ message: "That file could not be decoded.", tone: "error" });
          return;
        }
        commit({
          ...body,
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          durationSeconds: loaded.decoded.duration,
          markers: [],
          segments: [],
        });
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

  /** Loads a file from the library. */
  const onPick = useCallback(
    (entry: AudioLibraryEntry) => {
      setIsPicking(false);
      commit({
        ...body,
        sourceDataUrl: entry.dataUrl,
        sourceFormat: entry.format,
        fileName: entry.name,
        durationSeconds: entry.durationSeconds,
        markers: [],
        segments: [],
      });
      toast({ message: `Loaded ${entry.name}`, tone: "success" });
    },
    [body, commit, toast]
  );

  /** Adds a marker at the current playhead (or the centre of the source). */
  const addMarker = useCallback(
    (time: number) => {
      const marker: AudioSplitMarker = {
        id: shortId("mk"),
        timeSeconds: time,
        label: `Marker ${body.markers.length + 1}`,
      };
      const next = [...body.markers, marker]
        .map((entry) => ({ ...entry }))
        .sort((a, b) => a.timeSeconds - b.timeSeconds);
      commit({ ...body, markers: next });
    },
    [body, commit]
  );

  /** Removes a marker. */
  const removeMarker = useCallback(
    (id: string) => {
      commit({
        ...body,
        markers: body.markers.filter((entry) => entry.id !== id),
      });
    },
    [body, commit]
  );

  /** Toggles a segment's selection. */
  const toggleSegment = useCallback(
    (id: string) => {
      commit({
        ...body,
        segments: body.segments.map((entry) =>
          entry.id === id ? { ...entry, selected: !entry.selected } : entry
        ),
      });
    },
    [body, commit]
  );

  /** Selects / deselects every segment. */
  const setAllSelected = useCallback(
    (selected: boolean) => {
      commit({
        ...body,
        segments: body.segments.map((entry) => ({ ...entry, selected })),
      });
    },
    [body, commit]
  );

  /** Runs the splitter. */
  const runSplit = useCallback(async () => {
    if (!body.sourceDataUrl || body.durationSeconds <= 0) return;
    let boundaries: { start: number; end: number; isSilence: boolean }[] = [];
    if (body.mode === "time") {
      const step = Math.max(1, body.everySeconds);
      let cursor = 0;
      while (cursor < body.durationSeconds) {
        const end = Math.min(body.durationSeconds, cursor + step);
        boundaries.push({ start: cursor, end, isSilence: false });
        cursor = end;
      }
    } else if (body.mode === "markers") {
      const markers = [...body.markers]
        .map((entry) => entry.timeSeconds)
        .sort((a, b) => a - b);
      const points = [0, ...markers, body.durationSeconds];
      for (let i = 0; i < points.length - 1; i += 1) {
        const start = points[i] ?? 0;
        const end = points[i + 1] ?? body.durationSeconds;
        if (end > start) {
          boundaries.push({ start, end, isSilence: false });
        }
      }
    } else if (body.mode === "equal") {
      const parts = Math.max(2, body.equalParts);
      const step = body.durationSeconds / parts;
      for (let i = 0; i < parts; i += 1) {
        const start = step * i;
        const end = step * (i + 1);
        boundaries.push({ start, end, isSilence: false });
      }
    } else {
      // split by silence
      const { decodeDataUrl } = await import("@/lib/audiopilot");
      const decoded = await decodeDataUrl(body.sourceDataUrl);
      if (!decoded) {
        toast({
          message: "Could not decode the source for silence detection.",
          tone: "error",
        });
        return;
      }
      const scan = detectSilence(
        decoded.audioBuffer,
        body.silenceThresholdDb,
        body.silenceMinDurationSeconds
      );
      const points = [0];
      for (const range of scan.ranges) {
        points.push(range.startSeconds, range.endSeconds);
      }
      points.push(body.durationSeconds);
      for (let i = 0; i < points.length - 1; i += 1) {
        const start = points[i] ?? 0;
        const end = points[i + 1] ?? body.durationSeconds;
        if (end > start) {
          const isSilence = scan.ranges.some(
            (range) =>
              Math.abs(range.startSeconds - start) < 0.01 &&
              Math.abs(range.endSeconds - end) < 0.01
          );
          boundaries.push({ start, end, isSilence });
        }
      }
    }
    const segments: AudioSplitSegment[] = boundaries.map(
      ({ start, end, isSilence }, index) => ({
        id: shortId("seg"),
        name: `${body.fileName.replace(/\.[^.]+$/, "") || "segment"}-${String(
          index + 1
        ).padStart(3, "0")}.${body.lastExportFormat}`,
        startSeconds: start,
        endSeconds: end,
        format: body.sourceFormat,
        isSilence,
        selected: true,
      })
    );
    commit({
      ...body,
      segments,
      lastSplitAt: new Date().toISOString(),
    });
    toast({ message: `Produced ${segments.length} segments.`, tone: "success" });
  }, [body, commit, toast]);

  /** Builds the export ZIP. */
  const exportSelected = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    const selected = body.segments.filter((entry) => entry.selected);
    if (selected.length === 0) {
      toast({ message: "Pick at least one segment to export.", tone: "info" });
      return;
    }
    setExporting(true);
    try {
      const entries: Array<{ name: string; dataUrl: string }> = [];
      for (const segment of selected) {
        const result = await encodeSegment(
          body.sourceDataUrl,
          segment.startSeconds,
          segment.endSeconds,
          body.lastExportFormat
        );
        if (result.dataUrl) {
          entries.push({ name: segment.name, dataUrl: result.dataUrl });
        }
      }
      if (entries.length === 0) {
        toast({ message: "Could not build the segment exports.", tone: "error" });
        return;
      }
      const zip = await buildZip(entries);
      if (!zip.dataUrl) {
        toast({ message: "Could not build the ZIP archive.", tone: "error" });
        return;
      }
      const link = window.document.createElement("a");
      link.href = zip.dataUrl;
      link.download = `${body.fileName.replace(/\.[^.]+$/, "") || "segments"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      commit({
        ...body,
        lastSplitAt: new Date().toISOString(),
        lastExportFormat: body.lastExportFormat,
      });
      toast({
        message: `Exported ${entries.length} segments (${formatBytes(
          zip.size
        )})`,
        tone: "success",
      });
    } finally {
      setExporting(false);
    }
  }, [body, commit, toast]);

  /** Previews a segment by writing the source data URL into the
   * audio element and seeking to the segment start. */
  const previewSegment = useCallback(
    (segment: AudioSplitSegment) => {
      const audio = previewRef.current;
      if (!audio) return;
      audio.src = body.sourceDataUrl;
      audio.currentTime = segment.startSeconds;
      void audio.play().catch(() => {
        toast({ message: "Could not start preview.", tone: "error" });
      });
    },
    [body.sourceDataUrl, toast]
  );

  const stopPreview = useCallback(() => {
    const audio = previewRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPreviewTime(0);
  }, []);

  /** Stops the preview when the segment ends. */
  useEffect(() => {
    const audio = previewRef.current;
    if (!audio) return;
    function onTime() {
      if (previewRef.current) setPreviewTime(previewRef.current.currentTime);
    }
    function onMeta() {
      if (previewRef.current) setPreviewDuration(previewRef.current.duration || 0);
    }
    function onPlay() {
      setPreviewing(true);
    }
    function onPause() {
      setPreviewing(false);
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
  }, []);

  /** Resets to an empty body. */
  const clearSource = useCallback(() => {
    commit({ ...DEFAULT_BODY_RESET, isFavorite: body.isFavorite });
    toast({ message: "Cleared the splitter.", tone: "info" });
  }, [body, commit, toast]);

  const hasSource = body.sourceDataUrl.length > 0;

  if (isPicking) {
    return (
      <LibraryPicker
        surface="splitter"
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
              <Scissors
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              {body.fileName || "Untitled audio"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} ·{" "}
              {formatAudioDuration(body.durationSeconds)} · {body.markers.length}{" "}
              marker{body.markers.length === 1 ? "" : "s"} · {body.segments.length}{" "}
              segment{body.segments.length === 1 ? "" : "s"}
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
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {importing ? "Importing…" : "Import audio"}
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
            {hasSource && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={clearSource}
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
        <h3 className="mb-2 text-sm font-semibold">Mode</h3>
        <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
          {(
            [
              { id: "time", label: "By time" },
              { id: "markers", label: "By markers" },
              { id: "equal", label: "Equal parts" },
              { id: "silence", label: "By silence" },
            ] as const
          ).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => updateField("mode", entry.id)}
              className={
                body.mode === entry.id
                  ? "rounded bg-primary px-2 py-1 text-primary-foreground"
                  : "rounded px-2 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {body.mode === "time" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Every (s)
              </label>
              <Input
                type="number"
                value={body.everySeconds}
                min={1}
                max={3600}
                onChange={(event) =>
                  updateField("everySeconds", Number(event.target.value))
                }
                className="mt-1 h-8 text-xs"
              />
            </div>
          )}
          {body.mode === "equal" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Parts
              </label>
              <Input
                type="number"
                value={body.equalParts}
                min={2}
                max={100}
                onChange={(event) =>
                  updateField("equalParts", Number(event.target.value))
                }
                className="mt-1 h-8 text-xs"
              />
            </div>
          )}
          {body.mode === "silence" && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Threshold (dB)
                </label>
                <Input
                  type="number"
                  value={body.silenceThresholdDb}
                  min={-120}
                  max={0}
                  step={1}
                  onChange={(event) =>
                    updateField(
                      "silenceThresholdDb",
                      Number(event.target.value)
                    )
                  }
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Min duration (s)
                </label>
                <Input
                  type="number"
                  value={body.silenceMinDurationSeconds}
                  min={0.05}
                  max={30}
                  step={0.1}
                  onChange={(event) =>
                    updateField(
                      "silenceMinDurationSeconds",
                      Number(event.target.value)
                    )
                  }
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </>
          )}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Export format
            </label>
            <select
              value={body.lastExportFormat}
              onChange={(event) =>
                updateField("lastExportFormat", event.target.value as AudioFormat)
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
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={runSplit}
            disabled={!hasSource || decoding}
          >
            <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
            {decoding ? "Decoding…" : "Run split"}
          </Button>
          {body.mode === "markers" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => addMarker(previewTime || 0)}
              disabled={!hasSource}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add marker at {formatAudioDuration(previewTime)}
            </Button>
          )}
        </div>
      </Card>

      {body.mode === "markers" && hasSource && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Markers</h3>
          {body.markers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No markers yet. Play the source and add markers at the cut
              points.
            </p>
          ) : (
            <ul className="space-y-1">
              {body.markers.map((marker) => (
                <li
                  key={marker.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatAudioDuration(marker.timeSeconds)}
                  </span>
                  <Input
                    value={marker.label}
                    onChange={(event) => {
                      const next = body.markers.map((entry) =>
                        entry.id === marker.id
                          ? { ...entry, label: event.target.value }
                          : entry
                      );
                      commit({ ...body, markers: next });
                    }}
                    className="h-7 flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => removeMarker(marker.id)}
                    aria-label="Remove marker"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Segments</h3>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => setAllSelected(true)}
              disabled={body.segments.length === 0}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => setAllSelected(false)}
              disabled={body.segments.length === 0}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={exportSelected}
              disabled={body.segments.length === 0 || exporting}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {exporting ? "Exporting…" : "Export ZIP"}
            </Button>
          </div>
        </div>
        {body.segments.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No segments yet. Run the split to produce a list of segments
            you can preview and export.
          </p>
        ) : (
          <ul className="space-y-1">
            {body.segments.map((segment, index) => (
              <li
                key={segment.id}
                className={
                  segment.selected
                    ? "flex items-center gap-2 rounded-md border border-primary bg-accent px-2 py-1.5 text-xs"
                    : "flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                }
              >
                <input
                  type="checkbox"
                  checked={segment.selected}
                  onChange={() => toggleSegment(segment.id)}
                  className="h-3.5 w-3.5 accent-primary"
                  aria-label={`Select ${segment.name}`}
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(3, "0")}
                </span>
                <span className="truncate">{segment.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatAudioDuration(segment.startSeconds)} →{" "}
                  {formatAudioDuration(segment.endSeconds)} (
                  {formatAudioDuration(
                    segment.endSeconds - segment.startSeconds
                  )}
                  )
                </span>
                {segment.isSilence && (
                  <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                    silence
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => previewSegment(segment)}
                    aria-label="Preview segment"
                  >
                    {previewing ? (
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={stopPreview}
                    aria-label="Stop preview"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasSource && (
          <audio
            ref={previewRef}
            src={body.sourceDataUrl}
            preload="metadata"
            className="mt-2 h-9 w-full"
            controls
          />
        )}
      </Card>
    </div>
  );
}
