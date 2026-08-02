"use client";

/**
 * Multi-file Workspace surface.
 *
 * A professional multi-file editor for WebPilot. The user opens
 * every file in the project as a tab in a tabbed bar, sees the
 * unsaved indicator on dirty files, autosaves the moment the user
 * stops typing, restores the previous session when the workspace
 * re-opens, closes and reopens tabs from a closed-tab stack,
 * splits the active editor into two side-by-side panes, and
 * quick-switches between files with the keyboard. The workspace
 * reuses the existing WebPilot CodeEditor so every existing tool
 * surface stays identical.
 *
 * Mirrors the existing tool chrome and the workspace-dashboard
 * pattern, but the body is a tab list plus a flat file cache.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  RotateCcw,
  Save,
  Search,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { CodeEditor, type CodeLanguage } from "./shared/code-editor";
import {
  asWorkspaceBody,
  buildProjectTree,
  popClosedTab,
  pushClosedTab,
  tokeniseCss,
  tokeniseHtml,
  tokeniseJs,
} from "@/lib/webpilot";
import type {
  WebProjectFile,
  WebSession,
  WebWorkspaceBody,
  WebWorkspaceTab,
} from "@/lib/webpilot";

interface WorkspaceSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

const AUTOSAVE_INTERVAL_MS = 1500;

export function WorkspaceSurface({ session, onChange }: WorkspaceSurfaceProps) {
  const body = asWorkspaceBody(session.body);
  const { toast } = useToast();

  const [splitActive, setSplitActive] = useState(false);
  const [secondaryTabId, setSecondaryTabId] = useState<string>("");
  // The saved baseline is the savedSource of every file. Files
  // whose source differs from the baseline are dirty. We expose a
  // small derived map so the dirty checks below stay O(1) and the
  // autosave loop can read the baseline without re-iterating the
  // file list.
  const savedBaseline = useMemo(
    () =>
      Object.fromEntries(
        body.files.map((file) => [file.id, file.savedSource])
      ),
    [body.files]
  );

  function commit(patch: Partial<WebWorkspaceBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const tree = useMemo(
    () => buildProjectTree(body.folders, body.files),
    [body.folders, body.files]
  );

  const filteredFiles = useMemo(() => {
    const term = body.search.trim().toLowerCase();
    if (!term) return body.files;
    return body.files.filter((file) => file.path.toLowerCase().includes(term));
  }, [body.files, body.search]);

  const activeTab = useMemo(
    () => body.tabs.find((tab) => tab.id === body.activeTabId) ?? null,
    [body.activeTabId, body.tabs]
  );
  const activeFile = useMemo(
    () =>
      activeTab
        ? body.files.find((file) => file.id === activeTab.id) ?? null
        : null,
    [activeTab, body.files]
  );
  const secondaryTab = useMemo(
    () => body.tabs.find((tab) => tab.id === secondaryTabId) ?? null,
    [body.tabs, secondaryTabId]
  );
  const secondaryFile = useMemo(
    () =>
      secondaryTab
        ? body.files.find((file) => file.id === secondaryTab.id) ?? null
        : null,
    [secondaryTab, body.files]
  );

  // Autosave: every 1.5s, persist any file whose source differs
  // from its saved baseline. The next render derives the new
  // baseline from the freshly-persisted file list, so we do not
  // need a local snapshot.
  useEffect(() => {
    const handle = window.setInterval(() => {
      const dirty: WebProjectFile[] = [];
      for (const file of body.files) {
        if (file.source !== file.savedSource) {
          dirty.push(file);
        }
      }
      if (dirty.length === 0) return;
      const nextFiles = body.files.map((file) =>
        file.source === file.savedSource
          ? file
          : {
              ...file,
              savedSource: file.source,
              updatedAt: new Date().toISOString(),
            }
      );
      commit({ files: nextFiles });
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.files, session.meta.id]);

  function openFile(file: WebProjectFile) {
    if (body.tabs.some((tab) => tab.id === file.id)) {
      commit({ activeTabId: file.id });
      return;
    }
    const tab: WebWorkspaceTab = {
      id: file.id,
      path: file.path,
      fileKind: file.kind,
      split: false,
    };
    commit({ tabs: [...body.tabs, tab], activeTabId: file.id });
  }

  function closeTab(id: string) {
    const tab = body.tabs.find((entry) => entry.id === id);
    if (!tab) return;
    const file = body.files.find((entry) => entry.id === id);
    if (file && file.source !== file.savedSource) {
      const nextFiles = body.files.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              savedSource: entry.source,
              updatedAt: new Date().toISOString(),
            }
          : entry
      );
      commit({ files: nextFiles });
    }
    const nextTabs = body.tabs.filter((entry) => entry.id !== id);
    let nextActive = body.activeTabId;
    if (body.activeTabId === id) {
      nextActive = nextTabs.length ? nextTabs[nextTabs.length - 1]!.id : "";
    }
    let nextSecondary = secondaryTabId;
    if (secondaryTabId === id) {
      nextSecondary =
        nextTabs.find((entry) => entry.id !== nextActive)?.id ?? "";
    }
    commit({ tabs: nextTabs, activeTabId: nextActive });
    setSecondaryTabId(nextSecondary);
    if (tab.path) {
      commit({
        closedTabs: pushClosedTab(body.closedTabs, tab.path, tab.fileKind),
      });
    }
  }

  function reopenClosedTab() {
    const { tab, rest } = popClosedTab(body.closedTabs);
    if (!tab) {
      toast({ message: "No recently closed tabs", tone: "info" });
      return;
    }
    const file = body.files.find((entry) => entry.path === tab.path);
    if (!file) {
      commit({ closedTabs: rest });
      return;
    }
    const nextTab: WebWorkspaceTab = {
      id: file.id,
      path: file.path,
      fileKind: file.kind,
      split: false,
    };
    commit({
      tabs: [...body.tabs, nextTab],
      activeTabId: file.id,
      closedTabs: rest,
    });
  }

  function updateFileSource(id: string, next: string) {
    const nextFiles = body.files.map((entry) =>
      entry.id === id
        ? { ...entry, source: next, updatedAt: new Date().toISOString() }
        : entry
    );
    commit({ files: nextFiles });
  }

  function markSaved(id: string) {
    const file = body.files.find((entry) => entry.id === id);
    if (!file) return;
    const nextFiles = body.files.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            savedSource: entry.source,
            updatedAt: new Date().toISOString(),
          }
        : entry
    );
    commit({ files: nextFiles });
    toast({ message: "Saved", tone: "success" });
  }

  function markAllSaved() {
    const nextFiles = body.files.map((file) => ({
      ...file,
      savedSource: file.source,
      updatedAt: new Date().toISOString(),
    }));
    commit({ files: nextFiles });
    toast({ message: "All files saved", tone: "success" });
  }

  function quickSwitch(direction: 1 | -1) {
    if (body.tabs.length === 0) return;
    const index = body.tabs.findIndex((tab) => tab.id === body.activeTabId);
    const next =
      index === -1
        ? 0
        : (index + direction + body.tabs.length) % body.tabs.length;
    commit({ activeTabId: body.tabs[next]!.id });
  }

  // Keyboard shortcuts: Ctrl+Tab / Ctrl+Shift+Tab cycle through
  // tabs; Ctrl+Alt+S toggles the split editor; Ctrl+Alt+T picks a
  // second tab into the split.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "Tab") {
        event.preventDefault();
        quickSwitch(event.shiftKey ? -1 : 1);
        return;
      }
      if (mod && event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSplitActive((value) => !value);
        return;
      }
      if (mod && event.altKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        if (body.tabs.length < 2) return;
        const current = body.activeTabId;
        const next = body.tabs.find((tab) => tab.id !== current);
        if (next) setSecondaryTabId(next.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.tabs, body.activeTabId]);

  const dirtyCount = body.files.filter(
    (file) => file.source !== (savedBaseline[file.id] ?? file.savedSource)
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Multi-file Workspace — multiple tabs with an unsaved indicator, autosave, restore session, close and reopen tabs, split editor and quick switch."
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
              variant={splitActive ? "default" : "ghost"}
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => setSplitActive((value) => !value)}
              aria-pressed={splitActive}
            >
              <SplitSquareHorizontal
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              Split
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => quickSwitch(-1)}
              disabled={body.tabs.length === 0}
              aria-label="Previous tab"
              title="Previous tab (Ctrl/Cmd + Shift + Tab)"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => quickSwitch(1)}
              disabled={body.tabs.length === 0}
              aria-label="Next tab"
              title="Next tab (Ctrl/Cmd + Tab)"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={reopenClosedTab}
              disabled={body.closedTabs.length === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reopen
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={markAllSaved}
              disabled={dirtyCount === 0}
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Save all
            </Button>
          </>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.tabs.length} tabs · {dirtyCount} dirty · {body.closedTabs.length}{" "}
            closed
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,3fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={body.search}
              onChange={(event) => commit({ search: event.target.value })}
              placeholder="Search files…"
              className="h-7 flex-1 text-xs"
            />
          </div>
          <div className="flex-1 overflow-auto p-2">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Project files
            </p>
            {filteredFiles.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No files match the search.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filteredFiles.map((file) => {
                  const isOpen = body.tabs.some((tab) => tab.id === file.id);
                  const isActive = body.activeTabId === file.id;
                  const isDirty =
                    file.source !==
                    (savedBaseline[file.id] ?? file.savedSource);
                  return (
                    <li key={file.id}>
                      <button
                        type="button"
                        onClick={() => openFile(file)}
                        className={
                          "group flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs " +
                          (isActive ? "bg-accent" : "hover:bg-accent/50")
                        }
                      >
                        <FilePlus
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate">{file.path}</span>
                        {isDirty ? (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-foreground"
                            aria-label="Unsaved changes"
                          />
                        ) : null}
                        {isOpen ? (
                          <span className="text-[9px] uppercase tracking-wider text-primary">
                            Open
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {tree && tree.children.length > 0 ? (
              <>
                <p className="mt-3 mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Folders
                </p>
                <ul className="space-y-0.5">
                  {tree.children
                    .filter((child) => child.entry.kind === "folder")
                    .map((child) => (
                      <li key={child.entry.path}>
                        <p className="rounded px-1 py-0.5 text-xs text-muted-foreground">
                          {child.entry.path || "/"}
                        </p>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          {body.tabs.length === 0 ? (
            <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <FilePlus className="h-6 w-6" aria-hidden="true" />
              <p>Select a file from the tree to open it in a tab.</p>
            </Card>
          ) : (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              <div
                role="tablist"
                aria-label="Open files"
                className="flex items-center overflow-x-auto border-b border-border bg-muted/30"
              >
                {body.tabs.map((tab) => {
                  const isActive = tab.id === body.activeTabId;
                  const file = body.files.find((entry) => entry.id === tab.id);
                  const isDirty = file
                    ? file.source !==
                      (savedBaseline[file.id] ?? file.savedSource)
                    : false;
                  return (
                    <div
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      className={
                        "group flex shrink-0 items-center gap-1 border-r border-border px-2 py-1 text-[11px] " +
                        (isActive ? "bg-background" : "hover:bg-accent")
                      }
                    >
                      <button
                        type="button"
                        onClick={() => commit({ activeTabId: tab.id })}
                        className="flex items-center gap-1"
                      >
                        {isDirty ? (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-foreground"
                            aria-label="Unsaved changes"
                          />
                        ) : null}
                        <span className="max-w-[180px] truncate font-mono">
                          {tab.path}
                        </span>
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => closeTab(tab.id)}
                        className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                        aria-label={`Close ${tab.path}`}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div
                className={
                  "grid min-h-0 flex-1 gap-0 " +
                  (splitActive ? "grid-cols-2" : "grid-cols-1")
                }
              >
                <TabBody
                  file={activeFile}
                  onSource={updateFileSource}
                  onSave={markSaved}
                />
                {splitActive ? (
                  <SplitPanel
                    file={secondaryFile}
                    onSource={updateFileSource}
                    onSelectSecondary={() => {
                      if (body.tabs.length < 2) return;
                      const current = body.activeTabId;
                      const next = body.tabs.find(
                        (tab) => tab.id !== current
                      );
                      if (next) setSecondaryTabId(next.id);
                    }}
                  />
                ) : null}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface TabBodyProps {
  file: WebProjectFile | null;
  onSource: (id: string, next: string) => void;
  onSave: (id: string) => void;
}

function TabBody({ file, onSource, onSave }: TabBodyProps) {
  if (!file) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
        Select a file to open it in the editor.
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-col overflow-hidden border-r border-border last:border-r-0">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {file.path}
        </p>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {file.source.length} bytes
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={() => onSave(file.id)}
        >
          <Save className="h-3 w-3" aria-hidden="true" />
          Save
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={file.source}
          onChange={(next) => onSource(file.id, next)}
          language={file.kind as CodeLanguage}
          tokenise={
            file.kind === "css"
              ? tokeniseCss
              : file.kind === "javascript"
                ? tokeniseJs
                : tokeniseHtml
          }
          indent={2}
          ariaLabel={`Editor · ${file.path}`}
        />
      </div>
    </div>
  );
}

interface SplitPanelProps {
  file: WebProjectFile | null;
  onSource: (id: string, next: string) => void;
  onSelectSecondary: () => void;
}

function SplitPanel({ file, onSource, onSelectSecondary }: SplitPanelProps) {
  if (!file) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-[10px] text-muted-foreground">
        <p>Open a second file to compare side-by-side.</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[10px]"
          onClick={onSelectSecondary}
        >
          Pick another tab
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {file.path} (split)
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 gap-1 px-2 text-[10px]"
          onClick={onSelectSecondary}
        >
          Change
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={file.source}
          onChange={(next) => onSource(file.id, next)}
          language={file.kind as CodeLanguage}
          tokenise={
            file.kind === "css"
              ? tokeniseCss
              : file.kind === "javascript"
                ? tokeniseJs
                : tokeniseHtml
          }
          indent={2}
          ariaLabel={`Split editor · ${file.path}`}
        />
      </div>
    </div>
  );
}
