"use client";

/**
 * Diff viewer surface.
 *
 * Renders a line-level diff between two text or JSON inputs. The
 * algorithm runs entirely in the browser using a Longest Common
 * Subsequence implementation in `lib/devpilot/tools/diff.ts`.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { Columns2, FileCode, Rows3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asDiffBody,
  computeJsonDiff,
  computeTextDiff,
  copyToClipboard,
  deleteDevSession,
  type DevDiffLine,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface DiffSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

export function DiffSurface({ session, onChange }: DiffSurfaceProps) {
  const body = asDiffBody(session.body);
  const { toast } = useToast();

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const summary =
    body.mode === "json"
      ? computeJsonDiff(body.left, body.right)
      : computeTextDiff(body.left, body.right);

  async function copyAll() {
    const lines = summary.lines
      .map((line) => {
        if (line.kind === "add") return `+ ${line.rightText}`;
        if (line.kind === "remove") return `- ${line.leftText}`;
        return `  ${line.leftText}`;
      })
      .join("\n");
    const ok = await copyToClipboard(lines);
    toast({ message: ok ? "Diff copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Line-level diff between two text or JSON blocks."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyAll}
        copyDisabled={summary.lines.length === 0}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <>
            <div className="inline-flex overflow-hidden rounded-lg border border-border text-[10px]">
              <button
                type="button"
                onClick={() => commit({ mode: "text" })}
                className={
                  body.mode === "text"
                    ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                    : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
                }
              >
                <FileCode className="h-3 w-3" aria-hidden="true" />
                Text
              </button>
              <button
                type="button"
                onClick={() => commit({ mode: "json" })}
                className={
                  body.mode === "json"
                    ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                    : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
                }
              >
                JSON
              </button>
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-border text-[10px]">
              <button
                type="button"
                onClick={() => commit({ layout: "side" })}
                className={
                  body.layout === "side"
                    ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                    : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
                }
              >
                <Columns2 className="h-3 w-3" aria-hidden="true" />
                Side
              </button>
              <button
                type="button"
                onClick={() => commit({ layout: "inline" })}
                className={
                  body.layout === "inline"
                    ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                    : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
                }
              >
                <Rows3 className="h-3 w-3" aria-hidden="true" />
                Inline
              </button>
            </div>
          </>
        }
        status={
          <span className="inline-flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary">
              +{summary.added}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
              −{summary.removed}
            </span>
            <span className="text-muted-foreground">unchanged {summary.unchanged}</span>
          </span>
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Left (original)</h3>
          <textarea
            value={body.left}
            onChange={(event) => commit({ left: event.target.value })}
            placeholder="Original text…"
            className="min-h-[260px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </Card>
        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Right (modified)</h3>
          <textarea
            value={body.right}
            onChange={(event) => commit({ right: event.target.value })}
            placeholder="Modified text…"
            className="min-h-[260px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </Card>

        <Card className="p-3 lg:col-span-2">
          <h3 className="mb-2 text-xs font-semibold">Diff</h3>
          {body.layout === "side" ? (
            <SideBySide lines={summary.lines} />
          ) : (
            <InlineDiff lines={summary.lines} />
          )}
        </Card>
      </div>
    </div>
  );
}

function SideBySide({ lines }: { lines: DevDiffLine[] }) {
  return (
    <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-border font-mono text-[11px]">
      <div className="border-r border-border">
        {lines.map((line, index) => (
          <DiffRow
            key={`left-${index}`}
            kind={line.kind === "add" ? "context" : line.kind}
            lineNumber={line.leftLine}
            text={line.leftText}
            side="left"
          />
        ))}
      </div>
      <div>
        {lines.map((line, index) => (
          <DiffRow
            key={`right-${index}`}
            kind={line.kind === "remove" ? "context" : line.kind}
            lineNumber={line.rightLine}
            text={line.rightText}
            side="right"
          />
        ))}
      </div>
    </div>
  );
}

function InlineDiff({ lines }: { lines: DevDiffLine[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border font-mono text-[11px]">
      {lines.map((line, index) => {
        const className =
          line.kind === "add"
            ? "flex items-start gap-2 bg-primary/10 px-2 py-0.5"
            : line.kind === "remove"
              ? "flex items-start gap-2 bg-destructive/10 px-2 py-0.5"
              : "flex items-start gap-2 px-2 py-0.5";
        const prefix = line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " ";
        return (
          <div key={`inline-${index}`} className={className}>
            <span className="w-12 shrink-0 text-right text-muted-foreground">
              {line.leftLine ?? ""}
            </span>
            <span className="w-12 shrink-0 text-right text-muted-foreground">
              {line.rightLine ?? ""}
            </span>
            <span className="w-3 shrink-0 text-muted-foreground">{prefix}</span>
            <span className="flex-1 whitespace-pre-wrap break-words">
              {line.kind === "remove" ? line.leftText : line.rightText}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface DiffRowProps {
  kind: "context" | "add" | "remove";
  lineNumber: number | null;
  text: string;
  side: "left" | "right";
}

function DiffRow({ kind, lineNumber, text, side }: DiffRowProps) {
  let className = "flex items-start gap-2 px-2 py-0.5";
  if (kind === "add" && side === "right") {
    className = "flex items-start gap-2 bg-primary/10 px-2 py-0.5";
  } else if (kind === "remove" && side === "left") {
    className = "flex items-start gap-2 bg-destructive/10 px-2 py-0.5";
  } else if (kind === "context") {
    className = "flex items-start gap-2 px-2 py-0.5";
  }
  return (
    <div className={className}>
      <span className="w-10 shrink-0 text-right text-muted-foreground">{lineNumber ?? ""}</span>
      <span className="flex-1 whitespace-pre-wrap break-words">
        {text || <span className="text-muted-foreground">(empty)</span>}
      </span>
    </div>
  );
}
