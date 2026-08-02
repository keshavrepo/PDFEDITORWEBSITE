"use client";

/**
 * Project Explorer surface.
 *
 * A professional file-tree for WebPilot. The surface renders the
 * project's folders and files as a tree on the left and a
 * details / preview panel on the right. The user can create
 * files, create folders, rename, delete, duplicate, drag and
 * drop, search, jump back into recently opened files, and pin
 * favourites. The explorer reuses the same tool chrome the
 * other WebPilot surfaces ship, and the CodeEditor for the
 * inline preview.
 *
 * Mirrors the DevPilot `properties/session.tsx` and the
 * workspace-dashboard pattern, but adds a real tree.
 */

import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus,
  Folder,
  FolderPlus,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { CodeEditor, type CodeLanguage } from "./shared/code-editor";
import {
  asProjectsBody,
  buildProjectTree,
  cloneProjectsBody,
  createFile,
  createFolder,
  deleteEntry,
  duplicateEntry,
  listProject,
  moveEntry,
  pushRecent,
  renameEntry,
  searchProject,
  toggleFavorite,
  tokeniseCss,
  tokeniseHtml,
  tokeniseJs,
} from "@/lib/webpilot";
import type {
  WebProjectEntry,
  WebProjectFile,
  WebProjectsBody,
  WebSession,
} from "@/lib/webpilot";

interface ProjectsSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

interface DragState {
  path: string;
  kind: "file" | "folder";
}

export function ProjectsSurface({ session, onChange }: ProjectsSurfaceProps) {
  const body = asProjectsBody(session.body);
  const { toast } = useToast();
  const dragRef = useRef<DragState | null>(null);
  const [creating, setCreating] = useState<{
    kind: "file" | "folder";
    parent: string;
    name: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [preview, setPreview] = useState<string>("");

  function commit(patch: Partial<WebProjectsBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  // The project body is a stable reference: commit() always
  // replaces the whole body via onChange, so the field dependencies
  // are safe even though the React Compiler cannot prove that.
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const listing = useMemo(
    () => listProject(body.folders, body.files),
    [body.folders, body.files]
  );
  const tree = useMemo(
    () => buildProjectTree(body.folders, body.files),
    [body.folders, body.files]
  );
  const search = body.search.trim().toLowerCase();
  const filteredListing = useMemo(
    () => searchProject(body.folders, body.files, body.search),
    [body.folders, body.files, body.search]
  );
  const filtered = new Set(filteredListing.map((entry) => entry.path));

  const activeFile = useMemo(
    () => body.files.find((file) => file.path === preview) ?? null,
    [body.files, preview]
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  function applyFolders(folders: WebProjectsBody["folders"]) {
    commit({ folders });
  }
  function applyFiles(files: WebProjectsBody["files"]) {
    commit({ files });
  }
  function applyBoth(
    folders: WebProjectsBody["folders"],
    files: WebProjectsBody["files"]
  ) {
    commit({ folders, files });
  }

  function handleSelect(path: string) {
    const file = body.files.find((entry) => entry.path === path);
    if (file) {
      setPreview(path);
      commit({ recent: pushRecent(body.recent, path) });
    } else {
      setPreview("");
    }
  }

  function handleCreate() {
    if (!creating) return;
    const trimmed = creating.name.trim();
    if (!trimmed) {
      setCreating(null);
      return;
    }
    if (creating.kind === "file") {
      const result = createFile(body.folders, body.files, {
        parent: creating.parent,
        name: trimmed,
      });
      if (!result.ok || !result.file) {
        toast({ message: result.error ?? "Failed to create file", tone: "error" });
        return;
      }
      applyFiles([...body.files, result.file]);
      setPreview(result.file.path);
      commit({ recent: pushRecent(body.recent, result.file.path) });
    } else {
      const result = createFolder(body.folders, body.files, {
        parent: creating.parent,
        name: trimmed,
      });
      if (!result.ok || !result.folder) {
        toast({ message: result.error ?? "Failed to create folder", tone: "error" });
        return;
      }
      applyFolders([...body.folders, result.folder]);
    }
    setCreating(null);
  }

  function startRename(path: string, currentName: string) {
    setRenaming(path);
    setRenameValue(currentName);
  }

  function handleRename() {
    if (!renaming) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenaming(null);
      return;
    }
    const result = renameEntry(body.folders, body.files, {
      path: renaming,
      newName: trimmed,
    });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to rename", tone: "error" });
      return;
    }
    if (result.newFolders) applyFolders(result.newFolders);
    if (result.newFiles) applyFiles(result.newFiles);
    if (result.nextPath && preview === renaming) setPreview(result.nextPath);
    setRenaming(null);
  }

  function handleDelete(path: string) {
    const result = deleteEntry(body.folders, body.files, { path });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to delete", tone: "error" });
      return;
    }
    if (result.newFolders) applyFolders(result.newFolders);
    if (result.newFiles) applyFiles(result.newFiles);
    if (preview === path || preview.startsWith(path + "/")) setPreview("");
  }

  function handleDuplicate(path: string) {
    const result = duplicateEntry(body.folders, body.files, { path });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to duplicate", tone: "error" });
      return;
    }
    if (result.newFolders) applyFolders(result.newFolders);
    if (result.newFiles) applyFiles(result.newFiles);
  }

  function handleDragStart(path: string, kind: "file" | "folder") {
    dragRef.current = { path, kind };
  }
  function handleDropOn(target: string) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.path === target) return;
    if (drag.path === target || target.startsWith(drag.path + "/")) return;
    const result = moveEntry(body.folders, body.files, {
      path: drag.path,
      destination: target,
    });
    if (!result.ok) {
      toast({ message: result.error ?? "Failed to move", tone: "error" });
      return;
    }
    if (result.newFolders) applyFolders(result.newFolders);
    if (result.newFiles) applyFiles(result.newFiles);
  }
  function handleDropOnRoot() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const result = moveEntry(body.folders, body.files, {
      path: drag.path,
      destination: "",
    });
    if (!result.ok) return;
    if (result.newFolders) applyFolders(result.newFolders);
    if (result.newFiles) applyFiles(result.newFiles);
  }

  function handleToggleFavorite(path: string) {
    commit({ favorites: toggleFavorite(body.favorites, path) });
  }

  const recent = body.recent
    .map((entry) => {
      const file = body.files.find((candidate) => candidate.path === entry.path);
      return file ? { path: entry.path, file } : null;
    })
    .filter((entry): entry is { path: string; file: WebProjectFile } => entry !== null)
    .slice(0, 8);
  const favorites = body.favorites
    .map((path) => body.files.find((file) => file.path === path))
    .filter((file): file is WebProjectFile => Boolean(file));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Project Explorer — folder tree, create / rename / delete / duplicate, drag and drop, search, recent and favourites."
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
            variant="ghost"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() =>
              setCreating({ kind: "file", parent: "", name: "" })
            }
          >
            <FilePlus className="h-3.5 w-3.5" aria-hidden="true" />
            New file
          </Button>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {body.files.length} files · {body.folders.length} folders
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,2fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={body.search}
              onChange={(event) => commit({ search: event.target.value })}
              placeholder="Search the tree…"
              className="h-7 flex-1 text-xs"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={() =>
                setCreating({ kind: "folder", parent: "", name: "" })
              }
            >
              <FolderPlus className="h-3 w-3" aria-hidden="true" />
              New folder
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {favorites.length > 0 && (
              <Section
                title="Favourites"
                onAdd={() =>
                  setCreating({ kind: "file", parent: "", name: "" })
                }
              >
                {favorites.map((file) => (
                  <EntryRow
                    key={`fav-${file.path}`}
                    entry={{
                      id: file.id,
                      kind: "file",
                      name: basename(file.path),
                      path: file.path,
                      fileKind: file.kind,
                    }}
                    active={preview === file.path}
                    matchesFilter={!search || filtered.has(file.path)}
                    renaming={renaming === file.path}
                    renameValue={renameValue}
                    onRenameValue={setRenameValue}
                    onSelect={() => handleSelect(file.path)}
                    onStartRename={() =>
                      startRename(file.path, basename(file.path))
                    }
                    onCommitRename={handleRename}
                    onCancelRename={() => setRenaming(null)}
                    onDelete={() => handleDelete(file.path)}
                    onDuplicate={() => handleDuplicate(file.path)}
                    onToggleFavorite={() => handleToggleFavorite(file.path)}
                    isFavorite
                    onDragStart={() => handleDragStart(file.path, "file")}
                    onDrop={() => handleDropOn(file.path)}
                    onStartCreate={(kind) =>
                      setCreating({ kind, parent: file.path, name: "" })
                    }
                  />
                ))}
              </Section>
            )}

            {recent.length > 0 && (
              <Section title="Recent">
                {recent.map(({ path, file }) => (
                  <EntryRow
                    key={`recent-${path}`}
                    entry={{
                      id: file.id,
                      kind: "file",
                      name: basename(file.path),
                      path: file.path,
                      fileKind: file.kind,
                    }}
                    active={preview === path}
                    matchesFilter={!search || filtered.has(path)}
                    renaming={false}
                    renameValue=""
                    onRenameValue={() => undefined}
                    onSelect={() => handleSelect(path)}
                    onStartRename={() =>
                      startRename(path, basename(path))
                    }
                    onCommitRename={() => undefined}
                    onCancelRename={() => undefined}
                    onDelete={() => handleDelete(path)}
                    onDuplicate={() => handleDuplicate(path)}
                    onToggleFavorite={() => handleToggleFavorite(path)}
                    isFavorite={body.favorites.includes(path)}
                    onDragStart={() => handleDragStart(path, "file")}
                    onDrop={() => handleDropOn(path)}
                    onStartCreate={(kind) =>
                      setCreating({ kind, parent: path, name: "" })
                    }
                  />
                ))}
              </Section>
            )}

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDropOnRoot();
              }}
              className="rounded-md"
            >
              <Section
                title="Project tree"
                onAdd={() =>
                  setCreating({ kind: "file", parent: "", name: "" })
                }
              >
                {tree ? (
                  <TreeNode
                    node={tree}
                    depth={0}
                    search={search}
                    preview={preview}
                    renaming={renaming}
                    renameValue={renameValue}
                    onRenameValue={setRenameValue}
                    onSelect={handleSelect}
                    onStartRename={startRename}
                    onCommitRename={handleRename}
                    onCancelRename={() => setRenaming(null)}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onToggleFavorite={handleToggleFavorite}
                    favorites={body.favorites}
                    onDragStart={handleDragStart}
                    onDrop={handleDropOn}
                    onStartCreate={(kind, parent) =>
                      setCreating({ kind, parent, name: "" })
                    }
                  />
                ) : (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    Empty project — start by creating a file or folder.
                  </p>
                )}
              </Section>
            </div>
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          {creating && (
            <Card className="p-3">
              <h3 className="mb-2 text-xs font-semibold">
                {creating.kind === "file" ? "New file" : "New folder"} in{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  {creating.parent || "/"}
                </code>
              </h3>
              <form
                className="flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreate();
                }}
              >
                <Input
                  autoFocus
                  value={creating.name}
                  onChange={(event) =>
                    setCreating({ ...creating, name: event.target.value })
                  }
                  placeholder={
                    creating.kind === "file"
                      ? "filename.html"
                      : "folder-name"
                  }
                  className="h-8 flex-1 text-xs"
                />
                <Button size="sm" className="h-8 text-xs" type="submit">
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setCreating(null)}
                  type="button"
                >
                  Cancel
                </Button>
              </form>
            </Card>
          )}

          {activeFile ? (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-2 py-1.5">
                <p className="text-xs font-semibold">
                  {basename(activeFile.path)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {activeFile.path} · {activeFile.source.length} bytes
                </p>
              </div>
              <CodeEditor
                value={activeFile.source}
                onChange={(next) => {
                  const newFiles = body.files.map((entry) =>
                    entry.path === activeFile.path
                      ? {
                          ...entry,
                          source: next,
                          updatedAt: new Date().toISOString(),
                        }
                      : entry
                  );
                  applyFiles(newFiles);
                }}
                language={activeFile.kind as CodeLanguage}
                tokenise={
                  activeFile.kind === "css"
                    ? tokeniseCss
                    : activeFile.kind === "javascript"
                      ? tokeniseJs
                      : tokeniseHtml
                }
                indent={2}
                ariaLabel={`Project file ${activeFile.path}`}
              />
            </Card>
          ) : (
            <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <FilePlus className="h-6 w-6" aria-hidden="true" />
              <p>Select a file to preview, or create a new file to begin.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  onAdd?: () => void;
  children: ReactNode;
}

function Section({ title, onAdd, children }: SectionProps) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Add to ${title}`}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

interface EntryRowProps {
  entry: WebProjectEntry;
  active: boolean;
  matchesFilter: boolean;
  renaming: boolean;
  renameValue: string;
  onRenameValue: (value: string) => void;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onStartCreate: (kind: "file" | "folder") => void;
}

function EntryRow({
  entry,
  active,
  matchesFilter,
  renaming,
  renameValue,
  onRenameValue,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  isFavorite,
  onDragStart,
  onDrop,
  onStartCreate,
}: EntryRowProps) {
  if (!matchesFilter) return null;
  const Icon = entry.kind === "folder" ? Folder : FilePlus;
  return (
    <li
      draggable={!renaming}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
    >
      <div
        className={
          "group flex items-center gap-1 rounded px-1 py-0.5 text-xs " +
          (active
            ? "bg-accent"
            : "hover:bg-accent/50")
        }
      >
        {entry.kind === "folder" ? (
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <FilePlus className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        {renaming ? (
          <Input
            value={renameValue}
            onChange={(event) => onRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            onBlur={onCommitRename}
            autoFocus
            className="h-6 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className="flex-1 truncate text-left"
          >
            {entry.name}
          </button>
        )}
        <EntryActions
          isFavorite={isFavorite}
          onStartRename={onStartRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onStartCreateFile={() => onStartCreate("file")}
          onStartCreateFolder={() => onStartCreate("folder")}
        />
      </div>
    </li>
  );
}

function EntryActions({
  isFavorite,
  onStartRename,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onStartCreateFile,
  onStartCreateFolder,
}: {
  isFavorite: boolean;
  onStartRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onStartCreateFile: () => void;
  onStartCreateFolder: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
      <button
        type="button"
        onClick={onToggleFavorite}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={isFavorite ? "Unfavourite" : "Favourite"}
      >
        <Star
          className={
            isFavorite
              ? "h-3 w-3 fill-primary text-primary"
              : "h-3 w-3"
          }
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        onClick={onStartRename}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Rename"
        title="Rename"
      >
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Duplicate"
        title="Duplicate"
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onStartCreateFile}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="New file inside"
        title="New file"
      >
        <FilePlus className="h-3 w-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onStartCreateFolder}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="New folder inside"
        title="New folder"
      >
        <FolderPlus className="h-3 w-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Delete"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

interface TreeNodeProps {
  node: import("@/lib/webpilot/tools/project").ProjectNode;
  depth: number;
  search: string;
  preview: string;
  renaming: string | null;
  renameValue: string;
  onRenameValue: (value: string) => void;
  onSelect: (path: string) => void;
  onStartRename: (path: string, name: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: (path: string) => void;
  onDuplicate: (path: string) => void;
  onToggleFavorite: (path: string) => void;
  favorites: string[];
  onDragStart: (path: string, kind: "file" | "folder") => void;
  onDrop: (path: string) => void;
  onStartCreate: (kind: "file" | "folder", parent: string) => void;
}

function TreeNode({
  node,
  depth,
  search,
  preview,
  renaming,
  renameValue,
  onRenameValue,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  favorites,
  onDragStart,
  onDrop,
  onStartCreate,
}: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  if (node.entry.path === "" && depth === 0) {
    // Render the children directly at the root.
    return (
      <ul>
        {node.children.map((child) => (
          <li key={child.entry.path || child.entry.id}>
            <TreeNode
              node={child}
              depth={0}
              search={search}
              preview={preview}
              renaming={renaming}
              renameValue={renameValue}
              onRenameValue={onRenameValue}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onToggleFavorite={onToggleFavorite}
              favorites={favorites}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onStartCreate={onStartCreate}
            />
          </li>
        ))}
      </ul>
    );
  }
  if (search && !nodeMatchesSearch(node, search)) return null;
  const isFolder = node.entry.kind === "folder";
  return (
    <li
      draggable={true}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(node.entry.path, node.entry.kind);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop(node.entry.path);
      }}
    >
      <div
        className={
          "group flex items-center gap-1 rounded px-1 py-0.5 text-xs " +
          (preview === node.entry.path ? "bg-accent" : "hover:bg-accent/50")
        }
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isFolder ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="inline-block h-3 w-3" aria-hidden="true" />
        )}
        {isFolder ? (
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <FilePlus className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        {renaming === node.entry.path ? (
          <Input
            value={renameValue}
            onChange={(event) => onRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            onBlur={onCommitRename}
            autoFocus
            className="h-6 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => (isFolder ? setOpen(!open) : onSelect(node.entry.path))}
            className="flex-1 truncate text-left"
          >
            {node.entry.name}
          </button>
        )}
        <EntryActions
          isFavorite={favorites.includes(node.entry.path)}
          onStartRename={() =>
            onStartRename(node.entry.path, node.entry.name)
          }
          onDuplicate={() => onDuplicate(node.entry.path)}
          onDelete={() => onDelete(node.entry.path)}
          onToggleFavorite={() => onToggleFavorite(node.entry.path)}
          onStartCreateFile={() => onStartCreate("file", node.entry.path)}
          onStartCreateFolder={() => onStartCreate("folder", node.entry.path)}
        />
      </div>
      {isFolder && open && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.entry.path || child.entry.id}
              node={child}
              depth={depth + 1}
              search={search}
              preview={preview}
              renaming={renaming}
              renameValue={renameValue}
              onRenameValue={onRenameValue}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onToggleFavorite={onToggleFavorite}
              favorites={favorites}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onStartCreate={onStartCreate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function nodeMatchesSearch(
  node: import("@/lib/webpilot/tools/project").ProjectNode,
  search: string
): boolean {
  if (node.entry.name.toLowerCase().includes(search)) return true;
  return node.children.some((child) => nodeMatchesSearch(child, search));
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

// ReactNode type re-export for the helper components.
import type { ReactNode } from "react";
void X;
