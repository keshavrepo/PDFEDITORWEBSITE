"use client";

/**
 * Shared rich-text editor for SocialPilot.
 *
 * A small, dependency-free editor that supports bold, italic, code,
 * links, mentions, hashtags, bullet and ordered lists, and a
 * checklist mode. The editor stores its body as a list of paragraphs
 * with character-level marks; a plain-text mirror is always kept in
 * sync so the rest of the workspace (search, character counter,
 * caption-manager import) can read the body without parsing marks.
 *
 * The editor is uncontrolled: callers pass the body, an onChange
 * callback and a list of available mentions. The editor derives a
 * plain-text mirror on every keystroke so the parent always has a
 * copy it can read.
 */

import { useCallback, useMemo, useRef } from "react";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  AtSign,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SocialRichTextParagraph } from "@/lib/socialpilot";

interface RichTextEditorProps {
  /** The current paragraphs. */
  paragraphs: SocialRichTextParagraph[];
  /** Called on every change. */
  onChange: (next: SocialRichTextParagraph[]) => void;
  /** Aria label for the editor. */
  ariaLabel: string;
  /** Whether the editor is in checklist mode. */
  checklist?: boolean;
  /** Class name for the wrapper. */
  className?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Placeholder shown when the editor is empty. */
  placeholder?: string;
}

/** Builds a plain-text mirror from paragraphs. */
export function paragraphsToPlainText(paragraphs: SocialRichTextParagraph[]): string {
  return paragraphs
    .map((paragraph) => {
      if (paragraph.listKind === "checklist") {
        return `${paragraph.checked ? "[x]" : "[ ]"} ${paragraph.text}`;
      }
      if (paragraph.listKind === "bullet") {
        return `- ${paragraph.text}`;
      }
      if (paragraph.listKind === "ordered") {
        return `1. ${paragraph.text}`;
      }
      return paragraph.text;
    })
    .join("\n");
}

/** Builds a single empty paragraph. */
function emptyParagraph(checklist = false): SocialRichTextParagraph {
  return checklist
    ? { text: "", marks: [], listKind: "checklist", checked: false }
    : { text: "", marks: [] };
}

/** Returns the offsets of every mention / hashtag in the text. */
function detectInlineTokens(text: string): Array<{ type: "mention" | "hashtag"; start: number; end: number; label: string }> {
  const out: Array<{ type: "mention" | "hashtag"; start: number; end: number; label: string }> = [];
  const re = /([@#][\p{L}\p{N}_]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      type: m[1]!.startsWith("@") ? "mention" : "hashtag",
      start: m.index,
      end: m.index + m[1]!.length,
      label: m[1]!.slice(1),
    });
  }
  return out;
}

/**
 * Returns the marks for a given text, with any inline tokens
 * detected and added as marks (only if not already present in the
 * existing marks).
 */
function autoMarks(text: string, existing: SocialRichTextParagraph["marks"]): SocialRichTextParagraph["marks"] {
  const tokens = detectInlineTokens(text);
  if (tokens.length === 0) return existing;
  const next: SocialRichTextParagraph["marks"] = existing.filter(
    (m) => m.type !== "mention" && m.type !== "hashtag"
  );
  for (const token of tokens) {
    next.push({ type: token.type, start: token.start, end: token.end, label: token.label });
  }
  return next;
}

interface RenderedSegment {
  text: string;
  className?: string;
}

function renderParagraph(paragraph: SocialRichTextParagraph): RenderedSegment[] {
  const text = paragraph.text;
  if (text.length === 0) return [];
  // Build a flat list of cut-points (start of every mark, end of
  // every mark) and emit segments between cut-points.
  const cutPoints = new Set<number>([0, text.length]);
  for (const mark of paragraph.marks) {
    cutPoints.add(Math.max(0, Math.min(text.length, mark.start)));
    cutPoints.add(Math.max(0, Math.min(text.length, mark.end)));
  }
  const sorted = [...cutPoints].sort((a, b) => a - b);
  const out: RenderedSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    const segment = text.slice(start, end);
    if (!segment) continue;
    const activeMarks = paragraph.marks.filter(
      (m) => m.start <= start && m.end >= end
    );
    let className: string | undefined;
    for (const mark of activeMarks) {
      if (mark.type === "bold") className = cn(className, "font-semibold");
      else if (mark.type === "italic") className = cn(className, "italic");
      else if (mark.type === "code")
        className = cn(
          className,
          "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
        );
      else if (mark.type === "link")
        className = cn(className, "text-primary underline");
      else if (mark.type === "mention")
        className = cn(className, "text-primary");
      else if (mark.type === "hashtag")
        className = cn(className, "text-primary");
    }
    out.push({ text: segment, className });
  }
  return out;
}

export function RichTextEditor({
  paragraphs,
  onChange,
  ariaLabel,
  checklist = false,
  className,
  disabled,
  placeholder,
}: RichTextEditorProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Always have at least one paragraph.
  const safe = useMemo(() => {
    if (paragraphs.length === 0) return [emptyParagraph(checklist)];
    return paragraphs;
  }, [paragraphs, checklist]);

  const update = useCallback(
    (index: number, patch: Partial<SocialRichTextParagraph>) => {
      const next = safe.map((p, i) => {
        if (i !== index) return p;
        const merged: SocialRichTextParagraph = { ...p, ...patch };
        if (typeof patch.text === "string") {
          merged.marks = autoMarks(merged.text, merged.marks);
        }
        return merged;
      });
      onChange(next);
    },
    [safe, onChange]
  );

  const insertParagraph = useCallback(
    (index: number) => {
      const next = [
        ...safe.slice(0, index + 1),
        emptyParagraph(safe[index]?.listKind === "checklist" || checklist),
        ...safe.slice(index + 1),
      ];
      onChange(next);
    },
    [safe, onChange, checklist]
  );

  const removeParagraph = useCallback(
    (index: number) => {
      if (safe.length <= 1) {
        onChange([emptyParagraph(checklist)]);
        return;
      }
      const next = safe.filter((_, i) => i !== index);
      onChange(next);
    },
    [safe, onChange, checklist]
  );

  function toggleFormat(kind: "bold" | "italic" | "code" | "link") {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    // Find the paragraph that contains the range.
    const container = range.commonAncestorContainer;
    const paragraphEl =
      container.nodeType === 3
        ? (container.parentElement?.closest("[data-paragraph]") as HTMLElement | null)
        : ((container as HTMLElement).closest?.("[data-paragraph]") as HTMLElement | null);
    if (!paragraphEl) return;
    const index = Number(paragraphEl.getAttribute("data-paragraph-index"));
    if (Number.isNaN(index)) return;
    const start = getCaretOffset(paragraphEl, range.startContainer, range.startOffset);
    const end = getCaretOffset(paragraphEl, range.endContainer, range.endOffset);
    if (start === end) return;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const paragraph = safe[index];
    if (!paragraph) return;
    // Remove any existing mark of the same kind that overlaps the range.
    const marks = paragraph.marks.filter(
      (m) => m.type !== kind || m.end <= lo || m.start >= hi
    );
    if (kind === "link") {
      const href = window.prompt("Link URL") ?? "";
      if (!href) return;
      marks.push({ type: "link", start: lo, end: hi, href });
    } else {
      marks.push({ type: kind, start: lo, end: hi });
    }
    marks.sort((a, b) => a.start - b.start);
    update(index, { marks });
  }

  function insertInlineToken(type: "mention" | "hashtag") {
    const symbol = type === "mention" ? "@" : "#";
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const paragraphEl =
      container.nodeType === 3
        ? (container.parentElement?.closest("[data-paragraph]") as HTMLElement | null)
        : ((container as HTMLElement).closest?.("[data-paragraph]") as HTMLElement | null);
    if (!paragraphEl) return;
    const index = Number(paragraphEl.getAttribute("data-paragraph-index"));
    if (Number.isNaN(index)) return;
    const caret = getCaretOffset(
      paragraphEl,
      range.startContainer,
      range.startOffset
    );
    const paragraph = safe[index];
    if (!paragraph) return;
    const next = paragraph.text.slice(0, caret) + symbol + paragraph.text.slice(caret);
    update(index, { text: next });
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("rounded border border-border bg-background", className)}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border p-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => toggleFormat("bold")}
          disabled={disabled}
          aria-label="Bold"
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => toggleFormat("italic")}
          disabled={disabled}
          aria-label="Italic"
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => toggleFormat("code")}
          disabled={disabled}
          aria-label="Inline code"
          title="Inline code"
        >
          <Code className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => toggleFormat("link")}
          disabled={disabled}
          aria-label="Link"
          title="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => insertInlineToken("mention")}
          disabled={disabled}
          aria-label="Insert mention"
          title="Insert @mention"
        >
          <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => insertInlineToken("hashtag")}
          disabled={disabled}
          aria-label="Insert hashtag"
          title="Insert #hashtag"
        >
          <Hash className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => {
            const last = safe[safe.length - 1];
            const kind: "bullet" | "ordered" | "checklist" = checklist
              ? "checklist"
              : "bullet";
            const next = safe.map((p) =>
              p.listKind ? p : { ...p, listKind: kind }
            );
            if (!last?.listKind && !checklist) {
              next[next.length - 1] = {
                ...(next[next.length - 1] ?? emptyParagraph()),
                listKind: "bullet",
              };
            }
            onChange(next);
          }}
          disabled={disabled}
          aria-label="Bullet list"
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => {
            const next = safe.map((p) => ({ ...p, listKind: "ordered" as const }));
            onChange(next);
          }}
          disabled={disabled}
          aria-label="Ordered list"
          title="Ordered list"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => {
            const next = safe.map((p) => ({
              ...p,
              listKind: "checklist" as const,
              checked: p.checked ?? false,
            }));
            onChange(next);
          }}
          disabled={disabled}
          aria-label="Checklist"
          title="Checklist"
        >
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Body */}
      <div className="space-y-1 p-2" aria-label={ariaLabel}>
        {safe.map((paragraph, index) => {
          const segments = renderParagraph(paragraph);
          return (
            <div
              key={index}
              data-paragraph
              data-paragraph-index={index}
              className="flex items-start gap-2"
            >
              {paragraph.listKind === "checklist" && (
                <input
                  type="checkbox"
                  checked={Boolean(paragraph.checked)}
                  onChange={(event) =>
                    update(index, { checked: event.target.checked })
                  }
                  className="mt-1 h-4 w-4 cursor-pointer rounded border-border"
                  aria-label={`Mark "${paragraph.text || "checklist item"}" done`}
                  disabled={disabled}
                />
              )}
              {paragraph.listKind === "bullet" && (
                <span aria-hidden="true" className="mt-1 text-muted-foreground">
                  •
                </span>
              )}
              {paragraph.listKind === "ordered" && (
                <span aria-hidden="true" className="mt-1 text-muted-foreground tabular-nums">
                  {index + 1}.
                </span>
              )}
              <div
                contentEditable={!disabled}
                suppressContentEditableWarning
                onInput={(event) => {
                  const text = (event.target as HTMLElement).innerText;
                  update(index, { text });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    insertParagraph(index);
                    requestAnimationFrame(() => {
                      const next = wrapperRef.current?.querySelector(
                        `[data-paragraph-index="${index + 1}"]`
                      );
                      (next as HTMLElement | null)?.focus();
                    });
                  }
                  if (event.key === "Backspace" && paragraph.text.length === 0) {
                    event.preventDefault();
                    removeParagraph(index);
                  }
                }}
                className={cn(
                  "min-h-[1.5em] flex-1 whitespace-pre-wrap break-words rounded px-1 py-0.5 text-sm outline-none focus:bg-accent/40",
                  paragraph.checked && "line-through text-muted-foreground"
                )}
              >
                {segments.length === 0
                  ? (placeholder ?? "")
                  : segments.map((segment, i) => (
                      <span key={i} className={segment.className}>
                        {segment.text}
                      </span>
                    ))}
              </div>
              {safe.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParagraph(index)}
                  className="mt-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Remove paragraph ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Returns the offset of a position inside `paragraphEl` measured
 * against the rendered text. We walk the text nodes and sum their
 * lengths until we reach the target node / offset.
 */
function getCaretOffset(paragraphEl: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT, null);
  let current = walker.nextNode();
  while (current) {
    if (current === node) {
      return total + offset;
    }
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}
