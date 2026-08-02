"use client";

/**
 * Project Import surface.
 *
 * A professional project import view. The user picks a ZIP
 * archive the Project Export surface produced, the surface reads
 * the manifest, validates the file list, then merges the project
 * back into the workspace. Conflicts are surfaced one by one
 * and resolved with skip, replace, rename or merge. Validation
 * before import is the default — the surface rejects malformed
 * archives, files at illegal paths, and unknown MIME types.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome` and the in-app toast so it feels identical to
 * every other WebPilot tool.
 */

import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  PackageOpen,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { asWebAssets } from "./shared/webpilot-store";
import {
  asAssetsBody,
  asImportBody,
  asProjectsBody,
  detectArchiveRoot,
  mergeImport,
  validateArchive,
  type ImportEntry,
} from "@/lib/webpilot";
import type { WebSession } from "@/lib/webpilot";

interface ImportSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

const RESOLUTIONS = [
  { id: "skip", label: "Skip" },
  { id: "replace", label: "Replace" },
  { id: "rename", label: "Rename" },
  { id: "merge", label: "Merge" },
] as const;

export function ImportSurface({ session, onChange }: ImportSurfaceProps) {
  const body = asImportBody(session.body);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const assetsState = asWebAssets(session);
  const project = asProjectsBody(session.body);
  const assets = asAssetsBody(session.body);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  async function handleFile(file: File) {
    setBusy(true);
    setErrors([]);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(file);
      const entries: ImportEntry[] = [];
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const bytes = await entry.async("uint8array");
        entries.push({ path, contents: bytes });
      }
      const archiveRoot = detectArchiveRoot(entries);
      if (body.validateBeforeImport) {
        const validation = validateArchive(entries, archiveRoot);
        if (!validation.ok) {
          setErrors(validation.errors);
          toast({
            message: `Archive is invalid: ${validation.errors.length} issue${
              validation.errors.length === 1 ? "" : "s"
            }`,
            tone: "error",
          });
          setBusy(false);
          return;
        }
      }
      const result = mergeImport(
        entries,
        archiveRoot,
        {
          files: project.files,
          folders: project.folders,
          assets: assets.assets,
        },
        { defaultResolution: body.defaultResolution }
      );
      const newProjects = {
        ...project,
        files: result.files,
        folders: result.folders,
      };
      const newAssets = {
        ...assets,
        assets: result.assets,
      };
      onChange({
        ...session,
        body: {
          ...newProjects,
          ...newAssets,
          lastArchiveName: archiveRoot,
          lastImportAt: result.importedAt,
          lastFileCount: result.files.length,
          lastAssetCount: result.assets.length,
          lastConflictCount: result.conflicts.length,
          conflicts: result.conflicts,
        },
      });
      toast({
        message: `Imported ${result.files.length} files and ${result.assets.length} assets (${result.conflicts.length} conflict${
          result.conflicts.length === 1 ? "" : "s"
        })`,
        tone: result.conflicts.length > 0 ? "info" : "success",
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Failed to import archive",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Project Import — import a ZIP, restore folders, assets and metadata, with conflict handling and validation before import."
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
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Importing…" : "Choose ZIP…"}
          </Button>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.lastFileCount} files · {body.lastAssetCount} assets ·{" "}
            {body.lastConflictCount} conflict
            {body.lastConflictCount === 1 ? "" : "s"}
            {body.lastArchiveName ? ` · ${body.lastArchiveName}` : ""}
          </span>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,2fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="grid gap-2 p-3 text-[11px]">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Default conflict resolution
              </span>
              <select
                value={body.defaultResolution}
                onChange={(event) =>
                  commit({
                    defaultResolution: event.target
                      .value as typeof body.defaultResolution,
                  })
                }
                className="h-8 rounded border border-border bg-background px-2 text-xs"
                aria-label="Default conflict resolution"
              >
                {RESOLUTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-start gap-2 rounded border border-border bg-muted/30 p-2">
              <input
                type="checkbox"
                checked={body.validateBeforeImport}
                onChange={(event) =>
                  commit({ validateBeforeImport: event.target.checked })
                }
                className="mt-0.5"
                aria-label="Validate before import"
              />
              <span className="flex-1">
                <span className="block text-xs font-medium">
                  Validate before import
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  Reject malformed archives, illegal paths and unknown MIME
                  types before any merge happens.
                </span>
              </span>
            </label>
            <div className="rounded-md border border-border bg-muted/30 p-2 text-[10px] text-muted-foreground">
              <p className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                <PackageOpen className="h-3 w-3" aria-hidden="true" />
                Last import
              </p>
              <p>
                {body.lastImportAt
                  ? `Imported ${new Date(body.lastImportAt).toLocaleString()}`
                  : "No archive has been imported yet."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Result
          </div>
          <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-3 text-[11px]">
            {errors.length > 0 ? (
              <div className="rounded-md border border-destructive bg-destructive/10 p-2">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                  <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                  Validation failed
                </p>
                <ul className="mt-1 list-disc pl-4 text-[11px] text-destructive">
                  {errors.map((entry, index) => (
                    <li key={index}>{entry}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {body.conflicts.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
                <CheckCircle2
                  className="h-5 w-5 text-primary"
                  aria-hidden="true"
                />
                <p>
                  {body.lastImportAt
                    ? "No conflicts. The archive merged cleanly."
                    : "Choose a ZIP archive to import."}
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {body.conflicts.map((conflict, index) => (
                  <li
                    key={`${conflict.path}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <span className="flex-1 truncate font-mono text-[11px]">
                      {conflict.path}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {conflict.kind}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      {conflict.resolution}
                    </span>
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
