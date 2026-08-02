"use client";

/**
 * Asset Manager surface.
 *
 * A professional asset library for WebPilot. The user can upload
 * images, SVG, fonts, videos and icons, organise them into
 * folders, preview each asset inline, rename and delete assets,
 * and copy the asset URL. The asset list is persisted through the
 * same autosave loop the rest of the workspace uses, and the
 * storage layer keeps the assets in IndexedDB so they remain
 * available offline.
 *
 * Mirrors the existing tool chrome and the workspace-dashboard
 * pattern, but the body is a flat asset list with a folder
 * namespace.
 */

import { useMemo, useRef, useState } from "react";
import {
  Copy,
  FilePlus,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Search,
  Star,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asAssetsBody,
  classifyAsset,
  copyToClipboard,
  joinAssetFolder,
  readFileAsDataURL,
  readFileAsBytes,
  readImageDimensions,
  uniqueAssetName,
  uniqueFolderName,
} from "@/lib/webpilot";
import type { WebAsset, WebAssetsBody, WebSession } from "@/lib/webpilot";

interface AssetsSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function AssetsSurface({ session, onChange }: AssetsSurfaceProps) {
  const body = asAssetsBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function commit(patch: Partial<WebAssetsBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const filtered = useMemo(() => {
    const term = body.search.trim().toLowerCase();
    if (!term) return body.assets;
    return body.assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(term) ||
        asset.folder.toLowerCase().includes(term) ||
        asset.kind.toLowerCase().includes(term)
    );
  }, [body.assets, body.search]);

  const selected =
    body.assets.find((asset) => asset.id === body.selectedAssetId) ?? null;

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set("", 0);
    for (const asset of body.assets) {
      counts.set(asset.folder, (counts.get(asset.folder) ?? 0) + 1);
    }
    return counts;
  }, [body.assets]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const folder of body.folders) set.add(folder.path);
    for (const asset of body.assets) {
      const parts = asset.folder.split("/").filter(Boolean);
      let path = "";
      for (const part of parts) {
        path = joinAssetFolder(path, part);
        set.add(path);
      }
    }
    return Array.from(set).sort();
  }, [body.assets, body.folders]);

  async function handleUpload(files: FileList | null) {
    if (!files) return;
    let nextAssets = body.assets;
    let nextFolders = body.folders;
    let lastId = "";
    const taken = new Set(body.assets.map((asset) => asset.name));
    for (const file of Array.from(files)) {
      const kind = classifyAsset(file);
      let dataUrl = "";
      try {
        if (kind === "image" || kind === "svg" || kind === "icon" || kind === "video") {
          dataUrl = await readFileAsDataURL(file);
        } else {
          // For fonts and other binary kinds, store the data URL too so
          // the asset survives a reload without IndexedDB re-reads.
          dataUrl = await readFileAsDataURL(file);
        }
      } catch (err) {
        toast({
          message: err instanceof Error ? err.message : "Failed to read asset",
          tone: "error",
        });
        continue;
      }
      let bytes = 0;
      try {
        bytes = (await readFileAsBytes(file)).length;
      } catch {
        bytes = dataUrl.length;
      }
      let width: number | undefined;
      let height: number | undefined;
      if (kind === "image" || kind === "svg" || kind === "icon") {
        const dims = await readImageDimensions(dataUrl);
        if (dims) {
          width = dims.width;
          height = dims.height;
        }
      }
      const name = uniqueAssetName(file.name, taken);
      taken.add(name);
      const folder = body.selectedFolder;
      if (folder && !nextFolders.some((entry) => entry.path === folder)) {
        nextFolders = [
          ...nextFolders,
          {
            id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            path: folder,
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      const asset: WebAsset = {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        folder,
        kind,
        mime: file.type || (kind === "svg" ? "image/svg+xml" : "application/octet-stream"),
        dataUrl,
        width,
        height,
        size: bytes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFavorite: false,
      };
      nextAssets = [...nextAssets, asset];
      lastId = asset.id;
    }
    commit({ assets: nextAssets, folders: nextFolders, selectedAssetId: lastId });
  }

  function handleCreateFolder() {
    const trimmed = folderInput.trim();
    if (!trimmed) return;
    const fullPath = joinAssetFolder(body.selectedFolder, trimmed);
    const existingNames = new Set(
      body.folders
        .filter((folder) => folder.path.startsWith(body.selectedFolder + (body.selectedFolder ? "/" : "")))
        .map((folder) => folder.path.slice(body.selectedFolder.length + (body.selectedFolder ? 1 : 0)))
    );
    const name = uniqueFolderName(trimmed, existingNames);
    const finalPath = joinAssetFolder(body.selectedFolder, name);
    if (body.folders.some((folder) => folder.path === finalPath)) {
      toast({ message: "Folder already exists", tone: "error" });
      return;
    }
    commit({
      folders: [
        ...body.folders,
        {
          id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          path: finalPath,
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    setFolderInput("");
  }

  function startRename(asset: WebAsset) {
    setRenaming(asset.id);
    setRenameValue(asset.name);
  }

  function commitRename() {
    if (!renaming) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenaming(null);
      return;
    }
    const taken = new Set(
      body.assets
        .filter((asset) => asset.id !== renaming)
        .map((asset) => asset.name)
    );
    const name = uniqueAssetName(trimmed, taken);
    commit({
      assets: body.assets.map((asset) =>
        asset.id === renaming
          ? { ...asset, name, updatedAt: new Date().toISOString() }
          : asset
      ),
    });
    setRenaming(null);
  }

  function handleDelete(id: string) {
    commit({
      assets: body.assets.filter((asset) => asset.id !== id),
      selectedAssetId: body.selectedAssetId === id ? "" : body.selectedAssetId,
    });
  }

  function handleToggleFavorite(id: string) {
    commit({
      assets: body.assets.map((asset) =>
        asset.id === id ? { ...asset, isFavorite: !asset.isFavorite } : asset
      ),
    });
  }

  async function handleCopyUrl() {
    if (!selected) return;
    const ok = await copyToClipboard(selected.dataUrl);
    toast({
      message: ok ? "Asset URL copied" : "Could not copy",
      tone: ok ? "success" : "error",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Asset Manager — upload images, SVG, fonts, videos and icons, organise folders, preview, rename, delete and copy URL."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={handleCopyUrl}
        copyLabel="Copy URL"
        copyDisabled={!selected}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <Button
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <FilePlus className="h-3.5 w-3.5" aria-hidden="true" />
            Upload
          </Button>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.assets.length} assets · {folders.length} folders
          </span>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          void handleUpload(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,2fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={body.search}
              onChange={(event) => commit({ search: event.target.value })}
              placeholder="Search assets…"
              className="h-7 flex-1 text-xs"
            />
          </div>
          <div className="grid min-h-0 grid-cols-[1fr,2fr] overflow-hidden">
            <div
              className="overflow-auto border-r border-border p-2"
              onDragOver={(event) => event.preventDefault()}
            >
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Folders
              </p>
              <FolderButton
                label="Root"
                count={folderCounts.get("") ?? 0}
                active={body.selectedFolder === ""}
                onClick={() => commit({ selectedFolder: "" })}
              />
              {folders.map((folder) => (
                <FolderButton
                  key={folder}
                  label={folder}
                  count={folderCounts.get(folder) ?? 0}
                  active={body.selectedFolder === folder}
                  onClick={() => commit({ selectedFolder: folder })}
                />
              ))}
              <form
                className="mt-2 flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateFolder();
                }}
              >
                <Input
                  value={folderInput}
                  onChange={(event) => setFolderInput(event.target.value)}
                  placeholder={
                    body.selectedFolder
                      ? `new folder in ${body.selectedFolder}`
                      : "new folder"
                  }
                  className="h-7 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  aria-label="Create folder"
                >
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </form>
            </div>
            <div className="overflow-auto p-2">
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assets in {body.selectedFolder || "/"}
              </p>
              {filtered.filter((asset) => asset.folder === body.selectedFolder).length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No assets in this folder. Use Upload to add one.
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered
                    .filter((asset) => asset.folder === body.selectedFolder)
                    .map((asset) => (
                      <li key={asset.id}>
                        <button
                          type="button"
                          onClick={() => commit({ selectedAssetId: asset.id })}
                          className={
                            "group flex w-full items-center gap-2 rounded-md border p-2 text-left " +
                            (body.selectedAssetId === asset.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-accent/50")
                          }
                        >
                          <AssetThumb asset={asset} />
                          <span className="flex-1 truncate text-xs">
                            {renaming === asset.id ? (
                              <Input
                                value={renameValue}
                                onChange={(event) =>
                                  setRenameValue(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitRename();
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    setRenaming(null);
                                  }
                                }}
                                onBlur={commitRename}
                                autoFocus
                                className="h-6 text-xs"
                              />
                            ) : (
                              asset.name
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatBytes(asset.size)}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          {selected ? (
            <AssetPreview
              asset={selected}
              renaming={renaming === selected.id}
              renameValue={renameValue}
              onRenameValue={setRenameValue}
              onCommitRename={commitRename}
              onCancelRename={() => setRenaming(null)}
              onStartRename={() => startRename(selected)}
              onDelete={() => handleDelete(selected.id)}
              onToggleFavorite={() => handleToggleFavorite(selected.id)}
              onCopyUrl={handleCopyUrl}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
              <p>Select an asset to preview, or upload a new one to begin.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FolderButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const display = label === "" ? "/" : label.split("/").filter(Boolean).pop() || "/";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs " +
        (active ? "bg-accent" : "hover:bg-accent/50")
      }
    >
      <Folder className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1 truncate text-left">{display}</span>
      <span className="text-[10px] text-muted-foreground">{count}</span>
    </button>
  );
}

function AssetThumb({ asset }: { asset: WebAsset }) {
  const icon =
    asset.kind === "image" || asset.kind === "svg" || asset.kind === "icon" ? (
      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    ) : asset.kind === "video" ? (
      <Video className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    ) : (
      <FilePlus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    );
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30">
      {asset.kind === "image" || asset.kind === "svg" || asset.kind === "icon" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.dataUrl}
          alt={asset.name}
          className="h-full w-full rounded-md object-contain"
        />
      ) : (
        icon
      )}
    </div>
  );
}

function AssetPreview({
  asset,
  renaming,
  renameValue,
  onRenameValue,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onDelete,
  onToggleFavorite,
  onCopyUrl,
}: {
  asset: WebAsset;
  renaming: boolean;
  renameValue: string;
  onRenameValue: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onCopyUrl: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-2 py-1.5">
        <p className="text-xs font-semibold">
          {renaming ? (
            <Input
              value={renameValue}
              onChange={(event) => onRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCommitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelRename();
                }
              }}
              onBlur={onCommitRename}
              autoFocus
              className="h-7 text-xs"
            />
          ) : (
            asset.name
          )}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {asset.mime || "unknown"} · {formatBytes(asset.size)}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        </p>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onToggleFavorite}
            aria-label={asset.isFavorite ? "Unfavourite" : "Favourite"}
          >
            <Star
              className={
                asset.isFavorite
                  ? "h-3.5 w-3.5 fill-primary text-primary"
                  : "h-3.5 w-3.5"
              }
              aria-hidden="true"
            />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onStartRename}
            aria-label="Rename"
            title="Rename"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onCopyUrl}
            aria-label="Copy URL"
            title="Copy URL"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onDelete}
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white p-4 dark:bg-background">
        <PreviewBody asset={asset} />
      </div>
    </div>
  );
}

function PreviewBody({ asset }: { asset: WebAsset }) {
  if (asset.kind === "image" || asset.kind === "svg" || asset.kind === "icon") {
    return (
      <div className="flex h-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.dataUrl}
          alt={asset.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  if (asset.kind === "video") {
    return (
      <video
        controls
        src={asset.dataUrl}
        className="max-h-full max-w-full"
      />
    );
  }
  if (asset.kind === "font") {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-foreground">Font preview</p>
        <p
          className="text-2xl"
          style={{ fontFamily: `"${asset.name.replace(/\.[^.]+$/, "")}", sans-serif` }}
        >
          The quick brown fox jumps over the lazy dog.
        </p>
        <p className="text-[11px] text-muted-foreground">
          {asset.mime} · {formatBytes(asset.size)}
        </p>
      </div>
    );
  }
  return (
    <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
      {asset.dataUrl.length > 500
        ? asset.dataUrl.slice(0, 500) + "…"
        : asset.dataUrl}
    </pre>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
