"use client";

/**
 * DevPilot workspace shell.
 *
 * One reusable DevPilot surface that hosts every future developer
 * tool on top of one engine. The shell owns the chrome that is
 * identical across every tool:
 *
 *  - the top navigation with breadcrumbs, file tabs and the primary actions
 *  - the left navigation rail with the session list, new-session menu,
 *    recent sessions, favourites and the tool switcher
 *  - the right properties panel with kind-specific controls
 *  - the status bar with session state, autosave status and metadata
 *  - the shared save / open / rename / duplicate / delete / favourite lifecycle
 *  - the shared autosave loop and the shared keyboard shortcut system
 *
 * The actual editor surface for each kind is delegated to a child
 * component. The shell is intentionally product-agnostic: a future
 * tool (e.g. "JSON formatter" or "regex tester") only has to declare
 * a kind, a child Surface and a Properties component and the rest of
 * the workspace keeps working.
 *
 * Mirrors /components/socialpilot/workspace.tsx so a reader who
 * knows one LaunchStack product knows them all.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  Download,
  FilePlus,
  FileText,
  Keyboard,
  Loader2,
  Pencil,
  Save,
  Search,
  Star,
  Trash2,
  X,
  Activity,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ToastProvider, useToast, ToastHost } from "./toast";
import {
  autosaveDevSession,
  createDevSession,
  deleteDevSession,
  duplicateDevSession,
  getSession,
  getSessionBySlug,
  listDevSessions,
  openDevSession,
  renameDevSession,
  saveDevSession,
  sessions as allSessions,
  sessionHref,
  templatesForKind,
  toggleFavoriteDevSession,
  type DevSession,
  type DevSessionDefinition,
  type DevSessionKind,
  type DevSessionSummary,
  type DevTemplate,
} from "@/lib/devpilot";
import { SessionProperties } from "./properties/session";
import { ActivityPanel } from "./properties/activity-panel";
import { HistoryPanel } from "./properties/history-panel";

type SaveState = "saved" | "dirty" | "saving" | "error";
type RightTab = "session" | "history" | "activity";

interface DevWorkspaceProps {
  /** The session kind this shell is hosting. */
  kind: DevSessionKind;
  /** Session surface component for the kind. */
  Surface: React.ComponentType<{
    session: DevSession;
    onChange: (next: DevSession) => void;
  }>;
}

/** Autosave interval in milliseconds. */
const AUTOSAVE_INTERVAL_MS = 1500;

/**
 * Resolves the session descriptor for a route.
 *
 * The shell does not know which sessions exist; it asks the registry.
 * If the kind is unknown (a session was removed but a tab is still
 * open) we fall back to the first registered session so the user does
 * not get stranded on a blank page.
 */
function resolveSession(
  kind: DevSessionKind
): DevSessionDefinition | undefined {
  return getSession(kind) ?? getSessionBySlug(kind) ?? getSession("blank");
}

function DevWorkspaceInner({ kind, Surface }: DevWorkspaceProps) {
  const session = resolveSession(kind);
  const { toast } = useToast();

  // Sessions opened in this session. Most recent is the active one.
  const [openTabs, setOpenTabs] = useState<DevSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recent, setRecent] = useState<DevSessionSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [favorites, setFavorites] = useState<DevSessionSummary[]>([]);

  // Save state, computed from a map of id → SaveState for the open tabs.
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("session");

  const autosaveTimers = useRef<Map<string, number>>(new Map());
  const openTabsRef = useRef<DevSession[]>([]);
  const saveStatesRef = useRef<Record<string, SaveState>>({});
  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);
  useEffect(() => {
    saveStatesRef.current = saveStates;
  }, [saveStates]);
  useEffect(() => {
    const openIds = new Set(openTabs.map((p) => p.meta.id));
    for (const [id, handle] of autosaveTimers.current) {
      if (!openIds.has(id)) {
        window.clearTimeout(handle);
        autosaveTimers.current.delete(id);
      }
    }
  }, [openTabs]);

  const activeSession = useMemo(
    () => openTabs.find((p) => p.meta.id === activeId) ?? null,
    [openTabs, activeId]
  );
  const activeSaveState: SaveState = activeId
    ? saveStates[activeId] ?? "saved"
    : "saved";

  /** Refreshes the recent-sessions and favourites lists. */
  const refreshRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const [list, favs] = await Promise.all([
        listDevSessions({ limit: 50 }),
        listDevSessions({ favoritesOnly: true, limit: 50 }),
      ]);
      setRecent(list);
      setFavorites(favs);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshRecent(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshRecent]);

  /** Opens an existing session, switching tabs if it is already open. */
  const openExisting = useCallback(
    async (id: string) => {
      if (openTabs.some((p) => p.meta.id === id)) {
        setActiveId(id);
        return;
      }
      const next = await openDevSession(id);
      if (!next) {
        toast({ message: "That session could not be opened.", tone: "error" });
        return;
      }
      setOpenTabs((current) => [...current, next]);
      setActiveId(next.meta.id);
    },
    [openTabs, toast]
  );

  /** Creates a new blank session. */
  const createBlank = useCallback(async () => {
    const target = session?.kind ?? "blank";
    const next = await createDevSession(target);
    setOpenTabs((current) => [...current, next]);
    setActiveId(next.meta.id);
    await refreshRecent();
  }, [session?.kind, refreshRecent]);

  /** Creates a new session from a template. */
  const createFromTemplate = useCallback(
    async (template: DevTemplate) => {
      const next = await createDevSession(session?.kind ?? "blank", {
        template,
      });
      setOpenTabs((current) => [...current, next]);
      setActiveId(next.meta.id);
      await refreshRecent();
    },
    [session?.kind, refreshRecent]
  );

  /** Updates the active session body and marks it dirty. */
  const updateActive = useCallback((next: DevSession) => {
    setOpenTabs((current) =>
      current.map((p) => (p.meta.id === next.meta.id ? next : p))
    );
    setSaveStates((current) => ({ ...current, [next.meta.id]: "dirty" }));
  }, []);

  /** Saves the active session explicitly. */
  const saveActive = useCallback(async () => {
    if (!activeSession) return;
    setSaveStates((current) => ({
      ...current,
      [activeSession.meta.id]: "saving",
    }));
    const saved = await saveDevSession(activeSession);
    setOpenTabs((current) =>
      current.map((p) => (p.meta.id === saved.meta.id ? saved : p))
    );
    setSaveStates((current) => ({ ...current, [saved.meta.id]: "saved" }));
    await refreshRecent();
  }, [activeSession, refreshRecent]);

  /** Closes a tab. Flushes a dirty tab first. */
  const closeTab = useCallback(
    async (id: string) => {
      const pending = autosaveTimers.current.get(id);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        autosaveTimers.current.delete(id);
      }
      const state = saveStatesRef.current[id] ?? "saved";
      const doc = openTabsRef.current.find((p) => p.meta.id === id);
      if (doc && state === "dirty") {
        const saved = await saveDevSession(doc);
        const persisted =
          saved.meta.autosavedAt && saved.meta.version > doc.meta.version;
        setOpenTabs((current) =>
          current.map((p) => (p.meta.id === saved.meta.id ? saved : p))
        );
        if (persisted) {
          setSaveStates((current) => ({
            ...current,
            [saved.meta.id]: "saved",
          }));
          await refreshRecent();
        } else {
          toast({ message: "Could not save before closing.", tone: "error" });
          return;
        }
      }
      let nextActive: string | null = activeId;
      setOpenTabs((current) => {
        const next = current.filter((p) => p.meta.id !== id);
        if (id === activeId) {
          nextActive = next.length ? next[next.length - 1]!.meta.id : null;
        }
        return next;
      });
      if (nextActive !== activeId) {
        setActiveId(nextActive);
      }
      setSaveStates((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
    },
    [activeId, refreshRecent, toast]
  );

  /** Renames a session. */
  const commitRename = useCallback(
    async (id: string, name: string) => {
      const summary = await renameDevSession(id, name);
      if (!summary) {
        toast({ message: "Could not rename that session.", tone: "error" });
        return;
      }
      setOpenTabs((current) =>
        current.map((p) =>
          p.meta.id === id
            ? { ...p, meta: { ...p.meta, title: summary.title } }
            : p
        )
      );
      setRenamingId(null);
      await refreshRecent();
    },
    [refreshRecent, toast]
  );

  /** Toggles the favourite flag. */
  const toggleFavorite = useCallback(
    async (id: string) => {
      const summary = await toggleFavoriteDevSession(id);
      if (!summary) {
        toast({ message: "Could not update that session.", tone: "error" });
        return;
      }
      setOpenTabs((current) =>
        current.map((p) =>
          p.meta.id === id ? { ...p, meta: { ...p.meta, isFavorite: summary.isFavorite } } : p
        )
      );
      await refreshRecent();
      toast({
        message: summary.isFavorite ? "Added to favourites" : "Removed from favourites",
        tone: "info",
      });
    },
    [refreshRecent, toast]
  );

  /** Duplicates the active session and opens the copy. */
  const duplicateActive = useCallback(async () => {
    if (!activeSession) return;
    const copy = await duplicateDevSession(activeSession.meta.id);
    if (!copy) {
      toast({ message: "Could not duplicate that session.", tone: "error" });
      return;
    }
    setOpenTabs((current) => [...current, copy]);
    setActiveId(copy.meta.id);
    await refreshRecent();
  }, [activeSession, refreshRecent, toast]);

  /** Deletes a session and closes any open tab pointing at it. */
  const deleteSession = useCallback(
    async (id: string) => {
      const pending = autosaveTimers.current.get(id);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        autosaveTimers.current.delete(id);
      }
      const ok = await deleteDevSession(id);
      if (!ok) {
        toast({ message: "Could not delete that session.", tone: "error" });
        return;
      }
      let nextActive: string | null = activeId;
      setOpenTabs((current) => {
        const remaining = current.filter((p) => p.meta.id !== id);
        if (id === activeId) {
          nextActive = remaining.length
            ? remaining[remaining.length - 1]!.meta.id
            : null;
        }
        return remaining;
      });
      if (nextActive !== activeId) {
        setActiveId(nextActive);
      }
      setSaveStates((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      await refreshRecent();
    },
    [activeId, refreshRecent, toast]
  );

  /** Downloads the active session as JSON. */
  const exportActive = useCallback(async () => {
    if (!activeSession) return;
    const title = activeSession.meta.title || session?.slug || "session";
    const safeName = title.replace(/[^\w\-]+/g, "_");
    const json = JSON.stringify(activeSession, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeSession, session?.slug]);

  /**
   * Schedules an autosave for every dirty open session. The timer is
   * per-session so a tab the user is not currently looking at is still
   * flushed to storage.
   */
  useEffect(() => {
    for (const p of openTabs) {
      const state = saveStates[p.meta.id] ?? "saved";
      if (state !== "dirty") {
        const pending = autosaveTimers.current.get(p.meta.id);
        if (pending !== undefined) {
          window.clearTimeout(pending);
          autosaveTimers.current.delete(p.meta.id);
        }
        continue;
      }
      if (autosaveTimers.current.has(p.meta.id)) continue;
      const id = p.meta.id;
      const handle = window.setTimeout(async () => {
        autosaveTimers.current.delete(id);
        const latest = openTabsRef.current.find((p) => p.meta.id === id);
        if (!latest) return;
        if (saveStatesRef.current[id] !== "dirty") return;
        setSaveStates((current) => ({ ...current, [id]: "saving" }));
        const saved = await autosaveDevSession(latest);
        setOpenTabs((current) =>
          current.map((p) => (p.meta.id === saved.meta.id ? saved : p))
        );
        setSaveStates((current) => {
          const latestNow = openTabsRef.current.find((p) => p.meta.id === id);
          const nextState: SaveState =
            latestNow && JSON.stringify(latestNow.body) !== JSON.stringify(saved.body)
              ? "dirty"
              : "saved";
          return { ...current, [saved.meta.id]: nextState };
        });
      }, AUTOSAVE_INTERVAL_MS);
      autosaveTimers.current.set(id, handle);
    }
  }, [openTabs, saveStates]);

  /** Clear every pending timer on unmount. */
  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      for (const handle of timers.values()) {
        window.clearTimeout(handle);
      }
      timers.clear();
    };
  }, []);

  /** Browser-level guard for dirty sessions. */
  useEffect(() => {
    const hasDirty = Object.values(saveStates).some((state) => state === "dirty");
    if (!hasDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStates]);

  /** Keyboard shortcuts. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActive();
        return;
      }

      if (target?.matches("input, textarea, select, [contenteditable='true'], [role='textbox']")) {
        if (event.key === "Escape") {
          event.preventDefault();
          target.blur();
        }
        return;
      }

      if (mod && event.key.toLowerCase() === "w" && activeId) {
        event.preventDefault();
        closeTab(activeId);
        return;
      }
      if (mod && event.key.toLowerCase() === "d" && activeId) {
        event.preventDefault();
        void duplicateActive();
        return;
      }
      if (mod && event.key.toLowerCase() === "b" && activeId) {
        event.preventDefault();
        void toggleFavorite(activeId);
        return;
      }
      if (event.key === "?" && !mod && !event.altKey) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === "/") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, closeTab, duplicateActive, saveActive, toggleFavorite]);

  const filteredRecent = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return recent;
    return recent.filter(
      (entry) =>
        entry.title.toLowerCase().includes(term) ||
        entry.kind.toLowerCase().includes(term)
    );
  }, [recent, searchValue]);

  const headerTitle = session?.name ?? "DevPilot";

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[480px] flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2">
        <Link
          href="/products/devpilot"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to DevPilot"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">DevPilot</span>
        </Link>
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <span className="text-sm font-medium">{headerTitle}</span>

        <div className="ml-3 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {openTabs.length === 0 ? (
            <span className="text-xs text-muted-foreground">No sessions open</span>
          ) : (
            openTabs.map((p) => {
              const isActive = p.meta.id === activeId;
              const state = saveStates[p.meta.id] ?? "saved";
              return (
                <div
                  key={p.meta.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                    isActive
                      ? "border-foreground/30 bg-background"
                      : "border-transparent hover:bg-accent"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(p.meta.id)}
                    className="flex items-center gap-1.5"
                  >
                    {renamingId === p.meta.id ? (
                      <Input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitRename(p.meta.id, renameValue);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                        onBlur={(event) => {
                          const next = event.relatedTarget as HTMLElement | null;
                          if (next && next.closest("[data-tab-control]")) return;
                          if (renameValue.trim()) void commitRename(p.meta.id, renameValue);
                          else setRenamingId(null);
                        }}
                        className="h-6 w-40 text-xs"
                        autoFocus
                        aria-label={`Rename ${p.meta.title}`}
                      />
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        {p.meta.isFavorite && (
                          <Star
                            className="h-3 w-3 fill-primary text-primary"
                            aria-label="Favourite"
                          />
                        )}
                        <span className="max-w-[160px] truncate">{p.meta.title}</span>
                        {state === "dirty" && <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-label="Unsaved changes" />}
                        {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" aria-label="Saving" />}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => closeTab(p.meta.id)}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    aria-label={`Close ${p.meta.title}`}
                    data-tab-control="close"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => void saveActive()}
            disabled={!activeSession || activeSaveState === "saving"}
          >
            {activeSaveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => void exportActive()}
            disabled={!activeSession}
            aria-label="Export"
            title="Export"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <NavigationRail
          session={session ?? null}
          recent={filteredRecent}
          favorites={favorites}
          loading={loadingRecent}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onNew={createBlank}
          onOpen={openExisting}
          onRename={async (id, name) => {
            setRenamingId(id);
            setRenameValue(name);
            const target = openTabs.find((p) => p.meta.id === id);
            if (target) setActiveId(id);
          }}
          renamingId={renamingId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onCommitRename={commitRename}
          onCancelRename={() => setRenamingId(null)}
          onTemplate={createFromTemplate}
          onDelete={deleteSession}
          onToggleFavorite={toggleFavorite}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {activeSession ? (
            <Surface session={activeSession} onChange={updateActive} />
          ) : (
            <EmptyState
              session={session ?? null}
              onNew={createBlank}
              onOpen={openExisting}
              recent={filteredRecent}
              onDelete={deleteSession}
            />
          )}
        </main>

        <aside
          aria-label="Properties"
          className="hidden w-80 shrink-0 flex-col border-l border-border bg-card xl:flex"
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-border p-2">
            <RightTabButton
              current={rightTab}
              value="session"
              onSelect={setRightTab}
              icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Session"
            />
            <RightTabButton
              current={rightTab}
              value="history"
              onSelect={setRightTab}
              icon={<HistoryIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              label="History"
            />
            <RightTabButton
              current={rightTab}
              value="activity"
              onSelect={setRightTab}
              icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Activity"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightTab === "session" &&
              (activeSession ? (
                <SessionProperties session={activeSession} />
              ) : (
                <div className="p-5 text-sm text-muted-foreground">
                  Open a session to see its properties here.
                </div>
              ))}
            {rightTab === "history" && (
              <HistoryPanel
                toolName={activeSession?.meta.kind}
                favoritesOnly={false}
                limit={20}
              />
            )}
            {rightTab === "activity" && <ActivityPanel filterDev />}
          </div>
        </aside>
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {activeSession
            ? `${activeSession.meta.kind} · v${activeSession.meta.version}`
            : "No session"}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {activeSession
            ? `${Math.max(1, Math.round(activeSession.meta.size / 1024))} KB`
            : "—"}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {activeSaveState === "saved" && activeSession
            ? `Saved ${activeSession.meta.autosavedAt ? new Date(activeSession.meta.autosavedAt).toLocaleTimeString() : ""}`
            : activeSaveState === "dirty"
              ? "Unsaved changes"
              : activeSaveState === "saving"
                ? "Saving…"
                : "Ready"}
        </span>
        <span className="ml-auto" aria-hidden="true">
          {activeSession?.meta.isFavorite ? "★ Favourite" : ""}
        </span>
      </footer>

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ToastHost />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation rail                                                           */
/* -------------------------------------------------------------------------- */

interface RightTabButtonProps {
  current: RightTab;
  value: RightTab;
  onSelect: (value: RightTab) => void;
  icon: React.ReactNode;
  label: string;
}

function RightTabButton({ current, value, onSelect, icon, label }: RightTabButtonProps) {
  const isActive = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      aria-pressed={isActive}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

interface NavigationRailProps {
  session: DevSessionDefinition | null;
  recent: DevSessionSummary[];
  favorites: DevSessionSummary[];
  loading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNew: () => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onRename: (id: string, currentName: string) => Promise<void>;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  onCommitRename: (id: string, name: string) => Promise<void>;
  onCancelRename: () => void;
  onTemplate: (template: DevTemplate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
}

function NavigationRail({
  session,
  recent,
  favorites,
  loading,
  searchValue,
  onSearchChange,
  onNew,
  onOpen,
  onRename,
  renamingId,
  renameValue,
  setRenameValue,
  onCommitRename,
  onCancelRename,
  onTemplate,
  onDelete,
  onToggleFavorite,
}: NavigationRailProps) {
  const templates = useMemo(
    () => templatesForKind(session?.kind ?? "blank"),
    [session?.kind]
  );

  return (
    <nav
      aria-label="DevPilot navigation"
      className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card p-3"
    >
      <Button onClick={onNew} className="w-full gap-1.5" size="sm">
        <FilePlus className="h-4 w-4" aria-hidden="true" />
        New {session?.name ?? "session"}
      </Button>

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Templates
        </p>
        <ul className="mt-2 space-y-1">
          {templates.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No templates yet
            </li>
          ) : (
            templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => void onTemplate(template)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  <FileText
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{template.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {template.hasStarter ? "Ready" : "Coming soon"}
                    </p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent
        </p>
        <div className="relative mt-2">
          <Search
            className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search recent"
            className="h-7 pl-7 text-xs"
            aria-label="Search recent sessions"
          />
        </div>
        <ul className="mt-2 space-y-1">
          {loading ? (
            <li className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Loading
            </li>
          ) : recent.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No recent sessions
            </li>
          ) : (
            recent.map((entry) => (
              <li key={entry.id} className="group">
                {renamingId === entry.id ? (
                  <div className="flex items-center gap-1 px-1">
                    <Input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void onCommitRename(entry.id, renameValue);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          onCancelRename();
                        }
                      }}
                      onBlur={(event) => {
                        const next = event.relatedTarget as HTMLElement | null;
                        if (next && next.closest("[data-rail-control]")) return;
                        if (renameValue.trim()) void onCommitRename(entry.id, renameValue);
                        else onCancelRename();
                      }}
                      className="h-7 text-xs"
                      autoFocus
                      aria-label={`Rename ${entry.title}`}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void onOpen(entry.id)}
                      className="flex flex-1 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                    >
                      <FileText
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-xs font-medium truncate">
                          {entry.isFavorite && (
                            <Star
                              className="h-3 w-3 fill-primary text-primary"
                              aria-label="Favourite"
                            />
                          )}
                          {entry.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void onToggleFavorite(entry.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={entry.isFavorite ? "Unfavourite" : "Favourite"}
                        data-rail-control="favorite"
                      >
                        <Star
                          className={cn(
                            "h-3 w-3",
                            entry.isFavorite && "fill-primary text-primary"
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void onRename(entry.id, entry.title)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={`Rename ${entry.title}`}
                        data-rail-control="rename"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void onDelete(entry.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={`Delete ${entry.title}`}
                        data-rail-control="delete"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      {favorites.length > 0 && (
        <div>
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Favourites
          </p>
          <ul className="mt-2 space-y-1">
            {favorites.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => void onOpen(entry.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  <Star
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-primary text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{entry.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {entry.kind}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tool switcher
        </p>
        <ul className="mt-2 space-y-1">
          {allSessions.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No tools yet
            </li>
          ) : (
            allSessions.map((other) => {
              const isActive = session?.kind === other.kind;
              return (
                <li key={other.kind}>
                  <Link
                    href={sessionHref(other)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent",
                      isActive && "bg-accent"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <FileText
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{other.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {other.tagline}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Other products
        </p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link
              href="/officepilot"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5 -rotate-180" aria-hidden="true" />
              OfficePilot
            </Link>
          </li>
          <li>
            <Link
              href="/socialpilot"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5 -rotate-180" aria-hidden="true" />
              SocialPilot
            </Link>
          </li>
          <li>
            <Link
              href="/financepilot"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5 -rotate-180" aria-hidden="true" />
              FinancePilot
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  session,
  onNew,
  onOpen,
  recent,
  onDelete,
}: {
  session: DevSessionDefinition | null;
  onNew: () => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  recent: DevSessionSummary[];
  onDelete: (id: string) => Promise<void>;
}) {
  const templates = useMemo(
    () => templatesForKind(session?.kind ?? "blank"),
    [session?.kind]
  );

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-3xl space-y-8">
        <Card className="p-8 text-center">
          <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mb-2 text-xl font-semibold">
            {session?.name ?? "DevPilot"}
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-sm text-muted-foreground">
            {session?.intro ??
              "DevPilot is the next LaunchStack product. The reusable developer workspace is live; the first tools ship in the next batch."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => void onNew()} className="gap-1.5">
              <FilePlus className="h-4 w-4" aria-hidden="true" />
              New blank {session?.name?.toLowerCase() ?? "session"}
            </Button>
            {templates.length > 0 && (
              <span className="text-xs text-muted-foreground">
                or pick a template on the left
              </span>
            )}
          </div>
        </Card>

        {recent.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent sessions
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {recent.slice(0, 6).map((entry) => (
                <li key={entry.id}>
                  <Card className="group flex items-center gap-3 p-3 hover:bg-accent">
                    <button
                      type="button"
                      onClick={() => void onOpen(entry.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{entry.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(entry.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(entry.id)}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                      aria-label={`Delete ${entry.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shortcuts dialog                                                           */
/* -------------------------------------------------------------------------- */

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const handle = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(handle);
      window.removeEventListener("keydown", onKeyDown);
      if (previous && typeof previous.focus === "function") {
        previous.focus();
      }
    };
  }, [open, onClose]);
  if (!open) return null;
  const shortcuts: Array<[string, string]> = [
    ["Ctrl/Cmd + S", "Save the active session"],
    ["Ctrl/Cmd + W", "Close the active tab"],
    ["Ctrl/Cmd + D", "Duplicate the active session"],
    ["Ctrl/Cmd + B", "Toggle favourite on the active session"],
    ["?", "Open this dialog"],
    ["Esc", "Cancel a rename or close a dialog"],
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="space-y-2">
          {shortcuts.map(([keys, description]) => (
            <div key={keys} className="flex items-center justify-between gap-3">
              <dt>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-right text-xs text-muted-foreground">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Public shell wrapper                                                       */
/* -------------------------------------------------------------------------- */

export function DevWorkspace(props: DevWorkspaceProps) {
  return (
    <ToastProvider>
      <DevWorkspaceInner {...props} />
    </ToastProvider>
  );
}
