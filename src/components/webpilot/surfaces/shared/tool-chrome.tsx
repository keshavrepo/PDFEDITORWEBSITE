"use client";

/**
 * Shared tool chrome for every WebPilot tool surface.
 *
 * The same toolbar that sits at the top of every tool: a row of
 * action buttons, an optional title, and a small status row. The
 * chrome is intentionally minimal so a new tool can mount the
 * full set of standard actions (copy, download, favourite,
 * delete) with a few lines of props.
 *
 * Mirrors the design language used by OfficePilot, SocialPilot,
 * FinancePilot and DevPilot so every LaunchStack product looks
 * the same to the user.
 */

import type { ReactNode } from "react";
import { Download, Star, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolChromeProps {
  title: string;
  description?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onCopy?: () => void;
  copyLabel?: string;
  copyDisabled?: boolean;
  onDownload?: () => void;
  downloadLabel?: string;
  downloadDisabled?: boolean;
  onDelete?: () => void;
  /** Extra actions mounted between copy and download. */
  extraActions?: ReactNode;
  /** Mounted below the title row, e.g. for a status or summary line. */
  status?: ReactNode;
}

export function ToolChrome({
  title,
  description,
  isFavorite,
  onToggleFavorite,
  onCopy,
  copyLabel = "Copy",
  copyDisabled,
  onDownload,
  downloadLabel = "Download",
  downloadDisabled,
  onDelete,
  extraActions,
  status,
}: ToolChromeProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {description && (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {extraActions}
          {onCopy && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={onCopy}
              disabled={copyDisabled}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copyLabel}
            </Button>
          )}
          {onDownload && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={onDownload}
              disabled={downloadDisabled}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {downloadLabel}
            </Button>
          )}
          {onToggleFavorite && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-8 gap-1.5 px-2.5 text-xs",
                isFavorite && "text-primary"
              )}
              onClick={onToggleFavorite}
              aria-label={isFavorite ? "Unfavourite" : "Favourite"}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  isFavorite && "fill-primary text-primary"
                )}
                aria-hidden="true"
              />
              {isFavorite ? "Favourited" : "Favourite"}
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={onDelete}
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>
      {status && <div className="text-[11px] text-muted-foreground">{status}</div>}
    </div>
  );
}
