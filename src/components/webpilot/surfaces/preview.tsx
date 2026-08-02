"use client";

/**
 * Live Preview surface.
 *
 * Combines three editors (HTML, CSS, JavaScript) into a working
 * browser surface inside a sandboxed iframe. The preview runs
 * entirely client-side; the iframe's `srcdoc` is built from the
 * three bodies so the user code never runs in the parent window.
 *
 * Every console message the iframe emits is captured through a
 * `postMessage` relay and shown in the output panel below the
 * preview, with log / warn / error levels and a manual refresh
 * button.
 *
 * Mirrors the DevPilot API surface's request / response model: the
 * editor builds the source, the engine runs it, and the result is
 * displayed in a dedicated panel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  Pause,
  Play,
  RefreshCw,
  Terminal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { CodeEditor, type CodeLanguage } from "./shared/code-editor";
import {
  asPreviewBody,
  buildPreviewDocument,
  copyToClipboard,
  deleteWebSession,
  downloadTextFile,
  readFileAsText,
  tokeniseHtml,
  tokeniseCss,
  tokeniseJs,
} from "@/lib/webpilot";
import type { WebSession } from "@/lib/webpilot";

interface PreviewSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

interface ConsoleLine {
  level: "log" | "warn" | "error" | "info";
  parts: string[];
  time: number;
}

interface PreviewMessage {
  type: "console";
  level: ConsoleLine["level"];
  parts: string[];
}

export function PreviewSurface({ session, onChange }: PreviewSurfaceProps) {
  const body = asPreviewBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const lastUpdateRef = useRef<{ html: string; css: string; js: string }>({
    html: body.html,
    css: body.css,
    js: body.js,
  });
  const [revision, setRevision] = useState(0);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const documentSource = useMemo(
    () => buildPreviewDocument(body.html, body.css, body.js),
    [body.html, body.css, body.js]
  );

  // Auto-refresh: keep a small debounce so we don't rebuild the
  // iframe on every keystroke.
  useEffect(() => {
    if (!body.autoRefresh) return;
    const last = lastUpdateRef.current;
    if (
      last.html === body.html &&
      last.css === body.css &&
      last.js === body.js
    ) {
      return;
    }
    const handle = window.setTimeout(() => {
      lastUpdateRef.current = { html: body.html, css: body.css, js: body.js };
      setRevision((value) => value + 1);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [body.autoRefresh, body.css, body.html, body.js]);

  // Capture console messages from the sandboxed iframe.
  useEffect(() => {
    function onMessage(event: MessageEvent<PreviewMessage | unknown>) {
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as PreviewMessage;
      if (data.type !== "console") return;
      if (!["log", "warn", "error", "info"].includes(data.level)) return;
      setConsoleLines((current) => [
        ...current,
        {
          level: data.level,
          parts: Array.isArray(data.parts) ? data.parts.map(String) : [String(data.parts)],
          time: Date.now(),
        },
      ].slice(-200));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const refreshNow = useCallback(() => {
    lastUpdateRef.current = { html: body.html, css: body.css, js: body.js };
    setRevision((value) => value + 1);
  }, [body.html, body.css, body.js]);

  function toggleAutoRefresh() {
    commit({ autoRefresh: !body.autoRefresh });
  }

  function clearConsole() {
    setConsoleLines([]);
  }

  async function copyPage() {
    const ok = await copyToClipboard(documentSource);
    toast({
      message: ok ? "Copied" : "Could not copy",
      tone: ok ? "success" : "error",
    });
  }

  function downloadPage() {
    const safe = (session.meta.title || "preview")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    downloadTextFile(documentSource, `${safe}.html`, "text/html");
  }

  async function handleUpload(file: File) {
    try {
      const text = await readFileAsText(file);
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".css")) {
        commit({ css: text });
      } else if (lower.endsWith(".js") || lower.endsWith(".mjs")) {
        commit({ js: text });
      } else {
        commit({ html: text });
      }
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
        description="Live Preview combining HTML, CSS and JavaScript into a sandboxed browser surface."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyPage}
        copyLabel="Copy HTML"
        onDownload={downloadPage}
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
              accept=".html,.css,.js,.htm,text/html,text/css,text/javascript,text/plain"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant={body.autoRefresh ? "default" : "ghost"}
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={toggleAutoRefresh}
              aria-pressed={body.autoRefresh}
            >
              {body.autoRefresh ? (
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Auto-refresh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={refreshNow}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
        status={
          previewError ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {previewError}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-primary">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Sandboxed iframe ready
            </span>
          )
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-2">
        <div className="grid min-h-0 grid-rows-3 gap-2">
          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
            <p className="border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              HTML
            </p>
            <CodeEditor
              value={body.html}
              onChange={(next) => commit({ html: next })}
              language={"html" satisfies CodeLanguage}
              tokenise={tokeniseHtml}
              indent={2}
              ariaLabel="HTML source"
              status={<span>{body.html.length} bytes</span>}
            />
          </Card>
          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
            <p className="border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              CSS
            </p>
            <CodeEditor
              value={body.css}
              onChange={(next) => commit({ css: next })}
              language={"css" satisfies CodeLanguage}
              tokenise={tokeniseCss}
              indent={2}
              ariaLabel="CSS source"
              status={<span>{body.css.length} bytes</span>}
            />
          </Card>
          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
            <p className="border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              JavaScript
            </p>
            <CodeEditor
              value={body.js}
              onChange={(next) => commit({ js: next })}
              language={"javascript" satisfies CodeLanguage}
              tokenise={tokeniseJs}
              indent={2}
              ariaLabel="JavaScript source"
              status={<span>{body.js.length} bytes</span>}
            />
          </Card>
        </div>
        <div className="grid min-h-0 grid-rows-[3fr,2fr] gap-3">
          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <p className="text-[10px] text-muted-foreground">
                Sandboxed · iframe srcdoc · revision {revision}
              </p>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                ref={iframeRef}
                key={revision}
                title="Live preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                srcDoc={buildPreviewDocumentString(body.html, body.css, body.js)}
                onLoad={() => setPreviewError(null)}
                onError={() => setPreviewError("Preview failed to load")}
                className="h-full w-full border-0"
              />
            </div>
          </Card>
          <Card className="flex min-h-0 flex-col p-0">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1">
              <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Terminal className="h-3 w-3" aria-hidden="true" />
                Console
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={clearConsole}
                disabled={consoleLines.length === 0}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Clear
              </Button>
            </div>
            <div className="flex-1 overflow-auto bg-background p-2 font-mono text-[11px]">
              {consoleLines.length === 0 ? (
                <p className="text-muted-foreground">
                  No console output yet. Run code in the preview to capture log, warn, error and info messages.
                </p>
              ) : (
                <ul className="space-y-1">
                  {consoleLines.map((line, index) => (
                    <li
                      key={`${line.time}-${index}`}
                      className={
                        line.level === "error"
                          ? "text-destructive"
                          : line.level === "warn"
                            ? "text-yellow-600 dark:text-yellow-400"
                            : line.level === "info"
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-foreground"
                      }
                    >
                      <span className="mr-1 text-[10px] text-muted-foreground">[{line.level}]</span>
                      {line.parts.join(" ")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-border bg-muted/30 p-2 text-[10px]">
              <label className="mb-1 block font-semibold uppercase tracking-wider text-muted-foreground">
                Quick evaluate
              </label>
              <form
                className="flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const input = form.elements.namedItem("expr") as HTMLInputElement | null;
                  const value = input?.value.trim() ?? "";
                  if (!value) return;
                  sendQuickEval(iframeRef.current?.contentWindow ?? null, value);
                  if (input) input.value = "";
                }}
              >
                <Input
                  name="expr"
                  placeholder='document.title'
                  className="h-7 flex-1 font-mono text-[11px]"
                />
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" type="submit">
                  Run
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Build the iframe srcdoc string and inject a small relay that
 * forwards console.log / console.warn / console.error to the parent
 * window via `postMessage`. Keeping the relay inside the srcdoc
 * means the user code never has to know about the parent.
 */
function buildPreviewDocumentString(html: string, css: string, js: string): string {
  const document = buildPreviewDocument(html, css, js);
  const relay = `
    <script>
      (function () {
        var levels = ['log', 'warn', 'error', 'info'];
        for (var i = 0; i < levels.length; i++) {
          (function (level) {
            var original = console[level] ? console[level].bind(console) : function () {};
            console[level] = function () {
              try {
                var parts = [];
                for (var j = 0; j < arguments.length; j++) {
                  var arg = arguments[j];
                  if (arg instanceof Error) parts.push(arg.stack || arg.message);
                  else if (typeof arg === 'string') parts.push(arg);
                  else {
                    try { parts.push(JSON.stringify(arg)); }
                    catch (_) { parts.push(String(arg)); }
                  }
                }
                parent.postMessage({ type: 'console', level: level, parts: parts }, '*');
              } catch (_) {}
              original.apply(null, arguments);
            };
          })(levels[i]);
        }
        window.addEventListener('error', function (event) {
          try {
            parent.postMessage({
              type: 'console',
              level: 'error',
              parts: [(event.error && event.error.stack) || event.message || 'Uncaught error']
            }, '*');
          } catch (_) {}
        });
        window.addEventListener('unhandledrejection', function (event) {
          try {
            var reason = event.reason;
            var text = reason && reason.stack ? reason.stack : String(reason);
            parent.postMessage({ type: 'console', level: 'error', parts: [text] }, '*');
          } catch (_) {}
        });
      })();
    <\/script>
  `;
  // Insert the relay right before </head> if present, otherwise at the start.
  if (document.includes("</head>")) {
    return document.replace(/<\/head>/i, `${relay}</head>`);
  }
  return relay + document;
}

/** Quick-eval helper: ask the iframe to evaluate an expression and
 * capture the result. */
function sendQuickEval(target: Window | null, expression: string) {
  if (!target) return;
  try {
    // The iframe's window supports `eval`, but the standard lib type
    // for `Window` does not. Cast to a permissive type so the
    // surface can drive the iframe.
    const evalTarget = target as unknown as { eval: (code: string) => unknown };
    const value = evalTarget.eval(
      `(function () { try { return (${expression}); } catch (err) { return { __error: err && err.message ? err.message : String(err) }; } })()`
    );
    target.postMessage(
      {
        type: "console",
        level: "info",
        parts: [`${expression} → ${formatValue(value)}`],
      },
      "*"
    );
  } catch (err) {
    target.postMessage(
      {
        type: "console",
        level: "error",
        parts: [err instanceof Error ? err.message : String(err)],
      },
      "*"
    );
  }
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
