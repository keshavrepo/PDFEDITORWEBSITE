"use client";

/**
 * Color workspace surface.
 *
 * Convert between HEX, RGB, HSL and HSV, generate a five-colour
 * palette from a base colour, and check the WCAG contrast ratio
 * against a second colour. The recent-colours history and the
 * generated palette are stored on the session body so the
 * autosave loop preserves them across tabs.
 */

import { Copy, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asColorBody,
  copyToClipboard,
  deleteDevSession,
  formatColor,
  generatePalette,
  parseHex,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface ColorSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

function randomId(): string {
  return `clr-${Math.random().toString(36).slice(2, 10)}`;
}

export function ColorSurface({ session, onChange }: ColorSurfaceProps) {
  const body = asColorBody(session.body);
  const { toast } = useToast();

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const result = formatColor(body.hex, body.compareHex);
  const ratio = result?.contrast ?? null;
  const palette = body.palette.length > 0 ? body.palette : generatePalette(body.hex);

  function pushHistory(hex: string, name: string) {
    const entry = {
      id: randomId(),
      hex,
      name,
      createdAt: new Date().toISOString(),
    };
    const nextHistory = [entry, ...body.history.filter((e) => e.hex !== hex)].slice(0, 50);
    commit({ history: nextHistory });
  }

  function generateNewPalette() {
    const next = generatePalette(body.hex);
    commit({ palette: next });
    toast({ message: "Palette generated", tone: "success" });
  }

  function applySwatch(hex: string) {
    commit({ hex });
    pushHistory(hex, body.name);
  }

  async function copyHex(hex: string) {
    const ok = await copyToClipboard(hex);
    toast({ message: ok ? "Copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Convert HEX, RGB, HSL and HSV; generate a palette."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={async () => {
          if (!result) return;
          await copyHex(result.hex);
        }}
        copyDisabled={!result}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => {
              pushHistory(body.hex, body.name);
              toast({ message: "Added to history", tone: "info" });
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Save colour
          </Button>
        }
        status={
          result ? (
            <span className="inline-flex items-center gap-2 text-[11px]">
              <span
                className="h-3 w-3 rounded-sm border border-border"
                style={{ backgroundColor: result.hex }}
                aria-hidden="true"
              />
              <span className="font-mono">{result.hex}</span>
            </span>
          ) : (
            <span className="text-destructive">Invalid hex</span>
          )
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 lg:grid-cols-[2fr,3fr]">
        <Card className="space-y-3 p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Base HEX</span>
                <Input
                  value={body.hex}
                  onChange={(event) => commit({ hex: event.target.value })}
                  className="h-8 font-mono text-xs"
                  spellCheck={false}
                />
              </label>
            </div>
            <div
              className="h-8 w-12 rounded-md border border-border"
              style={{ backgroundColor: parseHex(body.hex) ? body.hex : "#ffffff" }}
              aria-label="Base colour preview"
            />
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Friendly name</span>
            <Input
              value={body.name}
              onChange={(event) => commit({ name: event.target.value })}
              placeholder="e.g. Primary brand"
              className="h-8 text-xs"
            />
          </label>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Compare HEX</span>
                <Input
                  value={body.compareHex}
                  onChange={(event) => commit({ compareHex: event.target.value })}
                  className="h-8 font-mono text-xs"
                  spellCheck={false}
                />
              </label>
            </div>
            <div
              className="h-8 w-12 rounded-md border border-border"
              style={{ backgroundColor: parseHex(body.compareHex) ? body.compareHex : "#ffffff" }}
              aria-label="Compare colour preview"
            />
          </div>
          {result && (
            <Card className="space-y-1 p-2 text-[11px]">
              <p>
                <span className="text-muted-foreground">HEX</span> · {result.hex}
              </p>
              <p>
                <span className="text-muted-foreground">RGB</span> · {result.rgb}
              </p>
              <p>
                <span className="text-muted-foreground">HSL</span> · {result.hsl}
              </p>
              <p>
                <span className="text-muted-foreground">HSV</span> · {result.hsv}
              </p>
              {ratio !== null && (
                <p>
                  <span className="text-muted-foreground">Contrast ratio</span> ·{" "}
                  <span
                    className={
                      ratio >= 4.5
                        ? "font-mono text-primary"
                        : ratio >= 3
                          ? "font-mono text-yellow-600 dark:text-yellow-400"
                          : "font-mono text-destructive"
                    }
                  >
                    {ratio.toFixed(2)}:1
                  </span>{" "}
                  <span className="text-[10px] text-muted-foreground">
                    ({ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA Large" : "Fail"})
                  </span>
                </p>
              )}
            </Card>
          )}
        </Card>

        <Card className="space-y-3 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold">Generated palette</h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={generateNewPalette}
            >
              <RefreshCcw className="h-3 w-3" aria-hidden="true" />
              Regenerate
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {palette.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => applySwatch(swatch.hex)}
                className="group flex flex-col items-stretch gap-1 rounded-md border border-border p-2 text-left text-[10px] hover:border-primary"
              >
                <div
                  className="h-12 w-full rounded-sm border border-border"
                  style={{ backgroundColor: swatch.hex }}
                />
                <span className="font-medium text-foreground">{swatch.name}</span>
                <span className="font-mono text-muted-foreground">{swatch.hex}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyHex(swatch.hex);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      void copyHex(swatch.hex);
                    }
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-2.5 w-2.5" aria-hidden="true" />
                  copy
                </span>
              </button>
            ))}
          </div>

          {body.history.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold">Recent</h3>
              <div className="flex flex-wrap gap-1">
                {body.history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => commit({ hex: entry.hex })}
                    title={entry.name || entry.hex}
                    className="h-6 w-6 rounded border border-border"
                    style={{ backgroundColor: entry.hex }}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
