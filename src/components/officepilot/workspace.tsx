"use client";

/**
 * OfficePilot workspace shell.
 *
 * One reusable Office application surface that hosts the Word, Spreadsheet
 * and Presentation editors. The shell owns the chrome that is identical
 * across all three editors:
 *
 *  - the top navigation with breadcrumbs, file tabs and the primary actions
 *  - the left navigation rail with the file list, new-document menu and
 *    editor switcher
 *  - the right properties panel with kind-specific controls
 *  - the status bar with document state, autosave status and zoom
 *  - the shared save / open / rename / duplicate / delete lifecycle
 *  - the shared autosave loop and the shared keyboard shortcut system
 *
 * The actual editing surface for each kind is delegated to a child
 * component. The shell is intentionally product-agnostic: a future editor
 * (e.g. "diagram" or "form") only has to declare a kind, a child component
 * and a properties panel and the rest of the workspace keeps working.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  Download,
  FilePlus,
  FileText,
  Folder,
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
  autosaveOfficeDocument,
  createOfficeDocument,
  deleteOfficeDocument,
  duplicateOfficeDocument,
  editors,
  getEditor,
  listOfficeDocuments,
  openOfficeDocument,
  renameOfficeDocument,
  saveOfficeDocument,
  templatesForKind,
} from "@/lib/officepilot";
import type {
  OfficeDocument,
  OfficeDocumentSummary,
  OfficeEditorDefinition,
  OfficeEditorKind,
  OfficeTemplate,
} from "@/lib/officepilot";

type SaveState = "saved" | "dirty" | "saving" | "error";

interface OfficeWorkspaceProps {
  /** The editor kind this shell is hosting. */
  kind: OfficeEditorKind;
  /** Editor surface component for the kind. */
  Surface: React.ComponentType<{
    document: OfficeDocument;
    onChange: (next: OfficeDocument) => void;
  }>;
  /** Properties panel component for the kind. */
  Properties: React.ComponentType<{ document: OfficeDocument }>;
}

/** Autosave interval in milliseconds. */
const AUTOSAVE_INTERVAL_MS = 1500;

export function OfficeWorkspace({ kind, Surface, Properties }: OfficeWorkspaceProps) {
  const editor = getEditor(kind);
  const { toast } = useToast();

  // Documents opened in this session. Most recent is the active one.
  const [openTabs, setOpenTabs] = useState<OfficeDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recent, setRecent] = useState<OfficeDocumentSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Save state, computed from a map of id → SaveState for the open tabs.
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const autosaveTimer = useRef<number | null>(null);
  const openTabsRef = useRef<OfficeDocument[]>([]);
  const saveStatesRef = useRef<Record<string, SaveState>>({});
  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);
  useEffect(() => {
    saveStatesRef.current = saveStates;
  }, [saveStates]);

  const activeDocument = useMemo(
    () => openTabs.find((doc) => doc.meta.id === activeId) ?? null,
    [openTabs, activeId]
  );
  const activeSaveState: SaveState = activeId ? saveStates[activeId] ?? "saved" : "saved";

  /** Refreshes the recent-documents list. */
  const refreshRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const docs = await listOfficeDocuments({ kind: editor.kind, limit: 50 });
      setRecent(docs);
    } finally {
      setLoadingRecent(false);
    }
  }, [editor.kind]);

  useEffect(() => {
    // Deferred to a task so the effect never writes state synchronously.
    const timer = window.setTimeout(() => void refreshRecent(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshRecent]);

  /** Opens an existing document, switching tabs if it is already open. */
  const openDocument = useCallback(
    async (id: string) => {
      if (openTabs.some((doc) => doc.meta.id === id)) {
        setActiveId(id);
        return;
      }
      const document = await openOfficeDocument(id);
      if (!document) {
        toast({ message: "That document could not be opened.", tone: "error" });
        return;
      }
      setOpenTabs((current) => [...current, document]);
      setActiveId(document.meta.id);
    },
    [openTabs, toast]
  );

  /** Creates a new blank document. */
  const createBlank = useCallback(async () => {
    const document = await createOfficeDocument(editor.kind);
    setOpenTabs((current) => [...current, document]);
    setActiveId(document.meta.id);
    await refreshRecent();
  }, [editor.kind, refreshRecent]);

  /** Creates a new document from a template. */
  const createFromTemplate = useCallback(
    async (template: OfficeTemplate) => {
      const document = await createOfficeDocument(editor.kind, { template });
      setOpenTabs((current) => [...current, document]);
      setActiveId(document.meta.id);
      await refreshRecent();
    },
    [editor.kind, refreshRecent]
  );

  /** Updates the active document body and marks it dirty. */
  const updateActive = useCallback(
    (next: OfficeDocument) => {
      setOpenTabs((current) =>
        current.map((doc) => (doc.meta.id === next.meta.id ? next : doc))
      );
      setSaveStates((current) => ({ ...current, [next.meta.id]: "dirty" }));
    },
    []
  );

  /** Saves the active document explicitly. */
  const saveActive = useCallback(async () => {
    if (!activeDocument) return;
    setSaveStates((current) => ({ ...current, [activeDocument.meta.id]: "saving" }));
    const saved = await saveOfficeDocument(activeDocument);
    setOpenTabs((current) =>
      current.map((doc) => (doc.meta.id === saved.meta.id ? saved : doc))
    );
    setSaveStates((current) => ({ ...current, [saved.meta.id]: "saved" }));
    await refreshRecent();
  }, [activeDocument, refreshRecent]);

  /** Closes a tab. The browser copy is left intact for later reopening. */
  const closeTab = useCallback(
    (id: string) => {
      let nextActive: string | null = activeId;
      setOpenTabs((current) => {
        const next = current.filter((doc) => doc.meta.id !== id);
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
    [activeId]
  );

  /** Renames a document. */
  const commitRename = useCallback(
    async (id: string, name: string) => {
      const summary = await renameOfficeDocument(id, name);
      if (!summary) {
        toast({ message: "Could not rename that document.", tone: "error" });
        return;
      }
      setOpenTabs((current) =>
        current.map((doc) =>
          doc.meta.id === id ? { ...doc, meta: { ...doc.meta, title: summary.title } } : doc
        )
      );
      setRenamingId(null);
      await refreshRecent();
    },
    [refreshRecent, toast]
  );

  /** Duplicates a document and opens the copy. */
  const duplicateActive = useCallback(async () => {
    if (!activeDocument) return;
    const copy = await duplicateOfficeDocument(activeDocument.meta.id);
    if (!copy) {
      toast({ message: "Could not duplicate that document.", tone: "error" });
      return;
    }
    setOpenTabs((current) => [...current, copy]);
    setActiveId(copy.meta.id);
    await refreshRecent();
  }, [activeDocument, refreshRecent, toast]);

  /** Deletes a document and closes any open tab pointing at it. */
  const deleteDocument = useCallback(
    async (id: string) => {
      const ok = await deleteOfficeDocument(id);
      if (!ok) {
        toast({ message: "Could not delete that document.", tone: "error" });
        return;
      }
      let nextActive: string | null = activeId;
      setOpenTabs((current) => {
        const remaining = current.filter((doc) => doc.meta.id !== id);
        if (id === activeId) {
          nextActive = remaining.length ? remaining[remaining.length - 1]!.meta.id : null;
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

  /** Downloads the active document in its native format. */
  const exportActive = useCallback(async () => {
    if (!activeDocument) return;
    const title = activeDocument.meta.title || editor.slug;
    const safeName = title.replace(/[^\w\-]+/g, "_");
    let blob: Blob | null = null;
    let extension = "json";
    try {
      if (activeDocument.meta.kind === "word" && activeDocument.body && typeof activeDocument.body === "object" && (activeDocument.body as { format?: string }).format === "word") {
        const { exportWordToDocx } = await import("@/lib/officepilot/word/exporters");
        const { asWordBody } = await import("@/lib/officepilot/word/schema");
        const body = asWordBody(activeDocument.body);
        blob = await exportWordToDocx(body, { title });
        extension = "docx";
      } else if (activeDocument.meta.kind === "spreadsheet") {
        const { exportSheetToXlsx } = await import("@/lib/officepilot/spreadsheet/xlsx-export");
        const { asSheetBody } = await import("@/lib/officepilot/spreadsheet/schema");
        const { evaluateBody } = await import("@/lib/officepilot/spreadsheet/formulas");
        const body = asSheetBody(activeDocument.body);
        const evaluated = evaluateBody(body);
        blob = await exportSheetToXlsx(evaluated, { title });
        extension = "xlsx";
      } else if (activeDocument.meta.kind === "presentation") {
        const { exportPresentationToPptx } = await import("@/lib/officepilot/presentation/pptx-export");
        const { asPresentationBody } = await import("@/lib/officepilot/presentation/schema");
        const body = asPresentationBody(activeDocument.body);
        blob = await exportPresentationToPptx(body, { title });
        extension = "pptx";
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast({ message: "Could not export that document.", tone: "error" });
      return;
    }
    if (!blob) {
      // Fallback: export the raw JSON.
      const json = JSON.stringify(activeDocument, null, 2);
      blob = new Blob([json], { type: "application/json" });
      extension = "json";
    }
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${safeName}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDocument, editor.slug, toast]);

  /** Schedules an autosave for the active document. */
  useEffect(() => {
    if (!activeDocument || activeSaveState !== "dirty") return;
    const documentId = activeDocument.meta.id;
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(async () => {
      // Read the current document at fire time so we never overwrite
      // a newer edit that landed after the timer was scheduled.
      const latest = openTabsRef.current.find((doc) => doc.meta.id === documentId);
      if (!latest) return;
      if (saveStatesRef.current[documentId] !== "dirty") return;
      setSaveStates((current) => ({ ...current, [documentId]: "saving" }));
      const saved = await autosaveOfficeDocument(latest);
      setOpenTabs((current) =>
        current.map((doc) => (doc.meta.id === saved.meta.id ? saved : doc))
      );
      setSaveStates((current) => {
        // If the user kept editing during the save, go back to dirty so
        // the next round of edits gets saved again.
        const latestNow = openTabsRef.current.find((doc) => doc.meta.id === documentId);
        const nextState: SaveState =
          latestNow && JSON.stringify(latestNow.body) !== JSON.stringify(saved.body)
            ? "dirty"
            : "saved";
        return { ...current, [saved.meta.id]: nextState };
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [activeDocument, activeSaveState]);

  /** Keyboard shortcuts: Ctrl/Cmd+S to save, Ctrl/Cmd+W to close tab, ? for help. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true'], [role='textbox']")) {
        if (event.key === "Escape") target.blur();
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActive();
        return;
      }
      if (mod && event.key.toLowerCase() === "w" && activeId) {
        event.preventDefault();
        closeTab(activeId);
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
  }, [activeId, closeTab, saveActive]);

  const filteredRecent = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return recent;
    return recent.filter((entry) => entry.title.toLowerCase().includes(term));
  }, [recent, searchValue]);

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[480px] flex-col">
      {/* ---------------------------------------------------------------- */}
      {/* Top navigation                                                   */}
      {/* ---------------------------------------------------------------- */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2">
        <Link
          href="/products/officepilot"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to OfficePilot"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">OfficePilot</span>
        </Link>
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <span className="text-sm font-medium">{editor.name}</span>

        <div className="ml-3 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {openTabs.length === 0 ? (
            <span className="text-xs text-muted-foreground">No documents open</span>
          ) : (
            openTabs.map((doc) => {
              const isActive = doc.meta.id === activeId;
              const state = saveStates[doc.meta.id] ?? "saved";
              return (
                <div
                  key={doc.meta.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                    isActive
                      ? "border-foreground/30 bg-background"
                      : "border-transparent hover:bg-accent"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(doc.meta.id)}
                    className="flex items-center gap-1.5"
                  >
                    {renamingId === doc.meta.id ? (
                      <Input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitRename(doc.meta.id, renameValue);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                        onBlur={(event) => {
                          // Avoid committing if focus moved to a clickable
                          // sibling that hasn't yet stolen the focus.
                          const next = event.relatedTarget as HTMLElement | null;
                          if (next && next.closest("[data-tab-control]")) return;
                          if (renameValue.trim()) void commitRename(doc.meta.id, renameValue);
                          else setRenamingId(null);
                        }}
                        className="h-6 w-40 text-xs"
                        autoFocus
                        aria-label={`Rename ${doc.meta.title}`}
                      />
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="max-w-[160px] truncate">{doc.meta.title}</span>
                        {state === "dirty" && <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-label="Unsaved changes" />}
                        {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" aria-label="Saving" />}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => closeTab(doc.meta.id)}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    aria-label={`Close ${doc.meta.title}`}
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
      {/* Body: navigation rail | editor surface | properties panel       */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        <NavigationRail
          editor={editor}
          recent={filteredRecent}
          loading={loadingRecent}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onNew={createBlank}
          onOpen={openDocument}
          onRename={async (id, name) => {
            setRenamingId(id);
            setRenameValue(name);
            const target = openTabs.find((d) => d.meta.id === id);
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
            <Surface document={activeDocument} onChange={updateActive} />
          ) : (
            <EmptyState editor={editor} onNew={createBlank} onOpen={openDocument} recent={filteredRecent} onDelete={deleteDocument} />
          )}
        </main>

        <aside
          aria-label="Properties"
          className="hidden w-72 shrink-0 flex-col border-l border-border bg-card xl:flex"
        >
          {activeDocument ? (
            <Properties document={activeDocument} />
          ) : (
            <div className="p-5 text-sm text-muted-foreground">
              Open a document to see its properties here.
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
            : "No document"}
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
  editor: OfficeEditorDefinition;
  recent: OfficeDocumentSummary[];
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
  onTemplate: (template: OfficeTemplate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function NavigationRail({
  editor,
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
  const templates = useMemo(() => templatesForKind(editor.kind), [editor.kind]);
  const otherEditors = useMemo(
    () => editors.filter((e) => e.kind !== editor.kind),
    [editor.kind]
  );

  return (
    <nav
      aria-label="OfficePilot navigation"
      className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card p-3"
    >
      <Button onClick={onNew} className="w-full gap-1.5" size="sm">
        <FilePlus className="h-4 w-4" aria-hidden="true" />
        New {editor.name.replace(" Editor", "")}
      </Button>

      <div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Templates
        </p>
        <ul className="mt-2 space-y-1">
          {templates.map((template) => (
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
          ))}
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
            aria-label="Search recent documents"
          />
        </div>
        <ul className="mt-2 space-y-1">
          {loading ? (
            <li className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Loading
            </li>
          ) : recent.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No recent documents
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
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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
          Switch editor
        </p>
        <ul className="mt-2 space-y-1">
          {otherEditors.map((other) => (
            <li key={other.kind}>
              <Link
                href={other.kind === "word" ? "/officepilot" : `/officepilot/${other.kind}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5 -rotate-180" aria-hidden="true" />
                {other.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  editor,
  onNew,
  onOpen,
  recent,
  onDelete,
}: {
  editor: OfficeEditorDefinition;
  onNew: () => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  recent: OfficeDocumentSummary[];
  onDelete: (id: string) => Promise<void>;
}) {
  const templates = useMemo(() => templatesForKind(editor.kind), [editor.kind]);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-3xl space-y-8">
        <Card className="p-8 text-center">
          <Folder className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mb-2 text-xl font-semibold">{editor.name}</h2>
          <p className="mx-auto mb-6 max-w-lg text-sm text-muted-foreground">
            {editor.intro}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => void onNew()} className="gap-1.5">
              <FilePlus className="h-4 w-4" aria-hidden="true" />
              New blank {editor.name.replace(" Editor", "").toLowerCase()}
            </Button>
            {templates.length > 0 && (
              <span className="text-xs text-muted-foreground">or pick a template on the left</span>
            )}
          </div>
        </Card>

        {recent.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent in {editor.name.replace(" Editor", "")}
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
  if (!open) return null;
  const shortcuts: Array<[string, string]> = [
    ["Ctrl/Cmd + S", "Save the active document"],
    ["Ctrl/Cmd + W", "Close the active tab"],
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
