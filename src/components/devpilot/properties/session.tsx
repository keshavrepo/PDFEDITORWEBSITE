"use client";

/**
 * DevPilot session properties panel.
 *
 * The right-rail panel is read-only: it shows the session metadata,
 * the version, the autosave state and a small summary of the body.
 * Future tools can extend this with their own kind-specific sections
 * without changing the shell.
 *
 * Mirrors /components/socialpilot/properties/project.tsx.
 */

import type { DevSession } from "@/lib/devpilot";
import { Star, Tag } from "lucide-react";

interface SessionPropertiesProps {
  session: DevSession;
}

function summariseBody(value: unknown): string {
  if (!value || typeof value !== "object") return "Empty body";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim()) {
    return `Snippet · ${record.text.slice(0, 40)}${record.text.length > 40 ? "…" : ""}`;
  }
  if (typeof record.notes === "string" && record.notes.trim()) {
    return `Notes · ${record.notes.slice(0, 40)}${record.notes.length > 40 ? "…" : ""}`;
  }
  if (Array.isArray(record.entries) && record.entries.length > 0) {
    return `History · ${record.entries.length} entries`;
  }
  if (record.fields && typeof record.fields === "object") {
    const fields = record.fields as Record<string, unknown>;
    const keys = Object.keys(fields).filter(
      (key) => typeof fields[key] === "string" && (fields[key] as string).length > 0
    );
    if (keys.length > 0) return `Fields · ${keys.length} filled`;
  }
  return "Empty body";
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
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Title</dt>
            <dd className="truncate text-right font-medium" title={session.meta.title}>
              {session.meta.title}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Kind</dt>
            <dd className="font-medium">{session.meta.kind}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium">{session.meta.category}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="tabular-nums font-medium">v{session.meta.version}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="tabular-nums">
              {Math.max(1, Math.round(session.meta.size / 1024))} KB
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Last saved</dt>
            <dd className="tabular-nums">
              {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </h3>
        <div className="flex items-center gap-2">
          {session.meta.isFavorite ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Star className="h-3 w-3 fill-primary" aria-hidden="true" />
              Favourite
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Not favourited</span>
          )}
        </div>
        {session.meta.tags && session.meta.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {session.meta.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]"
              >
                <Tag className="h-2.5 w-2.5" aria-hidden="true" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Body
        </h3>
        <p className="text-[11px] text-muted-foreground">{summariseBody(session.body)}</p>
      </section>
    </div>
  );
}
