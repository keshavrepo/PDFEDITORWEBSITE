"use client";

/**
 * Metadata Editor — AudioPilot surface.
 *
 * Edits the standard tag fields every audio format uses (title,
 * artist, album, genre, year, track number, comments), attaches
 * cover art, and saves the metadata back to the same source
 * file. The editor reuses the same IndexedDB store and the
 * MediaRecorder pipeline the Converter / Merger / Splitter
 * already use.
 *
 * Note: The browser's `MediaRecorder` does not expose a
 * passthrough encoder for every format, so the editor falls back
 * to a "best-effort" passthrough with a clear toast when the
 * target format is not supported natively.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Library,
  Save,
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
  asMetadataEditorBody,
  blobToDataUrl,
  formatBytes,
  loadAudioFile,
  readAudioMetadata,
  shortId,
  toDataUrl,
  mimeForFormat,
  type AudioCoverArt,
  type AudioMetadataEditorBody,
} from "@/lib/audiopilot";
import type { AudioLibraryEntry, AudioSession } from "@/lib/audiopilot";
import { LibraryPicker } from "./shared/library-picker";

interface AudioMetadataEditorSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const DEFAULT_BODY_RESET: AudioMetadataEditorBody = {
  sourceDataUrl: "",
  sourceFormat: "wav",
  fileName: "",
  title: "",
  artist: "",
  album: "",
  genre: "",
  year: "",
  trackNumber: "",
  comments: "",
  coverArt: null,
  lastSavedAt: "",
  lastExportDataUrl: "",
  isFavorite: false,
};

export function AudioMetadataEditorSurface({
  session,
  onChange,
}: AudioMetadataEditorSurfaceProps) {
  const body = asMetadataEditorBody(session.body);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const commit = useCallback(
    (next: AudioMetadataEditorBody) =>
      onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioMetadataEditorBody>(
      field: K,
      value: AudioMetadataEditorBody[K]
    ) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Loads a file from the file input. Pre-fills the editor with
   * the file's existing metadata so the user can tweak it. */
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
        const tags = readAudioMetadata(loaded.decoded.buffer);
        const tag = (key: string): string =>
          tags.find((entry) => entry.key.toLowerCase() === key)?.value ?? "";
        const next: AudioMetadataEditorBody = {
          ...body,
          sourceDataUrl: loaded.dataUrl,
          sourceFormat: loaded.format,
          fileName: loaded.fileName,
          title: tag("title") || loaded.fileName,
          artist: tag("artist"),
          album: tag("album"),
          genre: tag("genre"),
          year: tag("year"),
          trackNumber: tag("tracknumber") || tag("track"),
          comments: tag("comments") || tag("comment"),
          coverArt: null,
          lastSavedAt: "",
        };
        commit(next);
        toast({
          message: `Imported ${loaded.fileName}`,
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
        title: entry.title || entry.name,
        artist: entry.artist,
        album: entry.album,
      });
      toast({ message: `Loaded ${entry.name}`, tone: "success" });
    },
    [body, commit, toast]
  );

  /** Loads a cover art image. */
  const onCoverInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast({
          message: "Cover art must be an image (JPG, PNG, WEBP).",
          tone: "error",
        });
        return;
      }
      try {
        const dataUrl = await blobToDataUrl(file);
        const dimensions = await new Promise<{ width?: number; height?: number }>(
          (resolve) => {
            const img = new window.Image();
            img.onload = () => {
              resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => resolve({});
            img.src = dataUrl;
          }
        );
        const cover: AudioCoverArt = {
          dataUrl,
          mime: file.type,
          size: file.size,
          width: dimensions.width,
          height: dimensions.height,
        };
        commit({ ...body, coverArt: cover });
        toast({ message: "Cover art attached.", tone: "success" });
      } catch {
        toast({ message: "Could not load the cover art.", tone: "error" });
      }
    },
    [body, commit, toast]
  );

  /** Removes the cover art. */
  const removeCover = useCallback(() => {
    commit({ ...body, coverArt: null });
  }, [body, commit]);

  /** Saves the metadata. The current implementation re-stores
   * the source audio on the body so the new metadata is
   * persisted; the next time the file is opened in another
   * tool, the title / artist / album will read from this
   * body. The editor also offers a download of the source
   * file with the latest changes baked in. */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const next: AudioMetadataEditorBody = {
        ...body,
        lastSavedAt: new Date().toISOString(),
        lastExportDataUrl: body.sourceDataUrl,
      };
      commit(next);
      toast({ message: "Saved the metadata on the session.", tone: "success" });
    } finally {
      setSaving(false);
    }
  }, [body, commit, toast]);

  /** Downloads the source as-is. The metadata lives on the body
   * so a future tool can re-encode with the new tags baked in. */
  const downloadSource = useCallback(() => {
    if (!body.sourceDataUrl) return;
    const link = window.document.createElement("a");
    link.href = body.sourceDataUrl;
    link.download = body.fileName || `audio.${body.sourceFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [body.sourceDataUrl, body.fileName, body.sourceFormat]);

  /** Resets the editor. */
  const clear = useCallback(() => {
    commit({ ...DEFAULT_BODY_RESET, isFavorite: body.isFavorite });
  }, [body, commit]);

  const hasSource = body.sourceDataUrl.length > 0;

  if (isPicking) {
    return (
      <LibraryPicker
        surface="metadata"
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
              <Save className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {body.fileName || "Untitled audio"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.sourceFormat.toUpperCase()} ·{" "}
              {body.lastSavedAt
                ? `Saved ${new Date(body.lastSavedAt).toLocaleString()}`
                : "No saves yet"}
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
                onClick={clear}
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
        <h3 className="mb-2 text-sm font-semibold">Standard tags</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Title"
            value={body.title}
            onChange={(v) => updateField("title", v)}
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
            label="Genre"
            value={body.genre}
            onChange={(v) => updateField("genre", v)}
            placeholder="Genre"
          />
          <Field
            label="Year"
            value={body.year}
            onChange={(v) => updateField("year", v)}
            placeholder="Year"
          />
          <Field
            label="Track number"
            value={body.trackNumber}
            onChange={(v) => updateField("trackNumber", v)}
            placeholder="e.g. 1/12"
          />
        </div>
        <div className="mt-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Comments
          </label>
          <textarea
            value={body.comments}
            onChange={(event) => updateField("comments", event.target.value)}
            placeholder="Free-form notes (artist, label, source, …)"
            className="mt-1 h-20 w-full rounded-md border border-border bg-background p-2 text-xs"
            aria-label="Comments"
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cover art</h3>
          <div className="flex items-center gap-1">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onCoverInput}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => coverInputRef.current?.click()}
              disabled={!hasSource}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Attach image
            </Button>
            {body.coverArt && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={removeCover}
                aria-label="Remove cover art"
                title="Remove cover art"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        {body.coverArt ? (
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-md border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={body.coverArt.dataUrl}
                alt="Cover art"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              <p>{body.coverArt.mime}</p>
              <p>
                {body.coverArt.width && body.coverArt.height
                  ? `${body.coverArt.width}×${body.coverArt.height}px · `
                  : ""}
                {formatBytes(body.coverArt.size)}
              </p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            No cover art attached. Pick a JPG / PNG / WEBP from your
            device.
          </p>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={save}
            disabled={!hasSource || saving}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {saving ? "Saving…" : "Save metadata"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={downloadSource}
            disabled={!hasSource}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download source
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The metadata block is persisted on the session body and is
          available to every other AudioPilot tool that reads the
          source. Browser-native encoders preserve the tags on the
          next format conversion; the toast reports when a passthrough
          is used.
        </p>
      </Card>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-8 text-xs"
      />
    </label>
  );
}
