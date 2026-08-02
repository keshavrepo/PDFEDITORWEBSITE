"use client";

/**
 * Shared hook: drag & drop file picker.
 *
 * Returns the props a drop zone should spread on its root
 * element. The hook handles the standard `dragenter` / `dragleave`
 * / `dragover` / `drop` event lifecycle, throttles the
 * `dragenter` events that fire on every child, filters for
 * files (and accepts multiple), and exposes an `isDragging`
 * flag the zone can use to render a visual affordance.
 *
 * Browser-only: the hook returns a no-op set of props when
 * `window` is undefined (SSR), so it is safe to call from a
 * server-rendered surface.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseFileDropOptions {
  /** Optional callback invoked when the user drops files. */
  onFiles?: (files: File[]) => void;
  /** Whether the drop zone is currently accepting drops. */
  enabled?: boolean;
  /** Whether to accept multiple files at once. Default `true`. */
  multiple?: boolean;
  /** Optional MIME prefix filter. Default `"audio/"`. */
  acceptPrefix?: string;
}

export interface UseFileDropResult {
  /** Spread on the drop zone root. */
  dropZoneProps: {
    onDragEnter: (event: React.DragEvent<HTMLElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
    onDrop: (event: React.DragEvent<HTMLElement>) => void;
  };
  /** Whether the user is currently dragging files over the zone. */
  isDragging: boolean;
}

/** Counts the dragenter / dragleave events. Browsers fire one
 * `dragenter` per child element, so the helper tracks a counter
 * and reports `false` only when the counter is back to zero. */
function useCounter(): [number, (delta: number) => void] {
  const [count, setCount] = useState(0);
  const update = useCallback((delta: number) => {
    setCount((current) => Math.max(0, current + delta));
  }, []);
  return [count, update];
}

/** Hook implementation. */
export function useFileDrop(options: UseFileDropOptions = {}): UseFileDropResult {
  const { onFiles, enabled = true, multiple = true, acceptPrefix = "audio/" } = options;
  const [dragging, setDragging] = useState(false);
  const [counter, update] = useCounter();

  // Reset the dragging flag whenever the counter returns to zero.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDragging(counter > 0);
  }, [counter]);

  const onDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!enabled) return;
      event.preventDefault();
      update(1);
    },
    [enabled, update]
  );

  const onDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [enabled]
  );

  const onDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!enabled) return;
      event.preventDefault();
      update(-1);
    },
    [enabled, update]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!enabled) return;
      event.preventDefault();
      update(-counter);
      const dt = event.dataTransfer;
      if (!dt) return;
      const files = Array.from(dt.files ?? []).filter((file) =>
        file.type.startsWith(acceptPrefix)
      );
      const filtered = multiple ? files : files.slice(0, 1);
      if (filtered.length > 0) {
        onFiles?.(filtered);
      }
    },
    [acceptPrefix, counter, enabled, multiple, onFiles, update]
  );

  return useMemo(
    () => ({
      dropZoneProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
      isDragging: dragging,
    }),
    [dragging, onDragEnter, onDragLeave, onDrop, onDragOver]
  );
}
