"use client";

/**
 * Post Creator — the full Post Creator surface for the Batch 2
 * release. Replaces the foundation `post` surface from Batch 1.
 *
 * Features:
 *  - Plain text or rich text
 *  - Bold / italic / code / link marks
 *  - @mention and #hashtag inline tokens (auto-detected)
 *  - Bullet / ordered / checklist lists
 *  - Character counter
 *  - Live preview
 *  - Insert from Caption Manager (saved captions) and Hashtag Manager
 *  - Autosave (handled by the workspace shell)
 *  - Duplicate draft (handled by the workspace shell)
 *  - Media-asset attachment
 */

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  Image as ImageIcon,
  ListChecks,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  RichTextEditor,
  paragraphsToPlainText,
} from "./shared/rich-text-editor";
import {
  asPostBody,
  deriveHashtags,
  deriveMentions,
  emptyParagraphs,
  paragraphsToPlainTextLocal,
  type SocialPostBody,
} from "@/lib/socialpilot/bodies";
import type {
  SocialCaptionBody,
  SocialHashtagGroupBody,
  SocialMediaAsset,
  SocialProject,
  SocialRichTextParagraph,
} from "@/lib/socialpilot";
import { cn } from "@/lib/utils";

interface PostCreatorProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

const POPULAR_PLATFORMS = [
  "Instagram",
  "TikTok",
  "X",
  "LinkedIn",
  "Facebook",
  "YouTube",
  "Threads",
];

const MAX_PREVIEW_LABELS: Record<string, number> = {
  Instagram: 2200,
  TikTok: 2200,
  X: 280,
  LinkedIn: 3000,
  Facebook: 63206,
  YouTube: 5000,
  Threads: 500,
};

function buildPlainText(body: SocialPostBody): string {
  if (body.format === "plain") return body.plainText;
  return paragraphsToPlainText(body.paragraphs);
}

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of list) {
    const key = entry.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}

export function PostCreator({ project, onChange }: PostCreatorProps) {
  const body = asPostBody(project.body);
  const { toast } = useToast();
  const [preview, setPreview] = useState(false);
  const [captionPickerOpen, setCaptionPickerOpen] = useState(false);
  const [hashtagPickerOpen, setHashtagPickerOpen] = useState(false);

  // When the body changes, refresh hashtags/mentions/plainText.
  const currentPlain = useMemo(() => buildPlainText(body), [body]);

  function commit(next: SocialPostBody) {
    onChange({ ...project, body: next });
  }

  function setPlainText(text: string) {
    const hashtags = deriveHashtags(text);
    const mentions = deriveMentions(text);
    commit({
      ...body,
      format: "plain",
      plainText: text,
      paragraphs: emptyParagraphs(false),
      hashtags,
      mentions,
    });
  }

  function setParagraphs(paragraphs: SocialRichTextParagraph[]) {
    const plainText = paragraphsToPlainTextLocal(paragraphs);
    const hashtags = deriveHashtags(plainText);
    const mentions = deriveMentions(plainText);
    commit({
      ...body,
      format: "rich",
      paragraphs,
      plainText,
      hashtags,
      mentions,
    });
  }

  function appendText(text: string) {
    if (body.format === "rich") {
      const next = [...body.paragraphs];
      const last = next[next.length - 1] ?? { text: "", marks: [] };
      next[next.length - 1] = { ...last, text: `${last.text}${text}` };
      setParagraphs(next);
    } else {
      setPlainText(`${body.plainText}${text}`);
    }
  }

  function setCallToAction(value: string) {
    commit({ ...body, callToAction: value });
  }

  function setCategory(value: string) {
    commit({ ...body, category: value });
  }

  function setPlatform(value: string) {
    commit({ ...body, platform: value });
  }

  function attachMedia(id: string) {
    if (body.mediaIds.includes(id)) return;
    commit({ ...body, mediaIds: [...body.mediaIds, id] });
  }

  function detachMedia(id: string) {
    commit({ ...body, mediaIds: body.mediaIds.filter((m) => m !== id) });
  }

  function addHashtag(tag: string) {
    const cleaned = tag.startsWith("#") ? tag : `#${tag}`;
    if (body.hashtags.includes(cleaned)) return;
    appendText(` ${cleaned}`);
  }

  function addCaption(caption: SocialCaptionBody) {
    if (caption.category && !body.category) {
      setCategory(caption.category);
    }
    const addition = caption.text.endsWith("\n") ? caption.text : `${caption.text}\n`;
    if (body.format === "rich") {
      setParagraphs([...body.paragraphs, { text: addition, marks: [] }]);
    } else {
      setPlainText(`${body.plainText}${addition}`);
    }
    toast({ message: "Inserted caption", tone: "success" });
    setCaptionPickerOpen(false);
  }

  const charCount = currentPlain.length;
  const limit = body.platform ? MAX_PREVIEW_LABELS[body.platform] ?? 2200 : 2200;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Post Creator
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={preview ? "default" : "ghost"}
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setPreview((value) => !value)}
                aria-pressed={preview}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Preview
              </Button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Platform</span>
              <select
                value={body.platform ?? ""}
                onChange={(event) => setPlatform(event.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-sm"
                aria-label="Platform"
              >
                <option value="">No specific platform</option>
                {POPULAR_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Category</span>
              <Input
                value={body.category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. Launch, Promo"
                aria-label="Category"
              />
            </label>
          </div>

          {preview ? (
            <PostPreview body={body} />
          ) : body.format === "rich" ? (
            <RichTextEditor
              paragraphs={body.paragraphs.length > 0 ? body.paragraphs : emptyParagraphs(false)}
              onChange={setParagraphs}
              ariaLabel="Post body"
              placeholder="Write your post…"
            />
          ) : (
            <textarea
              value={body.plainText}
              onChange={(event) => setPlainText(event.target.value)}
              className="min-h-[200px] w-full rounded border border-border bg-background p-2 text-sm"
              aria-label="Post body"
              placeholder="Write your post…"
            />
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="tabular-nums">
                {charCount} / {limit} characters
              </span>
              {charCount > limit && (
                <span className="text-destructive">over limit</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() =>
                  commit({
                    ...body,
                    format: body.format === "rich" ? "plain" : "rich",
                  })
                }
              >
                {body.format === "rich" ? "Plain text" : "Rich text"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setCaptionPickerOpen(true)}
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Insert caption
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setHashtagPickerOpen(true)}
              >
                <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                Insert hashtag group
              </Button>
            </div>
          </div>

          {body.hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {body.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {body.mentions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {body.mentions.map((mention) => (
                <span
                  key={mention}
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] text-foreground"
                >
                  @{mention}
                </span>
              ))}
            </div>
          )}

          <label className="mt-3 flex flex-col gap-1 text-xs">
            <span className="font-medium">Call to action</span>
            <Input
              value={body.callToAction}
              onChange={(event) => setCallToAction(event.target.value)}
              className="h-8 text-sm"
              placeholder="Tap the link in bio"
              aria-label="Call to action"
            />
          </label>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Media
          </div>
          <MediaAttachmentList
            projectId={project.meta.id}
            mediaIds={body.mediaIds}
            onAttach={attachMedia}
            onDetach={detachMedia}
          />
        </Card>
      </div>

      <div className="space-y-4">
        {preview ? (
          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Live preview</div>
            <p className="whitespace-pre-wrap text-sm">
              {currentPlain || (
                <span className="text-muted-foreground">Nothing to preview yet.</span>
              )}
            </p>
            {body.hashtags.length > 0 && (
              <p className="mt-2 text-sm text-primary">
                {body.hashtags.map((tag) => `#${tag}`).join(" ")}
              </p>
            )}
            {body.callToAction && (
              <p className="mt-2 text-sm text-muted-foreground">
                {body.callToAction}
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-4 text-xs text-muted-foreground">
            <p>
              <strong className="font-medium text-foreground">Tip:</strong> toggle
              Preview to see the post rendered, or use the toolbar to format
              the body. Hashtags and @mentions are auto-detected.
            </p>
            <p className="mt-2">
              Use the Caption Manager and Hashtag Manager to reuse the
              captions and hashtag groups you have already saved.
            </p>
          </Card>
        )}
      </div>

      {captionPickerOpen && (
        <CaptionPicker
          onInsert={addCaption}
          onClose={() => setCaptionPickerOpen(false)}
        />
      )}

      {hashtagPickerOpen && (
        <HashtagPicker
          onInsert={addHashtag}
          onClose={() => setHashtagPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Post preview                                                               */
/* -------------------------------------------------------------------------- */

function PostPreview({ body }: { body: SocialPostBody }) {
  const text = buildPlainText(body);
  return (
    <div className="rounded border border-border bg-background p-3 text-sm">
      <p className="whitespace-pre-wrap">
        {text || (
          <span className="text-muted-foreground">Nothing to preview yet.</span>
        )}
      </p>
      {body.hashtags.length > 0 && (
        <p className="mt-2 text-sm text-primary">
          {body.hashtags.map((tag) => `#${tag}`).join(" ")}
        </p>
      )}
      {body.callToAction && (
        <p className="mt-2 text-sm text-muted-foreground">{body.callToAction}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Media attachment list                                                      */
/* -------------------------------------------------------------------------- */

interface MediaAttachmentListProps {
  projectId: string;
  mediaIds: string[];
  onAttach: (id: string) => void;
  onDetach: (id: string) => void;
}

function MediaAttachmentList({
  projectId,
  mediaIds,
  onAttach,
  onDetach,
}: MediaAttachmentListProps) {
  const [assets, setAssets] = useState<SocialMediaAsset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mediaIds.length === 0) {
        setAssets([]);
        return;
      }
      setLoading(true);
      const list: SocialMediaAsset[] = [];
      for (const id of mediaIds) {
        const res = await fetch(`/api/socialpilot/media?projectId=${encodeURIComponent(projectId)}&limit=200`);
        void res;
        // The list endpoint is the recent mirror, which may not include
        // a freshly added asset; we resolve through the media engine
        // by reading the asset directly. The list fetch is just a
        // warm-up.
        const { getMediaAsset } = await import("@/lib/socialpilot");
        const asset = await getMediaAsset(id);
        if (asset) list.push(asset);
      }
      if (!cancelled) {
        setAssets(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, mediaIds]);

  return (
    <div className="space-y-2">
      {mediaIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">No media attached</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="group relative overflow-hidden rounded border border-border bg-muted"
            >
              {asset.kind === "image" && asset.objectUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.objectUrl}
                  alt={asset.title}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  {asset.kind}
                </div>
              )}
              <div className="flex items-center justify-between gap-1 bg-background/80 p-1 text-[10px]">
                <span className="truncate">{asset.title}</span>
                <button
                  type="button"
                  onClick={() => onDetach(asset.id)}
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  aria-label={`Detach ${asset.title}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => setPickerOpen((value) => !value)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Attach from media library
      </Button>
      {pickerOpen && (
        <MediaPicker
          projectId={projectId}
          onAttach={(id) => {
            onAttach(id);
          }}
          onClose={() => setPickerOpen(false)}
          exclude={mediaIds}
        />
      )}
    </div>
  );
}

function MediaPicker({
  projectId,
  onAttach,
  onClose,
  exclude,
}: {
  projectId: string;
  onAttach: (id: string) => void;
  onClose: () => void;
  exclude: string[];
}) {
  const [items, setItems] = useState<SocialMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { listMediaAssets } = await import("@/lib/socialpilot");
      const summaries = await listMediaAssets({ projectId, limit: 200 });
      const list: SocialMediaAsset[] = [];
      for (const summary of summaries) {
        const asset = await (
          await import("@/lib/socialpilot")
        ).getMediaAsset(summary.id);
        if (asset) list.push(asset);
      }
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = items.filter((asset) => {
    if (exclude.includes(asset.id)) return false;
    if (!search) return true;
    return (
      asset.title.toLowerCase().includes(search.toLowerCase()) ||
      asset.filename.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Media library
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close media picker"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <div className="relative mb-2">
        <Search
          className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assets"
          className="h-7 pl-7 text-xs"
          aria-label="Search media"
        />
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No assets found</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => onAttach(asset.id)}
                className="block w-full overflow-hidden rounded border border-border bg-muted text-left"
              >
                {asset.kind === "image" && asset.objectUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.objectUrl}
                    alt={asset.title}
                    className="h-20 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 items-center justify-center text-[10px] text-muted-foreground">
                    {asset.kind}
                  </div>
                )}
                <div className="bg-background/80 p-1 text-[10px]">
                  <span className="truncate">{asset.title}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Caption picker                                                             */
/* -------------------------------------------------------------------------- */

function CaptionPicker({
  onInsert,
  onClose,
}: {
  onInsert: (caption: SocialCaptionBody) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<SocialCaptionBody[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { listSocialProjects } = await import("@/lib/socialpilot");
      const summaries = await listSocialProjects({ kind: "caption", limit: 200 });
      const { openSocialProject } = await import("@/lib/socialpilot");
      const { asCaptionBody } = await import("@/lib/socialpilot/bodies");
      const list: SocialCaptionBody[] = [];
      for (const summary of summaries) {
        const project = await openSocialProject(summary.id);
        if (project) list.push(asCaptionBody(project.body));
      }
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = items.filter((caption) => {
    if (category && caption.category.toLowerCase() !== category.toLowerCase())
      return false;
    if (!search) return true;
    return (
      caption.text.toLowerCase().includes(search.toLowerCase()) ||
      caption.category.toLowerCase().includes(search.toLowerCase()) ||
      caption.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const categories = uniq(items.map((caption) => caption.category).filter(Boolean));

  async function toggleFavorite(caption: SocialCaptionBody) {
    // We need to find the project for this caption; we don't track
    // the id on the body, so we re-derive by title for now.
    const { listSocialProjects, openSocialProject, saveSocialProject } = await import(
      "@/lib/socialpilot"
    );
    const { asCaptionBody } = await import("@/lib/socialpilot/bodies");
    const summaries = await listSocialProjects({ kind: "caption", limit: 200 });
    for (const summary of summaries) {
      const project = await openSocialProject(summary.id);
      if (!project) continue;
      const body = asCaptionBody(project.body);
      if (body.text === caption.text && body.category === caption.category) {
        await saveSocialProject({
          ...project,
          body: { ...body, isFavorite: !body.isFavorite },
        });
        toast({
          message: body.isFavorite ? "Removed from favourites" : "Added to favourites",
          tone: "info",
        });
        // Refresh list.
        const updated = await listSocialProjects({ kind: "caption", limit: 200 });
        const list: SocialCaptionBody[] = [];
        for (const entry of updated) {
          const next = await openSocialProject(entry.id);
          if (next) list.push(asCaptionBody(next.body));
        }
        setItems(list);
        return;
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Insert a saved caption</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close caption picker"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search captions"
              className="h-8 pl-7 text-sm"
              aria-label="Search captions"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-8 rounded border border-border bg-background px-2 text-xs"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No captions yet. Save a caption from the Caption Manager first.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {filtered.map((caption) => (
              <li
                key={caption.text}
                className="rounded border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm">
                      {caption.text}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      {caption.category && <span>{caption.category}</span>}
                      {caption.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(caption)}
                      className={cn(
                        "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
                        caption.isFavorite && "text-primary"
                      )}
                      aria-label={
                        caption.isFavorite ? "Unfavourite" : "Favourite"
                      }
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5",
                          caption.isFavorite && "fill-primary"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onInsert(caption)}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Insert
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hashtag picker                                                             */
/* -------------------------------------------------------------------------- */

function HashtagPicker({
  onInsert,
  onClose,
}: {
  onInsert: (tag: string) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<SocialHashtagGroupBody[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { listSocialProjects, openSocialProject } = await import(
        "@/lib/socialpilot"
      );
      const { asHashtagGroupBody } = await import("@/lib/socialpilot/bodies");
      const summaries = await listSocialProjects({ kind: "hashtag", limit: 200 });
      const list: SocialHashtagGroupBody[] = [];
      for (const summary of summaries) {
        const project = await openSocialProject(summary.id);
        if (project) list.push(asHashtagGroupBody(project.body));
      }
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = items.filter((group) => {
    if (!search) return true;
    return (
      group.name.toLowerCase().includes(search.toLowerCase()) ||
      group.category.toLowerCase().includes(search.toLowerCase()) ||
      group.tags.some((tag) =>
        tag.toLowerCase().includes(search.toLowerCase())
      )
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Insert a hashtag group</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close hashtag picker"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mb-3 relative">
          <Search
            className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hashtag groups"
            className="h-8 pl-7 text-sm"
            aria-label="Search hashtag groups"
          />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hashtag groups yet. Save one from the Hashtag Manager first.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {filtered.map((group) => (
              <li
                key={group.name}
                className="rounded border border-border bg-background p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{group.name}</p>
                    {group.category && (
                      <p className="text-[10px] text-muted-foreground">
                        {group.category}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => {
                      group.tags.forEach((tag) => onInsert(tag));
                      onClose();
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Insert all
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => onInsert(tag)}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
