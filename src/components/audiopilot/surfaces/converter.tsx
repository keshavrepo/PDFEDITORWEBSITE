"use client";

/**
 * Audio Converter — AudioPilot surface.
 *
 * Imports a single audio file in any of MP3, WAV, OGG, FLAC or AAC,
 * lets the user pick a target format, a target bitrate and a
 * metadata block, then re-encodes through the platform's
 * `MediaRecorder` and offers the result as a download. The
 * converter reuses the same IndexedDB store every other surface
 * uses, so the session survives a reload.
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
  Plus,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asConverterBody,
  convertDataUrl,
  decodeDataUrl,
  formatAudioDuration,
  formatBytes,
  FORMAT_LABELS,
  loadAudioFile,
  mimeForFormat,
  readAudioMetadata,
  shortId,
  toDataUrl,
  type AudioFormat,
  type AudioMetadataTag,
} from "@/lib/audiopilot";
import type {
  AudioConverterBody,
  AudioSession,
} from "@/lib/audiopilot";

interface AudioConverterSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const FORMATS: AudioFormat[] = ["mp3", "wav", "ogg", "flac", "aac"];
const BITRATES = [64, 96, 128, 160, 192, 256, 320];

export function AudioConverterSurface({
  session,
  onChange,
}: AudioConverterSurfaceProps) {
  const body = asConverterBody(session.body);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const commit = useCallback(
    (next: AudioConverterBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioConverterBody>(
      field: K,
      value: AudioConverterBody[K]
    ) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Loads a file from the file input. */
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
        const meta = readAudioMetadata(loaded.decoded.buffer)
          .slice(0, 10)
          .map<AudioMetadataTag>((entry) => ({
            id: shortId("tag"),
            key: entry.key,
            value: entry.value,
          }));
        const next: AudioConverterBody = {
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          sourceDurationSeconds: loaded.decoded.duration,
          sourceSampleRate: loaded.decoded.sampleRate,
          sourceChannels: loaded.decoded.channels,
          targetFormat: body.targetFormat || loaded.format,
          targetBitrateKbps: body.targetBitrateKbps || 192,
          metadata: meta,
          lastConvertedAt: "",
          lastConvertedDataUrl: "",
          lastConvertedFormat: body.targetFormat || loaded.format,
          lastConvertedSize: 0,
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
    [body.isFavorite, body.targetBitrateKbps, body.targetFormat, commit, toast]
  );

  /** Adds a metadata tag. */
  const addTag = useCallback(() => {
    const next: AudioMetadataTag = {
      id: shortId("tag"),
      key: "",
      value: "",
    };
    commit({ ...body, metadata: [...body.metadata, next] });
  }, [body, commit]);

  /** Updates a metadata tag. */
  const updateTag = useCallback(
    (id: string, patch: Partial<AudioMetadataTag>) => {
      commit({
        ...body,
        metadata: body.metadata.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry
        ),
      });
    },
    [body, commit]
  );

  /** Removes a metadata tag. */
  const removeTag = useCallback(
    (id: string) => {
      commit({
        ...body,
        metadata: body.metadata.filter((entry) => entry.id !== id),
      });
    },
    [body, commit]
  );

  /** Runs the conversion. */
  const convert = useCallback(async () => {
    if (!body.sourceDataUrl) return;
    setConverting(true);
    try {
      const result = await convertDataUrl(
        body.sourceDataUrl,
        body.targetFormat
      );
      const dataUrl = toDataUrl(result.bytes, result.mime);
      commit({
        ...body,
        lastConvertedAt: new Date().toISOString(),
        lastConvertedDataUrl: dataUrl,
        lastConvertedFormat: body.targetFormat,
        lastConvertedSize: result.bytes.byteLength,
      });
      if (!result.matched) {
        toast({
          message: `Browser cannot encode ${body.targetFormat.toUpperCase()} natively; the source was returned unchanged.`,
          tone: "info",
        });
      } else {
        toast({
          message: `Converted to ${body.targetFormat.toUpperCase()} (${formatBytes(
            result.bytes.byteLength
          )})`,
          tone: "success",
        });
      }
    } catch {
      toast({ message: "Conversion failed.", tone: "error" });
    } finally {
      setConverting(false);
    }
  }, [body, commit, toast]);

  /** Downloads the converted file. */
  const downloadConverted = useCallback(() => {
    if (!body.lastConvertedDataUrl) {
      toast({
        message: "Run the conversion first.",
        tone: "info",
      });
      return;
    }
    const baseName = body.fileName.replace(/\.[^.]+$/, "");
    const ext = body.lastConvertedFormat;
    const link = window.document.createElement("a");
    link.href = body.lastConvertedDataUrl;
    link.download = `${baseName || "converted"}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [body.fileName, body.lastConvertedDataUrl, body.lastConvertedFormat, toast]);

  /** Previews the converted file. */
  const previewConverted = useCallback(() => {
    if (!body.lastConvertedDataUrl) return;
    const audio = window.document.createElement("audio");
    audio.src = body.lastConvertedDataUrl;
    audio.controls = true;
    audio.style.width = "100%";
    const target = window.document.getElementById("converted-preview");
    if (!target) return;
    setPreviewing(true);
    target.replaceChildren(audio);
  }, [body.lastConvertedDataUrl]);

  /** Quick presets: clear / set common metadata blocks. */
  const applyPreset = useCallback(
    (preset: "minimal" | "broadcast" | "archive") => {
      if (preset === "minimal") {
        commit({ ...body, metadata: [] });
        return;
      }
      if (preset === "broadcast") {
        const tags: AudioMetadataTag[] = [
          { id: shortId("tag"), key: "artist", value: body.metadata[0]?.value ?? "" },
          { id: shortId("tag"), key: "title", value: body.metadata[1]?.value ?? "" },
          { id: shortId("tag"), key: "comment", value: "AudioPilot" },
        ];
        commit({ ...body, metadata: tags });
        return;
      }
      if (preset === "archive") {
        const tags: AudioMetadataTag[] = [
          { id: shortId("tag"), key: "artist", value: "" },
          { id: shortId("tag"), key: "title", value: "" },
          { id: shortId("tag"), key: "album", value: "" },
          { id: shortId("tag"), key: "year", value: String(new Date().getFullYear()) },
          { id: shortId("tag"), key: "genre", value: "" },
          { id: shortId("tag"), key: "composer", value: "" },
        ];
        commit({ ...body, metadata: tags });
      }
    },
    [body, commit]
  );

  const hasSource = body.sourceDataUrl.length > 0;
  const hasConverted = body.lastConvertedDataUrl.length > 0;

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
              Source {body.sourceFormat.toUpperCase()} ·{" "}
              {formatAudioDuration(body.sourceDurationSeconds)} ·{" "}
              {body.sourceSampleRate} Hz · {body.sourceChannels} ch
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
        <h3 className="mb-2 text-sm font-semibold">Target format</h3>
        <div className="flex flex-wrap items-center gap-3">
          <FormatPicker
            value={body.targetFormat}
            onChange={(v) => updateField("targetFormat", v)}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Bitrate</span>
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
              {BITRATES.map((bitrate) => (
                <button
                  key={bitrate}
                  type="button"
                  onClick={() => updateField("targetBitrateKbps", bitrate)}
                  className={
                    body.targetBitrateKbps === bitrate
                      ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
                      : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  }
                >
                  {bitrate}
                </button>
              ))}
              <span className="px-1 text-[10px] text-muted-foreground">kbps</span>
            </div>
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={convert}
              disabled={!hasSource || converting}
            >
              {converting ? "Converting…" : "Convert"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Metadata</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => applyPreset("minimal")}
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => applyPreset("broadcast")}
            >
              Broadcast
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => applyPreset("archive")}
            >
              Archive
            </button>
          </div>
        </div>
        {body.metadata.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No metadata tags. Add one to attach artist, title, album, year, genre,
            composer or any free-form key.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {body.metadata.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2">
                <Input
                  value={entry.key}
                  onChange={(event) =>
                    updateTag(entry.id, { key: event.target.value })
                  }
                  placeholder="key"
                  className="h-7 w-32 text-xs"
                />
                <Input
                  value={entry.value}
                  onChange={(event) =>
                    updateTag(entry.id, { value: event.target.value })
                  }
                  placeholder="value"
                  className="h-7 flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeTag(entry.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${entry.key || "tag"}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-8 gap-1.5 px-2.5 text-xs"
          onClick={addTag}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add metadata tag
        </Button>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Result</h3>
        {!hasConverted ? (
          <p className="text-[11px] text-muted-foreground">
            The converted file will be available here after you hit Convert.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Last converted {new Date(body.lastConvertedAt).toLocaleString()} ·{" "}
              {FORMAT_LABELS[body.lastConvertedFormat]} ·{" "}
              {formatBytes(body.lastConvertedSize)}
            </p>
            <div id="converted-preview" className="rounded-md border border-border bg-muted/30 p-2">
              <p className="text-[11px] text-muted-foreground">
                Click Preview to play the result in the page.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={previewConverted}
              >
                Preview
              </Button>
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={downloadConverted}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const DEFAULT_BODY_RESET: AudioConverterBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  sourceDurationSeconds: 0,
  sourceSampleRate: 44_100,
  sourceChannels: 2,
  targetFormat: "mp3",
  targetBitrateKbps: 192,
  metadata: [],
  lastConvertedAt: "",
  lastConvertedDataUrl: "",
  lastConvertedFormat: "mp3",
  lastConvertedSize: 0,
  isFavorite: false,
};

interface FormatPickerProps {
  value: AudioFormat;
  onChange: (value: AudioFormat) => void;
}

function FormatPicker({ value, onChange }: FormatPickerProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]"
      role="group"
      aria-label="Target format"
    >
      {FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          onClick={() => onChange(format)}
          className={
            value === format
              ? "rounded bg-primary px-2 py-1 text-primary-foreground"
              : "rounded px-2 py-1 text-muted-foreground hover:text-foreground"
          }
        >
          {FORMAT_LABELS[format]}
        </button>
      ))}
    </div>
  );
}
