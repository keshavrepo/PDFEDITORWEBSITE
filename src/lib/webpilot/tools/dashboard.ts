/**
 * Dashboard Integration helpers.
 *
 * Pure functions the Dashboard Integration surface uses to
 * aggregate the storage summary, the notifications queue, the
 * search history, the favourites gallery, and the activity
 * analytics. The surface reads from the local IndexedDB-backed
 * store and from the platform-wide search index, calls these
 * helpers to compute the next body, and applies the result
 * through the standard `onChange` patch.
 *
 * The helpers are intentionally dependency-free: every function
 * is pure, and the surface can call them from a `useMemo`
 * (live preview) or an event handler (apply).
 */

import type {
  WebAsset,
  WebDashboardActivityRow,
  WebDashboardBody,
  WebDashboardNotification,
  WebDashboardStorage,
  WebProjectFile,
  WebProjectHistoryBodyEntry,
  WebSessionCategory,
  WebSessionSummary,
} from "../types";

/** Build the storage summary from a list of sessions, history and assets. */
export function buildStorageSummary(
  sessions: WebSessionSummary[],
  historyEntries: { size: number }[] | number,
  assets: WebAsset[]
): WebDashboardStorage {
  const sessionsCount = sessions.length;
  const bytes = sessions.reduce(
    (total, entry) => total + (entry.size ?? 0),
    0
  );
  const historyCount =
    typeof historyEntries === "number"
      ? historyEntries
      : historyEntries.length;
  const assetsCount = assets.length;
  const assetBytes = assets.reduce(
    (total, entry) => total + (entry.size ?? 0),
    0
  );
  return {
    sessions: sessionsCount,
    bytes,
    historyEntries: historyCount,
    assets: assetsCount,
    assetBytes,
    computedAt: new Date().toISOString(),
  };
}

/** Push a notification onto the queue. Newest first, cap 50. */
export function pushNotification(
  notifications: WebDashboardNotification[],
  notification: WebDashboardNotification
): WebDashboardNotification[] {
  const next = [
    notification,
    ...notifications.filter((entry) => entry.id !== notification.id),
  ];
  return next.slice(0, 50);
}

/** Mark a notification as read. */
export function markNotificationRead(
  notifications: WebDashboardNotification[],
  id: string
): WebDashboardNotification[] {
  return notifications.map((entry) =>
    entry.id === id ? { ...entry, read: true } : entry
  );
}

/** Mark every notification as read. */
export function markAllNotificationsRead(
  notifications: WebDashboardNotification[]
): WebDashboardNotification[] {
  return notifications.map((entry) => ({ ...entry, read: true }));
}

/** Clear every notification that has been read. */
export function clearReadNotifications(
  notifications: WebDashboardNotification[]
): WebDashboardNotification[] {
  return notifications.filter((entry) => !entry.read);
}

/** Push a search term onto the recent searches list. Newest first, cap 12. */
export function pushRecentSearch(
  recent: string[],
  term: string
): string[] {
  const cleaned = (term ?? "").trim();
  if (!cleaned) return recent;
  const next = [cleaned, ...recent.filter((entry) => entry !== cleaned)];
  return next.slice(0, 12);
}

/** Toggle a surface in the favourites gallery. */
export function toggleFavouriteSurface(
  favorites: string[],
  surface: string
): string[] {
  if (!surface) return favorites;
  if (favorites.includes(surface)) {
    return favorites.filter((entry) => entry !== surface);
  }
  return [surface, ...favorites];
}

/**
 * Build the activity analytics rows from a list of recent
 * session summaries. The most recent edit per kind wins, and the
 * list is sorted by `lastEventAt` descending.
 */
export function buildActivityRows(
  summaries: WebSessionSummary[]
): WebDashboardActivityRow[] {
  const map = new Map<string, WebDashboardActivityRow>();
  for (const entry of summaries) {
    const row = map.get(entry.kind) ?? {
      kind: entry.kind,
      events: 0,
      lastEventAt: entry.updatedAt,
      sessionCount: 0,
    };
    row.events += 1;
    if (new Date(entry.updatedAt).getTime() > new Date(row.lastEventAt).getTime()) {
      row.lastEventAt = entry.updatedAt;
    }
    row.sessionCount += 1;
    map.set(entry.kind, row);
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime()
  );
}

/** Merge a list of recent project-history entries with the
 * session summary list and rebuild the activity rows. The surface
 * calls this on every refresh. */
export function mergeRecentForActivity(
  history: WebProjectHistoryBodyEntry[],
  summaries: WebSessionSummary[]
): WebSessionSummary[] {
  // Prefer the history entry (richer metadata) when both exist.
  const map = new Map<string, WebSessionSummary>();
  for (const summary of summaries) map.set(summary.id, summary);
  for (const entry of history) {
    if (!map.has(entry.id)) {
      map.set(entry.id, {
        id: entry.id,
        title: entry.title,
        kind: entry.kind,
        category: entry.category as WebSessionCategory,
        updatedAt: entry.updatedAt,
        autosavedAt: null,
        version: entry.version,
        size: entry.size,
        isFavorite: entry.isFavorite,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Compute the totals across every file in a project (used for the
 * dashboard's "total bytes of source" tile). */
export function totalProjectBytes(files: WebProjectFile[]): number {
  return files.reduce((total, file) => total + file.source.length, 0);
}

/** Format a timestamp as a relative time string. */
export function relativeTime(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const now = Date.now();
  const delta = Math.max(0, now - then);
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/** Reset the body to its default shape. */
export function resetDashboardBody(
  body: WebDashboardBody
): WebDashboardBody {
  return {
    storage: body.storage,
    notifications: body.notifications,
    recentSearches: body.recentSearches,
    favouriteSurfaces: body.favouriteSurfaces,
    activity: body.activity,
    refreshedAt: body.refreshedAt,
    isFavorite: body.isFavorite,
  };
}
