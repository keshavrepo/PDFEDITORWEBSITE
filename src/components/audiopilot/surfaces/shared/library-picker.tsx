"use client";

/**
 * Library picker — shared by every AudioPilot surface that
 * needs to pull an existing entry from the Audio Library.
 *
 * The picker reads the library IndexedDB store, lists the
 * entries, lets the user search and filter, and on pick
 * invokes `onPick` with the chosen entry's data URL and
 * metadata. The picker does not write back to the library —
 * the surface that imports the file is responsible for
 * tracking the import.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, Search, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../../toast";
import {
  asLibraryBody,
  formatAudioDuration,
  formatBytes,
  loadAudioFile,
  shortId,
  type AudioLibraryEntry,
} from "@/lib/audiopilot";
import { listSessionsStorage, getSessionStorage } from "@/lib/audiopilot";

interface LibraryPickerProps {
  /** Optional surface id used to filter the picker (e.g. "trimmer"). */
  surface?: string;
  /** Called when the user picks an entry. */
  onPick: (entry: AudioLibraryEntry) => void;
  /** Called when the user cancels the picker. */
  onCancel: () => void;
  /** Optional accept attribute for the file input. */
  accept?: string;
}

export function LibraryPicker({
  surface,
  onPick,
  onCancel,
  accept = "audio/*",
}: LibraryPickerProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<AudioLibraryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  /** Loads the library entries. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { summaries } = await listSessionsStorage({
          kind: "library",
          limit: 5,
        });
        const results: AudioLibraryEntry[] = [];
        for (const summary of summaries) {
          const session = await getSessionStorage(summary.id);
          if (!session) continue;
          const body = asLibraryBody(session.body);
          results.push(...body.entries);
        }
        if (!cancelled) {
          // Newest first, capped at 200 entries.
          results.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
          setEntries(results.slice(0, 200));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Filters the entries by search / format / favourites. */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (favoritesOnly && !entry.isFavorite) return false;
      if (formatFilter && entry.format !== formatFilter) return false;
      if (!term) return true;
      return (
        entry.name.toLowerCase().includes(term) ||
        entry.title.toLowerCase().includes(term) ||
        entry.artist.toLowerCase().includes(term) ||
        entry.album.toLowerCase().includes(term) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [entries, search, formatFilter, favoritesOnly]);

  /** Imports a file from the file input, captures it locally
   * and immediately calls onPick. */
  const handleFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const loaded = await loadAudioFile(file);
        if (!loaded) {
          toast({ message: "That file could not be decoded.", tone: "error" });
          return;
        }
        const entry: AudioLibraryEntry = {
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
          tags: surface ? [surface] : [],
        };
        onPick(entry);
      } finally {
        setImporting(false);
      }
    },
    [onPick, surface, toast]
  );

  /** Inline file input. */
  const onFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void handleFile(file);
      event.target.value = "";
    },
    [handleFile]
  );

  const formats = useMemo(() => {
    const set = new Set(entries.map((entry) => entry.format));
    return Array.from(set).sort();
  }, [entries]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Library className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Pick from the Audio Library
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {loading
                ? "Loading…"
                : `${entries.length} entries · ${filtered.length} match the current filter`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-accent">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Import
              <input
                type="file"
                accept={accept}
                className="sr-only"
                onChange={onFileInput}
                disabled={importing}
              />
            </label>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the library"
              className="h-8 pl-7 text-xs"
              aria-label="Search the library"
            />
          </div>
          <select
            value={formatFilter}
            onChange={(event) => setFormatFilter(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Format filter"
          >
            <option value="">All formats</option>
            {formats.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
            />
            Favourites only
          </label>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading entries…</p>
        ) : entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
            The Audio Library is empty. Open the Library to add files, or
            import a file above to skip ahead.
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No entries match the current filter.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {filtered.map((entry) => (
              <li
                key={entry.id}
                className={
                  selectedId === entry.id
                    ? "flex items-center gap-2 rounded-md border border-primary bg-accent px-2 py-1.5 text-xs"
                    : "flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                }
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
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
                    {formatBytes(entry.size)}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onPick(entry)}
                >
                  Use
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
