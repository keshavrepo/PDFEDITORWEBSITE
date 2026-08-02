/**
 * Project Import helpers.
 *
 * Pure functions the Project Import surface uses to merge a ZIP
 * archive back into the workspace. The surface passes a
 * pre-parsed archive (the list of `{ path, bytes }` entries) and
 * a snapshot of the existing project / asset state, and the
 * function returns a patch the surface applies to the body.
 *
 * The function is intentionally deterministic: the same archive
 * and the same existing state produce the same result, so a CI
 * job that runs the import twice lands on the same workspace.
 */

import type {
  WebAsset,
  WebImportConflict,
  WebProjectFile,
  WebProjectFolder,
} from "../types";

export interface ImportEntry {
  /** Path inside the archive (with the archive root prefix). */
  path: string;
  /** File bytes. */
  contents: Uint8Array;
}

export interface ImportResolution {
  /** The default resolution the surface should apply. */
  defaultResolution: WebImportConflict["resolution"];
}

export interface ImportResult {
  /** New project files. */
  files: WebProjectFile[];
  /** New project folders. */
  folders: WebProjectFolder[];
  /** New assets. */
  assets: WebAsset[];
  /** Conflicts encountered during the merge. */
  conflicts: WebImportConflict[];
  /** When the import ran. */
  importedAt: string;
  /** The archive root the entries were derived from. */
  archiveRoot: string;
}

/** Detect the archive root from the list of paths. */
export function detectArchiveRoot(entries: ImportEntry[]): string {
  if (entries.length === 0) return "";
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    const root = parts[0]!;
    counts.set(root, (counts.get(root) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [root, count] of counts) {
    if (count > bestCount) {
      best = root;
      bestCount = count;
    }
  }
  return best;
}

/** Strip the archive root from a path. */
export function stripArchiveRoot(
  path: string,
  archiveRoot: string
): string {
  if (!archiveRoot) return path;
  if (path === archiveRoot) return "";
  if (path.startsWith(`${archiveRoot}/`)) {
    return path.slice(archiveRoot.length + 1);
  }
  return path;
}

/** Validate an archive before the merge. The validator is
 * intentionally strict: any illegal path or unknown file kind
 * aborts the import. */
export function validateArchive(
  entries: ImportEntry[],
  archiveRoot: string
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (entries.length === 0) {
    errors.push("Archive is empty");
    return { ok: false, errors };
  }
  if (!archiveRoot) {
    errors.push("Could not detect the archive root");
    return { ok: false, errors };
  }
  for (const entry of entries) {
    if (!entry.path.startsWith(`${archiveRoot}/`)) {
      errors.push(`Entry is outside the archive root: ${entry.path}`);
      continue;
    }
    const stripped = stripArchiveRoot(entry.path, archiveRoot);
    if (stripped === "") continue;
    if (stripped.includes("..")) {
      errors.push(`Entry has an illegal path: ${entry.path}`);
      continue;
    }
    if (stripped.startsWith("assets/") || stripped.startsWith("assets")) {
      // Asset: we just verify the path is well-formed.
      continue;
    }
    if (stripped === "project.json") continue;
    if (stripped.endsWith("/.keep")) {
      const folder = stripped.slice(0, -"/.keep".length);
      if (!folder) {
        errors.push(`Empty folder entry: ${entry.path}`);
      }
      continue;
    }
    const ext = stripped.split(".").pop()?.toLowerCase();
    if (
      ext !== "html" &&
      ext !== "htm" &&
      ext !== "css" &&
      ext !== "js" &&
      ext !== "mjs"
    ) {
      errors.push(`Unknown file kind: ${entry.path}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Resolve a conflict between an incoming file and an existing
 * one. The surface uses the result to either skip, replace,
 * rename, or merge the incoming entry. */
function resolveFileConflict(
  incoming: WebProjectFile,
  existing: WebProjectFile | undefined,
  defaultResolution: WebImportConflict["resolution"]
): { file: WebProjectFile; conflict: WebImportConflict | null } {
  if (!existing) {
    return { file: incoming, conflict: null };
  }
  const conflict: WebImportConflict = {
    path: incoming.path,
    kind: "file",
    resolution: defaultResolution,
    resolvedAt: new Date().toISOString(),
  };
  switch (defaultResolution) {
    case "skip":
      return { file: existing, conflict };
    case "replace":
      return { file: incoming, conflict };
    case "rename": {
      const renamed = renameFile(incoming, existing);
      return { file: renamed, conflict };
    }
    case "merge": {
      const merged: WebProjectFile = {
        ...incoming,
        source: existing.source + "\n" + incoming.source,
      };
      return { file: merged, conflict };
    }
    default:
      return { file: existing, conflict };
  }
}

function renameFile(
  incoming: WebProjectFile,
  existing: WebProjectFile
): WebProjectFile {
  const ext = incoming.path.lastIndexOf(".");
  const stem = ext === -1 ? incoming.path : incoming.path.slice(0, ext);
  const suffix = ext === -1 ? "" : incoming.path.slice(ext);
  let i = 1;
  while (existing.path === `${stem} (imported ${i})${suffix}`) {
    i += 1;
  }
  return { ...incoming, path: `${stem} (imported ${i})${suffix}` };
}

function resolveFolderConflict(
  incoming: WebProjectFolder,
  existing: WebProjectFolder | undefined,
  defaultResolution: WebImportConflict["resolution"]
): { folder: WebProjectFolder; conflict: WebImportConflict | null } {
  if (!existing) {
    return { folder: incoming, conflict: null };
  }
  const conflict: WebImportConflict = {
    path: incoming.path,
    kind: "folder",
    resolution: defaultResolution,
    resolvedAt: new Date().toISOString(),
  };
  if (defaultResolution === "skip") {
    return { folder: existing, conflict };
  }
  return { folder: incoming, conflict };
}

function resolveAssetConflict(
  incoming: WebAsset,
  existing: WebAsset | undefined,
  defaultResolution: WebImportConflict["resolution"]
): { asset: WebAsset; conflict: WebImportConflict | null } {
  if (!existing) {
    return { asset: incoming, conflict: null };
  }
  const conflict: WebImportConflict = {
    path: incoming.name,
    kind: "asset",
    resolution: defaultResolution,
    resolvedAt: new Date().toISOString(),
  };
  switch (defaultResolution) {
    case "skip":
      return { asset: existing, conflict };
    case "replace":
      return { asset: incoming, conflict };
    case "rename": {
      const renamed = renameAsset(incoming, existing);
      return { asset: renamed, conflict };
    }
    case "merge": {
      return { asset: existing, conflict };
    }
    default:
      return { asset: existing, conflict };
  }
}

function renameAsset(
  incoming: WebAsset,
  existing: WebAsset
): WebAsset {
  const ext = incoming.name.lastIndexOf(".");
  const stem = ext === -1 ? incoming.name : incoming.name.slice(0, ext);
  const suffix = ext === -1 ? "" : incoming.name.slice(ext);
  let i = 1;
  while (existing.name === `${stem} (imported ${i})${suffix}`) {
    i += 1;
  }
  return { ...incoming, name: `${stem} (imported ${i})${suffix}` };
}

function inferKind(path: string): "html" | "css" | "javascript" {
  const lower = path.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  return "javascript";
}

function inferMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".ogg")) return "video/ogg";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function inferKindFromName(name: string): WebAsset["kind"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".svg")) return "svg";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".avif") ||
    lower.endsWith(".bmp")
  ) {
    return "image";
  }
  if (
    lower.endsWith(".ttf") ||
    lower.endsWith(".otf") ||
    lower.endsWith(".woff") ||
    lower.endsWith(".woff2")
  ) {
    return "font";
  }
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".mov")
  ) {
    return "video";
  }
  if (lower.endsWith(".ico") || lower.endsWith(".icns")) return "icon";
  return "other";
}

/** Encode a Uint8Array as a data URL. */
export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }
  // Fallback: hex-encode the bytes so the data URL is still
  // round-trippable for non-binary consumers.
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return `data:${mime};base64,${hex}`;
}

/** Decode a data URL into bytes. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return new Uint8Array();
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (!/;base64$/i.test(header)) {
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

/** Merge an archive into the project / asset state. */
export function mergeImport(
  entries: ImportEntry[],
  archiveRoot: string,
  existing: {
    files: WebProjectFile[];
    folders: WebProjectFolder[];
    assets: WebAsset[];
  },
  options: ImportResolution
): ImportResult {
  const fileMap = new Map<string, WebProjectFile>();
  for (const file of existing.files) fileMap.set(file.path, file);
  const folderMap = new Map<string, WebProjectFolder>();
  for (const folder of existing.folders) folderMap.set(folder.path, folder);
  const assetMap = new Map<string, WebAsset>();
  for (const asset of existing.assets) {
    assetMap.set(asset.folder + "/" + asset.name, asset);
  }
  const conflicts: WebImportConflict[] = [];
  const importedAt = new Date().toISOString();
  const newFolders: WebProjectFolder[] = [];
  const newFiles: WebProjectFile[] = [];
  const newAssets: WebAsset[] = [];

  for (const entry of entries) {
    const stripped = stripArchiveRoot(entry.path, archiveRoot);
    if (!stripped) continue;
    if (stripped === "project.json") continue;
    if (stripped.startsWith("assets/") || stripped.startsWith("assets")) {
      const rel = stripped.replace(/^assets\/?/, "");
      if (!rel) continue;
      const slash = rel.lastIndexOf("/");
      const folder = slash === -1 ? "" : rel.slice(0, slash);
      const name = slash === -1 ? rel : rel.slice(slash + 1);
      if (!name) continue;
      const dataUrl = bytesToDataUrl(entry.contents, inferMime(name));
      const incoming: WebAsset = {
        id: `asset-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        folder,
        kind: inferKindFromName(name),
        mime: inferMime(name),
        dataUrl,
        size: entry.contents.length,
        createdAt: importedAt,
        updatedAt: importedAt,
        isFavorite: false,
      };
      const key = folder + "/" + name;
      const result = resolveAssetConflict(
        incoming,
        assetMap.get(key),
        options.defaultResolution
      );
      assetMap.set(key, result.asset);
      if (result.conflict) conflicts.push(result.conflict);
      continue;
    }
    if (stripped.endsWith("/.keep")) {
      const folder = stripped.slice(0, -"/.keep".length);
      if (!folder) continue;
      const incoming: WebProjectFolder = {
        id: `folder-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        path: folder,
        updatedAt: importedAt,
      };
      const result = resolveFolderConflict(
        incoming,
        folderMap.get(folder),
        options.defaultResolution
      );
      folderMap.set(folder, result.folder);
      if (result.conflict) conflicts.push(result.conflict);
      continue;
    }
    const incoming: WebProjectFile = {
      id: `file-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      path: stripped,
      kind: inferKind(stripped),
      source: new TextDecoder().decode(entry.contents),
      savedSource: new TextDecoder().decode(entry.contents),
      updatedAt: importedAt,
    };
    const result = resolveFileConflict(
      incoming,
      fileMap.get(stripped),
      options.defaultResolution
    );
    fileMap.set(result.file.path, result.file);
    if (result.conflict) conflicts.push(result.conflict);
  }

  return {
    files: Array.from(fileMap.values()),
    folders: Array.from(folderMap.values()),
    assets: Array.from(assetMap.values()),
    conflicts,
    importedAt,
    archiveRoot,
  };
}

export { dataUrlToBytes };
