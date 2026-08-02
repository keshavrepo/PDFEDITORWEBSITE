"use client";

/**
 * WebPilot history panel.
 *
 * Reuses the platform-level `/api/webpilot/history` endpoint so the
 * WebPilot shell shows the per-tool history (recent + favourites)
 * without round-tripping the local IndexedDB. The panel filters by
 * tool when one is active, but falls back to a global feed so the
 * user always sees something useful.
 *
 * Mirrors the DevPilot `properties/history-panel.tsx` shape.
 */

import { useEffect, useState } from "react";
import { Clock, Code2, History as HistoryIcon, Star } from "lucide-react";
import { Card } from "@/components/ui/card";

interface HistoryRow {
  id: string;
  userId: string;
  toolName: string;
  kind: string;
  isFavorite: boolean;
  updatedAt: string;
  createdAt: string;
}

interface HistoryPanelProps {
  /** Maximum number of entries to show. */
  limit?: number;
  /** When true, only show favourited entries. */
  favoritesOnly?: boolean;
  /** When set, only show entries for this tool. */
  toolName?: string;
}

function formatWhen(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryPanel({
  limit = 12,
  favoritesOnly = false,
  toolName,
}: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (favoritesOnly) params.set("favorites", "1");
        if (toolName) params.set("toolName", toolName);
        const res = await fetch(`/api/webpilot/history?${params.toString()}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = (await res.json()) as { history?: HistoryRow[] };
        if (cancelled) return;
        setEntries(data.history ?? []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, favoritesOnly, toolName]);

  if (loading) {
    return (
      <div className="p-4 text-xs text-muted-foreground">Loading history…</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <Card className="p-4 text-center text-[11px] text-muted-foreground">
          <HistoryIcon className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
          {favoritesOnly
            ? "No favourite history yet"
            : toolName
              ? `No history yet for ${toolName}`
              : "No history yet"}
        </Card>
      </div>
    );
  }

  return (
    <ul className="space-y-2 p-3">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Card className="flex items-center gap-2 p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              {entry.isFavorite ? (
                <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
              ) : (
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{entry.toolName}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                <Clock className="mr-1 inline h-2.5 w-2.5" aria-hidden="true" />
                {formatWhen(entry.updatedAt)}
              </p>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
