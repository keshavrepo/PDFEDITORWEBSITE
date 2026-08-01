"use client";

/**
 * Metadata Cleaner inspector.
 *
 * Shows exactly what a file carries before anything is removed. Being specific
 * — "GPS latitude: 51.5" rather than "location data" — is the point: people
 * are usually surprised by what is in their photos, and a vague summary does
 * not convey that.
 */

import { AlertTriangle, Download, Layers, MapPin, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  METADATA_CATEGORIES,
  formatBytes,
  groupByCategory,
  type CleanOptions,
  type MetadataReport,
} from "@/lib/imagepilot/core";
import { PanelSection, ToggleField } from "./editor-controls";
import type { BatchEntry } from "./compress-panel";

interface MetadataPanelProps {
  report: MetadataReport | null;
  options: CleanOptions;
  fileName: string | null;
  batch: BatchEntry[];
  busy: boolean;
  onChange: (patch: Partial<CleanOptions>) => void;
  onClean: () => void;
  onAddBatchImages: () => void;
  onRunBatch: () => void;
  onClearBatch: () => void;
}

export function MetadataPanel({
  report,
  options,
  fileName,
  batch,
  busy,
  onChange,
  onClean,
  onAddBatchImages,
  onRunBatch,
  onClearBatch,
}: MetadataPanelProps) {
  const groups = report ? groupByCategory(report.entries) : [];
  const hasMetadata = Boolean(report?.entries.length);

  return (
    <>
      <PanelSection title="What is in this file">
        {!report ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Import a photo to see the metadata it carries. Nothing is uploaded — the file is read
            on your device.
          </p>
        ) : (
          <>
            <div className="rounded-lg bg-muted/50 p-2.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground" title={fileName ?? ""}>
                  {fileName ?? "Image"}
                </span>
                <span className="shrink-0 uppercase tabular-nums text-muted-foreground">
                  {report.format}
                </span>
              </div>
              <p className="mt-1.5 text-xs">
                {hasMetadata ? (
                  <>
                    <span className="font-semibold">{report.entries.length}</span> metadata{" "}
                    {report.entries.length === 1 ? "entry" : "entries"} ·{" "}
                    {formatBytes(report.metadataBytes)}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    No removable metadata found — this file is already clean.
                  </span>
                )}
              </p>
            </div>

            {report.hasLocation && (
              <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-[11px] leading-relaxed text-destructive">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  This photo records where it was taken. GPS coordinates are often accurate to a
                  few metres.
                </span>
              </p>
            )}

            {groups.map((group) => (
              <div key={group.category}>
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h4>
                <dl className="space-y-0.5">
                  {group.entries.slice(0, 10).map((entry, index) => (
                    <div
                      key={`${entry.label}-${index}`}
                      className="flex items-baseline justify-between gap-2 text-[11px]"
                    >
                      <dt className="shrink-0 text-muted-foreground">{entry.label}</dt>
                      <dd className="min-w-0 truncate text-right" title={entry.value}>
                        {entry.value}
                      </dd>
                    </div>
                  ))}
                  {group.entries.length > 10 && (
                    <p className="text-[10px] text-muted-foreground">
                      and {group.entries.length - 10} more
                    </p>
                  )}
                </dl>
              </div>
            ))}
          </>
        )}
      </PanelSection>

      <PanelSection title="What to remove">
        {METADATA_CATEGORIES.map((category) => (
          <ToggleField
            key={category.key}
            label={category.label}
            hint={category.description}
            checked={options[category.key]}
            disabled={busy}
            onChange={(checked) => onChange({ [category.key]: checked } as Partial<CleanOptions>)}
          />
        ))}

        {options.removeColorProfile && (
          <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
            <span>
              Removing the colour profile can make colours look different in other applications.
            </span>
          </p>
        )}

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Removal rewrites the container and copies the image data untouched, so there is no
            recompression and no quality loss.
          </span>
        </p>

        <button
          type="button"
          onClick={onClean}
          disabled={busy || !hasMetadata}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download cleaned image
        </button>
      </PanelSection>

      <PanelSection title="Batch">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Clean many files at once with the same choices. Each is downloaded as it finishes.
        </p>

        <button
          type="button"
          onClick={onAddBatchImages}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          {batch.length ? `${batch.length} file${batch.length === 1 ? "" : "s"} queued` : "Add images"}
        </button>

        {batch.length > 0 && (
          <>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {batch.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate" title={entry.name}>
                    {entry.name}
                  </span>
                  {entry.status === "done" ? (
                    <span className="shrink-0 tabular-nums text-primary">
                      −{formatBytes(Math.max(0, entry.originalBytes - (entry.resultBytes ?? 0)))}
                    </span>
                  ) : entry.status === "failed" ? (
                    <span className="shrink-0 text-destructive">failed</span>
                  ) : (
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatBytes(entry.originalBytes)}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onRunBatch}
                disabled={busy}
                className={cn(
                  "flex-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground",
                  "transition-opacity hover:opacity-90 disabled:opacity-50"
                )}
              >
                Clean all
              </button>
              <button
                type="button"
                onClick={onClearBatch}
                disabled={busy}
                aria-label="Clear the queue"
                className="rounded-lg border border-border/60 px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </PanelSection>
    </>
  );
}
