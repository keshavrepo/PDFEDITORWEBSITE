"use client";

/**
 * UUID workspace surface.
 *
 * Generate RFC 4122 v4 UUIDs in any batch size. Copy individual
 * UUIDs or the whole batch, and download the batch as a text file.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useMemo, useRef, useState } from "react";
import { Copy, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asUuidBody,
  copyToClipboard,
  deleteDevSession,
  downloadTextFile,
  generateUuidV4Batch,
  isUuidV4,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface UuidSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

export function UuidSurface({ session, onChange }: UuidSurfaceProps) {
  const body = asUuidBody(session.body);
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const summary = useMemo(() => {
    const valid = body.generated.filter(isUuidV4).length;
    return `${body.generated.length} generated · ${valid} valid v4`;
  }, [body.generated]);

  function regenerate() {
    const next = generateUuidV4Batch(body.count);
    commit({ generated: next });
    toast({ message: `Generated ${next.length} UUIDs`, tone: "success" });
  }

  async function copyAll() {
    if (body.generated.length === 0) {
      toast({ message: "Nothing to copy yet", tone: "info" });
      return;
    }
    const ok = await copyToClipboard(body.generated.join("\n"));
    toast({ message: ok ? "All UUIDs copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  function downloadAll() {
    if (body.generated.length === 0) {
      toast({ message: "Nothing to download yet", tone: "info" });
      return;
    }
    const safe = session.meta.title || "uuid-batch";
    downloadTextFile(body.generated.join("\n"), `${safe}.txt`, "text/plain");
  }

  async function copyOne(value: string) {
    const ok = await copyToClipboard(value);
    toast({ message: ok ? "UUID copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  function validateOne() {
    const trimmed = input.trim();
    if (!trimmed) {
      toast({ message: "Paste a UUID to validate", tone: "info" });
      return;
    }
    const valid = isUuidV4(trimmed);
    toast({
      message: valid ? "Valid v4 UUID" : "Not a v4 UUID",
      tone: valid ? "success" : "error",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Generate RFC 4122 v4 UUIDs in any batch size."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyAll}
        copyLabel="Copy all"
        copyDisabled={body.generated.length === 0}
        onDownload={downloadAll}
        downloadLabel="Download"
        downloadDisabled={body.generated.length === 0}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <Button
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={regenerate}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Generate
          </Button>
        }
        status={summary}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Count</span>
              <Input
                type="number"
                min={1}
                max={200}
                value={body.count}
                onChange={(event) => {
                  const next = Number(event.target.value) || 1;
                  commit({ count: Math.max(1, Math.min(200, Math.floor(next))) });
                }}
                className="h-8 text-xs"
              />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1 text-xs">
              <span className="font-medium">Validate a UUID</span>
              <div className="flex gap-1">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Paste a UUID to validate"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={validateOne}
                >
                  Check
                </Button>
              </div>
            </label>
          </div>
        </Card>

        <Card className="flex-1 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold">Generated batch</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={regenerate}
            >
              <RefreshCcw className="h-3 w-3" aria-hidden="true" />
              Re-roll
            </Button>
          </div>
          {body.generated.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Press <span className="font-medium">Generate</span> to create a
              batch. Up to 200 UUIDs at a time.
            </p>
          ) : (
            <ul className="grid gap-1 text-[11px] sm:grid-cols-2">
              {body.generated.map((uuid, index) => (
                <li
                  key={`${uuid}-${index}`}
                  className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1 font-mono"
                >
                  <span className="flex-1 truncate">{uuid}</span>
                  <button
                    type="button"
                    onClick={() => void copyOne(uuid)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Copy ${uuid}`}
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
