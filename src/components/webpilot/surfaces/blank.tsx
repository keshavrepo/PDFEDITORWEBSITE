"use client";

/**
 * Blank surface — fallback for any session kind that has not been
 * wired up to a real surface yet.
 *
 * Mirrors the DevPilot `blank.tsx` surface.
 */

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { WebSession } from "@/lib/webpilot";

interface BlankSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
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

export function BlankSurface({ session, onChange }: BlankSurfaceProps) {
  const body = asBlankBody(session.body);

  function updateNotes(value: string) {
    onChange({
      ...session,
      body: { ...body, notes: value },
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {session.meta.kind} foundation
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          The {session.meta.kind} tool ships in a future batch. The body is
          stored on this session so the autosave loop, recent mirror and
          properties panel can be exercised today.
        </p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">Notes</span>
          <textarea
            value={body.notes}
            onChange={(event) => updateNotes(event.target.value)}
            placeholder="Add notes for this session…"
            className="min-h-[260px] rounded-md border border-border bg-background p-2 text-sm"
          />
        </label>
      </Card>
    </div>
  );
}
