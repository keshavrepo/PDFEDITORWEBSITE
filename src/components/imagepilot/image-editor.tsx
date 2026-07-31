"use client";

/**
 * ImagePilot editor shell.
 *
 * Owns the reducer, the raster store, the keyboard map, file import/export and
 * the dialogs, and arranges the tool rail, workspace and inspector. The editing
 * logic itself lives in `@/lib/imagepilot`, so this component stays a host: a
 * future ImagePilot tool can mount the same core with different chrome.
 *
 * Everything runs in the browser — images are never uploaded, matching how
 * PDFPilot handles documents.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  Check,
  Crop as CropIcon,
  Download,
  FlipHorizontal,
  FlipVertical,
  Grid3x3,
  Hand,
  ImagePlus,
  Keyboard,
  Layers as LayersIcon,
  Loader2,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  PanelRight,
  Plus,
  Redo2,
  Ruler,
  Scaling,
  Slash,
  Sparkles,
  SquareDashed,
  Star,
  Type,
  Undo2,
  X,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CROP_RATIOS,
  EDITOR_TOOLS,
  EXPORT_FORMATS,
  IMPORT_ACCEPT,
  MAX_CANVAS_DIMENSION,
  SHORTCUT_REFERENCE,
  centerAtZoom,
  clampExportScale,
  composite,
  contentBounds,
  createDocument,
  createImageLayer,
  cropDocument,
  documentToSvg,
  exportFileName,
  fitToViewport,
  flipDocument,
  formatDescriptor,
  resizeDocument,
  rotateDocument,
  stepZoom,
  zoomAtPoint,
  type EditorDocument,
  type EditorToolId,
  type ExportFormat,
  type Layer,
} from "@/lib/imagepilot/core";
import {
  RasterStore,
  browserCanvasFactory,
  canvasToBlob,
  canvasToDataUrl,
  decodeImage,
  downloadBlob,
  imagesFromDataTransfer,
  readClipboardImage,
  validateImageFile,
  writeClipboardImage,
} from "@/lib/imagepilot/raster";
import {
  activeLayer as pickActiveLayer,
  createEditorState,
  editorCanRedo,
  editorCanUndo,
  editorDocument,
  editorReducer,
  selectedLayers,
} from "@/lib/imagepilot/editor-state";
import { recordActivity } from "@/lib/platform/record-activity";
import { EditorCanvas } from "./editor-canvas";
import { HistoryPanel, LayersPanel } from "./layers-panel";
import { PropertiesPanel } from "./properties-panel";
import { AdjustmentsPanel } from "./adjustments-panel";
import { NumberField, SegmentedControl, SliderField, ToggleField, ToolbarButton } from "./editor-controls";

/** Icons for the tool rail, keyed by tool id. */
const TOOL_ICONS: Record<EditorToolId, React.ReactNode> = {
  move: <MousePointer2 className="h-4 w-4" />,
  select: <SquareDashed className="h-4 w-4" />,
  crop: <CropIcon className="h-4 w-4" />,
  text: <Type className="h-4 w-4" />,
  rectangle: <span className="block h-3.5 w-3.5 rounded-[3px] border-2 border-current" />,
  ellipse: <span className="block h-3.5 w-3.5 rounded-full border-2 border-current" />,
  line: <Slash className="h-4 w-4" />,
  arrow: <ArrowUpRight className="h-4 w-4" />,
  polygon: <span className="block h-3.5 w-3.5 rotate-90 border-2 border-current [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />,
  star: <Star className="h-4 w-4" />,
  hand: <Hand className="h-4 w-4" />,
  zoom: <ZoomIn className="h-4 w-4" />,
};

type Dialog = "none" | "export" | "resize" | "shortcuts" | "new";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

export function ImageEditor() {
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    createEditorState(createDocument(1200, 800, { name: "Untitled" }))
  );
  /**
   * Bitmap store for every imported image.
   *
   * Held in state rather than a ref because the renderer reads it during
   * render. The instance itself never changes — the lazy initialiser runs
   * once — so this costs nothing; mutations are signalled through
   * `rasterVersion` instead.
   */
  const [rasters] = useState(() => new RasterStore());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importModeRef = useRef<"layer" | "document">("layer");

  const [rasterVersion, setRasterVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog>("none");
  const [busy, setBusy] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [cropRatio, setCropRatio] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<"properties" | "adjust">("properties");
  /** Inspector visibility on small screens, where it overlays the canvas. */
  const [panelOpen, setPanelOpen] = useState(false);

  const doc = editorDocument(state);
  const selected = useMemo(() => selectedLayers(state), [state]);
  const activeLayer = useMemo(() => pickActiveLayer(state), [state]);
  const canUndo = editorCanUndo(state);
  const canRedo = editorCanRedo(state);

  /* ---------------------------------------------------------------------- */
  /* Status messages                                                        */
  /* ---------------------------------------------------------------------- */

  const notify = useCallback(
    (message: string, tone: "info" | "error" = "info") => {
      dispatch({ type: "status", message, tone });
    },
    []
  );

  useEffect(() => {
    if (!state.status) return;
    const timer = setTimeout(() => dispatch({ type: "status", message: null }), 4000);
    return () => clearTimeout(timer);
  }, [state.status]);

  /* ---------------------------------------------------------------------- */
  /* Importing                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Adds images to the document.
   *
   * The first import into an empty document resizes the canvas to match, which
   * is what someone opening a photo expects; later imports are placed as
   * layers scaled to fit.
   */
  const importFiles = useCallback(
    async (files: File[], mode: "layer" | "document" = "layer") => {
      if (!files.length) return;
      setBusy(`Importing ${files.length} image${files.length === 1 ? "" : "s"}…`);

      try {
        let workingDoc = editorDocument(state);
        const newIds: string[] = [];
        let failures = 0;
        // A brand-new, empty document adopts the first image's dimensions.
        let adoptSize = mode === "document" || workingDoc.layers.length === 0;

        for (const file of files) {
          const problem = validateImageFile(file);
          if (problem) {
            notify(problem, "error");
            failures += 1;
            continue;
          }

          let decoded;
          try {
            decoded = await decodeImage(file);
          } catch {
            notify(`${file.name} could not be decoded.`, "error");
            failures += 1;
            continue;
          }

          const sourceId = `raster_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          rasters.set({
            id: sourceId,
            width: decoded.width,
            height: decoded.height,
            image: decoded.image,
          });

          if (adoptSize) {
            workingDoc = {
              ...createDocument(decoded.width, decoded.height, {
                name: file.name.replace(/\.[^.]+$/, ""),
                background: null,
              }),
              layers: workingDoc.layers,
            };
            adoptSize = false;
          }

          // Scale down to fit while leaving smaller images at native size.
          const fit = Math.min(
            1,
            workingDoc.width / decoded.width,
            workingDoc.height / decoded.height
          );
          const width = decoded.width * fit;
          const height = decoded.height * fit;

          const layer = createImageLayer(
            file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Image",
            sourceId,
            {
              x: (workingDoc.width - width) / 2,
              y: (workingDoc.height - height) / 2,
              width,
              height,
            },
            { width: decoded.width, height: decoded.height }
          );

          workingDoc = { ...workingDoc, layers: [...workingDoc.layers, layer] };
          newIds.push(layer.id);
        }

        if (!newIds.length) {
          if (!failures) notify("No images were imported.", "error");
          return;
        }

        setRasterVersion((version) => version + 1);
        dispatch({
          type: "commit",
          document: workingDoc,
          label: newIds.length === 1 ? "Import image" : `Import ${newIds.length} images`,
        });
        dispatch({ type: "select", ids: newIds });
        notify(`Imported ${newIds.length} image${newIds.length === 1 ? "" : "s"}.`);
      } finally {
        setBusy(null);
      }
    },
    [notify, rasters, state]
  );

  /* ---------------------------------------------------------------------- */
  /* Fit to window                                                          */
  /* ---------------------------------------------------------------------- */

  const workspaceRef = useRef<HTMLDivElement>(null);

  const fitToWindow = useCallback(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const inset = state.settings.showRulers ? 20 : 0;
    dispatch({
      type: "set-viewport",
      viewport: fitToViewport(
        editorDocument(state),
        Math.max(1, rect.width - inset),
        Math.max(1, rect.height - inset)
      ),
    });
  }, [state]);

  const zoomTo100 = useCallback(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const inset = state.settings.showRulers ? 20 : 0;
    dispatch({
      type: "set-viewport",
      viewport: centerAtZoom(
        editorDocument(state),
        Math.max(1, rect.width - inset),
        Math.max(1, rect.height - inset),
        1
      ),
    });
  }, [state]);

  // Fit once the workspace has been measured, so the initial view is sensible
  // rather than an arbitrary default.
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current) return;
    const element = workspaceRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width < 10) return;
    didInitialFit.current = true;
    fitToWindow();
  }, [fitToWindow]);

  const zoomBy = useCallback(
    (direction: 1 | -1) => {
      const element = workspaceRef.current;
      const rect = element?.getBoundingClientRect();
      const centerX = rect ? rect.width / 2 : 400;
      const centerY = rect ? rect.height / 2 : 300;
      dispatch({
        type: "set-viewport",
        viewport: zoomAtPoint(
          state.viewport,
          stepZoom(state.viewport.zoom, direction),
          centerX,
          centerY
        ),
      });
    },
    [state.viewport]
  );

  /* ---------------------------------------------------------------------- */
  /* Canvas operations                                                      */
  /* ---------------------------------------------------------------------- */

  const applyCrop = useCallback(() => {
    if (!state.crop || state.crop.width < 1 || state.crop.height < 1) {
      notify("Draw a crop area first.", "error");
      return;
    }
    dispatch({ type: "commit", document: cropDocument(doc, state.crop), label: "Crop canvas" });
    dispatch({ type: "set-crop", rect: null });
    dispatch({ type: "set-tool", tool: "move" });
    setTimeout(fitToWindow, 0);
    notify("Canvas cropped.");
  }, [doc, fitToWindow, notify, state.crop]);

  const cropToContent = useCallback(() => {
    const bounds = contentBounds(doc);
    dispatch({ type: "set-crop", rect: bounds });
    dispatch({ type: "set-tool", tool: "crop" });
  }, [doc]);

  /* ---------------------------------------------------------------------- */
  /* Clipboard                                                              */
  /* ---------------------------------------------------------------------- */

  /** Layer stashed by copy/cut. Kept in a ref so it survives re-renders. */
  const clipboardRef = useRef<Layer[]>([]);

  const copySelection = useCallback(
    async (cut: boolean) => {
      if (!selected.length) return;
      clipboardRef.current = selected.map((layer) => ({
        ...layer,
        adjustments: { ...layer.adjustments },
      }));

      // Also place a flat bitmap on the system clipboard so the selection can
      // be pasted into other applications.
      try {
        const bounds = selected.reduce(
          (acc, layer) => ({
            x: Math.min(acc.x, layer.x),
            y: Math.min(acc.y, layer.y),
            right: Math.max(acc.right, layer.x + layer.width),
            bottom: Math.max(acc.bottom, layer.y + layer.height),
          }),
          { x: Infinity, y: Infinity, right: -Infinity, bottom: -Infinity }
        );
        const region = {
          x: Math.max(0, bounds.x),
          y: Math.max(0, bounds.y),
          width: Math.max(1, Math.min(doc.width, bounds.right) - Math.max(0, bounds.x)),
          height: Math.max(1, Math.min(doc.height, bounds.bottom) - Math.max(0, bounds.y)),
        };
        const rendered = composite(
          { ...doc, layers: selected },
          rasters,
          browserCanvasFactory,
          { region, transparent: true }
        );
        const blob = await canvasToBlob(rendered.canvas, "image/png");
        await writeClipboardImage(blob);
      } catch {
        // The in-app clipboard still works even when the system one refuses.
      }

      if (cut) dispatch({ type: "delete-selected" });
      notify(cut ? "Cut to clipboard." : "Copied to clipboard.");
    },
    [doc, notify, rasters, selected]
  );

  const pasteLayers = useCallback(async () => {
    // Prefer an image sitting on the system clipboard.
    const blob = await readClipboardImage();
    if (blob) {
      await importFiles([new File([blob], "Pasted image.png", { type: blob.type })]);
      return;
    }

    if (!clipboardRef.current.length) {
      notify("Nothing to paste.", "error");
      return;
    }

    let working = doc;
    const newIds: string[] = [];
    for (const layer of clipboardRef.current) {
      const copy: Layer = {
        ...layer,
        id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `${layer.name} copy`,
        x: layer.x + 20,
        y: layer.y + 20,
        locked: false,
      };
      working = { ...working, layers: [...working.layers, copy] };
      newIds.push(copy.id);
    }

    dispatch({ type: "commit", document: working, label: "Paste" });
    dispatch({ type: "select", ids: newIds });
    notify(`Pasted ${newIds.length} layer${newIds.length === 1 ? "" : "s"}.`);
  }, [doc, importFiles, notify]);

  /* ---------------------------------------------------------------------- */
  /* Export                                                                 */
  /* ---------------------------------------------------------------------- */

  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(92);
  const [exportScale, setExportScale] = useState(1);
  const [exportTransparent, setExportTransparent] = useState(false);
  const [exportName, setExportName] = useState("imagepilot-export");

  const runExport = useCallback(async () => {
    const descriptor = formatDescriptor(exportFormat);
    setBusy("Preparing export…");

    try {
      const fileName = exportFileName(exportName || doc.name, exportFormat);
      let blob: Blob;

      if (exportFormat === "svg") {
        // Bitmap layers are embedded as data URIs; shapes and text stay vector.
        const hrefs = new Map<string, string>();
        for (const layer of doc.layers) {
          if (layer.type !== "image" || !layer.visible) continue;
          const source = rasters.get(layer.sourceId);
          if (!source) continue;
          const buffer = browserCanvasFactory.create(source.width, source.height);
          buffer.ctx.drawImage(source.image, 0, 0, source.width, source.height);
          hrefs.set(layer.id, await canvasToDataUrl(buffer.canvas, "image/png"));
        }
        const measure = browserCanvasFactory.create(8, 8).ctx;
        const svg = documentToSvg(doc, hrefs, measure, {
          transparent: exportTransparent && descriptor.supportsAlpha,
        });
        blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      } else {
        const scale = clampExportScale(doc, undefined, exportScale);
        const rendered = composite(doc, rasters, browserCanvasFactory, {
          scale,
          // JPEG has no alpha, so transparency is always flattened onto white.
          transparent: descriptor.supportsAlpha && exportTransparent,
          matte: "#ffffff",
        });
        blob = await canvasToBlob(
          rendered.canvas,
          descriptor.mimeType,
          descriptor.supportsQuality ? exportQuality / 100 : undefined
        );
      }

      downloadBlob(blob, fileName);
      setDialog("none");
      notify(`Exported ${fileName} (${formatBytes(blob.size)}).`);

      // Report to the platform so the file manager, activity timeline and
      // dashboard statistics stay accurate. Best-effort and never blocking.
      void recordActivity({
        productId: "imagepilot",
        toolName: "Image Editor",
        fileName,
        fileSize: blob.size,
        mimeType: descriptor.mimeType,
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "The image could not be exported.",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }, [
    doc,
    exportFormat,
    exportName,
    exportQuality,
    exportScale,
    exportTransparent,
    notify,
    rasters,
  ]);

  /**
   * Opens the export dialog, seeding the file name from the document.
   *
   * Done in the handler rather than an effect so the name is set once, at the
   * moment the dialog opens, instead of being reset on every render while it
   * is open — which would discard whatever the user had typed.
   */
  const openExportDialog = useCallback(() => {
    setExportName(doc.name || "imagepilot-export");
    setDialog("export");
  }, [doc.name]);

  /* ---------------------------------------------------------------------- */
  /* Keyboard                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal keys from a field the user is typing in.
      if (target?.matches("input, textarea, select, [contenteditable='true']")) {
        if (event.key === "Escape") target.blur();
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod) {
        switch (key) {
          case "z":
            event.preventDefault();
            dispatch({ type: event.shiftKey ? "redo" : "undo" });
            return;
          case "y":
            event.preventDefault();
            dispatch({ type: "redo" });
            return;
          case "c":
            event.preventDefault();
            void copySelection(false);
            return;
          case "x":
            event.preventDefault();
            void copySelection(true);
            return;
          case "v":
            event.preventDefault();
            void pasteLayers();
            return;
          case "d":
            event.preventDefault();
            dispatch({ type: "duplicate-selected" });
            return;
          case "a":
            event.preventDefault();
            dispatch({ type: "select-all" });
            return;
          case "s":
            event.preventDefault();
            openExportDialog();
            return;
          case "o":
            event.preventDefault();
            importModeRef.current = "layer";
            fileInputRef.current?.click();
            return;
          case "0":
            event.preventDefault();
            fitToWindow();
            return;
          case "1":
            event.preventDefault();
            zoomTo100();
            return;
          case "=":
          case "+":
            event.preventDefault();
            zoomBy(1);
            return;
          case "-":
            event.preventDefault();
            zoomBy(-1);
            return;
          case "]":
            event.preventDefault();
            dispatch({ type: "reorder-selected", mode: event.shiftKey ? "front" : "forward" });
            return;
          case "[":
            event.preventDefault();
            dispatch({ type: "reorder-selected", mode: event.shiftKey ? "back" : "backward" });
            return;
          default:
            return;
        }
      }

      if (event.altKey) return;

      // Nudging.
      if (event.key.startsWith("Arrow")) {
        if (!state.selection.length) return;
        event.preventDefault();
        const distance = event.shiftKey ? 10 : 1;
        const deltaX =
          event.key === "ArrowLeft" ? -distance : event.key === "ArrowRight" ? distance : 0;
        const deltaY =
          event.key === "ArrowUp" ? -distance : event.key === "ArrowDown" ? distance : 0;
        dispatch({
          type: "update-selected",
          patch: (layer) => ({ x: layer.x + deltaX, y: layer.y + deltaY }),
          label: "Nudge layer",
          mergeKey: "nudge",
        });
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!state.selection.length) return;
        event.preventDefault();
        dispatch({ type: "delete-selected" });
        return;
      }

      if (event.key === "Escape") {
        if (state.crop) dispatch({ type: "set-crop", rect: null });
        else if (dialog !== "none") setDialog("none");
        else dispatch({ type: "deselect" });
        return;
      }

      if (event.key === "Enter" && state.tool === "crop" && state.crop) {
        event.preventDefault();
        applyCrop();
        return;
      }

      // View toggles, all on shift so single letters stay free for tools.
      if (event.shiftKey) {
        const toggles: Record<string, "showGrid" | "showRulers" | "snapEnabled"> = {
          g: "showGrid",
          r: "showRulers",
          s: "snapEnabled",
        };
        const setting = toggles[key];
        if (setting) {
          event.preventDefault();
          dispatch({ type: "set-setting", key: setting, value: !state.settings[setting] });
          return;
        }
      }

      if (key === "?") {
        event.preventDefault();
        setDialog("shortcuts");
        return;
      }

      const tool = EDITOR_TOOLS.find((entry) => entry.shortcut.toLowerCase() === key);
      if (tool) {
        event.preventDefault();
        dispatch({ type: "set-tool", tool: tool.id });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    applyCrop,
    copySelection,
    dialog,
    fitToWindow,
    openExportDialog,
    pasteLayers,
    state.crop,
    state.selection.length,
    state.settings,
    state.tool,
    zoomBy,
    zoomTo100,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Paste and drop on the document                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      const files = imagesFromDataTransfer(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      void importFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importFiles]);

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                              */
  /* ---------------------------------------------------------------------- */

  const zoomPercent = Math.round(state.viewport.zoom * 100);

  return (
    <div
      className="flex h-full min-h-[520px] w-full flex-col overflow-hidden bg-background"
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes("Files")) setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        const files = imagesFromDataTransfer(event.dataTransfer);
        if (files.length) void importFiles(files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        multiple
        aria-label="Import images"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) void importFiles(files, importModeRef.current);
        }}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Top toolbar                                                      */}
      {/* ---------------------------------------------------------------- */}
      <header className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => {
            importModeRef.current = "layer";
            fileInputRef.current?.click();
          }}
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          Import
        </Button>

        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        <ToolbarButton
          icon={<Undo2 className="h-4 w-4" />}
          label="Undo"
          shortcut="Ctrl+Z"
          disabled={!canUndo}
          onClick={() => dispatch({ type: "undo" })}
        />
        <ToolbarButton
          icon={<Redo2 className="h-4 w-4" />}
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          disabled={!canRedo}
          onClick={() => dispatch({ type: "redo" })}
        />

        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        {/* Canvas-wide transforms */}
        <ToolbarButton
          icon={<Scaling className="h-4 w-4" />}
          label="Resize canvas"
          onClick={() => setDialog("resize")}
        />
        <ToolbarButton
          icon={<CropIcon className="h-4 w-4" />}
          label="Crop to content"
          onClick={cropToContent}
        />
        <ToolbarButton
          icon={<Undo2 className="h-4 w-4 -scale-x-100" />}
          label="Rotate canvas 90°"
          onClick={() => {
            dispatch({ type: "commit", document: rotateDocument(doc, 1), label: "Rotate canvas" });
            setTimeout(fitToWindow, 0);
          }}
        />
        <ToolbarButton
          icon={<FlipHorizontal className="h-4 w-4" />}
          label="Flip canvas horizontally"
          onClick={() =>
            dispatch({
              type: "commit",
              document: flipDocument(doc, "horizontal"),
              label: "Flip canvas",
            })
          }
        />
        <ToolbarButton
          icon={<FlipVertical className="h-4 w-4" />}
          label="Flip canvas vertically"
          onClick={() =>
            dispatch({
              type: "commit",
              document: flipDocument(doc, "vertical"),
              label: "Flip canvas",
            })
          }
        />

        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        {/* View toggles */}
        <ToolbarButton
          icon={<Ruler className="h-4 w-4" />}
          label="Toggle rulers"
          shortcut="Shift+R"
          active={state.settings.showRulers}
          onClick={() =>
            dispatch({ type: "set-setting", key: "showRulers", value: !state.settings.showRulers })
          }
        />
        <ToolbarButton
          icon={<Grid3x3 className="h-4 w-4" />}
          label="Toggle grid"
          shortcut="Shift+G"
          active={state.settings.showGrid}
          onClick={() =>
            dispatch({ type: "set-setting", key: "showGrid", value: !state.settings.showGrid })
          }
        />
        <ToolbarButton
          icon={<Magnet className="h-4 w-4" />}
          label="Toggle snapping"
          shortcut="Shift+S"
          active={state.settings.snapEnabled}
          onClick={() =>
            dispatch({ type: "set-setting", key: "snapEnabled", value: !state.settings.snapEnabled })
          }
        />

        <div className="ml-auto flex items-center gap-1">
          {/* Only reachable below `lg`, where the inspector is a drawer. */}
          <div className="lg:hidden">
            <ToolbarButton
              icon={<PanelRight className="h-4 w-4" />}
              label="Toggle layers and properties"
              active={panelOpen}
              onClick={() => setPanelOpen((open) => !open)}
            />
          </div>
          <ToolbarButton
            icon={<Keyboard className="h-4 w-4" />}
            label="Keyboard shortcuts"
            shortcut="?"
            onClick={() => setDialog("shortcuts")}
          />
          <Button size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={openExportDialog}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </Button>
        </div>
      </header>

      {/* Crop bar, shown only while cropping */}
      {state.tool === "crop" && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-3 py-1.5">
          <span className="text-xs font-medium">Crop</span>
          <div className="flex flex-wrap items-center gap-1">
            {CROP_RATIOS.map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => setCropRatio(entry.ratio)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  cropRatio === entry.ratio
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {state.crop && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(state.crop.width)} × {Math.round(state.crop.height)} px
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                dispatch({ type: "set-crop", rect: null });
                dispatch({ type: "set-tool", tool: "move" });
              }}
            >
              Cancel
            </Button>
            <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={applyCrop}>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Apply
            </Button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative flex min-h-0 flex-1">
        {/* Tool rail */}
        <nav
          aria-label="Editor tools"
          className="flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-border bg-card py-2"
        >
          {EDITOR_TOOLS.map((tool, index) => (
            <div key={tool.id} className="contents">
              {index > 0 && EDITOR_TOOLS[index - 1].group !== tool.group && (
                <div className="my-1 h-px w-6 bg-border" aria-hidden="true" />
              )}
              <button
                type="button"
                aria-label={`${tool.label} tool`}
                aria-pressed={state.tool === tool.id}
                title={`${tool.label} — ${tool.hint} (${tool.shortcut})`}
                onClick={() => dispatch({ type: "set-tool", tool: tool.id })}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  state.tool === tool.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {TOOL_ICONS[tool.id]}
              </button>
            </div>
          ))}
        </nav>

        {/* Workspace */}
        <main ref={workspaceRef} className="relative min-w-0 flex-1">
          <EditorCanvas
            state={state}
            document={doc}
            rasters={rasters}
            dispatch={dispatch}
            rasterVersion={rasterVersion}
            cropRatio={cropRatio}
            onRequestTextEdit={(id) => dispatch({ type: "edit-text", id })}
          />

          {/* Empty state */}
          {!doc.layers.length && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-2xl border border-border/60 bg-card/95 p-6 text-center shadow-lg backdrop-blur">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <ImagePlus className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <h2 className="mb-1.5 font-semibold">Start editing</h2>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  Drop an image anywhere, paste from the clipboard, or add text and shapes with
                  the tools on the left. Everything stays on your device.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    importModeRef.current = "document";
                    fileInputRef.current?.click();
                  }}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Choose an image
                </Button>
              </div>
            </div>
          )}

          {/* Drop overlay */}
          {dragActive && (
            <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10">
              <p className="rounded-lg bg-background px-3 py-1.5 text-sm font-medium shadow">
                Drop images to add them as layers
              </p>
            </div>
          )}

          {/* Busy indicator */}
          {busy && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-background/95 px-3 py-1.5 text-xs shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
              {busy}
            </div>
          )}
        </main>

        {/*
          Right inspector.

          On a phone a permanent 256px column would leave almost no canvas, so
          below `lg` it becomes an overlay drawer toggled from the toolbar.
          Above `lg` it is a normal docked column.
        */}
        {panelOpen && (
          <button
            type="button"
            aria-label="Close panels"
            onClick={() => setPanelOpen(false)}
            className="absolute inset-0 z-20 bg-black/40 lg:hidden"
          />
        )}
        <aside
          aria-label="Layer properties"
          className={cn(
            "z-30 flex w-64 shrink-0 flex-col border-l border-border bg-card xl:w-72",
            "max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:shadow-2xl",
            panelOpen ? "max-lg:flex" : "max-lg:hidden"
          )}
        >
          <div className="flex shrink-0 items-stretch border-b border-border/60">
            {(
              [
                { id: "properties" as const, label: "Properties", icon: <LayersIcon className="h-3.5 w-3.5" /> },
                { id: "adjust" as const, label: "Adjust", icon: <Sparkles className="h-3.5 w-3.5" /> },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={rightTab === tab.id}
                onClick={() => setRightTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium transition-colors",
                  rightTab === tab.id
                    ? "border-b-2 border-primary text-foreground"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Close panels"
              onClick={() => setPanelOpen(false)}
              className="px-2 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightTab === "properties" ? (
              <PropertiesPanel
                document={doc}
                selection={selected}
                dispatch={dispatch}
                onResizeCanvas={() => setDialog("resize")}
              />
            ) : (
              <AdjustmentsPanel layer={activeLayer} dispatch={dispatch} />
            )}
          </div>

          <div className="h-[42%] min-h-[180px] shrink-0 overflow-hidden border-t border-border">
            <LayersPanel document={doc} selection={state.selection} dispatch={dispatch} />
          </div>

          <div className="shrink-0 border-t border-border">
            <HistoryPanel
              entries={state.history.entries}
              index={state.history.index}
              dispatch={dispatch}
            />
          </div>
        </aside>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Status bar                                                       */}
      {/* ---------------------------------------------------------------- */}
      <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {doc.width} × {doc.height} px
        </span>
        <span aria-hidden="true">·</span>
        <span>{doc.layers.length} layer{doc.layers.length === 1 ? "" : "s"}</span>

        {state.status && (
          <span
            role="status"
            className={cn(
              "truncate font-medium",
              state.status.tone === "error" ? "text-destructive" : "text-foreground"
            )}
          >
            {state.status.message}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton
            icon={<Minus className="h-3.5 w-3.5" />}
            label="Zoom out"
            shortcut="Ctrl+-"
            onClick={() => zoomBy(-1)}
          />
          <button
            type="button"
            onClick={zoomTo100}
            title="Zoom to 100% (Ctrl+1)"
            className="min-w-[52px] rounded px-1.5 py-0.5 text-center tabular-nums transition-colors hover:bg-accent hover:text-foreground"
          >
            {zoomPercent}%
          </button>
          <ToolbarButton
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Zoom in"
            shortcut="Ctrl++"
            onClick={() => zoomBy(1)}
          />
          <ToolbarButton
            icon={<Maximize className="h-3.5 w-3.5" />}
            label="Fit to window"
            shortcut="Ctrl+0"
            onClick={fitToWindow}
          />
        </div>
      </footer>

      {/* ---------------------------------------------------------------- */}
      {/* Dialogs                                                          */}
      {/* ---------------------------------------------------------------- */}
      {dialog === "export" && (
        <EditorDialog title="Export image" onClose={() => setDialog("none")}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format.value}
                  type="button"
                  onClick={() => setExportFormat(format.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    exportFormat === format.value
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-accent"
                  )}
                >
                  <span className="block text-sm font-semibold">{format.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {format.description}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="space-y-1.5">
                <label htmlFor="export-name" className="text-xs font-medium text-muted-foreground">
                  File name
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="export-name"
                    value={exportName}
                    onChange={(event) => setExportName(event.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">
                    .{formatDescriptor(exportFormat).extension}
                  </span>
                </div>
              </div>

              {exportFormat !== "svg" && (
                <SliderField
                  label="Scale"
                  value={exportScale}
                  min={0.25}
                  max={4}
                  step={0.25}
                  neutral={1}
                  unit="×"
                  onChange={setExportScale}
                />
              )}

              {formatDescriptor(exportFormat).supportsQuality && (
                <SliderField
                  label="Quality"
                  value={exportQuality}
                  min={10}
                  max={100}
                  neutral={92}
                  unit="%"
                  onChange={setExportQuality}
                />
              )}

              {formatDescriptor(exportFormat).supportsAlpha && (
                <ToggleField
                  label="Transparent background"
                  hint="Drops the canvas background colour"
                  checked={exportTransparent}
                  onChange={setExportTransparent}
                />
              )}

              <p className="text-[11px] text-muted-foreground">
                {exportFormat === "svg" ? (
                  <>Vector output at {doc.width} × {doc.height}.</>
                ) : (
                  <>
                    Output size{" "}
                    <span className="tabular-nums">
                      {Math.round(doc.width * clampExportScale(doc, undefined, exportScale))} ×{" "}
                      {Math.round(doc.height * clampExportScale(doc, undefined, exportScale))} px
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialog("none")}>
                Cancel
              </Button>
              <Button size="sm" disabled={Boolean(busy)} onClick={() => void runExport()}>
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                )}
                Export
              </Button>
            </div>
          </div>
        </EditorDialog>
      )}

      {dialog === "resize" && (
        <ResizeDialog
          document={doc}
          onClose={() => setDialog("none")}
          onApply={(width, height, scaleLayers) => {
            dispatch({
              type: "commit",
              document: resizeDocument(doc, width, height, scaleLayers),
              label: "Resize canvas",
            });
            setDialog("none");
            setTimeout(fitToWindow, 0);
          }}
        />
      )}

      {dialog === "shortcuts" && (
        <EditorDialog title="Keyboard shortcuts" onClose={() => setDialog("none")} wide>
          <div className="grid gap-5 sm:grid-cols-2">
            {SHORTCUT_REFERENCE.map((group) => (
              <div key={group.group}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.group}
                </h3>
                <dl className="space-y-1.5">
                  {group.items.map(([keys, description]) => (
                    <div key={keys} className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0">
                        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          {keys}
                        </kbd>
                      </dt>
                      <dd className="text-right text-xs text-muted-foreground">{description}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </EditorDialog>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog shell                                                               */
/* -------------------------------------------------------------------------- */

function EditorDialog({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Resize dialog                                                              */
/* -------------------------------------------------------------------------- */

function ResizeDialog({
  document: doc,
  onClose,
  onApply,
}: {
  document: EditorDocument;
  onClose: () => void;
  onApply: (width: number, height: number, scaleLayers: boolean) => void;
}) {
  const [width, setWidth] = useState(doc.width);
  const [height, setHeight] = useState(doc.height);
  const [linked, setLinked] = useState(true);
  const [mode, setMode] = useState<"image" | "canvas">("image");
  const ratio = doc.width / doc.height;

  return (
    <EditorDialog title="Resize" onClose={onClose}>
      <div className="space-y-4">
        <SegmentedControl
          label="Mode"
          value={mode}
          options={[
            { value: "image", label: "Resize image" },
            { value: "canvas", label: "Resize canvas" },
          ]}
          onChange={setMode}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {mode === "image"
            ? "Scales the whole composition, including every layer and its type."
            : "Changes the canvas size only; layers keep their current size and position."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Width"
            value={width}
            min={1}
            max={MAX_CANVAS_DIMENSION}
            suffix="px"
            onChange={(value) => {
              setWidth(value);
              if (linked) setHeight(Math.max(1, Math.round(value / ratio)));
            }}
          />
          <NumberField
            label="Height"
            value={height}
            min={1}
            max={MAX_CANVAS_DIMENSION}
            suffix="px"
            onChange={(value) => {
              setHeight(value);
              if (linked) setWidth(Math.max(1, Math.round(value * ratio)));
            }}
          />
        </div>

        <ToggleField
          label="Lock aspect ratio"
          checked={linked}
          onChange={setLinked}
        />

        <p className="text-[11px] text-muted-foreground">
          Currently {doc.width} × {doc.height} px.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onApply(width, height, mode === "image")}>
            Apply
          </Button>
        </div>
      </div>
    </EditorDialog>
  );
}
