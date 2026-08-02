"use client";

/**
 * CodeEditor — the shared WebPilot code editor.
 *
 * Renders a syntax-highlighted code editor with line numbers,
 * auto-indentation, find / replace, undo / redo, word wrap, and
 * a tab-to-indent shortcut. The component is intentionally built
 * on top of a `<textarea>` for accessibility, mobile keyboards
 * and screen readers; a sibling `<pre>` shows the highlight
 * overlay.
 *
 * Every WebPilot tool that edits code reuses this component so the
 * editor experience is identical across HTML, CSS, JavaScript and
 * any future tool.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Redo2,
  Search,
  Undo2,
  WrapText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  computeIndent,
  escapeHtml,
  findAllInText,
  replaceInText,
  tokensToHtml,
  UndoStack,
  type Token,
  type TokenKind,
} from "@/lib/webpilot/tools/code-editor";

export type CodeLanguage = "html" | "css" | "javascript";

const KIND_CLASS: Record<TokenKind, string> = {
  plain: "",
  keyword: "text-purple-600 dark:text-purple-400 font-semibold",
  string: "text-emerald-600 dark:text-emerald-400",
  comment: "italic text-muted-foreground",
  number: "text-blue-600 dark:text-blue-400",
  selector: "text-sky-600 dark:text-sky-400",
  property: "text-amber-600 dark:text-amber-400",
  value: "text-rose-600 dark:text-rose-400",
  function: "text-cyan-600 dark:text-cyan-400",
  operator: "text-foreground",
  punct: "text-muted-foreground",
  regex: "text-emerald-600 dark:text-emerald-400",
  variable: "text-indigo-600 dark:text-indigo-400",
  tag: "text-rose-600 dark:text-rose-400 font-semibold",
};

export interface CodeEditorProps {
  /** The current source. */
  value: string;
  /** Called with the new source whenever the user types or otherwise edits. */
  onChange: (next: string) => void;
  /** Language tokeniser. */
  language: CodeLanguage;
  /** Tokenises the source into highlight runs. */
  tokenise: (source: string) => Token[];
  /** Auto-complete suggestions for the current caret position. */
  suggest?: (source: string, caret: number) => string[];
  /** Optional status row content. */
  status?: ReactNode;
  /** Indent width in spaces. */
  indent: number;
  /** Read-only flag. */
  readOnly?: boolean;
  /** Aria label for the textarea. */
  ariaLabel?: string;
}

interface FindState {
  open: boolean;
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  /**
   * Index of the current match in the derived match list, or -1
   * when no match is active. The actual list of matches is derived
   * from `value` + `findInput` + the boolean flags via `useMemo`,
   * so the editor never needs to call `setState` from an effect.
   */
  current: number;
}

export function CodeEditor({
  value,
  onChange,
  language,
  tokenise,
  suggest,
  status,
  indent,
  readOnly,
  ariaLabel,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLPreElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const undoRef = useRef<UndoStack>(new UndoStack(value));
  const [wordWrap, setWordWrap] = useState(true);
  const [find, setFind] = useState<FindState>({
    open: false,
    replacement: "",
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    current: -1,
  });
  const [findInput, setFindInput] = useState("");
  const [replaceInput, setReplaceInput] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Reset the undo stack when the value changes from outside.
  useEffect(() => {
    undoRef.current.reset(value);
  }, [value]);

  const tokens = useMemo(() => tokenise(value), [tokenise, value]);
  const highlighted = useMemo(() => tokensToHtml(tokens), [tokens]);
  const lineCount = useMemo(
    () => (value.length === 0 ? 1 : value.split("\n").length),
    [value]
  );
  const lineNumbers = useMemo(() => {
    const out: string[] = [];
    for (let i = 1; i <= lineCount; i += 1) out.push(String(i));
    return out.join("\n");
  }, [lineCount]);

  // Derive the full list of matches from the source and the find
  // options. Doing this with `useMemo` instead of `useState` + an
  // effect avoids the cascading-render lint rule and means the
  // matches can never go stale relative to the source.
  const matches = useMemo(() => {
    if (!find.open) return [] as Array<{ start: number; end: number }>;
    if (!findInput) return [];
    return findAllInText(value, findInput, {
      caseSensitive: find.caseSensitive,
      wholeWord: find.wholeWord,
      regex: find.regex,
    });
  }, [find.caseSensitive, find.open, find.regex, find.wholeWord, findInput, value]);

  // Keep the derived `current` index inside the matches range. If
  // the value changes (e.g. the user edits the source while the
  // find bar is open) the index may fall out of range; clamp it.
  const safeCurrent = useMemo(() => {
    if (matches.length === 0) return -1;
    if (find.current < 0) return 0;
    if (find.current >= matches.length) return matches.length - 1;
    return find.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find.current, matches.length]);

  const currentMatch = safeCurrent >= 0 ? matches[safeCurrent] : undefined;

  // Keep the overlay scroll position in sync with the textarea.
  useLayoutEffect(() => {
    if (!textareaRef.current || !overlayRef.current) return;
    overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  });

  const applyChange = useCallback(
    (next: string) => {
      undoRef.current.push(next, value);
      onChange(next);
      setCanUndo(true);
      setCanRedo(false);
    },
    [onChange, value]
  );

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      applyChange(next);
      if (suggest) {
        const caret = event.target.selectionStart ?? next.length;
        const next_suggestions = suggest(next, caret);
        setSuggestions(next_suggestions);
        setSuggestionIndex(0);
      }
    },
    [applyChange, suggest]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const el = event.currentTarget;
      // Tab / Shift-Tab indent and outdent.
      if (event.key === "Tab") {
        event.preventDefault();
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const current = el.value;
        const unit = " ".repeat(Math.max(0, Math.min(8, indent)));
        if (start !== null && end !== null) {
          if (event.shiftKey) {
            // Outdent the current line.
            const lineStart = current.lastIndexOf("\n", start - 1) + 1;
            const head = current.slice(0, lineStart);
            const line = current.slice(lineStart, end);
            const updated = head + line.replace(new RegExp(`^${unit}`), "");
            applyChange(updated);
            requestAnimationFrame(() => {
              el.selectionStart = lineStart;
              el.selectionEnd = lineStart + updated.length - head.length;
            });
            return;
          }
          if (start === end) {
            // Insert one indent unit at the caret.
            const next = current.slice(0, start) + unit + current.slice(end);
            applyChange(next);
            requestAnimationFrame(() => {
              el.selectionStart = el.selectionEnd = start + unit.length;
            });
            return;
          }
          // Multi-line indent: insert the unit at the start of every
          // affected line.
          const lineStart = current.lastIndexOf("\n", start - 1) + 1;
          const head = current.slice(0, lineStart);
          const block = current.slice(lineStart, end);
          const updated =
            head +
            block
              .split("\n")
              .map((line) => unit + line)
              .join("\n");
          applyChange(updated);
          requestAnimationFrame(() => {
            el.selectionStart = start + unit.length;
            el.selectionEnd = end + unit.length * (updated.length - current.length) / unit.length;
          });
          return;
        }
      }
      // Auto-indent on Enter.
      if (event.key === "Enter") {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (start !== null && end !== null && start === end) {
          event.preventDefault();
          const current = el.value;
          const indentText = computeIndent(current, start, { unit: indent });
          const next = current.slice(0, start) + "\n" + indentText + current.slice(end);
          applyChange(next);
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = start + 1 + indentText.length;
          });
          return;
        }
      }
      // Undo / redo.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          const result = undoRef.current.redo(value);
          if (result.previous !== value) {
            onChange(result.previous);
            setCanUndo(result.hasUndo);
            setCanRedo(result.hasRedo);
          }
          return;
        }
        const result = undoRef.current.undo(value);
        if (result.previous !== value) {
          onChange(result.previous);
          setCanUndo(result.hasUndo);
          setCanRedo(result.hasRedo);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        const result = undoRef.current.redo(value);
        if (result.previous !== value) {
          onChange(result.previous);
          setCanUndo(result.hasUndo);
          setCanRedo(result.hasRedo);
        }
        return;
      }
      // Find toggle.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFind((current) => ({ ...current, open: !current.open }));
        return;
      }
      if (event.key === "Escape" && find.open) {
        event.preventDefault();
        setFind((current) => ({ ...current, open: false }));
        return;
      }
    },
    [applyChange, find.open, indent, onChange, value]
  );

  const handleScroll = useCallback(() => {
    if (!textareaRef.current) return;
    if (overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      // Allow the default paste behaviour but normalise line endings.
      // No state mutation here; the synthetic input event will fire.
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
      const el = event.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const current = el.value;
      if (start === null || end === null) return;
      const next = current.slice(0, start) + text + current.slice(end);
      applyChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + text.length;
      });
    },
    [applyChange]
  );

  const handleUndo = useCallback(() => {
    const result = undoRef.current.undo(value);
    if (result.previous !== value) {
      onChange(result.previous);
      setCanUndo(result.hasUndo);
      setCanRedo(result.hasRedo);
    }
  }, [onChange, value]);

  const handleRedo = useCallback(() => {
    const result = undoRef.current.redo(value);
    if (result.previous !== value) {
      onChange(result.previous);
      setCanUndo(result.hasUndo);
      setCanRedo(result.hasRedo);
    }
  }, [onChange, value]);

  const runFind = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) return;
      const anchor = currentMatch;
      const fromAnchor = direction === 1
        ? anchor
          ? anchor.end
          : -1
        : anchor
          ? anchor.start
          : value.length;
      // Find the first match whose start is strictly after the
      // anchor (forward) or strictly before the anchor (backward).
      let nextIndex = -1;
      if (direction === 1) {
        nextIndex = matches.findIndex((match) => match.start > fromAnchor);
        if (nextIndex === -1) nextIndex = 0;
      } else {
        for (let i = matches.length - 1; i >= 0; i -= 1) {
          if (matches[i]!.start < fromAnchor) {
            nextIndex = i;
            break;
          }
        }
        if (nextIndex === -1) nextIndex = matches.length - 1;
      }
      setFind((current) => ({ ...current, current: nextIndex }));
      const match = matches[nextIndex]!;
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(match.start, match.end);
        const lineStart = value.lastIndexOf("\n", match.start) + 1;
        const lineNumber = value.slice(0, lineStart).split("\n").length;
        const lineHeight = 18;
        const top = textareaRef.current.scrollTop;
        const height = textareaRef.current.clientHeight;
        if (top > lineNumber * lineHeight) {
          textareaRef.current.scrollTop = lineNumber * lineHeight;
        } else if (top + height < (lineNumber + 1) * lineHeight) {
          textareaRef.current.scrollTop = (lineNumber + 1) * lineHeight - height;
        }
      }
    },
    [currentMatch, matches, value]
  );

  const replaceOne = useCallback(() => {
    if (!currentMatch) {
      runFind(1);
      return;
    }
    const { next } = replaceInText(value, findInput, find.replacement, {
      caseSensitive: find.caseSensitive,
      wholeWord: find.wholeWord,
      regex: find.regex,
      from: currentMatch.start,
      replaceAll: false,
    });
    applyChange(next);
    requestAnimationFrame(() => runFind(1));
  }, [applyChange, currentMatch, find.caseSensitive, find.regex, find.replacement, find.wholeWord, findInput, runFind, value]);

  const replaceAll = useCallback(() => {
    if (!findInput) return;
    const { next, count } = replaceInText(value, findInput, find.replacement, {
      caseSensitive: find.caseSensitive,
      wholeWord: find.wholeWord,
      regex: find.regex,
      replaceAll: true,
    });
    if (count > 0) {
      applyChange(next);
    }
  }, [applyChange, find.caseSensitive, find.regex, find.replacement, find.wholeWord, findInput, value]);

  const applySuggestion = useCallback(
    (suggestion: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === null || end === null) return;
      // Find the start of the current word.
      let wordStart = start;
      while (wordStart > 0 && /[A-Za-z0-9_$-]/.test(value[wordStart - 1] ?? "")) {
        wordStart -= 1;
      }
      const next = value.slice(0, wordStart) + suggestion + value.slice(end);
      applyChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = wordStart + suggestion.length;
        el.focus();
      });
    },
    [applyChange, value]
  );

  useEffect(() => {
    // When the find bar opens, focus the next/prev buttons so the
    // user can step through matches without reaching for the mouse.
    if (!find.open) return;
    if (matches.length > 0 && textareaRef.current && !currentMatch) {
      const first = matches[0]!;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(first.start, first.end);
    }
  }, [currentMatch, find.open, matches]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Cmd/Ctrl + Z)"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Cmd/Ctrl + Shift + Z)"
        >
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant={find.open ? "default" : "ghost"}
          className="h-7 w-7 p-0"
          onClick={() => setFind((current) => ({ ...current, open: !current.open }))}
          aria-label="Find"
          aria-pressed={find.open}
          title="Find (Cmd/Ctrl + F)"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant={wordWrap ? "default" : "ghost"}
          className="h-7 w-7 p-0"
          onClick={() => setWordWrap((value) => !value)}
          aria-label="Word wrap"
          aria-pressed={wordWrap}
          title="Word wrap"
        >
          <WrapText className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          {status}
        </span>
      </div>

      {find.open && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5 text-[11px]">
          <Input
            value={findInput}
            onChange={(event) => setFindInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runFind(event.shiftKey ? -1 : 1);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setFind((current) => ({ ...current, open: false }));
              }
            }}
            placeholder="Find…"
            className="h-7 w-40 text-[11px]"
            aria-label="Find query"
            autoFocus
          />
          <Input
            value={replaceInput}
            onChange={(event) =>
              setReplaceInput(event.target.value)
            }
            placeholder="Replace with…"
            className="h-7 w-40 text-[11px]"
            aria-label="Replacement"
          />
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 px-2 text-[10px]",
              find.caseSensitive && "bg-accent"
            )}
            onClick={() =>
              setFind((current) => ({
                ...current,
                caseSensitive: !current.caseSensitive,
              }))
            }
            aria-label="Match case"
            aria-pressed={find.caseSensitive}
            title="Match case"
          >
            Aa
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 px-2 text-[10px]",
              find.wholeWord && "bg-accent"
            )}
            onClick={() =>
              setFind((current) => ({
                ...current,
                wholeWord: !current.wholeWord,
              }))
            }
            aria-label="Whole word"
            aria-pressed={find.wholeWord}
            title="Whole word"
          >
            \b
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 px-2 text-[10px]",
              find.regex && "bg-accent"
            )}
            onClick={() =>
              setFind((current) => ({
                ...current,
                regex: !current.regex,
              }))
            }
            aria-label="Regular expression"
            aria-pressed={find.regex}
            title="Regular expression"
          >
            .*
          </Button>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {matches.length > 0 ? `${safeCurrent + 1} / ${matches.length}` : "0 / 0"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => runFind(-1)}
            aria-label="Previous match"
            disabled={matches.length === 0}
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => runFind(1)}
            aria-label="Next match"
            disabled={matches.length === 0}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={replaceOne}
            disabled={matches.length === 0}
          >
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={replaceAll}
            disabled={matches.length === 0}
          >
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
            All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => {
              setFind((current) => ({
                ...current,
                open: false,
              }));
              setFindInput("");
              setReplaceInput("");
            }}
            aria-label="Close find"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-background">
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="select-none overflow-hidden border-r border-border bg-muted/30 py-2 pl-2 pr-3 text-right font-mono text-[11px] leading-[1.5] text-muted-foreground"
          style={{ minWidth: "3.25rem" }}
        >
          <pre className="m-0 whitespace-pre">{lineNumbers}</pre>
        </div>
        <div className="relative flex-1">
          <pre
            ref={overlayRef}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 m-0 overflow-hidden p-2 font-mono text-[12px] leading-[1.5]",
              wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
            )}
            data-language={language}
          >
            <code
              className="block"
              dangerouslySetInnerHTML={{ __html: applyTokenClasses(highlighted) }}
            />
          </pre>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onScroll={handleScroll}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={ariaLabel ?? `Code editor (${language})`}
            wrap={wordWrap ? "soft" : "off"}
            className={cn(
              "absolute inset-0 m-0 h-full w-full resize-none border-0 bg-transparent p-2 font-mono text-[12px] leading-[1.5] text-transparent caret-foreground outline-none focus:outline-none",
              wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
            )}
          />
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border bg-muted/30 px-2 py-1 text-[10px]">
          {suggestions.slice(0, 6).map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => applySuggestion(suggestion)}
              className={cn(
                "rounded border border-border px-2 py-0.5 font-mono",
                index === suggestionIndex
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-accent"
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The tokens-to-html output already wraps every token in
 * <span class="tok-…">. Replace those class names with the Tailwind
 * classes the rest of the UI uses, so the overlay matches the
 * surrounding dark / light theme without shipping a new
 * stylesheet.
 */
function applyTokenClasses(html: string): string {
  return html.replace(/class="tok-([a-z]+)"/g, (_match, kind: string) => {
    return `class="${KIND_CLASS[kind as TokenKind] ?? "tok-plain"}"`;
  });
}
