"use client";

/**
 * FinancePilot workspace shell.
 *
 * One reusable Finance application surface that hosts the financial
 * calculators. The shell owns the chrome that is identical across every
 * calculator:
 *
 *  - the top navigation with breadcrumbs, file tabs and the primary actions
 *  - the left navigation rail with the calculator list, new-calculation
 *    menu, recent calculations and the editor switcher
 *  - the right properties panel with kind-specific controls
 *  - the status bar with calculation state, autosave status and metadata
 *  - the shared save / open / rename / duplicate / delete lifecycle
 *  - the shared autosave loop and the shared keyboard shortcut system
 *  - the shared export pipeline (JSON, CSV)
 *
 * The actual calculation surface for each kind is delegated to a child
 * component. The shell is intentionally product-agnostic: a future
 * calculator only has to declare a kind, a Surface and a Properties
 * component and the rest of the workspace keeps working.
 *
 * The shell reuses the per-document autosave pattern proven by
 * OfficePilot so a non-active dirty calculation is still flushed to
 * storage on the same cadence.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  ChevronLeft,
  Download,
  FilePlus,
  FileText,
  Keyboard,
  Loader2,
  Pencil,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast, ToastHost } from "./toast";
import {
  autosaveFinanceCalculation,
  createFinanceCalculation,
  deleteFinanceCalculation,
  duplicateFinanceCalculation,
  getCalculator,
  getCalculatorBySlug,
  listFinanceCalculations,
  openFinanceCalculation,
  renameFinanceCalculation,
  saveFinanceCalculation,
  templatesForKind,
  type FinanceCalculation,
  type FinanceCalculationSummary,
  type FinanceCalculatorDefinition,
  type FinanceCalculatorKind,
  type FinanceTemplate,
} from "@/lib/financepilot";

type SaveState = "saved" | "dirty" | "saving" | "error";

interface FinanceWorkspaceProps {
  /** The calculator kind this shell is hosting. */
  kind: FinanceCalculatorKind;
  /** Calculator surface component for the kind. */
  Surface: React.ComponentType<{
    calculation: FinanceCalculation;
    onChange: (next: FinanceCalculation) => void;
  }>;
  /** Properties panel component for the kind. */
  Properties: React.ComponentType<{ calculation: FinanceCalculation }>;
}

/** Autosave interval in milliseconds. */
const AUTOSAVE_INTERVAL_MS = 1500;

/**
 * Resolves the calculator descriptor for a route.
 *
 * The shell does not know which calculators exist; it asks the registry.
 * If the kind is unknown (a calculator was removed but a tab is still
 * open) we fall back to the first registered calculator so the user does
 * not get stranded on a blank page.
 */
function resolveCalculator(
  kind: FinanceCalculatorKind
): FinanceCalculatorDefinition | undefined {
  return getCalculator(kind) ?? getCalculatorBySlug(kind) ?? getCalculator("blank");
}

export function FinanceWorkspace({
  kind,
  Surface,
  Properties,
}: FinanceWorkspaceProps) {
  const calculator = resolveCalculator(kind) ?? getCalculator(kind);
  const { toast } = useToast();

  // Calculations opened in this session. Most recent is the active one.
  const [openTabs, setOpenTabs] = useState<FinanceCalculation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recent, setRecent] = useState<FinanceCalculationSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Save state, computed from a map of id → SaveState for the open tabs.
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const autosaveTimers = useRef<Map<string, number>>(new Map());
  const openTabsRef = useRef<FinanceCalculation[]>([]);
  const saveStatesRef = useRef<Record<string, SaveState>>({});
  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);
  useEffect(() => {
    saveStatesRef.current = saveStates;
  }, [saveStates]);
  // Drop timer entries for tabs that are no longer open.
  useEffect(() => {
    const openIds = new Set(openTabs.map((calc) => calc.meta.id));
    for (const [id, handle] of autosaveTimers.current) {
      if (!openIds.has(id)) {
        window.clearTimeout(handle);
        autosaveTimers.current.delete(id);
      }
    }
  }, [openTabs]);

  const activeDocument = useMemo(
    () => openTabs.find((calc) => calc.meta.id === activeId) ?? null,
    [openTabs, activeId]
  );
  const activeSaveState: SaveState = activeId
    ? saveStates[activeId] ?? "saved"
    : "saved";

  /** Refreshes the recent-calculations list. */
  const refreshRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const docs = await listFinanceCalculations({ kind: calculator?.kind, limit: 50 });
      setRecent(docs);
    } finally {
      setLoadingRecent(false);
    }
  }, [calculator?.kind]);

  useEffect(() => {
    // Deferred to a task so the effect never writes state synchronously.
    const timer = window.setTimeout(() => void refreshRecent(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshRecent]);

  /** Opens an existing calculation, switching tabs if it is already open. */
  const openDocument = useCallback(
    async (id: string) => {
      if (openTabs.some((calc) => calc.meta.id === id)) {
        setActiveId(id);
        return;
      }
      const calculation = await openFinanceCalculation(id);
      if (!calculation) {
        toast({ message: "That calculation could not be opened.", tone: "error" });
        return;
      }
      setOpenTabs((current) => [...current, calculation]);
      setActiveId(calculation.meta.id);
    },
    [openTabs, toast]
  );

  /** Creates a new blank calculation. */
  const createBlank = useCallback(async () => {
    const target = calculator?.kind ?? "blank";
    const calculation = await createFinanceCalculation(target);
    setOpenTabs((current) => [...current, calculation]);
    setActiveId(calculation.meta.id);
    await refreshRecent();
  }, [calculator?.kind, refreshRecent]);

  /** Creates a new calculation from a template. */
  const createFromTemplate = useCallback(
    async (template: FinanceTemplate) => {
      const calculation = await createFinanceCalculation(
        calculator?.kind ?? "blank",
        { template }
      );
      setOpenTabs((current) => [...current, calculation]);
      setActiveId(calculation.meta.id);
      await refreshRecent();
    },
    [calculator?.kind, refreshRecent]
  );

  /** Updates the active calculation body and marks it dirty. */
  const updateActive = useCallback(
    (next: FinanceCalculation) => {
      setOpenTabs((current) =>
        current.map((calc) => (calc.meta.id === next.meta.id ? next : calc))
      );
      setSaveStates((current) => ({ ...current, [next.meta.id]: "dirty" }));
    },
    []
  );

  /** Saves the active calculation explicitly. */
  const saveActive = useCallback(async () => {
    if (!activeDocument) return;
    setSaveStates((current) => ({
      ...current,
      [activeDocument.meta.id]: "saving",
    }));
    const saved = await saveFinanceCalculation(activeDocument);
    setOpenTabs((current) =>
      current.map((calc) => (calc.meta.id === saved.meta.id ? saved : calc))
    );
    setSaveStates((current) => ({ ...current, [saved.meta.id]: "saved" }));
    await refreshRecent();
  }, [activeDocument, refreshRecent]);

  /**
   * Closes a tab. The browser copy is left intact for later reopening.
   * If the tab is dirty, it is flushed to storage first so the user
   * never loses unsaved work to an accidental close.
   */
  const closeTab = useCallback(
    async (id: string) => {
      // Cancel any pending autosave so the explicit save is the only
      // write in flight for this tab.
      const pending = autosaveTimers.current.get(id);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        autosaveTimers.current.delete(id);
      }
      // Read the live dirty flag from the ref so the keyboard shortcut
      // does not race a stale `saveStates` snapshot.
      const state = saveStatesRef.current[id] ?? "saved";
      const doc = openTabsRef.current.find((c) => c.meta.id === id);
      if (doc && state === "dirty") {
        const saved = await saveFinanceCalculation(doc);
        const persisted =
          saved.meta.autosavedAt && saved.meta.version > doc.meta.version;
        setOpenTabs((current) =>
          current.map((c) => (c.meta.id === saved.meta.id ? saved : c))
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
        const next = current.filter((calc) => calc.meta.id !== id);
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

  /** Renames a calculation. */
  const commitRename = useCallback(
    async (id: string, name: string) => {
      const summary = await renameFinanceCalculation(id, name);
      if (!summary) {
        toast({ message: "Could not rename that calculation.", tone: "error" });
        return;
      }
      setOpenTabs((current) =>
        current.map((calc) =>
          calc.meta.id === id
            ? { ...calc, meta: { ...calc.meta, title: summary.title } }
            : calc
        )
      );
      setRenamingId(null);
      await refreshRecent();
    },
    [refreshRecent, toast]
  );

  /** Duplicates the active calculation and opens the copy. */
  const duplicateActive = useCallback(async () => {
    if (!activeDocument) return;
    const copy = await duplicateFinanceCalculation(activeDocument.meta.id);
    if (!copy) {
      toast({ message: "Could not duplicate that calculation.", tone: "error" });
      return;
    }
    setOpenTabs((current) => [...current, copy]);
    setActiveId(copy.meta.id);
    await refreshRecent();
  }, [activeDocument, refreshRecent, toast]);

  /** Deletes a calculation and closes any open tab pointing at it. */
  const deleteDocument = useCallback(
    async (id: string) => {
      // Cancel any pending autosave so a deleted calculation cannot be
      // resurrected by a stale timer.
      const pending = autosaveTimers.current.get(id);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        autosaveTimers.current.delete(id);
      }
      const ok = await deleteFinanceCalculation(id);
      if (!ok) {
        toast({ message: "Could not delete that calculation.", tone: "error" });
        return;
      }
      let nextActive: string | null = activeId;
      setOpenTabs((current) => {
        const remaining = current.filter((calc) => calc.meta.id !== id);
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

  /**
   * Downloads the active calculation as JSON. The export pipeline
   * intentionally ships with a JSON exporter only; future calculators
   * can register richer exporters (CSV, PDF) without changing the shell.
   */
  const exportActive = useCallback(async () => {
    if (!activeDocument) return;
    const title = activeDocument.meta.title || calculator?.slug || "calculation";
    const safeName = title.replace(/[^\w\-]+/g, "_");
    const json = JSON.stringify(activeDocument, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDocument, calculator?.slug]);

  /**
   * Schedules an autosave for every dirty open calculation. The timer is
   * per-document so a tab the user is not currently looking at is still
   * flushed to storage, and switching tabs does not cancel a save that
   * is already in flight for the previously-active calculation.
   */
  useEffect(() => {
    for (const calc of openTabs) {
      const state = saveStates[calc.meta.id] ?? "saved";
      if (state !== "dirty") {
        const pending = autosaveTimers.current.get(calc.meta.id);
        if (pending !== undefined) {
          window.clearTimeout(pending);
          autosaveTimers.current.delete(calc.meta.id);
        }
        continue;
      }
      if (autosaveTimers.current.has(calc.meta.id)) continue;
      const documentId = calc.meta.id;
      const handle = window.setTimeout(async () => {
        autosaveTimers.current.delete(documentId);
        const latest = openTabsRef.current.find((c) => c.meta.id === documentId);
        if (!latest) return;
        if (saveStatesRef.current[documentId] !== "dirty") return;
        setSaveStates((current) => ({ ...current, [documentId]: "saving" }));
        const saved = await autosaveFinanceCalculation(latest);
        setOpenTabs((current) =>
          current.map((c) => (c.meta.id === saved.meta.id ? saved : c))
        );
        setSaveStates((current) => {
          const latestNow = openTabsRef.current.find((c) => c.meta.id === documentId);
          const nextState: SaveState =
            latestNow && JSON.stringify(latestNow.body) !== JSON.stringify(saved.body)
              ? "dirty"
              : "saved";
          return { ...current, [saved.meta.id]: nextState };
        });
      }, AUTOSAVE_INTERVAL_MS);
      autosaveTimers.current.set(documentId, handle);
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

  /**
   * Browser-level guard: if the user closes the tab while a calculation
   * is dirty, the browser asks for confirmation. The autosave loop keeps
   * running so the local IndexedDB copy is up to date, but a hard
   * close before the timer fires would otherwise lose work.
   */
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

  /** Keyboard shortcuts: Ctrl/Cmd+S to save, Ctrl/Cmd+W to close tab, ? for help. */
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
        duplicateActive();
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
  }, [activeId, closeTab, duplicateActive, saveActive]);

  const filteredRecent = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return recent;
    return recent.filter((entry) => entry.title.toLowerCase().includes(term));
  }, [recent, searchValue]);

  // The shell renders the calculator name as the header title. When
  // no calculator is registered yet (the foundation state), fall back
  // to a generic title so the chrome is still meaningful.
  const headerTitle = calculator?.name ?? "FinancePilot";

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[480px] flex-col">
      {/* ---------------------------------------------------------------- */}
      {/* Top navigation                                                   */}
      {/* ---------------------------------------------------------------- */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2">
        <Link
          href="/products/financepilot"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to FinancePilot"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">FinancePilot</span>
        </Link>
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <span className="text-sm font-medium">{headerTitle}</span>

        <div className="ml-3 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {openTabs.length === 0 ? (
            <span className="text-xs text-muted-foreground">No calculations open</span>
          ) : (
            openTabs.map((calc) => {
              const isActive = calc.meta.id === activeId;
              const state = saveStates[calc.meta.id] ?? "saved";
              return (
                <div
                  key={calc.meta.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                    isActive
                      ? "border-foreground/30 bg-background"
                      : "border-transparent hover:bg-accent"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(calc.meta.id)}
                    className="flex items-center gap-1.5"
                  >
                    {renamingId === calc.meta.id ? (
                      <Input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitRename(calc.meta.id, renameValue);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                        onBlur={(event) => {
                          const next = event.relatedTarget as HTMLElement | null;
                          if (next && next.closest("[data-tab-control]")) return;
                          if (renameValue.trim()) void commitRename(calc.meta.id, renameValue);
                          else setRenamingId(null);
                        }}
                        className="h-6 w-40 text-xs"
                        autoFocus
                        aria-label={`Rename ${calc.meta.title}`}
                      />
                    ) : (
                      <>
                        <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="max-w-[160px] truncate">{calc.meta.title}</span>
                        {state === "dirty" && <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-label="Unsaved changes" />}
                        {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" aria-label="Saving" />}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => closeTab(calc.meta.id)}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    aria-label={`Close ${calc.meta.title}`}
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
            disabled={!activeDocument || activeSaveState === "saving"}
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
            disabled={!activeDocument}
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

      {/* ---------------------------------------------------------------- */}
      {/* Body: navigation rail | calculator surface | properties panel     */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        <NavigationRail
          calculator={calculator ?? null}
          recent={filteredRecent}
          loading={loadingRecent}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onNew={createBlank}
          onOpen={openDocument}
          onRename={async (id, name) => {
            setRenamingId(id);
            setRenameValue(name);
            const target = openTabs.find((c) => c.meta.id === id);
            if (target) setActiveId(id);
          }}
          renamingId={renamingId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onCommitRename={commitRename}
          onCancelRename={() => setRenamingId(null)}
          onTemplate={createFromTemplate}
          onDelete={deleteDocument}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {activeDocument ? (
            <Surface calculation={activeDocument} onChange={updateActive} />
          ) : (
            <EmptyState
              calculator={calculator ?? null}
              onNew={createBlank}
              onOpen={openDocument}
              recent={filteredRecent}
              onDelete={deleteDocument}
            />
          )}
        </main>

        <aside
          aria-label="Properties"
          className="hidden w-72 shrink-0 flex-col border-l border-border bg-card xl:flex"
        >
          {activeDocument ? (
            <Properties calculation={activeDocument} />
          ) : (
            <div className="p-5 text-sm text-muted-foreground">
              Open a calculation to see its properties here.
            </div>
          )}
        </aside>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Status bar                                                       */}
      {/* ---------------------------------------------------------------- */}
      <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {activeDocument
            ? `${activeDocument.meta.kind} · v${activeDocument.meta.version}`
            : "No calculation"}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {activeDocument
            ? `${Math.max(1, Math.round(activeDocument.meta.size / 1024))} KB`
            : "—"}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {activeSaveState === "saved" && activeDocument
            ? `Saved ${activeDocument.meta.autosavedAt ? new Date(activeDocument.meta.autosavedAt).toLocaleTimeString() : ""}`
            : activeSaveState === "dirty"
              ? "Unsaved changes"
              : activeSaveState === "saving"
                ? "Saving…"
                : "Ready"}
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

interface NavigationRailProps {
  calculator: FinanceCalculatorDefinition | null;
  recent: FinanceCalculationSummary[];
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
  onTemplate: (template: FinanceTemplate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function NavigationRail({
  calculator,
  recent,
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
}: NavigationRailProps) {
  const templates = useMemo(
    () => templatesForKind(calculator?.kind ?? "blank"),
    [calculator?.kind]
  );

  return (
    <nav
      aria-label="FinancePilot navigation"
      className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card p-3"
    >
      <Button onClick={onNew} className="w-full gap-1.5" size="sm">
        <FilePlus className="h-4 w-4" aria-hidden="true" />
        New {calculator?.name ?? "calculation"}
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
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search recent"
            className="h-7 pl-7 text-xs"
            aria-label="Search recent calculations"
          />
        </div>
        <ul className="mt-2 space-y-1">
          {loading ? (
            <li className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Loading
            </li>
          ) : recent.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No recent calculations
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
                      <Calculator className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{entry.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li className="px-2 py-1">
            The category shortcuts for each calculator land here once a
            first calculator is registered.
          </li>
        </ul>
      </div>

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Coming soon
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
        </ul>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  calculator,
  onNew,
  onOpen,
  recent,
  onDelete,
}: {
  calculator: FinanceCalculatorDefinition | null;
  onNew: () => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  recent: FinanceCalculationSummary[];
  onDelete: (id: string) => Promise<void>;
}) {
  const templates = useMemo(
    () => templatesForKind(calculator?.kind ?? "blank"),
    [calculator?.kind]
  );

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-3xl space-y-8">
        <Card className="p-8 text-center">
          <Calculator className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mb-2 text-xl font-semibold">
            {calculator?.name ?? "FinancePilot"}
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-sm text-muted-foreground">
            {calculator?.intro ??
              "FinancePilot is the next LaunchStack product. The reusable workspace is live; the first calculators ship in the next batch."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => void onNew()} className="gap-1.5">
              <FilePlus className="h-4 w-4" aria-hidden="true" />
              New blank {calculator?.name?.toLowerCase() ?? "calculation"}
            </Button>
            {templates.length > 0 && (
              <span className="text-xs text-muted-foreground">or pick a template on the left</span>
            )}
          </div>
        </Card>

        {recent.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent calculations
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
                      <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
    ["Ctrl/Cmd + S", "Save the active calculation"],
    ["Ctrl/Cmd + W", "Close the active tab"],
    ["Ctrl/Cmd + D", "Duplicate the active calculation"],
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
