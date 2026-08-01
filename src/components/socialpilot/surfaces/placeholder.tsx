"use client";

/**
 * Placeholder surface for any project kind whose dedicated editor
 * has not been wired up yet.
 *
 * The foundation surfaces intentionally render a structured body so
 * autosave, the server mirror and the properties panel can be
 * exercised today. The future tool replaces this file with a real
 * editor.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PlaceholderSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
  /** A short label for the project kind, e.g. "Story" or "Carousel". */
  label?: string;
  /** A short blurb explaining what the future tool will do. */
  blurb?: string;
  /** Default field keys for the foundation body. */
  fields?: string[];
}

interface PlaceholderBody {
  fields: Record<string, string>;
}

function asPlaceholderBody(value: unknown, fields: string[]): PlaceholderBody {
  const out: Record<string, string> = {};
  for (const field of fields) out[field] = "";
  if (!value || typeof value !== "object") return { fields: out };
  const record = value as Record<string, unknown>;
  const stored =
    record.fields && typeof record.fields === "object"
      ? (record.fields as Record<string, unknown>)
      : null;
  for (const field of fields) {
    if (stored && typeof stored[field] === "string") {
      out[field] = stored[field] as string;
    }
  }
  return { fields: out };
}

export function PlaceholderSurface({
  project,
  onChange,
  label,
  blurb,
  fields,
}: PlaceholderSurfaceProps) {
  const effectiveFields = fields ?? ["title", "notes"];
  const body = asPlaceholderBody(project.body, effectiveFields);

  function update(field: string, value: string) {
    onChange({
      ...project,
      body: { ...body, fields: { ...body.fields, [field]: value } },
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {label ?? project.meta.kind} foundation
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          {blurb ?? project.meta.kind}
        </p>
        <div className="space-y-3">
          {effectiveFields.map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs">
              <span className="font-medium capitalize">
                {field.replace(/[-_]/g, " ")}
              </span>
              <input
                type="text"
                value={body.fields[field] ?? ""}
                onChange={(event) => update(field, event.target.value)}
                className="rounded border border-border bg-background p-2 text-sm"
                aria-label={field}
                placeholder={`Add ${field.replace(/[-_]/g, " ")}…`}
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
