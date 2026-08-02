"use client";

/**
 * Silence Detection — AudioPilot surface.
 *
 * Runs an energy-threshold walk over the active source to find
 * silence regions, lets the user jump between regions, split
 * the source at every silence boundary, or remove the silence
 * regions to stitch the active ranges back together. The
 * threshold and the minimum silence duration are adjustable
 * so the detector works on clean podcasts, noisy field
 * recordings, and music alike.
 *
 * Reuses the same silence detector (`detectSilence`) the
 * Splitter surface uses and the same IndexedDB store every
 * other surface uses.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Eraser,
  FileUp,
  Pause,
  Play,
  Scissors,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import {
  asSilenceBody,
  decodeDataUrl,
  encodeAudioBuffer,
  formatAudioDuration,
  formatTimecode,
  loadAudioFile,
  renderSilenceRegionBuffers,
  scanSilenceRegions,
  stitchActiveRanges,
  toDataUrl,
} from "@/lib/audiopilot";
import type {
  AudioSession,
  AudioSilenceBody,
  AudioSilenceRegion,
} from "@/lib/audiopilot";

interface AudioSilenceSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const DEFAULT_BODY_RESET: AudioSilenceBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  threshold: 0.02,
  minDurationSeconds: 0.5,
  paddingSeconds: 0.05,
  regions: [],
  activeRegionId: "",
  lastResultDataUrl: "",
  lastResultAt: "",
  isFavorite: false,
};

export function AudioSilenceSurface({
  session,
  onChange,
}: AudioSilenceSurfaceProps) {
  const body = asSilenceBody(session.body);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const commit = useCallback(
    (next: AudioSilenceBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioSilenceBody>(
      field: K,
      value: AudioSilenceBody[K]
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
        const next: AudioSilenceBody = {
          ...DEFAULT_BODY_RESET,
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          durationSeconds: loaded.decoded.duration,
          threshold: body.threshold || 0.02,
          minDurationSeconds: body.minDurationSeconds || 0.5,
          paddingSeconds: body.paddingSeconds || 0.05,
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
  }, []);

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

  /** Runs the silence scan. */
  const runScan = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    setScanning(true);
    try {
      const result = await scanSilenceRegions(
        body.sourceDataUrl,
        body.threshold,
        body.minDurationSeconds,
        body.paddingSeconds
      );
      if (!result) {
        toast({
          message: "Could not decode the source for scanning.",
          tone: "error",
        });
        return;
      }
      commit({
        ...body,
        regions: result.regions,
        activeRegionId: result.regions[0]?.id ?? "",
        durationSeconds: result.duration,
      });
      toast({
        message: `Detected ${result.regions.length} silence region${
          result.regions.length === 1 ? "" : "s"
        }.`,
        tone: "success",
      });
    } finally {
      setScanning(false);
    }
  }, [body, commit, toast]);

  /** Jumps to a region in the timeline. */
  const jumpToRegion = useCallback(
    (id: string) => {
      const region = body.regions.find((entry) => entry.id === id);
      if (!region) return;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = region.startSeconds;
        setCurrentTime(region.startSeconds);
      }
      commit({ ...body, activeRegionId: id });
    },
    [body, commit]
  );

  /** Cycles to the next region. */
  const jumpNext = useCallback(() => {
    if (body.regions.length === 0) return;
    const sorted = [...body.regions].sort(
      (a, b) => a.startSeconds - b.startSeconds
    );
    const currentIndex = sorted.findIndex(
      (entry) => entry.id === body.activeRegionId
    );
    const next = sorted[(currentIndex + 1) % sorted.length]!;
    jumpToRegion(next.id);
  }, [body, jumpToRegion]);

  const jumpPrevious = useCallback(() => {
    if (body.regions.length === 0) return;
    const sorted = [...body.regions].sort(
      (a, b) => a.startSeconds - b.startSeconds
    );
    const currentIndex = sorted.findIndex(
      (entry) => entry.id === body.activeRegionId
    );
    const previous =
      sorted[(currentIndex - 1 + sorted.length) % sorted.length]!;
    jumpToRegion(previous.id);
  }, [body, jumpToRegion]);

  /** Toggles a region's selected flag. */
  const toggleRegionSelected = useCallback(
    (id: string) => {
      commit({
        ...body,
        regions: body.regions.map((entry) =>
          entry.id === id ? { ...entry, selected: !entry.selected } : entry
        ),
      });
    },
    [body, commit]
  );

  /** Removes the selected silence regions. */
  const removeSelectedSilence = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    const selected = body.regions.filter((entry) => entry.selected);
    if (selected.length === 0) {
      toast({ message: "Select at least one silence region.", tone: "info" });
      return;
    }
    try {
      const decoded = await decodeDataUrl(body.sourceDataUrl);
      if (!decoded) {
        toast({ message: "Could not decode the source.", tone: "error" });
        return;
      }
      const stitched = stitchActiveRanges(decoded.audioBuffer, selected);
      const encoded = await encodeAudioBuffer(stitched, decoded.format);
      if (!encoded) {
        toast({
          message:
            "The browser cannot encode the target format. The source was returned unchanged.",
          tone: "info",
        });
        return;
      }
      const dataUrl = toDataUrl(encoded.bytes, encoded.mime);
      commit({
        ...body,
        lastResultDataUrl: dataUrl,
        lastResultAt: new Date().toISOString(),
      });
      toast({
        message: `Removed ${selected.length} silence region${
          selected.length === 1 ? "" : "s"
        }.`,
        tone: "success",
      });
    } catch {
      toast({ message: "Remove failed.", tone: "error" });
    }
  }, [body, commit, toast]);

  /** Splits the source at every silence boundary and downloads
   * the resulting segments. */
  const splitAtSilence = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    try {
      const decoded = await decodeDataUrl(body.sourceDataUrl);
      if (!decoded) {
        toast({ message: "Could not decode the source.", tone: "error" });
        return;
      }
      // For the "split at silence" mode we want the non-silence
      // ranges, the same as the stitch step, but as separate
      // downloads. The helper below renders each non-silence
      // range as its own buffer.
      const sorted = [...body.regions].sort(
        (a, b) => a.startSeconds - b.startSeconds
      );
      const activeBuffers = renderSilenceRegionBuffers(
        decoded.audioBuffer,
        sorted
      );
      for (let i = 0; i < activeBuffers.length; i += 1) {
        const buffer = activeBuffers[i]!;
        const encoded = await encodeAudioBuffer(buffer, decoded.format);
        if (!encoded) continue;
        const dataUrl = toDataUrl(encoded.bytes, encoded.mime);
        const link = window.document.createElement("a");
        link.href = dataUrl;
        link.download = `${body.fileName.replace(
          /\.[^.]+$/,
          ""
        )}-segment-${i + 1}.${decoded.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast({
        message: `Exported ${activeBuffers.length} segment${
          activeBuffers.length === 1 ? "" : "s"
        }.`,
        tone: "success",
      });
    } catch {
      toast({ message: "Split failed.", tone: "error" });
    }
  }, [body, toast]);

  const hasSource = body.sourceDataUrl.length > 0;
  const totalSilence = useMemo(
    () => body.regions.reduce((acc, entry) => acc + (entry.endSeconds - entry.startSeconds), 0),
    [body.regions]
  );
  const sortedRegions = useMemo(
    () => [...body.regions].sort((a, b) => a.startSeconds - b.startSeconds),
    [body.regions]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Eraser
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              {body.fileName || "Untitled audio"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} ·{" "}
              {formatAudioDuration(body.durationSeconds)} · {body.regions.length} regions
              {body.regions.length > 0
                ? ` · ${formatAudioDuration(totalSilence)} silence total`
                : ""}
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
                  commit({ ...DEFAULT_BODY_RESET, isFavorite: body.isFavorite });
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
        <h3 className="mb-2 text-sm font-semibold">Detection settings</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <ParamField
            label="Threshold (RMS)"
            value={body.threshold}
            onChange={(v) => updateField("threshold", v)}
            min={0}
            max={1}
            step={0.005}
          />
          <ParamField
            label="Min duration (s)"
            value={body.minDurationSeconds}
            onChange={(v) => updateField("minDurationSeconds", v)}
            min={0.05}
            max={60}
            step={0.05}
          />
          <ParamField
            label="Padding (s)"
            value={body.paddingSeconds}
            onChange={(v) => updateField("paddingSeconds", v)}
            min={0}
            max={5}
            step={0.01}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={runScan}
            disabled={!hasSource || scanning}
          >
            {scanning ? "Scanning…" : "Detect silence"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={jumpPrevious}
            disabled={body.regions.length === 0}
          >
            ‹ Prev
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={jumpNext}
            disabled={body.regions.length === 0}
          >
            Next ›
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={removeSelectedSilence}
            disabled={!hasSource || body.regions.length === 0}
          >
            <Eraser className="h-3 w-3" aria-hidden="true" />
            Remove selected
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={splitAtSilence}
            disabled={!hasSource || body.regions.length === 0}
          >
            <Scissors className="h-3 w-3" aria-hidden="true" />
            Split & export
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Regions</h3>
        {body.regions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Run Detect silence to populate the list. Each row is a
            region the detector found; the toggle selects the
            regions the Remove and Split actions target.
          </p>
        ) : (
          <ul className="space-y-1">
            {sortedRegions.map((region) => (
              <li
                key={region.id}
                className={
                  body.activeRegionId === region.id
                    ? "flex items-center gap-2 rounded-md border border-primary bg-accent px-2 py-1.5 text-xs"
                    : "flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                }
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={region.selected}
                  onChange={() => toggleRegionSelected(region.id)}
                  aria-label={`Select region ${formatTimecode(region.startSeconds)}`}
                />
                <span className="font-medium">
                  {formatTimecode(region.startSeconds)} – {formatTimecode(region.endSeconds)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatAudioDuration(region.endSeconds - region.startSeconds)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  RMS {region.rms.toFixed(3)}
                </span>
                <button
                  type="button"
                  onClick={() => jumpToRegion(region.id)}
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Jump to region"
                >
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
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
          <span className="tabular-nums text-xs font-medium">
            {formatTimecode(currentTime)} / {formatTimecode(body.durationSeconds)}
          </span>
          {body.lastResultAt && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              Last result: {new Date(body.lastResultAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        {hasSource && (
          <audio
            ref={audioRef}
            src={body.sourceDataUrl}
            preload="metadata"
            className="sr-only"
          />
        )}
      </Card>
    </div>
  );
}

interface ParamFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

function ParamField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: ParamFieldProps) {
  return (
    <label className="block text-[11px] font-medium text-muted-foreground">
      {label}
      <input
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
        className="mt-1 flex h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
      />
    </label>
  );
}
