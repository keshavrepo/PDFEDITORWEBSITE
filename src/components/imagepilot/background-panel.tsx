"use client";

/**
 * Background Remover inspector.
 *
 * Drives the matting settings, the refinement brush and what the subject is
 * placed over. The heavy lifting lives in `@/lib/imagepilot/segmentation`, so
 * this file stays a control surface.
 */

import { Brush, Eraser, Image as ImageIcon, Layers, RotateCcw, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrushMode, RemovalSettings } from "@/lib/imagepilot/core";
import {
  ColorField,
  PanelSection,
  SegmentedControl,
  SliderField,
  ToggleField,
} from "./editor-controls";

export type BackdropMode = "transparent" | "colour" | "image";

interface BackgroundPanelProps {
  settings: RemovalSettings;
  backdrop: BackdropMode;
  backdropColor: string;
  hasBackdropImage: boolean;
  brushMode: BrushMode;
  brushSize: number;
  brushActive: boolean;
  showMask: boolean;
  compare: boolean;
  removedPercent: number | null;
  working: boolean;
  busy: boolean;
  onChange: (patch: Partial<RemovalSettings>) => void;
  onBackdropChange: (mode: BackdropMode) => void;
  onBackdropColorChange: (color: string) => void;
  onChooseBackdropImage: () => void;
  onBrushModeChange: (mode: BrushMode) => void;
  onBrushSizeChange: (size: number) => void;
  onToggleBrush: (active: boolean) => void;
  onToggleMask: (show: boolean) => void;
  onToggleCompare: (compare: boolean) => void;
  onRecompute: () => void;
  onResetBrush: () => void;
}

export function BackgroundPanel({
  settings,
  backdrop,
  backdropColor,
  hasBackdropImage,
  brushMode,
  brushSize,
  brushActive,
  showMask,
  compare,
  removedPercent,
  working,
  busy,
  onChange,
  onBackdropChange,
  onBackdropColorChange,
  onChooseBackdropImage,
  onBrushModeChange,
  onBrushSizeChange,
  onToggleBrush,
  onToggleMask,
  onToggleCompare,
  onRecompute,
  onResetBrush,
}: BackgroundPanelProps) {
  const disabled = busy || working;

  return (
    <>
      <PanelSection title="Cut out">
        {removedPercent === null ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Import a photo to remove its background. Works best on a plain or gently graded
            backdrop — a product shot, a headshot or a graphic.
          </p>
        ) : (
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-xs">
              <span className="font-semibold">{removedPercent}%</span> of the image removed
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Check the edges at 100% zoom. Use the brush below to fix anything the automatic
              pass missed.
            </p>
          </div>
        )}

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onToggleCompare(!compare)}
            disabled={disabled}
            aria-pressed={compare}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              compare
                ? "border-primary bg-primary/10"
                : "border-border/60 text-muted-foreground hover:bg-accent",
              disabled && "opacity-50"
            )}
          >
            Before / after
          </button>
          <button
            type="button"
            onClick={() => onToggleMask(!showMask)}
            disabled={disabled}
            aria-pressed={showMask}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              showMask
                ? "border-primary bg-primary/10"
                : "border-border/60 text-muted-foreground hover:bg-accent",
              disabled && "opacity-50"
            )}
          >
            Show mask
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Edge quality">
        <SliderField
          label="Tolerance"
          value={settings.tolerance}
          min={1}
          max={100}
          neutral={28}
          disabled={disabled}
          onChange={(tolerance) => onChange({ tolerance })}
        />
        <SliderField
          label="Edge softness"
          value={settings.softness}
          min={0}
          max={100}
          neutral={55}
          unit="%"
          disabled={disabled}
          onChange={(softness) => onChange({ softness })}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Softness controls how wide the uncertain band around the subject is. A wider band keeps
          more hair, but can leave a faint halo on hard-edged subjects.
        </p>

        <SliderField
          label="Edge shift"
          value={settings.edgeShift}
          min={-10}
          max={10}
          neutral={0}
          unit="px"
          disabled={disabled}
          onChange={(edgeShift) => onChange({ edgeShift })}
        />
        <SliderField
          label="Feather"
          value={settings.feather}
          min={0}
          max={10}
          neutral={1}
          unit="px"
          disabled={disabled}
          onChange={(feather) => onChange({ feather })}
        />
        <SliderField
          label="Despeckle"
          value={settings.despeckle}
          min={0}
          max={200}
          step={2}
          neutral={24}
          unit="px"
          disabled={disabled}
          onChange={(despeckle) => onChange({ despeckle })}
        />

        <ToggleField
          label="Only remove connected background"
          hint="Protects enclosed areas that happen to match the backdrop"
          checked={settings.edgeConnectedOnly}
          disabled={disabled}
          onChange={(edgeConnectedOnly) => onChange({ edgeConnectedOnly })}
        />
        <ToggleField
          label="Remove colour spill"
          hint="Pulls backdrop colour out of semi-transparent edges"
          checked={settings.decontaminate}
          disabled={disabled}
          onChange={(decontaminate) => onChange({ decontaminate })}
        />

        <button
          type="button"
          onClick={onRecompute}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          Re-detect background
        </button>
      </PanelSection>

      <PanelSection title="Refine by hand">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Automatic detection will always miss something. Paint on the canvas to bring a region
          back or take more away.
        </p>

        <button
          type="button"
          onClick={() => onToggleBrush(!brushActive)}
          disabled={disabled}
          aria-pressed={brushActive}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
            brushActive
              ? "border-primary bg-primary/10"
              : "border-border/60 text-muted-foreground hover:bg-accent",
            disabled && "opacity-50"
          )}
        >
          <Brush className="h-3.5 w-3.5" aria-hidden="true" />
          {brushActive ? "Brush is active" : "Use the brush"}
        </button>

        {brushActive && (
          <>
            <SegmentedControl
              label="Mode"
              value={brushMode}
              disabled={disabled}
              options={[
                { value: "restore" as BrushMode, label: "Restore", icon: <Brush className="h-3.5 w-3.5" /> },
                { value: "erase" as BrushMode, label: "Erase", icon: <Eraser className="h-3.5 w-3.5" /> },
              ]}
              onChange={onBrushModeChange}
            />
            <SliderField
              label="Brush size"
              value={brushSize}
              min={4}
              max={200}
              neutral={40}
              unit="px"
              disabled={disabled}
              onChange={onBrushSizeChange}
            />
            <button
              type="button"
              onClick={onResetBrush}
              disabled={disabled}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 px-2 py-1.5 text-[11px] transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Discard brush strokes
            </button>
          </>
        )}
      </PanelSection>

      <PanelSection title="New background">
        <SegmentedControl
          label="Place the subject on"
          value={backdrop}
          disabled={disabled}
          options={[
            { value: "transparent" as BackdropMode, label: "None" },
            { value: "colour" as BackdropMode, label: "Colour" },
            { value: "image" as BackdropMode, label: "Image" },
          ]}
          onChange={onBackdropChange}
        />

        {backdrop === "transparent" && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Exports as a transparent PNG. JPG has no alpha channel, so choose PNG or WEBP in the
            export dialog.
          </p>
        )}

        {backdrop === "colour" && (
          <ColorField
            label="Background colour"
            value={backdropColor}
            disabled={disabled}
            onChange={onBackdropColorChange}
          />
        )}

        {backdrop === "image" && (
          <>
            <button
              type="button"
              onClick={onChooseBackdropImage}
              disabled={disabled}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              {hasBackdropImage ? "Replace background image" : "Choose a background image"}
            </button>
            {hasBackdropImage && (
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Layers className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                The background sits on its own layer — select it on the canvas to move or scale it.
              </p>
            )}
          </>
        )}
      </PanelSection>
    </>
  );
}
