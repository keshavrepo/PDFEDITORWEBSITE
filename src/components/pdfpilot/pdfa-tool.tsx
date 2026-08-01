"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Archive,
  Check,
  Download,
  FileText,
  Info,
  Loader2,
  Shield,
  TriangleAlert,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PdfUploadZone } from "@/components/pdfpilot/pdf-upload-zone";
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
  type PdfALevel,
  type PdfAValidation,
  type ValidationSeverity,
} from "@/lib/conversion";
import { formatBytes as formatFileSize } from "@/lib/format";

type Phase = "idle" | "validating" | "ready" | "processing" | "done";

const LEVELS: Array<{ value: PdfALevel; label: string; detail: string }> = [
  { value: "pdfa-1b", label: "PDF/A-1b", detail: "Widest support" },
  { value: "pdfa-2b", label: "PDF/A-2b", detail: "Recommended" },
  { value: "pdfa-3b", label: "PDF/A-3b", detail: "Allows attachments" },
];

const SEVERITY_ICON: Record<ValidationSeverity, typeof Info> = {
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

const SEVERITY_STYLE: Record<ValidationSeverity, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  info: "border-border/60 bg-muted/40 text-muted-foreground",
};


export function PdfATool() {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState<PdfALevel>("pdfa-2b");
  const [validation, setValidation] = useState<PdfAValidation | null>(null);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; repaired: string[] } | null>(null);

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
    setValidation(null);
    setProgress(null);
    setError(null);
    setResult(null);
  }, []);

  const selectFile = useCallback(
    async (selected?: File) => {
      if (!selected) return;
      const sequence = ++validationSequence.current;

      setFile(selected);
      setPhase("validating");
      setError(null);
      setResult(null);
      setValidation(null);

      const quick = validateSelection(selected, "pdf");
      if (!quick.valid) {
        if (sequence !== validationSequence.current) return;
        setError(quick.error || "Choose a valid PDF");
        setPhase("idle");
        return;
      }
      const check = await validateConversionInput(selected, "pdf");
      if (sequence !== validationSequence.current) return;
      if (!check.valid) {
        setError(check.error || "Choose a valid PDF");
        setPhase("idle");
        return;
      }

      try {
        // Validation runs before export so problems are known up front.
        const conversion = await import("@/lib/conversion");
        const report = await conversion.validateForPdfA(
          new Uint8Array(await selected.arrayBuffer()),
          level
        );
        if (sequence !== validationSequence.current) return;
        setValidation(report);
        setPhase("ready");
      } catch (validateError) {
        if (sequence !== validationSequence.current) return;
        setError(toConversionMessage(validateError));
        setPhase("idle");
      }
    },
    [level]
  );

  const convert = useCallback(async () => {
    if (!file || phase !== "ready") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const output = await conversion.convertToPdfA(
        new Uint8Array(await file.arrayBuffer()),
        { level, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setResult({
        blob: new Blob([output.data as unknown as BlobPart], { type: "application/pdf" }),
        repaired: output.repaired,
      });
      setPhase("done");
    } catch (convertError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(convertError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [file, level, phase]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const isBusy = phase === "validating" || phase === "processing";
  const levelLabel = LEVELS.find((entry) => entry.value === level)?.label ?? "PDF/A";

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">PDF/A Converter</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <Archive className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
          PDF/A Converter
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Convert a PDF into the archival PDF/A format for long-term storage. Every file is
          validated first, so you know what will change before anything is exported.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "validating" ? "Validating the document" : ""}
          {phase === "processing" ? `Converting. ${percent} percent complete.` : ""}
          {phase === "done" ? "Your PDF/A file is ready to download." : ""}
        </p>

        {phase === "done" && result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Converted to {levelLabel}</h2>
            <p className="text-xs text-muted-foreground mb-6">{formatFileSize(result.blob.size)}</p>

            {result.repaired.length > 0 && (
              <ul className="mb-7 text-left inline-block space-y-1">
                {result.repaired.map((entry) => (
                  <li key={entry} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result.blob, "archive-pdfa.pdf")}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF/A
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>Convert another PDF</Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept="application/pdf,.pdf"
              label="Choose a PDF to convert to PDF/A"
              onFilesSelected={(files) => void selectFile(files[0])}
              className="rounded-2xl border-2 border-dashed border-border/60 p-10 sm:p-16 text-center transition-colors hover:border-border hover:bg-muted/30"
            >
              {(isDragging) => (
                <div className={isDragging ? "scale-[1.01] transition-transform" : ""}>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 transition-all ${isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"}`}>
                    <Upload className={`w-8 h-8 ${isDragging ? "text-primary" : "text-primary/70"}`} aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    {isDragging ? "Drop your PDF here" : "Choose a PDF"}
                  </h2>
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
                    {validation ? ` · ${validation.pageCount} ${validation.pageCount === 1 ? "page" : "pages"}` : ""}
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

            <fieldset disabled={isBusy}>
              <legend className="text-sm font-medium mb-2">Conformance level</legend>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setLevel(entry.value)}
                    aria-pressed={level === entry.value}
                    className={`p-3 border rounded-lg text-sm transition-colors ${
                      level === entry.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <span className="font-medium block">{entry.label}</span>
                    <span className="text-xs opacity-75">{entry.detail}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {phase === "validating" && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Validating the document...
              </p>
            )}

            {validation && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Validation</p>
                {validation.issues.map((issue) => {
                  const Icon = SEVERITY_ICON[issue.severity];
                  return (
                    <div
                      key={issue.code}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${SEVERITY_STYLE[issue.severity]}`}
                    >
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{issue.message}</span>
                    </div>
                  );
                })}
              </div>
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
                  aria-label="Conversion progress"
                >
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Conversion failed</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            {validation && !validation.convertible ? (
              <Button size="lg" variant="outline" className="w-full" onClick={reset}>
                Choose a different file
              </Button>
            ) : (
              <Button size="lg" className="w-full" onClick={() => void convert()} disabled={isBusy || !validation}>
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {phase === "processing" ? "Converting..." : `Convert to ${levelLabel}`}
              </Button>
            )}
          </Card>
        )}
      </section>

      <section className="border-t bg-muted/30 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 sm:grid-cols-3 text-center">
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Shield className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Validated first</h2>
            <p className="text-sm text-muted-foreground">
              Problems are reported before anything is exported
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Integrity preserved</h2>
            <p className="text-sm text-muted-foreground">
              Pages and content are carried across unchanged
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Archive ready</h2>
            <p className="text-sm text-muted-foreground">
              sRGB output intent and conforming XMP metadata
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
