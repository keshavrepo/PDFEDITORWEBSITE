"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Download,
  FileText,
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
} from "@/lib/conversion";
import {
  buildOutputName,
  type ConversionToolConfig,
} from "@/lib/conversion/tool-config";

interface DocumentConverterProps {
  tool: ConversionToolConfig;
}

type Phase = "idle" | "validating" | "ready" | "converting" | "done";

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

export function DocumentConverter({ tool }: DocumentConverterProps) {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  // Release any object URL created for the result on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    },
    []
  );

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
    setProgress(null);
    setError(null);
    setWarning(null);
    setResult(null);
    setElapsed(null);
  }, []);

  const selectFile = useCallback(
    async (selected?: File) => {
      if (!selected) return;
      const sequence = ++validationSequence.current;

      // Reflect the selection immediately; validation reads bytes afterwards so
      // a large file never makes the picker feel unresponsive.
      setFile(selected);
      setPhase("validating");
      setError(null);
      setWarning(null);
      setResult(null);
      setProgress(null);
      setElapsed(null);

      const quick = validateSelection(selected, tool.input);
      if (!quick.valid) {
        if (sequence !== validationSequence.current) return;
        setError(quick.error || "Choose a valid file");
        setPhase("idle");
        return;
      }

      const validation = await validateConversionInput(selected, tool.input);
      if (sequence !== validationSequence.current) return;

      if (!validation.valid) {
        setError(validation.error || "Choose a valid file");
        setPhase("idle");
        return;
      }

      if (selected.size > 25 * 1024 * 1024) {
        setWarning("Large file detected. Conversion may take a minute to complete.");
      }
      setPhase("ready");
    },
    [tool.input]
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (files.length > 1) {
        setWarning(`Only one ${tool.inputLabel} can be converted at a time. Using the first file.`);
      }
      void selectFile(files[0]);
    },
    [selectFile, tool.inputLabel]
  );

  const convert = useCallback(async () => {
    if (!file || phase !== "ready") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("converting");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });
    const startedAt = performance.now();

    try {
      // Loaded on demand so the conversion engines stay out of the initial bundle.
      const conversion = await import("@/lib/conversion");
      const data = new Uint8Array(await file.arrayBuffer());
      const onProgress = (value: ConversionProgress) => {
        if (!controller.signal.aborted) setProgress(value);
      };

      let output: Uint8Array;
      switch (tool.id) {
        case "pdf-to-word":
          output = await conversion.convertPdfToWord(data, { signal: controller.signal }, onProgress);
          break;
        case "word-to-pdf":
          output = await conversion.convertWordToPdf(data, { signal: controller.signal }, onProgress);
          break;
        case "pdf-to-powerpoint":
          output = await conversion.convertPdfToPowerPoint(
            data,
            { signal: controller.signal },
            onProgress
          );
          break;
        case "powerpoint-to-pdf":
          output = await conversion.convertPowerPointToPdf(
            data,
            { signal: controller.signal },
            onProgress
          );
          break;
        default:
          throw new Error("Unsupported conversion");
      }

      if (controller.signal.aborted) return;

      const blob = new Blob([output as unknown as BlobPart], { type: tool.outputMimeType });
      setResult({ blob, name: buildOutputName(file.name, tool) });
      setElapsed((performance.now() - startedAt) / 1000);
      setPhase("done");
    } catch (conversionError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(conversionError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [file, phase, tool]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const isBusy = phase === "validating" || phase === "converting";

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/tools" className="hover:text-foreground transition-colors">
                Tools
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">
              {tool.name}
            </li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <FileText className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">{tool.name}</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          {tool.longDescription}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Screen-reader announcements for every state change. */}
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "validating"
            ? "Checking the selected file"
            : phase === "converting"
              ? `Converting. ${progress?.stage || ""} ${percent} percent complete.`
              : phase === "done"
                ? "Conversion complete. Your file is ready to download."
                : ""}
        </p>

        {phase === "done" && result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Conversion complete</h2>
            <p className="text-sm text-muted-foreground mb-1 break-all">{result.name}</p>
            <p className="text-xs text-muted-foreground mb-7">
              {formatFileSize(result.blob.size)}
              {elapsed !== null ? ` · finished in ${elapsed.toFixed(1)}s` : ""}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result.blob, result.name)}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download {tool.outputExtension.toUpperCase()}
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>
                Convert another file
              </Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept={tool.accept}
              label={`Choose a ${tool.inputLabel} to convert`}
              onFilesSelected={handleFilesSelected}
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
                    {isDragging ? `Drop your ${tool.inputLabel} here` : `Choose a ${tool.inputLabel}`}
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

            <ul className="mt-8 grid gap-3 sm:grid-cols-3">
              {tool.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
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
                        ? "Converting..."
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

            <div className="flex items-center justify-center gap-3 rounded-xl bg-muted/50 py-4 text-sm font-medium">
              <span className="uppercase">{tool.input === "docx" ? "DOCX" : tool.input === "pptx" ? "PPTX" : "PDF"}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="uppercase text-primary">{tool.outputExtension}</span>
            </div>

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
                  aria-label="Conversion progress"
                >
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            {warning && !error && (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/60 p-3">{warning}</p>
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
                  ? "Converting..."
                  : `Convert to ${tool.outputExtension.toUpperCase()}`}
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
              Files are converted in your browser and never uploaded
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Fast and accurate</h2>
            <p className="text-sm text-muted-foreground">
              Layout, styling and page order are preserved
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">No installation</h2>
            <p className="text-sm text-muted-foreground">
              Works in any modern desktop or mobile browser
            </p>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6">Frequently asked questions</h2>
          <div className="space-y-4">
            {tool.faqs.map((faq) => (
              <Card key={faq.question} className="p-5">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
