"use client";

/**
 * Project Export surface.
 *
 * A professional project export view. The user picks an archive
 * name, chooses what to include (files, folders, assets, metadata),
 * and the surface builds a deterministic ZIP archive through
 * JSZip. The archive mirrors the project tree: every file lands
 * at its logical path, every folder is recreated (via `.keep`
 * markers), every asset ships as a data URL, and the project
 * metadata is captured in a `project.json` manifest.
 *
 * The surface reuses the existing `WebWorkspace` shell, the
 * `ToolChrome` and the in-app toast so it feels identical to
 * every other WebPilot tool.
 */

import { useState } from "react";
import {
  Download,
  FileArchive,
  Folder,
  Package,
  PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { asWebAssets } from "./shared/webpilot-store";
import {
  asExportBody,
  asProjectsBody,
  buildExport,
  formatBytes,
} from "@/lib/webpilot";
import type { WebSession } from "@/lib/webpilot";

interface ExportSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function ExportSurface({ session, onChange }: ExportSurfaceProps) {
  const body = asExportBody(session.body);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const assetsState = asWebAssets(session);
  const project = asProjectsBody(session.body);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  async function buildArchive() {
    setBusy(true);
    try {
      const { entries, manifest } = buildExport(
        project.files,
        project.folders,
        assetsState.assets,
        {
          archiveName: body.archiveName,
          includeFolders: body.includeFolders,
          includeAssets: body.includeAssets,
          includeMetadata: body.includeMetadata,
          prettyPrint: body.prettyPrint,
        }
      );
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let totalSize = 0;
      for (const entry of entries) {
        zip.file(entry.path, entry.contents);
        totalSize += entry.contents.length;
      }
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${body.archiveName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      commit({
        lastSize: totalSize,
        lastBuiltAt: new Date().toISOString(),
      });
      toast({
        message: `Exported ${manifest.fileCount} files (${formatBytes(
          totalSize
        )})`,
        tone: "success",
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Failed to build archive",
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
        description="Project Export — export the complete project as a ZIP, with clean folder structure, assets, folders and metadata preserved."
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
            onClick={buildArchive}
            disabled={busy}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Building…" : "Build & download"}
          </Button>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {project.files.length} files · {project.folders.length} folders ·{" "}
            {assetsState.assets.length} assets
            {body.lastSize > 0
              ? ` · last ${formatBytes(body.lastSize)}`
              : ""}
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,2fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="grid gap-2 p-3 text-[11px]">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Archive name
              </span>
              <Input
                value={body.archiveName}
                onChange={(event) => commit({ archiveName: event.target.value })}
                placeholder="webpilot-project"
                className="h-8 text-xs"
                aria-label="Archive name"
              />
            </label>
            <Toggle
              label="Include folders"
              description="Recreate every folder via a .keep marker."
              checked={body.includeFolders}
              onChange={(value) => commit({ includeFolders: value })}
            />
            <Toggle
              label="Include assets"
              description="Embed every uploaded asset as a data URL."
              checked={body.includeAssets}
              onChange={(value) => commit({ includeAssets: value })}
            />
            <Toggle
              label="Include metadata"
              description="Embed a project.json manifest in the archive."
              checked={body.includeMetadata}
              onChange={(value) => commit({ includeMetadata: value })}
            />
            <Toggle
              label="Pretty-print manifest"
              description="Format project.json with 2-space indent."
              checked={body.prettyPrint}
              onChange={(value) => commit({ prettyPrint: value })}
            />
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3 w-3" aria-hidden="true" />
            Preview
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-[auto,1fr,auto] gap-2 p-3 text-[11px]">
            <p className="rounded border border-border bg-muted/30 px-2 py-1 font-mono">
              {body.archiveName || "webpilot-project"}/
            </p>
            <ul className="min-h-0 overflow-auto rounded border border-border bg-muted/30 p-2 font-mono">
              {project.files.slice(0, 12).map((file) => (
                <li key={file.id} className="flex items-center gap-1">
                  <span className="text-muted-foreground">├─</span>
                  <span>{file.path}</span>
                </li>
              ))}
              {project.files.length > 12 ? (
                <li className="text-muted-foreground">
                  … {project.files.length - 12} more
                </li>
              ) : null}
              {body.includeAssets ? (
                <li className="mt-2 flex items-center gap-1">
                  <Folder
                    className="h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>assets/</span>
                </li>
              ) : null}
              {body.includeAssets
                ? assetsState.assets.slice(0, 4).map((asset) => (
                    <li key={asset.id} className="flex items-center gap-1 pl-4">
                      <span className="text-muted-foreground">├─</span>
                      <span>{asset.name}</span>
                    </li>
                  ))
                : null}
              {body.includeMetadata ? (
                <li className="mt-2 flex items-center gap-1">
                  <FileArchive
                    className="h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>project.json</span>
                </li>
              ) : null}
            </ul>
            <div className="rounded-md border border-border bg-muted/30 p-2 text-[10px] text-muted-foreground">
              <p className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                <PackageOpen className="h-3 w-3" aria-hidden="true" />
                Last build
              </p>
              <p>
                {body.lastBuiltAt
                  ? `Built ${new Date(body.lastBuiltAt).toLocaleString()} (${formatBytes(
                      body.lastSize
                    )})`
                  : "No archive has been built yet."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-start gap-2 rounded border border-border bg-muted/30 p-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5"
        aria-label={label}
      />
      <span className="flex-1">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[10px] text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}
