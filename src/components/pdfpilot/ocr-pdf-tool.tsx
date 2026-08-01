"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  ScanText,
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
  MAX_CONVERSION_SIZE,
  toConversionMessage,
  validateConversionInput,
  validateSelection,
  type ConversionProgress,
  OCR_LANGUAGES,
} from "@/lib/conversion/client";
import {
  type OcrResult,
} from "@/lib/conversion";
import { formatBytes as formatFileSize } from "@/lib/format";

type Phase = "idle" | "validating" | "ready" | "processing" | "done";

const QUALITY_CHOICES = [
  { dpi: 150, label: "Fast", detail: "150 DPI" },
  { dpi: 200, label: "Balanced", detail: "200 DPI" },
  { dpi: 300, label: "Accurate", detail: "300 DPI" },
] as const;


function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[^\w\-. ]+/g, "-").trim() || "document";
}

export function OcrPdfTool() {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [languages, setLanguages] = useState<string[]>(["eng"]);
  const [dpi, setDpi] = useState<number>(200);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
    setProgress(null);
    setError(null);
    setResult(null);
    setCopied(false);
  }, []);

  const selectFile = useCallback(async (selected?: File) => {
    if (!selected) return;
    const sequence = ++validationSequence.current;

    setFile(selected);
    setPhase("validating");
    setError(null);
    setResult(null);

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

  const runOcr = useCallback(async () => {
    if (!file || phase !== "ready") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const output = await conversion.ocrPdf(
        new Uint8Array(await file.arrayBuffer()),
        { languages, dpi, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setResult(output);
      setPhase("done");
    } catch (ocrError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(ocrError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [dpi, file, languages, phase]);

  const toggleLanguage = (code: string) => {
    setLanguages((current) => {
      if (current.includes(code)) {
        // At least one language must stay selected.
        return current.length === 1 ? current : current.filter((entry) => entry !== code);
      }
      return [...current, code];
    });
  };

  const copyText = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser blocked clipboard access. Download the text instead.");
    }
  };

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const isBusy = phase === "validating" || phase === "processing";
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
            <li className="text-foreground font-medium" aria-current="page">OCR PDF</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <ScanText className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">OCR PDF</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Turn a scanned PDF into text you can search, select and copy. PDFPilot recognises the
          page images and adds an invisible text layer, so the document looks exactly the same.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "processing" ? `Recognising text. ${progress?.stage || ""} ${percent} percent complete.` : ""}
          {phase === "done" ? "Recognition complete. Your searchable PDF is ready." : ""}
        </p>

        {phase === "done" && result ? (
          <Card className="p-6 sm:p-8">
            <div className="text-center mb-7">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
                <Check className="h-7 w-7 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Text recognised</h2>
              <p className="text-xs text-muted-foreground">
                {result.pages.length} {result.pages.length === 1 ? "page" : "pages"} ·{" "}
                {result.averageConfidence}% average confidence ·{" "}
                {formatFileSize(result.searchablePdf.byteLength)}
              </p>
            </div>

            {result.averageConfidence < 70 && (
              <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Low confidence result
                </p>
                <p className="text-amber-800/90 dark:text-amber-300/90 mt-1">
                  The scan may be blurred, skewed or low resolution. Try the Accurate setting, or
                  rescan the document at a higher quality.
                </p>
              </div>
            )}

            <div className="mb-6">
              <p className="text-sm font-medium mb-2">Recognised text</p>
              <textarea
                readOnly
                value={result.text}
                rows={10}
                className="w-full rounded-lg border border-input bg-muted/30 p-3 text-sm font-mono"
                aria-label="Recognised text"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button
                size="lg"
                onClick={() =>
                  downloadBlob(
                    new Blob([result.searchablePdf as unknown as BlobPart], { type: "application/pdf" }),
                    `${baseName(file?.name || "document")}-searchable.pdf`
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download searchable PDF
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  downloadBlob(
                    new Blob([result.text], { type: "text/plain;charset=utf-8" }),
                    `${baseName(file?.name || "document")}.txt`
                  )
                }
              >
                Download text
              </Button>
              <Button size="lg" variant="ghost" onClick={() => void copyText()}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="mt-4 text-center">
              <Button variant="ghost" onClick={reset}>Recognise another PDF</Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept="application/pdf,.pdf"
              label="Choose a scanned PDF to recognise"
              onFilesSelected={(files) => void selectFile(files[0])}
              className="rounded-2xl border-2 border-dashed border-border/60 p-10 sm:p-16 text-center transition-colors hover:border-border hover:bg-muted/30"
            >
              {(isDragging) => (
                <div className={isDragging ? "scale-[1.01] transition-transform" : ""}>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 transition-all ${isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"}`}>
                    <Upload className={`w-8 h-8 ${isDragging ? "text-primary" : "text-primary/70"}`} aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    {isDragging ? "Drop your PDF here" : "Choose a scanned PDF"}
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
                    {formatFileSize(file.size)} ·{" "}
                    {phase === "validating" ? "Checking file..." : phase === "processing" ? "Recognising..." : "Ready"}
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
              <legend className="text-sm font-medium mb-2">
                Language{languages.length > 1 ? "s" : ""}
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OCR_LANGUAGES.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => toggleLanguage(language.code)}
                    aria-pressed={languages.includes(language.code)}
                    className={optionButton(languages.includes(language.code))}
                  >
                    {language.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Select more than one if the document mixes scripts.
              </p>
            </fieldset>

            <fieldset disabled={isBusy}>
              <legend className="text-sm font-medium mb-2">Quality</legend>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_CHOICES.map((choice) => (
                  <button
                    key={choice.dpi}
                    type="button"
                    onClick={() => setDpi(choice.dpi)}
                    aria-pressed={dpi === choice.dpi}
                    className={optionButton(dpi === choice.dpi)}
                  >
                    <span className="font-medium block">{choice.label}</span>
                    <span className="text-xs opacity-75">{choice.detail}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-xs text-muted-foreground rounded-lg bg-muted/60 p-3">
              The first run downloads a language model from this site, then recognition happens
              entirely on your device. Long documents can take a minute or two.
            </p>

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
                  aria-label="Recognition progress"
                >
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Recognition failed</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            <Button size="lg" className="w-full" onClick={() => void runOcr()} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === "processing" ? "Recognising text..." : "Recognise text"}
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
              Recognition runs on your device; no page is ever uploaded
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Searchable output</h2>
            <p className="text-sm text-muted-foreground">
              The page looks unchanged but the text can be found and copied
            </p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Five languages</h2>
            <p className="text-sm text-muted-foreground">
              English, Hindi, French, German and Spanish, combinable
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
