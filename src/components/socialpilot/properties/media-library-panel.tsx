"use client";

/**
 * Media library panel for SocialPilot.
 *
 * Renders the assets the user has uploaded in this session, lets
 * them upload new ones (images, video, audio), filter by kind, search
 * by title, and delete entries. The asset binary lives in the
 * browser; only the small metadata is mirrored to the server.
 */

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FileAudio,
  FileImage,
  FileVideo,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  createMediaAsset,
  deleteMediaAsset,
  listMediaAssets,
  detectMediaKind,
  type SocialMediaAssetSummary,
  type SocialMediaKind,
} from "@/lib/socialpilot";

const KIND_ICON: Record<SocialMediaKind, typeof FileImage> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
};

const KIND_LABEL: Record<SocialMediaKind, string> = {
  image: "Images",
  video: "Videos",
  audio: "Audio",
};

interface MediaLibraryPanelProps {
  /** Optional project context. When set, the upload targets this project. */
  projectId?: string | null;
  /** When true, hides the upload control (e.g. inside another surface). */
  readOnly?: boolean;
  /** Compact list mode used in the navigation rail. */
  compact?: boolean;
  /** Cap on the number of summaries listed. */
  limit?: number;
}

export function MediaLibraryPanel({
  projectId = null,
  readOnly = false,
  compact = false,
  limit = 50,
}: MediaLibraryPanelProps) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<SocialMediaAssetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<SocialMediaKind | "all">("all");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const next = await listMediaAssets({
        projectId: projectId ?? null,
        kind: kind === "all" ? undefined : kind,
        search: search.trim() || undefined,
        limit,
      });
      setAssets(next);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const next = await listMediaAssets({
          projectId: projectId ?? null,
          kind: kind === "all" ? undefined : kind,
          search: search.trim() || undefined,
          limit,
        });
        if (cancelled) return;
        setAssets(next);
      } catch {
        if (!cancelled) setAssets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, kind, search, limit]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const kindOfFile = detectMediaKind(file.type);
        // Use the active kind filter when it matches; otherwise follow
        // the file's mime type. This keeps uploads predictable.
        const effective = kind === "all" ? kindOfFile : kind;
        if (kind !== "all" && kindOfFile !== kind) {
          toast({
            message: `Skipped ${file.name} (not a ${KIND_LABEL[kind as SocialMediaKind].toLowerCase().slice(0, -1)})`,
            tone: "info",
          });
          continue;
        }
        try {
          await createMediaAsset(file, { projectId });
          toast({
            message: `Added ${file.name} to ${KIND_LABEL[effective].toLowerCase()}`,
            tone: "success",
          });
        } catch (err) {
          toast({
            message: err instanceof Error ? err.message : "Upload failed",
            tone: "error",
          });
        }
      }
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(asset: SocialMediaAssetSummary) {
    try {
      await deleteMediaAsset(asset.id);
      setAssets((current) => current.filter((a) => a.id !== asset.id));
      toast({ message: `Removed ${asset.title}`, tone: "info" });
    } catch {
      toast({ message: "Could not remove that asset", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Media library
        </h3>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3 w-3" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        )}
      </div>

      {!readOnly && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      )}

      <div className="flex flex-wrap gap-1">
        {(["all", "image", "video", "audio"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={
              "rounded-full border px-2 py-0.5 text-[10px] transition-colors " +
              (kind === option
                ? "border-foreground/30 bg-foreground/5 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
            }
          >
            {option === "all" ? "All" : KIND_LABEL[option].slice(0, -1)}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search
          className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assets"
          className="h-7 pl-7 text-xs"
          aria-label="Search media assets"
        />
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : assets.length === 0 ? (
        <Card className="p-4 text-center text-[11px] text-muted-foreground">
          No media assets yet
        </Card>
      ) : (
        <ul className={compact ? "space-y-1" : "grid grid-cols-2 gap-2"}>
          {assets.map((asset) => {
            const Icon = KIND_ICON[asset.kind];
            return (
              <li key={asset.id}>
                <Card
                  className={
                    "group flex items-center gap-2 p-2 " +
                    (compact ? "" : "flex-col items-stretch")
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                    {compact ? (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{asset.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {asset.kind} · {Math.max(1, Math.round(asset.size / 1024))} KB
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {!compact && (
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{asset.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {asset.kind} · {Math.max(1, Math.round(asset.size / 1024))} KB
                      </p>
                    </div>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(asset)}
                      className={
                        "rounded p-1 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground " +
                        (compact
                          ? "opacity-0 group-hover:opacity-100"
                          : "self-end opacity-0 group-hover:opacity-100")
                      }
                      aria-label={`Remove ${asset.title}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
