"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Download,
  GripVertical,
  Loader2,
  Shield,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PdfUploadZone } from "@/components/pdfpilot/pdf-upload-zone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadBlob } from "@/lib/download";
import {
  IMAGE_ACCEPT,
  toConversionMessage,
  type ConversionProgress,
} from "@/lib/conversion/client";
import {
  type ScanPageSize,
} from "@/lib/conversion";
import { formatBytes as formatFileSize } from "@/lib/format";

interface Capture {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_CAPTURE_SIZE = 30 * 1024 * 1024;


/** Decodes an image file into raw pixels for the scan pipeline. */
async function readPixels(
  file: File
): Promise<{ rgba: Uint8Array; width: number; height: number } | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;

  try {
    // Very large phone captures are downscaled first: 2400px on the long edge
    // is far more than enough for a legible page and keeps memory sane.
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > 2400 ? 2400 / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    canvas.width = 0;
    canvas.height = 0;
    return { rgba: new Uint8Array(pixels.data.buffer), width, height };
  } finally {
    bitmap.close();
  }
}

export function ScanToPdfTool() {
  const abortRef = useRef<AbortController | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [pageSize, setPageSize] = useState<ScanPageSize>("a4");
  const [autoCrop, setAutoCrop] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [enhance, setEnhance] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      setCaptures((current) => {
        current.forEach((capture) => URL.revokeObjectURL(capture.previewUrl));
        return current;
      });
    },
    []
  );

  const addFiles = useCallback((files: File[]) => {
    const accepted: Capture[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const isImage = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!isImage) {
        rejected.push(`${file.name} is not a photo.`);
        continue;
      }
      if (!file.size) {
        rejected.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > MAX_CAPTURE_SIZE) {
        rejected.push(`${file.name} exceeds the 30MB limit.`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setError(rejected.length ? rejected.join(" ") : null);
    if (accepted.length) {
      setCaptures((current) => [...current, ...accepted]);
      setResult(null);
    }
  }, []);

  const removeCapture = useCallback((id: string) => {
    setCaptures((current) => {
      const target = current.find((capture) => capture.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((capture) => capture.id !== id);
    });
    setResult(null);
  }, []);

  const move = useCallback((from: number, to: number) => {
    setCaptures((current) => {
      if (to < 0 || to >= current.length || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResult(null);
  }, []);

  const clearAll = useCallback(() => {
    setCaptures((current) => {
      current.forEach((capture) => URL.revokeObjectURL(capture.previewUrl));
      return [];
    });
    setResult(null);
    setError(null);
    setProgress(null);
  }, []);

  const build = useCallback(async () => {
    if (!captures.length || processing) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setProcessing(true);
    setError(null);
    setProgress({ stage: "Reading captures", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");

      const pages = [];
      for (let index = 0; index < captures.length; index++) {
        if (controller.signal.aborted) return;
        setProgress({
          stage: `Reading capture ${index + 1} of ${captures.length}`,
          progress: Math.round((index / captures.length) * 30),
          total: 100,
        });
        const pixels = await readPixels(captures[index].file);
        if (pixels) pages.push({ name: captures[index].file.name, ...pixels });
      }

      if (!pages.length) {
        throw new Error("None of the selected photos could be read");
      }

      const bytes = await conversion.scanToPdf(
        pages,
        { pageSize, autoCrop, autoRotate, enhance, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) {
            // Reading took the first 30%; assembly fills the rest.
            setProgress({
              stage: value.stage,
              progress: 30 + Math.round((value.progress / Math.max(value.total, 1)) * 70),
              total: 100,
            });
          }
        }
      );
      if (controller.signal.aborted) return;
      setResult(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
    } catch (scanError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(scanError));
      setProgress(null);
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  }, [autoCrop, autoRotate, captures, enhance, pageSize, processing]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const optionButton = (active: boolean) =>
    `p-3 border rounded-lg text-sm transition-colors ${
      active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
    }`;

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">Scan to PDF</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <Camera className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Scan to PDF</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Turn phone photos into a clean multi-page document. PDFPilot finds the page edges, crops
          away the background, straightens sideways shots and evens out the lighting.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {processing ? `Building PDF. ${percent} percent complete.` : ""}
          {result ? "Your scanned PDF is ready to download." : ""}
        </p>

        {result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Scan complete</h2>
            <p className="text-xs text-muted-foreground mb-7">
              {captures.length} {captures.length === 1 ? "page" : "pages"} · {formatFileSize(result.size)}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result, "scan.pdf")}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
              <Button size="lg" variant="outline" onClick={clearAll}>Scan more pages</Button>
            </div>
          </Card>
        ) : (
          <>
            <PdfUploadZone
              multiple
              accept={IMAGE_ACCEPT}
              label="Choose photos of your document"
              onFilesSelected={addFiles}
              className="rounded-2xl border-2 border-dashed border-border/60 p-10 sm:p-14 text-center transition-colors hover:border-border hover:bg-muted/30"
            >
              {(isDragging) => (
                <div className={isDragging ? "scale-[1.01] transition-transform" : ""}>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 transition-all ${isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"}`}>
                    <Upload className={`w-8 h-8 ${isDragging ? "text-primary" : "text-primary/70"}`} aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    {isDragging ? "Drop your photos here" : captures.length ? "Add more pages" : "Choose photos"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    JPG, PNG or WebP · drag and drop, browse, or use your camera
                  </p>
                  <Button size="lg" type="button" asChild><span>Browse files</span></Button>
                </div>
              )}
            </PdfUploadZone>

            {error && (
              <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Some photos were not added</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            {captures.length > 0 && (
              <Card className="mt-6 p-5 sm:p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">
                      {captures.length} {captures.length === 1 ? "page" : "pages"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Drag a card, or use the arrows, to change page order
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>

                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {captures.map((capture, index) => (
                    <li
                      key={capture.id}
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedIndex !== null) move(draggedIndex, index);
                        setDraggedIndex(null);
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                      className={`relative rounded-xl border border-border/60 p-2 bg-card transition-opacity ${
                        draggedIndex === index ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-move shrink-0" aria-hidden="true" />
                        <span className="text-xs font-medium">Page {index + 1}</span>
                      </div>
                      {/* Local object URL preview; next/image adds nothing here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={capture.previewUrl}
                        alt={capture.file.name}
                        className="w-full h-24 object-contain rounded bg-muted/40"
                      />
                      <p className="mt-2 text-[11px] truncate" title={capture.file.name}>
                        {capture.file.name}
                      </p>
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, index - 1)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30"
                          aria-label={`Move ${capture.file.name} earlier`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, index + 1)}
                          disabled={index === captures.length - 1}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30"
                          aria-label={`Move ${capture.file.name} later`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCapture(capture.id)}
                          className="ml-auto p-1 rounded hover:bg-accent"
                          aria-label={`Remove ${capture.file.name}`}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <fieldset disabled={processing}>
                  <legend className="text-sm font-medium mb-2">Page size</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["a4", "A4"],
                      ["letter", "Letter"],
                      ["fit", "Fit photo"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPageSize(value)}
                        aria-pressed={pageSize === value}
                        className={optionButton(pageSize === value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset disabled={processing} className="space-y-3">
                  <legend className="text-sm font-medium mb-1">Clean-up</legend>
                  {([
                    ["autoCrop", autoCrop, setAutoCrop, "Auto crop", "Detect the page edges and trim the background"],
                    ["autoRotate", autoRotate, setAutoRotate, "Auto rotate", "Turn sideways photos upright"],
                    ["enhance", enhance, setEnhance, "Enhance", "Even out lighting so the paper reads as white"],
                  ] as const).map(([key, value, setter, label, detail]) => (
                    <label key={key} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(event) => setter(event.target.checked)}
                        className="h-4 w-4 mt-0.5 rounded border-input"
                      />
                      <span>
                        {label}
                        <span className="block text-xs text-muted-foreground">{detail}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {progress && processing && (
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
                      aria-label="Scan progress"
                    >
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )}

                <Button size="lg" className="w-full" onClick={() => void build()} disabled={processing}>
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {processing
                    ? "Building PDF..."
                    : `Create PDF from ${captures.length} ${captures.length === 1 ? "page" : "pages"}`}
                </Button>
              </Card>
            )}
          </>
        )}
      </section>

      <section className="border-t bg-muted/30 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 sm:grid-cols-3 text-center">
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Shield className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Private by design</h2>
            <p className="text-sm text-muted-foreground">Photos are processed on your device</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Automatic clean-up</h2>
            <p className="text-sm text-muted-foreground">Edge detection, cropping, rotation and lighting</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Multi-page</h2>
            <p className="text-sm text-muted-foreground">Capture a whole document and reorder freely</p>
          </div>
        </div>
      </section>
    </main>
  );
}
