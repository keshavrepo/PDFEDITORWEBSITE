"use client";

/**
 * Integrated Terminal surface.
 *
 * A professional terminal that runs inside the WebPilot
 * workspace. The user can spawn multiple panes, scroll through
 * their history, clear the buffer, copy the output, drop into
 * fullscreen, and reach every command from the keyboard. The
 * terminal is fully client-side: every command is implemented
 * against the project tree and the asset list, so the surface
 * is responsive even when the user is offline.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome` and the in-app toast so it feels identical to
 * every other WebPilot tool.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  ClipboardCopy,
  Maximize2,
  Minimize2,
  Plus,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { asWebAssets } from "./shared/webpilot-store";
import {
  asTerminalBody,
  newPane,
  pushCommand,
  runCommand,
  type TerminalContext,
} from "@/lib/webpilot";
import type {
  WebSession,
  WebTerminalBody,
  WebTerminalLine,
  WebTerminalPane,
} from "@/lib/webpilot";

interface TerminalSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function TerminalSurface({ session, onChange }: TerminalSurfaceProps) {
  const body = asTerminalBody(session.body);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const assetsState = asWebAssets(session);
  const active = activePane(body);
  const ctx: TerminalContext = useMemo(
    () => ({
      cwd: active.cwd,
      folders: assetsState.project.folders,
      files: assetsState.project.files,
      assets: assetsState.assets,
    }),
    [assetsState, active.cwd]
  );

  function commit(patch: Partial<WebTerminalBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  // Auto-scroll to the bottom on every change.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [active.lines.length]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "t" && !event.shiftKey) {
        event.preventDefault();
        const pane = newPane(`Terminal ${body.panes.length + 1}`);
        commit({ panes: [...body.panes, pane], activePaneId: pane.id });
        return;
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        clearActive();
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        commit({ fullscreen: !body.fullscreen });
        return;
      }
      if (mod && event.altKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        closeActive();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  function appendToActive(lines: WebTerminalLine[], cwd: string) {
    const next = body.panes.map((pane) =>
      pane.id === body.activePaneId
        ? { ...pane, lines: [...pane.lines, ...lines], cwd }
        : pane
    );
    commit({ panes: next });
  }

  function clearActive() {
    const next = body.panes.map((pane) =>
      pane.id === body.activePaneId
        ? {
            ...pane,
            lines: [
              {
                id: `line-${Date.now()}`,
                kind: "info" as const,
                text: "Terminal cleared",
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : pane
    );
    commit({ panes: next });
  }

  function closeActive() {
    if (body.panes.length <= 1) {
      toast({ message: "Cannot close the last terminal pane", tone: "info" });
      return;
    }
    const next = body.panes.filter((pane) => pane.id !== body.activePaneId);
    commit({ panes: next, activePaneId: next[0]!.id });
  }

  function submit() {
    const source = active.input.trim();
    if (!source) return;
    const result = runCommand(ctx, source);
    const echo: WebTerminalLine = {
      id: `line-${Date.now()}-in`,
      kind: "input",
      text: `${active.cwd === "/" ? "" : active.cwd} $ ${source}`,
      createdAt: new Date().toISOString(),
    };
    appendToActive([echo, ...result.lines], result.cwd);
    const nextHistory = [
      source,
      ...active.history.filter((h) => h !== source),
    ].slice(0, 100);
    const nextPanes = body.panes.map((pane) =>
      pane.id === body.activePaneId
        ? { ...pane, history: nextHistory, historyIndex: -1, input: "" }
        : pane
    );
    const nextCommands = pushCommand(body.commands, source);
    commit({ panes: nextPanes, commands: nextCommands });
  }

  function changeInput(next: string) {
    const nextPanes = body.panes.map((pane) =>
      pane.id === body.activePaneId
        ? { ...pane, input: next, historyIndex: -1 }
        : pane
    );
    commit({ panes: nextPanes });
  }

  function cycleHistory(direction: 1 | -1) {
    if (active.history.length === 0) return;
    let next = active.historyIndex;
    if (next === -1) {
      next = direction === -1 ? 0 : active.history.length - 1;
    } else {
      next = next + direction;
      if (next < 0) next = 0;
      if (next >= active.history.length) next = -1;
    }
    const value = next === -1 ? "" : active.history[next]!;
    const nextPanes = body.panes.map((pane) =>
      pane.id === body.activePaneId
        ? { ...pane, historyIndex: next, input: value }
        : pane
    );
    commit({ panes: nextPanes });
  }

  function switchPane(id: string) {
    commit({ activePaneId: id });
  }

  function newTerminal() {
    const pane = newPane(`Terminal ${body.panes.length + 1}`);
    commit({ panes: [...body.panes, pane], activePaneId: pane.id });
  }

  async function copyOutput() {
    const text = active.lines.map((line) => line.text).join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        toast({ message: "Terminal output copied", tone: "success" });
        return;
      } catch {
        /* ignore */
      }
    }
    toast({ message: "Could not copy", tone: "error" });
  }

  function changeFontSize(delta: number) {
    const next = Math.max(10, Math.min(24, body.fontSize + delta));
    commit({ fontSize: next });
  }

  return (
    <div
      className={
        "flex min-h-0 flex-1 flex-col " +
        (body.fullscreen ? "fixed inset-0 z-50 bg-background" : "")
      }
    >
      <ToolChrome
        title={session.meta.title}
        description="Integrated Terminal — multiple terminals, history, clear, copy, resize, fullscreen and keyboard shortcuts."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={newTerminal}
              title="New terminal pane (Ctrl/Cmd + T)"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Pane
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={clearActive}
              title="Clear (Ctrl/Cmd + K)"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={copyOutput}
              title="Copy output"
            >
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => changeFontSize(-1)}
              aria-label="Decrease font size"
            >
              A-
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => changeFontSize(1)}
              aria-label="Increase font size"
            >
              A+
            </Button>
            <Button
              size="sm"
              variant={body.fullscreen ? "default" : "ghost"}
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => commit({ fullscreen: !body.fullscreen })}
              title="Toggle fullscreen (Ctrl/Cmd + Shift + F)"
            >
              {body.fullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {body.fullscreen ? "Exit" : "Full"}
            </Button>
          </>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.panes.length} panes · {body.commands.length} commands ·{" "}
            {body.fontSize}px
          </span>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
          {body.panes.map((pane) => {
            const isActive = pane.id === body.activePaneId;
            return (
              <button
                key={pane.id}
                type="button"
                onClick={() => switchPane(pane.id)}
                className={
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] " +
                  (isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                }
                aria-pressed={isActive}
              >
                <TerminalSquare
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                <span className="max-w-[140px] truncate font-mono">
                  {pane.name}
                </span>
                {body.panes.length > 1 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      commit({
                        panes: body.panes.filter((p) => p.id !== pane.id),
                        activePaneId:
                          body.activePaneId === pane.id
                            ? body.panes.find((p) => p.id !== pane.id)!.id
                            : body.activePaneId,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        commit({
                          panes: body.panes.filter((p) => p.id !== pane.id),
                          activePaneId:
                            body.activePaneId === pane.id
                              ? body.panes.find((p) => p.id !== pane.id)!.id
                              : body.activePaneId,
                        });
                      }
                    }}
                    className="rounded p-0.5 hover:bg-foreground/20"
                    aria-label={`Close ${pane.name}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black p-0 text-green-200">
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto px-3 py-2 font-mono"
            style={{ fontSize: `${body.fontSize}px`, lineHeight: 1.4 }}
          >
            {active.lines.map((line) => (
              <LineView key={line.id} line={line} />
            ))}
          </div>
          <form
            className="flex items-center gap-2 border-t border-green-200/20 px-3 py-2 font-mono"
            style={{ fontSize: `${body.fontSize}px` }}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <span className="text-green-300">
              {active.cwd === "/" ? "" : active.cwd} $
            </span>
            <input
              ref={inputRef}
              value={active.input}
              onChange={(event) => changeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  cycleHistory(-1);
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  cycleHistory(1);
                }
              }}
              className="flex-1 bg-transparent text-green-100 outline-none"
              placeholder="Type a command (try `help`)"
              aria-label="Terminal input"
              autoFocus
              spellCheck={false}
            />
          </form>
        </Card>
        {body.commands.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">
              Recent
            </span>
            {body.commands.slice(0, 6).map((command) => (
              <button
                key={command.id}
                type="button"
                onClick={() => changeInput(command.source)}
                className="rounded border border-border bg-muted/30 px-2 py-0.5 font-mono hover:bg-accent"
                title={command.source}
              >
                {command.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LineView({ line }: { line: WebTerminalLine }) {
  const className =
    line.kind === "input"
      ? "text-cyan-200"
      : line.kind === "error"
        ? "text-red-300"
        : line.kind === "info"
          ? "text-amber-200"
          : "text-green-100";
  return (
    <pre
      className={`whitespace-pre-wrap break-words ${className}`}
      style={{ margin: 0, font: "inherit" }}
    >
      {line.text}
    </pre>
  );
}

function activePane(body: WebTerminalBody): WebTerminalPane {
  return (
    body.panes.find((pane) => pane.id === body.activePaneId) ?? body.panes[0]!
  );
}
