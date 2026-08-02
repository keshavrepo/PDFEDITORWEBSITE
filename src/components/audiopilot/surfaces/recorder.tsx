"use client";

/**
 * Recorder — AudioPilot surface.
 *
 * Captures audio from the user's microphone through the platform's
 * MediaRecorder, with pause, resume and stop, and stores the
 * resulting blob into the same IndexedDB store every other
 * AudioPilot surface uses. The recorder keeps the most recent
 * captures, lets the user rename, delete and replay each one,
 * and exposes the underlying data URL for future tools.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Mic,
  Pause,
  Play,
  Plus,
  Save,
  Square,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asRecorderBody,
  blobToDataUrl,
  formatAudioDuration,
  formatBytes,
  guessAudioFormat,
  shortId,
  type AudioFormat,
} from "@/lib/audiopilot";
import type {
  AudioRecorderBody,
  AudioRecording,
  AudioSession,
} from "@/lib/audiopilot";
import {
  SpeedPicker,
  TransportControls,
  VolumeSlider,
} from "./shared/transport";

interface AudioRecorderSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

interface ActiveRecording {
  id: string;
  startedAt: string;
  chunks: BlobPart[];
  mime: string;
}

export function AudioRecorderSurface({
  session,
  onChange,
}: AudioRecorderSurfaceProps) {
  const body = asRecorderBody(session.body);
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeMime, setActiveMime] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("");
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  const commit = useCallback(
    (next: AudioRecorderBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioRecorderBody>(field: K, value: AudioRecorderBody[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Lists the user's microphones so the picker is populated. */
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setDevices(
          list.filter((device) => device.kind === "audioinput")
        );
      } catch {
        // Best-effort: the picker falls back to the system default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Subscribes to the playback audio element. */
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
      if (audioRef.current) setPlaybackTime(audioRef.current.currentTime);
    }
    function onMeta() {
      if (audioRef.current) setPlaybackDuration(audioRef.current.duration || 0);
    }
    function onEnded() {
      setIsPlaying(false);
      setPlaybackTime(0);
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

  /** Tick the elapsed time while recording. */
  useEffect(() => {
    if (!isRecording) {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      const now = Date.now();
      const delta = now - startedAtRef.current;
      setElapsed(accumulatedRef.current + delta);
    }, 250);
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
    };
  }, [isRecording]);

  const stopStream = useCallback(async () => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
    startedAtRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      toast({
        message: "Microphone access is not available in this browser.",
        tone: "error",
      });
      return;
    }
    try {
      const constraints: MediaStreamConstraints = {
        audio: body.deviceId
          ? { deviceId: { exact: body.deviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const mime = pickRecorderMime();
      mimeRef.current = mime;
      setActiveMime(mime);
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        void stopStream();
      });
      recorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      startedAtRef.current = Date.now();
      accumulatedRef.current = 0;
      setElapsed(0);
    } catch (err) {
      toast({
        message:
          err instanceof Error
            ? err.message
            : "Could not start the microphone.",
        tone: "error",
      });
    }
  }, [body.deviceId, stopStream, toast]);

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startedAtRef.current = Date.now();
    setIsPaused(false);
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "paused") recorder.resume();
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    recorder.stop();
    // Wait one tick for the stop event to flush.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    const blob = new Blob(chunksRef.current, { type: mimeRef.current });
    const dataUrl = await blobToDataUrl(blob);
    const format = guessAudioFormat(mimeRef.current, undefined);
    const recording: AudioRecording = {
      id: shortId("rec"),
      name: `Recording ${body.recordings.length + 1}`,
      startedAt: new Date(Date.now() - accumulatedRef.current).toISOString(),
      durationSeconds: accumulatedRef.current / 1000,
      dataUrl,
      format,
      size: blob.size,
      isFavorite: false,
    };
    commit({
      ...body,
      recordings: [recording, ...body.recordings].slice(0, 50),
      selectedRecordingId: recording.id,
    });
    setElapsed(0);
    accumulatedRef.current = 0;
    toast({ message: `Saved ${recording.name}`, tone: "success" });
  }, [body, commit, toast]);

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

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaybackTime(0);
  }, []);

  const selectRecording = useCallback(
    (recording: AudioRecording) => {
      commit({ ...body, selectedRecordingId: recording.id });
    },
    [body, commit]
  );

  const renameRecording = useCallback(
    (id: string, name: string) => {
      commit({
        ...body,
        recordings: body.recordings.map((entry) =>
          entry.id === id ? { ...entry, name: name.slice(0, 80) } : entry
        ),
      });
    },
    [body, commit]
  );

  const deleteRecording = useCallback(
    (id: string) => {
      commit({
        ...body,
        recordings: body.recordings.filter((entry) => entry.id !== id),
        selectedRecordingId:
          body.selectedRecordingId === id ? "" : body.selectedRecordingId,
      });
    },
    [body, commit]
  );

  const toggleFavoriteRecording = useCallback(
    (id: string) => {
      commit({
        ...body,
        recordings: body.recordings.map((entry) =>
          entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
        ),
      });
    },
    [body, commit]
  );

  const downloadSelected = useCallback(() => {
    const recording = body.recordings.find(
      (entry) => entry.id === body.selectedRecordingId
    );
    if (!recording) return;
    const ext = recording.format === "wav" ? "wav" : recording.format;
    const link = window.document.createElement("a");
    link.href = recording.dataUrl;
    link.download = `${recording.name.replace(/[^\w\-]+/g, "_") || "recording"}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [body.recordings, body.selectedRecordingId]);

  /** Cleans up the microphone stream on unmount. */
  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, []);

  const selectedRecording = useMemo(
    () => body.recordings.find((entry) => entry.id === body.selectedRecordingId) ?? null,
    [body.recordings, body.selectedRecordingId]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Mic className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {isRecording
                ? isPaused
                  ? "Recording paused"
                  : "Recording…"
                : "Ready to record"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isRecording
                ? `Elapsed ${formatAudioDuration(elapsed / 1000)} · ${activeMime || "auto"}`
                : `Stored ${body.recordings.length} capture${body.recordings.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
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
              {body.isFavorite ? "Favourited" : "Favourite"}
            </Button>
            {isRecording ? (
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={stopRecording}
              >
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                Stop & save
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={startRecording}
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                Start recording
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={isPaused ? resumeRecording : pauseRecording}
            disabled={!isRecording}
          >
            {isPaused ? (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isPaused ? "Resume" : "Pause"}
          </Button>
          <span className="tabular-nums text-xs font-medium">
            {formatAudioDuration(elapsed / 1000)}
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">
              Microphone
            </label>
            <select
              value={body.deviceId}
              onChange={(event) => updateField("deviceId", event.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              disabled={isRecording}
            >
              <option value="">System default</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">
              Sample rate hint
            </label>
            <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
              {[0, 22050, 44100, 48000].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => updateField("sampleRate", rate)}
                  disabled={isRecording}
                  className={
                    body.sampleRate === rate
                      ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                      : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  }
                >
                  {rate === 0 ? "Default" : `${rate / 1000}k`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Selected capture</h3>
        {!selectedRecording ? (
          <p className="text-[11px] text-muted-foreground">
            Stop a recording to select it here, or pick one from the list below.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={selectedRecording.name}
                onChange={(event) =>
                  renameRecording(selectedRecording.id, event.target.value)
                }
                className="h-8 text-xs"
                aria-label="Recording name"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={() =>
                  toggleFavoriteRecording(selectedRecording.id)
                }
                aria-label={
                  selectedRecording.isFavorite ? "Unfavourite" : "Favourite"
                }
              >
                <Star
                  className={
                    selectedRecording.isFavorite
                      ? "h-3.5 w-3.5 fill-primary text-primary"
                      : "h-3.5 w-3.5"
                  }
                  aria-hidden="true"
                />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => deleteRecording(selectedRecording.id)}
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TransportControls
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                onStop={stopPlayback}
                disabled={!selectedRecording}
              />
              <span className="tabular-nums text-xs font-medium">
                {formatAudioDuration(playbackTime)} /{" "}
                {formatAudioDuration(playbackDuration || selectedRecording.durationSeconds)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selectedRecording.format.toUpperCase()} ·{" "}
                {formatBytes(selectedRecording.size)}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  onClick={downloadSelected}
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  Download
                </Button>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={selectedRecording.dataUrl}
              preload="metadata"
              className="sr-only"
            />
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Captures</h3>
        {body.recordings.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No captures yet. Hit Start recording to begin.
          </p>
        ) : (
          <ul className="space-y-1">
            {body.recordings.map((entry) => (
              <li
                key={entry.id}
                className={
                  body.selectedRecordingId === entry.id
                    ? "flex items-center gap-2 rounded-md border border-primary bg-accent px-2 py-1.5 text-xs"
                    : "flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                }
              >
                <button
                  type="button"
                  onClick={() => selectRecording(entry)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <Upload
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate">{entry.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatAudioDuration(entry.durationSeconds)} ·{" "}
                    {formatBytes(entry.size)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavoriteRecording(entry.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={
                    entry.isFavorite ? "Unfavourite" : "Favourite"
                  }
                >
                  <Star
                    className={
                      entry.isFavorite
                        ? "h-3.5 w-3.5 fill-primary text-primary"
                        : "h-3.5 w-3.5"
                    }
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => deleteRecording(entry.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Picks the best MediaRecorder mime the browser supports. */
function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/wav",
    "audio/mp4",
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // continue
    }
  }
  return "";
}
