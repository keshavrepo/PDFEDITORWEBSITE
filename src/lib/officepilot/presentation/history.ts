/**
 * OfficePilot Presentation undo/redo history.
 *
 * A bounded stack of past and future bodies. The editor calls `push`
 * when a user-facing mutation happens and `undo` / `redo` to move
 * between snapshots. Continuous typing is coalesced into a single
 * entry: a `push` within 400ms of the previous one replaces the most
 * recent entry instead of pushing a new one.
 */

import type { PresentationBody } from "./schema";

/** Maximum number of entries kept on each side. */
const MAX_ENTRIES = 200;

/** Coalesce window for continuous typing. */
const COALESCE_WINDOW_MS = 400;

export interface HistoryEntry {
  body: PresentationBody;
  timestamp: number;
  label: string;
}

export interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

/** A history that is empty and ready to receive the first entry. */
export function createHistory(): HistoryState {
  return { past: [], future: [] };
}

/** Records a new body. Coalesces with the previous entry if appropriate. */
export function pushHistory(
  history: HistoryState,
  body: PresentationBody,
  options: { label?: string; coalesce?: boolean } = {}
): HistoryState {
  const label = options.label ?? "Edit";
  const now = Date.now();
  const last = history.past[history.past.length - 1];
  if (
    options.coalesce !== false &&
    last &&
    now - last.timestamp < COALESCE_WINDOW_MS &&
    last.label === label
  ) {
    const next = history.past.slice(0, -1);
    next.push({ body, timestamp: now, label });
    return { past: next, future: [] };
  }
  const next = history.past.concat({ body, timestamp: now, label });
  if (next.length > MAX_ENTRIES) next.splice(0, next.length - MAX_ENTRIES);
  return { past: next, future: [] };
}

/** Moves the cursor one step back. */
export function undoHistory(
  history: HistoryState,
  currentBody: PresentationBody,
  now: number = Date.now()
): { history: HistoryState; body: PresentationBody } | null {
  if (history.past.length === 0) return null;
  const past = history.past.slice();
  const entry = past.pop()!;
  const future = [{ body: currentBody, timestamp: now, label: "Current" }, ...history.future];
  return { history: { past, future }, body: entry.body };
}

/** Moves the cursor one step forward. */
export function redoHistory(
  history: HistoryState,
  currentBody: PresentationBody,
  now: number = Date.now()
): { history: HistoryState; body: PresentationBody } | null {
  if (history.future.length === 0) return null;
  const [head, ...rest] = history.future;
  if (!head) return null;
  const past = history.past.concat({ body: currentBody, timestamp: now, label: "Current" });
  return { history: { past, future: rest }, body: head.body };
}

/** Returns true if there is something to undo. */
export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

/** Returns true if there is something to redo. */
export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}
