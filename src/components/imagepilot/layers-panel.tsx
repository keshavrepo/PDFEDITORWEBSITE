"use client";

/**
 * Layers panel: stacking order, visibility, locking and per-layer blending.
 *
 * Rendered top-most first, the way every layer stack is presented, while the
 * document stores bottom-most first for painter's order. The reversal happens
 * only here so the rest of the system keeps one unambiguous convention.
 */

import { memo, useCallback, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Shapes,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BLEND_MODES, type EditorDocument, type Layer } from "@/lib/imagepilot/core";
import type { EditorAction } from "@/lib/imagepilot/editor-state";
import { PanelSection, SliderField, ToolbarButton } from "./editor-controls";

function LayerIcon({ layer }: { layer: Layer }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (layer.type === "image") return <ImageIcon className={className} aria-hidden="true" />;
  if (layer.type === "text") return <Type className={className} aria-hidden="true" />;
  return <Shapes className={className} aria-hidden="true" />;
}

function LayersPanelImpl({
  document: doc,
  selection,
  dispatch,
}: {
  document: EditorDocument;
  selection: string[];
  dispatch: (action: EditorAction) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Presented newest-on-top; index arithmetic converts back to document order.
  const ordered = [...doc.layers].reverse();
  const hasSelection = selection.length > 0;

  const selectLayer = useCallback(
    (id: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      dispatch({ type: "select", ids: [id], mode: additive ? "toggle" : "replace" });
    },
    [dispatch]
  );

  const commitDrop = useCallback(
    (targetVisualIndex: number) => {
      if (!dragId) return;
      // Convert the visual drop slot back into a document index.
      const documentIndex = doc.layers.length - targetVisualIndex;
      dispatch({ type: "move-layer", id: dragId, index: Math.max(0, documentIndex) });
      setDragId(null);
      setDropIndex(null);
    },
    [dispatch, doc.layers.length, dragId]
  );

  const activeLayer = selection.length === 1
    ? doc.layers.find((layer) => layer.id === selection[0])
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-1 border-b border-border/60 px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Layers
        </span>
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<ChevronsUp className="h-3.5 w-3.5" />}
            label="Bring to front"
            shortcut="Ctrl+Shift+]"
            disabled={!hasSelection}
            onClick={() => dispatch({ type: "reorder-selected", mode: "front" })}
          />
          <ToolbarButton
            icon={<ArrowUp className="h-3.5 w-3.5" />}
            label="Bring forward"
            shortcut="Ctrl+]"
            disabled={!hasSelection}
            onClick={() => dispatch({ type: "reorder-selected", mode: "forward" })}
          />
          <ToolbarButton
            icon={<ArrowDown className="h-3.5 w-3.5" />}
            label="Send backward"
            shortcut="Ctrl+["
            disabled={!hasSelection}
            onClick={() => dispatch({ type: "reorder-selected", mode: "backward" })}
          />
          <ToolbarButton
            icon={<ChevronsDown className="h-3.5 w-3.5" />}
            label="Send to back"
            shortcut="Ctrl+Shift+["
            disabled={!hasSelection}
            onClick={() => dispatch({ type: "reorder-selected", mode: "back" })}
          />
        </div>
      </div>

      {activeLayer && (
        <div className="space-y-2.5 border-b border-border/60 px-3 py-2.5">
          <SliderField
            label="Opacity"
            value={Math.round(activeLayer.opacity * 100)}
            min={0}
            max={100}
            neutral={100}
            unit="%"
            onChange={(value) =>
              dispatch({
                type: "update-layer",
                id: activeLayer.id,
                patch: { opacity: value / 100 },
                label: "Layer opacity",
                mergeKey: `opacity:${activeLayer.id}`,
              })
            }
          />
          <div className="space-y-1">
            <label
              htmlFor="layer-blend-mode"
              className="text-xs font-medium text-muted-foreground"
            >
              Blend mode
            </label>
            <select
              id="layer-blend-mode"
              value={activeLayer.blendMode}
              onChange={(event) =>
                dispatch({
                  type: "update-layer",
                  id: activeLayer.id,
                  patch: { blendMode: event.target.value as Layer["blendMode"] },
                  label: "Blend mode",
                })
              }
              className="h-8 w-full rounded-lg border border-border/60 bg-background px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {!ordered.length && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No layers yet. Import an image or draw a shape to begin.
          </p>
        )}

        <ul className="space-y-0.5">
          {ordered.map((layer, visualIndex) => {
            const selected = selection.includes(layer.id);
            return (
              <li key={layer.id}>
                {dropIndex === visualIndex && dragId && (
                  <div className="mx-1 h-0.5 rounded-full bg-primary" aria-hidden="true" />
                )}
                <div
                  draggable={!renamingId}
                  onDragStart={() => setDragId(layer.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropIndex(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragId) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    // Dropping on the top half inserts above, bottom half below.
                    const above = event.clientY - rect.top < rect.height / 2;
                    setDropIndex(above ? visualIndex : visualIndex + 1);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    commitDrop(dropIndex ?? visualIndex);
                  }}
                  onClick={(event) => selectLayer(layer.id, event)}
                  onDoubleClick={() => {
                    setRenamingId(layer.id);
                    setTimeout(() => renameRef.current?.select(), 0);
                  }}
                  className={cn(
                    "group flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors",
                    selected ? "bg-primary/15 text-foreground" : "hover:bg-accent/60",
                    !layer.visible && "opacity-50",
                    dragId === layer.id && "opacity-40"
                  )}
                >
                  <button
                    type="button"
                    aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                    title={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatch({ type: "toggle-layer-flag", id: layer.id, flag: "visible" });
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {layer.visible ? (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>

                  <LayerIcon layer={layer} />

                  {renamingId === layer.id ? (
                    <input
                      ref={renameRef}
                      defaultValue={layer.name}
                      aria-label="Layer name"
                      onClick={(event) => event.stopPropagation()}
                      onBlur={(event) => {
                        const name = event.target.value.trim();
                        if (name && name !== layer.name) {
                          dispatch({
                            type: "update-layer",
                            id: layer.id,
                            patch: { name },
                            label: "Rename layer",
                          });
                        }
                        setRenamingId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setRenamingId(null);
                        event.stopPropagation();
                      }}
                      className="min-w-0 flex-1 rounded border border-primary bg-background px-1 py-0 text-xs outline-none"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs" title={layer.name}>
                      {layer.name}
                    </span>
                  )}

                  {layer.opacity < 1 && (
                    <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  )}

                  <button
                    type="button"
                    aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                    title={layer.locked ? "Unlock layer" : "Lock layer"}
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatch({ type: "toggle-layer-flag", id: layer.id, flag: "locked" });
                    }}
                    className={cn(
                      "shrink-0 rounded p-0.5 transition-colors",
                      layer.locked
                        ? "text-amber-500"
                        : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                    )}
                  >
                    {layer.locked ? (
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
          {dropIndex === ordered.length && dragId && (
            <li>
              <div className="mx-1 h-0.5 rounded-full bg-primary" aria-hidden="true" />
            </li>
          )}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-1 border-t border-border/60 px-2 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          {doc.layers.length} layer{doc.layers.length === 1 ? "" : "s"}
          {selection.length > 1 && ` · ${selection.length} selected`}
        </span>
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Duplicate layer"
            shortcut="Ctrl+D"
            disabled={!hasSelection}
            onClick={() => dispatch({ type: "duplicate-selected" })}
          />
          <ToolbarButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="Delete layer"
            shortcut="Delete"
            variant="danger"
            disabled={!hasSelection}
            onClick={() => dispatch({ type: "delete-selected" })}
          />
        </div>
      </div>
    </div>
  );
}

/** History list, shown beneath the layers panel. */
function HistoryPanelImpl({
  entries,
  index,
  dispatch,
}: {
  entries: Array<{ label: string; timestamp: number }>;
  index: number;
  dispatch: (action: EditorAction) => void;
}) {
  return (
    <PanelSection title="History" defaultOpen={false}>
      <ol className="max-h-44 space-y-0.5 overflow-y-auto">
        {entries.map((entry, entryIndex) => (
          <li key={`${entry.timestamp}-${entryIndex}`}>
            <button
              type="button"
              onClick={() => dispatch({ type: "history-jump", index: entryIndex })}
              className={cn(
                "w-full truncate rounded px-2 py-1 text-left text-[11px] transition-colors",
                entryIndex === index
                  ? "bg-primary/15 font-medium text-foreground"
                  : entryIndex > index
                    ? "text-muted-foreground/50 hover:bg-accent/60"
                    : "text-muted-foreground hover:bg-accent/60"
              )}
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ol>
    </PanelSection>
  );
}

/*
 * Memoised: the editor re-renders on every pointer move, and these panels
 * depend only on the document, the selection and stable callbacks.
 */
export const LayersPanel = memo(LayersPanelImpl);
export const HistoryPanel = memo(HistoryPanelImpl);
