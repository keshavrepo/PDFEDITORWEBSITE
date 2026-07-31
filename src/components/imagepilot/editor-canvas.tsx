"use client";

/**
 * The editor workspace: canvas, overlays, rulers and all pointer interaction.
 *
 * Two stacked canvases are used. The lower one holds the composited document
 * and is only redrawn when the document actually changes; the upper one holds
 * the selection box, handles, guides and crop shade and is redrawn on every
 * pointer move. Separating them keeps dragging smooth on large images, because
 * a 4000px document is not recomposited sixty times a second just to move a
 * selection rectangle.
 *
 * All pointer state lives in refs rather than React state. A drag updates
 * dozens of times per second and routing that through the reducer would
 * re-render the whole editor on every mouse move; the reducer is only told
 * about the result.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
  applyAspectRatio,
  clampRectToDocument,
  createShapeLayer,
  createTextLayer,
  documentToScreen,
  handleCursor,
  handlePositions,
  layerBounds,
  measureTextLayer,
  pickLayer,
  rectFromPoints,
  renderDocument,
  resizeLayer,
  rotationTowards,
  rulerTicks,
  screenToDocument,
  snapRect,
  stepZoom,
  zoomAtPoint,
  type EditorDocument,
  type Layer,
  type Point,
  type Rect,
  type ShapeKind,
  type SnapGuide,
  type TransformHandle,
  type Viewport,
} from "@/lib/imagepilot/core";
import { browserCanvasFactory, type RasterStore } from "@/lib/imagepilot/raster";
import type { EditorAction, EditorState } from "@/lib/imagepilot/editor-state";

const RULER_SIZE = 20;
/** Screen-space size of a transform handle. */
const HANDLE_SIZE = 9;
/** How far above the top edge the rotation grip sits, in screen pixels. */
const ROTATE_OFFSET = 22;
/** Minimum drag distance before a click becomes a drag, in screen pixels. */
const DRAG_THRESHOLD = 3;

type DragKind =
  | { kind: "none" }
  | { kind: "pan"; startX: number; startY: number; startPan: { x: number; y: number } }
  | {
      kind: "move";
      startDoc: { x: number; y: number };
      origins: Array<{ id: string; x: number; y: number }>;
      moved: boolean;
    }
  | {
      kind: "resize";
      handle: TransformHandle;
      layerId: string;
      origin: Layer;
      startDoc: { x: number; y: number };
    }
  | { kind: "rotate"; layerId: string; origin: Layer; startAngle: number; pointerAngle: number }
  | { kind: "marquee"; startDoc: { x: number; y: number } }
  | { kind: "crop"; startDoc: { x: number; y: number }; handle: TransformHandle | null; origin: Rect }
  | { kind: "draw"; shape: ShapeKind; startDoc: { x: number; y: number } }
  | { kind: "overlay"; startDoc: { x: number; y: number }; lastDoc: { x: number; y: number } };

interface EditorCanvasProps {
  state: EditorState;
  document: EditorDocument;
  rasters: RasterStore;
  dispatch: (action: EditorAction) => void;
  /** Bumped by the host whenever a raster is added, to force a repaint. */
  rasterVersion: number;
  cropRatio: number | null;
  onRequestTextEdit: (layerId: string) => void;
  /**
   * Optional workspace-specific pointer behaviour.
   *
   * When supplied it takes precedence over the normal move/select handling for
   * the duration of the gesture. This is how the background remover's brush
   * and the blur studio's region drags reuse the canvas rather than each one
   * needing its own surface.
   */
  overlay?: {
    /** "brush" paints continuously; "drag" reports a rectangle on release. */
    mode: "brush" | "drag";
    cursor?: string;
    /** Screen-space radius drawn as a ring, for the brush. */
    brushRadius?: number;
    onStart?: (point: Point) => void;
    onMove?: (point: Point) => void;
    onEnd?: (rect: Rect, start: Point, end: Point) => void;
  };
  /** Rectangles drawn over the canvas, e.g. obscure regions. */
  overlayRects?: Array<{ id: string; rect: Rect; selected: boolean; ellipse: boolean }>;
}

export function EditorCanvas({
  state,
  document: doc,
  rasters,
  dispatch,
  rasterVersion,
  cropRatio,
  onRequestTextEdit,
  overlay,
  overlayRects,
}: EditorCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragKind>({ kind: "none" });
  const guidesRef = useRef<SnapGuide[]>([]);
  const spaceRef = useRef(false);
  /** Live document during a drag, so the scene reflects the gesture. */
  const previewRef = useRef<EditorDocument | null>(null);
  /** Rectangle being dragged by a workspace overlay. */
  const previewRectRef = useRef<Rect | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState("default");
  const [pointerDoc, setPointerDoc] = useState<{ x: number; y: number } | null>(null);

  const { viewport, settings, selection, tool, crop, marquee } = state;
  const showRulers = settings.showRulers;
  const inset = showRulers ? RULER_SIZE : 0;

  /* ---------------------------------------------------------------------- */
  /* Sizing                                                                 */
  /* ---------------------------------------------------------------------- */

  useLayoutEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Coordinate helpers                                                     */
  /* ---------------------------------------------------------------------- */

  /** Pointer position in workspace pixels, excluding the rulers. */
  const toWorkspace = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: event.clientX - rect.left - inset, y: event.clientY - rect.top - inset };
    },
    [inset]
  );

  const toDoc = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const workspace = toWorkspace(event);
      return screenToDocument(viewport, workspace.x, workspace.y);
    },
    [toWorkspace, viewport]
  );

  /* ---------------------------------------------------------------------- */
  /* Scene rendering                                                        */
  /* ---------------------------------------------------------------------- */

  const paintScene = useCallback(() => {
    const canvas = sceneRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, size.width - inset);
    const height = Math.max(1, size.height - inset);

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const active = previewRef.current ?? doc;
    const zoom = viewport.zoom;
    const canvasWidth = active.width * zoom;
    const canvasHeight = active.height * zoom;

    // Chequerboard so transparency is legible, drawn only under the canvas.
    if (settings.showTransparency) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(viewport.panX, viewport.panY, canvasWidth, canvasHeight);
      ctx.clip();
      const cell = 10;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(viewport.panX, viewport.panY, canvasWidth, canvasHeight);
      ctx.fillStyle = "#e2e2e5";
      const startX = Math.floor(viewport.panX / cell) * cell;
      const startY = Math.floor(viewport.panY / cell) * cell;
      for (let y = startY; y < viewport.panY + canvasHeight; y += cell) {
        for (let x = startX; x < viewport.panX + canvasWidth; x += cell) {
          if ((Math.round(x / cell) + Math.round(y / cell)) % 2 === 0) continue;
          ctx.fillRect(x, y, cell, cell);
        }
      }
      ctx.restore();
    }

    // Drop shadow marking the canvas edge against the workspace.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(0,0,0,0.001)";
    ctx.fillRect(viewport.panX, viewport.panY, canvasWidth, canvasHeight);
    ctx.restore();

    // Compose the document into a buffer at device resolution, then blit. A
    // separate buffer is required because the renderer owns its own transform.
    const bufferWidth = Math.max(1, Math.min(Math.ceil(canvasWidth * dpr), 8192));
    const bufferHeight = Math.max(1, Math.min(Math.ceil(canvasHeight * dpr), 8192));
    const renderScale = Math.min(
      (zoom * dpr * bufferWidth) / Math.max(1, canvasWidth * dpr),
      bufferWidth / active.width
    );

    try {
      const buffer = browserCanvasFactory.create(bufferWidth, bufferHeight);
      renderDocument(buffer.ctx, active, rasters, {
        scale: renderScale,
        canvasFactory: browserCanvasFactory,
        // Spatial radii track the document, not the zoom, so a blur looks the
        // same on screen as it will in the export.
        filterScale: renderScale,
        skipLayers: state.editingTextId ? [state.editingTextId] : undefined,
      });
      ctx.imageSmoothingEnabled = zoom < 1;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(buffer.canvas, viewport.panX, viewport.panY, canvasWidth, canvasHeight);
    } catch {
      // A failed allocation must not blank the workspace; the next paint at a
      // lower zoom will succeed.
    }

    // Grid, drawn over the artwork so it stays visible on dark images.
    if (settings.showGrid && settings.gridSize > 0 && settings.gridSize * zoom > 4) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(viewport.panX, viewport.panY, canvasWidth, canvasHeight);
      ctx.clip();
      ctx.strokeStyle = "rgba(120,120,140,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= active.width; x += settings.gridSize) {
        const screenX = Math.round(viewport.panX + x * zoom) + 0.5;
        ctx.moveTo(screenX, viewport.panY);
        ctx.lineTo(screenX, viewport.panY + canvasHeight);
      }
      for (let y = 0; y <= active.height; y += settings.gridSize) {
        const screenY = Math.round(viewport.panY + y * zoom) + 0.5;
        ctx.moveTo(viewport.panX, screenY);
        ctx.lineTo(viewport.panX + canvasWidth, screenY);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [doc, inset, rasters, settings, size, state.editingTextId, viewport]);

  /* ---------------------------------------------------------------------- */
  /* Overlay rendering                                                      */
  /* ---------------------------------------------------------------------- */

  const paintOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, size.width - inset);
    const height = Math.max(1, size.height - inset);

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const active = previewRef.current ?? doc;
    const toScreen = (x: number, y: number) => documentToScreen(viewport, x, y);

    // Canvas border.
    const origin = toScreen(0, 0);
    ctx.strokeStyle = "rgba(140,140,160,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(origin.x) + 0.5,
      Math.round(origin.y) + 0.5,
      Math.round(active.width * viewport.zoom),
      Math.round(active.height * viewport.zoom)
    );

    // Crop shade: everything outside the crop box is dimmed.
    if (crop) {
      const topLeft = toScreen(crop.x, crop.y);
      const cropWidth = crop.width * viewport.zoom;
      const cropHeight = crop.height * viewport.zoom;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.rect(origin.x, origin.y, active.width * viewport.zoom, active.height * viewport.zoom);
      // A reversed inner rectangle punches the hole via the even-odd rule.
      ctx.rect(topLeft.x + cropWidth, topLeft.y, -cropWidth, cropHeight);
      ctx.fill("evenodd");
      ctx.restore();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(topLeft.x, topLeft.y, cropWidth, cropHeight);

      // Rule-of-thirds guides.
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(topLeft.x + (cropWidth * i) / 3, topLeft.y);
        ctx.lineTo(topLeft.x + (cropWidth * i) / 3, topLeft.y + cropHeight);
        ctx.moveTo(topLeft.x, topLeft.y + (cropHeight * i) / 3);
        ctx.lineTo(topLeft.x + cropWidth, topLeft.y + (cropHeight * i) / 3);
      }
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      for (const [hx, hy] of [
        [topLeft.x, topLeft.y],
        [topLeft.x + cropWidth / 2, topLeft.y],
        [topLeft.x + cropWidth, topLeft.y],
        [topLeft.x + cropWidth, topLeft.y + cropHeight / 2],
        [topLeft.x + cropWidth, topLeft.y + cropHeight],
        [topLeft.x + cropWidth / 2, topLeft.y + cropHeight],
        [topLeft.x, topLeft.y + cropHeight],
        [topLeft.x, topLeft.y + cropHeight / 2],
      ]) {
        ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      }
    }

    // Marquee selection, drawn as a dashed rectangle.
    if (marquee) {
      const topLeft = toScreen(marquee.x, marquee.y);
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(
        topLeft.x,
        topLeft.y,
        marquee.width * viewport.zoom,
        marquee.height * viewport.zoom
      );
      ctx.fillStyle = "rgba(37,99,235,0.08)";
      ctx.fillRect(topLeft.x, topLeft.y, marquee.width * viewport.zoom, marquee.height * viewport.zoom);
      ctx.restore();
    }

    // Snap guides.
    for (const guide of guidesRef.current) {
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (guide.axis === "x") {
        const x = Math.round(toScreen(guide.position, 0).x) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      } else {
        const y = Math.round(toScreen(0, guide.position).y) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Workspace overlay rectangles, e.g. obscure regions.
    if (overlayRects?.length) {
      for (const entry of overlayRects) {
        const topLeft = toScreen(entry.rect.x, entry.rect.y);
        const w = entry.rect.width * viewport.zoom;
        const h = entry.rect.height * viewport.zoom;

        ctx.save();
        ctx.strokeStyle = entry.selected ? "#2563eb" : "rgba(37,99,235,0.55)";
        ctx.lineWidth = entry.selected ? 2 : 1.5;
        ctx.setLineDash(entry.selected ? [] : [5, 4]);
        if (entry.ellipse) {
          ctx.beginPath();
          ctx.ellipse(topLeft.x + w / 2, topLeft.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeRect(topLeft.x, topLeft.y, w, h);
        }
        ctx.restore();
      }
    }

    // Rectangle being dragged right now.
    if (previewRectRef.current) {
      const rect = previewRectRef.current;
      const topLeft = toScreen(rect.x, rect.y);
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(topLeft.x, topLeft.y, rect.width * viewport.zoom, rect.height * viewport.zoom);
      ctx.fillStyle = "rgba(37,99,235,0.1)";
      ctx.fillRect(topLeft.x, topLeft.y, rect.width * viewport.zoom, rect.height * viewport.zoom);
      ctx.restore();
    }

    // Brush ring, so the user can see the size before painting.
    if (overlay?.mode === "brush" && overlay.brushRadius && pointerDoc) {
      const centre = toScreen(pointerDoc.x, pointerDoc.y);
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, overlay.brushRadius * viewport.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.restore();
    }

    // Selection boxes and transform handles.
    if (!crop && tool !== "crop") {
      const selected = active.layers.filter((layer) => selection.includes(layer.id));

      for (const layer of selected) {
        const corners = handlePositions(layer);
        const screenCorners = {
          nw: toScreen(corners.nw.x, corners.nw.y),
          ne: toScreen(corners.ne.x, corners.ne.y),
          se: toScreen(corners.se.x, corners.se.y),
          sw: toScreen(corners.sw.x, corners.sw.y),
        };

        ctx.save();
        ctx.strokeStyle = layer.locked ? "#f59e0b" : "#2563eb";
        ctx.lineWidth = 1.5;
        if (layer.locked) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(screenCorners.nw.x, screenCorners.nw.y);
        ctx.lineTo(screenCorners.ne.x, screenCorners.ne.y);
        ctx.lineTo(screenCorners.se.x, screenCorners.se.y);
        ctx.lineTo(screenCorners.sw.x, screenCorners.sw.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Handles only appear for a single unlocked layer; a multi-selection
        // would need a common frame, and resizing a locked layer is refused.
        if (selected.length !== 1 || layer.locked) continue;

        const north = toScreen(corners.n.x, corners.n.y);
        const angle = (layer.rotation * Math.PI) / 180;
        const gripX = north.x + Math.sin(angle) * ROTATE_OFFSET;
        const gripY = north.y - Math.cos(angle) * ROTATE_OFFSET;

        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(north.x, north.y);
        ctx.lineTo(gripX, gripY);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#2563eb";
        ctx.beginPath();
        ctx.arc(gripX, gripY, HANDLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const) {
          const point = toScreen(corners[handle].x, corners[handle].y);
          ctx.beginPath();
          ctx.rect(
            point.x - HANDLE_SIZE / 2,
            point.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }, [crop, doc, inset, marquee, overlay, overlayRects, pointerDoc, selection, size, tool, viewport]);

  useEffect(() => {
    paintScene();
  }, [paintScene, rasterVersion]);

  useEffect(() => {
    paintOverlay();
  }, [paintOverlay]);

  /* ---------------------------------------------------------------------- */
  /* Hit testing                                                            */
  /* ---------------------------------------------------------------------- */

  /** Transform handle under the pointer, in screen space. */
  const handleAt = useCallback(
    (screenX: number, screenY: number): TransformHandle | null => {
      if (selection.length !== 1) return null;
      const layer = doc.layers.find((entry) => entry.id === selection[0]);
      if (!layer || layer.locked) return null;

      const corners = handlePositions(layer);
      const tolerance = HANDLE_SIZE;

      const north = documentToScreen(viewport, corners.n.x, corners.n.y);
      const angle = (layer.rotation * Math.PI) / 180;
      const gripX = north.x + Math.sin(angle) * ROTATE_OFFSET;
      const gripY = north.y - Math.cos(angle) * ROTATE_OFFSET;
      if (Math.hypot(screenX - gripX, screenY - gripY) <= tolerance) return "rotate";

      for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const) {
        const point = documentToScreen(viewport, corners[handle].x, corners[handle].y);
        if (Math.abs(screenX - point.x) <= tolerance && Math.abs(screenY - point.y) <= tolerance) {
          return handle;
        }
      }
      return null;
    },
    [doc.layers, selection, viewport]
  );

  /** Crop handle under the pointer. */
  const cropHandleAt = useCallback(
    (screenX: number, screenY: number): TransformHandle | null => {
      if (!crop) return null;
      const topLeft = documentToScreen(viewport, crop.x, crop.y);
      const w = crop.width * viewport.zoom;
      const h = crop.height * viewport.zoom;
      const spots: Array<[TransformHandle, number, number]> = [
        ["nw", topLeft.x, topLeft.y],
        ["n", topLeft.x + w / 2, topLeft.y],
        ["ne", topLeft.x + w, topLeft.y],
        ["e", topLeft.x + w, topLeft.y + h / 2],
        ["se", topLeft.x + w, topLeft.y + h],
        ["s", topLeft.x + w / 2, topLeft.y + h],
        ["sw", topLeft.x, topLeft.y + h],
        ["w", topLeft.x, topLeft.y + h / 2],
      ];
      for (const [handle, hx, hy] of spots) {
        if (Math.abs(screenX - hx) <= HANDLE_SIZE && Math.abs(screenY - hy) <= HANDLE_SIZE) {
          return handle;
        }
      }
      return null;
    },
    [crop, viewport]
  );

  /* ---------------------------------------------------------------------- */
  /* Pointer handling                                                       */
  /* ---------------------------------------------------------------------- */

  const beginPan = useCallback(
    (event: ReactPointerEvent) => {
      dragRef.current = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        startPan: { x: viewport.panX, y: viewport.panY },
      };
      setCursor("grabbing");
    },
    [viewport.panX, viewport.panY]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button === 2) return;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);

      const workspace = toWorkspace(event);
      const point = screenToDocument(viewport, workspace.x, workspace.y);

      // Middle mouse, the hand tool and held space all pan.
      if (event.button === 1 || tool === "hand" || spaceRef.current) {
        beginPan(event);
        return;
      }

      // A workspace overlay owns the gesture when one is active.
      if (overlay) {
        dragRef.current = { kind: "overlay", startDoc: point, lastDoc: point };
        overlay.onStart?.(point);
        if (overlay.mode === "brush") overlay.onMove?.(point);
        return;
      }

      if (tool === "zoom") {
        const next = stepZoom(viewport.zoom, event.altKey ? -1 : 1);
        dispatch({
          type: "set-viewport",
          viewport: zoomAtPoint(viewport, next, workspace.x, workspace.y),
        });
        return;
      }

      if (tool === "crop") {
        const handle = cropHandleAt(workspace.x, workspace.y);
        if (handle || crop) {
          const inside =
            crop &&
            point.x >= crop.x &&
            point.x <= crop.x + crop.width &&
            point.y >= crop.y &&
            point.y <= crop.y + crop.height;
          if (handle || inside) {
            dragRef.current = {
              kind: "crop",
              startDoc: point,
              handle,
              origin: crop ?? { x: 0, y: 0, width: doc.width, height: doc.height },
            };
            return;
          }
        }
        // Starting outside an existing box draws a new one.
        dragRef.current = {
          kind: "crop",
          startDoc: point,
          handle: "se",
          origin: { x: point.x, y: point.y, width: 0, height: 0 },
        };
        dispatch({ type: "set-crop", rect: { x: point.x, y: point.y, width: 0, height: 0 } });
        return;
      }

      if (tool === "select") {
        dragRef.current = { kind: "marquee", startDoc: point };
        dispatch({ type: "set-marquee", rect: { x: point.x, y: point.y, width: 0, height: 0 } });
        return;
      }

      if (tool === "text") {
        const layer = createTextLayer("Double-click to edit", {
          x: point.x,
          y: point.y,
          // Sized so the default 48px type fits without immediately wrapping.
          width: 360,
          height: 60,
        });
        dispatch({ type: "add-layer", layer });
        dispatch({ type: "set-tool", tool: "move" });
        // The new layer has to exist before it can be edited inline.
        setTimeout(() => onRequestTextEdit(layer.id), 0);
        return;
      }

      if (tool !== "move") {
        dragRef.current = { kind: "draw", shape: tool as ShapeKind, startDoc: point };
        return;
      }

      // Move tool: handles first, then layers.
      const handle = handleAt(workspace.x, workspace.y);
      if (handle) {
        const layer = doc.layers.find((entry) => entry.id === selection[0]);
        if (layer) {
          dragRef.current =
            handle === "rotate"
              ? {
                  kind: "rotate",
                  layerId: layer.id,
                  origin: layer,
                  startAngle: layer.rotation,
                  pointerAngle: rotationTowards(layer, point.x, point.y),
                }
              : { kind: "resize", handle, layerId: layer.id, origin: layer, startDoc: point };
          return;
        }
      }

      const hit = pickLayer(doc, point.x, point.y);

      if (!hit) {
        // Clicking empty space clears the selection and starts a marquee, so
        // rubber-band selection works without switching tools.
        if (!event.shiftKey) dispatch({ type: "deselect" });
        dragRef.current = { kind: "marquee", startDoc: point };
        dispatch({ type: "set-marquee", rect: { x: point.x, y: point.y, width: 0, height: 0 } });
        return;
      }

      const alreadySelected = selection.includes(hit.id);
      if (event.shiftKey) {
        dispatch({ type: "select", ids: [hit.id], mode: "toggle" });
      } else if (!alreadySelected) {
        dispatch({ type: "select", ids: [hit.id] });
      }

      // Dragging moves the whole selection, so a multi-select drag keeps the
      // group together.
      const movingIds = event.shiftKey
        ? []
        : alreadySelected
          ? selection
          : [hit.id];
      const origins = doc.layers
        .filter((layer) => movingIds.includes(layer.id) && !layer.locked)
        .map((layer) => ({ id: layer.id, x: layer.x, y: layer.y }));

      if (origins.length) {
        dragRef.current = { kind: "move", startDoc: point, origins, moved: false };
      }
    },
    [
      beginPan,
      crop,
      cropHandleAt,
      dispatch,
      doc,
      handleAt,
      onRequestTextEdit,
      overlay,
      selection,
      tool,
      toWorkspace,
      viewport,
    ]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const workspace = toWorkspace(event);
      const point = screenToDocument(viewport, workspace.x, workspace.y);
      setPointerDoc(point);

      const drag = dragRef.current;

      if (drag.kind === "none") {
        // Idle: reflect what a click would do.
        if (overlay) {
          setCursor(overlay.cursor ?? "crosshair");
          if (overlay.mode === "brush") paintOverlay();
          return;
        }
        if (tool === "hand" || spaceRef.current) setCursor("grab");
        else if (tool === "zoom") setCursor("zoom-in");
        else if (tool === "crop") {
          const handle = cropHandleAt(workspace.x, workspace.y);
          setCursor(handle ? handleCursor(handle, 0) : "crosshair");
        } else if (tool !== "move") setCursor("crosshair");
        else {
          const handle = handleAt(workspace.x, workspace.y);
          if (handle) {
            const layer = doc.layers.find((entry) => entry.id === selection[0]);
            setCursor(handleCursor(handle, layer?.rotation ?? 0));
          } else {
            setCursor(pickLayer(doc, point.x, point.y) ? "move" : "default");
          }
        }
        return;
      }

      switch (drag.kind) {
        case "pan": {
          dispatch({
            type: "set-viewport",
            viewport: {
              ...viewport,
              panX: drag.startPan.x + (event.clientX - drag.startX),
              panY: drag.startPan.y + (event.clientY - drag.startY),
            },
          });
          break;
        }

        case "move": {
          let deltaX = point.x - drag.startDoc.x;
          let deltaY = point.y - drag.startDoc.y;

          if (
            !drag.moved &&
            Math.hypot(deltaX * viewport.zoom, deltaY * viewport.zoom) < DRAG_THRESHOLD
          ) {
            return;
          }
          drag.moved = true;

          // Shift constrains to the dominant axis.
          if (event.shiftKey) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) deltaY = 0;
            else deltaX = 0;
          }

          let guides: SnapGuide[] = [];
          if (settings.snapEnabled && drag.origins.length === 1) {
            const layer = doc.layers.find((entry) => entry.id === drag.origins[0].id);
            if (layer) {
              const bounds = layerBounds({
                ...layer,
                x: drag.origins[0].x + deltaX,
                y: drag.origins[0].y + deltaY,
              });
              const snapped = snapRect(bounds, doc, {
                zoom: viewport.zoom,
                excludeIds: drag.origins.map((entry) => entry.id),
                gridSize: settings.gridSize,
                snapToGrid: settings.snapToGrid,
              });
              deltaX += snapped.x - bounds.x;
              deltaY += snapped.y - bounds.y;
              guides = snapped.guides;
            }
          }

          guidesRef.current = guides;
          const moved = new Map(drag.origins.map((entry) => [entry.id, entry]));
          previewRef.current = {
            ...doc,
            layers: doc.layers.map((layer) => {
              const origin = moved.get(layer.id);
              if (!origin) return layer;
              return { ...layer, x: origin.x + deltaX, y: origin.y + deltaY };
            }),
          };
          paintScene();
          paintOverlay();
          break;
        }

        case "resize": {
          const rect = resizeLayer(
            drag.origin,
            drag.handle,
            point.x - drag.startDoc.x,
            point.y - drag.startDoc.y,
            {
              // Shift preserves the ratio; images default to preserving it and
              // shift releases the constraint, matching every design tool.
              preserveRatio:
                drag.origin.type === "image" ? !event.shiftKey : event.shiftKey,
              fromCenter: event.altKey,
            }
          );

          previewRef.current = {
            ...doc,
            layers: doc.layers.map((layer) => {
              if (layer.id !== drag.layerId) return layer;
              if (layer.type === "text") {
                // Resizing a text box switches it to fixed width so the text
                // reflows instead of the box snapping back on the next render.
                return { ...layer, ...rect, autoSize: false };
              }
              return { ...layer, ...rect };
            }),
          };
          paintScene();
          paintOverlay();
          break;
        }

        case "rotate": {
          const pointerAngle = rotationTowards(drag.origin, point.x, point.y);
          let rotation = drag.startAngle + (pointerAngle - drag.pointerAngle);
          // Shift snaps to 15° increments.
          if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
          rotation = ((rotation % 360) + 360) % 360;

          previewRef.current = {
            ...doc,
            layers: doc.layers.map((layer) =>
              layer.id === drag.layerId ? { ...layer, rotation } : layer
            ),
          };
          paintScene();
          paintOverlay();
          break;
        }

        case "marquee": {
          const rect = rectFromPoints(drag.startDoc, point);
          dispatch({ type: "set-marquee", rect });
          break;
        }

        case "crop": {
          let rect: Rect;
          if (drag.handle) {
            const left = drag.handle.includes("w") ? point.x : drag.origin.x;
            const right = drag.handle.includes("e")
              ? point.x
              : drag.origin.x + drag.origin.width;
            const top = drag.handle.includes("n") ? point.y : drag.origin.y;
            const bottom = drag.handle.includes("s")
              ? point.y
              : drag.origin.y + drag.origin.height;
            rect = {
              x: Math.min(left, right),
              y: Math.min(top, bottom),
              width: Math.abs(right - left),
              height: Math.abs(bottom - top),
            };
            if (cropRatio) rect = applyAspectRatio(rect, cropRatio);
          } else {
            // No handle means the whole box is being dragged.
            rect = {
              ...drag.origin,
              x: drag.origin.x + (point.x - drag.startDoc.x),
              y: drag.origin.y + (point.y - drag.startDoc.y),
            };
          }
          dispatch({ type: "set-crop", rect: clampRectToDocument(rect, doc) });
          break;
        }

        case "overlay": {
          drag.lastDoc = point;
          if (overlay?.mode === "brush") {
            overlay.onMove?.(point);
          } else {
            overlay?.onMove?.(point);
            // Live rectangle feedback while dragging a region.
            previewRectRef.current = rectFromPoints(drag.startDoc, point);
            paintOverlay();
          }
          break;
        }

        case "draw": {
          let rect = rectFromPoints(drag.startDoc, point);
          // Shift constrains to a square/circle, which is what the modifier
          // does in every other editor.
          if (event.shiftKey) {
            const side = Math.max(rect.width, rect.height);
            rect = {
              x: point.x < drag.startDoc.x ? drag.startDoc.x - side : drag.startDoc.x,
              y: point.y < drag.startDoc.y ? drag.startDoc.y - side : drag.startDoc.y,
              width: side,
              height: side,
            };
          }
          // Lines and arrows are drawn point to point, so their box must keep
          // the drag direction rather than being normalised.
          const directional = drag.shape === "line" || drag.shape === "arrow";
          const preview = createShapeLayer(
            drag.shape,
            directional
              ? {
                  x: drag.startDoc.x,
                  y: drag.startDoc.y,
                  width: point.x - drag.startDoc.x,
                  height: point.y - drag.startDoc.y,
                }
              : rect
          );
          previewRef.current = { ...doc, layers: [...doc.layers, preview] };
          paintScene();
          paintOverlay();
          break;
        }
      }
    },
    [
      cropHandleAt,
      cropRatio,
      dispatch,
      doc,
      handleAt,
      overlay,
      paintOverlay,
      paintScene,
      selection,
      settings,
      tool,
      toWorkspace,
      viewport,
    ]
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = { kind: "none" };
      guidesRef.current = [];

      const workspace = toWorkspace(event);
      const point = screenToDocument(viewport, workspace.x, workspace.y);
      const preview = previewRef.current;
      previewRef.current = null;

      switch (drag.kind) {
        case "move": {
          if (drag.moved && preview) {
            dispatch({ type: "commit", document: preview, label: "Move layer" });
          }
          break;
        }

        case "resize": {
          if (preview) dispatch({ type: "commit", document: preview, label: "Resize layer" });
          break;
        }

        case "rotate": {
          if (preview) dispatch({ type: "commit", document: preview, label: "Rotate layer" });
          break;
        }

        case "marquee": {
          const rect = rectFromPoints(drag.startDoc, point);
          // A tiny drag is a click, not a selection.
          if (rect.width * viewport.zoom < DRAG_THRESHOLD || rect.height * viewport.zoom < DRAG_THRESHOLD) {
            dispatch({ type: "set-marquee", rect: null });
            break;
          }
          if (tool === "move") {
            // Rubber band on the move tool selects the layers it touches.
            const ids = doc.layers
              .filter((layer) => {
                if (!layer.visible || layer.locked) return false;
                const bounds = layerBounds(layer);
                return !(
                  bounds.x + bounds.width < rect.x ||
                  rect.x + rect.width < bounds.x ||
                  bounds.y + bounds.height < rect.y ||
                  rect.y + rect.height < bounds.y
                );
              })
              .map((layer) => layer.id);
            dispatch({ type: "set-marquee", rect: null });
            if (ids.length) dispatch({ type: "select", ids, mode: event.shiftKey ? "add" : "replace" });
          }
          break;
        }

        case "crop": {
          if (crop && (crop.width < 4 || crop.height < 4)) {
            dispatch({ type: "set-crop", rect: null });
          }
          break;
        }

        case "draw": {
          if (!preview) break;
          const layer = preview.layers[preview.layers.length - 1];
          const directional = drag.shape === "line" || drag.shape === "arrow";
          const meaningful = directional
            ? Math.hypot(layer.width, layer.height) > 4
            : layer.width > 3 && layer.height > 3;

          if (meaningful) {
            dispatch({ type: "add-layer", layer });
          } else {
            // A bare click drops a default-sized shape rather than nothing.
            dispatch({
              type: "add-layer",
              layer: createShapeLayer(drag.shape, {
                x: drag.startDoc.x,
                y: drag.startDoc.y,
                width: directional ? 120 : 140,
                height: directional ? 120 : 100,
              }),
            });
          }
          dispatch({ type: "set-tool", tool: "move" });
          break;
        }

        case "overlay": {
          previewRectRef.current = null;
          const rect = rectFromPoints(drag.startDoc, point);
          overlay?.onEnd?.(rect, drag.startDoc, point);
          break;
        }

        case "pan":
          setCursor(tool === "hand" ? "grab" : "default");
          break;
      }

      paintScene();
      paintOverlay();
    },
    [crop, dispatch, doc.layers, overlay, paintOverlay, paintScene, tool, toWorkspace, viewport]
  );

  const onDoubleClick = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const point = toDoc(event);
      const hit = pickLayer(doc, point.x, point.y);
      if (hit?.type === "text") onRequestTextEdit(hit.id);
    },
    [doc, onRequestTextEdit, toDoc]
  );

  /* ---------------------------------------------------------------------- */
  /* Wheel: zoom and scroll                                                 */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    // Registered manually because React's onWheel is passive and cannot
    // preventDefault, which the browser needs to stop page zoom.
    const handler = (event: WheelEvent) => {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left - inset;
      const y = event.clientY - rect.top - inset;

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        // Exponential so each notch is a constant proportional step.
        const factor = Math.exp(-event.deltaY * 0.002);
        dispatch({
          type: "set-viewport",
          viewport: zoomAtPoint(viewport, viewport.zoom * factor, x, y),
        });
        return;
      }

      event.preventDefault();
      dispatch({
        type: "set-viewport",
        viewport: {
          ...viewport,
          // Shift swaps the axis, matching every scrollable design surface.
          panX: viewport.panX - (event.shiftKey ? event.deltaY : event.deltaX),
          panY: viewport.panY - (event.shiftKey ? 0 : event.deltaY),
        },
      });
    };

    element.addEventListener("wheel", handler, { passive: false });
    return () => element.removeEventListener("wheel", handler);
  }, [dispatch, inset, viewport]);

  /* ---------------------------------------------------------------------- */
  /* Space to pan                                                           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      // Space is a literal character while typing.
      if (target?.matches("input, textarea, [contenteditable='true'], select")) return;
      event.preventDefault();
      spaceRef.current = true;
      if (dragRef.current.kind === "none") setCursor("grab");
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spaceRef.current = false;
      if (dragRef.current.kind === "none") setCursor("default");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Inline text editing                                                    */
  /* ---------------------------------------------------------------------- */

  const editingLayer = useMemo(() => {
    if (!state.editingTextId) return null;
    const layer = doc.layers.find((entry) => entry.id === state.editingTextId);
    return layer?.type === "text" ? layer : null;
  }, [doc.layers, state.editingTextId]);

  /* ---------------------------------------------------------------------- */
  /* Rulers                                                                 */
  /* ---------------------------------------------------------------------- */

  const horizontalTicks = useMemo(
    () => (showRulers ? rulerTicks(viewport, "x", Math.max(0, size.width - inset)) : []),
    [inset, showRulers, size.width, viewport]
  );
  const verticalTicks = useMemo(
    () => (showRulers ? rulerTicks(viewport, "y", Math.max(0, size.height - inset)) : []),
    [inset, showRulers, size.height, viewport]
  );

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative h-full w-full overflow-hidden",
        settings.darkWorkspace ? "bg-[#16161a]" : "bg-[#e8e8ec]"
      )}
      data-testid="imagepilot-workspace"
    >
      {showRulers && (
        <>
          {/* Corner */}
          <div
            className="absolute left-0 top-0 z-20 border-b border-r border-border/40 bg-background/80"
            style={{ width: RULER_SIZE, height: RULER_SIZE }}
          />
          {/* Horizontal ruler */}
          <div
            className="absolute top-0 z-10 overflow-hidden border-b border-border/40 bg-background/80 text-muted-foreground"
            style={{ left: RULER_SIZE, right: 0, height: RULER_SIZE }}
            aria-hidden="true"
          >
            {horizontalTicks.map((tick, index) => (
              <div
                key={`${tick.value}-${index}`}
                className="absolute bottom-0 border-l border-current"
                style={{
                  left: tick.position,
                  height: tick.major ? RULER_SIZE : 4,
                  opacity: tick.major ? 0.5 : 0.25,
                }}
              >
                {tick.major && (
                  <span className="absolute left-1 top-0 text-[9px] leading-none tabular-nums">
                    {Math.round(tick.value)}
                  </span>
                )}
              </div>
            ))}
            {pointerDoc && (
              <div
                className="absolute bottom-0 top-0 w-px bg-primary"
                style={{ left: documentToScreen(viewport, pointerDoc.x, 0).x }}
              />
            )}
          </div>
          {/* Vertical ruler */}
          <div
            className="absolute left-0 z-10 overflow-hidden border-r border-border/40 bg-background/80 text-muted-foreground"
            style={{ top: RULER_SIZE, bottom: 0, width: RULER_SIZE }}
            aria-hidden="true"
          >
            {verticalTicks.map((tick, index) => (
              <div
                key={`${tick.value}-${index}`}
                className="absolute right-0 border-t border-current"
                style={{
                  top: tick.position,
                  width: tick.major ? RULER_SIZE : 4,
                  opacity: tick.major ? 0.5 : 0.25,
                }}
              >
                {tick.major && (
                  <span
                    className="absolute left-0 top-1 origin-top-left -rotate-90 text-[9px] leading-none tabular-nums"
                    style={{ transformOrigin: "left top", transform: "rotate(-90deg) translateX(-100%)" }}
                  >
                    {Math.round(tick.value)}
                  </span>
                )}
              </div>
            ))}
            {pointerDoc && (
              <div
                className="absolute left-0 right-0 h-px bg-primary"
                style={{ top: documentToScreen(viewport, 0, pointerDoc.y).y }}
              />
            )}
          </div>
        </>
      )}

      <div
        className="absolute touch-none"
        style={{ left: inset, top: inset, right: 0, bottom: 0, cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setPointerDoc(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas ref={sceneRef} className="absolute left-0 top-0" />
        <canvas ref={overlayRef} className="pointer-events-none absolute left-0 top-0" />

        {editingLayer && (
          <InlineTextEditor
            key={editingLayer.id}
            layer={editingLayer}
            viewport={viewport}
            onChange={(text, measured) => {
              dispatch({
                type: "update-layer",
                id: editingLayer.id,
                patch: measured ? { text, ...measured } : { text },
                label: "Edit text",
                mergeKey: `text:${editingLayer.id}`,
              });
            }}
            onFinish={() => dispatch({ type: "edit-text", id: null })}
          />
        )}
      </div>

      {/* Coordinate readout */}
      {pointerDoc && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-background/85 px-2 py-1 text-[10px] tabular-nums text-muted-foreground shadow-sm">
          {Math.round(pointerDoc.x)}, {Math.round(pointerDoc.y)}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline text editor                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Textarea overlaid exactly on top of a text layer.
 *
 * Editing in place rather than in a side panel is what makes the text tool
 * feel like a real editor. The textarea mirrors the layer's font metrics so
 * the caret sits where the glyph will be drawn, and the layer itself is hidden
 * from the scene while editing to avoid a doubled preview.
 */
function InlineTextEditor({
  layer,
  viewport,
  onChange,
  onFinish,
}: {
  layer: Extract<Layer, { type: "text" }>;
  viewport: Viewport;
  onChange: (text: string, measured?: { width: number; height: number }) => void;
  onFinish: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    element.select();
  }, []);

  const screen = documentToScreen(viewport, layer.x, layer.y);
  const zoom = viewport.zoom;

  return (
    <textarea
      ref={ref}
      value={layer.text}
      aria-label="Edit text layer"
      spellCheck={false}
      onChange={(event) => {
        const text = event.target.value;
        if (!layer.autoSize) {
          onChange(text);
          return;
        }
        // Auto-sizing layers grow with their content, so the box is remeasured
        // through the same code path the renderer uses.
        try {
          const { ctx } = browserCanvasFactory.create(8, 8);
          const metrics = measureTextLayer(ctx, { ...layer, text });
          onChange(text, { width: Math.max(8, metrics.width), height: metrics.height });
        } catch {
          onChange(text);
        }
      }}
      onBlur={onFinish}
      onKeyDown={(event) => {
        // Escape and Ctrl/Cmd+Enter finish; plain Enter inserts a newline.
        if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
          event.preventDefault();
          onFinish();
        }
        event.stopPropagation();
      }}
      style={{
        position: "absolute",
        left: screen.x,
        top: screen.y,
        width: Math.max(20, layer.width * zoom),
        height: Math.max(20, layer.height * zoom),
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize * zoom,
        fontWeight: layer.fontWeight,
        fontStyle: layer.italic ? "italic" : "normal",
        lineHeight: layer.lineHeight,
        letterSpacing: `${layer.letterSpacing * zoom}px`,
        textAlign: layer.align,
        color: layer.color,
        background: "transparent",
        border: "1px dashed #2563eb",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        padding: 0,
        margin: 0,
        // Match the renderer's alphabetic baseline placement.
        transform: `rotate(${layer.rotation}deg)`,
        transformOrigin: "center",
        caretColor: "#2563eb",
      }}
    />
  );
}
