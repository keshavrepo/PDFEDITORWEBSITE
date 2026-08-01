"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Loader2,
  Pencil,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ManagedFile } from "@/lib/platform/files";

interface FileManagerProps {
  initialFiles: ManagedFile[];
  /** Products that actually have files, so the filter never lists empty options. */
  productFilters: Array<{ id: string; name: string }>;
}

function formatSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Central file manager, shared by every LaunchStack product.
 *
 * Filtering runs against the server so results stay correct as the history
 * grows past what is loaded on the page.
 */
export function FileManager({ initialFiles, productFilters }: FileManagerProps) {
  const requestSequence = useRef(0);

  const [files, setFiles] = useState<ManagedFile[]>(initialFiles);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(
    async (next: { search: string; productId: string; favoritesOnly: boolean }) => {
      const sequence = ++requestSequence.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (next.search.trim()) params.set("q", next.search.trim());
        if (next.productId) params.set("product", next.productId);
        if (next.favoritesOnly) params.set("favorites", "1");

        const response = await fetch(`/api/files?${params.toString()}`);
        if (!response.ok) throw new Error("Unable to load files");
        const data = (await response.json()) as { files: ManagedFile[] };
        // Discard responses superseded by a newer filter change.
        if (sequence !== requestSequence.current) return;
        setFiles(data.files);
      } catch {
        if (sequence === requestSequence.current) setError("Unable to load your files");
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    []
  );

  // Debounce the text field; the selects apply immediately.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh({ search, productId, favoritesOnly });
    }, search ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [search, productId, favoritesOnly, refresh]);

  async function toggleFavorite(file: ManagedFile) {
    setBusyId(file.id);
    // Optimistic: the row reflects the click before the round trip completes.
    setFiles((current) =>
      current.map((entry) =>
        entry.id === file.id ? { ...entry, isFavorite: !entry.isFavorite } : entry
      )
    );
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "favorite" }),
      });
      if (!response.ok) throw new Error();
      if (favoritesOnly) await refresh({ search, productId, favoritesOnly });
    } catch {
      setFiles((current) =>
        current.map((entry) =>
          entry.id === file.id ? { ...entry, isFavorite: file.isFavorite } : entry
        )
      );
      setError("Could not update that favourite");
    } finally {
      setBusyId(null);
    }
  }

  async function commitRename(file: ManagedFile) {
    const name = renameValue.trim();
    if (!name || name === file.originalName) {
      setRenamingId(null);
      return;
    }
    setBusyId(file.id);
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name }),
      });
      if (!response.ok) throw new Error();
      setFiles((current) =>
        current.map((entry) =>
          entry.id === file.id ? { ...entry, originalName: name } : entry
        )
      );
      setRenamingId(null);
    } catch {
      setError("Could not rename that file");
    } finally {
      setBusyId(null);
    }
  }

  async function removeFile(file: ManagedFile) {
    setBusyId(file.id);
    try {
      const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setFiles((current) => current.filter((entry) => entry.id !== file.id));
    } catch {
      setError("Could not delete that file");
    } finally {
      setBusyId(null);
    }
  }

  async function recordDownload(file: ManagedFile) {
    // Processing results are held in the browser, so there is no server copy
    // to stream. The download counter is still recorded for the timeline.
    setBusyId(file.id);
    try {
      await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download" }),
      });
      setFiles((current) =>
        current.map((entry) =>
          entry.id === file.id
            ? { ...entry, downloadCount: entry.downloadCount + 1 }
            : entry
        )
      );
    } catch {
      setError("Could not record that download");
    } finally {
      setBusyId(null);
    }
  }

  const hasFilters = Boolean(search.trim() || productId || favoritesOnly);
  const summary = useMemo(
    () => ({
      count: files.length,
      bytes: files.reduce((total, file) => total + file.size, 0),
    }),
    [files]
  );

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files..."
              className="pl-10"
              aria-label="Search files"
            />
          </div>

          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            aria-label="Filter by product"
            className="flex h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All products</option>
            {productFilters.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFavoritesOnly((value) => !value)}
            aria-pressed={favoritesOnly}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
              favoritesOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent"
            )}
          >
            <Star
              className={cn("h-4 w-4", favoritesOnly && "fill-current")}
              aria-hidden="true"
            />
            Favourites
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            {summary.count} {summary.count === 1 ? "file" : "files"} · {formatSize(summary.bytes)}
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Updating
            </span>
          )}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setProductId("");
                setFavoritesOnly(false);
              }}
              className="hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
          <p className="text-destructive/90">{error}</p>
        </div>
      )}

      {!files.length ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">
            {hasFilters ? "No files match these filters" : "No files yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? "Try a different search or clear the filters"
              : "Files you process across LaunchStack products appear here"}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id}>
              <Card className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  {renamingId === file.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void commitRename(file);
                          if (event.key === "Escape") setRenamingId(null);
                        }}
                        aria-label={`Rename ${file.originalName}`}
                        className="h-8"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void commitRename(file)}
                        className="p-1.5 rounded-lg hover:bg-accent"
                        aria-label="Save name"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="p-1.5 rounded-lg hover:bg-accent"
                        aria-label="Cancel rename"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium truncate">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.productName} · {formatSize(file.size)} ·{" "}
                        {formatDate(file.createdAt)}
                        {file.downloadCount > 0 && ` · ${file.downloadCount} downloads`}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void toggleFavorite(file)}
                    disabled={busyId === file.id}
                    className="p-2 rounded-lg hover:bg-accent disabled:opacity-40"
                    aria-label={
                      file.isFavorite
                        ? `Remove ${file.originalName} from favourites`
                        : `Add ${file.originalName} to favourites`
                    }
                    aria-pressed={file.isFavorite}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        file.isFavorite ? "fill-primary text-primary" : "text-muted-foreground"
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(file.id);
                      setRenameValue(file.originalName);
                    }}
                    disabled={busyId === file.id}
                    className="p-2 rounded-lg hover:bg-accent disabled:opacity-40"
                    aria-label={`Rename ${file.originalName}`}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void recordDownload(file)}
                    disabled={busyId === file.id}
                    className="p-2 rounded-lg hover:bg-accent disabled:opacity-40"
                    aria-label={`Download ${file.originalName}`}
                  >
                    <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void removeFile(file)}
                    disabled={busyId === file.id}
                    className="p-2 rounded-lg hover:bg-accent disabled:opacity-40"
                    aria-label={`Delete ${file.originalName}`}
                  >
                    {busyId === file.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        PDFPilot processes files in your browser, so results are downloaded directly and are not
        stored on our servers. This history records what you processed across LaunchStack.
      </p>
    </div>
  );
}

export { formatSize as formatFileSize };
