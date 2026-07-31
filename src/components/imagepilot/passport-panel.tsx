"use client";

/**
 * Passport Photo Studio inspector.
 *
 * Chooses the specification, background and print layout. The photo itself is
 * positioned with the ordinary move tool against the guide overlay, so no
 * bespoke cropping UI is needed — the editor already does that well.
 */

import { Printer, RotateCcw, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PASSPORT_SPECS,
  PRINT_DPI,
  PRINT_SHEETS,
  headGuide,
  planPrintSheet,
  specPixelSize,
  type PassportSpec,
} from "@/lib/imagepilot/core";
import { ColorField, PanelSection, SelectField, SliderField } from "./editor-controls";

interface PassportPanelProps {
  spec: PassportSpec;
  dpi: number;
  background: string;
  copies: number;
  sheetId: string;
  showGuides: boolean;
  busy: boolean;
  onSpecChange: (specId: string) => void;
  onDpiChange: (dpi: number) => void;
  onBackgroundChange: (color: string) => void;
  onCopiesChange: (copies: number) => void;
  onSheetChange: (sheetId: string) => void;
  onToggleGuides: (show: boolean) => void;
  onRefit: () => void;
  onExportSheet: () => void;
}

export function PassportPanel({
  spec,
  dpi,
  background,
  copies,
  sheetId,
  showGuides,
  busy,
  onSpecChange,
  onDpiChange,
  onBackgroundChange,
  onCopiesChange,
  onSheetChange,
  onToggleGuides,
  onRefit,
  onExportSheet,
}: PassportPanelProps) {
  const pixels = specPixelSize(spec, dpi);
  const guide = headGuide(spec);
  const sheet = PRINT_SHEETS.find((entry) => entry.id === sheetId) ?? PRINT_SHEETS[0];
  const layout = planPrintSheet(spec, sheet, dpi, copies);

  // Group the specification list by country so a long list stays scannable.
  const grouped = PASSPORT_SPECS.reduce<Record<string, PassportSpec[]>>((accumulator, entry) => {
    (accumulator[entry.country] ??= []).push(entry);
    return accumulator;
  }, {});

  return (
    <>
      <PanelSection title="Specification">
        <div className="space-y-1.5">
          <label htmlFor="passport-spec" className="text-xs font-medium text-muted-foreground">
            Document
          </label>
          <select
            id="passport-spec"
            value={spec.id}
            disabled={busy}
            onChange={(event) => onSpecChange(event.target.value)}
            className="h-8 w-full rounded-lg border border-border/60 bg-background px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            {Object.entries(grouped).map(([country, entries]) => (
              <optgroup key={country} label={country}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="rounded-lg bg-muted/50 p-2.5">
          <dl className="space-y-1 text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Print size</dt>
              <dd className="tabular-nums">
                {spec.widthMm} × {spec.heightMm} mm
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Pixels</dt>
              <dd className="tabular-nums">
                {pixels.width} × {pixels.height}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Head height</dt>
              <dd className="tabular-nums">
                {Math.round(spec.headMin * spec.heightMm)}–
                {Math.round(spec.headMax * spec.heightMm)} mm
              </dd>
            </div>
          </dl>
          <p className="mt-2 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            {spec.notes}
          </p>
        </div>

        <SelectField
          label="Print resolution"
          value={dpi}
          disabled={busy}
          options={PRINT_DPI.map((value) => ({ value, label: `${value} dpi` }))}
          onChange={onDpiChange}
        />
      </PanelSection>

      <PanelSection title="Positioning">
        <button
          type="button"
          onClick={onRefit}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Re-fit photo to guides
        </button>

        <button
          type="button"
          onClick={() => onToggleGuides(!showGuides)}
          disabled={busy}
          aria-pressed={showGuides}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
            showGuides
              ? "border-primary bg-primary/10"
              : "border-border/60 text-muted-foreground hover:bg-accent",
            busy && "opacity-50"
          )}
        >
          <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />
          {showGuides ? "Hide guides" : "Show guides"}
        </button>

        <div className="space-y-1 rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-[#2563eb]" aria-hidden="true" />
            Crown and chin lines — fit the head between them
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-[#f59e0b]" aria-hidden="true" />
            Eye line
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-[#22c55e]" aria-hidden="true" />
            Permitted chin range
          </p>
          <p className="pt-1">
            Drag the photo with the move tool and resize it from its corners until the head sits
            between the blue lines. Eyes should land near the amber line.
          </p>
        </div>
      </PanelSection>

      <PanelSection title="Background">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Accepted colours</span>
          <div className="flex flex-wrap gap-1.5">
            {spec.backgrounds.map((color) => (
              <button
                key={color}
                type="button"
                disabled={busy}
                aria-label={`Use ${color}`}
                title={color}
                onClick={() => onBackgroundChange(color)}
                className={cn(
                  "h-8 w-8 rounded-lg border-2 transition-transform hover:scale-105",
                  background.toLowerCase() === color.toLowerCase()
                    ? "border-primary"
                    : "border-border/60",
                  busy && "opacity-50"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <ColorField
          label="Custom background"
          value={background}
          disabled={busy}
          onChange={onBackgroundChange}
        />

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The background shows wherever the photo does not cover the frame. For a true replacement
          the subject must already be on a plain backdrop.
        </p>
      </PanelSection>

      <PanelSection title="Print sheet">
        <SelectField
          label="Paper"
          value={sheetId}
          disabled={busy}
          options={PRINT_SHEETS.map((entry) => ({ value: entry.id, label: entry.label }))}
          onChange={onSheetChange}
        />

        <SliderField
          label="Copies"
          value={copies}
          min={1}
          max={Math.max(1, layout.capacity)}
          neutral={Math.min(6, layout.capacity)}
          disabled={busy}
          onChange={onCopiesChange}
        />

        <p className="text-[11px] text-muted-foreground">
          {layout.columns} × {layout.rows} grid — up to {layout.capacity} copies fit on{" "}
          {sheet.label.toLowerCase()}.
        </p>

        <button
          type="button"
          onClick={onExportSheet}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Export print sheet
        </button>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Guides are removed automatically before any export. Use the Export button in the toolbar
          for a single photo.
        </p>

        {/* Sanity readout so the numbers are never a mystery. */}
        <p className="text-[10px] tabular-nums text-muted-foreground/70">
          Eye line at {Math.round(guide.eyeY * 100)}% from the top.
        </p>
      </PanelSection>
    </>
  );
}
