"use client";

/**
 * Caption Manager — Batch 2 surface.
 *
 * Lets the user save, categorise, search, favourite, duplicate and
 * delete captions. The body of every caption project is normalised
 * to the `SocialCaptionBody` shape; the workspace shell takes care
 * of autosave, the recent mirror and the favourites flag.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
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
  asCaptionBody,
  DEFAULT_CAPTION_BODY,
  type SocialCaptionBody,
} from "@/lib/socialpilot/bodies";
import type { SocialProject } from "@/lib/socialpilot";

interface CaptionManagerProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function CaptionManager({ project, onChange }: CaptionManagerProps) {
  const body = asCaptionBody(project.body);
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  function commit(next: SocialCaptionBody) {
    onChange({ ...project, body: next });
  }

  function setText(text: string) {
    commit({ ...body, text });
  }

  function setCategory(category: string) {
    commit({ ...body, category });
  }

  function setTags(tags: string[]) {
    commit({ ...body, tags });
  }

  function addTag(tag: string) {
    const cleaned = tag.trim();
    if (!cleaned) return;
    if (body.tags.includes(cleaned)) return;
    setTags([...body.tags, cleaned]);
  }

  function removeTag(tag: string) {
    setTags(body.tags.filter((entry) => entry !== tag));
  }

  function toggleFavorite() {
    commit({ ...body, isFavorite: !body.isFavorite });
    toast({
      message: body.isFavorite ? "Removed from favourites" : "Added to favourites",
      tone: "info",
    });
  }

  function duplicate() {
    // Persist current caption as a new project via the engine.
    void (async () => {
      const { createSocialProject, openSocialProject, saveSocialProject } =
        await import("@/lib/socialpilot");
      const copy = await createSocialProject("caption", {
        title: `${project.meta.title} (copy)`,
      });
      if (!copy) return;
      const saved = await saveSocialProject({
        ...copy,
        body: { ...body, isFavorite: false },
      });
      void openSocialProject(saved.meta.id);
      toast({ message: "Caption duplicated", tone: "success" });
    })();
  }

  function remove() {
    void (async () => {
      const { deleteSocialProject } = await import("@/lib/socialpilot");
      await deleteSocialProject(project.meta.id);
      toast({ message: "Caption deleted", tone: "info" });
    })();
  }

  // Reset to defaults for a brand-new caption project.
  const isEmpty =
    body.text === "" &&
    body.category === "" &&
    body.tags.length === 0;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Save className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Caption editor
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
                {body.isFavorite ? "Favourite" : "Favourite"}
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
          <label className="mb-3 flex flex-col gap-1 text-xs">
            <span className="font-medium">Caption text</span>
            <textarea
              value={body.text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-[200px] rounded border border-border bg-background p-2 text-sm"
              aria-label="Caption text"
              placeholder="Write a caption you can reuse…"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Category</span>
              <Input
                value={body.category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. Launch, Promo"
                aria-label="Caption category"
              />
            </label>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Tags</span>
              <TagInput
                tags={body.tags}
                onAdd={addTag}
                onRemove={removeTag}
                ariaLabel="Caption tags"
              />
            </div>
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-4 text-xs text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Tip:</strong> use
            the Caption Manager to save the captions you reach for every
            day. Open the Post Creator and click &ldquo;Insert caption&rdquo; to drop a
            saved caption straight into a draft.
          </p>
          <p className="mt-2">
            Categories and tags are searchable from the navigation rail.
          </p>
        </Card>
        {isEmpty ? (
          <Card className="p-4 text-xs text-muted-foreground">
            Start typing to add a caption.
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tag input                                                                  */
/* -------------------------------------------------------------------------- */

function TagInput({
  tags,
  onAdd,
  onRemove,
  ariaLabel,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  ariaLabel: string;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1 rounded border border-border bg-background p-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-2.5 w-2.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              if (value.trim()) {
                onAdd(value.trim());
                setValue("");
              }
            }
            if (event.key === "Backspace" && value === "" && tags.length > 0) {
              onRemove(tags[tags.length - 1]!);
            }
          }}
          className="min-w-[80px] flex-1 bg-transparent px-1 text-xs outline-none"
          placeholder="Add tag…"
          aria-label={ariaLabel}
        />
      </div>
    </div>
  );
}
