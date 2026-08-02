/**
 * Project Export helpers.
 *
 * Pure functions the Project Export surface uses to build a
 * deterministic ZIP archive from a snapshot of the project. The
 * function does not depend on JSZip at the type level so the
 * typechecker does not have to load the dependency; the surface
 * passes its own `pack` function the project tree, the asset
 * list, and the metadata block, and receives the packed buffer
 * back.
 *
 * The archive layout:
 *
 *   <archiveName>/
 *     <files at their logical path>
 *     assets/
 *       <asset name at its logical path>
 *     project.json   (metadata, when includeMetadata is true)
 *
 * The surface takes the resulting list of `{ path, bytes }`
 * entries and feeds them to JSZip. The function is intentionally
 * deterministic so a CI job that runs the export twice produces
 * the same archive.
 */

import type {
  WebAsset,
  WebExportAsset,
  WebExportEntry,
  WebProjectFile,
  WebProjectFolder,
} from "../types";

export interface ExportEntry extends WebExportEntry {}

export interface ExportManifest {
  /** The archive name (no extension). */
  archiveName: string;
  /** ISO timestamp the export was built. */
  builtAt: string;
  /** Total files included. */
  fileCount: number;
  /** Total folders included. */
  folderCount: number;
  /** Total assets included. */
  assetCount: number;
  /** Bytes of the source code (files only). */
  sourceBytes: number;
  /** Bytes of the asset payloads. */
  assetBytes: number;
}

export interface ExportOptions {
  archiveName: string;
  includeFolders: boolean;
  includeAssets: boolean;
  includeMetadata: boolean;
  prettyPrint: boolean;
}

/** A single entry the surface should write to the archive. */
export interface ExportFile {
  /** Path inside the archive, including the archiveName prefix. */
  path: string;
  /** The file contents. */
  contents: Uint8Array;
  /** MIME type (best effort). */
  mime: string;
}

/** Build a deterministic archive from a project snapshot. */
export function buildExport(
  files: WebProjectFile[],
  folders: WebProjectFolder[],
  assets: WebAsset[],
  options: ExportOptions
): {
  entries: ExportFile[];
  manifest: ExportManifest;
} {
  const archiveRoot = (options.archiveName || "webpilot-project").replace(
    /[^A-Za-z0-9._-]+/g,
    "_"
  );
  const entries: ExportFile[] = [];

  // Files
  let sourceBytes = 0;
  for (const file of files) {
    const bytes = new TextEncoder().encode(file.source);
    sourceBytes += bytes.length;
    entries.push({
      path: `${archiveRoot}/${file.path}`,
      contents: bytes,
      mime: mimeForKind(file.kind),
    });
  }

  // Folders: write a `.keep` file so the folder survives an empty
  // unzip. We only do this when the user explicitly opts in.
  if (options.includeFolders) {
    for (const folder of folders) {
      if (folder.path === "") continue;
      entries.push({
        path: `${archiveRoot}/${folder.path}/.keep`,
        contents: new TextEncoder().encode(""),
        mime: "text/plain",
      });
    }
  }

  // Assets
  let assetBytes = 0;
  if (options.includeAssets) {
    for (const asset of assets) {
      const dataUrl = asset.dataUrl;
      const bytes = decodeDataUrl(dataUrl);
      assetBytes += bytes.length;
      const folder = asset.folder ? `${asset.folder}/` : "";
      entries.push({
        path: `${archiveRoot}/assets/${folder}${asset.name}`,
        contents: bytes,
        mime: asset.mime || "application/octet-stream",
      });
    }
  }

  // Metadata
  const manifest: ExportManifest = {
    archiveName: archiveRoot,
    builtAt: new Date().toISOString(),
    fileCount: files.length,
    folderCount: folders.length,
    assetCount: assets.length,
    sourceBytes,
    assetBytes,
  };
  if (options.includeMetadata) {
    const json = options.prettyPrint
      ? JSON.stringify(
          {
            manifest,
            files: files.map((file) => ({
              id: file.id,
              path: file.path,
              kind: file.kind,
              bytes: file.source.length,
              updatedAt: file.updatedAt,
            })),
            folders: folders.map((folder) => ({
              id: folder.id,
              path: folder.path,
              updatedAt: folder.updatedAt,
            })),
            assets: assets.map<WebExportAsset>((asset) => ({
              id: asset.id,
              name: asset.name,
              folder: asset.folder,
              kind: asset.kind,
              size: asset.size,
              dataUrl: asset.dataUrl,
            })),
          },
          null,
          2
        )
      : JSON.stringify({
          manifest,
          files: files.map((file) => ({
            id: file.id,
            path: file.path,
            kind: file.kind,
            bytes: file.source.length,
            updatedAt: file.updatedAt,
          })),
          folders,
          assets: assets.map<WebExportAsset>((asset) => ({
            id: asset.id,
            name: asset.name,
            folder: asset.folder,
            kind: asset.kind,
            size: asset.size,
            dataUrl: asset.dataUrl,
          })),
        });
    entries.push({
      path: `${archiveRoot}/project.json`,
      contents: new TextEncoder().encode(json),
      mime: "application/json",
    });
  }

  // Sort entries so the output is byte-stable across runs.
  entries.sort((a, b) => a.path.localeCompare(b.path));

  return { entries, manifest };
}

function mimeForKind(kind: "html" | "css" | "javascript"): string {
  switch (kind) {
    case "html":
      return "text/html";
    case "css":
      return "text/css";
    case "javascript":
      return "application/javascript";
    default:
      return "text/plain";
  }
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return new Uint8Array();
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const isBase64 = /;base64$/i.test(header);
  if (!isBase64) {
    return new TextEncoder().encode(decodeURIComponent(body));
  }
  if (typeof atob === "function") {
    const binary = atob(body);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array();
}
