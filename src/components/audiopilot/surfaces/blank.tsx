"use client";

/**
 * Blank surface — fallback for any session kind that has not been
 * wired up to a real surface yet.
 *
 * Mirrors the WebPilot `blank.tsx` surface.
 */

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AudioSession } from "@/lib/audiopilot";

interface BlankSurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Blank AudioPilot session
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The foundation plus four core audio tools ship in Batch 1. Future
          audio tools will reuse the same workspace shell and engine.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Notes</h3>
        <textarea
          value={body.notes}
          onChange={(event) => updateNotes(event.target.value)}
          placeholder="Capture anything you want the next session to remember…"
          className="h-32 w-full rounded-md border border-border bg-background p-2 text-xs"
          aria-label="Notes"
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          The notes are stored on the session body and survive a reload.
        </p>
      </Card>
    </div>
  );
}
