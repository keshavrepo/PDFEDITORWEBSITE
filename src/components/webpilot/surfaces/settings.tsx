"use client";

/**
 * Project Settings surface.
 *
 * A professional Project Settings view. The user edits the
 * project name, description, version, author, theme, custom
 * CSS, custom JavaScript, and the Open Graph / favicon
 * metadata. The settings are the single source of truth every
 * other WebPilot surface reads from: the multi-file editor
 * reads the custom CSS and JavaScript, the Project Export
 * surface reads the metadata, and the Workspace Productivity
 * surface reads the theme.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome` and the in-app toast so it feels identical to
 * every other WebPilot tool.
 */

import { useMemo, useState } from "react";
import {
  ClipboardCopy,
  Code2,
  Globe,
  Image as ImageIcon,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asSettingsBody,
  renderOpenGraphTags,
  renderProjectManifest,
  renderStandardMetaTags,
  validateCustomCss,
  validateCustomJavaScript,
} from "@/lib/webpilot";
import type { WebSession, WebSettingsBody } from "@/lib/webpilot";

interface SettingsSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function SettingsSurface({ session, onChange }: SettingsSurfaceProps) {
  const body = asSettingsBody(session.body);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"general" | "metadata" | "preview">(
    "general"
  );

  function commit(patch: Partial<WebSettingsBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const cssValidation = useMemo(
    () => validateCustomCss(body.customCss),
    [body.customCss]
  );
  const jsValidation = useMemo(
    () => validateCustomJavaScript(body.customJavaScript),
    [body.customJavaScript]
  );

  const ogTags = useMemo(
    () => renderOpenGraphTags(body.metadata),
    [body.metadata]
  );
  const standardMeta = useMemo(
    () => renderStandardMetaTags(body),
    [body]
  );
  const manifest = useMemo(() => renderProjectManifest(body), [body]);

  async function copy(value: string, message: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value);
        toast({ message, tone: "success" });
        return;
      } catch {
        /* ignore */
      }
    }
    toast({ message: "Could not copy", tone: "error" });
  }

  function save() {
    commit({ updatedAt: new Date().toISOString() });
    toast({ message: "Settings saved", tone: "success" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Project Settings — name, description, version, author, theme, custom CSS, custom JavaScript, metadata, favicon, Open Graph fields."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <Button
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={save}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Save settings
          </Button>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            v{body.version} · {body.theme} · {body.author || "no author"}
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,2fr]">
        <Card className="flex min-h-0 flex-col gap-1 p-0">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={
              "flex items-center gap-2 px-3 py-2 text-left text-xs " +
              (activeTab === "general"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
            }
            aria-pressed={activeTab === "general"}
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>General</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("metadata")}
            className={
              "flex items-center gap-2 px-3 py-2 text-left text-xs " +
              (activeTab === "metadata"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
            }
            aria-pressed={activeTab === "metadata"}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Metadata &amp; Open Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={
              "flex items-center gap-2 px-3 py-2 text-left text-xs " +
              (activeTab === "preview"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
            }
            aria-pressed={activeTab === "preview"}
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Custom code &amp; preview</span>
          </button>
        </Card>

        <Card className="min-h-0 overflow-auto p-4">
          {activeTab === "general" ? (
            <GeneralTab body={body} commit={commit} />
          ) : null}
          {activeTab === "metadata" ? (
            <MetadataTab body={body} commit={commit} />
          ) : null}
          {activeTab === "preview" ? (
            <PreviewTab
              body={body}
              commit={commit}
              cssValidation={cssValidation}
              jsValidation={jsValidation}
              ogTags={ogTags}
              standardMeta={standardMeta}
              manifest={manifest}
              onCopy={copy}
            />
          ) : null}
        </Card>
      </div>
    </div>
  );
}

interface GeneralTabProps {
  body: WebSettingsBody;
  commit: (patch: Partial<WebSettingsBody>) => void;
}

function GeneralTab({ body, commit }: GeneralTabProps) {
  return (
    <div className="grid gap-3 text-[11px]">
      <Field label="Project name">
        <Input
          value={body.projectName}
          onChange={(event) => commit({ projectName: event.target.value })}
          className="h-8 text-xs"
          aria-label="Project name"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={body.description}
          onChange={(event) => commit({ description: event.target.value })}
          className="min-h-20 w-full rounded border border-border bg-background p-2 text-xs"
          aria-label="Description"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Version">
          <Input
            value={body.version}
            onChange={(event) => commit({ version: event.target.value })}
            className="h-8 text-xs"
            aria-label="Version"
          />
        </Field>
        <Field label="Author">
          <Input
            value={body.author}
            onChange={(event) => commit({ author: event.target.value })}
            placeholder="Acme Inc."
            className="h-8 text-xs"
            aria-label="Author"
          />
        </Field>
      </div>
      <Field label="Theme">
        <select
          value={body.theme}
          onChange={(event) =>
            commit({
              theme: event.target.value as WebSettingsBody["theme"],
            })
          }
          className="h-8 rounded border border-border bg-background px-2 text-xs"
          aria-label="Theme"
        >
          <option value="default">Default (inherit workspace)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="high-contrast">High contrast</option>
        </select>
      </Field>
    </div>
  );
}

interface MetadataTabProps {
  body: WebSettingsBody;
  commit: (patch: Partial<WebSettingsBody>) => void;
}

function MetadataTab({ body, commit }: MetadataTabProps) {
  return (
    <div className="grid gap-3 text-[11px]">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Favicon URL">
          <Input
            value={body.metadata.favicon ?? ""}
            onChange={(event) =>
              commit({ metadata: { ...body.metadata, favicon: event.target.value } })
            }
            placeholder="/favicon.ico"
            className="h-8 text-xs"
            aria-label="Favicon URL"
          />
        </Field>
        <Field label="Canonical URL">
          <Input
            value={body.metadata.canonicalUrl ?? ""}
            onChange={(event) =>
              commit({
                metadata: { ...body.metadata, canonicalUrl: event.target.value },
              })
            }
            placeholder="https://example.com/"
            className="h-8 text-xs"
            aria-label="Canonical URL"
          />
        </Field>
        <Field label="Theme color">
          <Input
            value={body.metadata.themeColor ?? ""}
            onChange={(event) =>
              commit({
                metadata: { ...body.metadata, themeColor: event.target.value },
              })
            }
            placeholder="#0f172a"
            className="h-8 text-xs"
            aria-label="Theme color"
          />
        </Field>
        <Field label="Locale">
          <Input
            value={body.metadata.locale ?? ""}
            onChange={(event) =>
              commit({ metadata: { ...body.metadata, locale: event.target.value } })
            }
            placeholder="en_US"
            className="h-8 text-xs"
            aria-label="Locale"
          />
        </Field>
      </div>
      <Field label="Keywords">
        <Input
          value={body.metadata.keywords ?? ""}
          onChange={(event) =>
            commit({
              metadata: { ...body.metadata, keywords: event.target.value },
            })
          }
          placeholder="web, project, webpilot"
          className="h-8 text-xs"
          aria-label="Keywords"
        />
      </Field>
      <h3 className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Open Graph
      </h3>
      <Field label="OG title">
        <Input
          value={body.metadata.ogTitle ?? ""}
          onChange={(event) =>
            commit({ metadata: { ...body.metadata, ogTitle: event.target.value } })
          }
          className="h-8 text-xs"
          aria-label="OG title"
        />
      </Field>
      <Field label="OG description">
        <textarea
          value={body.metadata.ogDescription ?? ""}
          onChange={(event) =>
            commit({
              metadata: { ...body.metadata, ogDescription: event.target.value },
            })
          }
          className="min-h-16 w-full rounded border border-border bg-background p-2 text-xs"
          aria-label="OG description"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="OG image">
          <Input
            value={body.metadata.ogImage ?? ""}
            onChange={(event) =>
              commit({ metadata: { ...body.metadata, ogImage: event.target.value } })
            }
            placeholder="https://example.com/og.png"
            className="h-8 text-xs"
            aria-label="OG image"
          />
        </Field>
        <Field label="OG type">
          <Input
            value={body.metadata.ogType ?? ""}
            onChange={(event) =>
              commit({ metadata: { ...body.metadata, ogType: event.target.value } })
            }
            placeholder="website"
            className="h-8 text-xs"
            aria-label="OG type"
          />
        </Field>
        <Field label="OG URL">
          <Input
            value={body.metadata.ogUrl ?? ""}
            onChange={(event) =>
              commit({ metadata: { ...body.metadata, ogUrl: event.target.value } })
            }
            placeholder="https://example.com/"
            className="h-8 text-xs"
            aria-label="OG URL"
          />
        </Field>
        <Field label="Twitter card">
          <select
            value={body.metadata.twitterCard ?? "summary"}
            onChange={(event) =>
              commit({
                metadata: {
                  ...body.metadata,
                  twitterCard: event.target
                    .value as NonNullable<typeof body.metadata.twitterCard>,
                },
              })
            }
            className="h-8 rounded border border-border bg-background px-2 text-xs"
            aria-label="Twitter card"
          >
            <option value="summary">summary</option>
            <option value="summary_large_image">summary_large_image</option>
            <option value="app">app</option>
            <option value="player">player</option>
          </select>
        </Field>
        <Field label="Twitter site">
          <Input
            value={body.metadata.twitterSite ?? ""}
            onChange={(event) =>
              commit({
                metadata: { ...body.metadata, twitterSite: event.target.value },
              })
            }
            placeholder="@brand"
            className="h-8 text-xs"
            aria-label="Twitter site"
          />
        </Field>
        <Field label="Twitter creator">
          <Input
            value={body.metadata.twitterCreator ?? ""}
            onChange={(event) =>
              commit({
                metadata: {
                  ...body.metadata,
                  twitterCreator: event.target.value,
                },
              })
            }
            placeholder="@author"
            className="h-8 text-xs"
            aria-label="Twitter creator"
          />
        </Field>
      </div>
    </div>
  );
}

interface PreviewTabProps {
  body: WebSettingsBody;
  commit: (patch: Partial<WebSettingsBody>) => void;
  cssValidation: { ok: boolean; errors: string[] };
  jsValidation: { ok: boolean; errors: string[] };
  ogTags: string;
  standardMeta: string;
  manifest: string;
  onCopy: (value: string, message: string) => Promise<void>;
}

function PreviewTab({
  body,
  commit,
  cssValidation,
  jsValidation,
  ogTags,
  standardMeta,
  manifest,
  onCopy,
}: PreviewTabProps) {
  return (
    <div className="grid gap-3 text-[11px]">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Palette className="h-3 w-3" aria-hidden="true" />
        Custom CSS
      </div>
      <textarea
        value={body.customCss}
        onChange={(event) => commit({ customCss: event.target.value })}
        placeholder="/* Appended to every HTML file the export produces. */"
        className="min-h-32 w-full rounded border border-border bg-background p-2 font-mono text-[12px]"
        aria-label="Custom CSS"
      />
      {cssValidation.errors.length > 0 ? (
        <ul className="list-disc pl-4 text-[11px] text-destructive">
          {cssValidation.errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-muted-foreground">No issues detected.</p>
      )}

      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Code2 className="h-3 w-3" aria-hidden="true" />
        Custom JavaScript
      </div>
      <textarea
        value={body.customJavaScript}
        onChange={(event) => commit({ customJavaScript: event.target.value })}
        placeholder="// Appended to every HTML file the export produces."
        className="min-h-32 w-full rounded border border-border bg-background p-2 font-mono text-[12px]"
        aria-label="Custom JavaScript"
      />
      {jsValidation.errors.length > 0 ? (
        <ul className="list-disc pl-4 text-[11px] text-destructive">
          {jsValidation.errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-muted-foreground">No issues detected.</p>
      )}

      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Globe className="h-3 w-3" aria-hidden="true" />
        Generated &lt;head&gt; block
      </div>
      <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px]">
        {standardMeta || "// (no standard meta tags)"}
        {ogTags || "// (no Open Graph tags)"}
      </pre>

      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        project.json manifest
      </div>
      <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px]">
        {manifest}
      </pre>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[10px]"
          onClick={() => void onCopy(manifest, "Manifest copied")}
        >
          <ClipboardCopy className="h-3 w-3" aria-hidden="true" />
          Copy manifest
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        <ImageIcon
          className="mr-1 inline h-3 w-3"
          aria-hidden="true"
        />
        The Open Graph tags and the project.json manifest are written by
        the Project Export surface.
      </p>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
