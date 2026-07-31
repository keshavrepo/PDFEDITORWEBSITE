/**
 * Editor state machine.
 *
 * A single reducer owns the document history, the selection, the active tool
 * and the workspace preferences. Keeping it pure and separate from React means
 * a future ImagePilot tool can drive the same editor with its own chrome, and
 * that the behaviour can be reasoned about without rendering anything.
 *
 * Live drags commit through the history's merge key rather than a separate
 * "working document": one code path, and an interrupted drag can never leave
 * the document and the history out of step.
 */

import { DEFAULT_GRID_SIZE } from "./constants";
import {
  addLayer,
  alignLayers,
  cloneDocument,
  createDocument,
  duplicateLayers,
  moveLayerToIndex,
  removeLayers,
  reorderLayers,
  updateLayer,
  updateLayers,
  type AlignMode,
  type ReorderMode,
} from "./document";
import {
  canRedo,
  canUndo,
  createHistory,
  currentDocument,
  jumpTo,
  pushHistory,
  redo,
  resetHistory,
  undo,
  type HistoryState,
} from "./history";
import { fitToViewport, type Viewport } from "./geometry";
import type {
  EditorDocument,
  EditorToolId,
  Layer,
  Rect,
  SelectionRect,
} from "./types";

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

export interface WorkspaceSettings {
  showGrid: boolean;
  showRulers: boolean;
  snapEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  /** Chequerboard behind the canvas so transparency is visible. */
  showTransparency: boolean;
  /** Dark workspace chrome, the default for an image editor. */
  darkWorkspace: boolean;
}

export interface EditorState {
  history: HistoryState;
  /** Layer ids, in selection order. */
  selection: string[];
  tool: EditorToolId;
  viewport: Viewport;
  settings: WorkspaceSettings;
  /** Active crop rectangle, in document space. Null when not cropping. */
  crop: Rect | null;
  /** Rectangular pixel selection produced by the marquee tool. */
  marquee: SelectionRect | null;
  /** Layer currently being edited inline. */
  editingTextId: string | null;
  /** Transient message shown in the status bar. */
  status: { message: string; tone: "info" | "error" } | null;
}

export const defaultSettings: WorkspaceSettings = {
  showGrid: false,
  showRulers: true,
  snapEnabled: true,
  snapToGrid: false,
  gridSize: DEFAULT_GRID_SIZE,
  showTransparency: true,
  darkWorkspace: true,
};

export function createEditorState(document?: EditorDocument): EditorState {
  const doc = document ?? createDocument(1200, 800);
  return {
    history: createHistory(doc, "New document"),
    selection: [],
    tool: "move",
    viewport: fitToViewport(doc, 1000, 700),
    settings: { ...defaultSettings },
    crop: null,
    marquee: null,
    editingTextId: null,
    status: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

export type EditorAction =
  /** Replaces the document and records a history step. */
  | { type: "commit"; document: EditorDocument; label: string; mergeKey?: string }
  /** Replaces the whole document, resetting history (open / new). */
  | { type: "load"; document: EditorDocument; label: string; viewport?: Viewport }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "history-jump"; index: number }
  | { type: "select"; ids: string[]; mode?: "replace" | "add" | "toggle" }
  | { type: "select-all" }
  | { type: "deselect" }
  | { type: "set-tool"; tool: EditorToolId }
  | { type: "set-viewport"; viewport: Viewport }
  | { type: "set-setting"; key: keyof WorkspaceSettings; value: boolean | number }
  | { type: "set-crop"; rect: Rect | null }
  | { type: "set-marquee"; rect: SelectionRect | null }
  | { type: "edit-text"; id: string | null }
  | { type: "status"; message: string | null; tone?: "info" | "error" }
  /* Document edits routed through the reducer so history stays consistent. */
  | { type: "add-layer"; layer: Layer; select?: boolean }
  | { type: "update-layer"; id: string; patch: Partial<Layer>; label: string; mergeKey?: string }
  | { type: "update-selected"; patch: (layer: Layer) => Partial<Layer>; label: string; mergeKey?: string }
  | { type: "delete-selected" }
  | { type: "duplicate-selected" }
  | { type: "reorder-selected"; mode: ReorderMode }
  | { type: "move-layer"; id: string; index: number }
  | { type: "align-selected"; mode: AlignMode }
  | { type: "toggle-layer-flag"; id: string; flag: "visible" | "locked" };

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function selectedLayers(state: EditorState): Layer[] {
  const doc = currentDocument(state.history);
  const order = new Map(state.selection.map((id, index) => [id, index]));
  return doc.layers
    .filter((layer) => order.has(layer.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** The single selected layer, or null when zero or several are selected. */
export function activeLayer(state: EditorState): Layer | null {
  if (state.selection.length !== 1) return null;
  return currentDocument(state.history).layers.find((l) => l.id === state.selection[0]) ?? null;
}

export function editorDocument(state: EditorState): EditorDocument {
  return currentDocument(state.history);
}

export function editorCanUndo(state: EditorState): boolean {
  return canUndo(state.history);
}

export function editorCanRedo(state: EditorState): boolean {
  return canRedo(state.history);
}

/** Drops ids that no longer exist, e.g. after an undo removed their layer. */
function pruneSelection(selection: string[], doc: EditorDocument): string[] {
  const live = new Set(doc.layers.map((layer) => layer.id));
  const next = selection.filter((id) => live.has(id));
  return next.length === selection.length ? selection : next;
}

/** Commits a document and keeps the derived state consistent. */
function commit(
  state: EditorState,
  document: EditorDocument,
  label: string,
  mergeKey?: string
): EditorState {
  const history = pushHistory(state.history, document, label, mergeKey);
  return {
    ...state,
    history,
    selection: pruneSelection(state.selection, document),
  };
}

/* -------------------------------------------------------------------------- */
/* Reducer                                                                    */
/* -------------------------------------------------------------------------- */

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "commit":
      return commit(state, action.document, action.label, action.mergeKey);

    case "load": {
      return {
        ...state,
        history: resetHistory(action.document, action.label),
        selection: [],
        crop: null,
        marquee: null,
        editingTextId: null,
        viewport: action.viewport ?? state.viewport,
        status: null,
      };
    }

    case "undo": {
      if (!canUndo(state.history)) return state;
      const history = undo(state.history);
      return {
        ...state,
        history,
        selection: pruneSelection(state.selection, currentDocument(history)),
        // An inline text edit cannot survive its layer moving underneath it.
        editingTextId: null,
      };
    }

    case "redo": {
      if (!canRedo(state.history)) return state;
      const history = redo(state.history);
      return {
        ...state,
        history,
        selection: pruneSelection(state.selection, currentDocument(history)),
        editingTextId: null,
      };
    }

    case "history-jump": {
      const history = jumpTo(state.history, action.index);
      return {
        ...state,
        history,
        selection: pruneSelection(state.selection, currentDocument(history)),
        editingTextId: null,
      };
    }

    case "select": {
      const mode = action.mode ?? "replace";
      if (mode === "replace") {
        return { ...state, selection: action.ids, editingTextId: null };
      }
      if (mode === "add") {
        const set = new Set(state.selection);
        for (const id of action.ids) set.add(id);
        return { ...state, selection: [...set] };
      }
      // Toggle: shift-clicking an already selected layer removes it.
      const set = new Set(state.selection);
      for (const id of action.ids) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      }
      return { ...state, selection: [...set] };
    }

    case "select-all":
      return {
        ...state,
        selection: editorDocument(state)
          .layers.filter((layer) => !layer.locked && layer.visible)
          .map((layer) => layer.id),
      };

    case "deselect":
      return { ...state, selection: [], marquee: null, editingTextId: null };

    case "set-tool": {
      // Leaving the crop tool abandons an in-progress crop rather than
      // silently keeping it armed.
      const crop = action.tool === "crop" ? state.crop : null;
      const marquee = action.tool === "select" ? state.marquee : null;
      return { ...state, tool: action.tool, crop, marquee, editingTextId: null };
    }

    case "set-viewport":
      return { ...state, viewport: action.viewport };

    case "set-setting":
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    case "set-crop":
      return { ...state, crop: action.rect };

    case "set-marquee":
      return { ...state, marquee: action.rect };

    case "edit-text":
      return { ...state, editingTextId: action.id };

    case "status":
      return {
        ...state,
        status: action.message ? { message: action.message, tone: action.tone ?? "info" } : null,
      };

    case "add-layer": {
      const doc = addLayer(editorDocument(state), action.layer);
      // `addLayer` may rename for uniqueness, so read the id back from the
      // document rather than trusting the input object.
      const added = doc.layers[doc.layers.length - 1];
      const next = commit(state, doc, `Add ${added.name}`);
      return action.select === false ? next : { ...next, selection: [added.id] };
    }

    case "update-layer":
      return commit(
        state,
        updateLayer(editorDocument(state), action.id, action.patch),
        action.label,
        action.mergeKey
      );

    case "update-selected": {
      if (!state.selection.length) return state;
      return commit(
        state,
        updateLayers(editorDocument(state), state.selection, action.patch),
        action.label,
        action.mergeKey
      );
    }

    case "delete-selected": {
      if (!state.selection.length) return state;
      const doc = editorDocument(state);
      const removable = state.selection.filter(
        (id) => !doc.layers.find((layer) => layer.id === id)?.locked
      );
      if (!removable.length) {
        return {
          ...state,
          status: { message: "Unlock the layer before deleting it.", tone: "error" },
        };
      }
      const next = commit(state, removeLayers(doc, removable), "Delete layer");
      return { ...next, selection: [], editingTextId: null };
    }

    case "duplicate-selected": {
      if (!state.selection.length) return state;
      const { document, newIds } = duplicateLayers(editorDocument(state), state.selection);
      const next = commit(state, document, "Duplicate layer");
      return { ...next, selection: newIds };
    }

    case "reorder-selected": {
      if (!state.selection.length) return state;
      return commit(
        state,
        reorderLayers(editorDocument(state), state.selection, action.mode),
        "Reorder layers"
      );
    }

    case "move-layer":
      return commit(
        state,
        moveLayerToIndex(editorDocument(state), action.id, action.index),
        "Reorder layers"
      );

    case "align-selected": {
      if (!state.selection.length) return state;
      return commit(
        state,
        alignLayers(editorDocument(state), state.selection, action.mode),
        "Align layers"
      );
    }

    case "toggle-layer-flag": {
      const doc = editorDocument(state);
      const layer = doc.layers.find((entry) => entry.id === action.id);
      if (!layer) return state;
      const value = !layer[action.flag];
      const next = commit(
        state,
        updateLayer(doc, action.id, { [action.flag]: value } as Partial<Layer>),
        value ? `Show ${layer.name}` : `Hide ${layer.name}`
      );
      // A layer that has just been hidden or locked should not stay selected
      // and editable behind the user's back.
      if (action.flag === "visible" && !value) {
        return { ...next, selection: next.selection.filter((id) => id !== action.id) };
      }
      return next;
    }

    default:
      return state;
  }
}

export { cloneDocument, currentDocument };
