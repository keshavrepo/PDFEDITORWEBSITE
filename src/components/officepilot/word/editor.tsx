"use client";

/**
 * OfficePilot Word editor.
 *
 * Renders the document body as a sequence of blocks, captures user input
 * and dispatches commands to the editor model. The editor owns the
 * contentEditable surface and the caret, so it is responsible for:
 *
 *  - rendering each block in its semantic form
 *  - keeping the cursor in sync with the document state
 *  - dispatching keyboard shortcuts (undo/redo, bold/italic, alignment,
 *    enter to split, etc.) via the command bus
 *  - integrating with the browser-native spell check
 *  - rendering a print stylesheet so the browser's Print action produces
 *    a real, paginated PDF
 *
 * The Word surface component in the foundation file is a thin host that
 * mounts this editor. Everything that touches the document body is
 * delegated to the editor model, so the toolbar, the status bar, the
 * properties panel and the export pipeline all read the same source of
 * truth.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import type { OfficeDocument } from "@/lib/officepilot";
import {
  type WordBlock,
  type WordBody,
  type WordList,
  type WordRun,
} from "@/lib/officepilot/word/schema";
import { makeBlockId } from "@/lib/officepilot/word/blocks";
import { useWordEditorModel } from "./document-model";
import { WordToolbar, FindReplaceDialog, HyperlinkDialog, ImageDialog } from "./toolbar";
import { printWordDocument } from "@/lib/officepilot/word/text-exporters";

/** Pixel size of one typographic point at 1× zoom. */
const PT_TO_PX = 4 / 3;

/** Maps alignment to a CSS class. */
function alignmentClass(alignment: "left" | "center" | "right" | "justify"): string {
  switch (alignment) {
    case "left":
      return "text-left";
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    case "justify":
      return "text-justify";
  }
}

/** Returns the inline class for the default font and size. */
function baseClass(_settings: { fontFamily: string; fontSize: number; lineSpacing: number }): string {
  return cn(
    "[&_p]:leading-relaxed",
    "[&_h1]:font-bold",
    "[&_h2]:font-semibold",
    "[&_h3]:font-semibold",
    "[&_h4]:font-semibold",
    "[&_h5]:font-medium",
    "[&_h6]:font-medium"
  );
}

interface WordEditorProps {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

/** The full Word editor: toolbar, page canvas, status, dialogs, print. */
export function WordEditor({ document, onChange }: WordEditorProps) {
  const model = useWordEditorModel({ document, onChange });
  const [zoom, setZoom] = useState(1);
  const [findOpen, setFindOpen] = useState(false);
  const [hyperlinkOpen, setHyperlinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  const activeBlock = useMemo(() => {
    const index = model.selection?.blockIndex ?? 0;
    return model.body.blocks[index] ?? null;
  }, [model.body.blocks, model.selection]);

  const pageWidthPx = useMemo(
    () => model.body.settings.page.widthMm * 3.78 * zoom,
    [model.body.settings.page.widthMm, zoom]
  );
  const pageHeightPx = useMemo(
    () => model.body.settings.page.heightMm * 3.78 * zoom,
    [model.body.settings.page.heightMm, zoom]
  );

  const handlePrint = useCallback(() => {
    printWordDocument();
  }, []);

  // ------------------------------------------------------------------
  // Keyboard shortcuts (typing inside the document is contentEditable;
  // a few shortcuts run at the document level)
  // ------------------------------------------------------------------
  // The contenteditable ref is owned by `PageCanvas`; we mirror it up
  // here so the global keydown handler can decide whether the focus is
  // inside the editor before reacting to Ctrl/Cmd shortcuts.
  const editorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Shortcuts only fire when the document body has focus, so
      // toolbar inputs and dialogs keep their own keyboard handling.
      if (!editorRef.current || !editorRef.current.contains(target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        model.commands.undo();
        return;
      }
      if (mod && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
        event.preventDefault();
        model.commands.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        model.commands.toggleMark("bold");
        return;
      }
      if (mod && event.key.toLowerCase() === "i") {
        event.preventDefault();
        model.commands.toggleMark("italic");
        return;
      }
      if (mod && event.key.toLowerCase() === "u") {
        event.preventDefault();
        model.commands.toggleMark("underline");
        return;
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setHyperlinkOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === "p") {
        event.preventDefault();
        printWordDocument();
        return;
      }
      if (mod && event.key.toLowerCase() === "e") {
        event.preventDefault();
        model.commands.toggleMark("code");
        return;
      }
      if (mod && event.key === "Tab") {
        event.preventDefault();
        model.commands.setIndent(event.shiftKey ? -1 : 1);
        return;
      }
      if (mod && event.altKey && (event.key === "1" || event.key === "2" || event.key === "3")) {
        event.preventDefault();
        const level = Number(event.key) as 1 | 2 | 3;
        model.commands.setHeadingLevel(level);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [model.commands]);

  // ------------------------------------------------------------------
  // DOM → body sync
  // ------------------------------------------------------------------
  // The canvas is a contentEditable surface; `PageCanvas` owns the
  // input handler that serialises the DOM back into blocks. The model
  // owns the structured data.

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <WordToolbar
        commands={model.commands}
        body={model.body}
        activeBlock={activeBlock}
        zoom={zoom}
        onZoomChange={setZoom}
        onPrint={handlePrint}
        onInsertHyperlink={() => setHyperlinkOpen(true)}
        onInsertImage={() => setImageOpen(true)}
        onFindReplace={() => setFindOpen(true)}
        findOpen={findOpen}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-6 print:p-0 print:bg-white print:overflow-visible">
        <PageCanvas
          body={model.body}
          pageWidthPx={pageWidthPx}
          pageHeightPx={pageHeightPx}
          onChange={onChange}
          document={document}
          editorRef={editorRef}
        />
      </div>

      <FindReplaceDialog
        open={findOpen}
        onClose={() => setFindOpen(false)}
        onReplace={model.commands.replaceAll}
      />
      <HyperlinkDialog
        open={hyperlinkOpen}
        onClose={() => setHyperlinkOpen(false)}
        initial=""
        onSave={(href) => {
          model.commands.setHyperlink(href);
          setHyperlinkOpen(false);
        }}
      />
      <ImageDialog
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onSave={(src, alt, width) => {
          model.commands.insertImage(src, alt, width);
          setImageOpen(false);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page canvas                                                                 */
/* -------------------------------------------------------------------------- */

interface PageCanvasProps {
  body: WordBody;
  pageWidthPx: number;
  pageHeightPx: number;
  onChange: (next: OfficeDocument) => void;
  document: OfficeDocument;
  /** Mirror of the contenteditable ref so the parent can run shortcuts
   *  that only fire when the document body is focused. */
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
}

function PageCanvas({ body, pageWidthPx, pageHeightPx, onChange, document, editorRef }: PageCanvasProps) {
  // The contenteditable ref is owned by `CanvasBody`; the input handler
  // reads from it to serialise the DOM back into blocks.
  const canvasBodyRef = useRef<HTMLDivElement | null>(null);
  // Persisted model the user can edit through `contenteditable`.
  const handleInput = useCallback(() => {
    const element = canvasBodyRef.current;
    if (!element) return;
    const html = element.innerHTML;
    const next = htmlToBody(html, body.settings, body.blocks);
    // Compare the parsed blocks — not the full body — so the no-op
    // guard catches a stray input event without forcing a write.
    if (JSON.stringify(next.blocks) === JSON.stringify(body.blocks)) return;
    onChange({ ...document, body: { ...body, blocks: next.blocks } });
  }, [body, document, onChange]);

  const handleKeyDown = useCallback((_event: KeyboardEvent<HTMLDivElement>) => {
    // The global keydown handler in `WordEditor` owns the keyboard
    // shortcuts; the surface itself only needs to keep the contenteditable
    // behaviour intact, so this is intentionally a no-op.
  }, []);

  const marginPx = useMemo(
    () => ({
      top: body.settings.page.marginTopMm * 3.78,
      right: body.settings.page.marginRightMm * 3.78,
      bottom: body.settings.page.marginBottomMm * 3.78,
      left: body.settings.page.marginLeftMm * 3.78,
    }),
    [body.settings.page]
  );

  return (
    <div
      className="mx-auto print:mx-0"
      style={{ width: pageWidthPx, maxWidth: "100%" }}
    >
      <div
        className={cn(
          "relative mx-auto bg-background text-foreground shadow-md print:shadow-none",
          baseClass(body.settings)
        )}
        style={{
          width: pageWidthPx,
          minHeight: pageHeightPx,
          padding: `${marginPx.top}px ${marginPx.right}px ${marginPx.bottom}px ${marginPx.left}px`,
          fontFamily: body.settings.fontFamily,
          fontSize: `${body.settings.fontSize * PT_TO_PX}px`,
          lineHeight: body.settings.lineSpacing,
        }}
        lang={body.settings.language}
        spellCheck
      >
        {/* Header */}
        {renderHeaderFooter(body.settings.header.left, body.settings.header.center, body.settings.header.right)}

        {/* Body */}
        <CanvasBody
          ref={(node) => {
            canvasBodyRef.current = node;
            editorRef.current = node;
          }}
          body={body}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />

        {/* Footer */}
        {renderHeaderFooter(
          body.settings.footer.left,
          body.settings.footer.center,
          body.settings.footer.right,
          true,
          body.settings.pageNumber
        )}
      </div>
    </div>
  );
}

/** The contentEditable surface. Only swaps innerHTML when the rendered
 *  body actually differs from the DOM, so a typing-driven model update
 *  does not reset the cursor. */
const CanvasBody = forwardRef<HTMLDivElement, {
  body: WordBody;
  onInput: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}>(function CanvasBody({ body, onInput, onKeyDown }, ref) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = useRef<string>("");
  const html = useMemo(() => blocksToHtml(body.blocks), [body.blocks]);
  useEffect(() => {
    const element = innerRef.current;
    if (!element) return;
    if (element.innerHTML === html) return;
    // Remember the caret offset so it can be restored after the swap.
    const selection = window.getSelection();
    let anchorOffset = 0;
    let anchorKey: string | null = null;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      if (container.parentNode && element.contains(container)) {
        const pre = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let total = 0;
        let node: Node | null = pre.currentNode;
        while (node) {
          if (node === container) {
            anchorOffset = total + range.startOffset;
            anchorKey = (container as HTMLElement).getAttribute("data-block-id") ?? null;
            break;
          }
          total += (node.textContent ?? "").length;
          node = pre.nextNode();
        }
      }
    }
    element.innerHTML = html;
    lastHtmlRef.current = html;
    // Restore caret if we found a position.
    if (anchorKey !== null) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.currentNode;
      let remaining = anchorOffset;
      while (node) {
        const text = node.textContent ?? "";
        if (remaining <= text.length) {
          const range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
          break;
        }
        remaining -= text.length;
        node = walker.nextNode();
      }
    }
  }, [html]);
  return (
    <div
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      aria-label="Document body"
      onInput={onInput}
      onKeyDown={onKeyDown}
      className="min-h-[60vh] outline-none"
    />
  );
});

/** Renders the header/footer runs at the top or bottom of a page. */
function renderHeaderFooter(
  left: WordRun[],
  center: WordRun[],
  right: WordRun[],
  isFooter = false,
  pageNumber = false
) {
  const hasContent = left.length || center.length || right.length || pageNumber;
  if (!hasContent) return null;
  return (
    <div
      className={cn(
        "mb-3 grid grid-cols-3 text-[10px] text-muted-foreground print:mb-2",
        isFooter && "mt-6 mb-0"
      )}
    >
      <div>{runsToInlineHtml(left)}</div>
      <div className="text-center">
        {runsToInlineHtml(center)}
        {pageNumber && isFooter && (
          <span className="print:inline-block print:before:content-['Page_'] hidden" />
        )}
        {pageNumber && isFooter && (
          <span className="print:inline-block print:after:content-['/_'] hidden" />
        )}
        {pageNumber && isFooter && <span className="hidden print:inline-block" />}
      </div>
      <div className="text-right">{runsToInlineHtml(right)}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HTML ↔ body serialisation                                                   */
/* -------------------------------------------------------------------------- */

/** Converts a list of runs to inline HTML. */
function runsToInlineHtml(runs: WordRun[]): string {
  if (!runs.length) return "";
  return runs
    .map((run) => {
      let html = escapeHtml(run.text).replace(/\n/g, "<br>");
      if (run.marks.includes("code")) html = `<code>${html}</code>`;
      if (run.marks.includes("bold")) html = `<strong>${html}</strong>`;
      if (run.marks.includes("italic")) html = `<em>${html}</em>`;
      if (run.marks.includes("underline")) html = `<u>${html}</u>`;
      if (run.marks.includes("strikethrough")) html = `<s>${html}</s>`;
      if (run.marks.includes("superscript")) html = `<sup>${html}</sup>`;
      if (run.marks.includes("subscript")) html = `<sub>${html}</sub>`;
      if (run.color) {
        const styles: string[] = [`color:${escapeHtml(run.color)}`];
        if (run.highlight) styles.push(`background-color:${escapeHtml(run.highlight)}`);
        html = `<span style="${styles.join(";")}">${html}</span>`;
      } else if (run.highlight) {
        html = `<span style="background-color:${escapeHtml(run.highlight)}">${html}</span>`;
      }
      if (run.href) html = `<a href="${escapeHtml(run.href)}">${html}</a>`;
      return html;
    })
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Serialises a list of blocks to the editor's contentEditable HTML. */
function blocksToHtml(blocks: WordBlock[]): string {
  return blocks.map(blockToHtml).join("");
}

/** Serialises one block. */
function blockToHtml(block: WordBlock): string {
  switch (block.type) {
    case "heading": {
      const inner = runsToInlineHtml(block.runs);
      const className = cn(
        alignmentClass(block.alignment),
        block.level === 1 && "text-3xl",
        block.level === 2 && "text-2xl",
        block.level === 3 && "text-xl",
        block.level === 4 && "text-lg",
        block.level === 5 && "text-base",
        block.level === 6 && "text-sm"
      );
      return `<h${block.level} data-block-id="${escapeHtml(block.id)}" class="${className}" style="margin:0">${inner || "<br>"}</h${block.level}>`;
    }
    case "paragraph": {
      const inner = runsToInlineHtml(block.runs);
      const indent = block.indent ? `padding-left:${block.indent * 1.5}em;` : "";
      return `<p data-block-id="${escapeHtml(block.id)}" class="${alignmentClass(
        block.alignment
      )}" style="margin:0;${indent}">${inner || "<br>"}</p>`;
    }
    case "list": {
      const tag = block.kind === "ordered" ? "ol" : "ul";
      const style =
        block.kind === "checklist"
          ? 'list-style-type:"☐";'
          : block.kind === "ordered"
          ? 'list-style-type:decimal;'
          : 'list-style-type:disc;';
      const items = block.items
        .map(
          (item) =>
            `<li data-block-id="${escapeHtml(item.id)}">${runsToInlineHtml(item.runs) || "<br>"}</li>`
        )
        .join("");
      return `<${tag} data-block-id="${escapeHtml(block.id)}" style="${style}">${items}</${tag}>`;
    }
    case "quote": {
      const inner = runsToInlineHtml(block.runs);
      return `<blockquote data-block-id="${escapeHtml(
        block.id
      )}" class="${alignmentClass(block.alignment)} border-l-2 border-border pl-4 italic text-muted-foreground" style="margin:0">${inner || "<br>"}</blockquote>`;
    }
    case "code":
      return `<pre data-block-id="${escapeHtml(
        block.id
      )}" class="rounded-lg bg-muted p-3 font-mono text-[0.95em]" style="margin:0"><code>${escapeHtml(
        block.text
      )}</code></pre>`;
    case "table": {
      const rows = block.rows
        .map((row) => {
          const tag = row.id.startsWith("row-header") ? "th" : "td";
          const cells = row.cells
            .map(
              (cell) =>
                `<${tag} data-block-id="${escapeHtml(cell.id)}">${runsToInlineHtml(cell.runs) || "<br>"}</${tag}>`
            )
            .join("");
          return `<tr data-block-id="${escapeHtml(row.id)}">${cells}</tr>`;
        })
        .join("");
      return `<table data-block-id="${escapeHtml(
        block.id
      )}" class="w-full border-collapse" style="margin:0"><tbody>${rows}</tbody></table>`;
    }
    case "image":
      return `<div data-block-id="${escapeHtml(
        block.id
      )}" class="my-2 text-center" style="margin:0"><img src="${escapeHtml(
        block.src
      )}" alt="${escapeHtml(block.alt)}" style="max-width:${block.width}px;height:auto" /></div>`;
    case "page-break":
      return `<hr data-block-id="${escapeHtml(
        block.id
      )}" class="my-3 border-dashed border-border" style="page-break-after:always" />`;
    default:
      return "";
  }
}

/** Parses the editor's HTML back into a body, preserving block ids. */
function htmlToBody(
  html: string,
  settings: WordBody["settings"],
  existing: WordBlock[]
): { blocks: WordBlock[] } {
  if (typeof DOMParser === "undefined") {
    return { blocks: existing };
  }
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const container = parsed.body.firstElementChild;
  if (!container) return { blocks: existing };

  const blocks: WordBlock[] = [];
  const existingById = new Map(existing.map((block) => [block.id, block]));

  for (const child of Array.from(container.children)) {
    const element = child as HTMLElement;
    const id = element.getAttribute("data-block-id") ?? makeBlockId("block");
    const tag = element.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      const level = Math.min(6, Math.max(1, Number(tag.charAt(1)))) as 1 | 2 | 3 | 4 | 5 | 6;
      const previous = existingById.get(id) as { alignment: "left" | "center" | "right" | "justify" } | undefined;
      blocks.push({
        id,
        type: "heading",
        level,
        runs: parseInline(element),
        alignment: previous?.alignment ?? "left",
      });
    } else if (tag === "p") {
      const previous = existingById.get(id) as { alignment: "left" | "center" | "right" | "justify"; indent: number } | undefined;
      blocks.push({
        id,
        type: "paragraph",
        runs: parseInline(element),
        alignment: previous?.alignment ?? "left",
        indent: previous?.indent ?? 0,
      });
    } else if (tag === "ol" || tag === "ul") {
      const previous = existingById.get(id) as WordList | undefined;
      const kind = previous?.kind ?? (tag === "ol" ? "ordered" : "unordered");
      const items = Array.from(element.querySelectorAll(":scope > li")).map((li) => ({
        id: li.getAttribute("data-block-id") ?? makeBlockId("item"),
        runs: parseInline(li as HTMLElement),
      }));
      blocks.push({ id, type: "list", kind, items });
    } else if (tag === "blockquote") {
      const previous = existingById.get(id) as { alignment: "left" | "center" | "right" | "justify" } | undefined;
      blocks.push({
        id,
        type: "quote",
        runs: parseInline(element),
        alignment: previous?.alignment ?? "left",
      });
    } else if (tag === "pre") {
      blocks.push({
        id,
        type: "code",
        text: element.textContent ?? "",
      });
    } else if (tag === "table") {
      const rows = Array.from(element.querySelectorAll("tbody tr")).map((tr) => {
        const cells = Array.from(tr.children).map((cell) => ({
          id: (cell as HTMLElement).getAttribute("data-block-id") ?? makeBlockId("cell"),
          runs: parseInline(cell as HTMLElement),
        }));
        return {
          id: (tr as HTMLElement).getAttribute("data-block-id") ?? makeBlockId("row"),
          cells,
        };
      });
      blocks.push({ id, type: "table", rows });
    } else if (tag === "div" && element.querySelector("img")) {
      const img = element.querySelector("img")!;
      blocks.push({
        id,
        type: "image",
        src: img.getAttribute("src") ?? "",
        alt: img.getAttribute("alt") ?? "",
        width: 480,
      });
    } else if (tag === "hr") {
      blocks.push({ id, type: "page-break" });
    }
  }

  return { blocks };
}

/** Parses inline content into runs. */
function parseInline(element: HTMLElement): WordRun[] {
  const runs: WordRun[] = [];
  function walk(node: ChildNode, marks: string[], href?: string, color?: string, highlight?: string) {
    if (node.nodeType === 3) {
      // Text node.
      const text = node.textContent ?? "";
      if (text) {
        const run: WordRun = { text, marks: marks as WordRun["marks"], href };
        if (color) run.color = color;
        if (highlight) run.highlight = highlight;
        runs.push(run);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") {
      runs.push({ text: "\n", marks: [] });
      return;
    }
    let nextMarks = [...marks];
    let nextHref = href;
    let nextColor = color;
    let nextHighlight = highlight;
    if (tag === "strong" || tag === "b") nextMarks.push("bold");
    if (tag === "em" || tag === "i") nextMarks.push("italic");
    if (tag === "u") nextMarks.push("underline");
    if (tag === "s" || tag === "strike" || tag === "del") nextMarks.push("strikethrough");
    if (tag === "sup") nextMarks.push("superscript");
    if (tag === "sub") nextMarks.push("subscript");
    if (tag === "code") nextMarks.push("code");
    if (tag === "a") nextHref = el.getAttribute("href") ?? undefined;
    if (tag === "span") {
      const style = el.getAttribute("style") ?? "";
      const colorMatch = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
      if (colorMatch) nextColor = colorMatch[1]!.trim();
      const highlightMatch = /(?:^|;)\s*background-color\s*:\s*([^;]+)/i.exec(style);
      if (highlightMatch) nextHighlight = highlightMatch[1]!.trim();
    }
    for (const child of Array.from(el.childNodes)) {
      walk(child, nextMarks, nextHref, nextColor, nextHighlight);
    }
  }
  for (const child of Array.from(element.childNodes)) {
    walk(child, []);
  }
  return runs;
}
