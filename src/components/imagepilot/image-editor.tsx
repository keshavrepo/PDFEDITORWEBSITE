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
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Crop as CropIcon,
  Download,
  EyeOff,
  FileArchive,
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
  Repeat,
  Ruler,
  ScanFace,
  Scissors,
  Scaling,
  Slash,
  ShieldCheck,
  Sparkles,
  SquareDashed,
  Stamp,
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
  getWorkspace,
  workspaceHref,
  workspaces,
  addLayer,
  savingsPercent,
  applyWatermark,
  buildGuideLayers,
  stripGuides,
  defaultWatermarkSettings,
  defaultCompressionSettings,
  createCanvasEncoder,
  compressImage,
  fitPortrait,
  specPixelSize,
  planPrintSheet,
  PASSPORT_SPECS,
  PRINT_SHEETS,
  EXTENSION_BY_FORMAT,
  MIME_BY_FORMAT,
  formatFromMime,
  createImageLayer as makeImageLayer,
  type CompressionSettings,
  type EditorDocument,
  type EditorToolId,
  type ExportFormat,
  type Layer,
  type PanelId,
  type WatermarkSettings,
  computeRemovalMatte,
  applyMatte,
  paintMatte,
  matteToPreview,
  defaultRemovalSettings,
  applyRegions,
  regionFromDrag,
  getPreset,
  REGION_PRESETS,
  inspectMetadata,
  cleanMetadata,
  defaultCleanOptions,
  detectFormat,
  probeFormatSupport,
  convertImage,
  packageZip,
  convertDescriptor,
  defaultConvertSettings,
  CONVERT_INPUT_ACCEPT,
  totalBytes,
  type BrushMode,
  type CleanOptions,
  type ConvertFormat,
  type ConvertSettings,
  type MetadataReport,
  type ObscureRegion,
  type RemovalSettings,
  type WorkspaceDefinition,
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
import { WatermarkPanel } from "./watermark-panel";
import { PassportPanel } from "./passport-panel";
import { CompressPanel, type BatchEntry } from "./compress-panel";
import { BackgroundPanel, type BackdropMode } from "./background-panel";
import { BlurPanel } from "./blur-panel";
import { MetadataPanel } from "./metadata-panel";
import { ConvertPanel } from "./convert-panel";
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

/** Inspector tab metadata, keyed by the workspace's panel ids. */
const PANEL_TABS: Record<PanelId, { label: string; icon: React.ReactNode }> = {
  properties: { label: "Properties", icon: <LayersIcon className="h-3.5 w-3.5" /> },
  adjust: { label: "Adjust", icon: <Sparkles className="h-3.5 w-3.5" /> },
  watermark: { label: "Watermark", icon: <Stamp className="h-3.5 w-3.5" /> },
  passport: { label: "Photo", icon: <ScanFace className="h-3.5 w-3.5" /> },
  compress: { label: "Compress", icon: <FileArchive className="h-3.5 w-3.5" /> },
  background: { label: "Cut out", icon: <Scissors className="h-3.5 w-3.5" /> },
  blur: { label: "Regions", icon: <EyeOff className="h-3.5 w-3.5" /> },
  metadata: { label: "Metadata", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  convert: { label: "Convert", icon: <Repeat className="h-3.5 w-3.5" /> },
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

export interface ImageEditorProps {
  /**
   * Task configuration. Defaults to the full editor, so the existing
   * `/imagepilot` route keeps its exact previous behaviour.
   */
  workspace?: WorkspaceDefinition;
}

export function ImageEditor({ workspace = getWorkspace("editor") }: ImageEditorProps = {}) {
  const router = useRouter();
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
  const [rightTab, setRightTab] = useState<PanelId>(workspace.panels[0]);
  /** Inspector visibility on small screens, where it overlays the canvas. */
  const [panelOpen, setPanelOpen] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Workspace state                                                        */
  /*                                                                        */
  /* Each focused workspace keeps its own settings object. They live here    */
  /* rather than in the reducer because they configure how a document is     */
  /* produced, not what the document currently is — the document itself      */
  /* remains the single source of truth and keeps its own undo history.      */
  /* ---------------------------------------------------------------------- */

  const [watermark, setWatermark] = useState<WatermarkSettings>(defaultWatermarkSettings);
  const [logoSourceId, setLogoSourceId] = useState<string | null>(null);

  const [passportSpecId, setPassportSpecId] = useState(PASSPORT_SPECS[0].id);
  const [passportDpi, setPassportDpi] = useState(300);
  const [passportBackground, setPassportBackground] = useState(PASSPORT_SPECS[0].backgrounds[0]);
  const [passportCopies, setPassportCopies] = useState(6);
  const [passportSheet, setPassportSheet] = useState(PRINT_SHEETS[0].id);
  const [passportGuides, setPassportGuides] = useState(true);

  const [compression, setCompression] = useState<CompressionSettings>(defaultCompressionSettings);
  const [compressPreview, setCompressPreview] = useState<{
    bytes: number;
    quality: number;
    width: number;
    height: number;
    missedTarget: boolean;
  } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [sourceFile, setSourceFile] = useState<{ name: string; bytes: number; mime: string } | null>(
    null
  );

  /** Files queued for a batch run, shared by the watermark and compress tools. */
  const [batch, setBatch] = useState<Array<{ file: File; entry: BatchEntry }>>([]);
  /** Which picker the hidden file input is currently serving. */
  const pickerModeRef = useRef<"import" | "logo" | "batch" | "backdrop">("import");

  const passportSpec = useMemo(
    () => PASSPORT_SPECS.find((entry) => entry.id === passportSpecId) ?? PASSPORT_SPECS[0],
    [passportSpecId]
  );

  /* ---------------------------------------------------------------------- */
  /* Batch 3 workspace state                                                */
  /* ---------------------------------------------------------------------- */

  /** Background remover. */
  const [removal, setRemoval] = useState<RemovalSettings>(defaultRemovalSettings);
  const [backdrop, setBackdrop] = useState<BackdropMode>("transparent");
  const [backdropColor, setBackdropColor] = useState("#ffffff");
  const [backdropSourceId, setBackdropSourceId] = useState<string | null>(null);
  const [brushMode, setBrushMode] = useState<BrushMode>("restore");
  const [brushSize, setBrushSize] = useState(40);
  const [brushActive, setBrushActive] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [compareBefore, setCompareBefore] = useState(false);
  const [matteInfo, setMatteInfo] = useState<{ removed: number } | null>(null);
  const [matteWorking, setMatteWorking] = useState(false);
  /**
   * Bridge to `commitMatte`, which is declared further down.
   *
   * Import needs to trigger the first detection, but the committer depends on
   * state that is set up later in the component. A ref keeps the ordering
   * honest without hoisting either declaration.
   */
  const commitMatteRef = useRef<((alpha: Float32Array) => void) | null>(null);
  /**
   * Geometry of the photo the matte and regions apply to.
   *
   * Mirrored into state because the overlay needs it *during render* to
   * convert region coordinates back into document space; the pixel buffers
   * themselves stay in the ref, where their size does not cost a re-render.
   */
  const [matteFrame, setMatteFrame] = useState<{
    width: number;
    height: number;
    layerId: string;
  } | null>(null);
  /**
   * The live matte plus the pixels it was computed from.
   *
   * Held in a ref rather than state because a brush stroke mutates it dozens
   * of times a second; the canvas is refreshed through `rasterVersion`.
   */
  const matteRef = useRef<{
    alpha: Float32Array;
    base: Uint8ClampedArray;
    width: number;
    height: number;
    samples: ReturnType<typeof computeRemovalMatte>["samples"];
    sourceId: string;
    layerId: string;
  } | null>(null);

  /** Object blur studio. */
  const [regionPreset, setRegionPreset] = useState(REGION_PRESETS[0].id);
  const [regions, setRegions] = useState<ObscureRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  /** Metadata cleaner. */
  const [metaReport, setMetaReport] = useState<MetadataReport | null>(null);
  const [cleanOptions, setCleanOptions] = useState<CleanOptions>(defaultCleanOptions);
  /** Original encoded bytes, needed to rewrite the container losslessly. */
  const originalBytesRef = useRef<{ bytes: Uint8Array; name: string } | null>(null);

  /** Batch converter. */
  const [convertSettings, setConvertSettings] =
    useState<ConvertSettings>(defaultConvertSettings);
  const [supportedFormats, setSupportedFormats] = useState<Set<ConvertFormat>>(
    () => new Set<ConvertFormat>(["png", "jpeg", "bmp"])
  );
  const [convertProgress, setConvertProgress] = useState<number | null>(null);
  const [lastConvertRun, setLastConvertRun] = useState<{
    count: number;
    bytes: number;
    originalBytes: number;
  } | null>(null);

  /**
   * Asks the browser which formats it can encode.
   *
   * Runs once; the answer cannot change during a session.
   */
  useEffect(() => {
    if (workspace.id !== "convert") return;
    let cancelled = false;
    void probeFormatSupport(browserCanvasFactory, canvasToBlob).then((supported) => {
      if (cancelled) return;
      setSupportedFormats(supported);
      // Fall back if the preferred default is unavailable here.
      setConvertSettings((current) =>
        supported.has(current.format) ? current : { ...current, format: "png" }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  /**
   * Tools this workspace exposes.
   *
   * A focused workspace shows only what its task needs, so the rail is short
   * and the keyboard map cannot reach a tool the workspace deliberately hides.
   */
  const availableTools = useMemo(
    () =>
      workspace.tools === null
        ? EDITOR_TOOLS
        : EDITOR_TOOLS.filter((tool) => workspace.tools!.includes(tool.id)),
    [workspace.tools]
  );

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

        // Record the first file so the compressor can show a true
        // before/after against the bytes the user actually started with.
        const first = files.find((file) => !validateImageFile(file));
        if (first) {
          setSourceFile({ name: first.name, bytes: first.size, mime: first.type });
        }

        /*
         * Workspaces that operate on the *pixels of one photo* — background
         * removal and region obscuring — keep an untouched copy of those
         * pixels. Every recomputation starts from this copy, so adjusting a
         * setting or deleting a region restores what was underneath instead of
         * compounding the previous result.
         */
        if ((workspace.id === "background" || workspace.id === "blur") && newIds.length) {
          const layer = workingDoc.layers.find(
            (entry): entry is Extract<Layer, { type: "image" }> => entry.id === newIds[0]
          );
          const source = layer ? rasters.get(layer.sourceId) : undefined;
          if (layer && source) {
            const buffer = browserCanvasFactory.create(source.width, source.height);
            buffer.ctx.drawImage(source.image, 0, 0, source.width, source.height);
            const base = buffer.ctx.getImageData(0, 0, source.width, source.height).data;

            matteRef.current = {
              alpha: new Float32Array(source.width * source.height).fill(1),
              base,
              width: source.width,
              height: source.height,
              samples: [],
              sourceId: layer.sourceId,
              layerId: layer.id,
            };
            setMatteFrame({ width: source.width, height: source.height, layerId: layer.id });
            setRegions([]);
            setSelectedRegion(null);
            setMatteInfo(null);
          }
        }

        // The metadata cleaner works on the encoded bytes, not the pixels, so
        // that removal is lossless.
        if (workspace.id === "metadata" && first) {
          try {
            const bytes = new Uint8Array(await first.arrayBuffer());
            originalBytesRef.current = { bytes, name: first.name };
            setMetaReport(inspectMetadata(bytes));
          } catch {
            setMetaReport(null);
          }
        }

        // A passport photo is staged straight into its specification, which
        // saves the user a manual resize before they can even see the guides.
        if (workspace.id === "passport" && newIds.length === 1) {
          const photo = workingDoc.layers.find(
            (layer): layer is Extract<Layer, { type: "image" }> => layer.id === newIds[0]
          );
          if (photo) {
            const size = specPixelSize(passportSpec, passportDpi);
            const rect = fitPortrait(
              passportSpec,
              photo.naturalWidth,
              photo.naturalHeight,
              size.width,
              size.height
            );
            workingDoc = {
              ...workingDoc,
              width: size.width,
              height: size.height,
              background: passportBackground,
              layers: workingDoc.layers.map((layer) =>
                layer.id === photo.id ? { ...layer, ...rect } : layer
              ),
            };
            if (passportGuides) {
              workingDoc = {
                ...workingDoc,
                layers: [
                  ...workingDoc.layers,
                  ...buildGuideLayers(passportSpec, size.width, size.height),
                ],
              };
            }
          }
        }

        setRasterVersion((version) => version + 1);
        dispatch({
          type: "commit",
          document: workingDoc,
          label: newIds.length === 1 ? "Import image" : `Import ${newIds.length} images`,
        });
        dispatch({ type: "select", ids: newIds });
        notify(`Imported ${newIds.length} image${newIds.length === 1 ? "" : "s"}.`);
        setTimeout(fitToWindow, 0);

        // Run the first background detection straight away: an empty result
        // would leave the user staring at an unchanged photo wondering whether
        // the tool did anything.
        if (workspace.id === "background" && matteRef.current) {
          setTimeout(() => {
            const matte = matteRef.current;
            if (!matte) return;
            const result = computeRemovalMatte(matte.base, matte.width, matte.height, removal);
            matte.alpha = result.alpha;
            matte.samples = result.samples;
            commitMatteRef.current?.(result.alpha);
          }, 0);
        }
      } finally {
        setBusy(null);
      }
    },
    // `fitToWindow` is declared below and is stable across renders; including
    // it here would create a cycle with the workspace ref it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      notify,
      passportBackground,
      passportDpi,
      passportGuides,
      passportSpec,
      rasters,
      removal,
      state,
      workspace.id,
    ]
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

      // Positioning guides are an editing aid, never part of the artwork.
      const exportDoc = stripGuides(doc);

      if (exportFormat === "svg") {
        // Bitmap layers are embedded as data URIs; shapes and text stay vector.
        const hrefs = new Map<string, string>();
        for (const layer of exportDoc.layers) {
          if (layer.type !== "image" || !layer.visible) continue;
          const source = rasters.get(layer.sourceId);
          if (!source) continue;
          const buffer = browserCanvasFactory.create(source.width, source.height);
          buffer.ctx.drawImage(source.image, 0, 0, source.width, source.height);
          hrefs.set(layer.id, await canvasToDataUrl(buffer.canvas, "image/png"));
        }
        const measure = browserCanvasFactory.create(8, 8).ctx;
        const svg = documentToSvg(exportDoc, hrefs, measure, {
          transparent: exportTransparent && descriptor.supportsAlpha,
        });
        blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      } else {
        const scale = clampExportScale(exportDoc, undefined, exportScale);
        const rendered = composite(exportDoc, rasters, browserCanvasFactory, {
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
  /* Batch queue and logo picker                                            */
  /* ---------------------------------------------------------------------- */

  /** Adds files to the batch queue, skipping anything unreadable. */
  const queueBatch = useCallback(
    (files: File[]) => {
      const accepted: Array<{ file: File; entry: BatchEntry }> = [];
      for (const file of files) {
        const problem = validateImageFile(file);
        if (problem) {
          notify(problem, "error");
          continue;
        }
        accepted.push({
          file,
          entry: {
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            originalBytes: file.size,
            status: "pending",
          },
        });
      }
      if (!accepted.length) return;
      setBatch((current) => [...current, ...accepted]);
      notify(`${accepted.length} image${accepted.length === 1 ? "" : "s"} queued.`);
    },
    [notify]
  );

  /** Decodes a logo into the raster store for the watermark tool. */
  const loadLogo = useCallback(
    async (file: File) => {
      const problem = validateImageFile(file);
      if (problem) {
        notify(problem, "error");
        return;
      }
      setBusy("Loading logo…");
      try {
        const decoded = await decodeImage(file);
        const sourceId = `logo_${Math.random().toString(36).slice(2, 10)}`;
        rasters.set({
          id: sourceId,
          width: decoded.width,
          height: decoded.height,
          image: decoded.image,
        });
        setLogoSourceId(sourceId);
        setRasterVersion((version) => version + 1);
        setWatermark((current) => ({ ...current, kind: "image", imageSourceId: sourceId }));
        notify("Logo loaded.");
      } catch {
        notify("That logo could not be decoded.", "error");
      } finally {
        setBusy(null);
      }
    },
    [notify, rasters]
  );

  /**
   * Loads a replacement background and places it beneath the subject.
   *
   * Added as a real layer rather than a document property so it can be moved
   * and scaled with the ordinary move tool.
   */
  const loadBackdrop = useCallback(
    async (file: File) => {
      const problem = validateImageFile(file);
      if (problem) {
        notify(problem, "error");
        return;
      }
      setBusy("Loading background…");
      try {
        const decoded = await decodeImage(file);
        const sourceId = `backdrop_${Math.random().toString(36).slice(2, 10)}`;
        rasters.set({
          id: sourceId,
          width: decoded.width,
          height: decoded.height,
          image: decoded.image,
        });

        const current = editorDocument(state);
        // Cover the canvas without distorting.
        const scale = Math.max(
          current.width / decoded.width,
          current.height / decoded.height
        );
        const width = decoded.width * scale;
        const height = decoded.height * scale;

        const layer = makeImageLayer(
          "Background",
          sourceId,
          {
            x: (current.width - width) / 2,
            y: (current.height - height) / 2,
            width,
            height,
          },
          { width: decoded.width, height: decoded.height }
        );

        // Remove any previous backdrop, then insert at the very bottom.
        const withoutOld = current.layers.filter((entry) => entry.name !== "Background");
        dispatch({
          type: "commit",
          document: { ...current, layers: [layer, ...withoutOld] },
          label: "Add background",
        });

        setBackdropSourceId(sourceId);
        setBackdrop("image");
        setRasterVersion((version) => version + 1);
        notify("Background added.");
      } catch {
        notify("That image could not be decoded.", "error");
      } finally {
        setBusy(null);
      }
    },
    [notify, rasters, state]
  );

  /* ---------------------------------------------------------------------- */
  /* Workspace: watermark                                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Measures watermark text through the same canvas the renderer uses, so the
   * generated layer box matches the glyphs that will actually be drawn.
   */
  const measureWatermarkText = useCallback(
    (fontSize: number) => {
      const { ctx } = browserCanvasFactory.create(8, 8);
      ctx.font = `${watermark.fontWeight} ${fontSize}px ${watermark.fontFamily}`;
      return ctx.measureText(watermark.text || " ").width;
    },
    [watermark.fontFamily, watermark.fontWeight, watermark.text]
  );

  /**
   * Rebuilds the watermark layers whenever the settings change.
   *
   * Committed with a stable merge key so a slider drag collapses into a single
   * undo step, exactly like the adjustment sliders.
   */
  useEffect(() => {
    if (workspace.id !== "watermark") return;
    const current = editorDocument(state);
    // Nothing to watermark yet.
    if (!current.layers.some((layer) => !layer.name.startsWith("Watermark"))) return;

    const logo = logoSourceId ? rasters.get(logoSourceId) : undefined;
    const next = applyWatermark(current, watermark, measureWatermarkText, logo);

    // Skip the commit when nothing actually changed, or the effect would loop.
    if (next === current) return;
    const sameCount = next.layers.length === current.layers.length;
    if (sameCount && JSON.stringify(next.layers) === JSON.stringify(current.layers)) return;

    dispatch({
      type: "commit",
      document: next,
      label: "Watermark",
      mergeKey: "watermark",
    });
    // `state` is deliberately excluded: this effect reacts to settings, and
    // reading the document through the reducer keeps it from re-entering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watermark, logoSourceId, workspace.id, measureWatermarkText, rasterVersion]);

  /** Applies the current watermark settings to every queued file. */
  const runWatermarkBatch = useCallback(async () => {
    if (!batch.length) return;
    setBusy(`Watermarking ${batch.length} image${batch.length === 1 ? "" : "s"}…`);

    let succeeded = 0;
    try {
      const logo = logoSourceId ? rasters.get(logoSourceId) : undefined;

      for (const item of batch) {
        try {
          const decoded = await decodeImage(item.file);
          const sourceId = `batch_${Math.random().toString(36).slice(2, 10)}`;
          rasters.set({
            id: sourceId,
            width: decoded.width,
            height: decoded.height,
            image: decoded.image,
          });

          // Build a throwaway document per file and reuse the whole pipeline.
          let itemDoc = createDocument(decoded.width, decoded.height, {
            name: item.entry.name,
            background: null,
          });
          itemDoc = addLayer(
            itemDoc,
            makeImageLayer(
              "Photo",
              sourceId,
              { x: 0, y: 0, width: decoded.width, height: decoded.height },
              { width: decoded.width, height: decoded.height }
            )
          );
          itemDoc = applyWatermark(itemDoc, watermark, measureWatermarkText, logo);

          const rendered = composite(itemDoc, rasters, browserCanvasFactory, {
            transparent: true,
          });
          const blob = await canvasToBlob(rendered.canvas, "image/png");
          downloadBlob(blob, `${item.entry.name.replace(/\.[^.]+$/, "")}-watermarked.png`);
          succeeded++;

          // Release the bitmap straight away; a long batch would otherwise
          // hold every decoded image in memory at once.
          rasters.prune(new Set([...doc.layers.map((l) => "sourceId" in l ? l.sourceId : ""), logoSourceId ?? ""]));
        } catch {
          setBatch((current) =>
            current.map((entry) =>
              entry.entry.id === item.entry.id
                ? { ...entry, entry: { ...entry.entry, status: "failed" } }
                : entry
            )
          );
        }
      }

      notify(`Watermarked ${succeeded} of ${batch.length} images.`);
      void recordActivity({
        productId: "imagepilot",
        toolName: "Watermark Studio",
        fileName: `${succeeded} watermarked images`,
      });
    } finally {
      setBusy(null);
    }
  }, [batch, doc.layers, logoSourceId, measureWatermarkText, notify, rasters, watermark]);

  /* ---------------------------------------------------------------------- */
  /* Workspace: passport                                                    */
  /* ---------------------------------------------------------------------- */

  /** Re-fits the imported portrait into the current specification. */
  const refitPassport = useCallback(() => {
    const current = editorDocument(state);
    const photo = current.layers.find(
      (layer): layer is Extract<Layer, { type: "image" }> => layer.type === "image"
    );
    if (!photo) {
      notify("Import a photo first.", "error");
      return;
    }

    const size = specPixelSize(passportSpec, passportDpi);
    const rect = fitPortrait(
      passportSpec,
      photo.naturalWidth,
      photo.naturalHeight,
      size.width,
      size.height
    );

    let next: EditorDocument = {
      ...current,
      width: size.width,
      height: size.height,
      background: passportBackground,
      layers: current.layers.map((layer) =>
        layer.id === photo.id ? { ...layer, ...rect } : layer
      ),
    };
    next = stripGuides(next);
    if (passportGuides) {
      next = { ...next, layers: [...next.layers, ...buildGuideLayers(passportSpec, size.width, size.height)] };
    }

    dispatch({ type: "commit", document: next, label: "Fit to specification" });
    setTimeout(fitToWindow, 0);
  }, [
    fitToWindow,
    notify,
    passportBackground,
    passportDpi,
    passportGuides,
    passportSpec,
    state,
  ]);

  /**
   * Keeps the canvas, background and guides in step with the specification.
   *
   * Runs on a change of spec, resolution, background or guide visibility; the
   * photo layer itself is left where the user put it.
   */
  useEffect(() => {
    if (workspace.id !== "passport") return;
    const current = editorDocument(state);
    if (!current.layers.length) return;

    const size = specPixelSize(passportSpec, passportDpi);
    const withoutGuides = stripGuides(current);
    const needsResize = current.width !== size.width || current.height !== size.height;
    const needsBackground = current.background !== passportBackground;
    const hasGuides = current.layers.length !== withoutGuides.layers.length;

    if (!needsResize && !needsBackground && hasGuides === passportGuides) return;

    let next: EditorDocument = {
      ...withoutGuides,
      width: size.width,
      height: size.height,
      background: passportBackground,
    };
    if (passportGuides) {
      next = {
        ...next,
        layers: [...next.layers, ...buildGuideLayers(passportSpec, size.width, size.height)],
      };
    }

    dispatch({ type: "commit", document: next, label: "Photo specification" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportSpec, passportDpi, passportBackground, passportGuides, workspace.id]);

  /** Renders the print sheet and downloads it. */
  const exportPrintSheet = useCallback(async () => {
    const current = stripGuides(editorDocument(state));
    if (!current.layers.length) {
      notify("Import a photo first.", "error");
      return;
    }

    setBusy("Building the print sheet…");
    try {
      const sheet = PRINT_SHEETS.find((entry) => entry.id === passportSheet) ?? PRINT_SHEETS[0];
      const layout = planPrintSheet(passportSpec, sheet, passportDpi, passportCopies);

      // Render one photo, then stamp it into each cell.
      const one = composite(current, rasters, browserCanvasFactory, {
        matte: passportBackground,
      });

      const target = browserCanvasFactory.create(layout.width, layout.height);
      target.ctx.fillStyle = "#ffffff";
      target.ctx.fillRect(0, 0, layout.width, layout.height);
      target.ctx.imageSmoothingQuality = "high";
      for (const cell of layout.cells) {
        target.ctx.drawImage(one.canvas, cell.x, cell.y, cell.width, cell.height);
        // Thin cut guide so the copies can be trimmed apart accurately.
        target.ctx.strokeStyle = "rgba(0,0,0,0.25)";
        target.ctx.lineWidth = 1;
        target.ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.width - 1, cell.height - 1);
      }

      const blob = await canvasToBlob(target.canvas, "image/jpeg", 0.95);
      const fileName = `passport-${passportSpec.id}-${layout.cells.length}-copies.jpg`;
      downloadBlob(blob, fileName);
      notify(`Print sheet ready — ${layout.cells.length} copies (${formatBytes(blob.size)}).`);

      void recordActivity({
        productId: "imagepilot",
        toolName: "Passport Photo Studio",
        fileName,
        fileSize: blob.size,
        mimeType: "image/jpeg",
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "The print sheet could not be created.",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }, [
    notify,
    passportBackground,
    passportCopies,
    passportDpi,
    passportSheet,
    passportSpec,
    rasters,
    state,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Workspace: compression                                                 */
  /* ---------------------------------------------------------------------- */

  const encoder = useMemo(
    () => createCanvasEncoder(browserCanvasFactory, canvasToBlob),
    []
  );

  /**
   * Recomputes the compressed preview.
   *
   * Debounced because a target-size search runs several encodes and the
   * sliders fire continuously while dragging.
   */
  useEffect(() => {
    if (workspace.id !== "compress") return;
    const current = editorDocument(state);
    const photo = current.layers.find(
      (layer): layer is Extract<Layer, { type: "image" }> => layer.type === "image"
    );
    const source = photo ? rasters.get(photo.sourceId) : undefined;

    let cancelled = false;
    // All state changes happen inside the timer, never synchronously in the
    // effect body, so a render can never cascade straight into another.
    const timer = setTimeout(async () => {
      if (!source) {
        setCompressPreview(null);
        return;
      }
      setCompressing(true);
      try {
        const result = await compressImage(
          source.image,
          source.width,
          source.height,
          compression,
          encoder
        );
        if (cancelled) return;
        setCompressPreview({
          bytes: result.blob.size,
          quality: result.quality,
          width: result.width,
          height: result.height,
          missedTarget: result.missedTarget,
        });
      } catch {
        if (!cancelled) setCompressPreview(null);
      } finally {
        if (!cancelled) setCompressing(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compression, workspace.id, rasterVersion, encoder]);

  /** Encodes and downloads the current image at the chosen settings. */
  const downloadCompressed = useCallback(async () => {
    const current = editorDocument(state);
    const photo = current.layers.find(
      (layer): layer is Extract<Layer, { type: "image" }> => layer.type === "image"
    );
    const source = photo ? rasters.get(photo.sourceId) : undefined;
    if (!source) {
      notify("Import an image first.", "error");
      return;
    }

    setBusy("Compressing…");
    try {
      const result = await compressImage(
        source.image,
        source.width,
        source.height,
        compression,
        encoder
      );
      const base = (sourceFile?.name ?? current.name).replace(/\.[^.]+$/, "");
      const fileName = `${base}-compressed.${EXTENSION_BY_FORMAT[compression.format]}`;
      downloadBlob(result.blob, fileName);

      const saved = sourceFile ? savingsPercent(sourceFile.bytes, result.blob.size) : 0;
      notify(
        result.missedTarget
          ? `Exported at ${formatBytes(result.blob.size)} — the target could not be met.`
          : `Exported ${formatBytes(result.blob.size)}${saved ? ` (${saved}% smaller)` : ""}.`,
        result.missedTarget ? "error" : "info"
      );

      void recordActivity({
        productId: "imagepilot",
        toolName: "Image Compressor",
        fileName,
        fileSize: result.blob.size,
        inputFileSize: sourceFile?.bytes,
        mimeType: MIME_BY_FORMAT[compression.format],
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "The image could not be compressed.",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }, [compression, encoder, notify, rasters, sourceFile, state]);

  /** Compresses every queued file with the current settings. */
  const runCompressBatch = useCallback(async () => {
    if (!batch.length) return;
    setBusy(`Compressing ${batch.length} image${batch.length === 1 ? "" : "s"}…`);

    let succeeded = 0;
    let savedBytes = 0;
    try {
      for (const item of batch) {
        try {
          const decoded = await decodeImage(item.file);
          // Honour the original format when the user asked to keep it.
          const settings: CompressionSettings = compression.keepFormat
            ? { ...compression, format: formatFromMime(item.file.type) }
            : compression;

          const result = await compressImage(
            decoded.image,
            decoded.width,
            decoded.height,
            settings,
            encoder
          );

          const base = item.entry.name.replace(/\.[^.]+$/, "");
          downloadBlob(
            result.blob,
            `${base}-compressed.${EXTENSION_BY_FORMAT[settings.format]}`
          );

          savedBytes += Math.max(0, item.entry.originalBytes - result.blob.size);
          succeeded++;

          setBatch((current) =>
            current.map((entry) =>
              entry.entry.id === item.entry.id
                ? {
                    ...entry,
                    entry: { ...entry.entry, status: "done", resultBytes: result.blob.size },
                  }
                : entry
            )
          );
        } catch {
          setBatch((current) =>
            current.map((entry) =>
              entry.entry.id === item.entry.id
                ? { ...entry, entry: { ...entry.entry, status: "failed" } }
                : entry
            )
          );
        }
      }

      notify(
        `Compressed ${succeeded} of ${batch.length} images, saving ${formatBytes(savedBytes)}.`
      );
      void recordActivity({
        productId: "imagepilot",
        toolName: "Image Compressor",
        fileName: `${succeeded} compressed images`,
      });
    } finally {
      setBusy(null);
    }
  }, [batch, compression, encoder, notify]);

  /* ---------------------------------------------------------------------- */
  /* Workspace: background remover                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Writes the current matte into a new raster and points the layer at it.
   *
   * A fresh id is used each time so the browser cannot serve a cached bitmap,
   * and `rasterVersion` tells the canvas to repaint.
   */
  const commitMatte = useCallback(
    (alpha: Float32Array) => {
      const matte = matteRef.current;
      if (!matte) return;

      const pixels = new Uint8ClampedArray(matte.base);
      applyMatte(pixels, alpha, matte.samples, removal.decontaminate);

      const buffer = browserCanvasFactory.create(matte.width, matte.height);
      const imageData = buffer.ctx.createImageData(matte.width, matte.height);
      imageData.data.set(showMask ? matteToPreview(alpha, matte.width, matte.height) : pixels);
      buffer.ctx.putImageData(imageData, 0, 0);

      const sourceId = `cut_${Math.random().toString(36).slice(2, 10)}`;
      rasters.set({
        id: sourceId,
        width: matte.width,
        height: matte.height,
        image: buffer.canvas,
      });
      matte.sourceId = sourceId;

      dispatch({
        type: "update-layer",
        id: matte.layerId,
        patch: { sourceId } as Partial<Layer>,
        label: "Remove background",
        mergeKey: `matte:${matte.layerId}`,
      });
      setRasterVersion((version) => version + 1);

      let removed = 0;
      for (let i = 0; i < alpha.length; i++) removed += 1 - alpha[i];
      setMatteInfo({ removed: Math.round((removed / alpha.length) * 100) });
    },
    [rasters, removal.decontaminate, showMask]
  );

  // Keep the import path's bridge pointing at the current committer.
  useEffect(() => {
    commitMatteRef.current = commitMatte;
  }, [commitMatte]);

  /**
   * Recomputes the matte from the original pixels.
   *
   * Debounced: every slider fires continuously and a full matte on a large
   * image is expensive.
   */
  useEffect(() => {
    if (workspace.id !== "background") return;
    const matte = matteRef.current;
    if (!matte) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setMatteWorking(true);
      try {
        const result = computeRemovalMatte(matte.base, matte.width, matte.height, removal);
        if (cancelled) return;
        matte.alpha = result.alpha;
        matte.samples = result.samples;
        commitMatte(result.alpha);
      } finally {
        if (!cancelled) setMatteWorking(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Recomputing must not depend on `commitMatte`'s identity, which changes
    // with every raster version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removal, workspace.id, showMask]);

  /**
   * Before/after comparison.
   *
   * Swaps the layer between the cut-out raster and one holding the original
   * pixels. Doing it by swapping sources keeps the comparison honest: it is
   * the real before and the real after, not a reconstruction.
   */
  useEffect(() => {
    if (workspace.id !== "background") return;
    const matte = matteRef.current;
    if (!matte) return;

    const timer = setTimeout(() => {
      const current = editorDocument(state);
      const layer = current.layers.find((entry) => entry.id === matte.layerId);
      if (!layer || layer.type !== "image") return;

      if (compareBefore) {
        const buffer = browserCanvasFactory.create(matte.width, matte.height);
        const imageData = buffer.ctx.createImageData(matte.width, matte.height);
        imageData.data.set(matte.base);
        buffer.ctx.putImageData(imageData, 0, 0);
        const beforeId = `before_${Math.random().toString(36).slice(2, 10)}`;
        rasters.set({ id: beforeId, width: matte.width, height: matte.height, image: buffer.canvas });
        dispatch({
          type: "update-layer",
          id: matte.layerId,
          patch: { sourceId: beforeId } as Partial<Layer>,
          label: "Show original",
          mergeKey: "compare",
        });
      } else {
        commitMatteRef.current?.(matte.alpha);
      }
      setRasterVersion((version) => version + 1);
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareBefore, workspace.id]);

  /** Re-runs detection from scratch, e.g. after replacing the photo. */
  const recomputeMatte = useCallback(() => {
    const matte = matteRef.current;
    if (!matte) {
      notify("Import a photo first.", "error");
      return;
    }
    setMatteWorking(true);
    try {
      const result = computeRemovalMatte(matte.base, matte.width, matte.height, removal);
      matte.alpha = result.alpha;
      matte.samples = result.samples;
      commitMatte(result.alpha);
      notify(`Background detected — ${Math.round(result.removedFraction * 100)}% removed.`);
    } finally {
      setMatteWorking(false);
    }
  }, [commitMatte, notify, removal]);

  /** Applies one brush dab, in document coordinates. */
  const paintBrush = useCallback(
    (docX: number, docY: number) => {
      const matte = matteRef.current;
      if (!matte) return;
      const layer = editorDocument(state).layers.find((entry) => entry.id === matte.layerId);
      if (!layer) return;

      // Convert document space into the matte's own pixel grid, which is the
      // photo's natural resolution rather than the layer's on-canvas size.
      const scaleX = matte.width / Math.max(1, layer.width);
      const scaleY = matte.height / Math.max(1, layer.height);
      const x = (docX - layer.x) * scaleX;
      const y = (docY - layer.y) * scaleY;
      const radius = (brushSize / 2) * Math.max(scaleX, scaleY);

      paintMatte(matte.alpha, matte.width, matte.height, x, y, radius, brushMode);
      commitMatte(matte.alpha);
    },
    [brushMode, brushSize, commitMatte, state]
  );

  /** Discards manual strokes by recomputing from the settings. */
  const resetBrushStrokes = useCallback(() => {
    const matte = matteRef.current;
    if (!matte) return;
    const result = computeRemovalMatte(matte.base, matte.width, matte.height, removal);
    matte.alpha = result.alpha;
    matte.samples = result.samples;
    commitMatte(result.alpha);
    notify("Brush strokes discarded.");
  }, [commitMatte, notify, removal]);

  /**
   * Keeps the document background in step with the chosen backdrop.
   *
   * Colour and transparency are document properties; an image backdrop is a
   * real layer beneath the subject, so it can be moved and scaled.
   */
  useEffect(() => {
    if (workspace.id !== "background") return;
    const current = editorDocument(state);
    if (!current.layers.length) return;

    const wanted = backdrop === "colour" ? backdropColor : null;
    if (current.background === wanted) return;

    dispatch({
      type: "commit",
      document: { ...current, background: wanted },
      label: "Background",
      mergeKey: "backdrop",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdrop, backdropColor, workspace.id]);

  /* ---------------------------------------------------------------------- */
  /* Workspace: object blur                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * Re-renders the obscured image whenever the regions change.
   *
   * Regions are applied to a copy of the untouched original every time, so
   * moving or deleting one restores what was underneath rather than stacking
   * effects on top of each other.
   */
  useEffect(() => {
    if (workspace.id !== "blur") return;
    const matte = matteRef.current;
    if (!matte) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const pixels = new Uint8ClampedArray(matte.base);
      applyRegions(pixels, matte.width, matte.height, regions);

      const buffer = browserCanvasFactory.create(matte.width, matte.height);
      const imageData = buffer.ctx.createImageData(matte.width, matte.height);
      imageData.data.set(pixels);
      buffer.ctx.putImageData(imageData, 0, 0);

      const sourceId = `blur_${Math.random().toString(36).slice(2, 10)}`;
      rasters.set({ id: sourceId, width: matte.width, height: matte.height, image: buffer.canvas });

      dispatch({
        type: "update-layer",
        id: matte.layerId,
        patch: { sourceId } as Partial<Layer>,
        label: "Obscure regions",
        mergeKey: "regions",
      });
      setRasterVersion((version) => version + 1);
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions, workspace.id]);

  const addRegion = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const matte = matteRef.current;
      const layer = matte
        ? editorDocument(state).layers.find((entry) => entry.id === matte.layerId)
        : null;
      if (!matte || !layer) return;

      // Translate the drag from document space into the photo's pixel grid.
      const scaleX = matte.width / Math.max(1, layer.width);
      const scaleY = matte.height / Math.max(1, layer.height);
      const inPhoto = {
        x: (rect.x - layer.x) * scaleX,
        y: (rect.y - layer.y) * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY,
      };

      const region = regionFromDrag(
        inPhoto,
        getPreset(regionPreset),
        `region_${Math.random().toString(36).slice(2, 10)}`
      );
      setRegions((current) => [...current, region]);
      setSelectedRegion(region.id);
    },
    [regionPreset, state]
  );

  /* ---------------------------------------------------------------------- */
  /* Workspace: metadata cleaner                                            */
  /* ---------------------------------------------------------------------- */

  /** Rewrites the current file with the selected metadata removed. */
  const downloadCleaned = useCallback(() => {
    const original = originalBytesRef.current;
    if (!original) {
      notify("Import a photo first.", "error");
      return;
    }

    const result = cleanMetadata(original.bytes, cleanOptions);
    if (!result.removedBytes) {
      notify("There was nothing to remove.", "error");
      return;
    }

    const format = detectFormat(original.bytes);
    const extension = format === "jpeg" ? "jpg" : format === "png" ? "png" : "webp";
    const base = original.name.replace(/\.[^.]+$/, "");
    const fileName = `${base}-clean.${extension}`;
    downloadBlob(
      new Blob([result.bytes as unknown as BlobPart], { type: `image/${format}` }),
      fileName
    );

    setMetaReport(inspectMetadata(result.bytes));
    notify(
      `Removed ${result.removed.length} ${result.removed.length === 1 ? "entry" : "entries"} (${formatBytes(result.removedBytes)}).`
    );

    void recordActivity({
      productId: "imagepilot",
      toolName: "Metadata Cleaner",
      fileName,
      fileSize: result.bytes.length,
      inputFileSize: original.bytes.length,
      mimeType: `image/${format}`,
    });
  }, [cleanOptions, notify]);

  /** Cleans every queued file. */
  const runMetadataBatch = useCallback(async () => {
    if (!batch.length) return;
    setBusy(`Cleaning ${batch.length} file${batch.length === 1 ? "" : "s"}…`);

    let succeeded = 0;
    let strippedBytes = 0;
    try {
      for (const item of batch) {
        try {
          const bytes = new Uint8Array(await item.file.arrayBuffer());
          const result = cleanMetadata(bytes, cleanOptions);
          const format = detectFormat(bytes);
          const extension = format === "jpeg" ? "jpg" : format === "png" ? "png" : "webp";
          const base = item.entry.name.replace(/\.[^.]+$/, "");

          downloadBlob(
            new Blob([result.bytes as unknown as BlobPart], { type: `image/${format}` }),
            `${base}-clean.${extension}`
          );
          strippedBytes += result.removedBytes;
          succeeded++;

          setBatch((current) =>
            current.map((entry) =>
              entry.entry.id === item.entry.id
                ? {
                    ...entry,
                    entry: { ...entry.entry, status: "done", resultBytes: result.bytes.length },
                  }
                : entry
            )
          );
        } catch {
          setBatch((current) =>
            current.map((entry) =>
              entry.entry.id === item.entry.id
                ? { ...entry, entry: { ...entry.entry, status: "failed" } }
                : entry
            )
          );
        }
      }

      notify(`Cleaned ${succeeded} of ${batch.length} files, removing ${formatBytes(strippedBytes)}.`);
      void recordActivity({
        productId: "imagepilot",
        toolName: "Metadata Cleaner",
        fileName: `${succeeded} cleaned images`,
      });
    } finally {
      setBusy(null);
    }
  }, [batch, cleanOptions, notify]);

  /* ---------------------------------------------------------------------- */
  /* Workspace: batch converter                                             */
  /* ---------------------------------------------------------------------- */

  /** Converts everything queued and downloads the result. */
  const runConversion = useCallback(async () => {
    if (!batch.length) return;
    setBusy(`Converting ${batch.length} image${batch.length === 1 ? "" : "s"}…`);
    setConvertProgress(0);

    const outcomes: Array<Awaited<ReturnType<typeof convertImage>>> = [];
    let originalTotal = 0;

    try {
      for (let index = 0; index < batch.length; index++) {
        const item = batch[index];
        try {
          const decoded = await decodeImage(item.file);
          const outcome = await convertImage(
            decoded.image,
            decoded.width,
            decoded.height,
            convertSettings,
            browserCanvasFactory,
            canvasToBlob,
            {
              originalName: item.entry.name,
              index: convertSettings.startIndex + index,
              originalBytes: item.file.size,
            }
          );
          outcomes.push(outcome);
          originalTotal += item.file.size;

          setBatch((current) =>
            current.map((entry) =>
              entry.entry.id === item.entry.id
                ? {
                    ...entry,
                    entry: { ...entry.entry, status: "done", resultBytes: outcome.blob.size },
                  }
                : entry
            )
          );
        } catch {
          setBatch((current) =>
            current.map((entry) =>
              entry.entry.id === item.entry.id
                ? { ...entry, entry: { ...entry.entry, status: "failed" } }
                : entry
            )
          );
        }
        // Encoding is the bulk of the work; packaging is the remaining tenth.
        setConvertProgress(((index + 1) / batch.length) * 90);
      }

      if (!outcomes.length) {
        notify("Nothing could be converted.", "error");
        return;
      }

      if (outcomes.length === 1) {
        downloadBlob(outcomes[0].blob, outcomes[0].fileName);
      } else {
        const zip = await packageZip(outcomes, (percent) => {
          setConvertProgress(90 + percent * 0.1);
        });
        downloadBlob(zip, `imagepilot-converted-${outcomes.length}.zip`);
      }

      const bytes = totalBytes(outcomes);
      setLastConvertRun({ count: outcomes.length, bytes, originalBytes: originalTotal });
      notify(
        `Converted ${outcomes.length} image${outcomes.length === 1 ? "" : "s"} to ${convertDescriptor(convertSettings.format).label}.`
      );

      void recordActivity({
        productId: "imagepilot",
        toolName: "Batch Converter",
        fileName:
          outcomes.length === 1
            ? outcomes[0].fileName
            : `imagepilot-converted-${outcomes.length}.zip`,
        fileSize: bytes,
        inputFileSize: originalTotal,
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "The conversion failed.",
        "error"
      );
    } finally {
      setBusy(null);
      setConvertProgress(null);
    }
  }, [batch, convertSettings, notify]);

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

      // Only tools this workspace actually exposes are reachable, so a hidden
      // tool cannot be activated by a stray keypress.
      const tool = availableTools.find((entry) => entry.shortcut.toLowerCase() === key);
      if (tool) {
        event.preventDefault();
        dispatch({ type: "set-tool", tool: tool.id });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    applyCrop,
    availableTools,
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
  /* Canvas overlay wiring                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Pointer behaviour contributed by the active workspace.
   *
   * The background remover paints continuously; the blur studio drags out a
   * rectangle. Both reuse the one canvas rather than each introducing its own.
   */
  const canvasOverlay = useMemo(() => {
    if (workspace.id === "background" && brushActive) {
      return {
        mode: "brush" as const,
        cursor: "crosshair",
        brushRadius: brushSize / 2,
        onMove: (point: { x: number; y: number }) => paintBrush(point.x, point.y),
      };
    }
    if (workspace.id === "blur") {
      return {
        mode: "drag" as const,
        cursor: "crosshair",
        onEnd: (rect: { x: number; y: number; width: number; height: number }) => {
          // Ignore an accidental click; a region needs real area.
          if (rect.width < 6 || rect.height < 6) return;
          addRegion(rect);
        },
      };
    }
    return undefined;
  }, [addRegion, brushActive, brushSize, paintBrush, workspace.id]);

  /**
   * Region outlines drawn over the canvas.
   *
   * Regions live in the photo's pixel grid, so they are converted back into
   * document space for display.
   */
  const overlayRects = useMemo(() => {
    if (workspace.id !== "blur" || !regions.length || !matteFrame) return undefined;
    const layer = doc.layers.find((entry) => entry.id === matteFrame.layerId);
    if (!layer) return undefined;

    const scaleX = layer.width / Math.max(1, matteFrame.width);
    const scaleY = layer.height / Math.max(1, matteFrame.height);

    return regions.map((region) => ({
      id: region.id,
      rect: {
        x: layer.x + region.x * scaleX,
        y: layer.y + region.y * scaleY,
        width: region.width * scaleX,
        height: region.height * scaleY,
      },
      selected: region.id === selectedRegion,
      ellipse: region.shape === "ellipse",
    }));
  }, [doc.layers, matteFrame, regions, selectedRegion, workspace.id]);

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
        accept={workspace.id === "convert" ? CONVERT_INPUT_ACCEPT : IMPORT_ACCEPT}
        multiple
        aria-label="Import images"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (!files.length) return;

          // One hidden input serves three pickers; the mode ref says which.
          const mode = pickerModeRef.current;
          pickerModeRef.current = "import";

          if (mode === "logo") {
            void loadLogo(files[0]);
            return;
          }
          if (mode === "backdrop") {
            void loadBackdrop(files[0]);
            return;
          }
          if (mode === "batch") {
            queueBatch(files);
            return;
          }
          void importFiles(files, importModeRef.current);
        }}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Top toolbar                                                      */}
      {/* ---------------------------------------------------------------- */}
      <header className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5">
        {/*
          Workspace switcher. Every tool is the same editor with a different
          configuration, so moving between them is a navigation, not a reload
          into a different application.
        */}
        <div className="relative">
          <label htmlFor="workspace-switch" className="sr-only">
            Switch tool
          </label>
          <select
            id="workspace-switch"
            value={workspace.id}
            onChange={(event) => {
              const next = workspaces.find((entry) => entry.id === event.target.value);
              if (next) router.push(workspaceHref(next));
            }}
            className="h-8 rounded-lg border border-border/60 bg-background pl-2 pr-6 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {workspaces.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

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
          {availableTools.map((tool, index) => (
            <div key={tool.id} className="contents">
              {index > 0 && availableTools[index - 1].group !== tool.group && (
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
            overlay={canvasOverlay}
            overlayRects={overlayRects}
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
            {workspace.panels.map((panelId) => {
              const tab = PANEL_TABS[panelId];
              return (
              <button
                key={panelId}
                type="button"
                aria-pressed={rightTab === panelId}
                onClick={() => setRightTab(panelId)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium transition-colors",
                  rightTab === panelId
                    ? "border-b-2 border-primary text-foreground"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
              );
            })}
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
            {rightTab === "properties" && (
              <PropertiesPanel
                document={doc}
                selection={selected}
                dispatch={dispatch}
                onResizeCanvas={() => setDialog("resize")}
              />
            )}
            {rightTab === "adjust" && (
              <AdjustmentsPanel layer={activeLayer} dispatch={dispatch} />
            )}
            {rightTab === "watermark" && (
              <WatermarkPanel
                settings={watermark}
                batchCount={batch.length}
                hasLogo={Boolean(logoSourceId)}
                busy={Boolean(busy)}
                onChange={(patch) => setWatermark((current) => ({ ...current, ...patch }))}
                onChooseLogo={() => {
                  pickerModeRef.current = "logo";
                  fileInputRef.current?.click();
                }}
                onAddBatchImages={() => {
                  pickerModeRef.current = "batch";
                  fileInputRef.current?.click();
                }}
                onRunBatch={() => void runWatermarkBatch()}
                onClearBatch={() => setBatch([])}
              />
            )}
            {rightTab === "passport" && (
              <PassportPanel
                spec={passportSpec}
                dpi={passportDpi}
                background={passportBackground}
                copies={passportCopies}
                sheetId={passportSheet}
                showGuides={passportGuides}
                busy={Boolean(busy)}
                onSpecChange={setPassportSpecId}
                onDpiChange={setPassportDpi}
                onBackgroundChange={setPassportBackground}
                onCopiesChange={setPassportCopies}
                onSheetChange={setPassportSheet}
                onToggleGuides={setPassportGuides}
                onRefit={() => refitPassport()}
                onExportSheet={() => void exportPrintSheet()}
              />
            )}
            {rightTab === "background" && (
              <BackgroundPanel
                settings={removal}
                backdrop={backdrop}
                backdropColor={backdropColor}
                hasBackdropImage={Boolean(backdropSourceId)}
                brushMode={brushMode}
                brushSize={brushSize}
                brushActive={brushActive}
                showMask={showMask}
                compare={compareBefore}
                removedPercent={matteInfo?.removed ?? null}
                working={matteWorking}
                busy={Boolean(busy)}
                onChange={(patch) => setRemoval((current) => ({ ...current, ...patch }))}
                onBackdropChange={setBackdrop}
                onBackdropColorChange={setBackdropColor}
                onChooseBackdropImage={() => {
                  pickerModeRef.current = "backdrop";
                  fileInputRef.current?.click();
                }}
                onBrushModeChange={setBrushMode}
                onBrushSizeChange={setBrushSize}
                onToggleBrush={setBrushActive}
                onToggleMask={setShowMask}
                onToggleCompare={setCompareBefore}
                onRecompute={recomputeMatte}
                onResetBrush={resetBrushStrokes}
              />
            )}
            {rightTab === "blur" && (
              <BlurPanel
                presetId={regionPreset}
                regions={regions}
                selectedId={selectedRegion}
                busy={Boolean(busy)}
                onPresetChange={setRegionPreset}
                onSelect={setSelectedRegion}
                onUpdate={(id, patch) =>
                  setRegions((current) =>
                    current.map((region) => (region.id === id ? { ...region, ...patch } : region))
                  )
                }
                onRemove={(id) => {
                  setRegions((current) => current.filter((region) => region.id !== id));
                  setSelectedRegion((current) => (current === id ? null : current));
                }}
                onClear={() => {
                  setRegions([]);
                  setSelectedRegion(null);
                }}
              />
            )}
            {rightTab === "metadata" && (
              <MetadataPanel
                report={metaReport}
                options={cleanOptions}
                fileName={sourceFile?.name ?? null}
                batch={batch.map((item) => item.entry)}
                busy={Boolean(busy)}
                onChange={(patch) => setCleanOptions((current) => ({ ...current, ...patch }))}
                onClean={downloadCleaned}
                onAddBatchImages={() => {
                  pickerModeRef.current = "batch";
                  fileInputRef.current?.click();
                }}
                onRunBatch={() => void runMetadataBatch()}
                onClearBatch={() => setBatch([])}
              />
            )}
            {rightTab === "convert" && (
              <ConvertPanel
                settings={convertSettings}
                supported={supportedFormats}
                batch={batch.map((item) => item.entry)}
                busy={Boolean(busy)}
                progress={convertProgress}
                lastRun={lastConvertRun}
                onChange={(patch) => setConvertSettings((current) => ({ ...current, ...patch }))}
                onAddImages={() => {
                  pickerModeRef.current = "batch";
                  fileInputRef.current?.click();
                }}
                onRun={() => void runConversion()}
                onClear={() => {
                  setBatch([]);
                  setLastConvertRun(null);
                }}
              />
            )}
            {rightTab === "compress" && (
              <CompressPanel
                settings={compression}
                originalBytes={sourceFile?.bytes ?? 0}
                previewBytes={compressPreview?.bytes ?? null}
                previewing={compressing}
                missedTarget={compressPreview?.missedTarget ?? false}
                achievedQuality={compressPreview?.quality ?? null}
                outputSize={
                  compressPreview
                    ? { width: compressPreview.width, height: compressPreview.height }
                    : null
                }
                batch={batch.map((item) => item.entry)}
                busy={Boolean(busy)}
                onChange={(patch) => setCompression((current) => ({ ...current, ...patch }))}
                onAddBatchImages={() => {
                  pickerModeRef.current = "batch";
                  fileInputRef.current?.click();
                }}
                onRunBatch={() => void runCompressBatch()}
                onClearBatch={() => setBatch([])}
                onDownload={() => void downloadCompressed()}
              />
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
