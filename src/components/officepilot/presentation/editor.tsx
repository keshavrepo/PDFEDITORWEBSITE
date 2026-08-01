"use client";

/**
 * OfficePilot Presentation editor.
 *
 * Renders the slide list (with thumbnails), the active slide canvas and
 * the per-slide notes. The toolbar is the single place that fires
 * commands at the editor model; this file owns the slide rendering and
 * the per-block editor (text, bullets, image, table, shape).
 */

import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfficeDocument } from "@/lib/officepilot";
import {
  PRESENTATION_THEMES,
  type PresentationBlock,
  type PresentationRun,
  type PresentationSlide,
} from "@/lib/officepilot/presentation/schema";
import { usePresentationEditorModel } from "./document-model";
import { PresentationToolbar, FindReplaceDialog } from "./toolbar";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

interface PresentationEditorProps {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

/** Resolves a background to a CSS background value. */
function backgroundCss(background: { kind: "color" | "gradient"; color: string; color2?: string; angle?: number } | undefined): string {
  if (!background) return "#ffffff";
  if (background.kind === "color") return background.color;
  return `linear-gradient(${background.angle ?? 135}deg, ${background.color}, ${background.color2 ?? background.color})`;
}

export function PresentationEditor({ document, onChange }: PresentationEditorProps) {
  const model = usePresentationEditorModel({ document, onChange });
  const [zoom, setZoom] = useState(0.6);
  const [findOpen, setFindOpen] = useState(false);

  const body = model.body;
  const activeIndex = model.activeIndex;
  const slide = body.slides[activeIndex];
  const palette = PRESENTATION_THEMES[body.settings.theme];

  const handleReplace = useCallback(
    (search: string, replacement: string, caseSensitive: boolean) => {
      if (!search) return 0;
      let count = 0;
      const re = new RegExp(escapeRegExp(search), caseSensitive ? "g" : "gi");
      for (let i = 0; i < body.slides.length; i++) {
        const s = body.slides[i]!;
        const replaceInRuns = (runs: PresentationRun[]): PresentationRun[] =>
          runs.map((run) => {
            if (!run.text) return run;
            if (re.test(run.text)) {
              re.lastIndex = 0;
              const next = run.text.replace(re, () => {
                count += 1;
                return replacement;
              });
              return { ...run, text: next };
            }
            return run;
          });
        const newBlocks: PresentationBlock[] = s.blocks.map((block) => {
          if (block.type === "text") return { id: block.id, type: "text", runs: replaceInRuns(block.runs) };
          if (block.type === "bullets") {
            return { id: block.id, type: "bullets", items: block.items.map((item) => replaceInRuns(item)) };
          }
          return block;
        });
        const newTitle = s.title.replace(re, () => {
          count += 1;
          return replacement;
        });
        const newSubtitle = (s.subtitle ?? "").replace(re, () => {
          count += 1;
          return replacement;
        });
        const newNotes = s.notes.replace(re, () => {
          count += 1;
          return replacement;
        });
        if (newTitle !== s.title || newSubtitle !== s.subtitle || newNotes !== s.notes || newBlocks !== s.blocks) {
          model.commands.setBody(
            {
              ...body,
              slides: body.slides.map((existing, index) =>
                index === i ? { ...existing, title: newTitle, subtitle: newSubtitle, notes: newNotes, blocks: newBlocks } : existing
              ),
            },
            "Replace"
          );
        }
      }
      return count;
    },
    [body, model.commands]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, [contenteditable='true'], [role='textbox']")) {
        return;
      }
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
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
        return;
      }
      if (mod && event.key === "Enter") {
        event.preventDefault();
        model.commands.addSlide();
        return;
      }
    },
    [model.commands]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      <PresentationToolbar
        commands={model.commands}
        body={body}
        activeSlide={slide ?? null}
        zoom={zoom}
        onZoomChange={setZoom}
        onFindReplace={() => setFindOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Slide list */}
        <aside className="flex w-44 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-card p-2">
          <button
            type="button"
            onClick={() => model.commands.addSlide()}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" aria-hidden="true" /> New slide
          </button>
          {body.slides.map((entry, index) => (
            <SlideThumbnail
              key={entry.id}
              slide={entry}
              index={index}
              isActive={index === activeIndex}
              onClick={() => model.setActiveIndex(index)}
              onDuplicate={() => model.commands.duplicateSlide(index)}
              onDelete={() => model.commands.removeSlide(index)}
              onMoveUp={() => model.commands.reorderSlide(index, Math.max(0, index - 1))}
              onMoveDown={() => model.commands.reorderSlide(index, Math.min(body.slides.length - 1, index + 1))}
              isFirst={index === 0}
              isLast={index === body.slides.length - 1}
              themeBackground={body.settings.background}
              themeFontColor={palette.fontColor}
            />
          ))}
        </aside>

        {/* Slide canvas */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
            <span>Slide {activeIndex + 1} of {body.slides.length}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{body.settings.theme}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{document.meta.category.replace("-", " ")}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-6">
            {slide ? (
              <SlideCanvas
                slide={slide}
                fontFamily={body.settings.fontFamily}
                fontColor={palette.fontColor}
                deckBackground={body.settings.background}
                zoom={zoom}
                onTitleChange={(title) => model.commands.setTitle(activeIndex, title)}
                onSubtitleChange={(subtitle) => model.commands.setSubtitle(activeIndex, subtitle)}
                onBlockReplace={(blockId, replacement) => model.commands.replaceBlock(activeIndex, blockId, replacement)}
                onBlockRemove={(blockId) => model.commands.removeBlock(activeIndex, blockId)}
              />
            ) : null}
          </div>

          {/* Notes */}
          <div className="flex shrink-0 flex-col gap-1 border-t border-border bg-card px-3 py-2 text-xs">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Speaker notes
            </label>
            <textarea
              value={slide?.notes ?? ""}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => model.commands.setNotes(activeIndex, event.target.value)}
              rows={3}
              className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs"
              placeholder="Notes for the presenter…"
            />
          </div>
        </main>
      </div>

      <FindReplaceDialog
        open={findOpen}
        onClose={() => setFindOpen(false)}
        onReplace={handleReplace}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

interface SlideThumbnailProps {
  slide: PresentationSlide;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  themeBackground: { kind: "color" | "gradient"; color: string; color2?: string; angle?: number };
  themeFontColor: string;
}

function SlideThumbnail({
  slide,
  index,
  isActive,
  onClick,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  themeBackground,
  themeFontColor,
}: SlideThumbnailProps) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-1 rounded-lg border p-1.5 transition-colors",
        isActive ? "border-foreground/40 bg-background" : "border-border/60 bg-background hover:bg-accent"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col items-stretch gap-1 text-left"
        style={{
          background: backgroundCss(slide.background ?? themeBackground),
          color: themeFontColor,
          borderRadius: 4,
          padding: 8,
          aspectRatio: "16/9",
        }}
      >
        <div className="text-[8px] font-semibold truncate">{slide.title || "Untitled"}</div>
        <div className="text-[7px] opacity-80 line-clamp-2">{slide.subtitle || `${slide.blocks.length} blocks`}</div>
      </button>
      <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span className="font-medium tabular-nums">#{index + 1}</span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={onMoveUp} disabled={isFirst} className="rounded p-0.5 hover:bg-accent disabled:opacity-30" aria-label="Move slide up">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className="rounded p-0.5 hover:bg-accent disabled:opacity-30" aria-label="Move slide down">
            <ChevronDown className="h-3 w-3" />
          </button>
          <button type="button" onClick={onDuplicate} className="rounded p-0.5 hover:bg-accent" aria-label="Duplicate slide">
            <Copy className="h-3 w-3" />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-0.5 hover:bg-accent" aria-label="Delete slide">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SlideCanvasProps {
  slide: PresentationSlide;
  fontFamily: string;
  fontColor: string;
  deckBackground: { kind: "color" | "gradient"; color: string; color2?: string; angle?: number };
  zoom: number;
  onTitleChange: (title: string) => void;
  onSubtitleChange: (subtitle: string) => void;
  onBlockReplace: (blockId: string, replacement: PresentationBlock) => void;
  onBlockRemove: (blockId: string) => void;
}

function SlideCanvas({
  slide,
  fontFamily,
  fontColor,
  deckBackground,
  zoom,
  onTitleChange,
  onSubtitleChange,
  onBlockReplace,
  onBlockRemove,
}: SlideCanvasProps) {
  const width = SLIDE_WIDTH * zoom;
  const height = SLIDE_HEIGHT * zoom;
  const background = backgroundCss(slide.background ?? deckBackground);
  return (
    <div
      className="relative mx-auto rounded-2xl border border-border shadow-sm"
      style={{
        width,
        height,
        background,
        color: fontColor,
        fontFamily,
        padding: `${48 * zoom}px ${64 * zoom}px`,
      }}
    >
      <input
        value={slide.title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Slide title"
        className="block w-full border-0 bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:opacity-50"
        style={{ fontSize: `${32 * zoom}px`, color: "inherit" }}
      />
      <input
        value={slide.subtitle ?? ""}
        onChange={(event) => onSubtitleChange(event.target.value)}
        placeholder="Subtitle"
        className="mt-2 block w-full border-0 bg-transparent italic outline-none placeholder:opacity-50"
        style={{ fontSize: `${18 * zoom}px`, color: "inherit" }}
      />
      <div className="mt-4 space-y-2" style={{ marginTop: `${20 * zoom}px` }}>
        {slide.blocks.length === 0 ? (
          <p className="text-xs opacity-60">Use the toolbar to add text, bullets, images, tables or shapes.</p>
        ) : (
          slide.blocks.map((block) => (
            <BlockEditor
              key={block.id}
              block={block}
              zoom={zoom}
              onReplace={(next) => onBlockReplace(block.id, next)}
              onRemove={() => onBlockRemove(block.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface BlockEditorProps {
  block: PresentationBlock;
  zoom: number;
  onReplace: (next: PresentationBlock) => void;
  onRemove: () => void;
}

function BlockEditor({ block, zoom, onReplace, onRemove }: BlockEditorProps) {
  if (block.type === "text") {
    return (
      <div className="group relative">
        <textarea
          value={block.runs.map((run) => run.text).join("")}
          onChange={(event) => onReplace({ id: block.id, type: "text", runs: [{ text: event.target.value }] })}
          rows={Math.max(2, block.runs[0]?.text.split("\n").length ?? 1)}
          className="block w-full resize-none border-0 bg-transparent text-base leading-relaxed outline-none"
          style={{ fontSize: `${18 * zoom}px`, color: "inherit" }}
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 hidden rounded p-0.5 text-[10px] text-muted-foreground hover:bg-accent group-hover:block"
        >
          ✕
        </button>
      </div>
    );
  }
  if (block.type === "bullets") {
    return (
      <div className="group relative">
        <ul className="list-disc space-y-1 pl-6 text-base" style={{ fontSize: `${18 * zoom}px` }}>
          {block.items.map((item, index) => (
            <li key={index}>
              <input
                value={item.map((run) => run.text).join("")}
                onChange={(event) => {
                  const newItems = block.items.map((existing, i) => (i === index ? [{ text: event.target.value }] : existing));
                  onReplace({ id: block.id, type: "bullets", items: newItems });
                }}
                className="block w-full border-0 bg-transparent outline-none"
                style={{ color: "inherit" }}
              />
            </li>
          ))}
        </ul>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onReplace({ id: block.id, type: "bullets", items: [...block.items, [{ text: "New item" }]] })}
            className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
          >
            + item
          </button>
          <button type="button" onClick={onRemove} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent">
            remove
          </button>
        </div>
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <div className="group relative rounded border border-border/40 p-1">
        <img src={block.src} alt={block.alt} className="max-h-48 w-full object-contain" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 hidden rounded p-0.5 text-[10px] text-muted-foreground hover:bg-accent group-hover:block"
        >
          ✕
        </button>
      </div>
    );
  }
  if (block.type === "shape") {
    return (
      <div
        className="group relative"
        style={{
          width: `${block.width}%`,
          height: `${block.height * 2}px`,
          background: block.fill,
          borderRadius: block.kind === "rounded-rectangle" ? 8 : 0,
        }}
      >
        <input
          value={block.text?.[0]?.text ?? ""}
          onChange={(event) =>
            onReplace({
              ...block,
              text: [{ text: event.target.value }],
            })
          }
          className="block h-full w-full border-0 bg-transparent text-center text-base text-white outline-none"
          placeholder="Shape text"
          style={{ color: "#fafafa" }}
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 hidden rounded p-0.5 text-[10px] text-white hover:bg-accent group-hover:block"
        >
          ✕
        </button>
      </div>
    );
  }
  // table
  return (
    <div className="group relative overflow-x-auto rounded border border-border/40">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === 0 && block.header ? "bg-foreground text-background" : ""}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex} className="border border-border/40 p-2">
                  <input
                    value={cell}
                    onChange={(event) => {
                      const newRows = block.rows.map((r, i) =>
                        i === rowIndex ? r.map((c, j) => (j === columnIndex ? event.target.value : c)) : r
                      );
                      onReplace({ ...block, rows: newRows });
                    }}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 hidden rounded p-0.5 text-[10px] text-muted-foreground hover:bg-accent group-hover:block"
      >
        ✕
      </button>
    </div>
  );
}
