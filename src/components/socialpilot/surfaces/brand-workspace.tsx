"use client";

/**
 * Brand Workspace — Batch 3 surface.
 *
 * Manages multiple brands: each brand has logos, colours, fonts,
 * watermarks, templates, default hashtags and default captions. The
 * active brand is stored on the user-state row, so the workspace
 * can switch the active brand instantly and the right-rail brand
 * panel reuses the same source of truth.
 */

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Hash,
  Image as ImageIcon,
  Palette,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Type as TypeIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { cn } from "@/lib/utils";
import { asBrandBody, DEFAULT_BRAND_BODY } from "@/lib/socialpilot/bodies";
import type {
  SocialBrand,
  SocialBrandColor,
  SocialBrandFont,
  SocialBrandLogo,
  SocialBrandTemplate,
  SocialBrandWatermark,
  SocialPlatformProfile,
  SocialProject,
} from "@/lib/socialpilot";
import {
  asProfileBody,
} from "@/lib/socialpilot/bodies";

interface BrandWorkspaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const PLACEHOLDER_BRAND: SocialBrand = {
  id: "",
  name: "New brand",
  description: "",
  logos: [],
  colors: [],
  fonts: [],
  watermarks: [],
  templates: [],
  defaultHashtags: [],
  defaultCaptions: [],
  defaultProfileId: "",
  createdAt: "",
  updatedAt: "",
};

export function BrandWorkspace({ project, onChange }: BrandWorkspaceProps) {
  // The project body is a single brand. The right-rail shows the
  // list and the active brand; the body holds the brand currently
  // being edited. The BrandWorkspace reads/writes the full brand
  // list through the /api/socialpilot/brand-profiles endpoint.
  const body = asBrandBody(project.body);
  const { toast } = useToast();
  const [brands, setBrands] = useState<SocialBrand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string>("");
  const [profiles, setProfiles] = useState<SocialPlatformProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [brandRes, profileRes, stateRes] = await Promise.all([
          fetch("/api/socialpilot/brand-profiles"),
          fetch("/api/socialpilot/platform-profiles"),
          fetch("/api/socialpilot/user-state"),
        ]);
        if (brandRes.ok) {
          const data = (await brandRes.json()) as { brands?: SocialBrand[] };
          if (!cancelled) setBrands(data.brands ?? []);
        }
        if (profileRes.ok) {
          const data = (await profileRes.json()) as { profiles?: SocialPlatformProfile[] };
          if (!cancelled) setProfiles(data.profiles ?? []);
        }
        if (stateRes.ok) {
          const data = (await stateRes.json()) as { state?: { activeBrandId: string } };
          if (!cancelled) setActiveBrandId(data.state?.activeBrandId ?? "");
        }
      } catch {
        if (!cancelled) {
          setBrands([]);
          setProfiles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBrand =
    brands.find((brand) => brand.id === activeBrandId) ?? null;
  const editing = { ...body } as SocialBrand;

  function commit(next: SocialBrand) {
    const nextBrand: SocialBrand = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    onChange({ ...project, body: { ...nextBrand, ...nextBrand } });
  }

  function addBrand() {
    const id = randomId("brand");
    const next: SocialBrand = {
      ...PLACEHOLDER_BRAND,
      id,
      name: `Brand ${brands.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setBrands((current) => [...current, next]);
    setActiveBrandId(id);
    setActiveBrandIdPersist(id);
    onChange({ ...project, body: { ...next } });
  }

  function deleteBrand(id: string) {
    setBrands((current) => current.filter((brand) => brand.id !== id));
    if (activeBrandId === id) {
      const next = brands.find((brand) => brand.id !== id);
      setActiveBrandId(next?.id ?? "");
      setActiveBrandIdPersist(next?.id ?? "");
    }
  }

  function setActiveBrandIdPersist(id: string) {
    fetch("/api/socialpilot/user-state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeBrandId: id }),
    }).catch(() => undefined);
  }

  async function save() {
    if (!activeBrand) return;
    setSaving(true);
    try {
      const next = brands.map((brand) =>
        brand.id === activeBrand.id ? { ...editing, id: activeBrand.id, updatedAt: new Date().toISOString() } : brand
      );
      const res = await fetch("/api/socialpilot/brand-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brands: next }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as { brands?: SocialBrand[] };
      setBrands(data.brands ?? next);
      toast({ message: "Brands saved", tone: "success" });
    } catch {
      toast({ message: "Could not save brands", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof SocialBrand>(key: K, value: SocialBrand[K]) {
    commit({ ...editing, [key]: value });
  }

  function addLogo(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const logo: SocialBrandLogo = {
        id: randomId("logo"),
        name: file.name,
        dataUrl,
      };
      patch("logos", [...editing.logos, logo]);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo(id: string) {
    patch("logos", editing.logos.filter((logo) => logo.id !== id));
  }

  function addColor() {
    const color: SocialBrandColor = {
      id: randomId("color"),
      name: "New colour",
      value: "#0EA5E9",
    };
    patch("colors", [...editing.colors, color]);
  }

  function updateColor(id: string, value: Partial<SocialBrandColor>) {
    patch(
      "colors",
      editing.colors.map((color) =>
        color.id === id ? { ...color, ...value } : color
      )
    );
  }

  function removeColor(id: string) {
    patch("colors", editing.colors.filter((color) => color.id !== id));
  }

  function addFont() {
    const font: SocialBrandFont = {
      id: randomId("font"),
      name: "New font",
      family: "Inter",
      weight: 400,
    };
    patch("fonts", [...editing.fonts, font]);
  }

  function updateFont(id: string, value: Partial<SocialBrandFont>) {
    patch(
      "fonts",
      editing.fonts.map((font) => (font.id === id ? { ...font, ...value } : font))
    );
  }

  function removeFont(id: string) {
    patch("fonts", editing.fonts.filter((font) => font.id !== id));
  }

  function addWatermark(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const watermark: SocialBrandWatermark = {
        id: randomId("watermark"),
        name: file.name,
        dataUrl: String(reader.result ?? ""),
        opacity: 1,
        placement: "bottom-right",
      };
      patch("watermarks", [...editing.watermarks, watermark]);
    };
    reader.readAsDataURL(file);
  }

  function updateWatermark(
    id: string,
    value: Partial<SocialBrandWatermark>
  ) {
    patch(
      "watermarks",
      editing.watermarks.map((watermark) =>
        watermark.id === id ? { ...watermark, ...value } : watermark
      )
    );
  }

  function removeWatermark(id: string) {
    patch(
      "watermarks",
      editing.watermarks.filter((watermark) => watermark.id !== id)
    );
  }

  function addTemplate() {
    const template: SocialBrandTemplate = {
      id: randomId("template"),
      name: "New template",
      description: "",
      body: "",
    };
    patch("templates", [...editing.templates, template]);
  }

  function updateTemplate(
    id: string,
    value: Partial<SocialBrandTemplate>
  ) {
    patch(
      "templates",
      editing.templates.map((template) =>
        template.id === id ? { ...template, ...value } : template
      )
    );
  }

  function removeTemplate(id: string) {
    patch(
      "templates",
      editing.templates.filter((template) => template.id !== id)
    );
  }

  function addDefaultHashtag(tag: string) {
    const cleaned = tag.trim().replace(/^#+/, "");
    if (!cleaned) return;
    const formatted = `#${cleaned}`;
    if (editing.defaultHashtags.includes(formatted)) return;
    patch("defaultHashtags", [...editing.defaultHashtags, formatted]);
  }

  function removeDefaultHashtag(tag: string) {
    patch(
      "defaultHashtags",
      editing.defaultHashtags.filter((entry) => entry !== tag)
    );
  }

  function addDefaultCaption(text: string) {
    if (!text.trim()) return;
    patch("defaultCaptions", [...editing.defaultCaptions, text.trim()]);
  }

  function removeDefaultCaption(index: number) {
    patch(
      "defaultCaptions",
      editing.defaultCaptions.filter((_, i) => i !== index)
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading brands…</div>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
        <Card className="max-w-md p-8 text-center">
          <Palette
            className="mx-auto mb-4 h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-lg font-semibold">No brands yet</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Add a brand to manage logos, colours, fonts, watermarks,
            templates, default hashtags and default captions.
          </p>
          <Button onClick={addBrand} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add your first brand
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[260px_1fr]">
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Brands
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={addBrand}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add
          </Button>
        </div>
        <ul className="space-y-1">
          {brands.map((brand) => (
            <li
              key={brand.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                brand.id === activeBrandId
                  ? "bg-accent text-foreground"
                  : "hover:bg-accent/40"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveBrandId(brand.id);
                  setActiveBrandIdPersist(brand.id);
                  onChange({ ...project, body: { ...brand } });
                }}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <Palette className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {brand.name}
                </span>
              </button>
              <button
                type="button"
                onClick={() => deleteBrand(brand.id)}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                aria-label={`Delete ${brand.name}`}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {activeBrand && (
          <Button
            type="button"
            size="sm"
            className="mt-3 h-7 w-full gap-1 px-2 text-xs"
            onClick={save}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {saving ? "Saving…" : "Save brand"}
          </Button>
        )}
      </Card>

      {activeBrand ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Palette className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Brand details
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Name</span>
                <Input
                  value={editing.name}
                  onChange={(event) => patch("name", event.target.value)}
                  className="h-8 text-sm"
                  aria-label="Brand name"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Default platform profile</span>
                <select
                  value={editing.defaultProfileId}
                  onChange={(event) =>
                    patch("defaultProfileId", event.target.value)
                  }
                  className="h-8 rounded border border-border bg-background px-2 text-sm"
                  aria-label="Default platform profile"
                >
                  <option value="">No default</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="font-medium">Description</span>
                <textarea
                  value={editing.description}
                  onChange={(event) => patch("description", event.target.value)}
                  rows={2}
                  className="rounded border border-border bg-background p-2 text-sm"
                  aria-label="Brand description"
                />
              </label>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
              title="Logos"
              onAdd={() => undefined}
              addLabel="Upload"
              renderAdd={() => (
                <label className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md bg-accent px-2 text-[10px] font-medium hover:bg-accent/80">
                  <Plus className="h-3 w-3" aria-hidden="true" />
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
              )}
            />
            {editing.logos.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logos yet</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {editing.logos.map((logo) => (
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
                        patch(
                          "logos",
                          editing.logos.map((l) =>
                            l.id === logo.id
                              ? { ...l, name: event.target.value }
                              : l
                          )
                        )
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
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={<Palette className="h-4 w-4" aria-hidden="true" />}
              title="Colours"
              onAdd={addColor}
            />
            {editing.colors.length === 0 ? (
              <p className="text-xs text-muted-foreground">No colours yet</p>
            ) : (
              <ul className="space-y-2">
                {editing.colors.map((color) => (
                  <li key={color.id} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color.value}
                      onChange={(event) =>
                        updateColor(color.id, { value: event.target.value })
                      }
                      className="h-7 w-7 cursor-pointer rounded border border-border bg-background"
                      aria-label={`${color.name} colour`}
                    />
                    <Input
                      value={color.name}
                      onChange={(event) =>
                        updateColor(color.id, { name: event.target.value })
                      }
                      className="h-7 text-xs"
                      aria-label="Colour name"
                    />
                    <Input
                      value={color.value}
                      onChange={(event) =>
                        updateColor(color.id, { value: event.target.value })
                      }
                      className="h-7 w-24 text-xs"
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
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={<TypeIcon className="h-4 w-4" aria-hidden="true" />}
              title="Fonts"
              onAdd={addFont}
            />
            {editing.fonts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fonts yet</p>
            ) : (
              <ul className="space-y-2">
                {editing.fonts.map((font) => (
                  <li
                    key={font.id}
                    className="grid grid-cols-[1fr_1fr_4rem_auto] gap-1"
                  >
                    <Input
                      value={font.name}
                      onChange={(event) =>
                        updateFont(font.id, { name: event.target.value })
                      }
                      className="h-7 text-xs"
                      aria-label="Font name"
                    />
                    <Input
                      value={font.family}
                      onChange={(event) =>
                        updateFont(font.id, { family: event.target.value })
                      }
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
                        updateFont(font.id, {
                          weight: Number(event.target.value) || 400,
                        })
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
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
              title="Watermarks"
              renderAdd={() => (
                <label className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md bg-accent px-2 text-[10px] font-medium hover:bg-accent/80">
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) addWatermark(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              )}
            />
            {editing.watermarks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No watermarks yet
              </p>
            ) : (
              <ul className="space-y-2">
                {editing.watermarks.map((watermark) => (
                  <li
                    key={watermark.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={watermark.dataUrl}
                      alt={watermark.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                    <Input
                      value={watermark.name}
                      onChange={(event) =>
                        updateWatermark(watermark.id, {
                          name: event.target.value,
                        })
                      }
                      className="h-7 text-xs"
                      aria-label="Watermark name"
                    />
                    <select
                      value={watermark.placement}
                      onChange={(event) =>
                        updateWatermark(watermark.id, {
                          placement: event.target.value as SocialBrandWatermark["placement"],
                        })
                      }
                      className="h-7 rounded border border-border bg-background px-2 text-[10px]"
                      aria-label="Watermark placement"
                    >
                      <option value="top-left">Top left</option>
                      <option value="top-right">Top right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-right">Bottom right</option>
                      <option value="center">Center</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeWatermark(watermark.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Remove ${watermark.name}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
              title="Templates"
              onAdd={addTemplate}
            />
            {editing.templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No templates yet</p>
            ) : (
              <ul className="space-y-2">
                {editing.templates.map((template) => (
                  <li
                    key={template.id}
                    className="rounded-lg border border-border bg-background p-2"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Input
                        value={template.name}
                        onChange={(event) =>
                          updateTemplate(template.id, {
                            name: event.target.value,
                          })
                        }
                        className="h-7 text-xs"
                        aria-label="Template name"
                      />
                      <button
                        type="button"
                        onClick={() => removeTemplate(template.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={`Remove ${template.name}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <textarea
                      value={template.body}
                      onChange={(event) =>
                        updateTemplate(template.id, { body: event.target.value })
                      }
                      rows={3}
                      className="w-full rounded border border-border bg-background p-2 text-xs"
                      aria-label="Template body"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={<Hash className="h-4 w-4" aria-hidden="true" />}
              title="Default hashtags"
            />
            <DefaultHashtagAdder onAdd={addDefaultHashtag} />
            {editing.defaultHashtags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {editing.defaultHashtags.map((tag) => (
                  <li
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeDefaultHashtag(tag)}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-primary/20"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-2.5 w-2.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
              title="Default captions"
            />
            <DefaultCaptionAdder onAdd={addDefaultCaption} />
            {editing.defaultCaptions.length > 0 && (
              <ul className="mt-2 space-y-1">
                {editing.defaultCaptions.map((caption, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 rounded border border-border bg-background p-2 text-xs"
                  >
                    <span className="flex-1 whitespace-pre-wrap">
                      {caption}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDefaultCaption(index)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Remove caption ${index + 1}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">
          Pick a brand from the list to edit it.
        </Card>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  onAdd,
  renderAdd,
  addLabel = "Add",
}: {
  icon: React.ReactNode;
  title: string;
  onAdd?: () => void;
  renderAdd?: () => React.ReactNode;
  addLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      {renderAdd
        ? renderAdd()
        : onAdd && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={onAdd}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {addLabel}
            </Button>
          )}
    </div>
  );
}

function DefaultHashtagAdder({
  onAdd,
}: {
  onAdd: (tag: string) => void;
}) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onAdd(String(data.get("tag") ?? ""));
        event.currentTarget.reset();
      }}
    >
      <Input
        name="tag"
        placeholder="#launchstack"
        className="h-8 text-sm"
        aria-label="New default hashtag"
      />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add
      </Button>
    </form>
  );
}

function DefaultCaptionAdder({
  onAdd,
}: {
  onAdd: (text: string) => void;
}) {
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onAdd(String(data.get("caption") ?? ""));
        event.currentTarget.reset();
      }}
    >
      <textarea
        name="caption"
        rows={2}
        placeholder="A default caption every post can start from…"
        className="flex-1 rounded border border-border bg-background p-2 text-sm"
        aria-label="New default caption"
      />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add
      </Button>
    </form>
  );
}
