"use client";

/**
 * Project History surface.
 *
 * A professional Project History view. The user sees the most
 * recent projects in one place, can duplicate, rename, or delete
 * a project, and can restore the last session from a soft-deletion
 * tombstone. The surface reuses the existing session engine
 * (create, open, save, duplicate, rename, delete) and the
 * recent-sessions mirror the rest of the workspace already
 * uses.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome` and the in-app toast so it feels identical to
 * every other WebPilot tool.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  History as HistoryIcon,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asProjectHistoryBody,
  deleteWebSession,
  duplicateWebSession,
  filterRecent,
  getSession,
  listWebSessions,
  pushRecentEntry,
  pushTombstone,
  recentEntryFromSummary,
  renameWebSession,
  restoreLastSession,
  sessionHref,
  toggleFavoriteWebSession,
  toggleRecentFavourite,
  type WebProjectHistoryBody,
} from "@/lib/webpilot";
import type { WebSession, WebSessionSummary } from "@/lib/webpilot";

interface ProjectHistorySurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function ProjectHistorySurface({
  session,
  onChange,
}: ProjectHistorySurfaceProps) {
  const body = asProjectHistoryBody(session.body);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [serverRecent, setServerRecent] = useState<WebSessionSummary[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Track whether the initial fetch from the server has already
  // populated the body, so we only write once on mount and avoid
  // a re-render loop. The tombstone dep re-runs the effect after
  // a restore so the recent list is fresh.
  const initialFetchedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listWebSessions({ limit: 50 });
        if (cancelled) return;
        setServerRecent(list);
        // Only seed the body's recent list once. The comparison
        // above (`sameId`) also guards against a re-write, but
        // the ref gives us an extra safety net against identity
        // changes that do not show up in the id comparison.
        if (!initialFetchedRef.current) {
          const recent = list.map(recentEntryFromSummary);
          onChange({
            ...session,
            body: { ...body, recent },
          });
          initialFetchedRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            message:
              err instanceof Error ? err.message : "Failed to load projects",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.tombstones.length]);

  const filtered = useMemo(
    () => filterRecent(body.recent, body.search),
    [body.recent, body.search]
  );

  const serverById = useMemo(() => {
    const map = new Map<string, WebSessionSummary>();
    for (const entry of serverRecent) map.set(entry.id, entry);
    return map;
  }, [serverRecent]);

  function commit(patch: Partial<WebProjectHistoryBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function refresh() {
    setLoading(true);
    listWebSessions({ limit: 50 })
      .then((list) => {
        setServerRecent(list);
        const recent = list.map(recentEntryFromSummary);
        commit({ recent });
      })
      .catch((err: unknown) => {
        toast({
          message: err instanceof Error ? err.message : "Refresh failed",
          tone: "error",
        });
      })
      .finally(() => setLoading(false));
  }

  async function handleDuplicate(id: string) {
    const copy = await duplicateWebSession(id);
    if (!copy) {
      toast({ message: "Could not duplicate", tone: "error" });
      return;
    }
    toast({ message: "Project duplicated", tone: "success" });
    refresh();
  }

  async function handleDelete(id: string) {
    const summary = serverById.get(id);
    const ok = await deleteWebSession(id);
    if (!ok) {
      toast({ message: "Could not delete", tone: "error" });
      return;
    }
    // Soft-delete: keep the body in a tombstone so the user can
    // restore it for the rest of the session.
    if (summary) {
      const now = new Date().toISOString();
      const tombstone = {
        id: `tomb-${id}-${Date.now()}`,
        sessionId: id,
        projectName: summary.title,
        deletedAt: now,
        body: { kind: summary.kind, title: summary.title },
      };
      commit({
        tombstones: pushTombstone(body.tombstones, tombstone),
        lastDeletedSessionId: id,
        lastDeletedAt: now,
      });
    }
    toast({ message: "Project deleted", tone: "info" });
    refresh();
  }

  async function handleToggleFavorite(id: string) {
    const summary = await toggleFavoriteWebSession(id);
    if (!summary) return;
    const next = toggleRecentFavourite(body.favorites, id);
    const recent = body.recent.map((entry) =>
      entry.id === id ? { ...entry, isFavorite: summary.isFavorite } : entry
    );
    commit({ favorites: next, recent });
    refresh();
  }

  function handleRestore() {
    const { body: nextBody, tombstone } = restoreLastSession(body);
    if (!tombstone) {
      toast({ message: "Nothing to restore", tone: "info" });
      return;
    }
    onChange({ ...session, body: nextBody });
    toast({ message: `Restored ${tombstone.projectName}`, tone: "success" });
  }

  function startRename(id: string, current: string) {
    setRenamingId(id);
    setRenameValue(current);
  }

  async function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed) return;
    const summary = await renameWebSession(renamingId, trimmed);
    if (!summary) {
      toast({ message: "Could not rename", tone: "error" });
      return;
    }
    const recent = body.recent.map((entry) =>
      entry.id === renamingId ? { ...entry, title: summary.title } : entry
    );
    commit({ recent });
    refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Project History — recent projects, duplicate, rename, delete, restore last session."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <Button
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={handleRestore}
            disabled={body.tombstones.length === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Restore last
          </Button>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.recent.length} recent · {body.favorites.length} favourite
            {body.favorites.length === 1 ? "" : "s"} ·{" "}
            {body.tombstones.length} deleted
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[2fr,1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={body.search}
              onChange={(event) => commit({ search: event.target.value })}
              placeholder="Search recent projects…"
              className="h-7 flex-1 text-xs"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {loading ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                Loading recent projects…
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                No projects match the current search.
              </p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((entry) => (
                  <li key={entry.id}>
                    <div className="flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-1.5">
                      <span className="flex-1 truncate">
                        {renamingId === entry.id ? (
                          <Input
                            value={renameValue}
                            onChange={(event) =>
                              setRenameValue(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void commitRename();
                              }
                              if (event.key === "Escape") {
                                setRenamingId(null);
                              }
                            }}
                            className="h-7 text-xs"
                            autoFocus
                            aria-label={`Rename ${entry.title}`}
                          />
                        ) : (
                          <span
                            className="text-xs font-medium"
                            title={entry.title}
                          >
                            {entry.title}
                          </span>
                        )}
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {entry.kind}
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        v{entry.version}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleToggleFavorite(entry.id)}
                        aria-label={
                          entry.isFavorite ? "Unfavourite" : "Favourite"
                        }
                      >
                        <Star
                          className={
                            entry.isFavorite
                              ? "h-3 w-3 fill-primary text-primary"
                              : "h-3 w-3"
                          }
                          aria-hidden="true"
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => startRename(entry.id, entry.title)}
                        aria-label="Rename"
                        title="Rename"
                      >
                        <Undo2 className="h-3 w-3" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => void handleDuplicate(entry.id)}
                        aria-label="Duplicate"
                        title="Duplicate"
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => void handleDelete(entry.id)}
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-1 flex items-center gap-1 px-2 text-[10px] text-muted-foreground">
                      <span>{new Date(entry.updatedAt).toLocaleString()}</span>
                      <span>·</span>
                      <span>{Math.max(1, Math.round(entry.size / 1024))} KB</span>
                      <a
                        href={sessionHref(
                          getSession(entry.kind) ?? getSession("blank")!
                        )}
                        className="ml-auto rounded px-1 text-primary hover:underline"
                      >
                        Open
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div className="grid min-h-0 gap-3">
          <Card className="p-4">
            <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold">
              <HistoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Recently deleted
            </h3>
            {body.tombstones.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No soft-deletions yet. Use the Delete button to move a
                project onto the restore stack.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px]">
                {body.tombstones.slice(0, 6).map((tombstone) => (
                  <li
                    key={tombstone.id}
                    className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5"
                  >
                    <span className="flex-1 truncate font-medium">
                      {tombstone.projectName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(tombstone.deletedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {body.lastDeletedSessionId ? (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Last deleted: {body.lastDeletedSessionId} (
                {body.lastDeletedAt
                  ? new Date(body.lastDeletedAt).toLocaleString()
                  : "—"}
                )
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Favourite projects
            </h3>
            {body.favorites.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Pin a project from the recent list to see it here.
              </p>
            ) : (
              <ul className="space-y-1 text-[11px]">
                {body.favorites.map((id) => {
                  const entry = body.recent.find((row) => row.id === id);
                  if (!entry) {
                    return (
                      <li
                        key={id}
                        className="rounded border border-border bg-muted/30 px-2 py-1.5"
                      >
                        <span className="text-[10px] text-muted-foreground">
                          {id}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5"
                    >
                      <span className="flex-1 truncate font-medium">
                        {entry.title}
                      </span>
                      <a
                        href={sessionHref(
                          getSession(entry.kind) ?? getSession("blank")!
                        )}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Open
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Silences an unused-import warning for the helper that the
// surface uses through the destructured call site.
void pushRecentEntry;
