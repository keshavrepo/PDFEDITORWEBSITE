"use client";

/**
 * Snippet surface for DevPilot.
 *
 * Saves a single snippet per session. Mirrors the SocialPilot
 * Caption Manager shape: the body is constrained to the snippet
 * schema, the autosave loop persists the body to IndexedDB, the
 * snippet is mirrored to the server-side recent-sessions index.
 *
 * Mirrors /components/socialpilot/surfaces/caption-manager.tsx.
 */

import { Copy, Star, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "../toast";
import {
  asSnippetBody,
  deleteDevSession,
  duplicateDevSession,
  toggleFavoriteDevSession,
  type DevSession,
} from "@/lib/devpilot";

interface SnippetSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const LANGUAGES = [
  "",
  "ts",
  "js",
  "tsx",
  "jsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "cpp",
  "cs",
  "php",
  "sh",
  "bash",
  "zsh",
  "sql",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "toml",
  "xml",
  "md",
];

export function SnippetSurface({ session, onChange }: SnippetSurfaceProps) {
  const body = asSnippetBody(session.body);
  const { toast } = useToast();

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  async function duplicate() {
    const copy = await duplicateDevSession(session.meta.id);
    if (!copy) {
      toast({ message: "Could not duplicate that snippet.", tone: "error" });
      return;
    }
    toast({ message: "Snippet duplicated", tone: "success" });
  }

  async function toggleFav() {
    const summary = await toggleFavoriteDevSession(session.meta.id);
    if (!summary) return;
    onChange({ ...session, meta: { ...session.meta, isFavorite: summary.isFavorite } });
    toast({
      message: summary.isFavorite ? "Added to favourites" : "Removed from favourites",
      tone: "info",
    });
  }

  async function remove() {
    const ok = await deleteDevSession(session.meta.id);
    if (!ok) {
      toast({ message: "Could not delete that snippet.", tone: "error" });
      return;
    }
    toast({ message: "Snippet deleted", tone: "info" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Snippet</h2>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => void toggleFav()}
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
              {body.isFavorite ? "Favourited" : "Favourite"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => void duplicate()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => void remove()}
              aria-label="Delete snippet"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Category</span>
            <Input
              value={body.category}
              onChange={(event) => commit({ category: event.target.value })}
              placeholder="e.g. JavaScript"
              className="h-8 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Language</span>
            <select
              value={body.language}
              onChange={(event) => commit({ language: event.target.value })}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang || "none"} value={lang}>
                  {lang || "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Tags</span>
            <Input
              value={body.tags.join(", ")}
              onChange={(event) =>
                commit({
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              placeholder="comma-separated"
              className="h-8 text-xs"
            />
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-xs">
          <span className="font-medium">Description</span>
          <Input
            value={body.description}
            onChange={(event) => commit({ description: event.target.value })}
            placeholder="What does this snippet do?"
            className="h-8 text-xs"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs">
          <span className="font-medium">Code</span>
          <textarea
            value={body.text}
            onChange={(event) => commit({ text: event.target.value })}
            placeholder="Paste or type your snippet…"
            className="min-h-[260px] rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </label>
      </Card>
    </div>
  );
}
