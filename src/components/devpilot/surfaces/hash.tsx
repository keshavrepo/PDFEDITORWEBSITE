"use client";

/**
 * Hash workspace surface.
 *
 * Compute MD5, SHA-1, SHA-256 and SHA-512 for any text or file.
 * The result is a four-row table the user can copy individually or
 * download as a JSON report.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useRef, useState } from "react";
import { FileUp, Type } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asHashBody,
  copyToClipboard,
  deleteDevSession,
  downloadTextFile,
  hashFile,
  hashLabel,
  hashText,
  listHashAlgorithms,
  readFileAsDataUrl,
  type HashAlgorithm,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface HashSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

interface DigestRow {
  algorithm: HashAlgorithm;
  digest: string;
}

interface DigestResult {
  digests: Record<HashAlgorithm, string>;
  sourceSize: number;
}

const EMPTY_RESULTS: Record<HashAlgorithm, string> = {
  md5: "",
  sha1: "",
  sha256: "",
  sha512: "",
};

export function HashSurface({ session, onChange }: HashSurfaceProps) {
  const body = asHashBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState<DigestResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
    // Reset the digest table whenever the user changes the input or
    // mode so stale results never hang around.
    setResult(null);
    setError(null);
  }

  async function computeText() {
    if (!body.text) {
      setError("Type some text first");
      return;
    }
    setComputing(true);
    setError(null);
    try {
      const bytes = new TextEncoder().encode(body.text).length;
      const next: Record<HashAlgorithm, string> = { ...EMPTY_RESULTS };
      for (const algorithm of listHashAlgorithms()) {
        next[algorithm] = await hashText(body.text, algorithm);
      }
      setResult({ digests: next, sourceSize: bytes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hash failed");
    } finally {
      setComputing(false);
    }
  }

  async function pickFile(file: File) {
    setComputing(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      commit({ fileDataUrl: dataUrl, filename: file.name });
      const next: Record<HashAlgorithm, string> = { ...EMPTY_RESULTS };
      for (const algorithm of listHashAlgorithms()) {
        next[algorithm] = await hashFile(file, algorithm);
      }
      setResult({ digests: next, sourceSize: file.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hash failed");
    } finally {
      setComputing(false);
    }
  }

  async function copyDigest(algorithm: HashAlgorithm) {
    const value = result?.digests[algorithm];
    if (!value) {
      toast({ message: "Nothing to copy yet", tone: "info" });
      return;
    }
    const ok = await copyToClipboard(value);
    toast({ message: ok ? `${hashLabel(algorithm)} copied` : "Could not copy", tone: ok ? "success" : "error" });
  }

  function downloadReport() {
    if (!result || !Object.values(result.digests).some(Boolean)) {
      toast({ message: "Nothing to download yet", tone: "info" });
      return;
    }
    const rows: DigestRow[] = listHashAlgorithms().map((algorithm) => ({
      algorithm,
      digest: result.digests[algorithm],
    }));
    const report = JSON.stringify(
      {
        filename: body.mode === "file" ? body.filename : null,
        sourceBytes: result.sourceSize,
        computedAt: new Date().toISOString(),
        digests: rows,
      },
      null,
      2
    );
    const safe = (session.meta.title || body.filename || "hash-report")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(report, `${safe}.json`, "application/json");
  }

  const rows = listHashAlgorithms();
  const digests = result?.digests ?? EMPTY_RESULTS;
  const sourceSize = result?.sourceSize ?? 0;
  const hasResult = result !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="MD5, SHA-1, SHA-256 and SHA-512 for text and files."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={async () => {
          if (!hasResult) {
            toast({ message: "Nothing to copy yet", tone: "info" });
            return;
          }
          const report = listHashAlgorithms()
            .map((algorithm) => `${hashLabel(algorithm)}: ${digests[algorithm]}`)
            .join("\n");
          const ok = await copyToClipboard(report);
          toast({ message: ok ? "Report copied" : "Could not copy", tone: ok ? "success" : "error" });
        }}
        copyLabel="Copy report"
        onDownload={downloadReport}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
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
              <Type className="h-3 w-3" aria-hidden="true" />
              Text
            </button>
            <button
              type="button"
              onClick={() => commit({ mode: "file" })}
              className={
                body.mode === "file"
                  ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                  : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
              }
            >
              <FileUp className="h-3 w-3" aria-hidden="true" />
              File
            </button>
          </div>
        }
        status={
          <span>
            Source: {sourceSize > 0 ? `${sourceSize} bytes` : "—"}
            {computing ? " · computing…" : ""}
          </span>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {body.mode === "text" ? (
          <Card className="p-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Text input</span>
              <textarea
                value={body.text}
                onChange={(event) => commit({ text: event.target.value })}
                placeholder="Type or paste text to hash…"
                className="min-h-[160px] rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            </label>
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => void computeText()}
                disabled={computing}
              >
                Compute
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-3">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pickFile(file);
                event.target.value = "";
              }}
            />
            <div className="flex flex-col items-start gap-2 text-xs">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={computing}
              >
                <FileUp className="mr-1.5 h-3 w-3" aria-hidden="true" />
                Choose file
              </Button>
              {body.filename && (
                <p className="text-muted-foreground">
                  Loaded: <span className="font-medium text-foreground">{body.filename}</span>
                </p>
              )}
            </div>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/40 p-3 text-xs text-destructive">
            {error}
          </Card>
        )}

        <Card className="p-3">
          <p className="mb-2 text-xs font-semibold">Digests</p>
          <ul className="space-y-2">
            {rows.map((algorithm) => (
              <li
                key={algorithm}
                className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-[11px]"
              >
                <span className="w-16 shrink-0 text-muted-foreground">
                  {hashLabel(algorithm)}
                </span>
                <code className="flex-1 truncate font-mono">
                  {digests[algorithm] || "—"}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => void copyDigest(algorithm)}
                  disabled={!digests[algorithm]}
                >
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
