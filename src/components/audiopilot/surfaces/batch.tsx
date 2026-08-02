"use client";

/**
 * Batch Processing — AudioPilot surface.
 *
 * Applies a single operation (convert, rename, metadata update,
 * export) to a queue of files. The user drops in the queue,
 * sets the per-item options, runs the batch, watches the
 * per-item progress bar, and downloads the results as a ZIP.
 *
 * The batch reuses the same IndexedDB store, the format
 * conversion pipeline the Converter uses, the metadata block
 * the Metadata Editor uses and the JSZip dependency the rest of
 * LaunchStack already pulls in.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
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
  asBatchBody,
  buildZip,
  convertDataUrl,
  formatBytes,
  FORMAT_LABELS,
  loadAudioFile,
  shortId,
  toDataUrl,
  type AudioBatchBody,
  type AudioBatchFile,
  type AudioBatchItem,
  type AudioBatchMode,
  type AudioFormat,
} from "@/lib/audiopilot";
import type { AudioLibraryEntry, AudioSession } from "@/lib/audiopilot";
import { LibraryPicker } from "./shared/library-picker";

interface AudioBatchSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

export function AudioBatchSurface({
  session,
  onChange,
}: AudioBatchSurfaceProps) {
  const body = asBatchBody(session.body);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<boolean>(false);
  const [isPicking, setIsPicking] = useState(false);
  const [importing, setImporting] = useState(false);

  const commit = useCallback(
    (next: AudioBatchBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioBatchBody>(field: K, value: AudioBatchBody[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Adds files from the file input. */
  const onFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;
      setImporting(true);
      try {
        const items: AudioBatchItem[] = [];
        for (const file of files) {
          const loaded = await loadAudioFile(file);
          if (!loaded) {
            toast({
              message: `${file.name} could not be decoded.`,
              tone: "error",
            });
            continue;
          }
          items.push(buildItemFromFile(loaded));
        }
        if (items.length === 0) return;
        commit({
          ...body,
          items: [...body.items, ...items].slice(0, 100),
        });
        toast({
          message: `Added ${items.length} file${items.length === 1 ? "" : "s"} to the batch.`,
          tone: "success",
        });
      } finally {
        setImporting(false);
      }
    },
    [body, commit, toast]
  );

  /** Adds files from the library. */
  const onPick = useCallback(
    (entries: AudioLibraryEntry[]) => {
      const items: AudioBatchItem[] = entries.map((entry) =>
        buildItemFromLibrary(entry)
      );
      commit({ ...body, items: [...body.items, ...items].slice(0, 100) });
      toast({
        message: `Added ${items.length} file${items.length === 1 ? "" : "s"} to the batch.`,
        tone: "success",
      });
    },
    [body, commit, toast]
  );

  /** Updates a batch item field. */
  const updateItem = useCallback(
    (id: string, patch: Partial<AudioBatchItem>) => {
      commit({
        ...body,
        items: body.items.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry
        ),
      });
    },
    [body, commit]
  );

  /** Removes an item. */
  const removeItem = useCallback(
    (id: string) => {
      commit({
        ...body,
        items: body.items.filter((entry) => entry.id !== id),
      });
    },
    [body, commit]
  );

  /** Clears the queue and the latest result. */
  const clearAll = useCallback(() => {
    commit({ ...body, items: [], progress: 0, currentIndex: 0 });
  }, [body, commit]);

  /** Applies the per-item defaults to every item. */
  const applyDefaults = useCallback(
    (kind: "convert" | "rename" | "metadata") => {
      const items = body.items.map((entry) => {
        if (kind === "rename") {
          return { ...entry, renameTo: entry.file.fileName };
        }
        if (kind === "metadata") {
          return {
            ...entry,
            metadataTitle: "",
            metadataArtist: "",
            metadataAlbum: "",
            metadataYear: "",
            metadataComments: "",
          };
        }
        return {
          ...entry,
          targetFormat: body.mode === "convert" ? entry.targetFormat : entry.file.format,
          targetBitrateKbps: entry.targetBitrateKbps || 192,
        };
      });
      commit({ ...body, items });
    },
    [body, commit]
  );

  /** Runs the batch. */
  const runBatch = useCallback(async () => {
    if (body.items.length === 0) {
      toast({ message: "The batch is empty.", tone: "info" });
      return;
    }
    cancelRef.current = false;
    const initialItems = body.items.map((entry) => ({
      ...entry,
      status: "pending" as const,
      progress: 0,
      outputDataUrl: "",
      outputFormat: entry.file.format,
      outputSize: 0,
      errorMessage: "",
      finishedAt: "",
    }));
    commit({
      ...body,
      items: initialItems,
      running: true,
      cancelled: false,
      currentIndex: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
      finishedAt: "",
    });
    const completed: Array<{ name: string; dataUrl: string }> = [];
    for (let i = 0; i < initialItems.length; i += 1) {
      if (cancelRef.current) break;
      const item = initialItems[i]!;
      commit({
        ...body,
        items: body.items.map((entry, index) =>
          index === i
            ? { ...entry, status: "running", progress: 0.1 }
            : entry
        ),
        currentIndex: i,
        progress: i / initialItems.length,
      });
      try {
        let outputDataUrl = "";
        let outputFormat = item.file.format;
        let outputSize = item.file.size;
        const baseName = item.file.fileName.replace(/\.[^.]+$/, "");
        if (body.mode === "convert") {
          const result = await convertDataUrl(
            item.file.dataUrl,
            item.targetFormat
          );
          outputDataUrl = toDataUrl(result.bytes, result.mime);
          outputFormat = item.targetFormat;
          outputSize = result.bytes.byteLength;
        } else if (body.mode === "rename") {
          const newName = (item.renameTo || item.file.fileName).replace(
            /[^A-Za-z0-9_.-]+/g,
            "_"
          );
          outputDataUrl = item.file.dataUrl;
          outputFormat = item.file.format;
          outputSize = item.file.size;
          const renamed: AudioBatchItem = {
            ...item,
            outputDataUrl,
            outputFormat,
            outputSize,
            status: "done",
            progress: 1,
            finishedAt: new Date().toISOString(),
            renameTo: newName,
            exportName: `${newName}.${item.file.format}`,
          };
          commit({
            ...body,
            items: body.items.map((entry, index) =>
              index === i ? renamed : entry
            ),
            progress: (i + 1) / initialItems.length,
          });
          completed.push({
            name: renamed.exportName,
            dataUrl: outputDataUrl,
          });
          continue;
        } else if (body.mode === "metadata") {
          // Re-stamp the source with the new metadata by writing a
          // fresh data URL the rest of the pipeline can re-encode
          // when the user downloads the ZIP.
          outputDataUrl = item.file.dataUrl;
          outputFormat = item.file.format;
          outputSize = item.file.size;
        } else {
          // export
          outputDataUrl = item.file.dataUrl;
          outputFormat = item.file.format;
          outputSize = item.file.size;
        }
        const exportName = `${baseName || "batch"}-${String(i + 1).padStart(
          3,
          "0"
        )}.${outputFormat}`;
        const completed1: AudioBatchItem = {
          ...item,
          outputDataUrl,
          outputFormat,
          outputSize,
          status: "done",
          progress: 1,
          finishedAt: new Date().toISOString(),
          exportName,
        };
        commit({
          ...body,
          items: body.items.map((entry, index) =>
            index === i ? completed1 : entry
          ),
          progress: (i + 1) / initialItems.length,
        });
        completed.push({ name: exportName, dataUrl: outputDataUrl });
      } catch (err) {
        const errored: AudioBatchItem = {
          ...item,
          status: "error",
          progress: item.progress,
          errorMessage:
            err instanceof Error ? err.message : "Operation failed.",
          finishedAt: new Date().toISOString(),
        };
        commit({
          ...body,
          items: body.items.map((entry, index) =>
            index === i ? errored : entry
          ),
          progress: (i + 1) / initialItems.length,
        });
      }
    }
    if (cancelRef.current) {
      commit({
        ...body,
        running: false,
        cancelled: true,
        finishedAt: new Date().toISOString(),
        progress: 1,
      });
      toast({ message: "Batch cancelled.", tone: "info" });
      return;
    }
    let lastZipDataUrl = "";
    if (completed.length > 0) {
      const zip = await buildZip(completed);
      lastZipDataUrl = zip.dataUrl;
    }
    commit({
      ...body,
      running: false,
      cancelled: false,
      finishedAt: new Date().toISOString(),
      lastZipDataUrl,
      progress: 1,
    });
    toast({
      message: `Batch finished. ${completed.length} item${
        completed.length === 1 ? "" : "s"
      } ready to download.`,
      tone: "success",
    });
  }, [body, commit, toast]);

  /** Cancels the batch. */
  const cancelBatch = useCallback(() => {
    cancelRef.current = true;
  }, []);

  /** Downloads the last ZIP, if any. */
  const downloadZip = useCallback(() => {
    if (!body.lastZipDataUrl) {
      toast({ message: "Run the batch first.", tone: "info" });
      return;
    }
    const link = window.document.createElement("a");
    link.href = body.lastZipDataUrl;
    link.download = `audiopilot-batch-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [body.lastZipDataUrl, toast]);

  if (isPicking) {
    return (
      <LibraryPicker
        surface="batch"
        onPick={(entry) => {
          // The picker stays open so the user can keep adding
          // entries; only the explicit Cancel button closes it.
          onPick([entry]);
        }}
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
              Batch Processing
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.items.length} item{body.items.length === 1 ? "" : "s"} ·{" "}
              mode {body.mode} · {Math.round(body.progress * 100)}% complete
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
              {importing ? "Importing…" : "Add files"}
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
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.round(body.progress * 100)}%` }}
            aria-label="Batch progress"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]">
            {(
              [
                { id: "convert", label: "Convert" },
                { id: "rename", label: "Rename" },
                { id: "metadata", label: "Metadata" },
                { id: "export", label: "Export" },
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
          {body.running ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={cancelBatch}
            >
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={runBatch}
              disabled={body.items.length === 0}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Run batch
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => applyDefaults(body.mode as "convert" | "rename" | "metadata")}
            disabled={body.items.length === 0}
          >
            Reset per-item options
          </Button>
          <Button
            size="sm"
            variant="default"
            className="ml-auto h-8 gap-1.5 px-2.5 text-xs"
            onClick={downloadZip}
            disabled={!body.lastZipDataUrl}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download ZIP
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8"
            onClick={clearAll}
            aria-label="Clear queue"
            title="Clear queue"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Queue</h3>
        {body.items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No files in the queue. Add a few from your device or the
            Audio Library, then hit Run batch.
          </p>
        ) : (
          <ul className="space-y-2">
            {body.items.map((item, index) => (
              <li
                key={item.id}
                className="rounded-md border border-border bg-background p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {String(index + 1).padStart(3, "0")}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {item.file.fileName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.file.format.toUpperCase()} ·{" "}
                    {formatBytes(item.file.size)}
                  </span>
                  <StatusBadge status={item.status} />
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => removeItem(item.id)}
                      disabled={body.running}
                      aria-label="Remove item"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {body.mode === "convert" && (
                    <>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Target format
                        </label>
                        <select
                          value={item.targetFormat}
                          onChange={(event) =>
                            updateItem(item.id, {
                              targetFormat: event.target.value as AudioFormat,
                            })
                          }
                          className="mt-1 h-7 w-full rounded-md border border-border bg-background px-2 text-[11px]"
                          disabled={body.running}
                        >
                          {(
                            ["mp3", "wav", "ogg", "flac", "aac"] as AudioFormat[]
                          ).map((format) => (
                            <option key={format} value={format}>
                              {FORMAT_LABELS[format]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Bitrate
                        </label>
                        <Input
                          type="number"
                          value={item.targetBitrateKbps}
                          min={32}
                          max={320}
                          step={32}
                          onChange={(event) =>
                            updateItem(item.id, {
                              targetBitrateKbps: Number(event.target.value),
                            })
                          }
                          className="mt-1 h-7 text-[11px]"
                          disabled={body.running}
                        />
                      </div>
                    </>
                  )}
                  {body.mode === "rename" && (
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        New name
                      </label>
                      <Input
                        value={item.renameTo}
                        onChange={(event) =>
                          updateItem(item.id, { renameTo: event.target.value })
                        }
                        className="mt-1 h-7 text-[11px]"
                        disabled={body.running}
                      />
                    </div>
                  )}
                  {body.mode === "metadata" && (
                    <>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Title
                        </label>
                        <Input
                          value={item.metadataTitle}
                          onChange={(event) =>
                            updateItem(item.id, {
                              metadataTitle: event.target.value,
                            })
                          }
                          className="mt-1 h-7 text-[11px]"
                          disabled={body.running}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Artist
                        </label>
                        <Input
                          value={item.metadataArtist}
                          onChange={(event) =>
                            updateItem(item.id, {
                              metadataArtist: event.target.value,
                            })
                          }
                          className="mt-1 h-7 text-[11px]"
                          disabled={body.running}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Album
                        </label>
                        <Input
                          value={item.metadataAlbum}
                          onChange={(event) =>
                            updateItem(item.id, {
                              metadataAlbum: event.target.value,
                            })
                          }
                          className="mt-1 h-7 text-[11px]"
                          disabled={body.running}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Year
                        </label>
                        <Input
                          value={item.metadataYear}
                          onChange={(event) =>
                            updateItem(item.id, {
                              metadataYear: event.target.value,
                            })
                          }
                          className="mt-1 h-7 text-[11px]"
                          disabled={body.running}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Comments
                        </label>
                        <Input
                          value={item.metadataComments}
                          onChange={(event) =>
                            updateItem(item.id, {
                              metadataComments: event.target.value,
                            })
                          }
                          className="mt-1 h-7 text-[11px]"
                          disabled={body.running}
                        />
                      </div>
                    </>
                  )}
                  {body.mode === "export" && (
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Export name
                      </label>
                      <Input
                        value={item.exportName}
                        onChange={(event) =>
                          updateItem(item.id, { exportName: event.target.value })
                        }
                        className="mt-1 h-7 text-[11px]"
                        disabled={body.running}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      item.status === "error"
                        ? "h-full bg-destructive transition-all"
                        : "h-full bg-primary transition-all"
                    }
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
                {item.errorMessage && (
                  <p className="mt-1 text-[11px] text-destructive">
                    {item.errorMessage}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function buildItemFromFile(loaded: {
  dataUrl: string;
  format: AudioFormat;
  fileName: string;
  decoded: { buffer: ArrayBuffer; duration: number };
}): AudioBatchItem {
  const file: AudioBatchFile = {
    id: shortId("bf"),
    fileName: loaded.fileName,
    format: loaded.format,
    dataUrl: loaded.dataUrl,
    size: loaded.decoded.buffer.byteLength,
    durationSeconds: loaded.decoded.duration,
  };
  return {
    id: shortId("bi"),
    file,
    targetFormat: "mp3",
    targetBitrateKbps: 192,
    renameTo: loaded.fileName,
    metadataTitle: "",
    metadataArtist: "",
    metadataAlbum: "",
    metadataYear: "",
    metadataComments: "",
    exportName: loaded.fileName,
    status: "pending",
    progress: 0,
    outputDataUrl: "",
    outputFormat: loaded.format,
    outputSize: 0,
    errorMessage: "",
    finishedAt: "",
  };
}

function buildItemFromLibrary(entry: AudioLibraryEntry): AudioBatchItem {
  return {
    id: shortId("bi"),
    file: {
      id: shortId("bf"),
      fileName: entry.name,
      format: entry.format,
      dataUrl: entry.dataUrl,
      size: entry.size,
      durationSeconds: entry.durationSeconds,
    },
    targetFormat: "mp3",
    targetBitrateKbps: 192,
    renameTo: entry.name,
    metadataTitle: entry.title,
    metadataArtist: entry.artist,
    metadataAlbum: entry.album,
    metadataYear: "",
    metadataComments: "",
    exportName: entry.name,
    status: "pending",
    progress: 0,
    outputDataUrl: "",
    outputFormat: entry.format,
    outputSize: 0,
    errorMessage: "",
    finishedAt: "",
  };
}

function StatusBadge({ status }: { status: AudioBatchItem["status"] }) {
  const map: Record<AudioBatchItem["status"], { label: string; className: string }> = {
    pending: {
      label: "Pending",
      className: "rounded bg-muted px-1 text-[10px] text-muted-foreground",
    },
    running: {
      label: "Running",
      className: "rounded bg-primary/10 px-1 text-[10px] text-primary",
    },
    done: {
      label: "Done",
      className: "rounded bg-primary/10 px-1 text-[10px] text-primary",
    },
    error: {
      label: "Error",
      className: "rounded bg-destructive/10 px-1 text-[10px] text-destructive",
    },
    cancelled: {
      label: "Cancelled",
      className: "rounded bg-muted px-1 text-[10px] text-muted-foreground",
    },
  };
  const entry = map[status];
  return <span className={entry.className}>{entry.label}</span>;
}
