"use client";

/**
 * Shared hook: keyboard shortcut registry.
 *
 * Lets a surface register a list of keyboard shortcuts in one
 * place. The hook installs a single `keydown` listener on
 * `window` that walks the registry, picks the first matching
 * shortcut, prevents the browser's default action, and calls
 * the shortcut's handler. The hook is the single place the
 * AudioPilot workspace resolves keyboard navigation, so every
 * surface feels the same.
 *
 * Browser-only: the hook is a no-op when `window` is undefined.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";

export interface Shortcut {
  /** Display label, e.g. "Ctrl/Cmd + S". */
  label: string;
  /** Whether the modifier must be held. */
  mod?: boolean;
  /** Whether shift must be held. */
  shift?: boolean;
  /** Whether alt must be held. */
  alt?: boolean;
  /** The key to match, case-insensitive. */
  key: string;
  /** When true, the shortcut runs even when an input has focus. */
  allowInInput?: boolean;
  /** The handler. */
  handler: (event: KeyboardEvent) => void;
}

export interface UseKeyboardShortcutsOptions {
  /** The shortcuts to install. */
  shortcuts: Shortcut[];
  /** Whether the listener is enabled. */
  enabled?: boolean;
}

/** Hook implementation. */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions
): void {
  const { shortcuts, enabled = true } = options;
  // Keep the latest handler list in a ref so the effect can
  // depend on the option object without re-running the listener
  // install on every render.
  const listRef = useRef<Shortcut[]>(shortcuts);
  useEffect(() => {
    // Keep the ref current; the listener reads it on every keydown
    // so the user gets the latest list without re-installing.
    listRef.current = shortcuts;
  }, [shortcuts]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      const mod = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const inInput = Boolean(
        target?.matches(
          "input, textarea, select, [contenteditable='true'], [role='textbox']"
        )
      );
      const list = listRef.current;
      for (const shortcut of list) {
        if (shortcut.mod && !mod) continue;
        if (!shortcut.mod && mod) continue;
        if (shortcut.shift && !event.shiftKey) continue;
        if (!shortcut.shift && event.shiftKey) continue;
        if (shortcut.alt && !event.altKey) continue;
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
        if (inInput && !shortcut.allowInInput) continue;
        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onKeyDown]);
}

/** Renders the registry as a `<dl>` of `label → description` rows.
 * The hook returns a JSX node the surface can drop into a card. */
export function useShortcutTable(
  shortcuts: Shortcut[]
): Array<{ keys: string; description: string }> {
  return useMemo(
    () =>
      shortcuts.map((shortcut) => {
        const parts: string[] = [];
        if (shortcut.mod) parts.push("Ctrl/Cmd");
        if (shortcut.shift) parts.push("Shift");
        if (shortcut.alt) parts.push("Alt");
        parts.push(shortcut.key.toUpperCase());
        return { keys: parts.join(" + "), description: shortcut.label };
      }),
    [shortcuts]
  );
}
