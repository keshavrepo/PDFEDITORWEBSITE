"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  GripVertical,
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
  IMAGE_ACCEPT,
  MAX_CONVERSION_SIZE,
  toConversionMessage,
  type ConversionProgress,
  type ImageFitMode,
  type MarginSize,
  type PageOrientation,
  type PageSizeId,
} from "@/lib/conversion";

interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_IMAGE_SIZE = 30 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

export function ImageToPdfTool() {
  const abortRef = useRef<AbortController | null>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeId>("a4");
  const [orientation, setOrientation] = useState<PageOrientation>("auto");
  const [fit, setFit] = useState<ImageFitMode>("fit");
  const [margin, setMargin] = useState<MarginSize>("small");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Object URLs must be revoked or the page leaks memory on large batches.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      setImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return current;
      });
    },
    []
  );

  const addFiles = useCallback((files: File[]) => {
    const accepted: SelectedImage[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const isImage =
        ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
      if (!isImage) {
        rejected.push(`${file.name} is not a JPG or PNG image.`);
        continue;
      }
      if (!file.size) {
        rejected.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(`${file.name} exceeds the 30MB per-image limit.`);
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
      setImages((current) => [...current, ...accepted]);
      setResult(null);
    }
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.id !== id);
    });
    setResult(null);
  }, []);

  const move = useCallback((from: number, to: number) => {
    setImages((current) => {
      if (to < 0 || to >= current.length || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResult(null);
  }, []);

  const clearAll = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    setResult(null);
    setError(null);
    setProgress(null);
  }, []);

  const convert = useCallback(async () => {
    if (!images.length || processing) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setProcessing(true);
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: images.length });

    try {
      const conversion = await import("@/lib/conversion");
      const inputs = await Promise.all(
        images.map(async (image) => ({
          name: image.file.name,
          data: new Uint8Array(await image.file.arrayBuffer()),
        }))
      );

      const bytes = await conversion.convertImagesToPdf(
        inputs,
        { pageSize, orientation, fit, margin, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setResult(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
    } catch (conversionError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(conversionError));
      setProgress(null);
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  }, [fit, images, margin, orientation, pageSize, processing]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;

  const optionButton = (active: boolean) =>
    `p-3 border rounded-lg text-left text-sm transition-colors ${
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
            <li className="text-foreground font-medium" aria-current="page">JPG or PNG to PDF</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <ImageIcon className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
          JPG or PNG to PDF
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Combine images into a single high-quality PDF. Reorder pages, choose portrait or
          landscape, set margins, and pick how each image fits its page.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {processing
            ? `Creating PDF. ${percent} percent complete.`
            : result
              ? "Your PDF is ready to download."
              : ""}
        </p>

        {result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Your PDF is ready</h2>
            <p className="text-xs text-muted-foreground mb-7">
              {images.length} {images.length === 1 ? "page" : "pages"} · {formatFileSize(result.size)}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result, "images.pdf")}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
              <Button size="lg" variant="outline" onClick={clearAll}>
                Start over
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <PdfUploadZone
              multiple
              accept={IMAGE_ACCEPT}
              label="Choose JPG or PNG images to convert"
              onFilesSelected={addFiles}
              className="rounded-2xl border-2 border-dashed border-border/60 p-10 sm:p-14 text-center transition-colors hover:border-border hover:bg-muted/30"
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
                    {isDragging ? "Drop your images here" : images.length ? "Add more images" : "Choose images"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    JPG or PNG · drag and drop or browse · up to{" "}
                    {Math.round(MAX_CONVERSION_SIZE / 1024 / 1024)}MB total
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
                  <p className="font-medium text-destructive">Some files were not added</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            {images.length > 0 && (
              <Card className="mt-6 p-5 sm:p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">
                      {images.length} {images.length === 1 ? "image" : "images"}
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
                  {images.map((image, index) => (
                    <li
                      key={image.id}
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedIndex !== null) move(draggedIndex, index);
                        setDraggedIndex(null);
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                      className={`group relative rounded-xl border border-border/60 p-2 bg-card transition-opacity ${
                        draggedIndex === index ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-2">
                        <GripVertical
                          className="h-3.5 w-3.5 text-muted-foreground cursor-move shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-medium">Page {index + 1}</span>
                      </div>

                      {/* Local object URL preview; next/image adds no value here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.previewUrl}
                        alt={image.file.name}
                        className="w-full h-24 object-contain rounded bg-muted/40"
                      />

                      <p className="mt-2 text-[11px] truncate" title={image.file.name}>
                        {image.file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(image.file.size)}
                      </p>

                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, index - 1)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30"
                          aria-label={`Move ${image.file.name} earlier`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, index + 1)}
                          disabled={index === images.length - 1}
                          className="p-1 rounded hover:bg-accent disabled:opacity-30"
                          aria-label={`Move ${image.file.name} later`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="ml-auto p-1 rounded hover:bg-accent"
                          aria-label={`Remove ${image.file.name}`}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="grid gap-5 sm:grid-cols-2">
                  <fieldset disabled={processing}>
                    <legend className="text-sm font-medium mb-2">Page size</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["a4", "A4"],
                        ["letter", "Letter"],
                        ["fit", "Fit image"],
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

                  <fieldset disabled={processing || pageSize === "fit"}>
                    <legend className="text-sm font-medium mb-2">Orientation</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["auto", "Auto"],
                        ["portrait", "Portrait"],
                        ["landscape", "Landscape"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setOrientation(value)}
                          aria-pressed={orientation === value}
                          className={`${optionButton(orientation === value)} ${
                            pageSize === "fit" ? "opacity-50" : ""
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset disabled={processing}>
                    <legend className="text-sm font-medium mb-2">Image fit</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ["fit", "Fit", "Show the whole image"],
                        ["fill", "Fill", "Cover the page"],
                      ] as const).map(([value, label, detail]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFit(value)}
                          aria-pressed={fit === value}
                          className={optionButton(fit === value)}
                        >
                          <span className="font-medium block">{label}</span>
                          <span className="text-xs opacity-75">{detail}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset disabled={processing}>
                    <legend className="text-sm font-medium mb-2">Margin</legend>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        ["none", "None"],
                        ["small", "Small"],
                        ["medium", "Medium"],
                        ["large", "Large"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setMargin(value)}
                          aria-pressed={margin === value}
                          className={optionButton(margin === value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>

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
                      aria-label="Conversion progress"
                    >
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => void convert()}
                  disabled={processing || !images.length}
                >
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {processing
                    ? "Creating PDF..."
                    : `Convert ${images.length} ${images.length === 1 ? "image" : "images"} to PDF`}
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
            <p className="text-sm text-muted-foreground">
              Images are combined in your browser and never uploaded
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Full quality</h2>
            <p className="text-sm text-muted-foreground">
              Images are embedded as-is, with no re-compression
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Full control</h2>
            <p className="text-sm text-muted-foreground">
              Reorder pages and choose size, orientation, fit and margins
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
