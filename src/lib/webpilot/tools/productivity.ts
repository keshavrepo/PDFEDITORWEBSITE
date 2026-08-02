/**
 * Workspace Productivity helpers.
 *
 * Pure functions the Workspace Productivity surface uses to drive
 * the Command Palette, the keyboard shortcut reference, the
 * recent-projects list, and the workspace settings panel. The
 * helpers are intentionally dependency-free: every function is
 * pure, and the surface applies the result through the standard
 * `onChange` patch.
 *
 * The Command Palette match is a small fuzzy matcher: every
 * label and keyword the user has is scored, and the highest
 * score wins. The implementation is the same shape every other
 * LaunchStack product uses, so a reader who knows one palette
 * knows them all.
 */

import type {
  WebCommandPaletteItem,
  WebProductivityBody,
  WebProductivityRecent,
} from "../types";

/** Score an item against a query. The score is the sum of the
 * position-weighted matches; higher is better. */
export function scorePaletteItem(
  item: WebCommandPaletteItem,
  query: string
): number {
  const text = (query ?? "").trim().toLowerCase();
  if (!text) return 0;
  const haystack = [item.label, item.category, ...item.keywords]
    .join(" ")
    .toLowerCase();
  if (!haystack.includes(text)) return 0;
  // Boost exact label matches.
  if (item.label.toLowerCase() === text) return 100;
  if (item.label.toLowerCase().startsWith(text)) return 50;
  if (item.label.toLowerCase().includes(text)) return 25;
  return 1;
}

/** Filter and sort the Command Palette items against a query. */
export function searchPalette(
  items: WebCommandPaletteItem[],
  query: string
): WebCommandPaletteItem[] {
  const out: Array<{ item: WebCommandPaletteItem; score: number }> = [];
  for (const item of items) {
    const score = scorePaletteItem(item, query);
    if (score > 0) out.push({ item, score });
  }
  out.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.item.label.localeCompare(b.item.label);
  });
  return out.map((entry) => entry.item);
}

/** Mark a Command Palette item as recently invoked. Returns the
 * updated items array with `lastInvokedAt` set on the matched id. */
export function markPaletteInvoked(
  items: WebCommandPaletteItem[],
  id: string
): WebCommandPaletteItem[] {
  return items.map((item) =>
    item.id === id
      ? { ...item, lastInvokedAt: new Date().toISOString() }
      : item
  );
}

/** Push a recent project onto the recent list. Newest first, cap 12. */
export function pushRecentProject(
  recent: WebProductivityRecent[],
  entry: Omit<WebProductivityRecent, "openedAt">
): WebProductivityRecent[] {
  const next: WebProductivityRecent[] = [
    { ...entry, openedAt: new Date().toISOString() },
    ...recent.filter((other) => other.id !== entry.id),
  ];
  return next.slice(0, 12);
}

/** Default list of keyboard shortcuts the surface shows in the
 * shortcut reference. The list mirrors the keys the WebPilot
 * workspace shell wires up, plus the shortcuts the new Batch 3
 * surfaces add. */
export const WORKSPACE_SHORTCUTS: Array<{
  keys: string;
  description: string;
}> = [
  {
    keys: "Ctrl/Cmd + S",
    description: "Save the active session",
  },
  {
    keys: "Ctrl/Cmd + W",
    description: "Close the active tab",
  },
  {
    keys: "Ctrl/Cmd + D",
    description: "Duplicate the active session",
  },
  {
    keys: "Ctrl/Cmd + B",
    description: "Toggle favourite on the active session",
  },
  {
    keys: "Ctrl/Cmd + F",
    description: "Find in the active editor",
  },
  {
    keys: "Ctrl/Cmd + Z",
    description: "Undo in the active editor",
  },
  {
    keys: "Ctrl/Cmd + Shift + Z",
    description: "Redo in the active editor",
  },
  {
    keys: "Ctrl/Cmd + Tab",
    description: "Next tab in the multi-file workspace",
  },
  {
    keys: "Ctrl/Cmd + Shift + Tab",
    description: "Previous tab in the multi-file workspace",
  },
  {
    keys: "Ctrl/Cmd + Alt + S",
    description: "Toggle the split editor",
  },
  {
    keys: "Ctrl/Cmd + 1",
    description: "Open the Project Explorer",
  },
  {
    keys: "Ctrl/Cmd + 2",
    description: "Open the Asset Manager",
  },
  {
    keys: "Ctrl/Cmd + 3",
    description: "Open the Multi-file Workspace",
  },
  {
    keys: "Ctrl/Cmd + 4",
    description: "Open Professional Search",
  },
  {
    keys: "Ctrl/Cmd + 5",
    description: "Open Project Validation",
  },
  {
    keys: "Ctrl/Cmd + T",
    description: "Open a new terminal pane",
  },
  {
    keys: "Ctrl/Cmd + K",
    description: "Clear the active terminal pane",
  },
  {
    keys: "Ctrl/Cmd + Shift + F",
    description: "Toggle terminal fullscreen",
  },
  {
    keys: "Ctrl/Cmd + Shift + P",
    description: "Toggle the Command Palette",
  },
  {
    keys: "Ctrl/Cmd + /",
    description: "Open the keyboard shortcut reference",
  },
  {
    keys: "Esc",
    description: "Cancel a rename or close a dialog",
  },
];

/** Reset a productivity body to its default. */
export function resetProductivitySettings(
  body: WebProductivityBody
): WebProductivityBody {
  return {
    ...body,
    autosaveEnabled: true,
    autosaveIntervalMs: 1500,
    wordWrap: true,
    theme: "system",
    minimap: true,
    indent: 2,
    findShortcut: true,
  };
}
