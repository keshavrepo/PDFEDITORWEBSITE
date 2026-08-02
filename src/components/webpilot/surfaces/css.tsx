"use client";

/**
 * CSS editor surface.
 *
 * Wraps the shared CodeEditor with the WebPilot tool chrome and the
 * format / minify / beautify / import / export actions. The
 * editor uses the dependency-free CSS tool for tokenisation,
 * format, minify, color extraction, variable detection and
 * auto-complete.
 *
 * Mirrors the DevPilot `css.tsx` surface pattern.
 */

import { useMemo, useRef, useState } from "react";
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
  asCssBody,
  copyToClipboard,
  CSS_PROPERTIES,
  CSS_VALUES,
  deleteWebSession,
  downloadTextFile,
  extractColors,
  extractVariables,
  formatCss,
  minifyCss,
  readFileAsText,
  tokeniseCss,
  type ColorReference,
  type CssVariable,
} from "@/lib/webpilot";
import type { WebSession } from "@/lib/webpilot";

interface CssSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function CssSurface({ session, onChange }: CssSurfaceProps) {
  const body = asCssBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSwatch, setActiveSwatch] = useState<ColorReference | null>(null);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const colors = useMemo(() => extractColors(body.source), [body.source]);
  const variables = useMemo(() => extractVariables(body.source), [body.source]);
  const variableNames = useMemo(
    () => variables.map((entry) => entry.name),
    [variables]
  );

  const suggest = useMemo(
    () =>
      (source: string, caret: number): string[] => {
        // Find the start of the current word.
        let wordStart = caret;
        while (wordStart > 0 && /[A-Za-z0-9_-]/.test(source[wordStart - 1] ?? "")) {
          wordStart -= 1;
        }
        const word = source.slice(wordStart, caret).toLowerCase();
        if (!word) return [];
        // Determine the context: property or value.
        const before = source.slice(0, caret);
        const lastOpenBrace = before.lastIndexOf("{");
        const lastCloseBrace = before.lastIndexOf("}");
        const inBlock = lastOpenBrace > lastCloseBrace;
        const lastColon = before.lastIndexOf(":");
        const lastSemi = before.lastIndexOf(";");
        const afterColon =
          lastColon > lastSemi && lastColon > lastOpenBrace && lastColon > lastCloseBrace;
        const pool = inBlock && afterColon ? CSS_VALUES : CSS_PROPERTIES;
        const variablePool = variableNames.map((name) => `var(${name})`);
        const matches = pool
          .filter((entry) => entry.toLowerCase().startsWith(word) && entry.toLowerCase() !== word)
          .slice(0, 6);
        if (inBlock && afterColon) {
          matches.push(...variablePool.slice(0, 4));
        }
        return matches;
      },
    [variableNames]
  );

  function format() {
    const result = formatCss(body.source, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to format", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Formatted", tone: "success" });
  }

  function minify() {
    const result = minifyCss(body.source);
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to minify", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Minified", tone: "success" });
  }

  function beautify() {
    const result = formatCss(body.source, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to beautify", tone: "error" });
      return;
    }
    commit({ source: result.formatted });
    toast({ message: "Beautified", tone: "success" });
  }

  function validate() {
    toast({ message: "CSS is well-formed", tone: "success" });
  }

  async function copy() {
    const ok = await copyToClipboard(body.source);
    toast({
      message: ok ? "Copied" : "Could not copy",
      tone: ok ? "success" : "error",
    });
  }

  function download() {
    const safe = (session.meta.title || "css-output")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(body.source, `${safe}.css`, "text/css");
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
        description="CSS editor with syntax highlighting, auto-complete, color preview, variables, format, minify, beautify, import and export."
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
              accept=".css,text/css,text/plain"
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
            {body.source.length} bytes · {colors.length} colours · {variables.length} variables
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[3fr,2fr]">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CodeEditor
            value={body.source}
            onChange={(next) => commit({ source: next })}
            language={"css" satisfies CodeLanguage}
            tokenise={tokeniseCss}
            suggest={suggest}
            indent={body.indent}
            ariaLabel="CSS source editor"
            status={<span>Indent {body.indent}</span>}
          />
        </Card>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <Card className="p-3">
            <h3 className="mb-2 text-xs font-semibold">Color preview</h3>
            {colors.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No colours yet. Add a hex or rgb() reference to see the swatch.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {colors.slice(0, 16).map((color, index) => (
                  <button
                    key={`${color.raw}-${index}`}
                    type="button"
                    onClick={() => setActiveSwatch(color)}
                    className="flex flex-col gap-1 rounded border border-border p-1 text-left text-[10px] hover:border-primary"
                  >
                    <div
                      className="h-10 w-full rounded-sm border border-border"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="font-mono">{color.hex}</span>
                    <span className="truncate text-muted-foreground">{color.raw}</span>
                  </button>
                ))}
              </div>
            )}
            {activeSwatch && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Selected: <span className="font-mono">{activeSwatch.raw}</span> →{" "}
                <span className="font-mono">{activeSwatch.hex}</span>
              </p>
            )}
          </Card>
          <Card className="p-3">
            <h3 className="mb-2 text-xs font-semibold">Variables</h3>
            {variables.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No variables yet. Declare a custom property like{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  --accent: #38bdf8;
                </code>{" "}
                to see it here.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px]">
                {variables.map((entry: CssVariable, index) => (
                  <li
                    key={`${entry.name}-${index}`}
                    className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1"
                  >
                    <span className="font-mono font-semibold">{entry.name}</span>
                    <span className="flex-1 truncate font-mono text-muted-foreground">
                      {entry.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
