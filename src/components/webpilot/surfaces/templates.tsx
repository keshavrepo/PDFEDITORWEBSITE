"use client";

/**
 * Professional Project Templates surface.
 *
 * A professional Project Templates view. The user picks one of
 * the ten starter templates (Landing Page, Portfolio, Business
 * Website, SaaS Landing Page, Dashboard, Blog, Documentation,
 * Login Page, Pricing Page, Contact Page), the surface builds a
 * complete project tree (HTML, CSS, JavaScript, configuration),
 * the templates surface persists the project into the workspace,
 * and the multi-file editor opens with the new project already
 * loaded.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome`, the in-app toast and the existing `createWebSession`
 * engine so picking a template creates a regular WebPilot
 * session the rest of the workspace already understands.
 *
 * The surface is intentionally read-only on the metadata side:
 * the user picks a template, the engine creates a fresh
 * `projects` session, and the user is dropped into the
 * Multi-file Workspace. There is no in-place editing of the
 * template list itself.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Filter,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  buildProjectTemplateBody,
  createWebSession,
  PROFESSIONAL_PROJECT_TEMPLATES,
  sessionHref,
  type ProfessionalProjectTemplate,
} from "@/lib/webpilot";
import type { WebProjectsBody, WebSession } from "@/lib/webpilot";

interface TemplatesSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function TemplatesSurface({
  session,
  onChange,
}: TemplatesSurfaceProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return PROFESSIONAL_PROJECT_TEMPLATES;
    return PROFESSIONAL_PROJECT_TEMPLATES.filter(
      (entry) =>
        entry.name.toLowerCase().includes(term) ||
        entry.description.toLowerCase().includes(term) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  }, [search]);

  // Reset the last-created pin after a short delay so the
  // success indicator is visible but does not stick around.
  useEffect(() => {
    if (!lastCreatedId) return;
    const handle = window.setTimeout(() => setLastCreatedId(null), 5000);
    return () => window.clearTimeout(handle);
  }, [lastCreatedId]);

  async function apply(template: ProfessionalProjectTemplate) {
    setBusy(template.id);
    try {
      const built = buildProjectTemplateBody(template);
      // Persist the built project tree as the new session's
      // body. Without `initialBody` the engine would have created
      // an empty `projects` session and the template would have
      // been silently discarded.
      const initialBody: WebProjectsBody = {
        projectId: "",
        projectName: built.projectName,
        folders: built.folders.map((path) => ({
          id: `folder-${path}`,
          path,
          updatedAt: new Date(0).toISOString(),
        })),
        files: built.files.map((file) => ({
          id: `file-${file.path}`,
          path: file.path,
          kind: file.kind,
          source: file.source,
          savedSource: file.source,
          updatedAt: new Date(0).toISOString(),
        })),
        selectedPath: built.files[0]?.path ?? "index.html",
        search: "",
        recent: [],
        favorites: [],
        isFavorite: false,
      };
      const next = await createWebSession("projects", {
        title: built.projectName,
        initialBody,
      });
      // Record the template that was applied to the parent
      // session so the user can see what they built last.
      onChange({
        ...session,
        body: {
          kind: "templates",
          note: `Last applied: ${template.name} (${new Date().toISOString()})`,
        },
      });
      setLastCreatedId(template.id);
      toast({
        message: `Applied ${template.name}. Open it from the dashboard or the recent list.`,
        tone: "success",
      });
      // Open the multi-file workspace on the new project.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = "/webpilot/projects";
      void next;
    } catch (err) {
      toast({
        message:
          err instanceof Error ? err.message : "Failed to apply template",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Professional Project Templates — Landing Page, Portfolio, Business Website, SaaS Landing Page, Dashboard, Blog, Documentation, Login Page, Pricing Page, Contact Page."
        isFavorite={(session.body as { isFavorite?: boolean })?.isFavorite ?? false}
        onToggleFavorite={async () => {
          onChange({
            ...session,
            body: {
              ...(session.body as object),
              isFavorite:
                !(session.body as { isFavorite?: boolean })?.isFavorite,
            },
          });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        status={
          <span className="text-[10px] text-muted-foreground">
            {PROFESSIONAL_PROJECT_TEMPLATES.length} templates
          </span>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates by name, description or tag…"
              className="h-7 flex-1 border-0 text-xs"
              aria-label="Search templates"
            />
            <Filter
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {filtered.length} of {PROFESSIONAL_PROJECT_TEMPLATES.length}
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => {
            const isBusy = busy === template.id;
            const isLast = lastCreatedId === template.id;
            return (
              <Card
                key={template.id}
                className={
                  "flex flex-col gap-2 p-4 " +
                  (isLast ? "border-primary" : "")
                }
              >
                <div className="flex items-start gap-2">
                  <Sparkles
                    className="mt-0.5 h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold">{template.name}</h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {template.description}
                </p>
                <ul className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  {template.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded border border-border bg-muted/30 px-2 py-0.5"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted-foreground">
                  Added {template.addedAt}
                </p>
                <div className="mt-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={() => void apply(template)}
                    disabled={busy !== null}
                    aria-busy={isBusy}
                  >
                    {isBusy ? (
                      "Applying…"
                    ) : isLast ? (
                      <>
                        <CheckCircle2
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        Applied
                      </>
                    ) : (
                      <>
                        Use template
                        <ArrowRight
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </Button>
                  <a
                    href={sessionHref({
                      id: template.id,
                      kind: "templates",
                      slug: "templates",
                      name: template.name,
                      tagline: template.description,
                      description: template.description,
                      intro: template.description,
                      defaultCategory: "templates",
                      keywords: template.tags,
                      highlights: template.tags.slice(0, 3),
                      toolCount: 1,
                    })}
                    className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Preview metadata
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
