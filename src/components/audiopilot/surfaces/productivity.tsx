"use client";

/**
 * Workspace Productivity — AudioPilot surface.
 *
 * Hosts the Command Palette (Ctrl/Cmd + Shift + P), the keyboard
 * shortcut reference, the recent sessions list, the quick actions
 * row and the workspace settings. The surface reuses the same
 * IndexedDB-backed store every other surface uses, so the
 * settings and the recent list survive a reload.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Command,
  History as HistoryIcon,
  Keyboard,
  Search,
  Settings2,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import {
  asProductivityBody,
  fuzzyMatchCommands,
  sessions as allSessions,
  sessionHref,
  type AudioProductivityCommand,
  type AudioProductivityQuickAction,
} from "@/lib/audiopilot";
import type { AudioSession } from "@/lib/audiopilot";

interface AudioProductivitySurfaceProps {
  session: AudioSession;
  onChange: (next: AudioSession) => void;
}

const DEFAULT_QUICK_ACTIONS: AudioProductivityQuickAction[] = [
  {
    id: "qa-player",
    label: "Open Audio Player",
    description: "Play any MP3, WAV, OGG, FLAC or AAC file.",
    target: "player",
    shortcut: "Ctrl/Cmd + 1",
  },
  {
    id: "qa-trimmer",
    label: "Open Audio Trimmer",
    description: "Trim, undo / redo, precision controls.",
    target: "trimmer",
    shortcut: "Ctrl/Cmd + 2",
  },
  {
    id: "qa-converter",
    label: "Open Audio Converter",
    description: "MP3, WAV, OGG, FLAC, AAC import and export.",
    target: "converter",
    shortcut: "Ctrl/Cmd + 3",
  },
  {
    id: "qa-recorder",
    label: "Open Recorder",
    description: "Microphone capture, pause, resume, save.",
    target: "recorder",
    shortcut: "Ctrl/Cmd + 4",
  },
  {
    id: "qa-merger",
    label: "Open Audio Merger",
    description: "Merge unlimited audio files.",
    target: "merger",
    shortcut: "Ctrl/Cmd + 5",
  },
  {
    id: "qa-splitter",
    label: "Open Audio Splitter",
    description: "Split by time, by markers, by silence.",
    target: "splitter",
    shortcut: "Ctrl/Cmd + 6",
  },
  {
    id: "qa-metadata",
    label: "Open Metadata Editor",
    description: "Title, artist, album, cover art, save metadata.",
    target: "metadata",
  },
  {
    id: "qa-batch",
    label: "Open Batch Processing",
    description: "Batch convert, rename, metadata, export.",
    target: "batch",
  },
  {
    id: "qa-library",
    label: "Open Audio Library",
    description: "Recent files, favourites, search, sort.",
    target: "library",
  },
  {
    id: "qa-waveform",
    label: "Open Waveform Editor",
    description: "High-resolution waveform, zoom, selection, markers.",
    target: "waveform-editor",
  },
  {
    id: "qa-effects",
    label: "Open Audio Effects",
    description: "Fade, normalize, reverse, speed, pitch.",
    target: "effects",
  },
  {
    id: "qa-silence",
    label: "Open Silence Detection",
    description: "Detect, jump, split, remove silence.",
    target: "silence",
  },
  {
    id: "qa-projects",
    label: "Manage projects",
    description:
      "Create, open, duplicate, rename, delete, favourite, search and reopen recent projects.",
    target: "library",
  },
];

const DEFAULT_COMMANDS: AudioProductivityCommand[] = [
  {
    id: "cmd-open-player",
    label: "Open Audio Player",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 1",
    keywords: ["player", "play", "audio", "mp3", "wav", "AudioPilot"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-trimmer",
    label: "Open Audio Trimmer",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 2",
    keywords: ["trimmer", "trim", "cut", "audio", "AudioPilot"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-converter",
    label: "Open Audio Converter",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 3",
    keywords: ["converter", "convert", "mp3", "wav", "ogg", "flac", "aac"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-recorder",
    label: "Open Recorder",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 4",
    keywords: ["recorder", "record", "microphone", "mic", "audio"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-merger",
    label: "Open Audio Merger",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 5",
    keywords: ["merger", "merge", "combine", "mixdown", "audio"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-splitter",
    label: "Open Audio Splitter",
    category: "Tools",
    shortcut: "Ctrl/Cmd + 6",
    keywords: ["splitter", "split", "silence", "markers", "segments"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-waveform",
    label: "Open Waveform Editor",
    category: "Tools",
    keywords: ["waveform", "zoom", "selection", "marker", "cursor"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-effects",
    label: "Open Audio Effects",
    category: "Tools",
    keywords: ["effects", "fade", "normalize", "reverse", "speed", "pitch"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-silence",
    label: "Open Silence Detection",
    category: "Tools",
    keywords: ["silence", "detect", "split", "remove"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-export-center",
    label: "Open Export Center",
    category: "Tools",
    keywords: ["export", "queue", "bitrate", "sample rate", "channels"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-library",
    label: "Open Audio Library",
    category: "Tools",
    keywords: ["library", "files", "favourites", "search", "sort"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-batch",
    label: "Open Batch Processing",
    category: "Tools",
    keywords: ["batch", "queue", "convert", "rename", "metadata"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-open-metadata",
    label: "Open Metadata Editor",
    category: "Tools",
    keywords: ["metadata", "tags", "id3", "cover art", "title"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-manage-projects",
    label: "Manage projects",
    category: "Workspace",
    keywords: [
      "project",
      "manage",
      "create",
      "open",
      "duplicate",
      "rename",
      "delete",
      "favourite",
      "search",
      "recent",
    ],
    lastInvokedAt: "",
  },
  {
    id: "cmd-toggle-palette",
    label: "Toggle Command Palette",
    category: "Workspace",
    shortcut: "Ctrl/Cmd + Shift + P",
    keywords: ["palette", "command", "search"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-toggle-autosave",
    label: "Toggle Autosave",
    category: "Workspace",
    keywords: ["autosave", "save", "settings"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-toggle-word-wrap",
    label: "Toggle Word Wrap",
    category: "Workspace",
    keywords: ["word wrap", "wrap", "settings"],
    lastInvokedAt: "",
  },
  {
    id: "cmd-toggle-minimap",
    label: "Toggle Minimap",
    category: "Workspace",
    keywords: ["minimap", "settings"],
    lastInvokedAt: "",
  },
];

export function AudioProductivitySurface({
  session,
  onChange,
}: AudioProductivitySurfaceProps) {
  const body = asProductivityBody(session.body);
  const { toast } = useToast();

  const [paletteOpen, setPaletteOpen] = useState(body.paletteOpen);
  const [paletteQuery, setPaletteQuery] = useState(body.paletteQuery);

  const commit = useCallback(
    (next: typeof body) => onChange({ ...session, body: next }),
    [onChange, session]
  );

  const updateField = useCallback(
    <K extends keyof typeof body>(field: K, value: (typeof body)[K]) => {
      commit({ ...body, [field]: value });
    },
    [body, commit]
  );

  const commands = useMemo<AudioProductivityCommand[]>(() => {
    if (body.quickActions.length > 0) {
      // quickActions doubles as our command store when commands
      // are pinned to it; otherwise fall back to the default list.
    }
    return DEFAULT_COMMANDS;
  }, [body.quickActions.length]);

  const filtered = useMemo(
    () => fuzzyMatchCommands(commands, paletteQuery),
    [commands, paletteQuery]
  );

  const quickActions = useMemo<AudioProductivityQuickAction[]>(
    () => (body.quickActions.length > 0 ? body.quickActions : DEFAULT_QUICK_ACTIONS),
    [body.quickActions]
  );

  /** Toggle the command palette. */
  const togglePalette = useCallback(() => {
    const next = !paletteOpen;
    setPaletteOpen(next);
    commit({ ...body, paletteOpen: next, paletteQuery: "" });
    setPaletteQuery("");
  }, [body, commit, paletteOpen]);

  /** Run a command. */
  const runCommand = useCallback(
    (command: AudioProductivityCommand) => {
      const target = command.id.replace(/^cmd-open-/, "");
      const entry = allSessions.find(
        (sess) => sess.slug === target || sess.kind === target
      );
      if (entry) {
        window.location.href = sessionHref(entry);
        return;
      }
      toast({
        message: `${command.label} — no surface registered`,
        tone: "info",
      });
    },
    [toast]
  );

  /** Global keyboard shortcut: Ctrl/Cmd + Shift + P. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePalette();
        return;
      }
      if (event.key === "Escape" && paletteOpen) {
        event.preventDefault();
        setPaletteOpen(false);
        commit({ ...body, paletteOpen: false });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [body, commit, paletteOpen, togglePalette]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Sparkles
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              Workspace Productivity
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Command Palette · {allSessions.length - 1} tools ·
              {body.recent.length} recent sessions
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={togglePalette}
            >
              <Command className="h-3.5 w-3.5" aria-hidden="true" />
              {paletteOpen ? "Close palette" : "Open palette"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => updateField("isFavorite", !body.isFavorite)}
              aria-label={body.isFavorite ? "Unfavourite" : "Favourite"}
            >
              <Star
                className={
                  body.isFavorite
                    ? "h-3.5 w-3.5 fill-primary text-primary"
                    : "h-3.5 w-3.5"
                }
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      </Card>

      {paletteOpen && (
        <Card className="p-4">
          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={paletteQuery}
              onChange={(event) => {
                setPaletteQuery(event.target.value);
                commit({ ...body, paletteQuery: event.target.value });
              }}
              placeholder="Type a command…"
              className="h-9 pl-7 text-sm"
              aria-label="Command palette query"
            />
          </div>
          <ul className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-[11px] text-muted-foreground">
                No matches. Try “player”, “trimmer”, “convert”, “recorder”.
              </li>
            ) : (
              filtered.slice(0, 12).map((command) => (
                <li key={command.id}>
                  <button
                    type="button"
                    onClick={() => runCommand(command)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <Command
                      className="h-3 w-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{command.label}</span>
                    {command.shortcut && (
                      <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                        {command.shortcut}
                      </kbd>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {command.category}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Quick actions</h3>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.slice(0, 12).map((action) => {
            const entry = allSessions.find(
              (sess) => sess.slug === action.target || sess.kind === action.target
            );
            if (!entry) return null;
            return (
              <li key={action.id}>
                <a
                  href={sessionHref(entry)}
                  className="block rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
                >
                  <p className="font-medium">{action.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {action.description}
                  </p>
                  {action.shortcut && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {action.shortcut}
                    </p>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Keyboard
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          Keyboard shortcuts
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            ["Ctrl/Cmd + S", "Save the active session"],
            ["Ctrl/Cmd + W", "Close the active tab"],
            ["Ctrl/Cmd + D", "Duplicate the active session"],
            ["Ctrl/Cmd + B", "Toggle favourite on the active session"],
            ["Ctrl/Cmd + Shift + P", "Toggle the Command Palette"],
            ["Space", "Play / pause in the Player / Recorder"],
            ["←/→", "Seek by 5 seconds in the Player / Recorder"],
            ["?", "Open this dialog"],
            ["Esc", "Close a dialog or cancel a rename"],
          ].map(([keys, description]) => (
            <li
              key={keys}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-1.5 text-xs"
            >
              <span className="text-muted-foreground">{description}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <HistoryIcon
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          Recent sessions
        </h3>
        {body.recent.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No recent sessions yet. Open a tool to populate the list.
          </p>
        ) : (
          <ul className="space-y-1">
            {body.recent.slice(0, 8).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <span className="flex-1 truncate">{entry.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {entry.kind}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(entry.openedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Settings2
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          Workspace settings
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Autosave"
            description="Persist the active session every 1.5s."
            value={body.autosaveEnabled}
            onChange={(v) => updateField("autosaveEnabled", v)}
          />
          <ToggleRow
            label="Word wrap"
            description="Wrap long lines in the editors."
            value={body.wordWrap}
            onChange={(v) => updateField("wordWrap", v)}
          />
          <ToggleRow
            label="Minimap"
            description="Show the editor minimap."
            value={body.minimap}
            onChange={(v) => updateField("minimap", v)}
          />
          <ToggleRow
            label="Find shortcut"
            description="Open the in-editor find bar on Ctrl/Cmd + F."
            value={body.findShortcut}
            onChange={(v) => updateField("findShortcut", v)}
          />
          <label className="block text-[11px] font-medium text-muted-foreground">
            Autosave interval (ms)
            <Input
              type="number"
              min={250}
              max={60_000}
              step={250}
              value={body.autosaveIntervalMs.toString()}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  updateField(
                    "autosaveIntervalMs",
                    Math.max(250, Math.min(60_000, Math.floor(next)))
                  );
                }
              }}
              className="mt-1 h-8 text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium text-muted-foreground">
            Indent width
            <Input
              type="number"
              min={0}
              max={8}
              step={1}
              value={body.indent.toString()}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  updateField("indent", Math.max(0, Math.min(8, next)));
                }
              }}
              className="mt-1 h-8 text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium text-muted-foreground">
            Theme
            <select
              value={body.theme}
              onChange={(event) =>
                updateField("theme", event.target.value as typeof body.theme)
              }
              className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          <ArrowRight
            className="mr-1 inline h-3 w-3"
            aria-hidden="true"
          />
          Settings persist through the autosave loop so the workspace
          looks the same on the next visit.
        </p>
      </Card>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
