"use client";

/**
 * Workspace Dashboard — WebPilot surface.
 *
 * A one-page summary of the user's WebPilot workspace: recent
 * sessions, recent and favourite history, favourite snippets (we
 * reuse the snippet abstraction here so the dashboard reads the
 * same body shape every other product uses), the active favourite
 * tools, the favourite-tool registry, the per-tool usage breakdown,
 * and quick links to every other surface.
 *
 * Mirrors the DevPilot `workspace-dashboard.tsx` shape.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Code2,
  FileText,
  History as HistoryIcon,
  Layers,
  Palette,
  Settings2,
  Sparkles,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import {
  getSession,
  listWebSessions,
  sessions as allSessions,
  sessionHref,
  type WebSession,
  type WebSessionSummary,
} from "@/lib/webpilot";

interface WorkspaceDashboardProps {
  session: WebSession;
}

interface FavouriteHistoryRow {
  id: string;
  toolName: string;
  updatedAt: string;
}

interface PerKindCount {
  kind: string;
  count: number;
  favourites: number;
}

export function WorkspaceDashboard({ session }: WorkspaceDashboardProps) {
  const { toast } = useToast();
  const [recent, setRecent] = useState<WebSessionSummary[]>([]);
  const [favouriteHistory, setFavouriteHistory] = useState<FavouriteHistoryRow[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalFavourites: 0,
    perKind: [] as PerKindCount[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch the full session list once and derive both the
        // "recent" subset (first 8) and the per-kind statistics.
        // The dashboard used to issue the same `listWebSessions`
        // call twice (limit 8 + limit 200); the network round
        // trip was wasted because the second list always
        // contains the first.
        const [allSessionsList, historyRes] = await Promise.all([
          listWebSessions({ limit: 200 }),
          fetch("/api/webpilot/history?limit=12"),
        ]);
        if (cancelled) return;
        setRecent(allSessionsList.slice(0, 8));

        const historyData = (await historyRes
          .json()
          .catch(() => ({ history: [] }))) as {
          history: { id: string; toolName: string; updatedAt: string; isFavorite: boolean }[];
        };
        const allHistory = historyData.history ?? [];
        setFavouriteHistory(
          allHistory
            .filter((row) => row.isFavorite)
            .map((row) => ({
              id: row.id,
              toolName: row.toolName,
              updatedAt: row.updatedAt,
            }))
        );

        // Workspace statistics.
        const totalFavourites = allSessionsList.filter((entry) => entry.isFavorite).length;
        const perKindMap = new Map<string, PerKindCount>();
        for (const entry of allSessionsList) {
          const row = perKindMap.get(entry.kind) ?? { kind: entry.kind, count: 0, favourites: 0 };
          row.count += 1;
          if (entry.isFavorite) row.favourites += 1;
          perKindMap.set(entry.kind, row);
        }
        const perKind = Array.from(perKindMap.values()).sort(
          (a, b) => b.count - a.count
        );
        setStats({
          totalSessions: allSessionsList.length,
          totalFavourites,
          perKind,
        });
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

  // Build the favourite-tools list: take the favourited sessions that
  // match a known tool kind and link to that tool.
  const toolKinds = new Set<string>([
    "html",
    "css",
    "javascript",
    "preview",
  ]);
  const favouriteTools = recent.filter(
    (entry) => toolKinds.has(entry.kind) && entry.isFavorite
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">{sessionDef?.name ?? "WebPilot"}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {sessionDef?.description ??
            "WebPilot is LaunchStack's web workspace. Batch 1 ships the foundation plus four core tools."}
        </p>
      </Card>

      <StatsRow loading={loading} stats={stats} />

      <div className="grid gap-4 md:grid-cols-2">
        <RecentSessionsCard loading={loading} recent={recent} />
        <FavouriteHistoryCard loading={loading} entries={favouriteHistory} />
        <FavouriteToolsCard loading={loading} favourites={favouriteTools} />
        <PerKindCard loading={loading} perKind={stats.perKind} />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Quick links</h3>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {allSessions
            .filter((entry) => entry.slug && entry.slug !== "dashboard")
            .map((entry) => (
              <li key={entry.kind}>
                <Link
                  href={sessionHref(entry)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <ToolIcon kind={entry.kind} />
                  <span className="flex-1 truncate">{entry.name}</span>
                </Link>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

function ToolIcon({ kind }: { kind: string }) {
  const className = "h-3.5 w-3.5 text-muted-foreground";
  switch (kind) {
    case "html":
      return <Code2 className={className} aria-hidden="true" />;
    case "css":
      return <Palette className={className} aria-hidden="true" />;
    case "javascript":
      return <Sparkles className={className} aria-hidden="true" />;
    case "preview":
      return <FileText className={className} aria-hidden="true" />;
    case "history":
      return <HistoryIcon className={className} aria-hidden="true" />;
    default:
      return <Settings2 className={className} aria-hidden="true" />;
  }
}

function StatsRow({
  loading,
  stats,
}: {
  loading: boolean;
  stats: {
    totalSessions: number;
    totalFavourites: number;
    perKind: PerKindCount[];
  };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        loading={loading}
        label="Sessions"
        value={stats.totalSessions}
        sub={stats.perKind.length > 0 ? `${stats.perKind.length} tool kinds in use` : "—"}
        icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
      />
      <StatCard
        loading={loading}
        label="Favourites"
        value={stats.totalFavourites}
        sub="across sessions"
        icon={<Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
      />
      <StatCard
        loading={loading}
        label="Tool kinds"
        value={stats.perKind.length}
        sub="registered in the workspace"
        icon={<HistoryIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
      />
    </div>
  );
}

function StatCard({
  loading,
  label,
  value,
  sub,
  icon,
}: {
  loading: boolean;
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {loading ? "—" : value}
      </p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </Card>
  );
}

function RecentSessionsCard({
  loading,
  recent,
}: {
  loading: boolean;
  recent: WebSessionSummary[];
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
                    ? "/webpilot"
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

function FavouriteToolsCard({
  loading,
  favourites,
}: {
  loading: boolean;
  favourites: WebSessionSummary[];
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Favourite tools</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : favourites.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Star a tool session to see it here. The dashboard pulls from the
          recent-sessions mirror.
        </p>
      ) : (
        <ul className="space-y-1">
          {favourites.slice(0, 6).map((entry) => (
            <li key={entry.id}>
              <Link
                href={sessionHref(getSession(entry.kind) ?? getSession("blank")!)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
                <ToolIcon kind={entry.kind} />
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

function PerKindCard({
  loading,
  perKind,
}: {
  loading: boolean;
  perKind: PerKindCount[];
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Workspace statistics</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : perKind.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Create your first session to see the breakdown.
        </p>
      ) : (
        <ul className="space-y-1">
          {perKind.slice(0, 8).map((row) => (
            <li
              key={row.kind}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
            >
              <ToolIcon kind={row.kind} />
              <span className="flex-1 truncate">{row.kind}</span>
              <span className="tabular-nums font-medium">{row.count}</span>
              {row.favourites > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                  <Star className="h-2.5 w-2.5 fill-primary" aria-hidden="true" />
                  {row.favourites}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
