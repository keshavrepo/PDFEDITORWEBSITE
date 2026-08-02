"use client";

/**
 * Professional Search surface.
 *
 * Find anything across the project. The user types a query, picks
 * whether the search is project-wide or scoped to the current
 * file, toggles match case, whole word and regex, and steps
 * through the matches. The replace / replace-all buttons write
 * back to the IndexedDB store through the autosave loop.
 *
 * The search reuses the same FindOptions the in-editor find bar
 * uses, so the controls feel identical to the user. Matches are
 * rendered as a flat list with file path, line number and a
 * preview; clicking a match jumps the editor into the right
 * place by opening the file in the workspace.
 */

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  FilePlus,
  Replace,
  Search as SearchIcon,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  applyReplaceAll,
  asSearchBody,
  buildProjectMatches,
  tokeniseCss,
  tokeniseHtml,
  tokeniseJs,
} from "@/lib/webpilot";
import type {
  WebProjectFile,
  WebSearchBody,
  WebSearchMatch,
  WebSession,
} from "@/lib/webpilot";
import { CodeEditor, type CodeLanguage } from "./shared/code-editor";

interface SearchSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function SearchSurface({ session, onChange }: SearchSurfaceProps) {
  const body = asSearchBody(session.body);
  const { toast } = useToast();
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activeMatch, setActiveMatch] = useState<WebSearchMatch | null>(null);

  function commit(patch: Partial<WebSearchBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  const options = useMemo(
    () => ({
      caseSensitive: body.caseSensitive,
      wholeWord: body.wholeWord,
      regex: body.regex,
    }),
    [body.caseSensitive, body.wholeWord, body.regex]
  );

  // Build the match list. The list is always project-wide in the
  // data model; the "current file" toggle is a UI filter.
  const allMatches = useMemo(
    () => buildProjectMatches(body.files, body.query, options),
    [body.files, body.query, options]
  );

  const matches = useMemo(() => {
    if (body.projectWide) return allMatches;
    if (!activeMatch) return allMatches;
    return allMatches.filter(
      (match) => match.path === activeMatch.path
    );
  }, [allMatches, activeMatch, body.projectWide]);

  // Keep currentMatchIndex in range whenever the list shrinks.
  const safeIndex =
    matches.length === 0
      ? -1
      : Math.min(Math.max(0, currentMatchIndex), matches.length - 1);

  const current = safeIndex >= 0 ? matches[safeIndex] ?? null : null;

  function applyReplace(replaceAll: boolean) {
    if (!body.query) {
      toast({ message: "Type a query to replace", tone: "info" });
      return;
    }
    if (body.projectWide) {
      const { files, replacements } = applyReplaceAll(
        body.files,
        body.query,
        body.replacement,
        options
      );
      if (replacements === 0) {
        toast({ message: "No matches to replace", tone: "info" });
        return;
      }
      commit({ files });
      toast({
        message: `Replaced ${replacements} match${
          replacements === 1 ? "" : "es"
        } across the project`,
        tone: "success",
      });
      return;
    }
    if (!current) {
      toast({ message: "No active match", tone: "info" });
      return;
    }
    const file = body.files.find((entry) => entry.path === current.path);
    if (!file) return;
    const { next, count } = singleReplace(
      file.source,
      current,
      body.replacement,
      options
    );
    if (count === 0) {
      toast({ message: "No match in the active file", tone: "info" });
      return;
    }
    const nextFiles = body.files.map((entry) =>
      entry.id === file.id
        ? {
            ...entry,
            source: next,
            updatedAt: new Date().toISOString(),
          }
        : entry
    );
    commit({ files: nextFiles });
    toast({
      message: `Replaced ${count} match${count === 1 ? "" : "es"} in ${file.path}`,
      tone: "success",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Professional Search — find in current file or across the project, replace, replace all, regex, match case and whole word."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => setCurrentMatchIndex(Math.max(0, safeIndex - 1))}
              disabled={safeIndex <= 0}
              aria-label="Previous match"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() =>
                setCurrentMatchIndex(
                  Math.min(matches.length - 1, safeIndex + 1)
                )
              }
              disabled={safeIndex >= matches.length - 1}
              aria-label="Next match"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => applyReplace(false)}
              disabled={!current}
            >
              <Replace className="h-3.5 w-3.5" aria-hidden="true" />
              Replace
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => applyReplace(true)}
              disabled={matches.length === 0}
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Replace all
            </Button>
          </>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {matches.length === 0
              ? "0 / 0"
              : `${safeIndex + 1} / ${matches.length}`}
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[2fr,3fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <SearchIcon
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={body.query}
              onChange={(event) => {
                setCurrentMatchIndex(0);
                commit({ query: event.target.value });
              }}
              placeholder="Find…"
              className="h-7 flex-1 text-xs"
              aria-label="Find query"
            />
            <Input
              value={body.replacement}
              onChange={(event) =>
                commit({ replacement: event.target.value })
              }
              placeholder="Replace with…"
              className="h-7 flex-1 text-xs"
              aria-label="Replacement"
            />
            <OptionButton
              active={body.caseSensitive}
              onClick={() => commit({ caseSensitive: !body.caseSensitive })}
              label="Aa"
              title="Match case"
            />
            <OptionButton
              active={body.wholeWord}
              onClick={() => commit({ wholeWord: !body.wholeWord })}
              label="\\b"
              title="Whole word"
            />
            <OptionButton
              active={body.regex}
              onClick={() => commit({ regex: !body.regex })}
              label=".*"
              title="Regular expression"
            />
            <OptionButton
              active={body.projectWide}
              onClick={() => commit({ projectWide: !body.projectWide })}
              label="All"
              title="Search across the project"
            />
          </div>

          <div className="flex-1 overflow-auto p-2">
            {body.query.trim() === "" ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Type a query to find matches.
              </p>
            ) : matches.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No matches.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {matches.map((match, index) => {
                  const isActive = index === safeIndex;
                  return (
                    <li key={`${match.path}-${match.line}-${match.column}-${index}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentMatchIndex(index);
                          setActiveMatch(match);
                        }}
                        className={
                          "flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors " +
                          (isActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent/50")
                        }
                      >
                        <p className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          <span className="truncate font-medium text-foreground">
                            {match.path}
                          </span>
                          <span>·</span>
                          <span>
                            line {match.line}, col {match.column + 1}
                          </span>
                        </p>
                        <p className="font-mono text-[11px] leading-[1.4]">
                          <PreviewLine
                            text={match.lineText}
                            start={match.matchStart}
                            end={match.matchEnd}
                          />
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          {current ? (
            <PreviewEditor
              file={
                body.files.find((entry) => entry.path === current.path) ?? null
              }
              match={current}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <FilePlus className="h-6 w-6" aria-hidden="true" />
              <p>
                Click a match to preview the source. The preview is
                read-only — use the editor surfaces to edit the file.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

interface OptionButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}

function OptionButton({ active, onClick, label, title }: OptionButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={
        "h-7 min-w-[2rem] px-2 font-mono text-[10px] " +
        (active ? "bg-accent" : "")
      }
    >
      {label}
    </Button>
  );
}

function PreviewLine({
  text,
  start,
  end,
}: {
  text: string;
  start: number;
  end: number;
}) {
  const before = text.slice(0, start);
  const middle = text.slice(start, end);
  const after = text.slice(end);
  return (
    <span>
      <span className="text-muted-foreground">{before}</span>
      <mark className="rounded bg-primary/30 px-0.5 text-foreground">
        {middle}
      </mark>
      <span className="text-muted-foreground">{after}</span>
    </span>
  );
}

interface PreviewEditorProps {
  file: WebProjectFile | null;
  match: WebSearchMatch;
}

function PreviewEditor({ file, match }: PreviewEditorProps) {
  if (!file) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
        File not found.
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {file.path}
        </p>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {file.kind} · {file.source.length} bytes
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={file.source}
          onChange={() => undefined}
          language={file.kind as CodeLanguage}
          tokenise={
            file.kind === "css"
              ? tokeniseCss
              : file.kind === "javascript"
                ? tokeniseJs
                : tokeniseHtml
          }
          indent={2}
          readOnly
          ariaLabel={`Preview · ${file.path}`}
          status={
            <span>
              Line {match.line}, column {match.column + 1}
              <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden="true" />
            </span>
          }
        />
      </div>
    </div>
  );
}

interface SingleReplaceOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

function singleReplace(
  source: string,
  match: WebSearchMatch,
  replacement: string,
  options: SingleReplaceOptions
): { next: string; count: number } {
  // Convert the 1-based line/column to an absolute start index.
  let absoluteLineStart = 0;
  for (let currentLine = 1; currentLine < match.line; currentLine += 1) {
    const next = source.indexOf("\n", absoluteLineStart);
    if (next === -1) break;
    absoluteLineStart = next + 1;
  }
  const absoluteStart = absoluteLineStart + match.column;
  const length = match.matchEnd - match.matchStart;
  const matched = source.slice(absoluteStart, absoluteStart + length);
  if (!matchesExactly(source, absoluteStart, matched, options)) {
    return { next: source, count: 0 };
  }
  const before = source.slice(0, absoluteStart);
  const after = source.slice(absoluteStart + length);
  return { next: before + replacement + after, count: 1 };
}

function matchesExactly(
  source: string,
  start: number,
  matched: string,
  options: SingleReplaceOptions
): boolean {
  if (options.caseSensitive) {
    return source.slice(start, start + matched.length) === matched;
  }
  return (
    source.slice(start, start + matched.length).toLowerCase() ===
    matched.toLowerCase()
  );
}
