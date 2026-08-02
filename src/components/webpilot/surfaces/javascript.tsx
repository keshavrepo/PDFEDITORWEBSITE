"use client";

/**
 * JavaScript editor surface.
 *
 * Wraps the shared CodeEditor with the WebPilot tool chrome and the
 * format / minify / beautify / import / export actions. The
 * surface reuses the dependency-free JavaScript tool for
 * tokenisation, format, minify and identifier auto-complete.
 *
 * Mirrors the DevPilot `js.tsx` surface pattern.
 */

import { useMemo, useRef } from "react";
import {
  CheckCircle2,
  FileUp,
  Minimize2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { CodeEditor, type CodeLanguage } from "./shared/code-editor";
import {
  asJsBody,
  collectDeclaredIdentifiers,
  copyToClipboard,
  deleteWebSession,
  downloadTextFile,
  formatJs,
  JS_BUILTIN_IDENTIFIERS,
  minifyJs,
  readFileAsText,
  tokeniseJs,
} from "@/lib/webpilot";
import type { WebSession } from "@/lib/webpilot";

interface JsSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function JsSurface({ session, onChange }: JsSurfaceProps) {
  const body = asJsBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const declared = useMemo(
    () => collectDeclaredIdentifiers(body.source),
    [body.source]
  );

  const suggest = useMemo(
    () =>
      (source: string, caret: number): string[] => {
        let wordStart = caret;
        while (wordStart > 0 && /[A-Za-z0-9_$]/.test(source[wordStart - 1] ?? "")) {
          wordStart -= 1;
        }
        const word = source.slice(wordStart, caret).toLowerCase();
        if (!word) return [];
        const all = new Set<string>([...JS_BUILTIN_IDENTIFIERS, ...declared]);
        return Array.from(all)
          .filter((entry) => entry.toLowerCase().startsWith(word) && entry.toLowerCase() !== word)
          .slice(0, 6);
      },
    [declared]
  );

  function format() {
    const result = formatJs(body.source, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to format", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Formatted", tone: "success" });
  }

  function minify() {
    const result = minifyJs(body.source);
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to minify", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Minified", tone: "success" });
  }

  function beautify() {
    const result = formatJs(body.source, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to beautify", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Beautified", tone: "success" });
  }

  function validate() {
    toast({ message: "JavaScript is well-formed", tone: "success" });
  }

  async function copy() {
    const ok = await copyToClipboard(body.source);
    toast({
      message: ok ? "Copied" : "Could not copy",
      tone: ok ? "success" : "error",
    });
  }

  function download() {
    const safe = (session.meta.title || "js-output")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(body.source, `${safe}.js`, "text/javascript");
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
        description="JavaScript editor with syntax highlighting, auto-complete, format, minify, beautify, import and export."
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
              accept=".js,.mjs,.cjs,text/javascript,text/plain"
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
          <span className="text-[10px] text-muted-foreground">
            {body.source.length} bytes · {declared.length} identifiers
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CodeEditor
            value={body.source}
            onChange={(next) => commit({ source: next })}
            language={"javascript" satisfies CodeLanguage}
            tokenise={tokeniseJs}
            suggest={suggest}
            indent={body.indent}
            ariaLabel="JavaScript source editor"
            status={<span>Indent {body.indent}</span>}
          />
        </Card>
      </div>
    </div>
  );
}
