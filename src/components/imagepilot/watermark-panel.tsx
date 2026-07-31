"use client";

/**
 * Watermark Studio inspector.
 *
 * Edits a settings object; the editor shell turns that into real layers via
 * `applyWatermark`, so the preview on the canvas is the finished artwork
 * rather than an approximation of it. Batch runs feed the identical settings
 * through the identical builder.
 */

import { Grid2x2, Image as ImageIcon, Layers, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  WATERMARK_POSITIONS,
  type WatermarkSettings,
} from "@/lib/imagepilot/core";
import {
  ColorField,
  FieldRow,
  PanelSection,
  SegmentedControl,
  SelectField,
  SliderField,
} from "./editor-controls";

interface WatermarkPanelProps {
  settings: WatermarkSettings;
  /** Number of images queued for a batch run, 0 when working on one image. */
  batchCount: number;
  hasLogo: boolean;
  busy: boolean;
  onChange: (patch: Partial<WatermarkSettings>) => void;
  onChooseLogo: () => void;
  onAddBatchImages: () => void;
  onRunBatch: () => void;
  onClearBatch: () => void;
}

export function WatermarkPanel({
  settings,
  batchCount,
  hasLogo,
  busy,
  onChange,
  onChooseLogo,
  onAddBatchImages,
  onRunBatch,
  onClearBatch,
}: WatermarkPanelProps) {
  return (
    <>
      <PanelSection title="Watermark">
        <SegmentedControl
          label="Type"
          value={settings.kind}
          disabled={busy}
          options={[
            { value: "text", label: "Text", icon: <Type className="h-3.5 w-3.5" /> },
            { value: "image", label: "Logo", icon: <ImageIcon className="h-3.5 w-3.5" /> },
          ]}
          onChange={(kind) => onChange({ kind })}
        />

        {settings.kind === "text" ? (
          <>
            <FieldRow label="Text" htmlFor="watermark-text">
              <input
                id="watermark-text"
                value={settings.text}
                disabled={busy}
                onChange={(event) => onChange({ text: event.target.value })}
                className="h-8 w-full rounded-lg border border-border/60 bg-background px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
            </FieldRow>

            <SelectField
              label="Font"
              value={settings.fontFamily}
              disabled={busy}
              options={FONT_FAMILIES.map((font) => ({ value: font.value, label: font.label }))}
              onChange={(fontFamily) => onChange({ fontFamily })}
            />

            <SelectField
              label="Weight"
              value={settings.fontWeight}
              disabled={busy}
              options={FONT_WEIGHTS.map((weight) => ({ value: weight, label: String(weight) }))}
              onChange={(fontWeight) => onChange({ fontWeight })}
            />

            <ColorField
              label="Colour"
              value={settings.color}
              disabled={busy}
              onChange={(color) => onChange({ color })}
            />

            <SliderField
              label="Outline"
              value={settings.strokeWidth}
              min={0}
              max={12}
              step={0.5}
              neutral={0}
              unit="px"
              disabled={busy}
              onChange={(strokeWidth) => onChange({ strokeWidth })}
            />
            {settings.strokeWidth > 0 && (
              <ColorField
                label="Outline colour"
                value={settings.strokeColor}
                disabled={busy}
                onChange={(strokeColor) => onChange({ strokeColor })}
              />
            )}
          </>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onChooseLogo}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              {hasLogo ? "Replace logo" : "Choose a logo image"}
            </button>
            {!hasLogo && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                A PNG with a transparent background works best.
              </p>
            )}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Placement">
        {/* Nine-point grid, which reads faster than a dropdown of positions. */}
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Position</span>
          <div className="grid w-fit grid-cols-3 gap-1">
            {WATERMARK_POSITIONS.filter((entry) => entry.value !== "tile").map((entry) => (
              <button
                key={entry.value}
                type="button"
                disabled={busy}
                aria-label={entry.label}
                aria-pressed={settings.position === entry.value}
                title={entry.label}
                onClick={() => onChange({ position: entry.value })}
                className={cn(
                  "h-7 w-7 rounded-md border transition-colors",
                  settings.position === entry.value
                    ? "border-primary bg-primary/15"
                    : "border-border/60 hover:bg-accent",
                  busy && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "mx-auto block h-1.5 w-1.5 rounded-full",
                    settings.position === entry.value ? "bg-primary" : "bg-muted-foreground/40"
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          aria-pressed={settings.position === "tile"}
          onClick={() => onChange({ position: "tile" })}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
            settings.position === "tile"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:bg-accent",
            busy && "opacity-50"
          )}
        >
          <Grid2x2 className="h-3.5 w-3.5" aria-hidden="true" />
          Tile across the image
        </button>

        {settings.position === "tile" && (
          <SliderField
            label="Tile spacing"
            value={Math.round(settings.tileGap * 100)}
            min={0}
            max={300}
            neutral={60}
            unit="%"
            disabled={busy}
            onChange={(value) => onChange({ tileGap: value / 100 })}
          />
        )}

        {settings.position !== "tile" && (
          <SliderField
            label="Margin"
            value={Math.round(settings.margin * 100)}
            min={0}
            max={25}
            neutral={4}
            unit="%"
            disabled={busy}
            onChange={(value) => onChange({ margin: value / 100 })}
          />
        )}
      </PanelSection>

      <PanelSection title="Appearance">
        <SliderField
          label="Opacity"
          value={Math.round(settings.opacity * 100)}
          min={2}
          max={100}
          neutral={45}
          unit="%"
          disabled={busy}
          onChange={(value) => onChange({ opacity: value / 100 })}
        />
        <SliderField
          label="Size"
          value={Math.round(settings.scale * 1000) / 10}
          min={1}
          max={40}
          step={0.5}
          neutral={8}
          unit="%"
          disabled={busy}
          onChange={(value) => onChange({ scale: value / 100 })}
        />
        <SliderField
          label="Rotation"
          value={settings.rotation}
          min={-180}
          max={180}
          neutral={0}
          unit="°"
          disabled={busy}
          onChange={(rotation) => onChange({ rotation })}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Size is a percentage of the image&rsquo;s shorter side, so one setting looks consistent
          across images of different resolutions.
        </p>
      </PanelSection>

      <PanelSection title="Batch">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Apply these exact settings to many images at once. Each is processed on your device and
          downloaded individually.
        </p>

        <button
          type="button"
          onClick={onAddBatchImages}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          {batchCount ? `${batchCount} image${batchCount === 1 ? "" : "s"} queued` : "Add images"}
        </button>

        {batchCount > 0 && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onRunBatch}
              disabled={busy}
              className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Watermark all
            </button>
            <button
              type="button"
              onClick={onClearBatch}
              disabled={busy}
              className="rounded-lg border border-border/60 px-2 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        )}
      </PanelSection>
    </>
  );
}
