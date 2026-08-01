"use client";

/**
 * Social post surface — the foundation entry for the future post
 * tool. The body is a small typed envelope so future tools can
 * extend it without breaking existing projects.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { ImagePlus } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PostSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

interface PostBody {
  caption: string;
  hashtags: string;
  callToAction: string;
}

const DEFAULT_BODY: PostBody = {
  caption: "",
  hashtags: "",
  callToAction: "",
};

function asPostBody(value: unknown): PostBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_BODY };
  const record = value as Record<string, unknown>;
  return {
    caption: typeof record.caption === "string" ? record.caption : "",
    hashtags: typeof record.hashtags === "string" ? record.hashtags : "",
    callToAction:
      typeof record.callToAction === "string" ? record.callToAction : "",
  };
}

export function PostSurface({ project, onChange }: PostSurfaceProps) {
  const body = asPostBody(project.body);

  function update<K extends keyof PostBody>(key: K, value: PostBody[K]) {
    onChange({ ...project, body: { ...body, [key]: value } });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ImagePlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Post foundation
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          The post foundation holds the three text fields a post always
          needs. The future post tool will replace this with a full
          editor and a media-library picker.
        </p>
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Caption</span>
            <textarea
              value={body.caption}
              onChange={(event) => update("caption", event.target.value)}
              rows={4}
              className="rounded border border-border bg-background p-2 text-sm"
              aria-label="Caption"
              placeholder="Write the post copy…"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Hashtags</span>
            <input
              type="text"
              value={body.hashtags}
              onChange={(event) => update("hashtags", event.target.value)}
              className="rounded border border-border bg-background p-2 text-sm"
              aria-label="Hashtags"
              placeholder="#launchstack #socialpilot"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Call to action</span>
            <input
              type="text"
              value={body.callToAction}
              onChange={(event) => update("callToAction", event.target.value)}
              className="rounded border border-border bg-background p-2 text-sm"
              aria-label="Call to action"
              placeholder="Tap the link in bio"
            />
          </label>
        </div>
      </Card>
    </div>
  );
}
