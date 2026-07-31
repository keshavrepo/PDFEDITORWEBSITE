"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Loader2,
  PenLine,
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
  toConversionMessage,
  validateConversionInput,
  validateSelection,
  type ConversionProgress,
  type FormFieldDescriptor,
  type FormInspection,
  type FormValues,
} from "@/lib/conversion";

type Phase = "idle" | "validating" | "ready" | "processing" | "done";

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** index) * 10) / 10} ${units[index]}`;
}

const fieldClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50";

const TYPE_LABEL: Record<FormFieldDescriptor["type"], string> = {
  text: "Text",
  checkbox: "Checkbox",
  radio: "Radio",
  dropdown: "Dropdown",
  optionlist: "Multi-select",
  signature: "Signature",
  button: "Button",
};

export function PdfFormsTool() {
  const validationSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [inspection, setInspection] = useState<FormInspection | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [flatten, setFlatten] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  const reset = useCallback(() => {
    validationSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setPhase("idle");
    setInspection(null);
    setValues({});
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
    setInspection(null);
    setValues({});

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
      const report = await conversion.inspectPdfForm(new Uint8Array(await selected.arrayBuffer()));
      if (sequence !== validationSequence.current) return;

      setInspection(report);
      // Seed the editor with the values already stored in the PDF.
      const seeded: FormValues = {};
      for (const field of report.fields) {
        if (field.type === "checkbox") seeded[field.name] = field.value === true;
        else if (field.type === "optionlist") {
          seeded[field.name] = Array.isArray(field.value) ? field.value : [];
        } else seeded[field.name] = typeof field.value === "string" ? field.value : "";
      }
      setValues(seeded);
      setPhase("ready");
    } catch (inspectError) {
      if (sequence !== validationSequence.current) return;
      setError(toConversionMessage(inspectError));
      setPhase("idle");
    }
  }, []);

  const save = useCallback(async () => {
    if (!file || phase !== "ready") return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("processing");
    setError(null);
    setProgress({ stage: "Starting", progress: 0, total: 100 });

    try {
      const conversion = await import("@/lib/conversion");
      const bytes = await conversion.fillPdfForm(
        new Uint8Array(await file.arrayBuffer()),
        values,
        { flatten, signal: controller.signal },
        (value) => {
          if (!controller.signal.aborted) setProgress(value);
        }
      );
      if (controller.signal.aborted) return;
      setResult(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
      setPhase("done");
    } catch (fillError) {
      if (controller.signal.aborted) return;
      setError(toConversionMessage(fillError));
      setPhase("ready");
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  }, [file, flatten, phase, values]);

  const setValue = (name: string, value: FormValues[string]) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const percent = progress
    ? Math.min(100, Math.round((progress.progress / Math.max(progress.total, 1)) * 100))
    : 0;
  const isBusy = phase === "validating" || phase === "processing";
  const fillable = inspection?.fields.filter((field) => field.type !== "button") ?? [];

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 text-center">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium" aria-current="page">Fill PDF Forms</li>
          </ol>
        </nav>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
          <PenLine className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Fill PDF Forms
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Detect fillable fields in a PDF and complete them in your browser. Text boxes,
          checkboxes, radio buttons and dropdowns are all supported.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <p className="sr-only" role="status" aria-live="polite">
          {phase === "validating"
            ? "Checking the selected file"
            : phase === "processing"
              ? `Saving form. ${percent} percent complete.`
              : phase === "done"
                ? "Your completed PDF is ready to download."
                : ""}
        </p>

        {phase === "done" && result ? (
          <Card className="p-8 sm:p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Form completed</h2>
            <p className="text-xs text-muted-foreground mb-7">
              {formatFileSize(result.size)}
              {flatten ? " · flattened" : " · still editable"}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" onClick={() => downloadBlob(result, "completed-form.pdf")}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
              <Button size="lg" variant="outline" onClick={reset}>
                Fill another form
              </Button>
            </div>
          </Card>
        ) : !file ? (
          <>
            <PdfUploadZone
              accept="application/pdf,.pdf"
              label="Choose a PDF form to fill"
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
                    {isDragging ? "Drop your PDF here" : "Choose a PDF form"}
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
                  <p className="font-medium text-destructive">Cannot open this file</p>
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
                      ? "Detecting form fields..."
                      : inspection
                        ? `${fillable.length} ${fillable.length === 1 ? "field" : "fields"} detected`
                        : "Reading..."}
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

            {inspection && !inspection.hasForm && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  No fillable form found
                </p>
                <p className="text-amber-800/90 dark:text-amber-300/90 mt-1">
                  This PDF has no interactive form fields. To add text to a flat PDF, use the{" "}
                  <Link href="/tools/edit-pdf" className="underline">Edit PDF</Link> tool instead.
                </p>
              </div>
            )}

            {inspection?.isXfa && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  XFA form detected
                </p>
                <p className="text-amber-800/90 dark:text-amber-300/90 mt-1">
                  This form uses Adobe XFA, which browsers cannot fill. Open it in Adobe Acrobat,
                  or ask the sender for a standard AcroForm version.
                </p>
              </div>
            )}

            {fillable.length > 0 && (
              <div className="space-y-5 max-h-[28rem] overflow-y-auto pr-1">
                {fillable.map((field) => {
                  const id = `field-${field.name.replace(/[^\w-]/g, "_")}`;
                  const disabled = field.readOnly || isBusy;

                  return (
                    <div key={field.name} className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <label htmlFor={id} className="text-sm font-medium break-all">
                          {field.name}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </label>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {TYPE_LABEL[field.type]}
                          {field.readOnly ? " · read-only" : ""}
                        </span>
                      </div>

                      {field.type === "text" && field.multiline && (
                        <textarea
                          id={id}
                          rows={3}
                          disabled={disabled}
                          maxLength={field.maxLength}
                          value={String(values[field.name] ?? "")}
                          onChange={(event) => setValue(field.name, event.target.value)}
                          className="w-full rounded-lg border border-input bg-background p-3 text-sm disabled:opacity-50"
                        />
                      )}

                      {field.type === "text" && !field.multiline && (
                        <Input
                          id={id}
                          disabled={disabled}
                          maxLength={field.maxLength}
                          value={String(values[field.name] ?? "")}
                          onChange={(event) => setValue(field.name, event.target.value)}
                        />
                      )}

                      {field.type === "checkbox" && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            id={id}
                            type="checkbox"
                            disabled={disabled}
                            checked={values[field.name] === true}
                            onChange={(event) => setValue(field.name, event.target.checked)}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span className="text-muted-foreground">Checked</span>
                        </label>
                      )}

                      {field.type === "radio" && (
                        <div id={id} role="radiogroup" aria-label={field.name} className="flex flex-wrap gap-3">
                          {(field.options ?? []).map((option) => (
                            <label key={option} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name={field.name}
                                value={option}
                                disabled={disabled}
                                checked={values[field.name] === option}
                                onChange={() => setValue(field.name, option)}
                                className="h-4 w-4 border-input"
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === "dropdown" && (
                        <select
                          id={id}
                          disabled={disabled}
                          value={String(values[field.name] ?? "")}
                          onChange={(event) => setValue(field.name, event.target.value)}
                          className={fieldClass}
                        >
                          <option value="">— Not selected —</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}

                      {field.type === "optionlist" && (
                        <select
                          id={id}
                          multiple
                          size={Math.min(4, (field.options ?? []).length || 2)}
                          disabled={disabled}
                          value={Array.isArray(values[field.name]) ? (values[field.name] as string[]) : []}
                          onChange={(event) =>
                            setValue(
                              field.name,
                              Array.from(event.target.selectedOptions, (option) => option.value)
                            )
                          }
                          className="w-full rounded-lg border border-input bg-background p-2 text-sm disabled:opacity-50"
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}

                      {field.type === "signature" && (
                        <p className="text-xs text-muted-foreground rounded-lg bg-muted/60 p-3">
                          This is a digital signature field. PDFPilot cannot apply a
                          certificate-backed signature in the browser, so it is left untouched.
                          Use the{" "}
                          <Link href="/tools/sign-pdf" className="underline">Sign PDF</Link> tool
                          to add a visual signature instead.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {fillable.length > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={flatten}
                  disabled={isBusy}
                  onChange={(event) => setFlatten(event.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-input"
                />
                <span>
                  Flatten the form
                  <span className="block text-xs text-muted-foreground">
                    Locks the values in place so the PDF is no longer editable
                  </span>
                </span>
              </label>
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
                  aria-label="Saving progress"
                >
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
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
                  <p className="font-medium text-destructive">Could not save the form</p>
                  <p className="text-destructive/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            {fillable.length > 0 ? (
              <Button size="lg" className="w-full" onClick={() => void save()} disabled={isBusy}>
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {phase === "processing" ? "Saving..." : "Save completed PDF"}
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="w-full" onClick={reset}>
                Choose a different file
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
            <h2 className="font-semibold mb-2">Private by design</h2>
            <p className="text-sm text-muted-foreground">Forms are filled in your browser and never uploaded</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Every field type</h2>
            <p className="text-sm text-muted-foreground">Text, checkboxes, radio buttons, dropdowns and lists</p>
          </div>
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Check className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold mb-2">Keep or lock</h2>
            <p className="text-sm text-muted-foreground">Stay editable, or flatten so values cannot change</p>
          </div>
        </div>
      </section>
    </main>
  );
}
