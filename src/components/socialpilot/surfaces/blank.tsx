"use client";

/**
 * Blank surface — fallback for any project kind that has not been
 * wired up to a real surface yet.
 *
 * Batch 1 ships the foundation shell; future tools swap this blank
 * for a real editor surface. The component is intentionally
 * minimal: it accepts a project, renders a notes field, and calls
 * `onChange` with the new body so the shell's autosave loop picks it
 * up.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BlankSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

interface BlankBody {
  kind: string;
  notes: string;
  fields: Record<string, unknown>;
}

function asBlankBody(value: unknown): BlankBody {
  if (!value || typeof value !== "object") {
    return { kind: "blank", notes: "", fields: {} };
  }
  const record = value as Record<string, unknown>;
  return {
    kind: typeof record.kind === "string" ? record.kind : "blank",
    notes: typeof record.notes === "string" ? record.notes : "",
    fields:
      record.fields && typeof record.fields === "object"
        ? (record.fields as Record<string, unknown>)
        : {},
  };
}

/**
 * A minimal "blank" surface that demonstrates the contract every
 * future surface must implement: accept a project, render the body
 * so the user can edit it, and call `onChange` with the new body.
 */
export function BlankSurface({ project, onChange }: BlankSurfaceProps) {
  const body = asBlankBody(project.body);

  function updateNotes(value: string) {
    onChange({
      ...project,
      body: { ...body, notes: value },
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Project notes
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          The {project.meta.kind} surface is the foundation entry. Future
          SocialPilot tools will replace this with a dedicated editor.
          Type here to try the autosave loop: every keystroke is flushed
          to local storage and mirrored to the server.
        </p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Notes</span>
          <textarea
            value={body.notes}
            onChange={(event) => updateNotes(event.target.value)}
            rows={6}
            className="rounded border border-border bg-background p-2 font-mono text-sm"
            aria-label="Project notes"
            placeholder="Capture ideas, links or anything else for this project…"
          />
        </label>
      </Card>
    </div>
  );
}
