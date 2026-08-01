/**
 * Undo/redo stack.
 *
 * Snapshot-based rather than command-based. Documents are small plain objects
 * (bitmaps live in the raster store), so storing whole snapshots is cheap and
 * removes an entire class of bugs where an inverse operation does not exactly
 * undo its forward counterpart.
 *
 * Consecutive edits of the same kind coalesce, which is what stops a slider
 * drag from filling the stack with a hundred one-unit steps.
 */

import { HISTORY_LIMIT } from "./constants";
import { cloneDocument } from "./document";
import type { EditorDocument } from "./types";

export interface HistoryEntry {
  document: EditorDocument;
  /** Shown in the history panel. */
  label: string;
  /**
   * Edits sharing a merge key coalesce while they are the newest entry, e.g.
   * `adjust:layer_1:brightness` during a single slider drag.
   */
  mergeKey?: string;
  timestamp: number;
}

export interface HistoryState {
  entries: HistoryEntry[];
  /** Index of the entry currently displayed. */
  index: number;
}

export function createHistory(document: EditorDocument, label = "Open"): HistoryState {
  return {
    entries: [{ document: cloneDocument(document), label, timestamp: Date.now() }],
    index: 0,
  };
}

export function currentDocument(history: HistoryState): EditorDocument {
  return history.entries[history.index].document;
}

export function canUndo(history: HistoryState): boolean {
  return history.index > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.index < history.entries.length - 1;
}

/**
 * Commits a new document state.
 *
 * Redo entries ahead of the cursor are discarded, matching every editor's
 * behaviour: branching after an undo replaces the abandoned future.
 */
export function pushHistory(
  history: HistoryState,
  document: EditorDocument,
  label: string,
  mergeKey?: string
): HistoryState {
  const head = history.entries[history.index];

  // Coalesce onto the newest entry when the key matches, so a drag ends up as
  // a single undo step.
  if (
    mergeKey &&
    head?.mergeKey === mergeKey &&
    history.index === history.entries.length - 1
  ) {
    const entries = [...history.entries];
    entries[history.index] = {
      document: cloneDocument(document),
      label,
      mergeKey,
      timestamp: Date.now(),
    };
    return { entries, index: history.index };
  }

  const entries = history.entries.slice(0, history.index + 1);
  entries.push({
    document: cloneDocument(document),
    label,
    mergeKey,
    timestamp: Date.now(),
  });

  // Trim the oldest entries once the cap is reached.
  const overflow = entries.length - HISTORY_LIMIT;
  if (overflow > 0) entries.splice(0, overflow);

  return { entries, index: entries.length - 1 };
}

export function undo(history: HistoryState): HistoryState {
  if (!canUndo(history)) return history;
  return { ...history, index: history.index - 1 };
}

export function redo(history: HistoryState): HistoryState {
  if (!canRedo(history)) return history;
  return { ...history, index: history.index + 1 };
}

/** Jumps directly to an entry, used by the history panel. */
export function jumpTo(history: HistoryState, index: number): HistoryState {
  const clamped = Math.max(0, Math.min(history.entries.length - 1, index));
  return { ...history, index: clamped };
}

/** Replaces the stack with a single entry, e.g. after opening a new document. */
export function resetHistory(document: EditorDocument, label: string): HistoryState {
  return createHistory(document, label);
}
