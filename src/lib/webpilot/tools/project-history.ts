/**
 * Project History helpers.
 *
 * Pure functions the Project History surface uses to maintain the
 * recent-projects list, the favourites list, the soft-deletion
 * tombstones, and the restore-last-session action. The surface
 * reads from the local IndexedDB-backed store, calls these
 * helpers to compute the next body, and applies the result
 * through the standard `onChange` patch.
 *
 * The helpers intentionally do not touch IndexedDB or the server
 * — the workspace shell owns both. This keeps the helpers
 * dependency-free and lets the surface use them from a
 * `useMemo` (live preview) or an event handler (apply).
 */

import type {
  WebProjectHistoryBody,
  WebProjectHistoryBodyEntry,
  WebProjectHistoryTombstone,
} from "../types";

/** Push a recent entry onto the recent list. Newest first, cap 50. */
export function pushRecentEntry(
  recent: WebProjectHistoryBodyEntry[],
  entry: WebProjectHistoryBodyEntry
): WebProjectHistoryBodyEntry[] {
  const next = [entry, ...recent.filter((other) => other.id !== entry.id)];
  return next.slice(0, 50);
}

/** Toggle a project id in the favourites list. */
export function toggleRecentFavourite(
  favorites: string[],
  id: string
): string[] {
  if (!id) return favorites;
  if (favorites.includes(id)) {
    return favorites.filter((entry) => entry !== id);
  }
  return [id, ...favorites];
}

/** Push a soft-deletion tombstone onto the tombstones stack. Newest first. */
export function pushTombstone(
  tombstones: WebProjectHistoryTombstone[],
  tombstone: WebProjectHistoryTombstone
): WebProjectHistoryTombstone[] {
  const next = [
    tombstone,
    ...tombstones.filter((other) => other.id !== tombstone.id),
  ];
  return next.slice(0, 50);
}

/** Pop the most recent tombstone off the tombstones stack. */
export function popTombstone(
  tombstones: WebProjectHistoryTombstone[]
): {
  tombstone: WebProjectHistoryTombstone | null;
  rest: WebProjectHistoryTombstone[];
} {
  if (tombstones.length === 0) {
    return { tombstone: null, rest: tombstones };
  }
  return {
    tombstone: tombstones[0]!,
    rest: tombstones.slice(1),
  };
}

/** Filter the recent list by a search term (case-insensitive). */
export function filterRecent(
  recent: WebProjectHistoryBodyEntry[],
  query: string
): WebProjectHistoryBodyEntry[] {
  const term = (query ?? "").trim().toLowerCase();
  if (!term) return recent;
  return recent.filter(
    (entry) =>
      entry.title.toLowerCase().includes(term) ||
      entry.kind.toLowerCase().includes(term) ||
      entry.category.toLowerCase().includes(term)
  );
}

/** Build a starter recent entry from a session summary. */
export function recentEntryFromSummary(summary: {
  id: string;
  title: string;
  kind: string;
  category: string;
  updatedAt: string;
  version: number;
  size: number;
  isFavorite: boolean;
}): WebProjectHistoryBodyEntry {
  return {
    id: summary.id,
    title: summary.title,
    kind: summary.kind,
    category: summary.category,
    updatedAt: summary.updatedAt,
    version: summary.version,
    size: summary.size,
    isFavorite: summary.isFavorite,
  };
}

/** Compute the next body when the user picks "Restore last session". */
export function restoreLastSession(
  body: WebProjectHistoryBody
): { body: WebProjectHistoryBody; tombstone: WebProjectHistoryTombstone | null } {
  const { tombstone, rest } = popTombstone(body.tombstones);
  if (!tombstone) {
    return { body, tombstone: null };
  }
  const next: WebProjectHistoryBody = {
    ...body,
    tombstones: rest,
    lastRestoredSessionId: tombstone.sessionId,
    lastRestoredAt: new Date().toISOString(),
  };
  return { body: next, tombstone };
}

/** Reset the body to its default shape. */
export function resetProjectHistoryBody(
  body: WebProjectHistoryBody
): WebProjectHistoryBody {
  return {
    recent: body.recent,
    favorites: body.favorites,
    tombstones: body.tombstones,
    lastDeletedSessionId: body.lastDeletedSessionId,
    lastDeletedAt: body.lastDeletedAt,
    lastRestoredSessionId: body.lastRestoredSessionId,
    lastRestoredAt: body.lastRestoredAt,
    search: "",
    isFavorite: body.isFavorite,
  };
}
