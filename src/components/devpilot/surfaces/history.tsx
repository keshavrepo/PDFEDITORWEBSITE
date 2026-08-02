"use client";

/**
 * History surface for DevPilot.
 *
 * A single session holds the per-tool history: a list of entries
 * (recent + favourites), a tool filter and a search term. The
 * history is mirrored to the server via /api/devpilot/history and
 * the entries are kept in the session body so a future diff UI can
 * compare history snapshots.
 *
 * Mirrors /components/socialpilot/surfaces/notes.tsx.
 */

import { useState } from "react";
import { Star, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "../toast";
import {
  asHistoryBody,
  type DevHistoryBody,
  type DevHistoryEntry,
  type DevSession,
} from "@/lib/devpilot";

interface HistorySurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const TOOLS = ["all", "snippet", "history", "blank", "custom"];

function uniqueId(): string {
  return `devhist-${Math.random().toString(36).slice(2, 10)}`;
}

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistorySurface({ session, onChange }: HistorySurfaceProps) {
  const body = asHistoryBody(session.body);
  const { toast } = useToast();

  function commit(patch: Partial<DevHistoryBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function addEntry(text: string) {
    if (!text.trim()) return;
    const entry: DevHistoryEntry = {
      id: uniqueId(),
      toolName: body.toolFilter === "all" ? "snippet" : body.toolFilter,
      category: body.toolFilter === "all" ? "" : body.toolFilter,
      language: "",
      text: text.trim(),
      createdAt: new Date().toISOString(),
      isFavorite: false,
    };
    commit({ entries: [entry, ...body.entries].slice(0, 500) });
  }

  function toggleFavorite(id: string) {
    commit({
      entries: body.entries.map((entry) =>
        entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
      ),
    });
  }

  function removeEntry(id: string) {
    commit({ entries: body.entries.filter((entry) => entry.id !== id) });
    toast({ message: "Entry deleted", tone: "info" });
  }

  const term = body.search.trim().toLowerCase();
  const filtered = body.entries.filter((entry) => {
    if (body.toolFilter !== "all" && entry.toolName !== body.toolFilter) {
      return false;
    }
    if (!term) return true;
    return (
      entry.text.toLowerCase().includes(term) ||
      entry.toolName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Developer history</h2>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} of {body.entries.length} entries
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Tool</span>
            <select
              value={body.toolFilter}
              onChange={(event) => commit({ toolFilter: event.target.value })}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              {TOOLS.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-xs">
            <span className="font-medium">Search</span>
            <div className="relative">
              <Search
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={body.search}
                onChange={(event) => commit({ search: event.target.value })}
                placeholder="Search across history…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </label>
        </div>
        <AddEntryForm onAdd={addEntry} />
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-xs text-muted-foreground">
          No history yet — type something below to add the first entry.
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <Card className="p-3">
                <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {entry.toolName}
                  </span>
                  <span>{formatWhen(entry.createdAt)}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleFavorite(entry.id)}
                      aria-label={
                        entry.isFavorite ? "Unfavourite" : "Favourite"
                      }
                    >
                      <Star
                        className={
                          entry.isFavorite
                            ? "h-3.5 w-3.5 fill-primary text-primary"
                            : "h-3.5 w-3.5"
                        }
                        aria-hidden="true"
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => removeEntry(entry.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </span>
                </div>
                <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-mono text-xs">
                  {entry.text}
                </pre>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddEntryForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState("");
  function submit() {
    onAdd(value);
    setValue("");
  }
  return (
    <div className="mt-3 flex flex-col gap-1 text-xs">
      <span className="font-medium">Add entry</span>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Paste or type the entry…"
        className="min-h-[80px] rounded-md border border-border bg-background p-2 font-mono text-xs"
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Cmd / Ctrl + Enter to add
        </p>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={submit}
          disabled={!value.trim()}
        >
          Add entry
        </Button>
      </div>
    </div>
  );
}
