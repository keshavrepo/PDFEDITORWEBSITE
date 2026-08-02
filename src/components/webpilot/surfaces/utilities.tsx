"use client";

/**
 * Developer Utilities surface.
 *
 * A swiss-army knife of small web-development utilities. The
 * surface hosts eight tabs:
 *
 *  1. Color Picker — hex / rgb / hsl / hsv with a palette and
 *     a history.
 *  2. Gradient Generator — linear and radial gradients.
 *  3. Box Shadow Generator — offset, blur, spread, color, inset.
 *  4. Border Radius Generator — per-corner control.
 *  5. CSS Unit Converter — px, rem, em, pt, vw, vh, %.
 *  6. HTML Entity Encoder / Decoder.
 *  7. Base64 Encode / Decode.
 *  8. URL Encode / Decode.
 *
 * The surface reuses the existing tool chrome and the platform
 * toast so every utility feels identical to the other tools.
 */

import { useMemo, useState } from "react";
import {
  Copy,
  Palette,
  Plus,
  Square,
  Circle,
  Ruler,
  Code2,
  Link as LinkIcon,
  Hash,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  ALL_UNIT_NAMES,
  asUtilitiesBody,
  buildBorderRadiusCss,
  buildBoxShadowCss,
  buildGradientCss,
  convertUnit,
  copyToClipboard,
  decodeBase64,
  decodeHtmlEntities,
  decodeUrl,
  encodeBase64,
  encodeHtmlEntities,
  encodeUrl,
  formatColor,
  hexToRgb,
  isValidHex,
  normaliseHex,
  rgbToHsl,
  rgbToHsv,
  type RgbColor,
} from "@/lib/webpilot";
import type {
  WebGradientStop,
  WebSession,
  WebUtilitiesBody,
} from "@/lib/webpilot";
import { cn } from "@/lib/utils";

interface UtilitiesSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

interface UtilityTab {
  id: string;
  label: string;
  icon: typeof Palette;
  description: string;
}

const TABS: UtilityTab[] = [
  {
    id: "color-picker",
    label: "Color Picker",
    icon: Palette,
    description: "Pick a colour, see hex / rgb / hsl / hsv, copy the value.",
  },
  {
    id: "gradient",
    label: "Gradient",
    icon: Palette,
    description: "Linear and radial CSS gradients with colour stops.",
  },
  {
    id: "box-shadow",
    label: "Box Shadow",
    icon: Square,
    description: "Offset, blur, spread, colour and inset for box-shadow.",
  },
  {
    id: "border-radius",
    label: "Border Radius",
    icon: Circle,
    description: "Per-corner border-radius with a one-line CSS output.",
  },
  {
    id: "unit",
    label: "Unit",
    icon: Ruler,
    description: "Convert px, rem, em, pt, vw, vh, %.",
  },
  {
    id: "entity",
    label: "Entity",
    icon: Code2,
    description: "Encode and decode HTML entities.",
  },
  {
    id: "base64",
    label: "Base64",
    icon: Hash,
    description: "Encode and decode base64 strings.",
  },
  {
    id: "url",
    label: "URL",
    icon: LinkIcon,
    description: "Encode and decode URLs.",
  },
];

export function UtilitiesSurface({ session, onChange }: UtilitiesSurfaceProps) {
  const body = asUtilitiesBody(session.body);
  const { toast } = useToast();

  function commit(patch: Partial<WebUtilitiesBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const activeTab = TABS.find((tab) => tab.id === body.activeUtility) ?? TABS[0]!;

  async function copyValue(value: string, message = "Copied") {
    const ok = await copyToClipboard(value);
    toast({ message: ok ? message : "Could not copy", tone: ok ? "success" : "error" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Developer Utilities — color picker, gradient generator, box shadow generator, border radius generator, CSS unit converter, HTML entity, base64 and URL codecs."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        status={
          <span className="text-[10px] text-muted-foreground">
            {activeTab.label} · {TABS.length} utilities
          </span>
        }
      />
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-4">
        <Card className="flex w-48 shrink-0 flex-col overflow-hidden p-0">
          <p className="border-b border-border bg-muted/30 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Utilities
          </p>
          <ul className="flex-1 overflow-auto p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === body.activeUtility;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => commit({ activeUtility: tab.id })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeTab.id === "color-picker" ? (
            <ColorPickerPanel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
          {activeTab.id === "gradient" ? (
            <GradientPanel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
          {activeTab.id === "box-shadow" ? (
            <BoxShadowPanel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
          {activeTab.id === "border-radius" ? (
            <BorderRadiusPanel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
          {activeTab.id === "unit" ? (
            <UnitPanel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
          {activeTab.id === "entity" ? (
            <EntityPanel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
          {activeTab.id === "base64" ? (
            <Base64Panel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
          {activeTab.id === "url" ? (
            <UrlPanel body={body} commit={commit} onCopy={copyValue} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Color Picker                                                              */
/* -------------------------------------------------------------------------- */

interface PanelProps {
  body: WebUtilitiesBody;
  commit: (patch: Partial<WebUtilitiesBody>) => void;
  onCopy: (value: string, message?: string) => Promise<void>;
}

function ColorPickerPanel({ body, commit, onCopy }: PanelProps) {
  const safeHex = isValidHex(body.colorHex) ? body.colorHex : "#000000";
  const normalised = normaliseHex(safeHex);
  const formats = useMemo(() => formatColor(normalised), [normalised]);
  const rgb = useMemo(() => hexToRgb(normalised), [normalised]);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb]);

  function addToHistory(hex: string) {
    const id = `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = { id, hex, createdAt: new Date().toISOString() };
    const next = [entry, ...body.colorHistory.filter((other) => other.hex !== hex)].slice(0, 30);
    commit({ colorHistory: next });
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,auto] gap-2 p-4">
        <div className="flex items-center gap-3">
          <div
            className="h-16 w-16 shrink-0 rounded-md border border-border"
            style={{ background: normalised }}
            aria-label={`Selected colour ${normalised}`}
          />
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hex
            </label>
            <div className="flex items-center gap-1">
              <Input
                value={body.colorHex}
                onChange={(event) => commit({ colorHex: event.target.value })}
                onBlur={() => {
                  if (isValidHex(body.colorHex)) addToHistory(normalised);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (isValidHex(body.colorHex)) addToHistory(normalised);
                  }
                }}
                className="h-8 font-mono text-xs"
                aria-label="Hex value"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-xs"
                onClick={() => addToHistory(normalised)}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                Save
              </Button>
            </div>
          </div>
        </div>
        <div className="grid min-h-0 gap-2 overflow-hidden md:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-2 overflow-auto">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Formats
            </h3>
            <Field label="HEX" value={formats.hex} onCopy={onCopy} />
            <Field label="RGB" value={formats.rgb} onCopy={onCopy} />
            <Field label="HSL" value={formats.hsl} onCopy={onCopy} />
            <Field label="HSV" value={formats.hsv} onCopy={onCopy} />
            <ChannelSliders
              rgb={rgb}
              hsl={hsl}
              hsv={hsv}
              onChange={(hex) => commit({ colorHex: hex })}
            />
          </div>
          <div className="flex min-h-0 flex-col gap-2 overflow-auto">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Palette
            </h3>
            <ul className="grid grid-cols-6 gap-1">
              {body.colorPalette.map((entry) => (
                <li key={entry.hex}>
                  <button
                    type="button"
                    onClick={() => commit({ colorHex: entry.hex })}
                    className="group flex w-full flex-col items-center gap-0.5 rounded border border-border p-1 hover:border-foreground/30"
                    aria-label={`Use ${entry.name} ${entry.hex}`}
                    title={`${entry.name} · ${entry.hex}`}
                  >
                    <span
                      className="h-6 w-6 rounded"
                      style={{ background: entry.hex }}
                    />
                    <span className="w-full truncate text-[9px] text-muted-foreground">
                      {entry.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              History
            </h3>
            {body.colorHistory.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                No history yet.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1">
                {body.colorHistory.slice(0, 30).map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => commit({ colorHex: entry.hex })}
                      className="h-6 w-6 rounded border border-border"
                      style={{ background: entry.hex }}
                      aria-label={`Use ${entry.hex}`}
                      title={entry.hex}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Click a swatch to load the colour. Press Save to push it onto the
          history stack.
        </p>
      </div>
    </Card>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onCopy: (value: string, message?: string) => Promise<void>;
}

function Field({ label, value, onCopy }: FieldProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
      <span className="w-10 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="flex-1 truncate font-mono text-[11px]">{value}</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={() => void onCopy(value, `${label} copied`)}
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
      </Button>
    </div>
  );
}

interface ChannelSlidersProps {
  rgb: RgbColor;
  hsl: { h: number; s: number; l: number };
  hsv: { h: number; s: number; v: number };
  onChange: (hex: string) => void;
}

function ChannelSliders({ rgb, hsl, hsv, onChange }: ChannelSlidersProps) {
  // Lightweight sliders for hue / saturation / lightness / value. The
  // input updates the hex straight away so the swatch and the
  // formats stay in sync.
  return (
    <div className="space-y-1">
      <SliderRow
        label="H"
        min={0}
        max={360}
        value={hsl.h}
        onChange={(value) => {
          const newRgb = hslOrHsvToRgb(value, hsv.s, hsv.v, "hsv");
          onChange(rgbToHex(newRgb));
        }}
      />
      <SliderRow
        label="S"
        min={0}
        max={100}
        value={hsv.s}
        onChange={(value) => {
          const newRgb = hslOrHsvToRgb(hsl.h, value, hsv.v, "hsv");
          onChange(rgbToHex(newRgb));
        }}
      />
      <SliderRow
        label="V"
        min={0}
        max={100}
        value={hsv.v}
        onChange={(value) => {
          const newRgb = hslOrHsvToRgb(hsl.h, hsv.s, value, "hsv");
          onChange(rgbToHex(newRgb));
        }}
      />
      <SliderRow
        label="R"
        min={0}
        max={255}
        value={rgb.r}
        onChange={(value) => onChange(rgbToHex({ ...rgb, r: value }))}
      />
      <SliderRow
        label="G"
        min={0}
        max={255}
        value={rgb.g}
        onChange={(value) => onChange(rgbToHex({ ...rgb, g: value }))}
      />
      <SliderRow
        label="B"
        min={0}
        max={255}
        value={rgb.b}
        onChange={(value) => onChange(rgbToHex({ ...rgb, b: value }))}
      />
    </div>
  );
}

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

function SliderRow({ label, min, max, value, onChange }: SliderRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="flex-1 accent-primary"
        aria-label={label}
      />
      <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {Math.round(value)}
      </span>
    </div>
  );
}

function rgbToHex(rgb: RgbColor): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  return (
    "#" +
    [r, g, b]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  );
}

function hslOrHsvToRgb(
  h: number,
  s: number,
  v: number,
  mode: "hsv"
): RgbColor {
  // Only HSV is needed for the slider input; the function lives here
  // to keep the conversions close to the form.
  const hue = (((h % 360) + 360) % 360) / 60;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const val = Math.max(0, Math.min(100, v)) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = val - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 1) {
    r = c;
    g = x;
  } else if (hue < 2) {
    r = x;
    g = c;
  } else if (hue < 3) {
    g = c;
    b = x;
  } else if (hue < 4) {
    g = x;
    b = c;
  } else if (hue < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

void rgbToHsl;

/* -------------------------------------------------------------------------- */
/* Gradient                                                                  */
/* -------------------------------------------------------------------------- */

function GradientPanel({ body, commit, onCopy }: PanelProps) {
  const css = useMemo(
    () => buildGradientCss(body.gradientType, body.gradientAngle, body.gradientStops),
    [body.gradientType, body.gradientAngle, body.gradientStops]
  );

  function updateStop(index: number, patch: Partial<WebGradientStop>) {
    const next = body.gradientStops.map((stop, i) =>
      i === index ? { ...stop, ...patch } : stop
    );
    commit({ gradientStops: next });
  }

  function addStop() {
    const last = body.gradientStops[body.gradientStops.length - 1] ?? {
      position: 0,
      color: "#000000",
    };
    const position = Math.min(100, last.position + 10);
    const color = "#ffffff";
    commit({
      gradientStops: [
        ...body.gradientStops,
        { position, color },
      ],
    });
  }

  function removeStop(index: number) {
    if (body.gradientStops.length <= 2) return;
    commit({
      gradientStops: body.gradientStops.filter((_, i) => i !== index),
    });
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,auto] gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={body.gradientType === "linear" ? "default" : "ghost"}
            onClick={() => commit({ gradientType: "linear" })}
          >
            Linear
          </Button>
          <Button
            size="sm"
            variant={body.gradientType === "radial" ? "default" : "ghost"}
            onClick={() => commit({ gradientType: "radial" })}
          >
            Radial
          </Button>
          {body.gradientType === "linear" ? (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Angle</span>
              <input
                type="range"
                min={0}
                max={360}
                value={body.gradientAngle}
                onChange={(event) =>
                  commit({ gradientAngle: Number(event.target.value) })
                }
                className="w-32 accent-primary"
                aria-label="Gradient angle"
              />
              <span className="w-10 text-right font-mono">
                {body.gradientAngle}°
              </span>
            </label>
          ) : null}
        </div>
        <div className="grid min-h-0 gap-2 overflow-hidden md:grid-cols-2">
          <div
            className="min-h-32 rounded-md border border-border"
            style={{ backgroundImage: css }}
            aria-label="Gradient preview"
          />
          <ul className="space-y-1 overflow-auto">
            {body.gradientStops.map((stop, index) => (
              <li
                key={index}
                className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1"
              >
                <input
                  type="color"
                  value={stop.color}
                  onChange={(event) => updateStop(index, { color: event.target.value })}
                  className="h-6 w-6 cursor-pointer rounded border border-border"
                  aria-label={`Stop ${index + 1} colour`}
                />
                <Input
                  value={stop.color}
                  onChange={(event) => updateStop(index, { color: event.target.value })}
                  className="h-7 w-24 font-mono text-[11px]"
                  aria-label={`Stop ${index + 1} colour hex`}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={stop.position}
                  onChange={(event) =>
                    updateStop(index, { position: Number(event.target.value) })
                  }
                  className="flex-1 accent-primary"
                  aria-label={`Stop ${index + 1} position`}
                />
                <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {stop.position}%
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => removeStop(index)}
                  disabled={body.gradientStops.length <= 2}
                  aria-label={`Remove stop ${index + 1}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </Button>
              </li>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[10px]"
              onClick={addStop}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add stop
            </Button>
          </ul>
        </div>
        <Field label="CSS" value={`background: ${css};`} onCopy={onCopy} />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Box Shadow                                                                */
/* -------------------------------------------------------------------------- */

function BoxShadowPanel({ body, commit, onCopy }: PanelProps) {
  const css = useMemo(
    () =>
      buildBoxShadowCss({
        offsetX: body.shadowOffsetX,
        offsetY: body.shadowOffsetY,
        blur: body.shadowBlur,
        spread: body.shadowSpread,
        color: body.shadowColor,
        inset: body.shadowInset,
      }),
    [
      body.shadowOffsetX,
      body.shadowOffsetY,
      body.shadowBlur,
      body.shadowSpread,
      body.shadowColor,
      body.shadowInset,
    ]
  );
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,auto] gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <NumberField
            label="Offset X"
            value={body.shadowOffsetX}
            onChange={(value) => commit({ shadowOffsetX: value })}
            min={-100}
            max={100}
          />
          <NumberField
            label="Offset Y"
            value={body.shadowOffsetY}
            onChange={(value) => commit({ shadowOffsetY: value })}
            min={-100}
            max={100}
          />
          <NumberField
            label="Blur"
            value={body.shadowBlur}
            onChange={(value) => commit({ shadowBlur: value })}
            min={0}
            max={200}
          />
          <NumberField
            label="Spread"
            value={body.shadowSpread}
            onChange={(value) => commit({ shadowSpread: value })}
            min={-100}
            max={100}
          />
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>Colour</span>
            <input
              type="color"
              value={body.shadowColor}
              onChange={(event) =>
                commit({ shadowColor: event.target.value })
              }
              className="h-7 w-7 cursor-pointer rounded border border-border"
              aria-label="Shadow colour"
            />
            <Input
              value={body.shadowColor}
              onChange={(event) =>
                commit({ shadowColor: event.target.value })
              }
              className="h-7 w-24 font-mono text-[11px]"
              aria-label="Shadow colour hex"
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={body.shadowInset}
              onChange={(event) => commit({ shadowInset: event.target.checked })}
              aria-label="Inset"
            />
            Inset
          </label>
        </div>
        <div className="flex min-h-0 items-center justify-center rounded-md border border-border bg-muted/30 p-8">
          <div
            className="h-24 w-24 rounded-md bg-white dark:bg-card"
            style={{ boxShadow: css }}
            aria-label="Box shadow preview"
          />
        </div>
        <Field label="CSS" value={`box-shadow: ${css};`} onCopy={onCopy} />
      </div>
    </Card>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

function NumberField({ label, value, onChange, min, max }: NumberFieldProps) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(Math.max(min, Math.min(max, next)));
          }
        }}
        className="h-7 w-16 text-[11px]"
        aria-label={label}
      />
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Border Radius                                                             */
/* -------------------------------------------------------------------------- */

function BorderRadiusPanel({ body, commit, onCopy }: PanelProps) {
  const css = useMemo(
    () =>
      buildBorderRadiusCss({
        topLeft: body.radiusTopLeft,
        topRight: body.radiusTopRight,
        bottomRight: body.radiusBottomRight,
        bottomLeft: body.radiusBottomLeft,
      }),
    [
      body.radiusTopLeft,
      body.radiusTopRight,
      body.radiusBottomRight,
      body.radiusBottomLeft,
    ]
  );
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,auto] gap-2 p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <NumberField
            label="Top Left"
            value={body.radiusTopLeft}
            onChange={(value) => commit({ radiusTopLeft: value })}
            min={0}
            max={500}
          />
          <NumberField
            label="Top Right"
            value={body.radiusTopRight}
            onChange={(value) => commit({ radiusTopRight: value })}
            min={0}
            max={500}
          />
          <NumberField
            label="Bottom Right"
            value={body.radiusBottomRight}
            onChange={(value) => commit({ radiusBottomRight: value })}
            min={0}
            max={500}
          />
          <NumberField
            label="Bottom Left"
            value={body.radiusBottomLeft}
            onChange={(value) => commit({ radiusBottomLeft: value })}
            min={0}
            max={500}
          />
        </div>
        <div className="flex min-h-0 items-center justify-center rounded-md border border-border bg-muted/30 p-8">
          <div
            className="h-32 w-32 bg-primary"
            style={{ borderRadius: css }}
            aria-label="Border radius preview"
          />
        </div>
        <Field label="CSS" value={`border-radius: ${css};`} onCopy={onCopy} />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Unit Converter                                                            */
/* -------------------------------------------------------------------------- */

function UnitPanel({ body, commit, onCopy }: PanelProps) {
  const converted = useMemo(
    () =>
      convertUnit(body.unitValue, body.unitFrom, body.unitTo, {
        baseFontSize: body.unitBaseFontSize,
        baseViewportWidth: body.unitBaseViewportWidth,
        baseViewportHeight: body.unitBaseViewportHeight,
      }),
    [
      body.unitValue,
      body.unitFrom,
      body.unitTo,
      body.unitBaseFontSize,
      body.unitBaseViewportWidth,
      body.unitBaseViewportHeight,
    ]
  );
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,auto] gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <NumberField
            label="Value"
            value={body.unitValue}
            onChange={(value) => commit({ unitValue: value })}
            min={0}
            max={100000}
          />
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>From</span>
            <select
              value={body.unitFrom}
              onChange={(event) =>
                commit({
                  unitFrom: event.target.value as WebUtilitiesBody["unitFrom"],
                })
              }
              className="h-7 rounded border border-border bg-background px-2 text-[11px]"
              aria-label="From unit"
            >
              {ALL_UNIT_NAMES.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>To</span>
            <select
              value={body.unitTo}
              onChange={(event) =>
                commit({
                  unitTo: event.target.value as WebUtilitiesBody["unitTo"],
                })
              }
              className="h-7 rounded border border-border bg-background px-2 text-[11px]"
              aria-label="To unit"
            >
              {ALL_UNIT_NAMES.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid min-h-0 gap-2 overflow-auto md:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Inputs
            </p>
            <div className="mt-2 space-y-2 text-[11px]">
              <NumberField
                label="Base font size (px)"
                value={body.unitBaseFontSize}
                onChange={(value) => commit({ unitBaseFontSize: value })}
                min={1}
                max={100}
              />
              <NumberField
                label="Viewport width (px)"
                value={body.unitBaseViewportWidth}
                onChange={(value) => commit({ unitBaseViewportWidth: value })}
                min={1}
                max={100000}
              />
              <NumberField
                label="Viewport height (px)"
                value={body.unitBaseViewportHeight}
                onChange={(value) => commit({ unitBaseViewportHeight: value })}
                min={1}
                max={100000}
              />
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Result
            </p>
            <p className="mt-2 break-all font-mono text-lg">
              {converted.toFixed(4)} {body.unitTo}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              px is the canonical unit. rem / em convert through the base font
              size. vw / vh convert through the viewport. % is relative to the
              base font size.
            </p>
          </div>
        </div>
        <Field
          label="CSS"
          value={`${body.unitValue}${body.unitFrom} = ${converted.toFixed(4)}${body.unitTo}`}
          onCopy={onCopy}
        />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* HTML Entity                                                               */
/* -------------------------------------------------------------------------- */

function EntityPanel({ body, commit, onCopy }: PanelProps) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr] gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              commit({ entityInput: encodeHtmlEntities(body.entityInput) })
            }
          >
            Encode
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              commit({ entityInput: decodeHtmlEntities(body.entityInput) })
            }
          >
            Decode
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void onCopy(encodeHtmlEntities(body.entityInput), "Encoded copied")}
          >
            Copy encoded
          </Button>
        </div>
        <textarea
          value={body.entityInput}
          onChange={(event) => commit({ entityInput: event.target.value })}
          className="h-full w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-[12px] outline-none focus:border-foreground/30"
          placeholder="Type or paste text to encode / decode HTML entities."
          aria-label="HTML entity input"
        />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Base64                                                                    */
/* -------------------------------------------------------------------------- */

function Base64Panel({ body, commit, onCopy }: PanelProps) {
  const output = useMemo(() => {
    try {
      if (body.base64Mode === "encode") return encodeBase64(body.base64Input);
      return decodeBase64(body.base64Input);
    } catch (err) {
      return err instanceof Error ? `Error: ${err.message}` : "Error";
    }
  }, [body.base64Input, body.base64Mode]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,1fr] gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={body.base64Mode === "encode" ? "default" : "ghost"}
            onClick={() => commit({ base64Mode: "encode" })}
          >
            Encode
          </Button>
          <Button
            size="sm"
            variant={body.base64Mode === "decode" ? "default" : "ghost"}
            onClick={() => commit({ base64Mode: "decode" })}
          >
            Decode
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void onCopy(output, "Output copied")}
          >
            Copy output
          </Button>
        </div>
        <textarea
          value={body.base64Input}
          onChange={(event) => commit({ base64Input: event.target.value })}
          className="h-full w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-[12px] outline-none focus:border-foreground/30"
          placeholder={
            body.base64Mode === "encode"
              ? "Plain text to encode"
              : "Base64 to decode"
          }
          aria-label="Base64 input"
        />
        <textarea
          readOnly
          value={output}
          className="h-full w-full resize-none rounded-md border border-border bg-muted/30 p-3 font-mono text-[12px] outline-none"
          aria-label="Base64 output"
        />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* URL                                                                       */
/* -------------------------------------------------------------------------- */

function UrlPanel({ body, commit, onCopy }: PanelProps) {
  const output = useMemo(() => {
    try {
      if (body.urlMode === "encode") return encodeUrl(body.urlInput);
      return decodeUrl(body.urlInput);
    } catch (err) {
      return err instanceof Error ? `Error: ${err.message}` : "Error";
    }
  }, [body.urlInput, body.urlMode]);
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,1fr] gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={body.urlMode === "encode" ? "default" : "ghost"}
            onClick={() => commit({ urlMode: "encode" })}
          >
            Encode
          </Button>
          <Button
            size="sm"
            variant={body.urlMode === "decode" ? "default" : "ghost"}
            onClick={() => commit({ urlMode: "decode" })}
          >
            Decode
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void onCopy(output, "Output copied")}
          >
            Copy output
          </Button>
        </div>
        <textarea
          value={body.urlInput}
          onChange={(event) => commit({ urlInput: event.target.value })}
          className="h-full w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-[12px] outline-none focus:border-foreground/30"
          placeholder={
            body.urlMode === "encode"
              ? "Plain text or URL to encode"
              : "Percent-encoded URL to decode"
          }
          aria-label="URL input"
        />
        <textarea
          readOnly
          value={output}
          className="h-full w-full resize-none rounded-md border border-border bg-muted/30 p-3 font-mono text-[12px] outline-none"
          aria-label="URL output"
        />
      </div>
    </Card>
  );
}
