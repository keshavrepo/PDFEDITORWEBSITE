"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface PdfPagePreviewProps {
  file: File | null;
  pageIndex: number;
  /** Longest edge of the rendered preview, in CSS pixels. */
  maxSize?: number;
  className?: string;
  /** Called once a page has rendered, with its size in points and pixels. */
  onRendered?: (info: {
    pageWidth: number;
    pageHeight: number;
    pixelWidth: number;
    pixelHeight: number;
  }) => void;
  /** Overlay drawn above the page, positioned by the caller. */
  children?: React.ReactNode;
}

/**
 * Renders a single PDF page to a canvas for live previews.
 *
 * Used by the crop and redact tools so users can see exactly what they are
 * selecting. Rendering is cancelled when the page or file changes so rapid
 * navigation cannot leave a stale frame on screen.
 */
export function PdfPagePreview({
  file,
  pageIndex,
  maxSize = 700,
  className,
  onRendered,
  children,
}: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderSequence = useRef(0);
  const onRenderedRef = useRef(onRendered);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without making it a render dependency.
  useEffect(() => {
    onRenderedRef.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    if (!file) return;
    const sequence = ++renderSequence.current;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;

    async function render() {
      setLoading(true);
      setError(null);

      try {
        const [{ loadPdfJs }, buffer] = await Promise.all([
          import("@/lib/conversion/pdf/pdf-loader"),
          file!.arrayBuffer(),
        ]);
        if (cancelled || sequence !== renderSequence.current) return;

        const pdfjs = await loadPdfJs();
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(buffer),
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
        });
        task = loadingTask;

        const document = await loadingTask.promise;
        if (cancelled || sequence !== renderSequence.current) return;

        const safeIndex = Math.max(0, Math.min(pageIndex, document.numPages - 1));
        const page = await document.getPage(safeIndex + 1);
        const base = page.getViewport({ scale: 1 });
        const scale = maxSize / Math.max(base.width, base.height);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled || sequence !== renderSequence.current) return;

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        page.cleanup();

        if (cancelled || sequence !== renderSequence.current) return;
        onRenderedRef.current?.({
          pageWidth: base.width,
          pageHeight: base.height,
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
        });
      } catch {
        if (!cancelled && sequence === renderSequence.current) {
          setError("This page could not be previewed");
        }
      } finally {
        if (!cancelled && sequence === renderSequence.current) setLoading(false);
        await task?.destroy().catch(() => undefined);
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [file, pageIndex, maxSize]);

  return (
    <div className={`relative inline-block ${className || ""}`}>
      <canvas
        ref={canvasRef}
        className="block max-w-full h-auto rounded-lg border border-border/60 shadow-sm"
        aria-label={`Preview of page ${pageIndex + 1}`}
      />
      {children}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <p className="text-sm text-destructive px-4 text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
