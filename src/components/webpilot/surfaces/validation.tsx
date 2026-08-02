"use client";

/**
 * Project Validation surface.
 *
 * A professional project validation view. The user runs a single
 * pass over the project tree, the asset list, and the source
 * files, and the surface renders the issues with severity,
 * category, file path, line number and a one-line suggestion.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome` and the in-app toast so it feels identical to
 * every other WebPilot tool.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asProjectsBody,
  asValidationBody,
  runValidation,
  type ValidationOptions,
} from "@/lib/webpilot";
import { asWebAssets } from "./shared/webpilot-store";
import type { WebSession, WebValidationIssue } from "@/lib/webpilot";

interface ValidationSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

const CATEGORIES = [
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "javascript", label: "JavaScript" },
  { id: "link", label: "Links" },
  { id: "asset", label: "Assets" },
  { id: "duplicate-id", label: "Duplicate IDs" },
  { id: "accessibility", label: "Accessibility" },
  { id: "performance", label: "Performance" },
];

const SEVERITIES = [
  { id: "error", label: "Errors" },
  { id: "warning", label: "Warnings" },
  { id: "info", label: "Info" },
];

export function ValidationSurface({
  session,
  onChange,
}: ValidationSurfaceProps) {
  const body = asValidationBody(session.body);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const assetsState = asWebAssets(session);
  const project = useMemo(
    () => asProjectsBody(session.body),
    [session.body]
  );

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const issues = useMemo(() => {
    const term = body.search.trim().toLowerCase();
    return body.issues.filter((issue) => {
      if (
        body.categoryFilter &&
        body.categoryFilter !== "" &&
        issue.category !== body.categoryFilter
      ) {
        return false;
      }
      if (
        body.severityFilter &&
        body.severityFilter !== "" &&
        issue.severity !== body.severityFilter
      ) {
        return false;
      }
      if (!term) return true;
      return (
        issue.message.toLowerCase().includes(term) ||
        issue.path.toLowerCase().includes(term) ||
        (issue.suggestion ?? "").toLowerCase().includes(term)
      );
    });
  }, [body.issues, body.categoryFilter, body.severityFilter, body.search]);

  function run() {
    setBusy(true);
    const options: ValidationOptions = {
      html: body.enabledHtml,
      css: body.enabledCss,
      javascript: body.enabledJavascript,
      link: body.enabledLink,
      asset: body.enabledAsset,
      duplicateId: body.enabledDuplicateId,
      accessibility: body.enabledAccessibility,
      performance: body.enabledPerformance,
    };
    const result = runValidation(
      project.files,
      project.folders,
      assetsState.assets,
      options
    );
    commit({ issues: result.issues, summary: result.summary });
    setBusy(false);
    toast({
      message: `Validation complete: ${result.summary.errors} error${
        result.summary.errors === 1 ? "" : "s"
      }, ${result.summary.warnings} warning${
        result.summary.warnings === 1 ? "" : "s"
      }, ${result.summary.info} info`,
      tone:
        result.summary.errors > 0
          ? "error"
          : result.summary.warnings > 0
            ? "info"
            : "success",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Project Validation — HTML / CSS / JavaScript validation, broken link detection, missing asset detection, duplicate ID detection, accessibility warnings, performance hints."
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
            onClick={run}
            disabled={busy}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Running…" : "Run validation"}
          </Button>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.summary.errors} error{body.summary.errors === 1 ? "" : "s"} ·{" "}
            {body.summary.warnings} warning
            {body.summary.warnings === 1 ? "" : "s"} · {body.summary.info} info
            {" "}
            · {body.summary.files} file{body.summary.files === 1 ? "" : "s"}
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,3fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <Wand2
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Checks
            </p>
          </div>
          <div className="grid gap-1 overflow-auto p-2 text-[11px]">
            {CATEGORIES.map((category) => {
              const key = `enabled${
                category.id.charAt(0).toUpperCase() + category.id.slice(1)
              }` as
                | "enabledHtml"
                | "enabledCss"
                | "enabledJavascript"
                | "enabledLink"
                | "enabledAsset"
                | "enabledDuplicateId"
                | "enabledAccessibility"
                | "enabledPerformance";
              return (
                <label
                  key={category.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    checked={body[key] as boolean}
                    onChange={() => commit({ [key]: !body[key] } as Partial<typeof body>)}
                    aria-label={`Enable ${category.label}`}
                  />
                  <span>{category.label}</span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={body.search}
              onChange={(event) => commit({ search: event.target.value })}
              placeholder="Search issues…"
              className="h-7 flex-1 text-xs"
            />
            <select
              value={body.categoryFilter}
              onChange={(event) =>
                commit({ categoryFilter: event.target.value })
              }
              className="h-7 rounded border border-border bg-background px-2 text-[11px]"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            <select
              value={body.severityFilter}
              onChange={(event) =>
                commit({ severityFilter: event.target.value })
              }
              className="h-7 rounded border border-border bg-background px-2 text-[11px]"
              aria-label="Filter by severity"
            >
              <option value="">All severities</option>
              {SEVERITIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {issues.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                <p>
                  {body.issues.length === 0
                    ? "Click Run validation to scan the project."
                    : "No issues match the current filters."}
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {issues.map((issue) => (
                  <li key={issue.id}>
                    <IssueRow issue={issue} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: WebValidationIssue }) {
  const Icon =
    issue.severity === "error"
      ? TriangleAlert
      : issue.severity === "warning"
        ? AlertTriangle
        : Info;
  const color =
    issue.severity === "error"
      ? "text-destructive"
      : issue.severity === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-blue-600 dark:text-blue-400";
  return (
    <div className="flex items-start gap-2 rounded-md border border-border p-2">
      <Icon className={`mt-0.5 h-4 w-4 ${color}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">{issue.path}</span>
          <span>·</span>
          <span>line {issue.line}</span>
          <span>·</span>
          <span>{issue.category}</span>
        </p>
        <p className="mt-0.5 text-xs">{issue.message}</p>
        {issue.suggestion ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Suggestion: {issue.suggestion}
          </p>
        ) : null}
      </div>
    </div>
  );
}
