/**
 * OfficePilot Word undo/redo history.
 *
 * A bounded stack of past and future bodies. The editor calls `push` when
 * a user-facing mutation happens (typing, formatting, structural change)
 * and `undo` / `redo` to move between snapshots. Continuous typing is
 * coalesced into a single entry: a `push` within 400ms of the previous
 * one replaces the most recent entry instead of pushing a new one.
 */

import type { WordBody } from "./schema";

/** Maximum number of entries kept on each side. */
const MAX_ENTRIES = 200;

/** Coalesce window for continuous typing. */
const COALESCE_WINDOW_MS = 400;

export interface HistoryEntry {
  body: WordBody;
  /** Timestamp the entry was created. */
  timestamp: number;
  /** Optional human label, e.g. "Type" or "Bold". */
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

/** Returns the most recent past entry without changing the history. */
export function currentEntry(history: HistoryState): HistoryEntry | null {
  if (history.past.length === 0) return null;
  return history.past[history.past.length - 1] ?? null;
}

/** Records a new body. Coalesces with the previous entry if appropriate. */
export function pushHistory(
  history: HistoryState,
  body: WordBody,
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
    // Coalesce: keep the previous timestamp but replace the body.
    const next = history.past.slice(0, -1);
    next.push({ body, timestamp: now, label });
    return { past: next, future: [] };
  }
  const next = history.past.concat({ body, timestamp: now, label });
  if (next.length > MAX_ENTRIES) next.splice(0, next.length - MAX_ENTRIES);
  return { past: next, future: [] };
}

/**
 * Moves the cursor one step back. The current entry becomes the head of
 * `future`; the previous entry becomes the new current.
 */
export function undoHistory(
  history: HistoryState,
  currentBody: WordBody,
  now: number = Date.now()
): { history: HistoryState; body: WordBody } | null {
  if (history.past.length === 0) return null;
  const past = history.past.slice();
  const entry = past.pop()!;
  const future = [{ body: currentBody, timestamp: now, label: "Current" }, ...history.future];
  return { history: { past, future }, body: entry.body };
}

/**
 * Moves the cursor one step forward. The current entry becomes the head
 * of `past`; the next future entry becomes the new current.
 */
export function redoHistory(
  history: HistoryState,
  currentBody: WordBody,
  now: number = Date.now()
): { history: HistoryState; body: WordBody } | null {
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
