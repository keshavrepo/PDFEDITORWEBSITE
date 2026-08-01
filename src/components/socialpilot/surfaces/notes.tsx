"use client";

/**
 * Notes — Batch 2 surface.
 *
 * A simple creator note with rich text, an optional checklist mode,
 * tags, search and a favourite flag. The body is normalised to the
 * `SocialNoteBody` shape; the workspace shell takes care of autosave,
 * search and the favourites flag.
 */

import { useMemo, useState } from "react";
import {
  ListChecks,
  Plus,
  Search,
  Star,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { cn } from "@/lib/utils";
import {
  asNoteBody,
  DEFAULT_NOTE_BODY,
  emptyParagraphs,
  paragraphsToPlainTextLocal,
} from "@/lib/socialpilot/bodies";
import type { SocialProject, SocialRichTextParagraph } from "@/lib/socialpilot";
import { RichTextEditor } from "./shared/rich-text-editor";

interface NotesProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function Notes({ project, onChange }: NotesProps) {
  const body = asNoteBody(project.body);
  const { toast } = useToast();

  function commit(next: typeof body) {
    onChange({ ...project, body: next });
  }

  function setParagraphs(paragraphs: SocialRichTextParagraph[]) {
    const plainText = paragraphsToPlainTextLocal(paragraphs);
    commit({ ...body, format: "rich", paragraphs, plainText });
  }

  function setPlainText(text: string) {
    const paragraphs = text
      .split("\n")
      .map((line) => ({ text: line, marks: [] } as SocialRichTextParagraph));
    commit({ ...body, format: "plain", paragraphs, plainText: text });
  }

  function setChecklist(value: boolean) {
    if (value && !body.isChecklist) {
      // Convert the existing body to a checklist.
      const paragraphs: SocialRichTextParagraph[] =
        body.paragraphs.length > 0
          ? body.paragraphs.map((paragraph) => ({
              ...paragraph,
              listKind: "checklist" as const,
              checked: paragraph.checked ?? false,
            }))
          : emptyParagraphs(true);
      commit({ ...body, isChecklist: true, paragraphs });
    } else if (!value && body.isChecklist) {
      const paragraphs: SocialRichTextParagraph[] = body.paragraphs.map(
        (paragraph) => {
          const { listKind: _listKind, checked: _checked, ...rest } =
            paragraph;
          return rest;
        }
      );
      commit({ ...body, isChecklist: false, paragraphs });
    }
  }

  function setFormat(format: "plain" | "rich") {
    commit({ ...body, format });
  }

  function addTag(tag: string) {
    const cleaned = tag.trim();
    if (!cleaned) return;
    if (body.tags.includes(cleaned)) return;
    commit({ ...body, tags: [...body.tags, cleaned] });
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

  function deleteNote() {
    void (async () => {
      const { deleteSocialProject } = await import("@/lib/socialpilot");
      await deleteSocialProject(project.meta.id);
      toast({ message: "Note deleted", tone: "info" });
    })();
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Type className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Note
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setFormat(body.format === "rich" ? "plain" : "rich")}
              >
                {body.format === "rich" ? "Plain text" : "Rich text"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setChecklist(!body.isChecklist)}
                aria-pressed={body.isChecklist}
              >
                <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                {body.isChecklist ? "Checklist" : "Checklist"}
              </Button>
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
                onClick={deleteNote}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>
          {body.format === "rich" ? (
            <RichTextEditor
              paragraphs={body.paragraphs.length > 0 ? body.paragraphs : emptyParagraphs(body.isChecklist)}
              onChange={setParagraphs}
              ariaLabel="Note body"
              checklist={body.isChecklist}
              placeholder="Write a note…"
            />
          ) : (
            <textarea
              value={body.plainText}
              onChange={(event) => setPlainText(event.target.value)}
              className="min-h-[200px] w-full rounded border border-border bg-background p-2 text-sm"
              aria-label="Note body"
              placeholder="Write a note…"
            />
          )}
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tags
          </p>
          <TagInput tags={body.tags} onAdd={addTag} onRemove={removeTag} />
        </Card>
        <Card className="p-3 text-xs text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Tip:</strong>{" "}
            toggle checklist mode for to-dos. Tags help you find the note
            again later.
          </p>
        </Card>
      </div>
    </div>
  );
}

function TagInput({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
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
          aria-label="Note tags"
        />
      </div>
    </div>
  );
}
