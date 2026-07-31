"use client";

/**
 * Batch Converter inspector.
 *
 * Only formats the running browser can genuinely encode are offered — the
 * shell probes for support at load and passes the result in, so the UI never
 * promises an AVIF it would silently hand back as a PNG.
 */

import { FileArchive, Layers, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONVERT_FORMATS,
  RESIZE_PRESETS,
  convertDescriptor,
  formatBytes,
  type ConvertFormat,
  type ConvertSettings,
  type ResizeMode,
} from "@/lib/imagepilot/core";
import {
  ColorField,
  FieldRow,
  NumberField,
  PanelSection,
  SegmentedControl,
  SelectField,
  SliderField,
  ToggleField,
} from "./editor-controls";
import type { BatchEntry } from "./compress-panel";

interface ConvertPanelProps {
  settings: ConvertSettings;
  supported: Set<ConvertFormat>;
  batch: BatchEntry[];
  busy: boolean;
  /** 0..100 while a run is in progress, null when idle. */
  progress: number | null;
  /** Bytes produced by the last completed run. */
  lastRun: { count: number; bytes: number; originalBytes: number } | null;
  onChange: (patch: Partial<ConvertSettings>) => void;
  onAddImages: () => void;
  onRun: () => void;
  onClear: () => void;
}

export function ConvertPanel({
  settings,
  supported,
  batch,
  busy,
  progress,
  lastRun,
  onChange,
  onAddImages,
  onRun,
  onClear,
}: ConvertPanelProps) {
  const descriptor = convertDescriptor(settings.format);
  const available = CONVERT_FORMATS.filter((format) => supported.has(format.value));

  return (
    <>
      <PanelSection title="Output format">
        <div className="grid grid-cols-2 gap-1.5">
          {available.map((format) => (
            <button
              key={format.value}
              type="button"
              disabled={busy}
              aria-pressed={settings.format === format.value}
              onClick={() => onChange({ format: format.value })}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                settings.format === format.value
                  ? "border-primary bg-primary/10"
                  : "border-border/60 text-muted-foreground hover:bg-accent",
                busy && "opacity-50"
              )}
            >
              {format.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {descriptor.description}
        </p>

        {CONVERT_FORMATS.length !== available.length && (
          <p className="text-[10px] leading-relaxed text-muted-foreground/80">
            {CONVERT_FORMATS.filter((format) => !supported.has(format.value))
              .map((format) => format.label)
              .join(" and ")}{" "}
            {CONVERT_FORMATS.length - available.length === 1 ? "is" : "are"} not supported by this
            browser, so {CONVERT_FORMATS.length - available.length === 1 ? "it is" : "they are"}{" "}
            hidden. TIFF can be read but not written by any browser.
          </p>
        )}

        {descriptor.supportsQuality && (
          <SliderField
            label="Quality"
            value={settings.quality}
            min={1}
            max={100}
            neutral={85}
            unit="%"
            disabled={busy}
            onChange={(quality) => onChange({ quality })}
          />
        )}

        {!descriptor.supportsAlpha && (
          <ColorField
            label="Background for transparency"
            value={settings.background}
            disabled={busy}
            onChange={(background) => onChange({ background })}
          />
        )}
      </PanelSection>

      <PanelSection title="Resize">
        <SegmentedControl
          label="Mode"
          value={settings.resizeMode}
          disabled={busy}
          options={[
            { value: "none" as ResizeMode, label: "Keep" },
            { value: "longest" as ResizeMode, label: "Fit" },
            { value: "percent" as ResizeMode, label: "Scale" },
            { value: "exact" as ResizeMode, label: "Exact" },
          ]}
          onChange={(resizeMode) => onChange({ resizeMode })}
        />

        {settings.resizeMode === "longest" && (
          <>
            <SelectField
              label="Longest edge"
              value={String(settings.longestEdge)}
              disabled={busy}
              options={RESIZE_PRESETS.map((preset) => ({
                value: String(preset.value),
                label: preset.label,
              }))}
              onChange={(value) => onChange({ longestEdge: Number(value) })}
            />
            <p className="text-[11px] text-muted-foreground">
              Images already smaller than this are left alone.
            </p>
          </>
        )}

        {settings.resizeMode === "percent" && (
          <SliderField
            label="Scale"
            value={settings.percent}
            min={5}
            max={400}
            step={5}
            neutral={100}
            unit="%"
            disabled={busy}
            onChange={(percent) => onChange({ percent })}
          />
        )}

        {settings.resizeMode === "exact" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Width"
                value={settings.exactWidth}
                min={1}
                max={8192}
                suffix="px"
                disabled={busy}
                onChange={(exactWidth) => onChange({ exactWidth })}
              />
              <NumberField
                label="Height"
                value={settings.exactHeight}
                min={1}
                max={8192}
                suffix="px"
                disabled={busy}
                onChange={(exactHeight) => onChange({ exactHeight })}
              />
            </div>
            <ToggleField
              label="Keep aspect ratio"
              hint="Fits inside the box instead of stretching"
              checked={settings.preserveAspect}
              disabled={busy}
              onChange={(preserveAspect) => onChange({ preserveAspect })}
            />
          </>
        )}
      </PanelSection>

      <PanelSection title="Rename">
        <FieldRow label="Pattern" htmlFor="convert-pattern">
          <input
            id="convert-pattern"
            value={settings.namePattern}
            disabled={busy}
            onChange={(event) => onChange({ namePattern: event.target.value })}
            className="h-8 w-full rounded-lg border border-border/60 bg-background px-2 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </FieldRow>

        <div className="flex flex-wrap gap-1">
          {["{name}", "{n}", "{nnn}", "{w}x{h}", "{date}"].map((token) => (
            <button
              key={token}
              type="button"
              disabled={busy}
              onClick={() => onChange({ namePattern: `${settings.namePattern}${token}` })}
              className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {token}
            </button>
          ))}
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          <span className="font-mono">{"{name}"}</span> original name ·{" "}
          <span className="font-mono">{"{n}"}</span> number ·{" "}
          <span className="font-mono">{"{nnn}"}</span> padded ·{" "}
          <span className="font-mono">{"{w}"}</span>/<span className="font-mono">{"{h}"}</span> size
          · <span className="font-mono">{"{date}"}</span> today
        </p>

        {batch.length > 0 && (
          <p className="truncate rounded bg-muted/50 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            {batch[0].name.replace(/\.[^.]+$/, "")} → preview.{descriptor.extension}
          </p>
        )}
      </PanelSection>

      <PanelSection title="Convert">
        <button
          type="button"
          onClick={onAddImages}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          {batch.length ? `${batch.length} image${batch.length === 1 ? "" : "s"} queued` : "Add images"}
        </button>

        {batch.length > 0 && (
          <ul className="max-h-32 space-y-1 overflow-y-auto">
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
                    {formatBytes(entry.resultBytes)}
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
        )}

        {progress !== null && (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
              />
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {Math.round(progress)}% complete
            </p>
          </div>
        )}

        {lastRun && progress === null && (
          <div className="rounded-lg bg-muted/50 p-2.5 text-[11px]">
            <p>
              <span className="font-semibold">{lastRun.count}</span>{" "}
              {lastRun.count === 1 ? "image" : "images"} converted ·{" "}
              {formatBytes(lastRun.bytes)}
            </p>
            {lastRun.originalBytes > 0 && (
              <p className="mt-0.5 text-muted-foreground">
                from {formatBytes(lastRun.originalBytes)} originally
              </p>
            )}
          </div>
        )}

        {batch.length > 0 && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <FileArchive className="h-3.5 w-3.5" aria-hidden="true" />
              Convert and download ZIP
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              aria-label="Clear the queue"
              className="rounded-lg border border-border/60 px-2 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          A single image downloads on its own; several are packaged into a ZIP.
        </p>
      </PanelSection>
    </>
  );
}
