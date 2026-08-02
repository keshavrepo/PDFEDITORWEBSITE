"use client";

/**
 * URL workspace surface.
 *
 * Encode, decode and parse URLs. Switch the direction to encode
 * or decode, paste a URL, and the tool shows the converted form
 * and a parsed breakdown with the query parameters.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useMemo, useState } from "react";
import { ArrowLeftRight, Link2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asUrlBody,
  copyToClipboard,
  decodeUrl,
  decodeUrlComponent,
  deleteDevSession,
  encodeUrl,
  encodeUrlComponent,
  parseUrl,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface UrlSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

export function UrlSurface({ session, onChange }: UrlSurfaceProps) {
  const body = asUrlBody(session.body);
  const { toast } = useToast();
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseUrl(body.input), [body.input]);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function convert() {
    setError(null);
    try {
      if (body.direction === "encode") {
        setOutput(encodeUrl(body.input));
      } else {
        setOutput(decodeUrl(body.input));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert");
    }
  }

  function convertComponent() {
    setError(null);
    try {
      if (body.direction === "encode") {
        setOutput(encodeUrlComponent(body.input));
      } else {
        setOutput(decodeUrlComponent(body.input));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert");
    }
  }

  async function copyOutput() {
    if (!output) {
      toast({ message: "Nothing to copy yet", tone: "info" });
      return;
    }
    const ok = await copyToClipboard(output);
    toast({ message: ok ? "Copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Encode, decode and parse URLs. Inspect the query parameters."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyOutput}
        copyDisabled={!output}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <div className="inline-flex overflow-hidden rounded-lg border border-border text-[10px]">
            <button
              type="button"
              onClick={() => commit({ direction: "encode" })}
              className={
                body.direction === "encode"
                  ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                  : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
              }
            >
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
              Encode
            </button>
            <button
              type="button"
              onClick={() => commit({ direction: "decode" })}
              className={
                body.direction === "decode"
                  ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                  : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
              }
            >
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
              Decode
            </button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">URL input</span>
            <textarea
              value={body.input}
              onChange={(event) => commit({ input: event.target.value })}
              placeholder="https://example.com/path?key=value"
              className="min-h-[120px] rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={convert}
            >
              {body.direction === "encode" ? "Encode URL" : "Decode URL"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={convertComponent}
            >
              {body.direction === "encode" ? "Encode component" : "Decode component"}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="border-destructive/40 p-3 text-xs text-destructive">
            <TriangleAlert className="mr-1 inline h-3 w-3" aria-hidden="true" />
            {error}
          </Card>
        )}

        {output && (
          <Card className="p-3">
            <p className="mb-1 text-xs font-semibold">Output</p>
            <pre className="max-h-[200px] overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
              {output}
            </pre>
          </Card>
        )}

        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Parsed URL
          </div>
          {parsed.ok ? (
            <dl className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
              <Row label="Protocol" value={parsed.protocol} />
              <Row label="Origin" value={parsed.origin} />
              <Row label="Host" value={parsed.host} />
              <Row label="Hostname" value={parsed.hostname} />
              <Row label="Port" value={parsed.port} />
              <Row label="Path" value={parsed.pathname} />
              <Row label="Hash" value={parsed.hash} />
              <Row label="Username" value={parsed.username} />
              <Row label="Password" value={parsed.password ? "••••" : ""} />
            </dl>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {parsed.error ??
                "Type a URL above to see the parsed components and query parameters."}
            </p>
          )}
        </Card>

        {parsed.ok && (
          <Card className="p-3">
            <p className="mb-2 text-xs font-semibold">Query parameters</p>
            {parsed.query.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No query parameters.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px]">
                {parsed.query.map((entry, index) => (
                  <li
                    key={`${entry.key}-${index}`}
                    className="grid grid-cols-[1fr,2fr] gap-2 rounded border border-border bg-background px-2 py-1 font-mono"
                  >
                    <span className="truncate font-semibold">{entry.key}</span>
                    <span className="truncate text-muted-foreground">{entry.value}</span>
                  </li>
                ))}
              </ul>
            )}
            {parsed.query.length > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                {parsed.query.length} parameter{parsed.query.length === 1 ? "" : "s"}
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-foreground" title={value}>
        {value || "—"}
      </dd>
    </div>
  );
}
