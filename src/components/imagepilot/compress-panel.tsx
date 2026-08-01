"use client";

/**
 * Image Compressor inspector.
 *
 * Shows the settings, a live before/after readout for the current image, and
 * the batch queue. The actual encoding lives in `@/lib/imagepilot/compress` so
 * the single-image preview and the batch run cannot drift apart.
 */

import { Download, FileDown, Layers, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIMENSION_PRESETS,
  TARGET_SIZE_PRESETS,
  formatBytes,
  isLossless,
  savingsPercent,
  type CompressFormat,
  type CompressionSettings,
} from "@/lib/imagepilot/core";
import {
  PanelSection,
  SegmentedControl,
  SelectField,
  SliderField,
  ToggleField,
} from "./editor-controls";

/** One entry in the batch queue, with its result once processed. */
export interface BatchEntry {
  id: string;
  name: string;
  originalBytes: number;
  status: "pending" | "done" | "failed";
  resultBytes?: number;
  error?: string;
}

interface CompressPanelProps {
  settings: CompressionSettings;
  /** Size of the currently previewed image, before and after. */
  originalBytes: number;
  previewBytes: number | null;
  previewing: boolean;
  missedTarget: boolean;
  achievedQuality: number | null;
  outputSize: { width: number; height: number } | null;
  batch: BatchEntry[];
  busy: boolean;
  onChange: (patch: Partial<CompressionSettings>) => void;
  onAddBatchImages: () => void;
  onRunBatch: () => void;
  onClearBatch: () => void;
  onDownload: () => void;
}

export function CompressPanel({
  settings,
  originalBytes,
  previewBytes,
  previewing,
  missedTarget,
  achievedQuality,
  outputSize,
  batch,
  busy,
  onChange,
  onAddBatchImages,
  onRunBatch,
  onClearBatch,
  onDownload,
}: CompressPanelProps) {
  const lossless = isLossless(settings.format);
  const savings = previewBytes !== null ? savingsPercent(originalBytes, previewBytes) : null;
  const useTarget = settings.targetBytes !== null;

  return (
    <>
      <PanelSection title="Output">
        <SegmentedControl
          label="Format"
          value={settings.format}
          disabled={busy}
          options={[
            { value: "jpeg" as CompressFormat, label: "JPG" },
            { value: "png" as CompressFormat, label: "PNG" },
            { value: "webp" as CompressFormat, label: "WEBP" },
          ]}
          onChange={(format) => onChange({ format })}
        />

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {settings.format === "png"
            ? "PNG is lossless: quality is fixed and transparency is preserved. Best for graphics and screenshots."
            : settings.format === "webp"
              ? "WEBP keeps transparency and is typically 25–35% smaller than JPG at the same quality."
              : "JPG is smallest for photographs. Transparency is flattened onto white."}
        </p>

        {!lossless && (
          <>
            <ToggleField
              label="Compress to a target size"
              hint="Searches for the highest quality that fits"
              checked={useTarget}
              disabled={busy}
              onChange={(checked) =>
                onChange({ targetBytes: checked ? 200 * 1024 : null })
              }
            />

            {useTarget ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {TARGET_SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={busy}
                      onClick={() => onChange({ targetBytes: preset.bytes })}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px] transition-colors",
                        settings.targetBytes === preset.bytes
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 text-muted-foreground hover:bg-accent",
                        busy && "opacity-50"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <SliderField
                  label="Target size"
                  value={Math.round((settings.targetBytes ?? 0) / 1024)}
                  min={10}
                  max={5120}
                  step={10}
                  unit="KB"
                  disabled={busy}
                  onChange={(value) => onChange({ targetBytes: value * 1024 })}
                />
              </div>
            ) : (
              <SliderField
                label="Quality"
                value={settings.quality}
                min={1}
                max={100}
                neutral={80}
                unit="%"
                disabled={busy}
                onChange={(quality) => onChange({ quality })}
              />
            )}
          </>
        )}

        <SelectField
          label="Maximum dimension"
          value={settings.maxDimension === null ? "none" : String(settings.maxDimension)}
          disabled={busy}
          options={DIMENSION_PRESETS.map((preset) => ({
            value: preset.value === null ? "none" : String(preset.value),
            label: preset.label,
          }))}
          onChange={(value) =>
            onChange({ maxDimension: value === "none" ? null : Number(value) })
          }
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Resizing is often the largest single saving. The aspect ratio is always preserved.
        </p>
      </PanelSection>

      <PanelSection title="Result">
        {previewing ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Compressing preview…
          </p>
        ) : previewBytes === null ? (
          <p className="text-xs text-muted-foreground">
            Import an image to see the compressed size.
          </p>
        ) : (
          <>
            <div className="space-y-2 rounded-lg bg-muted/50 p-2.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Original</span>
                <span className="tabular-nums">{formatBytes(originalBytes)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Compressed</span>
                <span className="font-semibold tabular-nums">{formatBytes(previewBytes)}</span>
              </div>

              {/* Proportional bar so the saving is visible at a glance. */}
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.max(2, Math.min(100, (previewBytes / Math.max(1, originalBytes)) * 100))}%`,
                  }}
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                {savings !== null && savings > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{savings}% smaller</span> than the
                    original
                  </>
                ) : (
                  "No reduction at these settings — try a lower quality or a smaller dimension."
                )}
              </p>

              {outputSize && (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {outputSize.width} × {outputSize.height} px
                  {achievedQuality !== null && !lossless && ` · quality ${achievedQuality}`}
                </p>
              )}
            </div>

            {missedTarget && (
              <p className="rounded-lg bg-destructive/10 p-2 text-[11px] leading-relaxed text-destructive">
                The target size could not be reached even at the lowest quality. Reduce the maximum
                dimension, or choose a larger target.
              </p>
            )}

            <button
              type="button"
              onClick={onDownload}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download compressed image
            </button>
          </>
        )}
      </PanelSection>

      <PanelSection title="Batch">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Compress many images with these settings. Each is processed on your device and downloaded
          as it finishes.
        </p>

        <button
          type="button"
          onClick={onAddBatchImages}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          {batch.length ? `${batch.length} image${batch.length === 1 ? "" : "s"} queued` : "Add images"}
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
                  {entry.status === "done" && entry.resultBytes !== undefined ? (
                    <span className="shrink-0 tabular-nums text-primary">
                      −{savingsPercent(entry.originalBytes, entry.resultBytes)}%
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                Compress all
              </button>
              <button
                type="button"
                onClick={onClearBatch}
                disabled={busy}
                aria-label="Clear the batch queue"
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
