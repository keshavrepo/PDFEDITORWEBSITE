"use client";

/**
 * Cron builder surface.
 *
 * Five-field cron expression builder with a human-readable
 * description, a copyable expression and a preset library. The
 * implementation lives in `lib/devpilot/tools/cron.ts`.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useState } from "react";
import { CalendarClock, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asCronBody,
  buildCronExpression,
  copyToClipboard,
  CRON_FIELD_LABELS,
  deleteDevSession,
  describeCron,
} from "@/lib/devpilot";
import type { DevCronBody, DevSession } from "@/lib/devpilot";

interface CronSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const PRESETS: Array<{ id: string; label: string; fields: DevCronBody }> = [
  {
    id: "every-minute",
    label: "Every minute",
    fields: { minute: "*", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*", note: "", isFavorite: false },
  },
  {
    id: "every-hour",
    label: "Every hour",
    fields: { minute: "0", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*", note: "", isFavorite: false },
  },
  {
    id: "every-day-9am",
    label: "Every day at 09:00",
    fields: { minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "*", note: "", isFavorite: false },
  },
  {
    id: "weekday-9am",
    label: "Weekdays at 09:00",
    fields: { minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1-5", note: "", isFavorite: false },
  },
  {
    id: "monday-930am",
    label: "Mondays at 09:30",
    fields: { minute: "30", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1", note: "", isFavorite: false },
  },
  {
    id: "first-of-month",
    label: "First day of the month at midnight",
    fields: { minute: "0", hour: "0", dayOfMonth: "1", month: "*", dayOfWeek: "*", note: "", isFavorite: false },
  },
];

export function CronSurface({ session, onChange }: CronSurfaceProps) {
  const body = asCronBody(session.body);
  const { toast } = useToast();
  const [customExpression, setCustomExpression] = useState("");

  function commit(patch: Partial<DevCronBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const expression = buildCronExpression({
    minute: body.minute,
    hour: body.hour,
    dayOfMonth: body.dayOfMonth,
    month: body.month,
    dayOfWeek: body.dayOfWeek,
  });

  const description = describeCron({
    minute: body.minute,
    hour: body.hour,
    dayOfMonth: body.dayOfMonth,
    month: body.month,
    dayOfWeek: body.dayOfWeek,
  });

  function applyPreset(preset: typeof PRESETS[number]) {
    commit(preset.fields);
    toast({ message: `Loaded preset · ${preset.label}`, tone: "success" });
  }

  function applyCustomExpression() {
    const parts = customExpression.trim().split(/\s+/);
    if (parts.length !== 5) {
      toast({ message: "A cron expression must have five fields.", tone: "error" });
      return;
    }
    commit({
      minute: parts[0]!,
      hour: parts[1]!,
      dayOfMonth: parts[2]!,
      month: parts[3]!,
      dayOfWeek: parts[4]!,
    });
    toast({ message: "Loaded custom expression", tone: "success" });
  }

  function resetAll() {
    commit({ minute: "*", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*", note: body.note });
  }

  async function copyExpression() {
    const ok = await copyToClipboard(expression);
    toast({ message: ok ? "Expression copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Visual cron expression builder with a human-readable description."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyExpression}
        copyLabel="Copy expression"
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={resetAll}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </Button>
        }
        status={
          <span className="inline-flex items-center gap-2 text-[11px]">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              {expression}
            </code>
            {description.ok ? (
              <span className="text-primary">{description.description}</span>
            ) : (
              <span className="text-destructive">{description.error}</span>
            )}
          </span>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Fields</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CRON_FIELD_LABELS.map((field) => {
              const value = body[field.key as keyof typeof body] as string;
              return (
                <label key={field.key} className="flex flex-col gap-1 text-xs">
                  <span className="font-medium">{field.label}</span>
                  <Input
                    value={value}
                    onChange={(event) =>
                      commit({ [field.key]: event.target.value } as Partial<DevCronBody>)
                    }
                    className="h-8 font-mono text-xs"
                    spellCheck={false}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {field.min}–{field.max}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold">Custom expression</h3>
            <span className="text-[10px] text-muted-foreground">
              Paste any five-field expression to load it.
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              value={customExpression}
              onChange={(event) => setCustomExpression(event.target.value)}
              placeholder="* * * * *"
              className="h-8 font-mono text-xs"
              spellCheck={false}
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={applyCustomExpression}
            >
              Load
            </Button>
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Presets</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-md border border-border p-2 text-left text-[11px] hover:bg-accent"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{preset.label}</span>
                </div>
                <code className="mt-1 block text-[10px] text-muted-foreground">
                  {buildCronExpression(preset.fields)}
                </code>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Description</h3>
          {description.ok ? (
            <p className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
              {description.description}
            </p>
          ) : (
            <p className="text-xs text-destructive">{description.error}</p>
          )}
          <label className="mt-2 flex flex-col gap-1 text-xs">
            <span className="font-medium">Note</span>
            <Input
              value={body.note}
              onChange={(event) => commit({ note: event.target.value })}
              placeholder="What does this schedule do?"
              className="h-8 text-xs"
            />
          </label>
        </Card>
      </div>
    </div>
  );
}
