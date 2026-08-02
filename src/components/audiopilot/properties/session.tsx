"use client";

/**
 * AudioPilot session properties panel.
 *
 * The right-rail panel is read-only: it shows the session
 * metadata, the version, the autosave state and a small summary
 * of the body. The AudioPilot workspace shell does not host a
 * per-tool properties panel; the panel always shows the same
 * session summary so every surface has a consistent read-only
 * mirror of the active session.
 */

import type { AudioSession } from "@/lib/audiopilot";
import { Star } from "lucide-react";

interface SessionPropertiesProps {
  session: AudioSession;
}

function summariseBody(value: unknown): string {
  if (!value || typeof value !== "object") return "Empty body";
  const record = value as Record<string, unknown>;
  if (typeof record.notes === "string" && record.notes.trim()) {
    return `Notes · ${record.notes.slice(0, 40)}${
      record.notes.length > 40 ? "…" : ""
    }`;
  }
  if (Array.isArray(record.waveform)) {
    return `Waveform · ${record.waveform.length} buckets`;
  }
  if (Array.isArray(record.recordings)) {
    return `Recordings · ${record.recordings.length} capture${
      record.recordings.length === 1 ? "" : "s"
    }`;
  }
  if (typeof record.fileName === "string" && record.fileName) {
    return `File · ${record.fileName}`;
  }
  return "Audio body";
}

export function SessionProperties({ session }: SessionPropertiesProps) {
  const updatedAt = session.meta.autosavedAt ?? session.meta.updatedAt;
  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Session
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Title</dt>
            <dd
              className="truncate text-right font-medium"
              title={session.meta.title}
            >
              {session.meta.title}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Kind</dt>
            <dd className="font-medium">{session.meta.kind}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium">{session.meta.category}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="tabular-nums font-medium">v{session.meta.version}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="tabular-nums font-medium">
              {Math.max(1, Math.round(session.meta.size / 1024))} KB
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Favourite</dt>
            <dd className="font-medium">
              {session.meta.isFavorite ? (
                <Star
                  className="h-3.5 w-3.5 fill-primary text-primary"
                  aria-label="Favourited"
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Last saved</dt>
            <dd className="tabular-nums">
              {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Body
        </h3>
        <p className="text-muted-foreground">{summariseBody(session.body)}</p>
      </section>
    </div>
  );
}
