"use client";

/**
 * Before / After Compare Slider.
 *
 * Lets the user drag a vertical divider to reveal the original under the
 * current edit, exactly the gesture every photo editor ships with. The
 * slider can be horizontal too, and the divider position is read from a
 * pointer event so the comparison works on touch as well as a mouse.
 *
 * The component is purely presentational: it lays two canvases (or images)
 * on top of each other and uses a CSS clip-path to show one or the other.
 * The two surfaces must be the same size; the slider centres on whatever
 * container it sits in.
 *
 * Drag position is committed through React state, not a ref, because the
 * divider is the only interactive element here — there is no scroll to
 * chase and no bulk update to make. A direct DOM update would only matter
 * at sub-frame latencies, which this component never sees.
 */

import {
  useCallback,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type CompareOrientation = "horizontal" | "vertical";

export interface CompareSliderProps {
  /** What the user sees on the "before" side. */
  before: ReactNode;
  /** What the user sees on the "after" side. */
  after: ReactNode;
  /** 0..100, starting position of the divider. Default 50. */
  initial?: number;
  /** Which axis the divider moves along. */
  orientation?: CompareOrientation;
  /** Optional caption for the "before" label. */
  beforeLabel?: string;
  /** Optional caption for the "after" label. */
  afterLabel?: string;
  /** Optional className for the outer container. */
  className?: string;
}

export function CompareSlider({
  before,
  after,
  initial = 50,
  orientation = "vertical",
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: CompareSliderProps) {
  const [position, setPosition] = useState(clampPercent(initial));
  const [dragging, setDragging] = useState(false);

  /**
   * Computes the divider position from a pointer event, using the
   * container's actual size rather than its clientX/Y so the slider works
   * inside any layout.
   */
  const positionFromEvent = useCallback(
    (event: ReactPointerEvent | PointerEvent) => {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const raw =
        orientation === "vertical"
          ? ((event.clientX - rect.left) / rect.width) * 100
          : ((event.clientY - rect.top) / rect.height) * 100;
      return clampPercent(raw);
    },
    [orientation]
  );

  /** Drag start: capture the pointer so move events keep firing off-canvas. */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const next = positionFromEvent(event);
      setPosition(next);
      setDragging(true);
      // Capture so the move listener keeps firing even when the pointer
      // leaves the divider. The release handler drops the capture.
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [positionFromEvent]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragging) return;
      setPosition(positionFromEvent(event));
    },
    [dragging, positionFromEvent]
  );

  /** Drag end: commit the position so a re-render reflects the final value. */
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  /** Clicking the rail without dragging still moves the divider there. */
  const onContainerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Ignore clicks that originate on the handle, which has its own handler.
      if (event.target !== event.currentTarget) return;
      setPosition(positionFromEvent(event));
    },
    [positionFromEvent]
  );

  /** Keyboard accessibility: arrow keys nudge the divider by 1% (10% with Shift). */
  const onHandleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const step = event.shiftKey ? 10 : 1;
      const delta =
        event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -step
          : event.key === "ArrowRight" || event.key === "ArrowDown"
            ? step
            : 0;
      if (event.key === "Home") {
        setPosition(0);
        event.preventDefault();
        return;
      }
      if (event.key === "End") {
        setPosition(100);
        event.preventDefault();
        return;
      }
      if (delta === 0) return;
      event.preventDefault();
      setPosition((current) => clampPercent(current + delta));
    },
    []
  );

  /**
   * The "after" surface is the one revealed as the slider moves; the
   * "before" surface sits behind it. The clip-path keeps the other half of
   * the canvas visible.
   */
  const isVertical = orientation === "vertical";
  const afterClip: CSSProperties = isVertical
    ? { clipPath: `inset(0 0 0 ${position}%)` }
    : { clipPath: `inset(${position}% 0 0 0)` };
  const handleStyle: CSSProperties = isVertical ? { left: `${position}%` } : { top: `${position}%` };

  return (
    <div
      role="group"
      aria-label="Before and after comparison"
      className={cn(
        "relative isolate select-none overflow-hidden rounded-lg border border-border/60 bg-muted/30",
        className
      )}
      onPointerDown={onContainerPointerDown}
    >
      {/* Before surface: full container, visible where the after is clipped. */}
      <div className="absolute inset-0">
        {before}
        {beforeLabel && <Label position="before" />}
      </div>

      {/* After surface: clipped so only the leading half is visible. */}
      <div className="absolute inset-0" style={afterClip}>
        {after}
        {afterLabel && <Label position="after" />}
      </div>

      {/* Divider line. Drawn as a 2px bar with a soft drop shadow so it
          reads on both light and dark content. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute z-10 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]",
          isVertical ? "top-0 h-full w-[2px] -translate-x-1/2" : "left-0 h-[2px] w-full -translate-y-1/2"
        )}
        style={handleStyle}
      />

      {/* Handle: the draggable button on the divider. */}
      <button
        type="button"
        role="slider"
        aria-label="Compare slider position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-orientation={orientation}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onHandleKeyDown}
        className={cn(
          "absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging && "scale-110"
        )}
        style={handleStyle}
      >
        <HandleGlyph orientation={orientation} />
      </button>
    </div>
  );
}

/**
 * Renders the chevron glyph in the handle. Two short arrows, one for each
 * direction, so the slider's intent is obvious in any orientation.
 */
function HandleGlyph({ orientation }: { orientation: CompareOrientation }) {
  if (orientation === "vertical") {
    return (
      <span className="flex items-center gap-0.5 text-foreground" aria-hidden="true">
        <span className="block h-3 w-1.5 border-y border-l border-current" />
        <span className="block h-3 w-1.5 border-y border-r border-current" />
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center gap-0.5 text-foreground" aria-hidden="true">
      <span className="block h-1.5 w-3 border-x border-t border-current" />
      <span className="block h-1.5 w-3 border-x border-b border-current" />
    </span>
  );
}

/**
 * Floating caption that identifies the "before" or "after" side.
 *
 * Kept out of the slider's flow so positioning is independent of layout.
 * Uses pointer-events-none because clicking through it to the rail is part
 * of how the slider is meant to be used.
 */
function Label({ position }: { position: "before" | "after" }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm"
    >
      {position === "before" ? "Before" : "After"}
    </span>
  );
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, value));
}
