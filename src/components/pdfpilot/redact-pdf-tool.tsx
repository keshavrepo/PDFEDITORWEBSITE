"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  FileText,
  Loader2,
  Shield,
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
  type RedactionArea,
} from "@/lib/conversion";
import { formatBytes as formatFileSize } from "@/lib/format";

type Phase = "idle" | "validating" | "ready" | "processing" | "done";

interface PageGeometry {
  pageWidth: number;
  pageHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}


/** Areas below this size are almost always accidental clicks. */
const MIN_AREA_POINTS = 4;

export function RedactPdfTool() {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [geometry, setGeometry] = useState<PageGeometry | null>(null);
  const [areas, setAreas] = useState<RedactionArea[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; removed: number } | null>(null);

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
    setPageIndex(0);
    setPageCount(1);
    setGeometry(null);
    setAreas([]);
    setDraft(null);
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
    setAreas([]);
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
      setPageCount(info.length);
      setPhase("ready");
    } catch (readError) {
      if (sequence !== validationSequence.current) return;
      setError(toConversionMessage(readError));
      setPhase("idle");
    }
  }, []);

  /** Converts a pointer event into pixel coordinates inside the preview. */
  const localPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
      width: rect.width,
      height: rect.height,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "ready" || !geometry) return;
    const point = localPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: point.x, y: point.y };
    setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const point = localPoint(event);
    if (!point) return;
    const start = dragStart.current;
    setDraft({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || !draft || !geometry) {
      dragStart.current = null;
      setDraft(null);
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStart.current = null;

    const surface = surfaceRef.current;
    const rect = surface?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) {
      setDraft(null);
      return;
    }

    // Preview pixels back to PDF points.
    const scaleX = geometry.pageWidth / rect.width;
    const scaleY = geometry.pageHeight / rect.height;
    const area: RedactionArea = {
      pageIndex,
      x: draft.x * scaleX,
      y: draft.y * scaleY,
      width: draft.width * scaleX,
      height: draft.height * scaleY,
    };
    setDraft(null);

    if (area.width < MIN_AREA_POINTS || area.height < MIN_AREA_POINTS) return;
    setAreas((current) => [...current, area]);
  };

  const apply = useCallback(async () => {
    if (!file || phase !== "ready" || !areas.length) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const output = await conversion.redactPdf(
        new Uint8Array(await file.arrayBuffer()),
        areas,
        { removeMetadata, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setResult({
        blob: new Blob([output.data as unknown as BlobPart], { type: "application/pdf" }),
        removed: output.removedTextOperations,
      });
      setPhase("done");
    } catch (redactError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(redactError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [areas, file, phase, removeMetadata]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const isBusy = phase === "validating" || phase === "processing";
  const pageAreas = areas.filter((area) => area.pageIndex === pageIndex);

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">Redact PDF</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <EyeOff className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Redact PDF</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Permanently remove sensitive information. Drag over anything you want gone — the text is
          deleted from the file itself, not just hidden behind a black box.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "processing" ? `Redacting. ${percent} percent complete.` : ""}
          {phase === "done" ? "Your redacted PDF is ready to download." : ""}
        </p>

        {phase === "done" && result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Redaction complete</h2>
            <p className="text-sm text-muted-foreground mb-1">
              {result.removed > 0
                ? `${result.removed} text ${result.removed === 1 ? "element was" : "elements were"} permanently removed`
                : "Redaction boxes applied"}
            </p>
            <p className="text-xs text-muted-foreground mb-7">
              {formatFileSize(result.blob.size)}
              {removeMetadata ? " · metadata stripped" : ""}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result.blob, "redacted.pdf")}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>Redact another PDF</Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept="application/pdf,.pdf"
              label="Choose a PDF to redact"
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
                    {formatFileSize(file.size)} · {areas.length}{" "}
                    {areas.length === 1 ? "area" : "areas"} marked
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

            <p className="text-xs text-muted-foreground rounded-lg bg-muted/60 p-3">
              Drag across the page to mark an area. Everything inside it is deleted from the
              document, so the text cannot be recovered or copied out.
            </p>

            <div className="flex flex-col items-center gap-3">
              <div
                ref={surfaceRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                  dragStart.current = null;
                  setDraft(null);
                }}
                className="relative touch-none cursor-crosshair select-none"
              >
                <PdfPagePreview
                  file={file}
                  pageIndex={pageIndex}
                  maxSize={520}
                  onRendered={setGeometry}
                >
                  {geometry &&
                    pageAreas.map((area, index) => (
                      // Percentages keep the marks aligned at any preview size,
                      // without measuring the DOM during render.
                      <div
                        key={`${area.x}-${area.y}-${index}`}
                        className="absolute bg-foreground border border-primary/60"
                        style={{
                          left: `${(area.x / geometry.pageWidth) * 100}%`,
                          top: `${(area.y / geometry.pageHeight) * 100}%`,
                          width: `${(area.width / geometry.pageWidth) * 100}%`,
                          height: `${(area.height / geometry.pageHeight) * 100}%`,
                        }}
                      />
                    ))}
                  {draft && (
                    <div
                      className="absolute bg-foreground/70 border-2 border-primary pointer-events-none"
                      style={{
                        left: draft.x,
                        top: draft.y,
                        width: draft.width,
                        height: draft.height,
                      }}
                    />
                  )}
                </PdfPagePreview>
              </div>

              {pageCount > 1 && (
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
                    Page {pageIndex + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPageIndex((index) => Math.min(pageCount - 1, index + 1))}
                    disabled={pageIndex === pageCount - 1}
                    className="p-2 rounded-lg hover:bg-accent disabled:opacity-30"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {areas.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {pageAreas.length} on this page, {areas.length} in total
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy || !pageAreas.length}
                  onClick={() => setAreas((current) => current.filter((area) => area.pageIndex !== pageIndex))}
                >
                  Clear this page
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setAreas([])}>
                  Clear all
                </Button>
              </div>
            )}

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={removeMetadata}
                disabled={isBusy}
                onChange={(event) => setRemoveMetadata(event.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-input"
              />
              <span>
                Remove document metadata
                <span className="block text-xs text-muted-foreground">
                  Clears the title, author and other properties that can leak information
                </span>
              </span>
            </label>

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
                  aria-label="Redaction progress"
                >
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Could not redact</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={() => void apply()}
              disabled={isBusy || !areas.length}
            >
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === "processing"
                ? "Redacting..."
                : areas.length
                  ? `Redact ${areas.length} ${areas.length === 1 ? "area" : "areas"}`
                  : "Mark an area to redact"}
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
            <h2 className="font-semibold mb-2">Truly permanent</h2>
            <p className="text-sm text-muted-foreground">
              Text is deleted from the file, not covered up
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Private by design</h2>
            <p className="text-sm text-muted-foreground">
              Redaction runs in your browser, with no upload
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Metadata too</h2>
            <p className="text-sm text-muted-foreground">
              Document properties are cleared alongside the content
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
