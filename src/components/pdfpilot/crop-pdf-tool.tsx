"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop as CropIcon,
  Download,
  FileText,
  Loader2,
  Shield,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PdfUploadZone } from "@/components/pdfpilot/pdf-upload-zone";
import { PdfPagePreview } from "@/components/pdfpilot/pdf-page-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadBlob } from "@/lib/download";
import {
  MAX_CONVERSION_SIZE,
  toConversionMessage,
  validateConversionInput,
  validateSelection,
  type ConversionProgress,
} from "@/lib/conversion/client";
import {
  type CropMargins,
  type CropPageInfo,
} from "@/lib/conversion";
import { formatBytes as formatFileSize } from "@/lib/format";

type Phase = "idle" | "validating" | "ready" | "processing" | "done";
type Scope = "all" | "selected";

const EDGES = [
  { key: "top", label: "Top" },
  { key: "right", label: "Right" },
  { key: "bottom", label: "Bottom" },
  { key: "left", label: "Left" },
] as const;


export function CropPdfTool() {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pages, setPages] = useState<CropPageInfo[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [margins, setMargins] = useState<CropMargins>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [scope, setScope] = useState<Scope>("all");
  const [selectedPages, setSelectedPages] = useState<string>("");
  const [detecting, setDetecting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
    setPages([]);
    setPageIndex(0);
    setMargins({ top: 0, right: 0, bottom: 0, left: 0 });
    setScope("all");
    setSelectedPages("");
    setProgress(null);
    setError(null);
    setResult(null);
  }, []);

  const selectFile = useCallback(async (selected?: File) => {
    if (!selected) return;
    const sequence = ++validationSequence.current;

    setFile(selected);
    setPhase("validating");
    setError(null);
    setResult(null);
    setPageIndex(0);

    const quick = validateSelection(selected, "pdf");
    if (!quick.valid) {
      if (sequence !== validationSequence.current) return;
      setError(quick.error || "Choose a valid PDF");
      setPhase("idle");
      return;
    }
    const validation = await validateConversionInput(selected, "pdf");
    if (sequence !== validationSequence.current) return;
    if (!validation.valid) {
      setError(validation.error || "Choose a valid PDF");
      setPhase("idle");
      return;
    }

    try {
      const conversion = await import("@/lib/conversion");
      const info = await conversion.readCropInfo(new Uint8Array(await selected.arrayBuffer()));
      if (sequence !== validationSequence.current) return;
      setPages(info);
      setPhase("ready");
    } catch (readError) {
      if (sequence !== validationSequence.current) return;
      setError(toConversionMessage(readError));
      setPhase("idle");
    }
  }, []);

  /**
   * Renders the current page and measures the tight bounding box of its
   * content, so white margins can be removed without guesswork.
   */
  const detectMargins = useCallback(async () => {
    if (!file || !pages.length) return;
    setDetecting(true);
    setError(null);

    try {
      const [{ loadPdfJs }, conversion, buffer] = await Promise.all([
        import("@/lib/conversion/pdf/pdf-loader"),
        import("@/lib/conversion"),
        file.arrayBuffer(),
      ]);

      const pdfjs = await loadPdfJs();
      const task = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
      });
      const document_ = await task.promise;

      try {
        const page = await document_.getPage(pageIndex + 1);
        // A modest scale keeps detection quick while staying accurate enough.
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const bounds = conversion.detectContentBounds(
          new Uint8Array(pixels.data.buffer),
          canvas.width,
          canvas.height,
          // A little padding stops descenders being clipped.
          { padding: 6 }
        );
        page.cleanup();

        if (!bounds) {
          setError("This page looks blank, so there are no margins to remove.");
          return;
        }

        const info = pages[pageIndex];
        setMargins(
          conversion.boundsToMargins(bounds, canvas.width, canvas.height, info.width, info.height)
        );
      } finally {
        await task.destroy().catch(() => undefined);
      }
    } catch (detectError) {
      setError(toConversionMessage(detectError));
    } finally {
      setDetecting(false);
    }
  }, [file, pageIndex, pages]);

  const parsePageSelection = useCallback(
    (input: string, total: number): number[] => {
      const indices = new Set<number>();
      for (const part of input.split(",")) {
        const range = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!range) continue;
        const start = Number(range[1]);
        const end = Number(range[2] || range[1]);
        for (let page = start; page <= end; page++) {
          if (page >= 1 && page <= total) indices.add(page - 1);
        }
      }
      return [...indices].sort((a, b) => a - b);
    },
    []
  );

  const apply = useCallback(async () => {
    if (!file || phase !== "ready") return;

    const pageIndices =
      scope === "selected" ? parsePageSelection(selectedPages, pages.length) : undefined;
    if (scope === "selected" && (!pageIndices || !pageIndices.length)) {
      setError("Enter at least one valid page, for example 1, 3-5");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const bytes = await conversion.cropPdf(
        new Uint8Array(await file.arrayBuffer()),
        margins,
        { pageIndices, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setResult(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
      setPhase("done");
    } catch (cropError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(cropError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [file, margins, pages.length, parsePageSelection, phase, scope, selectedPages]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const isBusy = phase === "validating" || phase === "processing";
  const current = pages[pageIndex];

  // Overlay percentages so the shaded area tracks the preview at any size.
  const overlay = current
    ? {
        top: `${(margins.top / current.height) * 100}%`,
        right: `${(margins.right / current.width) * 100}%`,
        bottom: `${(margins.bottom / current.height) * 100}%`,
        left: `${(margins.left / current.width) * 100}%`,
      }
    : null;

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">Crop PDF</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <CropIcon className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Crop PDF</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Trim margins from your pages with a live preview. Crop every page or just a selection,
          set the margins by hand, or remove white space automatically.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "processing" ? `Cropping. ${percent} percent complete.` : ""}
          {phase === "done" ? "Your cropped PDF is ready to download." : ""}
        </p>

        {phase === "done" && result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Pages cropped</h2>
            <p className="text-xs text-muted-foreground mb-7">{formatFileSize(result.size)}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result, "cropped.pdf")}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>Crop another PDF</Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept="application/pdf,.pdf"
              label="Choose a PDF to crop"
              onFilesSelected={(files) => void selectFile(files[0])}
              className="rounded-2xl border-2 border-dashed border-border/60 p-10 sm:p-16 text-center transition-colors hover:border-border hover:bg-muted/30"
            >
              {(isDragging) => (
                <div className={isDragging ? "scale-[1.01] transition-transform" : ""}>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 transition-all ${isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"}`}>
                    <Upload className={`w-8 h-8 ${isDragging ? "text-primary" : "text-primary/70"}`} aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">{isDragging ? "Drop your PDF here" : "Choose a PDF"}</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Drag and drop or browse — up to {Math.round(MAX_CONVERSION_SIZE / 1024 / 1024)}MB
                  </p>
                  <Button size="lg" type="button" asChild><span>Browse files</span></Button>
                </div>
              )}
            </PdfUploadZone>

            {error && (
              <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Cannot use this file</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{file.name}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatFileSize(file.size)}
                    {pages.length ? ` · ${pages.length} ${pages.length === 1 ? "page" : "pages"}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={phase === "processing"}
                className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {pages.length > 0 && (
              <>
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <PdfPagePreview file={file} pageIndex={pageIndex} maxSize={520}>
                      {overlay && (
                        <>
                          {/* Shaded regions show exactly what will be removed. */}
                          <div className="absolute inset-x-0 top-0 bg-destructive/25 pointer-events-none" style={{ height: overlay.top }} />
                          <div className="absolute inset-x-0 bottom-0 bg-destructive/25 pointer-events-none" style={{ height: overlay.bottom }} />
                          <div className="absolute inset-y-0 left-0 bg-destructive/25 pointer-events-none" style={{ width: overlay.left }} />
                          <div className="absolute inset-y-0 right-0 bg-destructive/25 pointer-events-none" style={{ width: overlay.right }} />
                          <div
                            className="absolute border-2 border-primary pointer-events-none"
                            style={{
                              top: overlay.top,
                              right: overlay.right,
                              bottom: overlay.bottom,
                              left: overlay.left,
                            }}
                          />
                        </>
                      )}
                    </PdfPagePreview>
                  </div>

                  {pages.length > 1 && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
                        disabled={pageIndex === 0}
                        className="p-2 rounded-lg hover:bg-accent disabled:opacity-30"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {pageIndex + 1} of {pages.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPageIndex((index) => Math.min(pages.length - 1, index + 1))}
                        disabled={pageIndex === pages.length - 1}
                        className="p-2 rounded-lg hover:bg-accent disabled:opacity-30"
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void detectMargins()}
                    disabled={detecting || isBusy}
                  >
                    {detecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Remove white margins
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMargins({ top: 0, right: 0, bottom: 0, left: 0 })}
                    disabled={isBusy}
                  >
                    Reset
                  </Button>
                </div>

                <fieldset disabled={isBusy} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <legend className="text-sm font-medium mb-2 w-full">Margins to remove (points)</legend>
                  {EDGES.map((edge) => {
                    const limit = Math.floor(
                      edge.key === "top" || edge.key === "bottom"
                        ? (current?.height ?? 800) / 2 - 10
                        : (current?.width ?? 600) / 2 - 10
                    );
                    return (
                      <div key={edge.key} className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor={`crop-${edge.key}`}>
                          {edge.label}
                        </label>
                        <input
                          id={`crop-${edge.key}`}
                          type="number"
                          min={0}
                          max={limit}
                          value={Math.round(margins[edge.key])}
                          onChange={(event) =>
                            setMargins((current_) => ({
                              ...current_,
                              [edge.key]: Math.max(0, Math.min(Number(event.target.value) || 0, limit)),
                            }))
                          }
                          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        />
                      </div>
                    );
                  })}
                </fieldset>

                <fieldset disabled={isBusy}>
                  <legend className="text-sm font-medium mb-2">Apply to</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["all", "All pages"],
                      ["selected", "Selected pages"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setScope(value)}
                        aria-pressed={scope === value}
                        className={`p-3 border rounded-lg text-sm transition-colors ${
                          scope === value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-accent"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {scope === "selected" && (
                    <div className="mt-3 space-y-1">
                      <label className="text-xs text-muted-foreground" htmlFor="page-selection">
                        Pages, for example 1, 3-5
                      </label>
                      <input
                        id="page-selection"
                        value={selectedPages}
                        onChange={(event) => setSelectedPages(event.target.value)}
                        placeholder="1, 3-5"
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                  )}
                </fieldset>
              </>
            )}

            {progress && phase === "processing" && (
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span>{progress.stage}</span>
                  <span>{percent}%</span>
                </div>
                <div
                  className="h-2 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Cropping progress"
                >
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Could not crop</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={() => void apply()}
              disabled={isBusy || !pages.length}
            >
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === "processing" ? "Cropping..." : "Crop PDF"}
            </Button>
          </Card>
        )}
      </section>

      <section className="border-t bg-muted/30 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 sm:grid-cols-3 text-center">
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Shield className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Private by design</h2>
            <p className="text-sm text-muted-foreground">Cropping happens in your browser</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Live preview</h2>
            <p className="text-sm text-muted-foreground">See exactly what will be trimmed</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Non-destructive</h2>
            <p className="text-sm text-muted-foreground">Sets the crop box, leaving content intact</p>
          </div>
        </div>
      </section>
    </main>
  );
}
