"use client";

/**
 * Export Center — AudioPilot surface.
 *
 * Queues one or more export jobs against a single source,
 * exports the full audio or just the active selection, picks a
 * target format, a target bitrate, a target sample rate and a
 * target channel count, watches the progress indicator advance
 * per-job, and cancels the queue between jobs.
 *
 * Reuses the same re-encoding pipeline the Converter / Trimmer
 * / Batch Processing surfaces already use and writes the
 * results to the same IndexedDB store every other surface uses.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Download,
  FileUp,
  ListChecks,
  Pause,
  Play,
  Settings2,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import {
  asExportCenterBody,
  decodeDataUrl,
  FORMAT_LABELS,
  formatAudioDuration,
  formatBytes,
  loadAudioFile,
  mimeForJob,
  prepareBufferForExport,
  runExportJob,
  shortId,
  type AudioFormat,
} from "@/lib/audiopilot";
import type {
  AudioExportCenterBody,
  AudioExportJob,
  AudioSession,
} from "@/lib/audiopilot";

interface AudioExportCenterSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const FORMATS: AudioFormat[] = ["mp3", "wav", "ogg", "flac", "aac"];
const BITRATES = [64, 96, 128, 160, 192, 256, 320];
const SAMPLE_RATES = [0, 22_050, 44_100, 48_000, 96_000];
const CHANNELS = [0, 1, 2];

const DEFAULT_BODY_RESET: AudioExportCenterBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  sourceSampleRate: 44_100,
  sourceChannels: 2,
  selectionOnly: false,
  selectionStartSeconds: 0,
  selectionEndSeconds: 0,
  jobs: [],
  runningJobId: "",
  isFavorite: false,
};

export function AudioExportCenterSurface({
  session,
  onChange,
}: AudioExportCenterSurfaceProps) {
  const body = asExportCenterBody(session.body);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<boolean>(false);

  const [importing, setImporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [draftFormat, setDraftFormat] = useState<AudioFormat>("mp3");
  const [draftBitrate, setDraftBitrate] = useState(192);
  const [draftSampleRate, setDraftSampleRate] = useState(0);
  const [draftChannels, setDraftChannels] = useState(0);

  const commit = useCallback(
    (next: AudioExportCenterBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioExportCenterBody>(
      field: K,
      value: AudioExportCenterBody[K]
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
        const next: AudioExportCenterBody = {
          ...DEFAULT_BODY_RESET,
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          durationSeconds: loaded.decoded.duration,
          sourceSampleRate: loaded.decoded.sampleRate,
          sourceChannels: loaded.decoded.channels,
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
      try {
        const decoded = await decodeDataUrl(body.sourceDataUrl);
        if (cancelled || !decoded) return;
        commit({
          ...body,
          durationSeconds: decoded.duration,
          sourceSampleRate: decoded.sampleRate,
          sourceChannels: decoded.channels,
        });
      } catch {
        // Best-effort.
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

  /** Adds a draft job to the queue. */
  const enqueueJob = useCallback(() => {
    if (!body.sourceDataUrl) {
      toast({ message: "Import an audio file first.", tone: "info" });
      return;
    }
    const selectionStart = Math.max(0, body.selectionStartSeconds);
    const selectionEnd = Math.max(selectionStart, body.selectionEndSeconds);
    const job: AudioExportJob = {
      id: shortId("job"),
      label: `${FORMAT_LABELS[draftFormat]} · ${draftBitrate} kbps · job ${
        body.jobs.length + 1
      }`,
      sourceDataUrl: body.sourceDataUrl,
      sourceFormat: body.sourceFormat,
      targetFormat: draftFormat,
      bitrateKbps: draftBitrate,
      sampleRate: draftSampleRate,
      channels: draftChannels,
      selectionOnly: body.selectionOnly,
      selectionStartSeconds: selectionStart,
      selectionEndSeconds: selectionEnd,
      state: "pending",
      progress: 0,
      resultDataUrl: "",
      resultBytes: 0,
      updatedAt: new Date().toISOString(),
      errorMessage: "",
    };
    commit({ ...body, jobs: [...body.jobs, job] });
  }, [body, commit, draftBitrate, draftChannels, draftFormat, draftSampleRate, toast]);

  /** Removes a job from the queue. */
  const removeJob = useCallback(
    (id: string) => {
      commit({
        ...body,
        jobs: body.jobs.filter((job) => job.id !== id),
        runningJobId: body.runningJobId === id ? "" : body.runningJobId,
      });
    },
    [body, commit]
  );

  /** Updates a job in place. */
  const updateJob = useCallback(
    (id: string, patch: Partial<AudioExportJob>) => {
      commit({
        ...body,
        jobs: body.jobs.map((job) =>
          job.id === id
            ? { ...job, ...patch, updatedAt: new Date().toISOString() }
            : job
        ),
      });
    },
    [body, commit]
  );

  /** Runs the queue. */
  const runQueue = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    if (body.runningJobId) {
      toast({ message: "A job is already running.", tone: "info" });
      return;
    }
    cancelRef.current = false;
    const queue = body.jobs.filter(
      (job) => job.state === "pending" || job.state === "failed"
    );
    if (queue.length === 0) {
      toast({ message: "Queue is empty.", tone: "info" });
      return;
    }
    for (const next of queue) {
      if (cancelRef.current) {
        updateJob(next.id, { state: "cancelled" });
        continue;
      }
      commit({ ...body, runningJobId: next.id });
      await runExportJob(next, (job) => updateJob(next.id, job));
      if (cancelRef.current) {
        commit({ ...body, runningJobId: "" });
        return;
      }
    }
    commit({ ...body, runningJobId: "" });
  }, [body, commit, toast, updateJob]);

  /** Cancels the queue between jobs. */
  const cancelQueue = useCallback(() => {
    if (!body.runningJobId) return;
    cancelRef.current = true;
    updateJob(body.runningJobId, { state: "cancelled" });
    commit({ ...body, runningJobId: "" });
    toast({ message: "Cancelled the queue.", tone: "info" });
  }, [body, commit, toast, updateJob]);

  /** Downloads a completed job. */
  const downloadJob = useCallback(
    (job: AudioExportJob) => {
      if (!job.resultDataUrl) {
        toast({ message: "This job has no result yet.", tone: "info" });
        return;
      }
      const baseName = body.fileName.replace(/\.[^.]+$/, "");
      const ext = job.targetFormat;
      const link = window.document.createElement("a");
      link.href = job.resultDataUrl;
      link.download = `${baseName || "export"}-${job.id}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [body.fileName, toast]
  );

  /** Sets the selection on the timeline. */
  const handleSetSelection = useCallback(
    (start: number, end: number) => {
      const safeStart = Math.max(0, Math.min(body.durationSeconds, start));
      const safeEnd = Math.max(safeStart, Math.min(body.durationSeconds, end));
      commit({
        ...body,
        selectionStartSeconds: safeStart,
        selectionEndSeconds: safeEnd,
      });
    },
    [body, commit]
  );

  const hasSource = body.sourceDataUrl.length > 0;
  const runningJob = body.jobs.find((job) => job.id === body.runningJobId);
  const completedCount = body.jobs.filter(
    (job) => job.state === "completed"
  ).length;
  const pendingCount = body.jobs.filter(
    (job) => job.state === "pending" || job.state === "failed"
  ).length;

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
              {body.fileName || "Untitled audio"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} · {formatAudioDuration(body.durationSeconds)} · {body.sourceSampleRate} Hz · {body.sourceChannels} ch
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
        <h3 className="mb-2 text-sm font-semibold">Target</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
            {FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => setDraftFormat(format)}
                className={
                  draftFormat === format
                    ? "rounded bg-primary px-2 py-1 text-primary-foreground"
                    : "rounded px-2 py-1 text-muted-foreground hover:text-foreground"
                }
              >
                {FORMAT_LABELS[format]}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
            {BITRATES.map((bitrate) => (
              <button
                key={bitrate}
                type="button"
                onClick={() => setDraftBitrate(bitrate)}
                className={
                  draftBitrate === bitrate
                    ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                    : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                }
              >
                {bitrate}
              </button>
            ))}
            <span className="px-1 text-[10px] text-muted-foreground">kbps</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
            {SAMPLE_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setDraftSampleRate(rate)}
                className={
                  draftSampleRate === rate
                    ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                    : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                }
              >
                {rate === 0 ? "Source" : `${rate / 1000}k`}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
            {CHANNELS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setDraftChannels(count)}
                className={
                  draftChannels === count
                    ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                    : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                }
              >
                {count === 0 ? "Source" : `${count}ch`}
              </button>
            ))}
          </div>
          <label className="ml-auto inline-flex items-center gap-1 text-[11px]">
            <input
              type="checkbox"
              checked={body.selectionOnly}
              onChange={(event) =>
                updateField("selectionOnly", event.target.checked)
              }
              disabled={!hasSource}
              className="h-3.5 w-3.5"
            />
            <span>Selection only</span>
          </label>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={enqueueJob}
            disabled={!hasSource}
          >
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            Add to queue
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {body.selectionOnly
            ? `Selection: ${formatAudioDuration(
                Math.max(0, body.selectionEndSeconds - body.selectionStartSeconds)
              )} (${formatAudioDuration(
                body.selectionStartSeconds
              )} → ${formatAudioDuration(body.selectionEndSeconds)})`
            : "Full audio will be exported."}
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
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
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => handleSetSelection(currentTime, body.durationSeconds)}
            disabled={!hasSource}
          >
            Set selection
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() =>
              commit({ ...body, selectionStartSeconds: 0, selectionEndSeconds: 0 })
            }
            disabled={!hasSource}
          >
            Clear selection
          </Button>
          <span className="tabular-nums text-xs font-medium">
            {formatAudioDuration(currentTime)} / {formatAudioDuration(body.durationSeconds)}
          </span>
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

      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Queue</h3>
          <span className="text-[11px] text-muted-foreground">
            {body.jobs.length} jobs · {pendingCount} pending · {completedCount} completed
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={runQueue}
              disabled={!hasSource || !!body.runningJobId || pendingCount === 0}
            >
              Run queue
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={cancelQueue}
              disabled={!body.runningJobId}
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </div>
        {body.jobs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Queue is empty. Pick a target format / bitrate / sample rate /
            channels and hit Add to queue to build the batch.
          </p>
        ) : (
          <ul className="space-y-1">
            {body.jobs.map((job) => (
              <li
                key={job.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <span className="font-medium">{job.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {FORMAT_LABELS[job.targetFormat]} · {job.bitrateKbps} kbps ·{" "}
                  {job.sampleRate === 0 ? "Source" : `${job.sampleRate / 1000}k`} ·{" "}
                  {job.channels === 0 ? "Source" : `${job.channels}ch`}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {job.state === "running" && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {Math.round(job.progress * 100)}%
                    </span>
                  )}
                  {job.state === "completed" && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatBytes(job.resultBytes)}
                    </span>
                  )}
                  {job.state === "failed" && (
                    <span className="text-[10px] text-destructive">
                      {job.errorMessage}
                    </span>
                  )}
                  {job.state === "cancelled" && (
                    <span className="text-[10px] text-muted-foreground">
                      Cancelled
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadJob(job)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Download"
                    disabled={job.state !== "completed"}
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeJob(job.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Remove"
                    disabled={job.id === body.runningJobId}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {runningJob && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(runningJob.progress * 100)}%` }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
