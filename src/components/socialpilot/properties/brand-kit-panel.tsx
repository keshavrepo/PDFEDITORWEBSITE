"use client";

/**
 * Brand-kit panel for SocialPilot.
 *
 * Reads, edits and persists the user's brand kit. Logos, colours,
 * fonts and default social profiles are reusable across every
 * future SocialPilot tool.
 */

import { useEffect, useState, useCallback } from "react";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import type { SocialBrandKit } from "@/lib/socialpilot";

const DEFAULT_KIT: SocialBrandKit = {
  id: "default",
  name: "Default brand kit",
  logos: [],
  colors: [],
  fonts: [],
  profiles: [],
};

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function BrandKitPanel() {
  const { toast } = useToast();
  const [kit, setKit] = useState<SocialBrandKit>(DEFAULT_KIT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/socialpilot/brand-kit");
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        const data = (await res.json()) as { kit?: SocialBrandKit };
        if (!cancelled) setKit(data.kit ?? DEFAULT_KIT);
      } catch {
        if (!cancelled) setKit(DEFAULT_KIT);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (next: SocialBrandKit) => {
      setSaving(true);
      try {
        const res = await fetch("/api/socialpilot/brand-kit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = (await res.json()) as { kit?: SocialBrandKit };
        setKit(data.kit ?? next);
        toast({ message: "Brand kit saved", tone: "success" });
      } catch {
        toast({ message: "Could not save brand kit", tone: "error" });
      } finally {
        setSaving(false);
      }
    },
    [toast]
  );

  function addLogo(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setKit((current) => ({
        ...current,
        logos: [
          ...current.logos,
          { id: randomId("logo"), name: file.name, dataUrl },
        ],
      }));
    };
    reader.readAsDataURL(file);
  }

  function removeLogo(id: string) {
    setKit((current) => ({
      ...current,
      logos: current.logos.filter((logo) => logo.id !== id),
    }));
  }

  function addColor() {
    setKit((current) => ({
      ...current,
      colors: [
        ...current.colors,
        { id: randomId("color"), name: "New colour", value: "#0EA5E9" },
      ],
    }));
  }

  function updateColor(id: string, patch: Partial<{ name: string; value: string }>) {
    setKit((current) => ({
      ...current,
      colors: current.colors.map((color) =>
        color.id === id ? { ...color, ...patch } : color
      ),
    }));
  }

  function removeColor(id: string) {
    setKit((current) => ({
      ...current,
      colors: current.colors.filter((color) => color.id !== id),
    }));
  }

  function addFont() {
    setKit((current) => ({
      ...current,
      fonts: [
        ...current.fonts,
        { id: randomId("font"), name: "New font", family: "Inter", weight: 400 },
      ],
    }));
  }

  function updateFont(id: string, patch: Partial<{ name: string; family: string; weight: number }>) {
    setKit((current) => ({
      ...current,
      fonts: current.fonts.map((font) =>
        font.id === id ? { ...font, ...patch } : font
      ),
    }));
  }

  function removeFont(id: string) {
    setKit((current) => ({
      ...current,
      fonts: current.fonts.filter((font) => font.id !== id),
    }));
  }

  function addProfile() {
    setKit((current) => ({
      ...current,
      profiles: [
        ...current.profiles,
        {
          id: randomId("profile"),
          platform: "Instagram",
          handle: "@your-handle",
          url: "https://instagram.com/your-handle",
        },
      ],
    }));
  }

  function updateProfile(
    id: string,
    patch: Partial<{ platform: string; handle: string; url: string }>
  ) {
    setKit((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile
      ),
    }));
  }

  function removeProfile(id: string) {
    setKit((current) => ({
      ...current,
      profiles: current.profiles.filter((profile) => profile.id !== id),
    }));
  }

  if (loading) {
    return (
      <div className="p-4 text-xs text-muted-foreground">Loading brand kit…</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Brand kit
          </h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => void save(kit)}
            disabled={saving}
          >
            <Save className="h-3 w-3" aria-hidden="true" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        <Input
          value={kit.name}
          onChange={(event) => setKit({ ...kit, name: event.target.value })}
          className="h-7 text-xs"
          aria-label="Brand kit name"
        />
        <p className="mt-2 text-[10px] text-muted-foreground">
          Reusable across every future SocialPilot tool.
        </p>
      </section>

      {/* Logos */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Logos
          </h3>
          <label className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md bg-accent px-2 text-[10px] font-medium hover:bg-accent/80">
            <Upload className="h-3 w-3" aria-hidden="true" />
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) addLogo(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {kit.logos.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No logos yet</p>
        ) : (
          <ul className="space-y-2">
            {kit.logos.map((logo) => (
              <li
                key={logo.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.dataUrl}
                  alt={logo.name}
                  className="h-10 w-10 rounded object-cover"
                />
                <Input
                  value={logo.name}
                  onChange={(event) =>
                    setKit((current) => ({
                      ...current,
                      logos: current.logos.map((l) =>
                        l.id === logo.id ? { ...l, name: event.target.value } : l
                      ),
                    }))
                  }
                  className="h-7 text-xs"
                  aria-label="Logo name"
                />
                <button
                  type="button"
                  onClick={() => removeLogo(logo.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${logo.name}`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Colours */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Brand colours
          </h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={addColor}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add
          </Button>
        </div>
        {kit.colors.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No colours yet</p>
        ) : (
          <ul className="space-y-2">
            {kit.colors.map((color) => (
              <li key={color.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={color.value}
                  onChange={(event) => updateColor(color.id, { value: event.target.value })}
                  className="h-7 w-7 cursor-pointer rounded border border-border bg-background"
                  aria-label={`${color.name} colour`}
                />
                <Input
                  value={color.name}
                  onChange={(event) => updateColor(color.id, { name: event.target.value })}
                  className="h-7 text-xs"
                  aria-label="Colour name"
                />
                <Input
                  value={color.value}
                  onChange={(event) => updateColor(color.id, { value: event.target.value })}
                  className="h-7 w-20 text-xs"
                  aria-label="Colour value"
                />
                <button
                  type="button"
                  onClick={() => removeColor(color.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${color.name}`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Fonts */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Fonts
          </h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={addFont}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add
          </Button>
        </div>
        {kit.fonts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No fonts yet</p>
        ) : (
          <ul className="space-y-2">
            {kit.fonts.map((font) => (
              <li key={font.id} className="grid grid-cols-[1fr_1fr_4rem_auto] gap-1">
                <Input
                  value={font.name}
                  onChange={(event) => updateFont(font.id, { name: event.target.value })}
                  className="h-7 text-xs"
                  aria-label="Font name"
                />
                <Input
                  value={font.family}
                  onChange={(event) => updateFont(font.id, { family: event.target.value })}
                  className="h-7 text-xs"
                  aria-label="Font family"
                />
                <Input
                  type="number"
                  min={100}
                  max={1000}
                  step={100}
                  value={font.weight}
                  onChange={(event) =>
                    updateFont(font.id, { weight: Number(event.target.value) || 400 })
                  }
                  className="h-7 text-xs"
                  aria-label="Font weight"
                />
                <button
                  type="button"
                  onClick={() => removeFont(font.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${font.name}`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Default social profiles */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Default social profiles
          </h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={addProfile}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add
          </Button>
        </div>
        {kit.profiles.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No profiles yet</p>
        ) : (
          <ul className="space-y-2">
            {kit.profiles.map((profile) => (
              <Card key={profile.id} className="p-2">
                <div className="grid grid-cols-2 gap-1">
                  <Input
                    value={profile.platform}
                    onChange={(event) =>
                      updateProfile(profile.id, { platform: event.target.value })
                    }
                    className="h-7 text-xs"
                    aria-label="Platform"
                    placeholder="Platform"
                  />
                  <Input
                    value={profile.handle}
                    onChange={(event) =>
                      updateProfile(profile.id, { handle: event.target.value })
                    }
                    className="h-7 text-xs"
                    aria-label="Handle"
                    placeholder="@handle"
                  />
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <Input
                    value={profile.url}
                    onChange={(event) =>
                      updateProfile(profile.id, { url: event.target.value })
                    }
                    className="h-7 text-xs"
                    aria-label="URL"
                    placeholder="https://"
                  />
                  <button
                    type="button"
                    onClick={() => removeProfile(profile.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Remove ${profile.platform}`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
