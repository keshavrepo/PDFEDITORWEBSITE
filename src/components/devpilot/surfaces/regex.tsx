"use client";

/**
 * Regex lab surface.
 *
 * Live regex testing with match highlights, capture groups, a
 * replace preview and a common-patterns library. All work runs in
 * the browser; nothing is uploaded.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asRegexBody,
  copyToClipboard,
  deleteDevSession,
  REGEX_PRESETS,
  testRegex,
  type RegexMatch,
  type RegexPreset,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface RegexSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const FLAG_LABELS: Array<{ key: string; label: string; description: string }> = [
  { key: "g", label: "g", description: "Global" },
  { key: "i", label: "i", description: "Case-insensitive" },
  { key: "m", label: "m", description: "Multiline" },
  { key: "s", label: "s", description: "Dot matches newline" },
  { key: "u", label: "u", description: "Unicode" },
  { key: "y", label: "y", description: "Sticky" },
];

export function RegexSurface({ session, onChange }: RegexSurfaceProps) {
  const body = asRegexBody(session.body);
  const { toast } = useToast();

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const result = testRegex(body.pattern, body.flags, body.input, body.replacement);

  function toggleFlag(flag: string) {
    const flags = body.flags.split("");
    const index = flags.indexOf(flag);
    if (index === -1) flags.push(flag);
    else flags.splice(index, 1);
    commit({ flags: flags.join("") });
  }

  function applyPreset(preset: RegexPreset) {
    commit({
      pattern: preset.pattern,
      flags: preset.flags,
      input: preset.sample,
      presetId: preset.id,
      replacement: "",
    });
    toast({ message: `Loaded preset · ${preset.name}`, tone: "success" });
  }

  async function copyMatches() {
    if (!result.ok || result.matches.length === 0) {
      toast({ message: "Nothing to copy", tone: "info" });
      return;
    }
    const text = result.matches.map((match) => match.match).join("\n");
    const ok = await copyToClipboard(text);
    toast({ message: ok ? "Matches copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  async function copyReplaced() {
    if (result.replaced === null) {
      toast({ message: "Nothing to copy", tone: "info" });
      return;
    }
    const ok = await copyToClipboard(result.replaced);
    toast({ message: ok ? "Replaced text copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Live regex testing with matches, groups, replace preview and common patterns."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={body.view === "test" ? copyMatches : copyReplaced}
        copyLabel={body.view === "test" ? "Copy matches" : "Copy replaced"}
        copyDisabled={body.view === "test" ? result.matches.length === 0 : result.replaced === null}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <div className="inline-flex overflow-hidden rounded-lg border border-border text-[10px]">
            <button
              type="button"
              onClick={() => commit({ view: "test" })}
              className={
                body.view === "test"
                  ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                  : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
              }
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Test
            </button>
            <button
              type="button"
              onClick={() => commit({ view: "replace" })}
              className={
                body.view === "replace"
                  ? "inline-flex items-center gap-1 bg-accent px-2 py-1 font-medium"
                  : "inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:bg-accent"
              }
            >
              <Wand2 className="h-3 w-3" aria-hidden="true" />
              Replace
            </button>
          </div>
        }
        status={
          result.ok ? (
            <span className="inline-flex items-center gap-2 text-primary">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium">
                /{result.ok ? "/" : ""}{body.pattern || "(empty)"}/{body.flags}
              </span>
              <span>
                {result.matches.length} match{result.matches.length === 1 ? "" : "es"}
              </span>
            </span>
          ) : (
            <span className="text-destructive">{result.error ?? "Invalid pattern"}</span>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
            <Input
              value={body.pattern}
              onChange={(event) => commit({ pattern: event.target.value, presetId: "" })}
              placeholder="Pattern (e.g. \\b\\w+@\\w+\\b)"
              className="h-8 font-mono text-xs"
              spellCheck={false}
            />
            <Input
              value={body.flags}
              onChange={(event) => commit({ flags: event.target.value.replace(/[^gimsuy]/g, "") })}
              placeholder="flags"
              className="h-8 w-24 font-mono text-xs"
              aria-label="Flags"
              spellCheck={false}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {FLAG_LABELS.map((flag) => {
              const active = body.flags.includes(flag.key);
              return (
                <button
                  key={flag.key}
                  type="button"
                  onClick={() => toggleFlag(flag.key)}
                  className={
                    active
                      ? "rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                      : "rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                  }
                  title={flag.description}
                >
                  {flag.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Common patterns</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {REGEX_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={
                  body.presetId === preset.id
                    ? "rounded-md border border-primary bg-primary/5 p-2 text-left text-[11px]"
                    : "rounded-md border border-border p-2 text-left text-[11px] hover:bg-accent"
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{preset.name}</span>
                  <code className="text-[10px] text-muted-foreground">
                    /{preset.pattern}/{preset.flags}
                  </code>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{preset.description}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Test input</h3>
          <textarea
            value={body.input}
            onChange={(event) => commit({ input: event.target.value })}
            placeholder="Paste text to test…"
            className="min-h-[120px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </Card>

        {body.view === "test" ? (
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Match results</h3>
              <span className="text-[10px] text-muted-foreground">
                {result.matches.length} match{result.matches.length === 1 ? "" : "es"}
              </span>
            </div>
            {result.matches.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No matches yet. Type a pattern and some text above.
              </p>
            ) : (
              <ul className="space-y-2">
                {result.matches.slice(0, 50).map((match) => (
                  <li
                    key={`${match.index}-${match.start}`}
                    className="rounded-md border border-border bg-background p-2 text-[11px]"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">
                        #{match.index + 1} · chars {match.start}–{match.end}
                      </span>
                      <code className="truncate font-mono">{match.match}</code>
                    </div>
                    {match.groups.length > 0 && (
                      <ul className="space-y-0.5 font-mono">
                        {match.groups.map((group, index) => (
                          <li key={`${match.index}-${index}`} className="truncate text-muted-foreground">
                            <span className="text-foreground">${index + 1}</span> · {group.value}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card className="p-3">
            <h3 className="mb-2 text-xs font-semibold">Replace</h3>
            <Input
              value={body.replacement}
              onChange={(event) => commit({ replacement: event.target.value })}
              placeholder="Replacement (use $1, $2… for capture groups)"
              className="mb-2 h-8 font-mono text-xs"
              spellCheck={false}
            />
            <p className="mb-2 text-[10px] text-muted-foreground">
              Leave the replacement empty to preview the matches highlighted with brackets.
            </p>
            {result.replaced !== null ? (
              <pre className="max-h-[260px] overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
                {result.replaced}
              </pre>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No replace preview available.
              </p>
            )}
          </Card>
        )}

        <Card className="p-3">
          <h3 className="mb-2 text-xs font-semibold">Highlighted input</h3>
          <HighlightedInput
            text={body.input}
            matches={result.ok ? result.matches : []}
          />
        </Card>
      </div>
    </div>
  );
}

interface HighlightedInputProps {
  text: string;
  matches: RegexMatch[];
}

function HighlightedInput({ text, matches }: HighlightedInputProps) {
  if (matches.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background p-2 font-mono text-[11px] text-muted-foreground">
        {text || "(empty)"}
      </p>
    );
  }
  const segments: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) {
      segments.push({ text: text.slice(cursor, match.start), highlight: false });
    }
    segments.push({ text: text.slice(match.start, match.end), highlight: true });
    cursor = match.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: false });
  }
  return (
    <pre className="rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
      {segments.map((segment, index) =>
        segment.highlight ? (
          <mark
            key={index}
            className="rounded bg-primary/20 px-0.5 text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </pre>
  );
}
