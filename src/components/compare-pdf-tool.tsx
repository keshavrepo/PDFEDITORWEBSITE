"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  FileText,
  GitCompare,
  Loader2,
  Shield,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  toConversionMessage,
  validateConversionInput,
  validateSelection,
  type ComparisonSummary,
  type ConversionProgress,
  type PageStatus,
} from "@/lib/conversion";

type Phase = "idle" | "comparing" | "done";
type Slot = "original" | "revised";

const STATUS_STYLES: Record<PageStatus, { label: string; className: string }> = {
  unchanged: { label: "Unchanged", className: "bg-muted text-muted-foreground" },
  modified: { label: "Modified", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  added: { label: "Added", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  removed: { label: "Removed", className: "bg-destructive/15 text-destructive" },
};

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

export function ComparePdfTool() {
  const abortRef = useRef<AbortController | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [revised, setRevised] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOriginal(null);
    setRevised(null);
    setPhase("idle");
    setProgress(null);
    setError(null);
    setSummary(null);
  }, []);

  const selectFile = useCallback(async (slot: Slot, selected?: File) => {
    if (!selected) return;
    setError(null);
    setSummary(null);

    const quick = validateSelection(selected, "pdf");
    if (!quick.valid) {
      setError(quick.error || "Choose a valid PDF");
      return;
    }
    const validation = await validateConversionInput(selected, "pdf");
    if (!validation.valid) {
      setError(validation.error || "Choose a valid PDF");
      return;
    }
    if (slot === "original") setOriginal(selected);
    else setRevised(selected);
  }, []);

  const compare = useCallback(async () => {
    if (!original || !revised || phase === "comparing") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("comparing");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const [originalBytes, revisedBytes] = await Promise.all([
        original.arrayBuffer(),
        revised.arrayBuffer(),
      ]);

      const result = await conversion.comparePdfs(
        new Uint8Array(originalBytes),
        new Uint8Array(revisedBytes),
        { caseSensitive, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setSummary(result);
      setPhase("done");
    } catch (compareError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(compareError));
      setPhase("idle");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [caseSensitive, original, phase, revised]);

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;

  const slot = (which: Slot, file: File | null, label: string) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {file ? (
        <Card className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (which === "original" ? setOriginal(null) : setRevised(null))}
            disabled={phase === "comparing"}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-40"
            aria-label={`Remove ${label}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </Card>
      ) : (
        <PdfUploadZone
          accept="application/pdf,.pdf"
          label={`Choose the ${label.toLowerCase()}`}
          onFilesSelected={(files) => void selectFile(which, files[0])}
          className="rounded-xl border-2 border-dashed border-border/60 p-6 text-center transition-colors hover:border-border hover:bg-muted/30"
        >
          {(isDragging) => (
            <div>
              <Upload
                className={`w-6 h-6 mx-auto mb-2 ${isDragging ? "text-primary" : "text-primary/70"}`}
                aria-hidden="true"
              />
              <p className="text-sm font-medium mb-1">
                {isDragging ? "Drop here" : "Choose a PDF"}
              </p>
              <p className="text-xs text-muted-foreground">Drag and drop or browse</p>
            </div>
          )}
        </PdfUploadZone>
      )}
    </div>
  );

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">Compare PDF</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <GitCompare className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Compare PDF</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          See exactly what changed between two versions. PDFPilot matches pages first, so inserted
          and deleted pages are reported as such instead of shifting everything after them.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "comparing" ? `Comparing. ${percent} percent complete.` : ""}
          {phase === "done" && summary
            ? summary.identical
              ? "The documents are identical."
              : `Found ${summary.totalAdded} added and ${summary.totalRemoved} removed words.`
            : ""}
        </p>

        {phase === "done" && summary ? (
          <div className="space-y-6">
            <Card className="p-6 sm:p-8 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
                <Check className="h-7 w-7 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                {summary.identical ? "The documents match" : "Differences found"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {summary.originalPageCount} → {summary.revisedPageCount} pages
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                {([
                  ["Words added", summary.totalAdded, "text-emerald-600 dark:text-emerald-400"],
                  ["Words removed", summary.totalRemoved, "text-destructive"],
                  ["Pages modified", summary.pagesModified, "text-amber-600 dark:text-amber-400"],
                  ["Pages added", summary.pagesAdded, "text-emerald-600 dark:text-emerald-400"],
                ] as const).map(([label, value, tone]) => (
                  <div key={label} className="rounded-lg border border-border/60 p-3">
                    <p className={`text-xl font-semibold ${tone}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <h3 className="font-semibold mb-4">Page by page</h3>
              <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1">
                {summary.pages.map((page, index) => {
                  const style = STATUS_STYLES[page.status];
                  return (
                    <div key={index} className="rounded-lg border border-border/60 p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
                          {style.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {page.originalPage !== null ? `Original p.${page.originalPage}` : "Not in original"}
                          {" → "}
                          {page.revisedPage !== null ? `Revised p.${page.revisedPage}` : "Not in revision"}
                        </span>
                        {page.status === "modified" && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            +{page.addedWords} / −{page.removedWords}
                          </span>
                        )}
                      </div>

                      {page.changes.length > 0 && (
                        <p className="text-sm leading-relaxed break-words">
                          {page.changes.slice(0, 60).map((change, changeIndex) => {
                            if (change.type === "equal") {
                              // Context is dimmed so real edits stand out.
                              return (
                                <span key={changeIndex} className="text-muted-foreground">
                                  {change.text}{" "}
                                </span>
                              );
                            }
                            return (
                              <span
                                key={changeIndex}
                                className={
                                  change.type === "insert"
                                    ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded px-0.5"
                                    : "bg-destructive/20 text-destructive line-through rounded px-0.5"
                                }
                              >
                                {change.text}{" "}
                              </span>
                            );
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="text-center">
              <Button variant="outline" onClick={reset}>Compare different files</Button>
            </div>
          </div>
        ) : (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {slot("original", original, "Original")}
              {slot("revised", revised, "Revised")}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={caseSensitive}
                disabled={phase === "comparing"}
                onChange={(event) => setCaseSensitive(event.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-input"
              />
              <span>
                Case sensitive
                <span className="block text-xs text-muted-foreground">
                  Treat a change of capitalisation as a difference
                </span>
              </span>
            </label>

            {progress && phase === "comparing" && (
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
                  aria-label="Comparison progress"
                >
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">Could not compare</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={() => void compare()}
              disabled={!original || !revised || phase === "comparing"}
            >
              {phase === "comparing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === "comparing"
                ? "Comparing..."
                : !original || !revised
                  ? "Choose both PDFs"
                  : "Compare documents"}
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
            <p className="text-sm text-muted-foreground">Both files stay on your device</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Word level</h2>
            <p className="text-sm text-muted-foreground">Highlights the exact words that changed</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Page aware</h2>
            <p className="text-sm text-muted-foreground">Inserted and deleted pages are recognised</p>
          </div>
        </div>
      </section>
    </main>
  );
}
