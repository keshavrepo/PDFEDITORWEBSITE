"use client";

/**
 * Shared drop zone component.
 *
 * Renders an overlay that highlights when the user is dragging
 * files over the wrapped content, and forwards dropped files
 * to the parent's `onFiles` callback. The drop zone reuses the
 * `useFileDrop` hook so every surface has the same drag &
 * drop behaviour.
 *
 * The component is a small presentational wrapper. Surfaces
 * pass the file input trigger as a child (so the click-to-open
 * file picker is unchanged) and an `onFiles` callback that
 * does whatever the surface did with the file input change.
 */

import { useFileDrop } from "@/lib/audiopilot/hooks/useFileDrop";
import { cn } from "@/lib/utils";

export interface DropZoneProps {
  /** Files the user dropped or selected. */
  onFiles: (files: File[]) => void;
  /** Whether the drop zone is currently accepting drops. */
  enabled?: boolean;
  /** Whether to accept multiple files at once. */
  multiple?: boolean;
  /** Optional MIME prefix filter. Default `"audio/"`. */
  acceptPrefix?: string;
  /** The wrapped content (typically the surface's main body). */
  children: React.ReactNode;
  /** Optional className for the wrapper. */
  className?: string;
}

export function DropZone({
  onFiles,
  enabled = true,
  multiple = true,
  acceptPrefix = "audio/",
  children,
  className,
}: DropZoneProps) {
  const { dropZoneProps, isDragging } = useFileDrop({
    onFiles,
    enabled,
    multiple,
    acceptPrefix,
  });
  return (
    <div
      className={cn("relative", className)}
      {...dropZoneProps}
      data-testid="audio-drop-zone"
    >
      {children}
      {isDragging && enabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary"
        >
          Drop audio files to import
        </div>
      )}
    </div>
  );
}
