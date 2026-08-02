"use client";

/**
 * HTML workspace surface.
 *
 * Format, beautify and minify an HTML document. The formatter is
 * a small dependency-free implementation in
 * `lib/devpilot/tools/format.ts`.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useState } from "react";
import { Minimize2, Wand2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asHtmlBody,
  copyToClipboard,
  deleteDevSession,
  downloadTextFile,
  formatHtml,
  minifyHtml,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface HtmlSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const INDENT_OPTIONS = [2, 4];

export function HtmlSurface({ session, onChange }: HtmlSurfaceProps) {
  const body = asHtmlBody(session.body);
  const { toast } = useToast();
  const [output, setOutput] = useState("");

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function format() {
    const result = formatHtml(body.input, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to format", tone: "error" });
      return;
    }
    setOutput(result.formatted);
    toast({ message: "Formatted", tone: "success" });
  }

  function minify() {
    const result = minifyHtml(body.input);
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to minify", tone: "error" });
      return;
    }
    setOutput(result.formatted);
    toast({ message: "Minified", tone: "success" });
  }

  async function copyOutput() {
    if (!output) {
      toast({ message: "Nothing to copy yet", tone: "info" });
      return;
    }
    const ok = await copyToClipboard(output);
    toast({ message: ok ? "Copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  function downloadOutput() {
    if (!output) {
      toast({ message: "Nothing to download yet", tone: "info" });
      return;
    }
    const safe = (session.meta.title || "html-output")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(output, `${safe}.html`, "text/html");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Format, beautify and minify HTML."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyOutput}
        copyDisabled={!output}
        onDownload={downloadOutput}
        downloadDisabled={!output}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <>
            <Button size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={format}>
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Format
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={minify}
            >
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              Minify
            </Button>
          </>
        }
        status={
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Type className="h-3 w-3" aria-hidden="true" />
            Indent
            {INDENT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => commit({ indent: option })}
                className={
                  body.indent === option
                    ? "rounded bg-accent px-1.5 py-0.5 font-medium"
                    : "rounded px-1.5 py-0.5 hover:bg-accent"
                }
              >
                {option}
              </button>
            ))}
          </span>
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Input</h3>
          <textarea
            value={body.input}
            onChange={(event) => commit({ input: event.target.value })}
            placeholder="<!doctype html><html><head><title>Hi</title></head><body><p>Hello</p></body></html>"
            className="min-h-[260px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </Card>
        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Result</h3>
          <pre className="min-h-[260px] overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
            {output || "Run Format or Minify to see the result here."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
