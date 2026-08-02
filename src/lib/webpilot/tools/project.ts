/**
 * Project Explorer helpers.
 *
 * Pure functions that the Project Explorer surface uses to manage
 * the project tree: file/folder creation, rename, delete,
 * duplicate, move, search, recents and favourites. Every function
 * is immutable — the caller is expected to apply the returned
 * patch to the body and let the autosave loop persist it.
 *
 * The path convention is a forward-slash separated string rooted at
 * the project root (empty string). The root is implicit; files
 * always have a non-empty path, folders may have an empty path
 * (the project root itself is never stored as a folder).
 */

import type {
  WebProjectFile,
  WebProjectFolder,
  WebProjectRecent,
} from "../types";

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function joinPath(parent: string, child: string): string {
  if (!parent) return child;
  if (!child) return parent;
  return `${parent}/${child}`;
}

function parentPath(path: string): string {
  if (!path) return "";
  const last = path.lastIndexOf("/");
  return last === -1 ? "" : path.slice(0, last);
}

function basename(path: string): string {
  if (!path) return "";
  const last = path.lastIndexOf("/");
  return last === -1 ? path : path.slice(last + 1);
}

function pathIsValid(path: string): boolean {
  if (path === "") return true;
  if (path.startsWith("/") || path.endsWith("/")) return false;
  if (path.includes("//")) return false;
  if (/[\x00-\x1f]/.test(path)) return false;
  return true;
}

function pathIsFolder(parent: string, folders: WebProjectFolder[]): boolean {
  return folders.some((folder) => folder.path === parent);
}

function uniqueCopyName(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;
  const lastDot = name.lastIndexOf(".");
  const stem = lastDot === -1 ? name : name.slice(0, lastDot);
  const ext = lastDot === -1 ? "" : name.slice(lastDot);
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${stem} (copy${i > 2 ? ` ${i - 1}` : ""})${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

function isFileKind(value: string): value is "html" | "css" | "javascript" {
  return value === "html" || value === "css" || value === "javascript";
}

function inferKind(name: string, fallback: "html" | "css" | "javascript" = "html"): "html" | "css" | "javascript" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "javascript";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return fallback;
}

/* -------------------------------------------------------------------------- */
/* File operations                                                            */
/* -------------------------------------------------------------------------- */

export interface CreateFileInput {
  /** Logical parent path, e.g. "src/components". */
  parent: string;
  /** File name including extension, e.g. "Card.tsx". */
  name: string;
  /** Optional initial source. */
  source?: string;
  /** Optional explicit kind. Inferred from the extension when omitted. */
  kind?: "html" | "css" | "javascript";
}

export interface CreateFileResult {
  ok: boolean;
  file?: WebProjectFile;
  error?: string;
}

export function createFile(
  folders: WebProjectFolder[],
  files: WebProjectFile[],
  input: CreateFileInput
): CreateFileResult {
  const parent = input.parent.trim();
  if (!pathIsValid(parent)) {
    return { ok: false, error: "Invalid parent path" };
  }
  if (parent !== "" && !pathIsFolder(parent, folders)) {
    return { ok: false, error: "Parent folder does not exist" };
  }
  const name = input.name.trim();
  if (!name || name.includes("/") || name.includes("\\")) {
    return { ok: false, error: "Invalid file name" };
  }
  const path = joinPath(parent, name);
  if (files.some((file) => file.path === path)) {
    return { ok: false, error: "A file with that path already exists" };
  }
  if (folders.some((folder) => folder.path === path)) {
    return { ok: false, error: "A folder with that path already exists" };
  }
  const kind = input.kind ?? (isFileKind(input.name) ? input.name : inferKind(name));
  return {
    ok: true,
    file: {
      id: randomId("file"),
      path,
      kind,
      source: input.source ?? "",
      savedSource: input.source ?? "",
      updatedAt: now(),
    },
  };
}

export interface CreateFolderInput {
  /** Logical parent path, e.g. "src". */
  parent: string;
  /** Folder name, e.g. "components". */
  name: string;
}

export interface CreateFolderResult {
  ok: boolean;
  folder?: WebProjectFolder;
  error?: string;
}

export function createFolder(
  folders: WebProjectFolder[],
  files: WebProjectFile[],
  input: CreateFolderInput
): CreateFolderResult {
  const parent = input.parent.trim();
  if (!pathIsValid(parent)) {
    return { ok: false, error: "Invalid parent path" };
  }
  if (parent !== "" && !pathIsFolder(parent, folders)) {
    return { ok: false, error: "Parent folder does not exist" };
  }
  const name = input.name.trim();
  if (!name || name.includes("/") || name.includes("\\")) {
    return { ok: false, error: "Invalid folder name" };
  }
  const path = joinPath(parent, name);
  if (folders.some((folder) => folder.path === path)) {
    return { ok: false, error: "A folder with that path already exists" };
  }
  if (files.some((file) => file.path === path)) {
    return { ok: false, error: "A file with that path already exists" };
  }
  return {
    ok: true,
    folder: { id: randomId("folder"), path, updatedAt: now() },
  };
}

export interface RenameEntryInput {
  /** Current path. */
  path: string;
  /** New name, e.g. "Button.tsx". */
  newName: string;
}

export interface RenameResult {
  ok: boolean;
  nextPath?: string;
  newFolders?: WebProjectFolder[];
  newFiles?: WebProjectFile[];
  error?: string;
}

export function renameEntry(
  folders: WebProjectFolder[],
  files: WebProjectFile[],
  input: RenameEntryInput
): RenameResult {
  const { path } = input;
  if (!path) return { ok: false, error: "Cannot rename the project root" };
  const newName = input.newName.trim();
  if (!newName || newName.includes("/") || newName.includes("\\")) {
    return { ok: false, error: "Invalid name" };
  }
  const parent = parentPath(path);
  const nextPath = joinPath(parent, newName);
  if (nextPath === path) return { ok: true, nextPath: path };
  if (nextPath.startsWith(path + "/")) {
    return { ok: false, error: "Cannot move a folder into itself" };
  }
  if (
    folders.some((folder) => folder.path === nextPath) ||
    files.some((file) => file.path === nextPath)
  ) {
    return { ok: false, error: "An entry with that name already exists" };
  }
  if (folders.some((folder) => folder.path === path)) {
    const newFolders = folders
      .filter((folder) => folder.path !== path)
      .map((folder) => {
        if (folder.path.startsWith(path + "/")) {
          return {
            ...folder,
            path: nextPath + folder.path.slice(path.length),
            updatedAt: now(),
          };
        }
        return { ...folder, updatedAt: now() };
      });
    const newFiles = files.map((file) => {
      if (file.path.startsWith(path + "/")) {
        return {
          ...file,
          path: nextPath + file.path.slice(path.length),
        };
      }
      return file;
    });
    return { ok: true, nextPath, newFolders, newFiles };
  }
  const file = files.find((entry) => entry.path === path);
  if (!file) return { ok: false, error: "Entry not found" };
  const newFiles = files.map((entry) =>
    entry.path === path
      ? {
          ...entry,
          path: nextPath,
          // Re-infer the kind from the new extension when the user
          // renamed an `.html` to `.css`, for example.
          kind: isFileKind(newName) ? newName : entry.kind,
          updatedAt: now(),
        }
      : entry
  );
  return { ok: true, nextPath, newFiles };
}

export interface DeleteEntryInput {
  path: string;
}

export interface DeleteResult {
  ok: boolean;
  newFolders?: WebProjectFolder[];
  newFiles?: WebProjectFile[];
  error?: string;
}

export function deleteEntry(
  folders: WebProjectFolder[],
  files: WebProjectFile[],
  input: DeleteEntryInput
): DeleteResult {
  const { path } = input;
  if (!path) return { ok: false, error: "Cannot delete the project root" };
  if (folders.some((folder) => folder.path === path)) {
    const newFolders = folders.filter(
      (folder) => folder.path !== path && !folder.path.startsWith(path + "/")
    );
    const newFiles = files.filter(
      (file) => !file.path.startsWith(path + "/")
    );
    return { ok: true, newFolders, newFiles };
  }
  if (files.some((file) => file.path === path)) {
    return {
      ok: true,
      newFiles: files.filter((file) => file.path !== path),
    };
  }
  return { ok: false, error: "Entry not found" };
}

export interface DuplicateEntryInput {
  path: string;
}

export interface DuplicateResult {
  ok: boolean;
  newFiles?: WebProjectFile[];
  newFolders?: WebProjectFolder[];
  error?: string;
}

export function duplicateEntry(
  folders: WebProjectFolder[],
  files: WebProjectFile[],
  input: DuplicateEntryInput
): DuplicateResult {
  const { path } = input;
  if (!path) return { ok: false, error: "Cannot duplicate the project root" };
  const file = files.find((entry) => entry.path === path);
  if (file) {
    const ext = file.path.lastIndexOf(".");
    const stem = ext === -1 ? file.path : file.path.slice(0, ext);
    const suffix = ext === -1 ? "" : file.path.slice(ext);
    const taken = new Set(files.map((entry) => entry.path));
    const newName = uniqueCopyName(
      `${basename(stem)} (copy)${suffix}`,
      taken
    );
    const newPath = joinPath(parentPath(path), newName);
    return {
      ok: true,
      newFiles: [
        ...files,
        {
          id: randomId("file"),
          path: newPath,
          kind: file.kind,
          source: file.source,
          savedSource: "",
          updatedAt: now(),
        },
      ],
    };
  }
  const folder = folders.find((entry) => entry.path === path);
  if (folder) {
    const taken = new Set([
      ...folders.map((entry) => entry.path),
      ...files.map((entry) => entry.path),
    ]);
    const newName = uniqueCopyName(
      `${basename(path)} (copy)`,
      taken
    );
    const newPath = joinPath(parentPath(path), newName);
    const newFolders = folders
      .filter((entry) => entry.path !== path && !entry.path.startsWith(path + "/"))
      .map((entry) => {
        if (entry.path.startsWith(path + "/")) {
          return {
            ...entry,
            path: newPath + entry.path.slice(path.length),
            updatedAt: now(),
          };
        }
        return entry;
      });
    newFolders.push({ id: randomId("folder"), path: newPath, updatedAt: now() });
    const newFiles = files
      .filter((entry) => !entry.path.startsWith(path + "/"))
      .map((entry) => {
        if (entry.path.startsWith(path + "/")) {
          return {
            ...entry,
            path: newPath + entry.path.slice(path.length),
          };
        }
        return entry;
      });
    return { ok: true, newFolders, newFiles };
  }
  return { ok: false, error: "Entry not found" };
}

export interface MoveEntryInput {
  /** Path of the entry to move. */
  path: string;
  /** Destination parent path. The empty string moves to the root. */
  destination: string;
}

export interface MoveResult {
  ok: boolean;
  newFolders?: WebProjectFolder[];
  newFiles?: WebProjectFile[];
  error?: string;
}

export function moveEntry(
  folders: WebProjectFolder[],
  files: WebProjectFile[],
  input: MoveEntryInput
): MoveResult {
  const { path, destination } = input;
  if (!path) return { ok: false, error: "Cannot move the project root" };
  if (!pathIsValid(destination)) {
    return { ok: false, error: "Invalid destination" };
  }
  if (destination !== "" && !pathIsFolder(destination, folders)) {
    return { ok: false, error: "Destination folder does not exist" };
  }
  if (destination === path || destination.startsWith(path + "/")) {
    return { ok: false, error: "Cannot move a folder into itself" };
  }
  const name = basename(path);
  const nextPath = joinPath(destination, name);
  if (
    folders.some((folder) => folder.path === nextPath) ||
    files.some((file) => file.path === nextPath)
  ) {
    return { ok: false, error: "An entry with that name already exists" };
  }
  if (folders.some((folder) => folder.path === path)) {
    const newFolders = folders
      .filter((folder) => folder.path !== path && !folder.path.startsWith(path + "/"))
      .map((folder) => {
        if (folder.path.startsWith(path + "/")) {
          return {
            ...folder,
            path: nextPath + folder.path.slice(path.length),
            updatedAt: now(),
          };
        }
        return { ...folder, updatedAt: now() };
      });
    newFolders.push({
      id: randomId("folder"),
      path: nextPath,
      updatedAt: now(),
    });
    const newFiles = files.map((file) =>
      file.path.startsWith(path + "/")
        ? { ...file, path: nextPath + file.path.slice(path.length) }
        : file
    );
    return { ok: true, newFolders, newFiles };
  }
  const file = files.find((entry) => entry.path === path);
  if (!file) return { ok: false, error: "Entry not found" };
  return {
    ok: true,
    newFiles: files.map((entry) =>
      entry.path === path ? { ...entry, path: nextPath, updatedAt: now() } : entry
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Listing, search, recents, favourites                                       */
/* -------------------------------------------------------------------------- */

export interface ProjectListingEntry {
  id: string;
  kind: "file" | "folder";
  name: string;
  path: string;
  parent: string;
  fileKind?: "html" | "css" | "javascript";
}

export function listProject(
  folders: WebProjectFolder[],
  files: WebProjectFile[]
): ProjectListingEntry[] {
  const folderEntries: ProjectListingEntry[] = folders.map((folder) => ({
    id: folder.id,
    kind: "folder",
    name: basename(folder.path),
    path: folder.path,
    parent: parentPath(folder.path),
  }));
  const fileEntries: ProjectListingEntry[] = files.map((file) => ({
    id: file.id,
    kind: "file",
    name: basename(file.path),
    path: file.path,
    parent: parentPath(file.path),
    fileKind: file.kind,
  }));
  return [...folderEntries, ...fileEntries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
}

export interface ProjectNode {
  entry: ProjectListingEntry;
  children: ProjectNode[];
}

export function buildProjectTree(
  folders: WebProjectFolder[],
  files: WebProjectFile[]
): ProjectNode | null {
  const listing = listProject(folders, files);
  if (listing.length === 0) return null;
  const root: ProjectNode = {
    entry: {
      id: "__root__",
      kind: "folder",
      name: "/",
      path: "",
      parent: "",
    },
    children: [],
  };
  const folderNodes = new Map<string, ProjectNode>();
  for (const folder of folders) {
    folderNodes.set(folder.path, {
      entry: {
        id: folder.id,
        kind: "folder",
        name: basename(folder.path),
        path: folder.path,
        parent: parentPath(folder.path),
      },
      children: [],
    });
  }
  for (const folder of folders) {
    const parent = parentPath(folder.path);
    const parentNode = parent === "" ? root : folderNodes.get(parent);
    if (parentNode) parentNode.children.push(folderNodes.get(folder.path)!);
  }
  for (const file of files) {
    const parent = parentPath(file.path);
    const parentNode = parent === "" ? root : folderNodes.get(parent);
    if (!parentNode) continue;
    parentNode.children.push({
      entry: {
        id: file.id,
        kind: "file",
        name: basename(file.path),
        path: file.path,
        parent,
        fileKind: file.kind,
      },
      children: [],
    });
  }
  sortNodeChildren(root);
  return root;
}

function sortNodeChildren(node: ProjectNode): void {
  node.children.sort((a, b) => {
    if (a.entry.kind !== b.entry.kind) {
      return a.entry.kind === "folder" ? -1 : 1;
    }
    return a.entry.path.localeCompare(b.entry.path);
  });
  for (const child of node.children) {
    sortNodeChildren(child);
  }
}

export function searchProject(
  folders: WebProjectFolder[],
  files: WebProjectFile[],
  query: string
): ProjectListingEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) return listProject(folders, files);
  return listProject(folders, files).filter((entry) =>
    entry.name.toLowerCase().includes(term)
  );
}

export function pushRecent(
  recent: WebProjectRecent[],
  path: string
): WebProjectRecent[] {
  if (!path) return recent;
  const entry: WebProjectRecent = { path, openedAt: now() };
  const next = [entry, ...recent.filter((other) => other.path !== path)];
  return next.slice(0, 20);
}

export function toggleFavorite(
  favorites: string[],
  path: string
): string[] {
  if (!path) return favorites;
  if (favorites.includes(path)) {
    return favorites.filter((entry) => entry !== path);
  }
  return [path, ...favorites];
}
