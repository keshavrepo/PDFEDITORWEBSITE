"use client";

/**
 * HTML editor surface.
 *
 * Wraps the shared CodeEditor with the WebPilot tool chrome and the
 * format / minify / beautify / validate / import / export actions
 * the editor needs. The surface reuses the existing
 * `lib/webpilot/tools` helpers.
 *
 * Mirrors the DevPilot `json.tsx` and `html.tsx` surface patterns so
 * a reader who knows one tool knows them all.
 */

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  Minimize2,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { CodeEditor, type CodeLanguage } from "./shared/code-editor";
import {
  asHtmlBody,
  copyToClipboard,
  deleteWebSession,
  downloadTextFile,
  formatHtml,
  minifyHtml,
  readFileAsText,
  summariseHtml,
  tokeniseHtml,
  validateHtml,
} from "@/lib/webpilot";
import type { WebSession } from "@/lib/webpilot";

interface HtmlSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function HtmlSurface({ session, onChange }: HtmlSurfaceProps) {
  const body = asHtmlBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const summary = useMemo(() => summariseHtml(body.source), [body.source]);
  const validation = useMemo(() => validateHtml(body.source), [body.source]);

  function format() {
    const result = formatHtml(body.source, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to format", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Formatted", tone: "success" });
  }

  function minify() {
    const result = minifyHtml(body.source);
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to minify", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Minified", tone: "success" });
  }

  function beautify() {
    const result = formatHtml(body.source, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to beautify", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Beautified", tone: "success" });
  }

  function validate() {
    if (validation.ok) {
      toast({ message: "Valid HTML", tone: "success" });
      return;
    }
    toast({ message: validation.error ?? "Invalid HTML", tone: "error" });
  }

  async function copy() {
    const ok = await copyToClipboard(body.source);
    toast({
      message: ok ? "Copied" : "Could not copy",
      tone: ok ? "success" : "error",
    });
  }

  function download() {
    const safe = (session.meta.title || "html-output")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(body.source, `${safe}.html`, "text/html");
  }

  async function handleUpload(file: File) {
    try {
      const text = await readFileAsText(file);
      commit({ source: text });
      toast({ message: `Loaded ${file.name}`, tone: "success" });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Failed to load file",
        tone: "error",
      });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="HTML editor with syntax highlighting, line numbers, find and replace, undo, redo, format, minify, beautify, word wrap, import and export."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copy}
        onDownload={download}
        onDelete={async () => {
          await deleteWebSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html,text/plain"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.target.value = "";
              }}
            />
            <Button
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={format}
            >
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
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={beautify}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Beautify
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={validate}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Validate
            </Button>
          </>
        }
        status={
          <span className="inline-flex items-center gap-2 text-[10px]">
            {validation.ok ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-destructive">
                <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                {validation.error}
              </span>
            )}
            <span className="text-muted-foreground">
              {summary.bytes} bytes · {summary.lines} lines · {summary.tags} tags
            </span>
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CodeEditor
            value={body.source}
            onChange={(next) => commit({ source: next })}
            language={"html" satisfies CodeLanguage}
            tokenise={tokeniseHtml}
            indent={body.indent}
            ariaLabel="HTML source editor"
            status={
              <span>
                Indent {body.indent} · {summary.bytes} bytes
              </span>
            }
          />
        </Card>
      </div>
    </div>
  );
}
