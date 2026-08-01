"use client";

import { ChangeEvent, useRef, useState } from "react";
import { AlertCircle, Check, Download, FileText, Loader2, Upload, X } from "lucide-react";
import { PdfUploadZone } from "@/components/pdfpilot/pdf-upload-zone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ToolDefinition } from "@/lib/tools";
/*
 * Only the dependency-free validation helpers are imported statically. The
 * processing module pulls in `pdf-lib` (~430 kB), which is not needed until
 * the user actually picks a file, so it is loaded on demand by `pdfEngine()`
 * below. That keeps first paint on all twenty-seven tool pages cheap.
 */
import {
  parsePageSelection,
  validatePDFSelection,
  type ProcessingProgress,
} from "@/lib/pdf-types";
import type { TextPosition } from "@/lib/pdf-utils";
import { downloadBlob } from "@/lib/download";

/** Loads the PDF processing engine on first use. */
const pdfEngine = () => import("@/lib/pdf-utils");

interface GenericPdfToolProps { tool: ToolDefinition }
const fieldClass = "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

function outputName(input: string, suffix: string, extension = "pdf") {
  const base = input.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "document";
  return `${base}-${suffix}.${extension}`;
}

/**
 * Packages split pages into an archive.
 *
 * JSZip is imported on demand: only the split tools ever build an archive, so
 * a static import would add ~100 kB to every PDF tool page.
 */
async function zipBlobs(blobs: Blob[], baseName: string, extension: string) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  blobs.forEach((blob, index) => zip.file(`${baseName}-page-${index + 1}.${extension}`, blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function GenericPdfTool({ tool }: GenericPdfToolProps) {
  const imageMode = tool.id === "image-to-pdf";
  const validationSequence = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState("");
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);
  const [text, setText] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [position, setPosition] = useState<TextPosition>("bottom-center");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [imageFormat, setImageFormat] = useState<"png" | "jpeg">("png");
  const [processing, setProcessing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choosePdf(selected?: File) {
    if (!selected) return;
    const sequence = ++validationSequence.current;

    // Reflect the native selection before doing any asynchronous parsing. A
    // large document must never make the picker appear unresponsive.
    setFile(selected);
    setPageCount(0);
    setFileReady(false);
    setValidating(true);
    setError(null);
    setResult(null);

    const selection = validatePDFSelection(selected);
    if (!selection.valid) {
      setError(selection.error || "Choose a valid PDF");
      setValidating(false);
      return;
    }

    const allowEncrypted = tool.id === "unlock-pdf" || tool.id === "repair-pdf";
    // The parser is fetched here, at the moment a file is chosen, rather than
    // when the page loads.
    const pdf = await pdfEngine();
    const validation = await pdf.validatePDF(selected, { allowEncrypted });
    if (sequence !== validationSequence.current) return;
    if (!validation.valid) {
      setError(validation.error || "Choose a valid PDF");
      setValidating(false);
      return;
    }

    setFileReady(true);
    setValidating(false);
    try {
      const metadata = await pdf.getPDFMetadata(selected);
      if (sequence === validationSequence.current) {
        setPageCount(metadata.pageCount);
      }
    } catch {
      // Encrypted documents accepted by Unlock PDF cannot be inspected until
      // after decryption. Their selection is still valid and processable.
      if (sequence === validationSequence.current) setPageCount(0);
    }
  }

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []).filter((item) =>
      ["image/jpeg", "image/png"].includes(item.type)
    );
    if (!selected.length) return setError("Choose at least one JPG or PNG image");
    if (selected.some((item) => item.size > 20 * 1024 * 1024)) return setError("Each image must be below 20MB");
    setImages(selected);
    setError(null);
    setResult(null);
  }

  async function process() {
    if (
      (!imageMode && (!file || !fileReady || validating)) ||
      (imageMode && !images.length)
    ) return;
    setProcessing(true);
    setError(null);
    setProgress(null);
    const startedAt = performance.now();
    try {
      let blob: Blob;
      let name: string;
      const progressCallback = (value: ProcessingProgress) => setProgress(value);
      // Already resolved from the validation step, so this is a cache hit.
      const pdf = await pdfEngine();

      switch (tool.id) {
        case "image-to-pdf":
          blob = await pdf.imagesToPDF(images, progressCallback);
          name = "images-combined.pdf";
          break;
        case "pdf-to-image": {
          const rendered = await pdf.renderPDFToImages(file!, imageFormat, progressCallback);
          blob = await zipBlobs(rendered, file!.name.replace(/\.pdf$/i, ""), imageFormat === "jpeg" ? "jpg" : "png");
          name = outputName(file!.name, "images", "zip");
          break;
        }
        case "split-pdf": {
          const split = await pdf.splitPDF(file!, progressCallback);
          blob = await zipBlobs(split, file!.name.replace(/\.pdf$/i, ""), "pdf");
          name = outputName(file!.name, "pages", "zip");
          break;
        }
        case "rotate-pdf": {
          const selectedPages = pages.trim()
            ? parsePageSelection(pages, pageCount)
            : Array.from({ length: pageCount }, (_, index) => index + 1);
          blob = await pdf.rotatePages(file!, selectedPages, rotation, progressCallback);
          name = outputName(file!.name, "rotated");
          break;
        }
        case "delete-pages": {
          const selectedPages = parsePageSelection(pages, pageCount);
          if (selectedPages.length >= pageCount) throw new Error("At least one page must remain");
          blob = await pdf.deletePages(file!, selectedPages, progressCallback);
          name = outputName(file!.name, "pages-removed");
          break;
        }
        case "repair-pdf":
          blob = await pdf.repairPDF(file!, progressCallback);
          name = outputName(file!.name, "repaired");
          break;
        case "watermark-pdf":
          if (!text.trim()) throw new Error("Enter watermark text");
          blob = await pdf.addWatermark(file!, text.trim(), progressCallback);
          name = outputName(file!.name, "watermarked");
          break;
        case "edit-pdf":
          if (!text.trim()) throw new Error("Enter text to add");
          blob = await pdf.addTextToPDF(file!, text.trim(), pageNumber, position, 18, false, progressCallback);
          name = outputName(file!.name, "edited");
          break;
        case "sign-pdf":
          if (!text.trim()) throw new Error("Enter the signer name");
          blob = await pdf.addTextToPDF(file!, text.trim(), pageNumber, position, 28, true, progressCallback);
          name = outputName(file!.name, "signed");
          break;
        case "protect-pdf":
          if (password.length < 8) throw new Error("Use a password with at least 8 characters");
          if (password !== confirmPassword) throw new Error("Passwords do not match");
          blob = await pdf.protectPDF(file!, password, progressCallback);
          name = outputName(file!.name, "protected");
          break;
        case "unlock-pdf":
          if (!password) throw new Error("Enter the PDF password");
          blob = await pdf.unlockPDF(file!, password, progressCallback);
          name = outputName(file!.name, "unlocked");
          break;
        default:
          throw new Error("Unsupported operation");
      }

      setResult({ blob, name });
      setProgress({ stage: `Completed in ${((performance.now() - startedAt) / 1000).toFixed(1)}s`, progress: 1, total: 1 });
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Unable to process this file");
      setProgress(null);
    } finally {
      setProcessing(false);
    }
  }

  const hasInput = imageMode ? images.length > 0 : Boolean(file);
  const reset = () => {
    validationSequence.current += 1;
    setFile(null);
    setImages([]);
    setPageCount(0);
    setFileReady(false);
    setValidating(false);
    setResult(null);
    setError(null);
    setProgress(null);
  };

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-5xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center"><div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6"><FileText className="w-7 h-7 text-primary" /></div><h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{tool.name}</h1><p className="text-lg text-muted-foreground max-w-2xl mx-auto">{tool.description}. Processing happens locally in your browser.</p></section>

      <section className="max-w-3xl mx-auto px-6 lg:px-8 pb-12">
        {!hasInput ? (
          imageMode ? (
            <label className="block rounded-2xl border-2 border-dashed border-border/60 p-12 sm:p-16 text-center hover:bg-muted/30 cursor-pointer transition-colors">
              <Upload className="w-10 h-10 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Choose images</h2>
              <p className="text-sm text-muted-foreground mb-6">JPG or PNG, up to 20MB each</p>
              <Button type="button" asChild><span>Browse files</span></Button>
              <input className="sr-only" type="file" accept="image/jpeg,image/png" multiple onChange={chooseImages} />
            </label>
          ) : (
            <PdfUploadZone
              onFilesSelected={(files) => void choosePdf(files[0])}
              className="rounded-2xl border-2 border-dashed border-border/60 p-12 sm:p-16 text-center hover:bg-muted/30 transition-colors"
            >
              {(isDragging) => (
                <>
                  <Upload className="w-10 h-10 text-primary mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">
                    {isDragging ? "Drop PDF here" : "Choose a PDF file"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">PDF, up to 100MB</p>
                  <Button type="button" asChild><span>Browse files</span></Button>
                </>
              )}
            </PdfUploadZone>
          )
        ) : result ? (
          <Card className="p-10 text-center"><div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-5"><Check className="h-7 w-7 text-primary" /></div><h2 className="text-2xl font-semibold mb-2">Your file is ready</h2><p className="text-sm text-muted-foreground mb-7">{result.name}</p><div className="flex flex-col sm:flex-row justify-center gap-3"><Button onClick={() => downloadBlob(result.blob, result.name)}><Download className="mr-2 h-4 w-4" />Download</Button><Button variant="outline" onClick={reset}>Process another file</Button></div></Card>
        ) : (
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{imageMode ? `${images.length} images selected` : file?.name}</h2><p className="text-xs text-muted-foreground mt-1">{imageMode ? "Images are added in file-picker order" : validating ? "Checking PDF..." : pageCount ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}` : fileReady ? "Ready to process" : "PDF needs attention"}</p></div><button onClick={reset} className="p-2 rounded-lg hover:bg-accent" aria-label="Remove file"><X className="h-4 w-4" /></button></div>

            {tool.id === "pdf-to-image" && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="format">Image format</label><select id="format" value={imageFormat} onChange={(event) => setImageFormat(event.target.value as "png" | "jpeg")} className={fieldClass}><option value="png">PNG</option><option value="jpeg">JPG</option></select></div>}
            {(tool.id === "rotate-pdf" || tool.id === "delete-pages") && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="pages">{tool.id === "rotate-pdf" ? "Pages (leave blank for all)" : "Pages to delete"}</label><Input id="pages" value={pages} onChange={(event) => setPages(event.target.value)} placeholder="1, 3-5" required={tool.id === "delete-pages"} /><p className="text-xs text-muted-foreground">Use commas and ranges between 1 and {pageCount}.</p></div>}
            {tool.id === "rotate-pdf" && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="rotation">Rotation</label><select id="rotation" value={rotation} onChange={(event) => setRotation(Number(event.target.value) as 90 | 180 | 270)} className={fieldClass}><option value={90}>90° clockwise</option><option value={180}>180°</option><option value={270}>270° clockwise</option></select></div>}
            {["watermark-pdf", "edit-pdf", "sign-pdf"].includes(tool.id) && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="tool-text">{tool.id === "watermark-pdf" ? "Watermark text" : tool.id === "sign-pdf" ? "Signer name" : "Text to add"}</label><Input id="tool-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={120} required /></div>}
            {["edit-pdf", "sign-pdf"].includes(tool.id) && <div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><label className="text-sm font-medium" htmlFor="page-number">Page</label><Input id="page-number" type="number" min={1} max={pageCount} value={pageNumber} onChange={(event) => setPageNumber(Number(event.target.value))} /></div><div className="space-y-2"><label className="text-sm font-medium" htmlFor="position">Position</label><select id="position" value={position} onChange={(event) => setPosition(event.target.value as TextPosition)} className={fieldClass}><option value="top-left">Top left</option><option value="top-center">Top center</option><option value="top-right">Top right</option><option value="center">Center</option><option value="bottom-left">Bottom left</option><option value="bottom-center">Bottom center</option><option value="bottom-right">Bottom right</option></select></div></div>}
            {["protect-pdf", "unlock-pdf"].includes(tool.id) && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="password">PDF password</label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={tool.id === "protect-pdf" ? 8 : undefined} maxLength={128} required /></div>}
            {tool.id === "protect-pdf" && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="confirm-password">Confirm password</label><Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required /></div>}
            {tool.id === "sign-pdf" && <p className="text-xs text-muted-foreground">This adds a visual signature. It is not a certificate-backed cryptographic digital signature.</p>}
            {progress && <div><div className="flex justify-between text-xs mb-2"><span>{progress.stage}</span><span>{Math.round((progress.progress / Math.max(progress.total, 1)) * 100)}%</span></div><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(progress.progress / Math.max(progress.total, 1)) * 100}%` }} /></div></div>}
            {error && <div className="flex gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive" role="alert"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}</div>}
            <Button size="lg" className="w-full" onClick={() => void process()} disabled={processing || validating || (!imageMode && !fileReady)}>{(processing || validating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{validating ? "Checking PDF..." : processing ? "Processing..." : tool.name}</Button>
          </Card>
        )}
      </section>
      <section className="border-t py-16"><div className="max-w-4xl mx-auto px-6 grid sm:grid-cols-3 gap-8 text-center"><div><h3 className="font-semibold mb-2">Private</h3><p className="text-sm text-muted-foreground">Files stay on your device</p></div><div><h3 className="font-semibold mb-2">Responsive</h3><p className="text-sm text-muted-foreground">Clear progress and downloads</p></div><div><h3 className="font-semibold mb-2">No installation</h3><p className="text-sm text-muted-foreground">Runs in a modern browser</p></div></div></section>
    </main>
  );
}
