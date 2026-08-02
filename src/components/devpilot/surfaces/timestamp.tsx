"use client";

/**
 * Timestamp workspace surface.
 *
 * Convert between Unix timestamps, ISO 8601 strings, UTC and local
 * time. Includes a relative-time string for human-friendly output.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useState } from "react";
import { Clock, Globe2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asTimestampBody,
  convertTimestamp,
  copyToClipboard,
  deleteDevSession,
} from "@/lib/devpilot";
import type { DevSession, DevTimestampBody } from "@/lib/devpilot";

interface TimestampSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const DIRECTIONS: Array<{ key: DevTimestampBody["direction"]; label: string }> = [
  { key: "fromUnix", label: "Unix → ISO" },
  { key: "fromIso", label: "ISO → Unix" },
  { key: "toUnix", label: "Date → Unix" },
  { key: "toIso", label: "Date → ISO" },
];

export function TimestampSurface({ session, onChange }: TimestampSurfaceProps) {
  const body = asTimestampBody(session.body);
  const { toast } = useToast();
  const [now, setNow] = useState(() => new Date());

  function commit(patch: Partial<DevTimestampBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const result = convertTimestamp(body.input, body.direction);

  function setNowAsUnixSeconds() {
    commit({ input: String(Math.floor(Date.now() / 1000)), direction: "fromUnix" });
  }

  function setNowAsIso() {
    commit({ input: new Date().toISOString(), direction: "fromIso" });
  }

  function refreshNow() {
    setNow(new Date());
    toast({ message: "Refreshed", tone: "info" });
  }

  async function copyValue(value: string | null, label: string) {
    if (!value) {
      toast({ message: `${label} is empty`, tone: "info" });
      return;
    }
    const ok = await copyToClipboard(value);
    toast({ message: ok ? `${label} copied` : "Could not copy", tone: ok ? "success" : "error" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Convert between Unix, ISO 8601, UTC and local time."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={async () => {
          await copyValue(result.iso ?? result.unix?.toString() ?? null, "Value");
        }}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        status={
          result.ok ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {result.relative ?? "—"}
            </span>
          ) : (
            <span className="text-destructive">{result.error}</span>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold">Input</h3>
            <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-border text-[10px]">
              {DIRECTIONS.map((direction) => (
                <button
                  key={direction.key}
                  type="button"
                  onClick={() => commit({ direction: direction.key })}
                  className={
                    body.direction === direction.key
                      ? "bg-accent px-2 py-1 font-medium"
                      : "px-2 py-1 text-muted-foreground hover:bg-accent"
                  }
                >
                  {direction.label}
                </button>
              ))}
            </div>
          </div>
          <Input
            value={body.input}
            onChange={(event) => commit({ input: event.target.value })}
            placeholder={
              body.direction === "fromUnix"
                ? "1717260000"
                : body.direction === "fromIso"
                  ? "2026-08-02T12:00:00Z"
                  : "Tue Aug 02 2026 12:00:00 GMT+0000"
            }
            className="h-8 font-mono text-xs"
            spellCheck={false}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={setNowAsUnixSeconds}
            >
              <Repeat className="h-3 w-3" aria-hidden="true" />
              Now as Unix
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={setNowAsIso}
            >
              <Repeat className="h-3 w-3" aria-hidden="true" />
              Now as ISO
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={refreshNow}
            >
              <Globe2 className="h-3 w-3" aria-hidden="true" />
              Refresh relative time
            </Button>
            <span className="ml-auto text-[10px] text-muted-foreground">
              Now (local): {now.toLocaleString()}
            </span>
          </div>
        </Card>

        {result.ok && (
          <Card className="p-3">
            <h3 className="mb-2 text-xs font-semibold">Result</h3>
            <ul className="space-y-2 text-[11px]">
              <ResultRow
                label="Unix (seconds)"
                value={result.unix?.toString() ?? "—"}
                onCopy={() => copyValue(result.unix?.toString() ?? null, "Unix")}
              />
              <ResultRow
                label="ISO 8601"
                value={result.iso ?? "—"}
                onCopy={() => copyValue(result.iso, "ISO")}
              />
              <ResultRow
                label="UTC"
                value={result.utc ?? "—"}
                onCopy={() => copyValue(result.utc, "UTC")}
              />
              <ResultRow
                label="Local time"
                value={result.local ?? "—"}
                onCopy={() => copyValue(result.local, "Local time")}
              />
              <ResultRow
                label="Relative"
                value={result.relative ?? "—"}
                onCopy={() => copyValue(result.relative, "Relative")}
              />
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

interface ResultRowProps {
  label: string;
  value: string;
  onCopy: () => void;
}

function ResultRow({ label, value, onCopy }: ResultRowProps) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <code className="flex-1 truncate font-mono">{value}</code>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCopy}>
        Copy
      </Button>
    </li>
  );
}
