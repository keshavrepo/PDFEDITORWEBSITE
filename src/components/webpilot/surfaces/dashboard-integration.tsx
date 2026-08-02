"use client";

/**
 * Dashboard Integration surface.
 *
 * A professional Dashboard Integration view. The user sees every
 * important WebPilot state in one place: the recent projects
 * list, the storage summary (sessions, history, assets, bytes),
 * the notifications queue, the search history, the favourites
 * gallery, and the activity analytics broken down by surface.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome`, the in-app toast, the IndexedDB-backed session
 * store, and the platform-wide search index. Nothing new was
 * added to the LaunchStack infrastructure to ship this surface.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  History as HistoryIcon,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asDashboardBody,
  buildActivityRows,
  buildStorageSummary,
  clearReadNotifications,
  formatBytes,
  getSession,
  listHistoryStorage,
  listWebSessions,
  markAllNotificationsRead,
  relativeTime,
  sessions as allSessions,
  sessionHref,
  type WebDashboardBody,
  type WebSessionSummary,
} from "@/lib/webpilot";
import { asWebAssets } from "./shared/webpilot-store";
import type { WebSession } from "@/lib/webpilot";

interface DashboardIntegrationSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function DashboardIntegrationSurface({
  session,
  onChange,
}: DashboardIntegrationSurfaceProps) {
  const body = asDashboardBody(session.body);
  const { toast } = useToast();
  const [recent, setRecent] = useState<WebSessionSummary[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const assets = asWebAssets(session);

  function commit(patch: Partial<WebDashboardBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessions, history] = await Promise.all([
          listWebSessions({ limit: 50 }),
          listHistoryStorage({ limit: 200 }).catch(
            () => ({ entries: [], total: 0 })
          ),
        ]);
        if (cancelled) return;
        setRecent(sessions);
        const historyEntries = history.entries ?? [];
        setHistoryCount(historyEntries.length);
        // Rebuild storage summary and activity rows from the
        // server mirror, then write them into the body so the
        // user sees them as the "official" numbers.
        const storage = buildStorageSummary(
          sessions,
          historyEntries,
          assets.assets
        );
        const activity = buildActivityRows(sessions);
        commit({
          storage,
          activity,
          refreshedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (!cancelled) {
          toast({
            message:
              err instanceof Error ? err.message : "Dashboard refresh failed",
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
  }, []);

  const topRecent = useMemo(() => recent.slice(0, 8), [recent]);
  const topActivity = useMemo(() => body.activity.slice(0, 8), [body.activity]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Dashboard Integration — recent projects, storage summary, notifications, search, favourites and analytics in one place."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.storage.sessions} sessions · {body.storage.assets} assets ·{" "}
            {body.storage.historyEntries} history ·{" "}
            {body.refreshedAt
              ? `refreshed ${relativeTime(body.refreshedAt)}`
              : "not refreshed"}
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 xl:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Storage summary
          </h3>
          {loading ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 text-[11px]">
              <StorageTile
                label="Sessions"
                value={String(body.storage.sessions)}
                sub={formatBytes(body.storage.bytes)}
              />
              <StorageTile
                label="History"
                value={String(body.storage.historyEntries)}
                sub={historyCount === 1 ? "entry" : "entries"}
              />
              <StorageTile
                label="Assets"
                value={String(body.storage.assets)}
                sub={formatBytes(body.storage.assetBytes)}
              />
              <StorageTile
                label="Total bytes"
                value={formatBytes(
                  body.storage.bytes + body.storage.assetBytes
                )}
                sub={`${body.storage.computedAt ? relativeTime(body.storage.computedAt) : "—"}`}
              />
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <HistoryIcon className="h-4 w-4" aria-hidden="true" />
            Recent projects
          </h3>
          {topRecent.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No recent projects yet.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px]">
              {topRecent.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={sessionHref(
                      getSession(entry.kind) ?? getSession("blank")!
                    )}
                    className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 hover:bg-accent/50"
                  >
                    <span className="flex-1 truncate font-medium">
                      {entry.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {entry.kind}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(entry.updatedAt)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1 text-sm font-semibold">
              <Bell className="h-4 w-4" aria-hidden="true" />
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() =>
                  commit({
                    notifications: markAllNotificationsRead(body.notifications),
                  })
                }
                disabled={body.notifications.every((entry) => entry.read)}
              >
                Mark all read
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() =>
                  commit({
                    notifications: clearReadNotifications(body.notifications),
                  })
                }
                disabled={body.notifications.every((entry) => !entry.read)}
                aria-label="Clear read notifications"
                title="Clear read notifications"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
          </div>
          {body.notifications.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No notifications. The queue fills as you save, validate
              and export.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px]">
              {body.notifications.slice(0, 8).map((entry) => (
                <li
                  key={entry.id}
                  className={
                    "flex items-start gap-2 rounded border px-2 py-1.5 " +
                    (entry.read
                      ? "border-border bg-background"
                      : "border-primary/40 bg-primary/5")
                  }
                >
                  <Bell
                    className="mt-0.5 h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{entry.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.body}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <Search className="h-4 w-4" aria-hidden="true" />
            Recent searches
          </h3>
          {body.recentSearches.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Run a search on the Workspace Productivity surface to
              populate this list.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1 text-[11px]">
              {body.recentSearches.map((term) => (
                <li
                  key={term}
                  className="rounded border border-border bg-muted/30 px-2 py-0.5"
                >
                  {term}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <Star className="h-4 w-4" aria-hidden="true" />
            Favourite surfaces
          </h3>
          {body.favouriteSurfaces.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Pin a surface to see it here. The favourites gallery
              mirrors the platform-wide star.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px]">
              {body.favouriteSurfaces.map((surface) => {
                const entry = allSessions.find(
                  (session) => session.kind === surface || session.slug === surface
                );
                if (!entry) {
                  return (
                    <li
                      key={surface}
                      className="rounded border border-border bg-muted/30 px-2 py-1.5"
                    >
                      {surface}
                    </li>
                  );
                }
                return (
                  <li key={surface}>
                    <a
                      href={sessionHref(entry)}
                      className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 hover:bg-accent/50"
                    >
                      <Star
                        className="h-3 w-3 fill-primary text-primary"
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate font-medium">
                        {entry.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.tagline}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <Activity className="h-4 w-4" aria-hidden="true" />
            Activity analytics
          </h3>
          {topActivity.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No activity yet. Save a session to start the timeline.
            </p>
          ) : (
            <ul className="space-y-1 text-[11px]">
              {topActivity.map((row) => (
                <li
                  key={row.kind}
                  className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5"
                >
                  <Sparkles
                    className="h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate font-medium">{row.kind}</span>
                  <span className="tabular-nums">{row.events}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(row.lastEventAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

interface StorageTileProps {
  label: string;
  value: string;
  sub: string;
}

function StorageTile({ label, value, sub }: StorageTileProps) {
  return (
    <li className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </li>
  );
}
