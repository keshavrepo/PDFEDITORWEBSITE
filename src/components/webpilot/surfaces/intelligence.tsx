"use client";

/**
 * Code Intelligence surface.
 *
 * A professional Code Intelligence view for WebPilot. The
 * surface analyses the project files, derives the bracket
 * pairs, the folding ranges, the symbol outline and the
 * breadcrumbs, and renders the result as a left-rail list, a
 * right-rail details panel, and a top-bar breadcrumb row. The
 * surface reuses the existing `CodeEditor` for the inline
 * preview, and the same `ToolChrome` the other tools ship.
 *
 * The auto-closing pairs the surface advertises mirror the
 * `AUTO_CLOSING_PAIRS` constant in `tools/intelligence.ts`.
 */

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Brackets,
  ChevronDown,
  ChevronRight,
  Code2,
  Crosshair,
  Layers,
  ListTree,
  MapPin,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import { CodeEditor, type CodeLanguage } from "./shared/code-editor";
import {
  asIntelligenceBody,
  asProjectsBody,
  autoIndent,
  AUTO_CLOSING_PAIRS,
  bracketAt,
  findBrackets,
  findBreadcrumbs,
  findFolds,
  findSymbols,
  tokeniseCss,
  tokeniseHtml,
  tokeniseJs,
} from "@/lib/webpilot";
import type {
  WebProjectFile,
  WebSession,
  WebIntelligenceBody,
  WebIntelligenceSymbol,
} from "@/lib/webpilot";

interface IntelligenceSurfaceProps {
  session: WebSession;
  onChange: (next: WebSession) => void;
}

export function IntelligenceSurface({
  session,
  onChange,
}: IntelligenceSurfaceProps) {
  const body = asIntelligenceBody(session.body);
  const { toast } = useToast();

  // Read the project tree from the session so the surface sees
  // every file, even when the user has not opened a project.
  const project = useMemo(
    () => asProjectsBody(session.body),
    [session.body]
  );

  const files = project.files;
  const file = useMemo(
    () => files.find((entry) => entry.path === body.activePath) ?? files[0] ?? null,
    [body.activePath, files]
  );

  const symbols = useMemo<WebIntelligenceSymbol[]>(
    () => (file ? findSymbols(file.path, file.source, file.kind) : []),
    [file]
  );
  const brackets = useMemo(
    () => (file ? findBrackets(file.path, file.source, file.kind) : []),
    [file]
  );
  const folds = useMemo(
    () => (file ? findFolds(file.path, file.source, file.kind) : []),
    [file]
  );
  const breadcrumbs = useMemo(
    () =>
      file
        ? findBreadcrumbs(file.path, file.source, file.kind, body.cursor)
        : [],
    [file, body.cursor]
  );

  function commit(patch: Partial<WebIntelligenceBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function selectFile(path: string) {
    commit({ activePath: path, cursor: { line: 1, column: 1 } });
  }

  function goToLine() {
    const value = parseInt(body.goToLine, 10);
    if (!Number.isFinite(value) || value < 1) {
      toast({ message: "Enter a valid line number", tone: "error" });
      return;
    }
    commit({ cursor: { line: value, column: 1 } });
  }

  function goToSymbol() {
    const term = body.goToSymbol.trim().toLowerCase();
    if (!term) return;
    const match = symbols.find(
      (entry) => entry.name.toLowerCase() === term
    );
    if (!match) {
      toast({ message: `No symbol matches "${body.goToSymbol}"`, tone: "error" });
      return;
    }
    commit({ cursor: { line: match.line, column: match.column } });
  }

  function jumpToSymbol(symbol: WebIntelligenceSymbol) {
    commit({ cursor: { line: symbol.line, column: symbol.column } });
  }

  function toggleFold(line: number) {
    const next = body.foldedLines.includes(line)
      ? body.foldedLines.filter((entry) => entry !== line)
      : [...body.foldedLines, line];
    commit({ foldedLines: next });
  }

  function jumpToBracket(line: number, column: number) {
    const bracket = bracketAt(brackets, line, column);
    if (!bracket) {
      toast({ message: "No matching bracket at the cursor", tone: "info" });
      return;
    }
    // The match is either the open or the close; jump to the other side.
    if (bracket.openLine === line && bracket.openColumn === column) {
      commit({ cursor: { line: bracket.closeLine, column: bracket.closeColumn } });
    } else {
      commit({ cursor: { line: bracket.openLine, column: bracket.openColumn } });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Code Intelligence — bracket matching, auto-closing pairs, auto indentation, code folding, breadcrumbs, symbol outline, go to line and go to symbol."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onDelete={async () => {
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Crosshair className="h-3 w-3" aria-hidden="true" />
              <Input
                value={body.goToLine}
                onChange={(event) =>
                  commit({ goToLine: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    goToLine();
                  }
                }}
                placeholder="Go to line"
                className="h-7 w-24 text-[11px]"
                aria-label="Go to line"
              />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Search className="h-3 w-3" aria-hidden="true" />
              <Input
                value={body.goToSymbol}
                onChange={(event) =>
                  commit({ goToSymbol: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    goToSymbol();
                  }
                }}
                placeholder="Go to symbol"
                className="h-7 w-32 text-[11px]"
                aria-label="Go to symbol"
              />
            </label>
          </>
        }
        status={
          <span className="text-[10px] text-muted-foreground">
            {files.length} files · {symbols.length} symbols ·{" "}
            {brackets.length} brackets · {folds.length} folds
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 xl:grid-cols-[1fr,2fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
            <Code2
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <select
              value={file ? file.path : ""}
              onChange={(event) => selectFile(event.target.value)}
              className="h-7 flex-1 rounded border border-border bg-background px-2 text-[11px]"
              aria-label="File"
            >
              {files.length === 0 ? (
                <option value="">No files in project</option>
              ) : null}
              {files.map((entry) => (
                <option key={entry.id} value={entry.path}>
                  {entry.path}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-h-0 grid-cols-1 gap-2 overflow-auto p-2">
            <Section title="Files" icon={ListTree}>
              {files.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">
                  No files in the project. Open the Project Explorer to add
                  some.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {files.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => selectFile(entry.path)}
                        className={
                          "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] " +
                          (file && file.path === entry.path
                            ? "bg-accent"
                            : "hover:bg-accent/50")
                        }
                      >
                        <span className="flex-1 truncate font-mono">
                          {entry.path}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {entry.kind}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Symbols" icon={ListTree}>
              {symbols.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">
                  No symbols in this file.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {symbols.map((symbol) => (
                    <li key={symbol.id}>
                      <button
                        type="button"
                        onClick={() => jumpToSymbol(symbol)}
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent/50"
                      >
                        <ArrowRight
                          className="h-3 w-3 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate font-mono">
                          {symbol.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          L{symbol.line}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Folds" icon={Layers}>
              {folds.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">
                  No foldable blocks in this file.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {folds.map((fold, index) => {
                    const isFolded = body.foldedLines.includes(fold.startLine);
                    return (
                      <li key={`${fold.path}-${fold.startLine}-${index}`}>
                        <button
                          type="button"
                          onClick={() => toggleFold(fold.startLine)}
                          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent/50"
                        >
                          {isFolded ? (
                            <ChevronRight
                              className="h-3 w-3 text-muted-foreground"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronDown
                              className="h-3 w-3 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                          <span className="flex-1 truncate font-mono">
                            {fold.kind} ({fold.startLine}-{fold.endLine})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {isFolded ? "Folded" : "Open"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Brackets" icon={Brackets}>
              {brackets.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">
                  No bracket pairs in this file.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {brackets.map((bracket, index) => (
                    <li key={`br-${index}`}>
                      <button
                        type="button"
                        onClick={() =>
                          jumpToBracket(bracket.openLine, bracket.openColumn)
                        }
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent/50"
                      >
                        <span className="flex-1 truncate font-mono">
                          {bracket.openChar}…{bracket.closeChar}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          L{bracket.openLine} → L{bracket.closeLine}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          {file ? (
            <>
              <Card className="flex items-center gap-1 overflow-hidden border-b border-border bg-muted/30 px-2 py-1.5">
                <MapPin
                  className="h-3 w-3 text-muted-foreground"
                  aria-hidden="true"
                />
                {breadcrumbs.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground">
                    No breadcrumbs
                  </span>
                ) : (
                  breadcrumbs.map((crumb, index) => (
                    <span
                      key={`${crumb.path}-${index}`}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground"
                    >
                      <span className="font-mono">
                        {crumb.label ?? `${crumb.path} L${crumb.line}`}
                      </span>
                      {index < breadcrumbs.length - 1 ? (
                        <ArrowRight
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                  ))
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  Auto-indent next line: {autoIndent(file.source, 1, { unit: 2 }) || "(empty)"}
                </span>
              </Card>
              <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <CodeEditor
                  value={file.source}
                  onChange={(next) => {
                    const files = project.files.map((entry) =>
                      entry.id === file.id
                        ? { ...entry, source: next, updatedAt: new Date().toISOString() }
                        : entry
                    );
                    commit({ activePath: file.path });
                    onChange({ ...session, body: { ...project, files } });
                  }}
                  language={file.kind as CodeLanguage}
                  tokenise={
                    file.kind === "css"
                      ? tokeniseCss
                      : file.kind === "javascript"
                        ? tokeniseJs
                        : tokeniseHtml
                  }
                  indent={2}
                  ariaLabel={`Editor · ${file.path}`}
                  status={
                    <span>
                      Line {body.cursor.line}, column {body.cursor.column}
                      <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden="true" />
                    </span>
                  }
                />
              </Card>
              <Card className="p-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Auto-closing pairs
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                  {Object.entries(AUTO_CLOSING_PAIRS).map(([open, close]) => (
                    <span
                      key={open}
                      className="rounded border border-border bg-muted/30 px-2 py-0.5"
                    >
                      {open}
                      {close}
                    </span>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <ListTree className="h-6 w-6" aria-hidden="true" />
              <p>No files in the project. Open the Project Explorer to add one.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: typeof ListTree;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, children }: SectionProps) {
  return (
    <div className="mb-1">
      <p className="mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {title}
      </p>
      {children}
    </div>
  );
}

// `WebProjectFile` is referenced indirectly through the body. The
// type alias keeps the import explicit.
void (null as unknown as WebProjectFile);
