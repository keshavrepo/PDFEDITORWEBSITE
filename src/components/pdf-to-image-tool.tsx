"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Shield,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadBlob } from "@/lib/pdf-utils";
import {
  MAX_CONVERSION_SIZE,
  toConversionMessage,
  validateConversionInput,
  validateSelection,
  type ConversionProgress,
  type PageImageFormat,
  type RenderedPage,
} from "@/lib/conversion";

type Phase = "idle" | "validating" | "ready" | "converting" | "done";

const DPI_CHOICES = [
  { value: 96, label: "Screen", detail: "96 DPI" },
  { value: 150, label: "High", detail: "150 DPI" },
  { value: 300, label: "Print", detail: "300 DPI" },
] as const;

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[^\w\-. ]+/g, "-").trim() || "document";
}

export function PdfToImageTool() {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [format, setFormat] = useState<PageImageFormat>("png");
  const [dpi, setDpi] = useState<number>(150);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
    setProgress(null);
    setError(null);
    setPages([]);
  }, []);

  const selectFile = useCallback(async (selected?: File) => {
    if (!selected) return;
    const sequence = ++validationSequence.current;

    setFile(selected);
    setPhase("validating");
    setError(null);
    setPages([]);
    setProgress(null);

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
    setPhase("ready");
  }, []);

  const convert = useCallback(async () => {
    if (!file || phase !== "ready") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("converting");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const data = new Uint8Array(await file.arrayBuffer());
      const rendered = await conversion.renderPdfPages(
        data,
        { format, dpi, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setPages(rendered);
      setPhase("done");
    } catch (conversionError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(conversionError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [dpi, file, format, phase]);

  const downloadAll = useCallback(async () => {
    if (!file || !pages.length) return;
    const extension = format === "jpeg" ? "jpg" : "png";

    // A single page downloads directly; multiple pages are archived.
    if (pages.length === 1) {
      downloadBlob(pages[0].blob, `${baseName(file.name)}.${extension}`);
      return;
    }

    setProgress({ stage: "Packaging archive", progress: 0, total: 100 });
    const conversion = await import("@/lib/conversion");
    const zip = await conversion.zipRenderedPages(pages, baseName(file.name), format, setProgress);
    setProgress(null);
    downloadBlob(zip, `${baseName(file.name)}-${extension}.zip`);
  }, [file, format, pages]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const isBusy = phase === "validating" || phase === "converting";
  const extension = format === "jpeg" ? "JPG" : "PNG";

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">PDF to JPG or PNG</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <ImageIcon className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
          PDF to JPG or PNG
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Export every page of a PDF as a high-quality image. Choose JPG or PNG, pick a resolution,
          and download multi-page documents as a ZIP archive.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "validating"
            ? "Checking the selected file"
            : phase === "converting"
              ? `Rendering pages. ${progress?.stage || ""} ${percent} percent complete.`
              : phase === "done"
                ? `Rendering complete. ${pages.length} images are ready to download.`
                : ""}
        </p>

        {phase === "done" && pages.length ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              {pages.length} {pages.length === 1 ? "image" : "images"} ready
            </h2>
            <p className="text-xs text-muted-foreground mb-6">
              {extension} · {dpi} DPI ·{" "}
              {formatFileSize(pages.reduce((sum, page) => sum + page.blob.size, 0))}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7 max-h-72 overflow-y-auto">
              {pages.slice(0, 12).map((page) => (
                <div key={page.pageNumber} className="rounded-lg border border-border/60 p-2">
                  <p className="text-xs font-medium">Page {page.pageNumber}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {page.width}×{page.height}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-primary hover:underline"
                    onClick={() =>
                      downloadBlob(
                        page.blob,
                        `${baseName(file?.name || "page")}-page-${page.pageNumber}.${format === "jpeg" ? "jpg" : "png"}`
                      )
                    }
                  >
                    Download
                  </button>
                </div>
              ))}
              {pages.length > 12 && (
                <div className="rounded-lg border border-dashed border-border/60 p-2 flex items-center justify-center">
                  <p className="text-[11px] text-muted-foreground">
                    +{pages.length - 12} more
                  </p>
                </div>
              )}
            </div>

            {progress && (
              <div className="mb-5">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => void downloadAll()}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                {pages.length === 1 ? `Download ${extension}` : "Download all as ZIP"}
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>
                Convert another PDF
              </Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept="application/pdf,.pdf"
              label="Choose a PDF to convert to images"
              onFilesSelected={(files) => void selectFile(files[0])}
              className="rounded-2xl border-2 border-dashed border-border/60 p-10 sm:p-16 text-center transition-colors hover:border-border hover:bg-muted/30"
            >
              {(isDragging) => (
                <div className={isDragging ? "scale-[1.01] transition-transform" : ""}>
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 transition-all ${
                      isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"
                    }`}
                  >
                    <Upload
                      className={`w-8 h-8 ${isDragging ? "text-primary" : "text-primary/70"}`}
                      aria-hidden="true"
                    />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    {isDragging ? "Drop your PDF here" : "Choose a PDF"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Drag and drop or browse — up to {Math.round(MAX_CONVERSION_SIZE / 1024 / 1024)}MB
                  </p>
                  <Button size="lg" type="button" asChild>
                    <span>Browse files</span>
                  </Button>
                </div>
              )}
            </PdfUploadZone>

            {error && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Cannot convert this file</p>
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
                    {formatFileSize(file.size)} ·{" "}
                    {phase === "validating"
                      ? "Checking file..."
                      : phase === "converting"
                        ? "Rendering..."
                        : "Ready to convert"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={phase === "converting"}
                className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <fieldset className="space-y-2" disabled={isBusy}>
              <legend className="text-sm font-medium mb-2">Image format</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["png", "jpeg"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormat(value)}
                    aria-pressed={format === value}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      format === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <span className="font-medium block">{value === "png" ? "PNG" : "JPG"}</span>
                    <span className="text-xs opacity-75">
                      {value === "png" ? "Lossless, sharp text" : "Smaller files"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2" disabled={isBusy}>
              <legend className="text-sm font-medium mb-2">Resolution</legend>
              <div className="grid grid-cols-3 gap-3">
                {DPI_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setDpi(choice.value)}
                    aria-pressed={dpi === choice.value}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      dpi === choice.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <span className="font-medium block">{choice.label}</span>
                    <span className="text-xs opacity-75">{choice.detail}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {progress && phase === "converting" && (
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
                  aria-label="Rendering progress"
                >
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Conversion failed</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={() => void convert()}
              disabled={isBusy || phase !== "ready"}
            >
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === "validating"
                ? "Checking file..."
                : phase === "converting"
                  ? "Rendering pages..."
                  : `Convert to ${extension}`}
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
            <p className="text-sm text-muted-foreground">
              Pages are rendered in your browser and never uploaded
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Print quality</h2>
            <p className="text-sm text-muted-foreground">Render up to 300 DPI for crisp output</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Every page</h2>
            <p className="text-sm text-muted-foreground">
              Multi-page PDFs download as a single ZIP archive
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
