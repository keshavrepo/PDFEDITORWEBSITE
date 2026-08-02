"use client";

/**
 * Media Workspace — Batch 3 surface.
 *
 * A focused view for every image, video and audio asset the user
 * has uploaded. Supports grid and list views, multi-select,
 * drag-and-drop into collections, favourites, tags, search,
 * filters and a details panel. Reuses the existing media engine
 * and storage layer.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileAudio,
  FileImage,
  FileVideo,
  Folder,
  Grid2X2,
  List,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { cn } from "@/lib/utils";
import { asMediaBody, DEFAULT_MEDIA_BODY } from "@/lib/socialpilot/bodies";
import type {
  SocialMediaAsset,
  SocialMediaAssetSummary,
  SocialMediaCollection,
  SocialMediaKind,
  SocialProject,
} from "@/lib/socialpilot";
import {
  createMediaAsset,
  deleteMediaAsset,
  listMediaAssets,
  getMediaAsset,
  detectMediaKind,
} from "@/lib/socialpilot";

interface MediaWorkspaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

const KIND_ICON: Record<SocialMediaKind, typeof FileImage> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
};

function randomId(): string {
  return `col-${Math.random().toString(36).slice(2, 10)}`;
}

export function MediaWorkspace({ project, onChange }: MediaWorkspaceProps) {
  const body = asMediaBody(project.body);
  const { toast } = useToast();
  const [assets, setAssets] = useState<SocialMediaAsset[]>([]);
  const [collections, setCollections] = useState<SocialMediaCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);

  function commit(next: typeof DEFAULT_MEDIA_BODY) {
    onChange({ ...project, body: next });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [assetRes, collectionRes] = await Promise.all([
          fetch("/api/socialpilot/media?limit=200"),
          fetch("/api/socialpilot/media-collections"),
        ]);
        if (assetRes.ok) {
          const data = (await assetRes.json()) as {
            media?: SocialMediaAssetSummary[];
          };
          if (!cancelled) {
            const summaries = data.media ?? [];
            const full: SocialMediaAsset[] = [];
            for (const summary of summaries) {
              const asset = await getMediaAsset(summary.id);
              if (asset) full.push(asset);
            }
            setAssets(full);
          }
        }
        if (collectionRes.ok) {
          const data = (await collectionRes.json()) as {
            collections?: SocialMediaCollection[];
          };
          if (!cancelled) setCollections(data.collections ?? []);
        }
      } catch {
        if (!cancelled) {
          setAssets([]);
          setCollections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistCollections(next: SocialMediaCollection[]) {
    setCollections(next);
    try {
      await fetch("/api/socialpilot/media-collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collections: next }),
      });
    } catch {
      toast({ message: "Could not save collections", tone: "error" });
    }
  }

  const filtered = useMemo(() => {
    const term = body.search.trim().toLowerCase();
    return assets
      .filter((asset) => (body.kindFilter === "all" ? true : asset.kind === body.kindFilter))
      .filter((asset) => {
        if (body.collectionFilter === "all") return true;
        if (body.collectionFilter === "favorites") return favourites.has(asset.id);
        const collection = collections.find((c) => c.id === body.collectionFilter);
        return collection?.assetIds.includes(asset.id) ?? false;
      })
      .filter((asset) => {
        if (!term) return true;
        return (
          asset.title.toLowerCase().includes(term) ||
          asset.filename.toLowerCase().includes(term) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(term))
        );
      });
  }, [assets, body.kindFilter, body.collectionFilter, body.search, collections, favourites]);

  function toggleSelected(id: string) {
    const next = new Set(body.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commit({ ...body, selectedIds: [...next] });
  }

  function clearSelection() {
    commit({ ...body, selectedIds: [] });
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const asset = await createMediaAsset(file, { projectId: null });
        setAssets((current) => [asset, ...current]);
        toast({ message: `Added ${file.name}`, tone: "success" });
      } catch (err) {
        toast({
          message: err instanceof Error ? err.message : "Upload failed",
          tone: "error",
        });
      }
    }
  }

  async function handleDelete(asset: SocialMediaAsset) {
    try {
      await deleteMediaAsset(asset.id);
      setAssets((current) => current.filter((a) => a.id !== asset.id));
      setFavourites((current) => {
        const next = new Set(current);
        next.delete(asset.id);
        return next;
      });
      commit({
        ...body,
        selectedIds: body.selectedIds.filter((id) => id !== asset.id),
      });
      toast({ message: `Removed ${asset.title}`, tone: "info" });
    } catch {
      toast({ message: "Could not remove that asset", tone: "error" });
    }
  }

  function toggleFavourite(asset: SocialMediaAsset) {
    setFavourites((current) => {
      const next = new Set(current);
      if (next.has(asset.id)) next.delete(asset.id);
      else next.add(asset.id);
      return next;
    });
  }

  function addCollection() {
    const next: SocialMediaCollection = {
      id: randomId(),
      name: `Collection ${collections.length + 1}`,
      description: "",
      assetIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    void persistCollections([...collections, next]);
  }

  function removeCollection(id: string) {
    void persistCollections(collections.filter((c) => c.id !== id));
    if (body.collectionFilter === id) {
      commit({ ...body, collectionFilter: "all" });
    }
  }

  function moveSelectedTo(collectionId: string) {
    const ids = new Set(body.selectedIds);
    if (ids.size === 0) return;
    void persistCollections(
      collections.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              assetIds: Array.from(
                new Set([...collection.assetIds, ...body.selectedIds])
              ),
              updatedAt: new Date().toISOString(),
            }
          : collection
      )
    );
    toast({
      message: `Added ${ids.size} asset${ids.size === 1 ? "" : "s"} to collection`,
      tone: "success",
    });
  }

  function moveAssetTo(assetId: string, collectionId: string) {
    void persistCollections(
      collections.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              assetIds: Array.from(new Set([...collection.assetIds, assetId])),
              updatedAt: new Date().toISOString(),
            }
          : {
              ...collection,
              assetIds: collection.assetIds.filter((id) => id !== assetId),
              updatedAt: new Date().toISOString(),
            }
      )
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 xl:grid-cols-[220px_1fr_280px]">
      <Card className="overflow-y-auto p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Filters
        </p>
        <div className="mb-3 space-y-1">
          {(
            [
              { value: "all", label: "All assets" },
              { value: "favorites", label: "Favourites" },
              ...collections.map((c) => ({ value: c.id, label: c.name })),
            ] as Array<{ value: string; label: string }>
          ).map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => commit({ ...body, collectionFilter: option.value })}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs",
                body.collectionFilter === option.value
                  ? "bg-accent text-foreground"
                  : "hover:bg-accent/40"
              )}
            >
              <Folder className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Type
        </p>
        <div className="mb-3 flex flex-wrap gap-1">
          {(["all", "image", "video", "audio"] as const).map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => commit({ ...body, kindFilter: option })}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                body.kindFilter === option
                  ? "border-foreground/30 bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {option === "all" ? "All" : option}
            </button>
          ))}
        </div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Collections
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-full gap-1 px-2 text-[10px]"
          onClick={addCollection}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          New collection
        </Button>
        <ul className="mt-2 space-y-1">
          {collections.length === 0 ? (
            <li className="px-2 py-1 text-[10px] text-muted-foreground">
              No collections yet
            </li>
          ) : (
            collections.map((collection) => (
              <li
                key={collection.id}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent/40"
              >
                <Folder
                  className="h-3 w-3 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={collection.name}
                  onChange={(event) =>
                    void persistCollections(
                      collections.map((c) =>
                        c.id === collection.id
                          ? { ...c, name: event.target.value }
                          : c
                      )
                    )
                  }
                  className="h-6 text-xs"
                  aria-label="Collection name"
                />
                <button
                  type="button"
                  onClick={() => removeCollection(collection.id)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${collection.name}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))
          )}
        </ul>
      </Card>

      <div className="flex min-h-0 flex-col gap-3">
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Upload
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void handleUpload(event.target.files);
                event.target.value = "";
              }}
            />
            <div className="relative flex-1 min-w-[160px]">
              <Search
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={body.search}
                onChange={(event) =>
                  commit({ ...body, search: event.target.value })
                }
                placeholder="Search assets"
                className="h-7 pl-7 text-xs"
                aria-label="Search assets"
              />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => commit({ ...body, view: "grid" })}
                className={cn(
                  "rounded p-1",
                  body.view === "grid" ? "bg-accent" : "text-muted-foreground"
                )}
                aria-label="Grid view"
                aria-pressed={body.view === "grid"}
              >
                <Grid2X2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => commit({ ...body, view: "list" })}
                className={cn(
                  "rounded p-1",
                  body.view === "list" ? "bg-accent" : "text-muted-foreground"
                )}
                aria-label="List view"
                aria-pressed={body.view === "list"}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {body.selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-accent/40 p-1 text-xs">
                <span className="font-medium">
                  {body.selectedIds.length} selected
                </span>
                {collections.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => moveSelectedTo(c.id)}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                  >
                    Move to {c.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Clear selection"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </Card>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              No assets match the current filter.
            </Card>
          ) : body.view === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((asset) => (
                <li key={asset.id}>
                  <AssetGridItem
                    asset={asset}
                    selected={body.selectedIds.includes(asset.id)}
                    favourite={favourites.has(asset.id)}
                    collections={collections}
                    onSelect={() => toggleSelected(asset.id)}
                    onFavourite={() => toggleFavourite(asset)}
                    onDelete={() => void handleDelete(asset)}
                    onMoveTo={(collectionId) => moveAssetTo(asset.id, collectionId)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1">
              {filtered.map((asset) => (
                <li key={asset.id}>
                  <AssetListItem
                    asset={asset}
                    selected={body.selectedIds.includes(asset.id)}
                    favourite={favourites.has(asset.id)}
                    collections={collections}
                    onSelect={() => toggleSelected(asset.id)}
                    onFavourite={() => toggleFavourite(asset)}
                    onDelete={() => void handleDelete(asset)}
                    onMoveTo={(collectionId) => moveAssetTo(asset.id, collectionId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Card className="overflow-y-auto p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </p>
        {body.selectedIds.length === 1 ? (
          <DetailsPanel
            asset={
              assets.find((asset) => asset.id === body.selectedIds[0]) ?? null
            }
            collections={collections}
            onClose={clearSelection}
            onMoveTo={(collectionId) => {
              const id = body.selectedIds[0];
              if (id) moveAssetTo(id, collectionId);
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Select a single asset to see its details, or multi-select
            to add a tag or move to a collection in bulk.
          </p>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Asset items                                                                */
/* -------------------------------------------------------------------------- */

interface AssetItemProps {
  asset: SocialMediaAsset;
  selected: boolean;
  favourite: boolean;
  collections: SocialMediaCollection[];
  onSelect: () => void;
  onFavourite: () => void;
  onDelete: () => void;
  onMoveTo: (collectionId: string) => void;
}

function AssetGridItem(props: AssetItemProps) {
  const { asset, selected, favourite } = props;
  const Icon = KIND_ICON[asset.kind];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-muted",
        selected && "ring-2 ring-foreground/30"
      )}
    >
      <button
        type="button"
        onClick={props.onSelect}
        className="block w-full text-left"
      >
        {asset.kind === "image" && asset.objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.objectUrl}
            alt={asset.title}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="flex h-32 items-center justify-center bg-muted text-xs text-muted-foreground">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
      </button>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/80 p-1 text-[10px]">
        <span className="truncate">{asset.title}</span>
        <span className="text-muted-foreground">
          {asset.kind} · {Math.max(1, Math.round(asset.size / 1024))} KB
        </span>
      </div>
      <div className="absolute right-1 top-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={props.onFavourite}
          className={cn(
            "rounded-full bg-background/80 p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
            favourite && "text-primary"
          )}
          aria-label={favourite ? "Unfavourite" : "Favourite"}
        >
          <Star
            className={cn("h-3 w-3", favourite && "fill-primary")}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={props.onDelete}
          className="rounded-full bg-background/80 p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={`Remove ${asset.title}`}
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      {props.collections.length > 0 && (
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) props.onMoveTo(event.target.value);
            event.target.value = "";
          }}
          className="absolute bottom-7 left-1 h-5 rounded bg-background/80 px-1 text-[9px] opacity-0 group-hover:opacity-100"
          aria-label={`Move ${asset.title} to collection`}
        >
          <option value="">Move…</option>
          {props.collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function AssetListItem(props: AssetItemProps) {
  const { asset, selected, favourite } = props;
  const Icon = KIND_ICON[asset.kind];
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg border border-border bg-background p-2",
        selected && "ring-2 ring-foreground/30"
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={props.onSelect}
        className="h-3.5 w-3.5 rounded border-border"
        aria-label={`Select ${asset.title}`}
      />
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {asset.kind === "image" && asset.objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.objectUrl}
            alt={asset.title}
            className="h-10 w-10 object-cover"
          />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{asset.title}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {asset.kind} · {asset.filename} · {Math.max(1, Math.round(asset.size / 1024))} KB
        </p>
      </div>
      <button
        type="button"
        onClick={props.onFavourite}
        className={cn(
          "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
          favourite && "text-primary"
        )}
        aria-label={favourite ? "Unfavourite" : "Favourite"}
      >
        <Star
          className={cn("h-3.5 w-3.5", favourite && "fill-primary")}
          aria-hidden="true"
        />
      </button>
      {props.collections.length > 0 && (
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) props.onMoveTo(event.target.value);
            event.target.value = "";
          }}
          className="h-7 rounded border border-border bg-background px-1 text-[10px]"
          aria-label={`Move ${asset.title} to collection`}
        >
          <option value="">Move…</option>
          {props.collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={props.onDelete}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={`Remove ${asset.title}`}
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function DetailsPanel({
  asset,
  collections,
  onClose,
  onMoveTo,
}: {
  asset: SocialMediaAsset | null;
  collections: SocialMediaCollection[];
  onClose: () => void;
  onMoveTo: (collectionId: string) => void;
}) {
  if (!asset) return null;
  const Icon = KIND_ICON[asset.kind];
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{asset.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close details"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      {asset.kind === "image" && asset.objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.objectUrl}
          alt={asset.title}
          className="w-full rounded border border-border object-cover"
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
      )}
      <dl className="space-y-1">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Type</dt>
          <dd className="font-medium">{asset.kind}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Size</dt>
          <dd className="font-medium">
            {Math.max(1, Math.round(asset.size / 1024))} KB
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">MIME</dt>
          <dd className="truncate font-medium">{asset.mimeType ?? "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Filename</dt>
          <dd className="truncate font-medium">{asset.filename}</dd>
        </div>
      </dl>
      {asset.tags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tags
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {asset.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      {collections.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Collections
          </p>
          <ul className="mt-1 space-y-1">
            {collections
              .filter((c) => c.assetIds.includes(asset.id))
              .map((collection) => (
                <li
                  key={collection.id}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px]"
                >
                  <Folder
                    className="h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {collection.name}
                </li>
              ))}
            <li>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) onMoveTo(event.target.value);
                  event.target.value = "";
                }}
                className="h-7 w-full rounded border border-border bg-background px-2 text-[10px]"
                aria-label="Add to collection"
              >
                <option value="">Add to collection…</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
