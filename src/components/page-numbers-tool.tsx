"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Hash,
  Loader2,
  Shield,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/pdf-utils";
import {
  MAX_CONVERSION_SIZE,
  formatPageLabel,
  toConversionMessage,
  validateConversionInput,
  validateSelection,
  type ConversionProgress,
  type NumberAlignment,
  type NumberFontFamily,
  type NumberPosition,
} from "@/lib/conversion";

type Phase = "idle" | "validating" | "ready" | "processing" | "done";

const FORMAT_PRESETS = [
  { value: "{n}", label: "1" },
  { value: "Page {n}", label: "Page 1" },
  { value: "Page {n} of {total}", label: "Page 1 of N" },
  { value: "- {n} -", label: "- 1 -" },
] as const;

const COLORS = [
  { value: "000000", label: "Black" },
  { value: "555555", label: "Grey" },
  { value: "1F3864", label: "Navy" },
  { value: "CC0000", label: "Red" },
] as const;

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

export function PageNumbersTool() {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [position, setPosition] = useState<NumberPosition>("bottom");
  const [alignment, setAlignment] = useState<NumberAlignment>("center");
  const [fontFamily, setFontFamily] = useState<NumberFontFamily>("helvetica");
  const [fontSize, setFontSize] = useState(11);
  const [color, setColor] = useState("000000");
  const [format, setFormat] = useState<string>("{n}");
  const [startNumber, setStartNumber] = useState(1);
  const [skipFirstPage, setSkipFirstPage] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
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

  const apply = useCallback(async () => {
    if (!file || phase !== "ready") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const bytes = await conversion.addPageNumbers(
        new Uint8Array(await file.arrayBuffer()),
        {
          position,
          alignment,
          fontFamily,
          fontSize,
          color,
          format,
          startNumber,
          skipFirstPage,
          signal: controller.signal,
        },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setResult(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
      setPhase("done");
    } catch (numberError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(numberError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [alignment, color, file, fontFamily, fontSize, format, phase, position, skipFirstPage, startNumber]);

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
            <li className="text-foreground font-medium" aria-current="page">Add Page Numbers</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <Hash className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Add Page Numbers
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Number your pages as a header or footer. Choose position, alignment, font, size and
          colour, set the starting number, and skip the cover page if you need to.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "processing" ? `Adding page numbers. ${percent} percent complete.` : ""}
          {phase === "done" ? "Your numbered PDF is ready to download." : ""}
        </p>

        {phase === "done" && result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Page numbers added</h2>
            <p className="text-xs text-muted-foreground mb-7">{formatFileSize(result.size)}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result, "numbered.pdf")}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>Number another PDF</Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept="application/pdf,.pdf"
              label="Choose a PDF to number"
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
                    {formatFileSize(file.size)} ·{" "}
                    {phase === "validating" ? "Checking file..." : phase === "processing" ? "Numbering..." : "Ready"}
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

            {/* Live preview of the label and where it will sit. */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div
                className={`flex h-24 rounded-lg bg-background border border-border/60 px-4 ${
                  position === "top" ? "items-start pt-3" : "items-end pb-3"
                } ${
                  alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center"
                }`}
              >
                <span
                  style={{
                    color: `#${color}`,
                    fontSize: `${Math.min(fontSize, 20)}px`,
                    fontFamily:
                      fontFamily === "times" ? "serif" : fontFamily === "courier" ? "monospace" : "sans-serif",
                  }}
                >
                  {formatPageLabel(format, startNumber, 10)}
                </span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset disabled={isBusy}>
                <legend className="text-sm font-medium mb-2">Position</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["top", "bottom"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPosition(value)}
                      aria-pressed={position === value}
                      className={optionButton(position === value)}
                    >
                      {value === "top" ? "Header (top)" : "Footer (bottom)"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset disabled={isBusy}>
                <legend className="text-sm font-medium mb-2">Alignment</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["left", "center", "right"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAlignment(value)}
                      aria-pressed={alignment === value}
                      className={optionButton(alignment === value)}
                    >
                      {value[0].toUpperCase() + value.slice(1)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset disabled={isBusy}>
                <legend className="text-sm font-medium mb-2">Font</legend>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["helvetica", "Sans"],
                    ["times", "Serif"],
                    ["courier", "Mono"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFontFamily(value)}
                      aria-pressed={fontFamily === value}
                      className={optionButton(fontFamily === value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset disabled={isBusy}>
                <legend className="text-sm font-medium mb-2">Colour</legend>
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      onClick={() => setColor(entry.value)}
                      aria-pressed={color === entry.value}
                      aria-label={entry.label}
                      title={entry.label}
                      className={`h-10 rounded-lg border-2 transition-all ${
                        color === entry.value ? "border-primary scale-105" : "border-border/60"
                      }`}
                      style={{ backgroundColor: `#${entry.value}` }}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="font-size">
                  Font size ({fontSize}pt)
                </label>
                <input
                  id="font-size"
                  type="range"
                  min={7}
                  max={28}
                  step={1}
                  disabled={isBusy}
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="start-number">Start numbering at</label>
                <Input
                  id="start-number"
                  type="number"
                  min={1}
                  max={99999}
                  disabled={isBusy}
                  value={startNumber}
                  onChange={(event) => setStartNumber(Math.max(1, Number(event.target.value) || 1))}
                />
              </div>
            </div>

            <fieldset disabled={isBusy}>
              <legend className="text-sm font-medium mb-2">Number format</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FORMAT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setFormat(preset.value)}
                    aria-pressed={format === preset.value}
                    className={optionButton(format === preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipFirstPage}
                disabled={isBusy}
                onChange={(event) => setSkipFirstPage(event.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-input"
              />
              <span>
                Skip the first page
                <span className="block text-xs text-muted-foreground">
                  Leaves a cover page unnumbered
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
                  aria-label="Numbering progress"
                >
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Could not add page numbers</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            <Button size="lg" className="w-full" onClick={() => void apply()} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === "processing" ? "Adding numbers..." : "Add page numbers"}
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
            <p className="text-sm text-muted-foreground">Numbering happens in your browser</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Real text</h2>
            <p className="text-sm text-muted-foreground">Numbers stay selectable and searchable</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Full control</h2>
            <p className="text-sm text-muted-foreground">Position, font, size, colour and start number</p>
          </div>
        </div>
      </section>
    </main>
  );
}
