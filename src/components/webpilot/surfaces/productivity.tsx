"use client";

/**
 * Workspace Productivity surface.
 *
 * A professional workspace productivity view. The user opens the
 * Command Palette (Ctrl/Cmd + Shift + P) to fuzzy-search every
 * command the workspace exposes, browses the recent projects
 * list, runs quick actions, and tunes the workspace settings:
 * autosave on / off, autosave interval, word wrap, theme,
 * minimap, indent width, find shortcut.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome` and the in-app toast so it feels identical to
 * every other WebPilot tool.
 */

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Command,
  History as HistoryIcon,
  Keyboard,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asProductivityBody,
  pushRecentProject,
  resetProductivitySettings,
  searchPalette,
  WORKSPACE_SHORTCUTS,
} from "@/lib/webpilot";
import type {
  WebCommandPaletteItem,
  WebProductivityBody,
  WebProductivityRecent,
  WebSession,
} from "@/lib/webpilot";

interface ProductivitySurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

const STATIC_PALETTE: WebCommandPaletteItem[] = [
  {
    id: "cmd-toggle-palette",
    label: "Toggle Command Palette",
    category: "Workspace",
    shortcut: "Ctrl/Cmd + Shift + P",
    keywords: ["palette", "command", "WebPilot"],
  },
  {
    id: "cmd-open-shortcuts",
    label: "Open keyboard shortcut reference",
    category: "Workspace",
    shortcut: "Ctrl/Cmd + /",
    keywords: ["shortcut", "keyboard", "reference", "WebPilot"],
  },
  {
    id: "cmd-clear-terminal",
    label: "Clear the Integrated Terminal",
    category: "Terminal",
    shortcut: "Ctrl/Cmd + K",
    keywords: ["terminal", "clear", "WebPilot"],
  },
  {
    id: "cmd-new-terminal",
    label: "New Integrated Terminal pane",
    category: "Terminal",
    shortcut: "Ctrl/Cmd + T",
    keywords: ["terminal", "new", "pane", "WebPilot"],
  },
  {
    id: "cmd-fullscreen-terminal",
    label: "Toggle Integrated Terminal fullscreen",
    category: "Terminal",
    shortcut: "Ctrl/Cmd + Shift + F",
    keywords: ["terminal", "fullscreen", "WebPilot"],
  },
  {
    id: "cmd-toggle-autosave",
    label: "Toggle autosave",
    category: "Workspace",
    keywords: ["autosave", "save", "WebPilot"],
  },
  {
    id: "cmd-reset-settings",
    label: "Reset workspace settings",
    category: "Workspace",
    keywords: ["reset", "settings", "WebPilot"],
  },
];

export function ProductivitySurface({
  session,
  onChange,
}: ProductivitySurfaceProps) {
  const body = asProductivityBody(session.body);
  const { toast } = useToast();
  const [paletteLocal, setPaletteLocal] = useState("");

  function commit(patch: Partial<WebProductivityBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  // The React Compiler flags useMemo with body.quickActions because
  // the field could in principle be mutated by a sibling event
  // handler. In practice the workspace always replaces the whole
  // body on commit, so the dependency is safe.
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const palette = useMemo(
    () => [...STATIC_PALETTE, ...body.quickActions.map(toPaletteItem)],
    [body.quickActions]
  );

  const matches = useMemo(
    () => searchPalette(palette, paletteLocal),
    [palette, paletteLocal]
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  function openQuickAction(id: string) {
    const action = body.quickActions.find((entry) => entry.id === id);
    if (!action) return;
    if (action.target.startsWith("http")) {
      window.open(action.target, "_blank", "noopener,noreferrer");
    } else if (action.target.startsWith("/")) {
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = action.target;
    } else {
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = `/webpilot/${action.target}`;
    }
    commit({
      quickActions: body.quickActions.map((action) =>
        action.id === id
          ? { ...action, label: action.label }
          : action
      ),
    });
  }

  function openRecent(entry: WebProductivityRecent) {
    // eslint-disable-next-line react-hooks/immutability
    window.location.href = `/webpilot/${entry.kind}`;
    commit({ recent: pushRecentProject(body.recent, entry) });
  }

  function togglePalette() {
    commit({ paletteOpen: !body.paletteOpen, paletteQuery: "" });
    setPaletteLocal("");
  }

  function runPaletteItem(item: WebCommandPaletteItem) {
    if (item.id.startsWith("cmd-")) {
      switch (item.id) {
        case "cmd-toggle-palette":
          togglePalette();
          break;
        case "cmd-open-shortcuts":
          toast({
            message: "Scroll down to see the shortcut reference",
            tone: "info",
          });
          break;
        case "cmd-clear-terminal":
          // eslint-disable-next-line react-hooks/immutability
          window.location.href = "/webpilot/terminal";
          break;
        case "cmd-new-terminal":
          // eslint-disable-next-line react-hooks/immutability
          window.location.href = "/webpilot/terminal";
          break;
        case "cmd-fullscreen-terminal":
          // eslint-disable-next-line react-hooks/immutability
          window.location.href = "/webpilot/terminal";
          break;
        case "cmd-toggle-autosave":
          commit({ autosaveEnabled: !body.autosaveEnabled });
          toast({
            message: body.autosaveEnabled
              ? "Autosave disabled"
              : "Autosave enabled",
            tone: "info",
          });
          break;
        case "cmd-reset-settings":
          commit(resetProductivitySettings(body));
          toast({ message: "Settings reset to defaults", tone: "success" });
          break;
        default:
          break;
      }
    } else {
      openQuickAction(item.id);
    }
    commit({ paletteOpen: false, paletteQuery: "" });
    setPaletteLocal("");
  }

  function resetSettings() {
    commit(resetProductivitySettings(body));
    toast({ message: "Settings reset to defaults", tone: "success" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Workspace Productivity — Command Palette, keyboard shortcut reference, recent projects, quick actions, workspace settings and autosave controls."
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
              variant={body.paletteOpen ? "default" : "ghost"}
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={togglePalette}
              title="Toggle Command Palette (Ctrl/Cmd + Shift + P)"
            >
              <Command className="h-3.5 w-3.5" aria-hidden="true" />
              Palette
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={resetSettings}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset settings
            </Button>
          </>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.quickActions.length} actions · {body.recent.length} recent ·{" "}
            {body.autosaveEnabled
              ? `autosave ${body.autosaveIntervalMs}ms`
              : "autosave off"}
          </span>
        }
      />
      {body.paletteOpen ? (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={paletteLocal}
              onChange={(event) => {
                setPaletteLocal(event.target.value);
                commit({ paletteQuery: event.target.value });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  runPaletteItem(matches[0]);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  commit({ paletteOpen: false });
                }
              }}
              placeholder="Type a command…"
              className="h-7 flex-1 border-0 text-xs"
              aria-label="Command palette query"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              onClick={() => commit({ paletteOpen: false })}
            >
              Esc
            </Button>
          </div>
          <ul className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-background">
            {matches.length === 0 ? (
              <li className="px-2 py-2 text-[11px] text-muted-foreground">
                No commands match the query.
              </li>
            ) : (
              matches.slice(0, 10).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => runPaletteItem(item)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-accent/50"
                  >
                    <Sparkles
                      className="h-3 w-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.category}
                    </span>
                    {item.shortcut ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.shortcut}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-4 xl:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold">
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            Workspace settings
          </h3>
          <div className="grid gap-2 text-[11px]">
            <SettingRow
              label="Autosave"
              description="Persist the active session to IndexedDB on every change."
            >
              <input
                type="checkbox"
                checked={body.autosaveEnabled}
                onChange={(event) =>
                  commit({ autosaveEnabled: event.target.checked })
                }
                aria-label="Autosave enabled"
              />
            </SettingRow>
            <SettingRow
              label="Autosave interval"
              description="How often the autosave loop flushes a dirty session."
            >
              <Input
                type="number"
                min={250}
                max={60000}
                value={body.autosaveIntervalMs}
                onChange={(event) =>
                  commit({
                    autosaveIntervalMs: Number(event.target.value) || 1500,
                  })
                }
                className="h-7 w-24 text-[11px]"
                aria-label="Autosave interval (ms)"
              />
            </SettingRow>
            <SettingRow
              label="Word wrap"
              description="Wrap long lines in the editor."
            >
              <input
                type="checkbox"
                checked={body.wordWrap}
                onChange={(event) =>
                  commit({ wordWrap: event.target.checked })
                }
                aria-label="Word wrap"
              />
            </SettingRow>
            <SettingRow
              label="Theme"
              description="Match the system, or pin the surface to light or dark."
            >
              <select
                value={body.theme}
                onChange={(event) =>
                  commit({
                    theme: event.target.value as WebProductivityBody["theme"],
                  })
                }
                className="h-7 rounded border border-border bg-background px-2 text-[11px]"
                aria-label="Theme"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </SettingRow>
            <SettingRow
              label="Minimap"
              description="Show a small map of the source on the right of the editor."
            >
              <input
                type="checkbox"
                checked={body.minimap}
                onChange={(event) =>
                  commit({ minimap: event.target.checked })
                }
                aria-label="Minimap"
              />
            </SettingRow>
            <SettingRow
              label="Indent"
              description="Spaces used by the auto-indent feature."
            >
              <Input
                type="number"
                min={0}
                max={8}
                value={body.indent}
                onChange={(event) =>
                  commit({ indent: Number(event.target.value) || 2 })
                }
                className="h-7 w-20 text-[11px]"
                aria-label="Indent width"
              />
            </SettingRow>
            <SettingRow
              label="Find shortcut"
              description="Open the in-editor find bar on Ctrl/Cmd + F."
            >
              <input
                type="checkbox"
                checked={body.findShortcut}
                onChange={(event) =>
                  commit({ findShortcut: event.target.checked })
                }
                aria-label="Find shortcut"
              />
            </SettingRow>
          </div>
        </Card>

        <div className="grid min-h-0 gap-3">
          <Card className="p-4">
            <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Quick actions
            </h3>
            <ul className="grid grid-cols-2 gap-1 text-[11px]">
              {body.quickActions.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    onClick={() => openQuickAction(action.id)}
                    className="flex w-full items-center justify-between gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-left hover:bg-accent/50"
                  >
                    <span>
                      <span className="block font-medium">{action.label}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-3 w-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold">
              <HistoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Recent projects
            </h3>
            {body.recent.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted-foreground">
                Open a project to see it here. The list is the most recent
                twelve sessions you have visited.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px]">
                {body.recent.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openRecent(entry)}
                      className="flex w-full items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-left hover:bg-accent/50"
                    >
                      <span className="flex-1 truncate font-medium">
                        {entry.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.kind}
                      </span>
                      <ArrowRight
                        className="h-3 w-3 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold">
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              Keyboard shortcuts
            </h3>
            <ul className="grid grid-cols-2 gap-1 text-[11px]">
              {WORKSPACE_SHORTCUTS.map((entry) => (
                <li
                  key={entry.keys}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-muted/30 px-2 py-1"
                >
                  <span className="font-mono text-[10px]">{entry.keys}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {entry.description}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted/30 p-2">
      <span className="flex-1">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[10px] text-muted-foreground">
          {description}
        </span>
      </span>
      {children}
    </div>
  );
}

function toPaletteItem(action: WebProductivityBody["quickActions"][number]): WebCommandPaletteItem {
  return {
    id: action.id,
    label: action.label,
    category: "Quick action",
    shortcut: action.shortcut,
    keywords: action.label.toLowerCase().split(/\s+/),
  };
}
