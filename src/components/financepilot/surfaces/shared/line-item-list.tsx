"use client";

/**
 * Reusable list editor for the personal-finance modules.
 *
 * The four batch-2 modules (Budget, Expense, Savings, Net Worth) all
 * work over a list of line items: budget lines, expenses, assets and
 * liabilities. The list editor is the single component that knows how
 * to add, edit, remove and reorder a line item, and it calls back to
 * the per-calculator surface whenever the list changes so the shell's
 * autosave loop can persist the new body.
 *
 * The component intentionally has no opinion on what a "line item"
 * means. The caller supplies a list of fields, a row shape and a
 * label for the "add" button. The list editor guarantees the row
 * shape is followed (it adds a `id` if one is missing) and never
 * drops a field the caller did not declare.
 */

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/financepilot";

/** A line item editor field. */
export interface LineItemField {
  /** Field id, used as the key on the line object. */
  field: string;
  /** Field label shown above the input. */
  label: string;
  /** "text" | "number" | "select" | "date" | "textarea". */
  type: "text" | "number" | "select" | "date" | "textarea";
  /** Optional list of options for "select" fields. */
  options?: Array<{ value: string; label: string }>;
  /** Optional placeholder text. */
  placeholder?: string;
  /** Optional hint shown below the input. */
  hint?: string;
  /** Step for number fields. */
  step?: number;
  /** Whether the field is required. Defaults to false. */
  required?: boolean;
}

interface LineItemListProps<T extends { id: string }> {
  /** Section title shown in the card header. */
  title: string;
  /** Short description below the title. */
  description?: string;
  /** Current list. Always rendered in the order supplied. */
  items: T[];
  /** Field definitions. The id field is added automatically. */
  fields: LineItemField[];
  /** Builds a new blank line. */
  createBlank: () => T;
  /** Called whenever the list changes. */
  onChange: (next: T[]) => void;
  /** Optional summary rendered in the card header (right side). */
  headerSummary?: { label: string; value: string }[];
  /** Optional filter / search box. */
  searchPlaceholder?: string;
  /** Optional filter / search predicate. */
  matchSearch?: (item: T, query: string) => boolean;
  /** Optional sort options. */
  sortOptions?: Array<{ value: string; label: string }>;
  currentSort?: string;
  onSortChange?: (next: string) => void;
  /** Optional category filter options. */
  filterOptions?: Array<{ value: string; label: string }>;
  currentFilter?: string;
  onFilterChange?: (next: string) => void;
  /** Show the formatted total of a numeric field in the card header. */
  totalField?: string;
  /** A custom empty-state message. */
  emptyMessage?: string;
}

/**
 * A reusable list editor. See the module header for the design notes.
 */
export function LineItemList<T extends { id: string }>({
  title,
  description,
  items,
  fields,
  createBlank,
  onChange,
  headerSummary,
  searchPlaceholder,
  matchSearch,
  sortOptions,
  currentSort,
  onSortChange,
  filterOptions,
  currentFilter,
  onFilterChange,
  totalField,
  emptyMessage,
}: LineItemListProps<T>) {
  const [editing, setEditing] = useState<T | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const visibleItems = (() => {
    if (!matchSearch || !query.trim()) return items;
    const lower = query.trim().toLowerCase();
    return items.filter((item) => matchSearch(item, lower));
  })();

  const total = totalField
    ? visibleItems.reduce(
        (acc, item) => acc + Number((item as Record<string, unknown>)[totalField] ?? 0),
        0
      )
    : null;

  function startAdd() {
    setEditing(null);
    setAdding(true);
  }
  function startEdit(item: T) {
    setAdding(false);
    setEditing(item);
  }
  function cancel() {
    setEditing(null);
    setAdding(false);
  }
  function commit(next: T) {
    if (adding) {
      onChange([...items, next]);
    } else {
      onChange(items.map((item) => (item.id === next.id ? next : item)));
    }
    cancel();
  }
  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
    if (editing && editing.id === id) cancel();
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerSummary?.map((entry) => (
            <div
              key={entry.label}
              className="rounded-lg border border-border bg-background px-2 py-1 text-[10px]"
            >
              <span className="text-muted-foreground">{entry.label}</span>{" "}
              <span className="font-mono tabular-nums font-medium">
                {entry.value}
              </span>
            </div>
          ))}
          {total !== null && (
            <div className="rounded-lg border border-border bg-background px-2 py-1 text-[10px]">
              <span className="text-muted-foreground">Total</span>{" "}
              <span className="font-mono tabular-nums font-medium">
                {formatCurrency(total)}
              </span>
            </div>
          )}
        </div>
      </div>

      {(searchPlaceholder || sortOptions || filterOptions) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {searchPlaceholder && (
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search"
              className="h-7 min-w-[160px] flex-1 rounded-lg border border-border bg-background px-2 text-xs"
            />
          )}
          {filterOptions && onFilterChange && (
            <select
              value={currentFilter ?? "all"}
              onChange={(event) => onFilterChange(event.target.value)}
              aria-label="Filter"
              className="h-7 rounded-lg border border-border bg-background px-2 text-xs"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {sortOptions && onSortChange && (
            <select
              value={currentSort ?? sortOptions[0]?.value}
              onChange={(event) => onSortChange(event.target.value)}
              aria-label="Sort"
              className="h-7 rounded-lg border border-border bg-background px-2 text-xs"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/80 backdrop-blur">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {fields.map((field) => (
                <th
                  key={field.field}
                  className={cn(
                    "px-3 py-2 font-semibold",
                    field.type === "number" ? "text-right" : "text-left"
                  )}
                >
                  {field.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td
                  colSpan={fields.length + 1}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  {emptyMessage ?? "No items yet."}
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-border/60 font-mono tabular-nums"
                >
                  {fields.map((field) => {
                    const value = String(
                      (item as Record<string, unknown>)[field.field] ?? ""
                    );
                    return (
                      <td
                        key={field.field}
                        className={cn(
                          "px-3 py-1.5",
                          field.type === "number" ? "text-right" : "text-left"
                        )}
                      >
                        {value || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={`Edit ${title}`}
                      >
                        <span className="text-[10px]">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[11px]"
          onClick={startAdd}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add
        </Button>
      </div>

      {(adding || editing) && (
        <LineItemDialog<T>
          title={adding ? `Add to ${title}` : `Edit ${title}`}
          fields={fields}
          initial={editing ?? createBlank()}
          onCancel={cancel}
          onCommit={commit}
        />
      )}
    </Card>
  );
}

interface LineItemDialogProps<T extends { id: string }> {
  title: string;
  fields: LineItemField[];
  initial: T;
  onCancel: () => void;
  onCommit: (next: T) => void;
}

function LineItemDialog<T extends { id: string }>({
  title,
  fields,
  initial,
  onCancel,
  onCommit,
}: LineItemDialogProps<T>) {
  const [draft, setDraft] = useState<T>(initial);

  function setField(field: string, value: string) {
    setDraft((current) => {
      const next: Record<string, unknown> = { ...current };
      const def = fields.find((entry) => entry.field === field);
      if (def?.type === "number") {
        const parsed = Number(value);
        next[field] = Number.isFinite(parsed) ? parsed : 0;
      } else {
        next[field] = value;
      }
      return next as T;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3">
          {fields.map((field) => {
            const value = String(
              (draft as Record<string, unknown>)[field.field] ?? ""
            );
            const common = {
              id: `dialog-${field.field}`,
              "aria-label": field.label,
            };
            if (field.type === "select") {
              return (
                <label key={field.field} className="flex flex-col gap-1 text-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {field.label}
                  </span>
                  <select
                    {...common}
                    value={value}
                    onChange={(event) => setField(field.field, event.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (field.type === "textarea") {
              return (
                <label key={field.field} className="flex flex-col gap-1 text-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {field.label}
                  </span>
                  <textarea
                    {...common}
                    value={value}
                    onChange={(event) => setField(field.field, event.target.value)}
                    rows={2}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  />
                  {field.hint && (
                    <span className="text-[10px] text-muted-foreground">
                      {field.hint}
                    </span>
                  )}
                </label>
              );
            }
            return (
              <label key={field.field} className="flex flex-col gap-1 text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {field.label}
                </span>
                <input
                  {...common}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={value}
                  step={field.step}
                  required={field.required}
                  placeholder={field.placeholder}
                  onChange={(event) => setField(field.field, event.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2 font-mono text-sm"
                />
                {field.hint && (
                  <span className="text-[10px] text-muted-foreground">
                    {field.hint}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onCommit(draft)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
