"use client";

/**
 * Hashtag Manager — Batch 2 surface.
 *
 * Lets the user save, categorise, search, favourite, duplicate and
 * delete hashtag groups. Tags are auto-prefixed with `#` on input.
 */

import {
  Copy,
  Hash,
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
import { cn } from "@/lib/utils";
import {
  asHashtagGroupBody,
  DEFAULT_HASHTAG_BODY,
} from "@/lib/socialpilot/bodies";
import type { SocialProject } from "@/lib/socialpilot";

interface HashtagManagerProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function HashtagManager({ project, onChange }: HashtagManagerProps) {
  const body = asHashtagGroupBody(project.body);
  const { toast } = useToast();

  function commit(next: typeof body) {
    onChange({ ...project, body: next });
  }

  function setName(name: string) {
    commit({ ...body, name });
  }

  function setCategory(category: string) {
    commit({ ...body, category });
  }

  function addTag(raw: string) {
    const cleaned = raw.trim().replace(/^#+/, "");
    if (!cleaned) return;
    const tag = `#${cleaned}`;
    if (body.tags.includes(tag)) return;
    commit({ ...body, tags: [...body.tags, tag] });
  }

  function removeTag(tag: string) {
    commit({ ...body, tags: body.tags.filter((entry) => entry !== tag) });
  }

  function toggleFavorite() {
    commit({ ...body, isFavorite: !body.isFavorite });
    toast({
      message: body.isFavorite ? "Removed from favourites" : "Added to favourites",
      tone: "info",
    });
  }

  function duplicate() {
    void (async () => {
      const { createSocialProject, saveSocialProject } = await import(
        "@/lib/socialpilot"
      );
      const copy = await createSocialProject("hashtag", {
        title: `${project.meta.title} (copy)`,
      });
      if (!copy) return;
      await saveSocialProject({
        ...copy,
        body: { ...body, isFavorite: false },
      });
      toast({ message: "Hashtag group duplicated", tone: "success" });
    })();
  }

  function remove() {
    void (async () => {
      const { deleteSocialProject } = await import("@/lib/socialpilot");
      await deleteSocialProject(project.meta.id);
      toast({ message: "Hashtag group deleted", tone: "info" });
    })();
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Hashtag group
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={toggleFavorite}
                aria-pressed={body.isFavorite}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    body.isFavorite && "fill-primary text-primary"
                  )}
                  aria-hidden="true"
                />
                Favourite
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={duplicate}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={remove}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Group name</span>
              <Input
                value={body.name}
                onChange={(event) => setName(event.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. Launches"
                aria-label="Group name"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Category</span>
              <Input
                value={body.category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. Always-on"
                aria-label="Category"
              />
            </label>
          </div>
          <TagAdder onAdd={addTag} />
          {body.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1">
              {body.tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-primary/20"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-4 text-xs text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Tip:</strong> use
            the Hashtag Manager to save the hashtag groups you reach for
            every day. Open the Post Creator and click &ldquo;Insert hashtag
            group&rdquo; to drop the whole group into a draft.
          </p>
        </Card>
      </div>
    </div>
  );
}

function TagAdder({ onAdd }: { onAdd: (tag: string) => void }) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const value = String(data.get("tag") ?? "");
        onAdd(value);
        event.currentTarget.reset();
      }}
    >
      <Input
        name="tag"
        placeholder="#launchstack"
        className="h-8 text-sm"
        aria-label="New hashtag"
      />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add
      </Button>
    </form>
  );
}
