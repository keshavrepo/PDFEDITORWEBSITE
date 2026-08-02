"use client";

/**
 * JSON workspace surface.
 *
 * Format, minify, validate, browse as a tree, search by value,
 * copy, upload and download. Reuses the same session / autosave
 * loop the rest of the DevPilot surfaces share.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eraser,
  FileUp,
  ListTree,
  Minimize2,
  Search,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asJsonBody,
  copyToClipboard,
  deleteDevSession,
  downloadTextFile,
  formatJson,
  readFileAsText,
  searchJson,
  toTree,
  type JsonTreeNode,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface JsonSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

type View = "input" | "tree" | "result";

const INDENT_OPTIONS = [0, 2, 4];

export function JsonSurface({ session, onChange }: JsonSurfaceProps) {
  const body = asJsonBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [view, setView] = useState<View>("input");
  const [search, setSearch] = useState("");
  const [output, setOutput] = useState("");

  // Recompute the output whenever the input or settings change.
  const parsed = useMemo(() => {
    const result = formatJson(body.input, { indent: body.indent, sortKeys: body.sortKeys });
    if (result.ok) {
      return { ok: true as const, formatted: result.formatted, minified: result.minified, value: result.value };
    }
    return { ok: false as const, message: result.message };
  }, [body.input, body.indent, body.sortKeys]);

  // Derive the validation summary from the parsed result instead of
  // calling setState inside the memo.
  const validation: { ok: true; bytes: number; keys: number } | { ok: false; message: string } | null = parsed.ok
    ? {
        ok: true,
        bytes: body.input.length,
        keys: countKeys(parsed.value),
      }
    : { ok: false, message: parsed.message };

  const tree = useMemo(() => {
    if (!parsed.ok) return null;
    return toTree(parsed.value);
  }, [parsed]);

  const searchHits = useMemo(() => {
    if (!parsed.ok || !search.trim()) return [];
    return searchJson(parsed.value, search);
  }, [parsed, search]);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function formatNow() {
    if (!parsed.ok) {
      toast({ message: parsed.message, tone: "error" });
      return;
    }
    setOutput(parsed.formatted);
    setView("result");
    toast({ message: "Formatted", tone: "success" });
  }

  function minifyNow() {
    if (!parsed.ok) {
      toast({ message: parsed.message, tone: "error" });
      return;
    }
    setOutput(parsed.minified);
    setView("result");
    toast({ message: "Minified", tone: "success" });
  }

  function validateNow() {
    if (!parsed.ok) {
      toast({ message: parsed.message, tone: "error" });
      return;
    }
    toast({ message: "Valid JSON", tone: "success" });
  }

  async function copyResult() {
    if (!output) {
      toast({ message: "Nothing to copy yet", tone: "info" });
      return;
    }
    const ok = await copyToClipboard(output);
    toast({ message: ok ? "Copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  function downloadResult() {
    if (!output) {
      toast({ message: "Nothing to download yet", tone: "info" });
      return;
    }
    const safe = (session.meta.title || "json-output")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(output, `${safe}.json`, "application/json");
  }

  async function handleUpload(file: File) {
    const text = await readFileAsText(file);
    commit({ input: text });
    toast({ message: `Loaded ${file.name}`, tone: "success" });
  }

  function clearInput() {
    commit({ input: "" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="JSON format, minify, validate, browse and search."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyResult}
        copyDisabled={!output}
        onDownload={downloadResult}
        downloadDisabled={!output}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
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
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={clearInput}
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          </>
        }
        status={
          validation && validation.ok ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Valid · {validation.bytes} bytes · {validation.keys} top-level keys
            </span>
          ) : validation && !validation.ok ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {validation.message}
            </span>
          ) : null
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <Button
              size="sm"
              variant={view === "input" ? "default" : "ghost"}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setView("input")}
            >
              <Wand2 className="h-3 w-3" aria-hidden="true" />
              Edit
            </Button>
            <Button
              size="sm"
              variant={view === "tree" ? "default" : "ghost"}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setView("tree")}
              disabled={!parsed.ok}
            >
              <ListTree className="h-3 w-3" aria-hidden="true" />
              Tree
            </Button>
            <Button
              size="sm"
              variant={view === "result" ? "default" : "ghost"}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setView("result")}
              disabled={!output}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Result
            </Button>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
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
              <label className="ml-2 inline-flex items-center gap-1 text-[10px]">
                <input
                  type="checkbox"
                  checked={body.sortKeys}
                  onChange={(event) =>
                    commit({ sortKeys: event.target.checked })
                  }
                />
                Sort keys
              </label>
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={formatNow}
              >
                <Wand2 className="h-3 w-3" aria-hidden="true" />
                Format
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={minifyNow}
              >
                <Minimize2 className="h-3 w-3" aria-hidden="true" />
                Minify
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={validateNow}
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Validate
              </Button>
            </div>
          </div>

          {view === "input" && (
            <textarea
              value={body.input}
              onChange={(event) => commit({ input: event.target.value })}
              placeholder='Paste JSON here, e.g. {"hello":"world"}'
              spellCheck={false}
              className="min-h-[260px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            />
          )}

          {view === "tree" && tree && (
            <div className="space-y-2">
              <div className="relative">
                <Search
                  className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by key or value…"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              {search && (
                <div className="rounded-md border border-border p-2 text-[11px]">
                  <p className="mb-1 font-medium">{searchHits.length} hits</p>
                  <ul className="space-y-1 font-mono">
                    {searchHits.slice(0, 50).map((hit, index) => (
                      <li key={`${hit.path}-${index}`} className="flex gap-2">
                        <span className="text-muted-foreground">{hit.path}</span>
                        <span className="truncate">→ {hit.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-md border border-border">
                <TreeNode node={tree} depth={0} search={search} />
              </div>
            </div>
          )}

          {view === "result" && (
            <pre className="min-h-[260px] overflow-auto rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed">
              {output || "Run Format or Minify to see the result here."}
            </pre>
          )}
        </Card>
      </div>
    </div>
  );
}

function countKeys(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  return 0;
}

interface TreeNodeProps {
  node: JsonTreeNode;
  depth: number;
  search: string;
}

function TreeNode({ node, depth, search }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 3);
  const hasChildren = node.children.length > 0;
  const term = search.trim().toLowerCase();
  const matchSelf = term
    ? node.key.toLowerCase().includes(term) || node.preview.toLowerCase().includes(term)
    : false;
  return (
    <div>
      <div
        className={
          matchSelf
            ? "flex items-center gap-1 bg-primary/10 px-2 py-1 text-[11px] font-mono"
            : "flex items-center gap-1 px-2 py-1 text-[11px] font-mono"
        }
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" aria-hidden="true" />
        )}
        <span className="font-medium text-foreground">{node.key}</span>
        <span className="text-muted-foreground">{node.preview}</span>
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={`${child.path}-${index}`}
              node={child}
              depth={depth + 1}
              search={search}
            />
          ))}
        </div>
      )}
    </div>
  );
}
