"use client";

/**
 * Image operations panel.
 *
 * Generated from the adjustment descriptor table, so adding an operation to
 * the pipeline surfaces it here automatically rather than needing a matching
 * block of JSX. Adjustments are non-destructive: they live on the layer and
 * can be dialled back to neutral at any point.
 */

import { RotateCcw, Sparkles } from "lucide-react";
import {
  ADJUSTMENT_GROUPS,
  ADJUSTMENTS,
  createAdjustments,
  defaultAdjustments,
  hasAdjustments,
  type Adjustments,
  type Layer,
} from "@/lib/imagepilot/core";
import type { EditorAction } from "@/lib/imagepilot/editor-state";
import { PanelSection, SliderField, ToggleField } from "./editor-controls";

/**
 * One-click looks.
 *
 * Presets are ordinary adjustment values rather than a separate mechanism, so
 * a user can apply one and then keep tuning every slider.
 */
const PRESETS: Array<{ name: string; values: Partial<Adjustments> }> = [
  { name: "Auto punch", values: { contrast: 18, saturation: 12, sharpen: 25, highlights: -12 } },
  { name: "Soft portrait", values: { exposure: 0.15, contrast: -6, saturation: -5, shadows: 18, noiseReduction: 20 } },
  { name: "Vivid", values: { saturation: 45, contrast: 25, sharpen: 15 } },
  { name: "Black & white", values: { grayscale: 100, contrast: 20 } },
  { name: "Vintage", values: { sepia: 55, contrast: -10, saturation: -20, exposure: 0.1 } },
  { name: "Cool", values: { temperature: -35, tint: -8, contrast: 10 } },
  { name: "Warm", values: { temperature: 40, tint: 6, saturation: 8 } },
  { name: "High key", values: { exposure: 0.5, shadows: 40, contrast: -12, highlights: 10 } },
  { name: "Dramatic", values: { contrast: 45, shadows: -30, highlights: -25, sharpen: 30, saturation: -10 } },
  { name: "Line art", values: { grayscale: 100, thresholdEnabled: true, threshold: 150 } },
];

export function AdjustmentsPanel({
  layer,
  dispatch,
}: {
  layer: Layer | null;
  dispatch: (action: EditorAction) => void;
}) {
  if (!layer) {
    return (
      <PanelSection title="Image operations">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Select a layer to adjust its brightness, colour, detail and tone. Adjustments are
          non-destructive and can be reset at any time.
        </p>
      </PanelSection>
    );
  }

  const adjustments = layer.adjustments;
  const active = hasAdjustments(adjustments);

  const set = (key: keyof Adjustments, value: number | boolean) => {
    dispatch({
      type: "update-layer",
      id: layer.id,
      patch: { adjustments: { ...adjustments, [key]: value } } as Partial<Layer>,
      label: "Adjust image",
      // Merging on the key collapses a whole slider drag into one undo step.
      mergeKey: `adjust:${layer.id}:${key}`,
    });
  };

  const apply = (values: Partial<Adjustments>) => {
    dispatch({
      type: "update-layer",
      id: layer.id,
      patch: { adjustments: createAdjustments(values) } as Partial<Layer>,
      label: "Apply preset",
    });
  };

  return (
    <>
      <PanelSection
        title="Presets"
        defaultOpen={false}
        actions={
          active ? (
            <button
              type="button"
              onClick={() => apply({})}
              title="Reset every adjustment"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset all
            </button>
          ) : null
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={layer.locked}
              onClick={() => apply(preset.values)}
              className="flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-accent disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      {ADJUSTMENT_GROUPS.map((group) => {
        const entries = ADJUSTMENTS.filter((entry) => entry.group === group.id);
        if (!entries.length) return null;

        const groupChanged = entries.some((entry) => {
          if (entry.key === "threshold") return adjustments.thresholdEnabled;
          return adjustments[entry.key] !== defaultAdjustments[entry.key];
        });

        return (
          <PanelSection
            key={group.id}
            title={group.label}
            defaultOpen={group.id === "light" || groupChanged}
            actions={
              groupChanged ? (
                <button
                  type="button"
                  title={`Reset ${group.label.toLowerCase()}`}
                  aria-label={`Reset ${group.label}`}
                  onClick={() => {
                    const reset = { ...adjustments };
                    for (const entry of entries) {
                      (reset[entry.key] as number) = defaultAdjustments[entry.key] as number;
                      if (entry.key === "threshold") reset.thresholdEnabled = false;
                    }
                    dispatch({
                      type: "update-layer",
                      id: layer.id,
                      patch: { adjustments: reset } as Partial<Layer>,
                      label: `Reset ${group.label.toLowerCase()}`,
                    });
                  }}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : null
            }
          >
            {entries.map((entry) => {
              // Threshold replaces the image entirely, so it is opt-in rather
              // than something a stray slider nudge can trigger.
              if (entry.key === "threshold") {
                return (
                  <div key={entry.key} className="space-y-2">
                    <ToggleField
                      label="Threshold"
                      hint="Converts the layer to pure black and white"
                      checked={adjustments.thresholdEnabled}
                      disabled={layer.locked}
                      onChange={(checked) => set("thresholdEnabled", checked)}
                    />
                    {adjustments.thresholdEnabled && (
                      <SliderField
                        label="Cut point"
                        value={adjustments.threshold}
                        min={entry.min}
                        max={entry.max}
                        step={entry.step}
                        neutral={entry.neutral}
                        disabled={layer.locked}
                        onChange={(value) => set("threshold", value)}
                      />
                    )}
                  </div>
                );
              }

              return (
                <SliderField
                  key={entry.key}
                  label={entry.label}
                  value={adjustments[entry.key] as number}
                  min={entry.min}
                  max={entry.max}
                  step={entry.step}
                  neutral={entry.neutral}
                  unit={entry.unit}
                  disabled={layer.locked}
                  onChange={(value) => set(entry.key, value)}
                />
              );
            })}
          </PanelSection>
        );
      })}
    </>
  );
}
