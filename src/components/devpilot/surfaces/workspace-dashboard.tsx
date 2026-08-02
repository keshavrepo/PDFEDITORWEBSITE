"use client";

/**
 * Workspace Dashboard — Batch 1 surface.
 *
 * A one-page summary of the user's DevPilot workspace: recent
 * sessions, recent and favourite history, the active snippet
 * library, a per-tool history summary, and quick links to every
 * other DevPilot surface.
 *
 * Mirrors /components/socialpilot/surfaces/workspace-dashboard.tsx.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Code2,
  FileText,
  History as HistoryIcon,
  Star,
  Terminal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import {
  asSnippetBody,
  getSession,
  listDevSessions,
  openDevSession,
  sessionHref,
  type DevSession,
  type DevSessionSummary,
} from "@/lib/devpilot";

interface WorkspaceDashboardProps {
  session: DevSession;
}

interface FavouriteHistoryRow {
  id: string;
  toolName: string;
  updatedAt: string;
}

interface FavouriteSnippetSummary {
  id: string;
  title: string;
  text: string;
  language: string;
}

export function WorkspaceDashboard({ session }: WorkspaceDashboardProps) {
  const { toast } = useToast();
  const [recent, setRecent] = useState<DevSessionSummary[]>([]);
  const [recentHistory, setRecentHistory] = useState<DevSessionSummary[]>([]);
  const [favouriteHistory, setFavouriteHistory] = useState<FavouriteHistoryRow[]>([]);
  const [favouriteSnippets, setFavouriteSnippets] = useState<FavouriteSnippetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessions, historyRes, snippetSessions] = await Promise.all([
          listDevSessions({ limit: 8 }),
          fetch("/api/devpilot/history?limit=12"),
          listDevSessions({ kind: "snippet", limit: 50 }),
        ]);
        if (cancelled) return;
        setRecent(sessions);

        const historyData = (await historyRes
          .json()
          .catch(() => ({ history: [] }))) as {
          history: { id: string; toolName: string; updatedAt: string; isFavorite: boolean }[];
        };
        const allHistory = historyData.history ?? [];
        setRecentHistory(
          allHistory.map((row) => ({
            id: row.id,
            kind: "history",
            title: row.toolName,
            category: "history",
            updatedAt: row.updatedAt,
            autosavedAt: row.updatedAt,
            version: 1,
            size: 0,
            isFavorite: row.isFavorite,
          }))
        );
        setFavouriteHistory(
          allHistory
            .filter((row) => row.isFavorite)
            .map((row) => ({
              id: row.id,
              toolName: row.toolName,
              updatedAt: row.updatedAt,
            }))
        );

        // Favourite snippets: read the body through the engine, which
        // reads from IndexedDB.
        const favs: FavouriteSnippetSummary[] = [];
        for (const summary of snippetSessions) {
          const opened = await openDevSession(summary.id);
          if (!opened) continue;
          const body = asSnippetBody(opened.body);
          if (body.isFavorite) {
            favs.push({
              id: opened.meta.id,
              title: opened.meta.title,
              text: body.text,
              language: body.language,
            });
          }
        }
        if (cancelled) return;
        setFavouriteSnippets(favs);
      } catch (err) {
        if (!cancelled) {
          toast({
            message: err instanceof Error ? err.message : "Dashboard failed",
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
  }, [toast]);

  const sessionDef = getSession("dashboard");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">{sessionDef?.name ?? "DevPilot"}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {sessionDef?.description ??
            "DevPilot is the next LaunchStack product. Batch 1 ships the foundation: a reusable developer workspace that future tools will plug into."}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <RecentSessionsCard loading={loading} recent={recent} />
        <RecentHistoryCard loading={loading} recent={recentHistory} />
        <FavouriteHistoryCard loading={loading} entries={favouriteHistory} />
        <FavouriteSnippetsCard loading={loading} snippets={favouriteSnippets} />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Quick links</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/devpilot/snippets"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Developer snippets
            </Link>
          </li>
          <li>
            <Link
              href="/devpilot/history"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <HistoryIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Developer history
            </Link>
          </li>
          <li>
            <Link
              href="/devpilot"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Workspace dashboard
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function RecentSessionsCard({
  loading,
  recent,
}: {
  loading: boolean;
  recent: DevSessionSummary[];
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Recent sessions</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent sessions yet</p>
      ) : (
        <ul className="space-y-1">
          {recent.slice(0, 6).map((entry) => (
            <li key={entry.id}>
              <Link
                href={
                  entry.kind === "blank"
                    ? "/devpilot"
                    : sessionHref(getSession(entry.kind) ?? getSession("blank")!)
                }
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate">{entry.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(entry.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentHistoryCard({
  loading,
  recent,
}: {
  loading: boolean;
  recent: DevSessionSummary[];
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Recent history</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">No history yet</p>
      ) : (
        <ul className="space-y-1">
          {recent.slice(0, 6).map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <HistoryIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 truncate">{entry.title}</span>
              {entry.isFavorite && (
                <Star className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
              )}
              <span className="text-[10px] text-muted-foreground">
                {new Date(entry.updatedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FavouriteHistoryCard({
  loading,
  entries,
}: {
  loading: boolean;
  entries: FavouriteHistoryRow[];
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Favourite history</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No favourites yet</p>
      ) : (
        <ul className="space-y-1">
          {entries.slice(0, 6).map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <Star className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
              <span className="flex-1 truncate">{entry.toolName}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(entry.updatedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FavouriteSnippetsCard({
  loading,
  snippets,
}: {
  loading: boolean;
  snippets: FavouriteSnippetSummary[];
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Favourite snippets</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : snippets.length === 0 ? (
        <p className="text-xs text-muted-foreground">No favourite snippets yet</p>
      ) : (
        <ul className="space-y-2">
          {snippets.slice(0, 4).map((snippet) => (
            <li
              key={snippet.id}
              className="rounded-md border border-border p-2 text-xs"
            >
              <div className="mb-1 flex items-center gap-2">
                <Code2 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate font-medium">{snippet.title}</span>
                {snippet.language && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                    {snippet.language}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-muted-foreground">
                {snippet.text || "(empty snippet)"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
