"use client";

/**
 * Base64 workspace surface.
 *
 * Encodes and decodes base64 strings, with text and file inputs.
 * The file input is read as a binary string and turned into a
 * base64 string; the decoder turns a base64 string back into a
 * downloadable binary.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useMemo, useRef, useState } from "react";
import { FileUp, FileDown, Image as ImageIcon, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asBase64Body,
  copyToClipboard,
  decodeBase64,
  deleteDevSession,
  downloadBlob,
  downloadTextFile,
  encodeBase64,
  fileToBase64,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface Base64SurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

export function Base64Surface({ session, onChange }: Base64SurfaceProps) {
  const body = asBase64Body(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decodedKind, setDecodedKind] = useState<"text" | "file" | null>(null);
  const [decodedName, setDecodedName] = useState<string>("decoded.bin");
  const [decodedMime, setDecodedMime] = useState<string>("application/octet-stream");

  const inputSize = useMemo(() => {
    if (body.mode === "text") return new Blob([body.text]).size;
    return Math.floor((body.fileBase64.length * 3) / 4);
  }, [body.mode, body.text, body.fileBase64]);

  const outputSize = output ? new Blob([output]).size : 0;

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
    // Reset the output when the user changes the mode or input so
    // the result always reflects the current input.
    setOutput(null);
    setError(null);
    setDecodedKind(null);
  }

  function encode() {
    setError(null);
    setDecodedKind(null);
    if (body.mode === "text") {
      setOutput(encodeBase64(body.text));
      return;
    }
    if (!body.fileBase64) {
      setError("Pick a file first");
      return;
    }
    setOutput(body.fileBase64);
  }

  function decode() {
    setError(null);
    if (!body.text.trim()) {
      setError("Paste a base64 string to decode");
      return;
    }
    try {
      const decoded = decodeBase64(body.text);
      setOutput(decoded);
      setDecodedKind("text");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decode");
    }
  }

  function decodeAsFile() {
    setError(null);
    if (!body.text.trim()) {
      setError("Paste a base64 string to decode");
      return;
    }
    try {
      const decoded = decodeBase64(body.text);
      setOutput(decoded);
      setDecodedKind("file");
      setDecodedName("decoded.bin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decode");
    }
  }

  function decodeAsImage() {
    setError(null);
    if (!body.text.trim()) {
      setError("Paste a base64 string to decode");
      return;
    }
    const cleaned = body.text.trim().replace(/^data:[^;]+;base64,/, "");
    setOutput(cleaned);
    setDecodedKind("file");
    setDecodedMime("image/png");
    setDecodedName("decoded.png");
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
    const safe = (body.filename || session.meta.title || "base64-output")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    if (body.mode === "text") {
      downloadTextFile(output, `${safe}.txt`, "text/plain");
      return;
    }
    downloadTextFile(output, `${safe}.b64`, "text/plain");
  }

  function downloadDecoded() {
    if (output === null) return;
    const safe = (decodedName || "decoded.txt").replace(/[^\w\-]+/g, "_");
    if (decodedKind === "text") {
      const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, safe);
      return;
    }
    const blob = new Blob([output], { type: decodedMime });
    downloadBlob(blob, safe);
  }

  async function pickFile(file: File) {
    try {
      const base64 = await fileToBase64(file);
      commit({ fileBase64: base64, filename: file.name });
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
        description="Encode and decode base64. Switch between text and file input."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyOutput}
        copyDisabled={output === null}
        onDownload={downloadOutput}
        downloadDisabled={output === null}
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
            <button
              type="button"
              onClick={() => commit({ mode: "image" })}
              className={
                body.mode === "image"
                  ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                  : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
              }
            >
              <ImageIcon className="h-3 w-3" aria-hidden="true" />
              Image
            </button>
          </div>
        }
        status={
          <span>
            Input: {inputSize} bytes · Output:{" "}
            {output !== null ? `${outputSize} bytes` : "—"}
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
                placeholder="Type or paste text to encode…"
                className="min-h-[180px] rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={encode}>
                Encode
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={decode}
              >
                Decode as text
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={decodeAsFile}
              >
                Decode as file
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={decodeAsImage}
              >
                Decode as image
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={body.mode === "image" ? "image/*" : undefined}
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
              >
                <FileUp className="mr-1.5 h-3 w-3" aria-hidden="true" />
                {body.mode === "image" ? "Choose image" : "Choose file"}
              </Button>
              {body.filename && (
                <p className="text-muted-foreground">
                  Loaded: <span className="font-medium text-foreground">{body.filename}</span>
                </p>
              )}
              {body.mode === "image" && body.fileBase64 && (
                <div className="rounded-md border border-border bg-white p-2">
                  <img
                    src={`data:image/*;base64,${body.fileBase64}`}
                    alt="Loaded image preview"
                    className="max-h-40 max-w-full"
                  />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                {body.mode === "image"
                  ? "Pick an image to encode as a base64 data URL or decode a base64 string back to an image."
                  : "The browser converts the file to base64 locally. Nothing is uploaded."}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={encode}>
                Encode
              </Button>
            </div>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/40 p-3 text-xs text-destructive">
            {error}
          </Card>
        )}

        {output !== null && (
          <Card className="p-3">
            <p className="mb-1 text-xs font-semibold">Output</p>
            {decodedMime.startsWith("image/") && body.mode === "text" ? (
              <div className="rounded-md border border-border bg-white p-2">
                <img
                  src={`data:${decodedMime};base64,${output}`}
                  alt="Decoded image preview"
                  className="max-h-[260px] max-w-full"
                />
              </div>
            ) : body.mode === "image" ? (
              <div className="rounded-md border border-border bg-white p-2">
                <img
                  src={`data:image/*;base64,${output}`}
                  alt="Encoded image preview"
                  className="max-h-[260px] max-w-full"
                />
              </div>
            ) : (
              <pre className="max-h-[260px] overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
                {output}
              </pre>
            )}
            {body.mode === "text" && decodedKind && !decodedMime.startsWith("image/") && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={decodedName}
                  onChange={(event) => setDecodedName(event.target.value)}
                  placeholder="filename for download"
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={downloadDecoded}
                >
                  <FileDown className="h-3 w-3" aria-hidden="true" />
                  Download
                </Button>
              </div>
            )}
            {body.mode === "text" && decodedMime.startsWith("image/") && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={decodedName}
                  onChange={(event) => setDecodedName(event.target.value)}
                  placeholder="filename for download"
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={downloadDecoded}
                >
                  <FileDown className="h-3 w-3" aria-hidden="true" />
                  Download
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
