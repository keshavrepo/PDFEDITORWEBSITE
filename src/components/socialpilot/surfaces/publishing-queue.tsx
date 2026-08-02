"use client";

/**
 * Publishing Queue — Batch 3 surface.
 *
 * A kanban-style queue with five statuses (draft, ready, scheduled,
 * published, failed). Drag-and-drop reordering within a column;
 * move between columns to change status. Priority, bulk actions,
 * status filters and search are supported.
 */

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Search,
  Star,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { cn } from "@/lib/utils";
import {
  asQueueBody,
  DEFAULT_QUEUE_BODY,
  QUEUE_STATUSES,
  type SocialQueueStatus,
} from "@/lib/socialpilot/bodies";
import { platformColor, platformLabel } from "@/lib/socialpilot/platforms";
import type {
  SocialPlatformKey,
  SocialProject,
  SocialQueueBody,
  SocialQueueItem,
} from "@/lib/socialpilot";
import { PLATFORMS } from "@/lib/socialpilot/platforms";

interface PublishingQueueProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

const STATUS_LABELS: Record<SocialQueueStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

const STATUS_COLORS: Record<SocialQueueStatus, string> = {
  draft: "bg-muted text-foreground border-border",
  ready: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-300",
  scheduled:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  published:
    "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-300",
};

const STATUS_ICONS: Record<SocialQueueStatus, typeof Clock> = {
  draft: FileText,
  ready: Clock,
  scheduled: CalendarClock,
  published: CheckCircle2,
  failed: XCircle,
};

function randomId(): string {
  return `item-${Math.random().toString(36).slice(2, 10)}`;
}

export function PublishingQueue({ project, onChange }: PublishingQueueProps) {
  const body = asQueueBody(project.body);
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<SocialQueueItem | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<SocialQueueStatus | null>(
    null
  );
  const dragRef = useRef<string | null>(null);

  // Persist the queue body to the project.
  function commit(next: SocialQueueBody) {
    onChange({ ...project, body: next });
  }

  function addItem() {
    const next: SocialQueueItem = {
      id: randomId(),
      title: "Untitled item",
      projectId: "",
      platform: "",
      status: "draft",
      priority: body.items.length,
      scheduledFor: "",
      notes: "",
      mediaIds: [],
      failureReason: "",
    };
    commit({ ...body, items: [...body.items, next] });
    setEditing(next);
  }

  function updateItem(item: SocialQueueItem) {
    commit({
      ...body,
      items: body.items.map((entry) => (entry.id === item.id ? item : entry)),
    });
  }

  function deleteItem(id: string) {
    commit({ ...body, items: body.items.filter((entry) => entry.id !== id) });
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (editing?.id === id) setEditing(null);
  }

  function reorderItems(sourceId: string, targetId: string) {
    const sourceIndex = body.items.findIndex((entry) => entry.id === sourceId);
    const targetIndex = body.items.findIndex((entry) => entry.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;
    const next = [...body.items];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved!);
    // Recompute priorities so the order is stable across saves.
    const updated = next.map((entry, index) => ({ ...entry, priority: index }));
    commit({ ...body, items: updated });
  }

  function moveItemTo(id: string, status: SocialQueueStatus) {
    commit({
      ...body,
      items: body.items.map((entry) =>
        entry.id === id ? { ...entry, status } : entry
      ),
    });
  }

  function applyStatusToSelected(status: SocialQueueStatus) {
    if (selected.size === 0) return;
    commit({
      ...body,
      items: body.items.map((entry) =>
        selected.has(entry.id) ? { ...entry, status } : entry
      ),
    });
    toast({
      message: `Updated ${selected.size} item${selected.size === 1 ? "" : "s"}`,
      tone: "success",
    });
  }

  function deleteSelected() {
    if (selected.size === 0) return;
    commit({
      ...body,
      items: body.items.filter((entry) => !selected.has(entry.id)),
    });
    setSelected(new Set());
    toast({
      message: `Removed ${selected.size} item${selected.size === 1 ? "" : "s"}`,
      tone: "info",
    });
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const visible = filteredItems;
    if (visible.every((entry) => selected.has(entry.id))) {
      setSelected((current) => {
        const next = new Set(current);
        for (const entry of visible) next.delete(entry.id);
        return next;
      });
    } else {
      setSelected((current) => {
        const next = new Set(current);
        for (const entry of visible) next.add(entry.id);
        return next;
      });
    }
  }

  const filteredItems = (() => {
    const term = body.search.trim().toLowerCase();
    return body.items
      .filter((item) =>
        body.statusFilter === "all" ? true : item.status === body.statusFilter
      )
      .filter((item) => {
        if (!term) return true;
        return (
          item.title.toLowerCase().includes(term) ||
          platformLabel(item.platform).toLowerCase().includes(term) ||
          item.notes.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.priority - b.priority);
  })();

  const itemsByStatus = (() => {
    const out: Record<SocialQueueStatus, SocialQueueItem[]> = {
      draft: [],
      ready: [],
      scheduled: [],
      published: [],
      failed: [],
    };
    for (const item of filteredItems) out[item.status].push(item);
    return out;
  })();

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={addItem}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add item
            </Button>
            <div className="relative flex-1 min-w-[180px]">
              <Search
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={body.search}
                onChange={(event) =>
                  commit({ ...body, search: event.target.value })
                }
                placeholder="Search queue"
                className="h-7 pl-7 text-xs"
                aria-label="Search queue"
              />
            </div>
            <select
              value={body.statusFilter}
              onChange={(event) =>
                commit({
                  ...body,
                  statusFilter: event.target.value as
                    | SocialQueueStatus
                    | "all",
                })
              }
              className="h-7 rounded border border-border bg-background px-2 text-[10px]"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {QUEUE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={toggleAllVisible}
              disabled={filteredItems.length === 0}
            >
              {filteredItems.every((entry) => selected.has(entry.id)) &&
              filteredItems.length > 0
                ? "Clear all"
                : "Select all"}
            </Button>
          </div>
          {selected.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1 rounded-md border border-border bg-accent/40 p-2 text-xs">
              <span className="font-medium">{selected.size} selected</span>
              {QUEUE_STATUSES.map((status) => (
                <button
                  type="button"
                  key={status}
                  onClick={() => applyStatusToSelected(status)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px]",
                    STATUS_COLORS[status]
                  )}
                >
                  Mark {STATUS_LABELS[status]}
                </button>
              ))}
              <button
                type="button"
                onClick={deleteSelected}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {QUEUE_STATUSES.map((status) => (
            <QueueColumn
              key={status}
              status={status}
              items={itemsByStatus[status]}
              selected={selected}
              onToggle={toggleSelected}
              onEdit={setEditing}
              onDelete={deleteItem}
              onMoveTo={moveItemTo}
              onReorder={reorderItems}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              dragOverStatus={dragOverStatus}
              setDragOverStatus={setDragOverStatus}
              dragRef={dragRef}
            />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Card className="p-3 text-xs text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Tip:</strong>{" "}
            drag items within a column to change priority, or drag them
            between columns to change status. Use the bulk actions to
            mark a group of items as ready, scheduled, published or
            failed.
          </p>
        </Card>
        <Card className="p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            All items
          </p>
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {body.items.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No items yet
              </li>
            ) : (
              body.items
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full border",
                          STATUS_COLORS[item.status]
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {item.title}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {STATUS_LABELS[item.status]} ·{" "}
                          {platformLabel(item.platform)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
            )}
          </ul>
        </Card>
      </div>
      {editing && (
        <ItemEditor
          item={editing}
          onChange={updateItem}
          onDelete={deleteItem}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Kanban column                                                              */
/* -------------------------------------------------------------------------- */

interface QueueColumnProps {
  status: SocialQueueStatus;
  items: SocialQueueItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: SocialQueueItem) => void;
  onDelete: (id: string) => void;
  onMoveTo: (id: string, status: SocialQueueStatus) => void;
  onReorder: (sourceId: string, targetId: string) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dragOverStatus: SocialQueueStatus | null;
  setDragOverStatus: (status: SocialQueueStatus | null) => void;
  dragRef: React.MutableRefObject<string | null>;
}

function QueueColumn({
  status,
  items,
  selected,
  onToggle,
  onEdit,
  onDelete,
  onMoveTo,
  onReorder,
  draggingId,
  setDraggingId,
  dragOverStatus,
  setDragOverStatus,
  dragRef,
}: QueueColumnProps) {
  const Icon = STATUS_ICONS[status];
  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOverStatus(null);
    const id = dragRef.current;
    if (!id) return;
    if (dragRef.current === "self") {
      dragRef.current = null;
      return;
    }
    dragRef.current = null;
    onMoveTo(id, status);
  }
  return (
    <div
      className={cn(
        "flex h-full min-h-[260px] flex-col gap-2 rounded-lg border border-dashed border-border p-2 transition-colors",
        dragOverStatus === status && "border-foreground/40 bg-accent/30"
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOverStatus(status);
      }}
      onDragLeave={() => setDragOverStatus(null)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {STATUS_LABELS[status]}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums">
          {items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => {
              setDraggingId(item.id);
              dragRef.current = item.id;
            }}
            onDragEnd={() => {
              setDraggingId(null);
              dragRef.current = null;
              setDragOverStatus(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingId && draggingId !== item.id) {
                setDraggingId(draggingId);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const sourceId = dragRef.current;
              if (!sourceId || sourceId === item.id) return;
              dragRef.current = "self";
              // If the drop is on another column, change status;
              // otherwise reorder within the column.
              if (status !== dragOverStatus) {
                onMoveTo(sourceId, status);
              } else {
                onReorder(sourceId, item.id);
                dragRef.current = null;
              }
            }}
            className={cn(
              "rounded-lg border bg-background p-2 text-xs",
              STATUS_COLORS[status],
              selected.has(item.id) && "ring-2 ring-foreground/30"
            )}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => onToggle(item.id)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border"
                aria-label={`Select ${item.title}`}
                onClick={(event) => event.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="flex-1 text-left"
              >
                <p className="truncate font-medium text-foreground">
                  {item.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                  {item.platform && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        platformColor(item.platform)
                      )}
                    >
                      {platformLabel(item.platform)}
                    </span>
                  )}
                  {item.scheduledFor && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {item.scheduledFor}
                    </span>
                  )}
                  {item.priority > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                      Priority {item.priority + 1}
                    </span>
                  )}
                </div>
                {item.failureReason && (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-300">
                    {item.failureReason}
                  </p>
                )}
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Delete ${item.title}`}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded border border-dashed border-border p-4 text-center text-[10px] text-muted-foreground">
            Drop items here
          </li>
        )}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Item editor                                                                */
/* -------------------------------------------------------------------------- */

function ItemEditor({
  item,
  onChange,
  onDelete,
  onClose,
}: {
  item: SocialQueueItem;
  onChange: (next: SocialQueueItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit queue item</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Title</span>
            <Input
              value={item.title}
              onChange={(event) => onChange({ ...item, title: event.target.value })}
              className="h-8 text-sm"
              aria-label="Title"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Platform</span>
              <select
                value={item.platform}
                onChange={(event) =>
                  onChange({
                    ...item,
                    platform: event.target.value as SocialPlatformKey | "",
                  })
                }
                className="h-8 rounded border border-border bg-background px-2 text-sm"
                aria-label="Platform"
              >
                <option value="">No platform</option>
                {PLATFORMS.map((platform) => (
                  <option key={platform.key} value={platform.key}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Status</span>
              <select
                value={item.status}
                onChange={(event) =>
                  onChange({
                    ...item,
                    status: event.target.value as SocialQueueStatus,
                  })
                }
                className="h-8 rounded border border-border bg-background px-2 text-sm"
                aria-label="Status"
              >
                {QUEUE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Priority</span>
              <Input
                type="number"
                min={0}
                value={item.priority}
                onChange={(event) =>
                  onChange({
                    ...item,
                    priority: Math.max(0, Number(event.target.value) || 0),
                  })
                }
                className="h-8 text-sm"
                aria-label="Priority"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Scheduled for</span>
              <Input
                type="date"
                value={item.scheduledFor}
                onChange={(event) =>
                  onChange({ ...item, scheduledFor: event.target.value })
                }
                className="h-8 text-sm"
                aria-label="Scheduled for"
              />
            </label>
          </div>
          {item.status === "failed" && (
            <label className="flex flex-col gap-1">
              <span className="font-medium">Failure reason</span>
              <Input
                value={item.failureReason}
                onChange={(event) =>
                  onChange({ ...item, failureReason: event.target.value })
                }
                className="h-8 text-sm"
                placeholder="Why did this fail?"
                aria-label="Failure reason"
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-medium">Notes</span>
            <textarea
              value={item.notes}
              onChange={(event) => onChange({ ...item, notes: event.target.value })}
              rows={3}
              className="rounded border border-border bg-background p-2 text-sm"
              aria-label="Notes"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </Button>
          <Button size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
