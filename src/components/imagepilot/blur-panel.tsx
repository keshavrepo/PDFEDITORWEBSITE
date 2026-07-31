"use client";

/**
 * Object Blur Studio inspector.
 *
 * Regions are listed and edited here; they are drawn by dragging on the
 * canvas. The panel is explicit that pixelation is irreversible and blur is
 * not, because that distinction is the entire reason someone reaches for this
 * tool.
 */

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { REGION_PRESETS, type ObscureMode, type ObscureRegion } from "@/lib/imagepilot/core";
import {
  ColorField,
  PanelSection,
  SegmentedControl,
  SliderField,
} from "./editor-controls";

interface BlurPanelProps {
  presetId: string;
  regions: ObscureRegion[];
  selectedId: string | null;
  busy: boolean;
  onPresetChange: (id: string) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<ObscureRegion>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function BlurPanel({
  presetId,
  regions,
  selectedId,
  busy,
  onPresetChange,
  onSelect,
  onUpdate,
  onRemove,
  onClear,
}: BlurPanelProps) {
  const selected = regions.find((region) => region.id === selectedId) ?? null;
  const preset = REGION_PRESETS.find((entry) => entry.id === presetId) ?? REGION_PRESETS[0];

  return (
    <>
      <PanelSection title="Draw a region">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Pick what you are hiding, then drag on the image. Each region can be moved and adjusted
          afterwards.
        </p>

        <div className="space-y-1.5">
          {REGION_PRESETS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={busy}
              aria-pressed={presetId === entry.id}
              onClick={() => onPresetChange(entry.id)}
              className={cn(
                "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                presetId === entry.id
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:bg-accent",
                busy && "opacity-50"
              )}
            >
              <span className="block text-xs font-medium">{entry.label}</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
                {entry.hint}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
          <span>
            Pixelation averages each block and cannot be undone. A blur can sometimes be partly
            reversed, so prefer pixelation or a solid block for anything genuinely sensitive.
          </span>
        </div>
      </PanelSection>

      <PanelSection title={`Regions (${regions.length})`}>
        {!regions.length ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Drag on the image to add one.
          </p>
        ) : (
          <>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {regions.map((region, index) => (
                <li key={region.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(region.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
                      selectedId === region.id ? "bg-primary/15" : "hover:bg-accent/60"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 border border-current",
                        region.shape === "ellipse" ? "rounded-full" : "rounded-[2px]"
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      Region {index + 1} · {region.mode}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove region ${index + 1}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(region.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onRemove(region.id);
                        }
                      }}
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="w-full rounded-lg border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              Remove all regions
            </button>
          </>
        )}
      </PanelSection>

      {selected && (
        <PanelSection title="Selected region">
          <SegmentedControl
            label="Method"
            value={selected.mode}
            disabled={busy}
            options={[
              { value: "pixelate" as ObscureMode, label: "Pixelate" },
              { value: "blur" as ObscureMode, label: "Blur" },
              { value: "fill" as ObscureMode, label: "Block" },
            ]}
            onChange={(mode) => onUpdate(selected.id, { mode })}
          />

          <SegmentedControl
            label="Shape"
            value={selected.shape}
            disabled={busy}
            options={[
              { value: "rectangle" as const, label: "Rectangle" },
              { value: "ellipse" as const, label: "Oval" },
            ]}
            onChange={(shape) => onUpdate(selected.id, { shape })}
          />

          {selected.mode !== "fill" && (
            <SliderField
              label="Strength"
              value={selected.strength}
              min={1}
              max={100}
              neutral={preset.strength}
              unit="%"
              disabled={busy}
              onChange={(strength) => onUpdate(selected.id, { strength })}
            />
          )}

          {selected.mode === "fill" && (
            <ColorField
              label="Block colour"
              value={selected.color}
              disabled={busy}
              onChange={(color) => onUpdate(selected.id, { color })}
            />
          )}

          <SliderField
            label="Edge softness"
            value={selected.feather}
            min={0}
            max={40}
            neutral={preset.feather}
            unit="px"
            disabled={busy}
            onChange={(feather) => onUpdate(selected.id, { feather })}
          />

          <div className="grid grid-cols-2 gap-2 text-[10px] tabular-nums text-muted-foreground">
            <span>
              {Math.round(selected.width)} × {Math.round(selected.height)} px
            </span>
            <span className="text-right">
              at {Math.round(selected.x)}, {Math.round(selected.y)}
            </span>
          </div>
        </PanelSection>
      )}
    </>
  );
}
