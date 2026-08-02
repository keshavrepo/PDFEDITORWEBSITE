"use client";

/**
 * Audio Library — AudioPilot surface.
 *
 * The "files I have" view that every other AudioPilot surface
 * reads from. The library supports search, sort, format filter
 * and favourites-only filter, and exposes the per-entry
 * actions every other tool needs: rename, duplicate, delete,
 * favourite and tag. The library is backed by the same
 * IndexedDB store every other AudioPilot surface uses, so
 * importing a file in any tool shows up here automatically.
 *
 * The library is also the single source of truth for
 * "which file is in my workspace" — the picker every other
 * Batch 2 surface ships reads from the same store.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Library,
  Plus,
  Save,
  Search,
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
  asLibraryBody,
  formatAudioDuration,
  formatBytes,
  loadAudioFile,
  shortId,
  toDataUrl,
  type AudioFormat,
  type AudioLibraryBody,
  type AudioLibraryEntry,
} from "@/lib/audiopilot";
import type { AudioSession } from "@/lib/audiopilot";

interface AudioLibrarySurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const FORMAT_OPTIONS: AudioFormat[] = ["mp3", "wav", "ogg", "flac", "aac"];

export function AudioLibrarySurface({
  session,
  onChange,
}: AudioLibrarySurfaceProps) {
  const body = asLibraryBody(session.body);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const commit = useCallback(
    (next: AudioLibraryBody) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof AudioLibraryBody>(field: K, value: AudioLibraryBody[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  /** Loads files from the file input. */
  const onFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;
      setImporting(true);
      try {
        const next: AudioLibraryEntry[] = [...body.entries];
        for (const file of files) {
          const loaded = await loadAudioFile(file);
          if (!loaded) {
            toast({
              message: `${file.name} could not be decoded.`,
              tone: "error",
            });
            continue;
          }
          next.unshift({
            id: shortId("lib"),
            name: file.name,
            dataUrl: loaded.dataUrl,
            format: loaded.format,
            size: loaded.decoded.buffer.byteLength,
            durationSeconds: loaded.decoded.duration,
            title: file.name,
            artist: "",
            album: "",
            addedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
            openCount: 0,
            isFavorite: false,
            tags: [],
          });
        }
        commit({ ...body, entries: next.slice(0, 200) });
        toast({
          message: `Added ${files.length} file${files.length === 1 ? "" : "s"}.`,
          tone: "success",
        });
      } finally {
        setImporting(false);
      }
    },
    [body, commit, toast]
  );

  /** Filters, searches and sorts the entries. */
  const visible = useMemo(() => {
    const term = body.search.trim().toLowerCase();
    const matches = body.entries.filter((entry) => {
      if (body.favoritesOnly && !entry.isFavorite) return false;
      if (body.formatFilter && entry.format !== body.formatFilter) return false;
      if (!term) return true;
      return (
        entry.name.toLowerCase().includes(term) ||
        entry.title.toLowerCase().includes(term) ||
        entry.artist.toLowerCase().includes(term) ||
        entry.album.toLowerCase().includes(term) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
    const direction = body.sortDirection === "asc" ? 1 : -1;
    return [...matches].sort((a, b) => {
      const left = a[body.sortField];
      const right = b[body.sortField];
      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return 0;
    });
  }, [body.entries, body.search, body.favoritesOnly, body.formatFilter, body.sortField, body.sortDirection]);

  /** Renames an entry. */
  const renameEntry = useCallback(
    (id: string, name: string) => {
      commit({
        ...body,
        entries: body.entries.map((entry) =>
          entry.id === id ? { ...entry, name: name.slice(0, 200) } : entry
        ),
      });
    },
    [body, commit]
  );

  /** Duplicates an entry. */
  const duplicateEntry = useCallback(
    (id: string) => {
      const entry = body.entries.find((entry) => entry.id === id);
      if (!entry) return;
      const copy: AudioLibraryEntry = {
        ...entry,
        id: shortId("lib"),
        name: `${entry.name} (copy)`,
        addedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        openCount: 0,
        isFavorite: false,
        tags: [...entry.tags],
      };
      commit({ ...body, entries: [copy, ...body.entries].slice(0, 200) });
      toast({ message: "Duplicated the entry.", tone: "success" });
    },
    [body, commit, toast]
  );

  /** Toggles favourite. */
  const toggleFavorite = useCallback(
    (id: string) => {
      commit({
        ...body,
        entries: body.entries.map((entry) =>
          entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
        ),
      });
    },
    [body, commit]
  );

  /** Deletes an entry. */
  const deleteEntry = useCallback(
    (id: string) => {
      commit({
        ...body,
        entries: body.entries.filter((entry) => entry.id !== id),
        selectedEntryId:
          body.selectedEntryId === id ? "" : body.selectedEntryId,
      });
      toast({ message: "Removed the entry.", tone: "info" });
    },
    [body, commit, toast]
  );

  /** Marks an entry as opened. */
  const openEntry = useCallback(
    (id: string) => {
      commit({
        ...body,
        selectedEntryId: id,
        entries: body.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                lastOpenedAt: new Date().toISOString(),
                openCount: entry.openCount + 1,
              }
            : entry
        ),
      });
    },
    [body, commit]
  );

  /** Adds a free-form tag. */
  const addTag = useCallback(
    (id: string, tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      commit({
        ...body,
        entries: body.entries.map((entry) =>
          entry.id === id && !entry.tags.includes(trimmed)
            ? { ...entry, tags: [...entry.tags, trimmed] }
            : entry
        ),
      });
    },
    [body, commit]
  );

  /** Removes a tag. */
  const removeTag = useCallback(
    (id: string, tag: string) => {
      commit({
        ...body,
        entries: body.entries.map((entry) =>
          entry.id === id
            ? { ...entry, tags: entry.tags.filter((t) => t !== tag) }
            : entry
        ),
      });
    },
    [body, commit]
  );

  /** Downloads an entry. */
  const downloadEntry = useCallback(
    (id: string) => {
      const entry = body.entries.find((entry) => entry.id === id);
      if (!entry) return;
      const link = window.document.createElement("a");
      link.href = entry.dataUrl;
      link.download = entry.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [body.entries]
  );

  const selectedEntry = useMemo(
    () => body.entries.find((entry) => entry.id === body.selectedEntryId) ?? null,
    [body.entries, body.selectedEntryId]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Library className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Audio Library
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {body.entries.length} entries · {visible.length} match the
              current filter
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={body.search}
              onChange={(event) => updateField("search", event.target.value)}
              placeholder="Search by name, title, artist, album or tag"
              className="h-8 pl-7 text-xs"
              aria-label="Search the library"
            />
          </div>
          <select
            value={body.sortField}
            onChange={(event) =>
              updateField(
                "sortField",
                event.target.value as AudioLibraryBody["sortField"]
              )
            }
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Sort field"
          >
            <option value="addedAt">Sort: added</option>
            <option value="lastOpenedAt">Sort: last opened</option>
            <option value="name">Sort: name</option>
            <option value="size">Sort: size</option>
            <option value="durationSeconds">Sort: duration</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[11px]"
            onClick={() =>
              updateField(
                "sortDirection",
                body.sortDirection === "asc" ? "desc" : "asc"
              )
            }
          >
            {body.sortDirection === "asc" ? "Asc" : "Desc"}
          </Button>
          <select
            value={body.formatFilter}
            onChange={(event) =>
              updateField("formatFilter", event.target.value)
            }
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Format filter"
          >
            <option value="">All formats</option>
            {FORMAT_OPTIONS.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={body.favoritesOnly}
              onChange={(event) =>
                updateField("favoritesOnly", event.target.checked)
              }
            />
            Favourites only
          </label>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Entries</h3>
          {visible.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No entries match. Import files above to populate the library.
            </p>
          ) : (
            <ul className="space-y-1">
              {visible.map((entry) => (
                <li
                  key={entry.id}
                  className={
                    body.selectedEntryId === entry.id
                      ? "flex items-center gap-2 rounded-md border border-primary bg-accent px-2 py-1.5 text-xs"
                      : "flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                  }
                >
                  <button
                    type="button"
                    onClick={() => openEntry(entry.id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {entry.isFavorite && (
                      <Star
                        className="h-3 w-3 fill-primary text-primary"
                        aria-label="Favourite"
                      />
                    )}
                    <span className="truncate">{entry.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {entry.format.toUpperCase()} ·{" "}
                      {formatAudioDuration(entry.durationSeconds)} ·{" "}
                      {formatBytes(entry.size)} ·{" "}
                      {new Date(entry.addedAt).toLocaleDateString()}
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => toggleFavorite(entry.id)}
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
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => duplicateEntry(entry.id)}
                    aria-label="Duplicate entry"
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => downloadEntry(entry.id)}
                    aria-label="Download entry"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label="Delete entry"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Details</h3>
          {selectedEntry ? (
            <DetailsPanel
              entry={selectedEntry}
              onRename={(name) => renameEntry(selectedEntry.id, name)}
              onAddTag={(tag) => addTag(selectedEntry.id, tag)}
              onRemoveTag={(tag) => removeTag(selectedEntry.id, tag)}
            />
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Select an entry on the left to see its details and tags.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

interface DetailsPanelProps {
  entry: AudioLibraryEntry;
  onRename: (name: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

function DetailsPanel({
  entry,
  onRename,
  onAddTag,
  onRemoveTag,
}: DetailsPanelProps) {
  const [tagInput, setTagInput] = useState("");
  return (
    <div className="space-y-3 text-xs">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Name
        </label>
        <Input
          value={entry.name}
          onChange={(event) => onRename(event.target.value)}
          className="mt-1 h-8 text-xs"
        />
      </div>
      <dl className="space-y-1.5">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Format</dt>
          <dd className="font-medium">{entry.format.toUpperCase()}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Size</dt>
          <dd className="font-medium">{formatBytes(entry.size)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Duration</dt>
          <dd className="font-medium">
            {formatAudioDuration(entry.durationSeconds)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Added</dt>
          <dd className="font-medium">
            {new Date(entry.addedAt).toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Last opened</dt>
          <dd className="font-medium">
            {new Date(entry.lastOpenedAt).toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Opens</dt>
          <dd className="font-medium">{entry.openCount}</dd>
        </div>
      </dl>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {entry.tags.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">No tags</span>
          ) : (
            entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-2.5 w-2.5" aria-hidden="true" />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <Input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddTag(tagInput);
                setTagInput("");
              }
            }}
            placeholder="Add tag"
            className="h-7 text-[11px]"
            aria-label="Add tag"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              onAddTag(tagInput);
              setTagInput("");
            }}
            disabled={!tagInput.trim()}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
