"use client";

/**
 * Activity panel for DevPilot.
 *
 * Reuses the platform-level `/api/activity` endpoint so the DevPilot
 * shell shows the same activity stream as the dashboard. The panel
 * filters to DevPilot events when possible, but falls back to a global
 * feed so the user always sees something useful.
 *
 * Mirrors /components/socialpilot/properties/activity-panel.tsx.
 */

import { useEffect, useState } from "react";
import { Clock, FileText, Upload, Download, LogIn, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ActivityEntry {
  id: string;
  kind: "conversion" | "upload" | "download" | "login" | "account";
  title: string;
  productId: string;
  productName: string;
  createdAt: string;
}

const ICON: Record<ActivityEntry["kind"], typeof FileText> = {
  conversion: FileText,
  upload: Upload,
  download: Download,
  login: LogIn,
  account: UserCog,
};

function formatWhen(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ActivityPanelProps {
  /** Maximum number of entries to show. */
  limit?: number;
  /** When true, only show DevPilot events. */
  filterDev?: boolean;
}

export function ActivityPanel({ limit = 12, filterDev = false }: ActivityPanelProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/activity?limit=${limit}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = (await res.json()) as { activity?: ActivityEntry[] };
        if (cancelled) return;
        const list = data.activity ?? [];
        setEntries(filterDev ? list.filter((e) => e.productId === "devpilot") : list);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, filterDev]);

  if (loading) {
    return (
      <div className="p-4 text-xs text-muted-foreground">Loading activity…</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <Card className="p-4 text-center text-[11px] text-muted-foreground">
          <Clock className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
          No recent activity yet
        </Card>
      </div>
    );
  }

  return (
    <ul className="space-y-2 p-3">
      {entries.map((entry) => {
        const Icon = ICON[entry.kind] ?? FileText;
        return (
          <li key={entry.id}>
            <Card className="flex items-center gap-2 p-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium">{entry.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {entry.productName} · {formatWhen(entry.createdAt)}
                </p>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
