"use client";

/**
 * Audio Effects — AudioPilot surface.
 *
 * Applies one of seven effects (fade in, fade out, normalize,
 * silence generator, reverse, speed, pitch) to a single
 * source. The user previews the result on a temporary buffer
 * before committing, and every commit lands in a per-session
 * undo / redo stack so any change is reversible.
 *
 * The surface reuses the same IndexedDB store every other
 * AudioPilot surface uses, so the source, the parameter
 * settings and the effect history survive a reload.
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
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asEffectsBody,
  decodeDataUrl,
  describeEffectOp,
  formatAudioDuration,
  formatBytes,
  loadAudioFile,
  mimeForFormat,
  renderEffectsToDataUrl,
  toDataUrl,
  type AudioEffectOp,
} from "@/lib/audiopilot";
import type {
  AudioEffectsBody,
  AudioSession,
} from "@/lib/audiopilot";

interface AudioEffectsSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const DEFAULT_BODY_RESET: AudioEffectsBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  durationSeconds: 0,
  fadeInSeconds: 0.5,
  fadeOutSeconds: 0.5,
  targetPeak: 0.95,
  silenceDurationSeconds: 1,
  speedFactor: 1,
  pitchSemitones: 0,
  history: [],
  historyIndex: -1,
  lastResultDataUrl: "",
  lastResultFormat: "wav",
  lastResultAt: "",
  isFavorite: false,
};

const EFFECT_KINDS: Array<AudioEffectOp["kind"]> = [
  "fade-in",
  "fade-out",
  "normalize",
  "silence",
  "reverse",
  "speed",
  "pitch",
];

export function AudioEffectsSurface({
  session,
  onChange,
}: AudioEffectsSurfaceProps) {
  const body = asEffectsBody(session.body);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importing, setImporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const commit = useCallback(
    (next: AudioEffectsBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioEffectsBody>(
      field: K,
      value: AudioEffectsBody[K]
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
        const next: AudioEffectsBody = {
          ...DEFAULT_BODY_RESET,
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          durationSeconds: loaded.decoded.duration,
          fadeInSeconds: body.fadeInSeconds || 0.5,
          fadeOutSeconds: body.fadeOutSeconds || 0.5,
          targetPeak: body.targetPeak || 0.95,
          silenceDurationSeconds: body.silenceDurationSeconds || 1,
          speedFactor: body.speedFactor || 1,
          pitchSemitones: body.pitchSemitones || 0,
          lastResultFormat: loaded.format,
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

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
  }, []);

  /** Commits a new effect op to the history. */
  const commitOp = useCallback(
    (op: Omit<AudioEffectOp, "id" | "appliedAt">) => {
      const fullOp: AudioEffectOp = {
        ...op,
        id: `op-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        appliedAt: new Date().toISOString(),
      };
      const truncated = body.history.slice(0, body.historyIndex + 1);
      const nextHistory = [...truncated, fullOp].slice(-100);
      commit({
        ...body,
        history: nextHistory,
        historyIndex: nextHistory.length - 1,
      });
      toast({ message: `Applied ${describeEffectOp(fullOp)}`, tone: "success" });
    },
    [body, commit, toast]
  );

  /** Undo. */
  const undo = useCallback(() => {
    if (body.historyIndex <= 0) {
      toast({ message: "Nothing to undo.", tone: "info" });
      return;
    }
    commit({ ...body, historyIndex: body.historyIndex - 1 });
  }, [body, commit, toast]);

  /** Redo. */
  const redo = useCallback(() => {
    if (body.historyIndex >= body.history.length - 1) {
      toast({ message: "Nothing to redo.", tone: "info" });
      return;
    }
    commit({ ...body, historyIndex: body.historyIndex + 1 });
  }, [body, commit, toast]);

  /** Previews the latest effect. */
  const preview = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    setPreviewing(true);
    try {
      const result = await renderEffectsToDataUrl({
        ...body,
        lastResultDataUrl: body.sourceDataUrl,
        lastResultFormat: body.sourceFormat,
      });
      if (!result) {
        toast({ message: "Preview is not available.", tone: "error" });
        return;
      }
      const preview = previewAudioRef.current;
      if (!preview) return;
      preview.src = result.dataUrl;
      preview.currentTime = 0;
      await preview.play().catch(() => {
        toast({ message: "Could not start preview.", tone: "error" });
      });
    } catch {
      toast({ message: "Preview failed.", tone: "error" });
    } finally {
      setPreviewing(false);
    }
  }, [body, toast]);

  /** Applies the current settings as a new effect op. */
  const apply = useCallback(
    (kind: AudioEffectOp["kind"]) => {
      const op: Omit<AudioEffectOp, "id" | "appliedAt"> = (() => {
        switch (kind) {
          case "fade-in":
            return {
              kind,
              durationSeconds: body.fadeInSeconds,
              speedFactor: 1,
              pitchSemitones: 0,
              targetPeak: 0,
              note: "",
            };
          case "fade-out":
            return {
              kind,
              durationSeconds: body.fadeOutSeconds,
              speedFactor: 1,
              pitchSemitones: 0,
              targetPeak: 0,
              note: "",
            };
          case "normalize":
            return {
              kind,
              durationSeconds: 0,
              speedFactor: 1,
              pitchSemitones: 0,
              targetPeak: body.targetPeak,
              note: "",
            };
          case "silence":
            return {
              kind,
              durationSeconds: body.silenceDurationSeconds,
              speedFactor: 1,
              pitchSemitones: 0,
              targetPeak: 0,
              note: "",
            };
          case "speed":
            return {
              kind,
              durationSeconds: 0,
              speedFactor: body.speedFactor,
              pitchSemitones: 0,
              targetPeak: 0,
              note: "",
            };
          case "pitch":
            return {
              kind,
              durationSeconds: 0,
              speedFactor: 1,
              pitchSemitones: body.pitchSemitones,
              targetPeak: 0,
              note: "",
            };
          case "reverse":
          default:
            return {
              kind,
              durationSeconds: 0,
              speedFactor: 1,
              pitchSemitones: 0,
              targetPeak: 0,
              note: "",
            };
        }
      })();
      commitOp(op);
    },
    [body, commitOp]
  );

  /** Renders the active history into a downloadable file. */
  const downloadResult = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    const result = await renderEffectsToDataUrl(body);
    if (!result) return;
    const baseName = body.fileName.replace(/\.[^.]+$/, "");
    const ext = body.lastResultFormat;
    const link = window.document.createElement("a");
    link.href = result.dataUrl;
    link.download = `${baseName || "effects"}-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    commit({
      ...body,
      lastResultDataUrl: result.dataUrl,
      lastResultAt: new Date().toISOString(),
    });
    toast({ message: "Rendered the result.", tone: "success" });
  }, [body, commit, toast]);

  /** Renders the active history into the body so the next preview
   * uses the new audio. */
  const commitResult = useCallback(async () => {
    const result = await renderEffectsToDataUrl(body);
    if (!result) return;
    commit({
      ...body,
      sourceDataUrl: result.dataUrl,
      sourceFormat: body.lastResultFormat,
      lastResultDataUrl: result.dataUrl,
      lastResultAt: new Date().toISOString(),
      history: [],
      historyIndex: -1,
    });
    toast({ message: "Committed the rendered result.", tone: "success" });
  }, [body, commit, toast]);

  const hasSource = body.sourceDataUrl.length > 0;
  const activeOp = body.history[body.historyIndex] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Sparkles
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              {body.fileName || "Untitled audio"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} ·{" "}
              {formatAudioDuration(body.durationSeconds)} ·{" "}
              {body.history.length} effect
              {body.history.length === 1 ? "" : "s"} in history
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
        <h3 className="mb-2 text-sm font-semibold">Apply</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => apply("fade-in")}
            disabled={!hasSource}
          >
            Fade in
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => apply("fade-out")}
            disabled={!hasSource}
          >
            Fade out
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => apply("normalize")}
            disabled={!hasSource}
          >
            Normalize
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => apply("silence")}
            disabled={!hasSource}
          >
            Insert silence
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => apply("reverse")}
            disabled={!hasSource}
          >
            Reverse
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => apply("speed")}
            disabled={!hasSource}
          >
            Speed
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => apply("pitch")}
            disabled={!hasSource}
          >
            Pitch
          </Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ParamField
            label="Fade in (s)"
            value={body.fadeInSeconds}
            onChange={(v) => updateField("fadeInSeconds", v)}
            min={0}
            max={60}
            step={0.05}
          />
          <ParamField
            label="Fade out (s)"
            value={body.fadeOutSeconds}
            onChange={(v) => updateField("fadeOutSeconds", v)}
            min={0}
            max={60}
            step={0.05}
          />
          <ParamField
            label="Normalize peak"
            value={body.targetPeak}
            onChange={(v) => updateField("targetPeak", v)}
            min={0}
            max={1}
            step={0.01}
          />
          <ParamField
            label="Silence (s)"
            value={body.silenceDurationSeconds}
            onChange={(v) => updateField("silenceDurationSeconds", v)}
            min={0}
            max={3600}
            step={0.1}
          />
          <ParamField
            label="Speed factor"
            value={body.speedFactor}
            onChange={(v) => updateField("speedFactor", v)}
            min={0.25}
            max={4}
            step={0.05}
          />
          <ParamField
            label="Pitch (semitones)"
            value={body.pitchSemitones}
            onChange={(v) => updateField("pitchSemitones", v)}
            min={-24}
            max={24}
            step={1}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={preview}
            disabled={!hasSource || previewing}
          >
            {previewing ? "Rendering…" : "Preview"}
          </Button>
          <Button
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
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={commitResult}
            disabled={!hasSource || body.historyIndex < 0}
          >
            Commit result
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={downloadResult}
            disabled={!hasSource}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">History</h3>
        {body.history.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No effects applied yet. Apply one above to build the history.
          </p>
        ) : (
          <ul className="space-y-1">
            {body.history.map((op, index) => (
              <li
                key={op.id}
                className={
                  index === body.historyIndex
                    ? "flex items-center gap-2 rounded-md border border-primary bg-accent px-2 py-1.5 text-xs"
                    : "flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                }
              >
                <span className="font-medium">
                  {index + 1}. {describeEffectOp(op)}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(op.appliedAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        {activeOp && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            <Settings2
              className="mr-1 inline h-3 w-3"
              aria-hidden="true"
            />
            Active effect: {describeEffectOp(activeOp)}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Source</h3>
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8"
            onClick={stop}
            disabled={!hasSource}
            aria-label="Stop"
          >
            <span aria-hidden="true">■</span>
          </Button>
          <span className="tabular-nums text-xs font-medium">
            {formatAudioDuration(currentTime)} /{" "}
            {formatAudioDuration(body.durationSeconds)}
          </span>
        </div>
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
              onEnded={() => setPreviewing(false)}
            />
          </>
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
        className="mt-1 h-8 text-xs"
      />
    </label>
  );
}
