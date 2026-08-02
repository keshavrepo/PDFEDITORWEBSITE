"use client";

/**
 * XML workspace surface.
 *
 * Beautify, minify and validate an XML document. Mirrors the
 * HTML / CSS / JS formatter pattern from Batch 3.
 */

import { useState } from "react";
import { Minimize2, Wand2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asXmlBody,
  copyToClipboard,
  deleteDevSession,
  downloadTextFile,
  formatXml,
  minifyXml,
  validateXml,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface XmlSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const INDENT_OPTIONS = [2, 4];

export function XmlSurface({ session, onChange }: XmlSurfaceProps) {
  const body = asXmlBody(session.body);
  const { toast } = useToast();
  const [output, setOutput] = useState("");

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function format() {
    const result = formatXml(body.input, { indent: body.indent });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to format", tone: "error" });
      return;
    }
    setOutput(result.formatted);
    toast({ message: "Beautified", tone: "success" });
  }

  function minify() {
    const result = minifyXml(body.input);
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to minify", tone: "error" });
      return;
    }
    setOutput(result.formatted);
    toast({ message: "Minified", tone: "success" });
  }

  function validate() {
    const result = validateXml(body.input);
    if (!result.ok) {
      toast({ message: result.error ?? "Invalid XML", tone: "error" });
      return;
    }
    toast({ message: "Valid XML", tone: "success" });
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
    const safe = (session.meta.title || "xml-output")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(output, `${safe}.xml`, "application/xml");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Beautify, minify and validate an XML document."
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
              Beautify
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
              onClick={validate}
            >
              Validate
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
            placeholder='<root><item id="1">Hello</item></root>'
            className="min-h-[260px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </Card>
        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Result</h3>
          <pre className="min-h-[260px] overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
            {output || "Run Beautify or Minify to see the result here."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
