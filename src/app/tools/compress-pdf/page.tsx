"use client";

import { useRef, useState } from "react";
import { AlertCircle, Download, Loader2, Upload } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  compressPDF,
  downloadBlob,
  validatePDF,
  validatePDFSelection,
  type CompressionLevel,
  type ProcessingProgress,
} from "@/lib/pdf-utils";

export default function CompressPDFPage() {
  const validationSequence = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [compressed, setCompressed] = useState<Blob | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("medium");
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectFile(selected?: File) {
    if (!selected) return;
    const sequence = ++validationSequence.current;
    setFile(selected);
    setCompressed(null);
    setFileReady(false);
    setValidating(true);
    setError(null);

    const selection = validatePDFSelection(selected);
    if (!selection.valid) {
      setError(selection.error || "Choose a valid PDF");
      setValidating(false);
      return;
    }
    const validation = await validatePDF(selected);
    if (sequence !== validationSequence.current) return;
    if (!validation.valid) {
      setError(validation.error || "Choose a valid PDF");
      setValidating(false);
      return;
    }
    setFileReady(true);
    setValidating(false);
  }

  async function handleCompress() {
    if (!file || !fileReady || validating) return;
    setProcessing(true);
    setError(null);
    try {
      setCompressed(await compressPDF(file, compressionLevel, setProgress));
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Unable to compress PDF");
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${Math.round((bytes / 1024 ** index) * 100) / 100} ${units[index]}`;
  };
  const reduction = file && compressed ? Math.max(0, Math.round((1 - compressed.size / file.size) * 100)) : 0;
  const reset = () => {
    validationSequence.current += 1;
    setFile(null);
    setCompressed(null);
    setFileReady(false);
    setValidating(false);
    setError(null);
    setProgress(null);
  };

  return (
    <>
      <Navbar />
      <main>
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 text-center"><h1 className="text-4xl md:text-5xl font-bold mb-4">Compress PDF</h1><p className="text-lg text-muted-foreground max-w-2xl mx-auto">Reduce file size with lossless structural optimization</p></section>

        {!compressed ? (
          <>
            <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
              <PdfUploadZone
                onFilesSelected={(files) => void selectFile(files[0])}
                className="relative border-2 border-dashed rounded-lg p-16 text-center transition-colors border-input data-[dragging=true]:border-foreground"
              >
                {(isDragging) => (
                  <div className={isDragging ? "-m-16 p-16 bg-accent rounded-lg" : ""}>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent mb-4"><Upload className="w-5 h-5" /></div>
                    <h2 className="text-lg font-semibold mb-2">{isDragging ? "Drop file here" : "Upload PDF file"}</h2>
                    <p className="text-sm text-muted-foreground mb-6">Drag and drop or click to browse</p>
                    <Button size="lg" type="button" asChild><span>Choose file</span></Button>
                  </div>
                )}
              </PdfUploadZone>
            </section>

            {file && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <Card className="p-6 mb-6">
                  <div className="mb-6"><p className="font-medium mb-1">{file.name}</p><p className="text-sm text-muted-foreground">{formatFileSize(file.size)} · {validating ? "Checking PDF..." : fileReady ? "Ready" : "Needs attention"}</p></div>
                  <div className="space-y-3 mb-6"><p className="text-sm font-medium">Optimization level</p><div className="grid sm:grid-cols-3 gap-3">{([
                    ["low", "Low", "Maximum compatibility"],
                    ["medium", "Medium", "Balanced structure"],
                    ["high", "High", "Web optimized"],
                  ] as const).map(([value, label, description]) => <button key={value} onClick={() => setCompressionLevel(value)} className={`p-4 border rounded-lg text-left transition-colors ${compressionLevel === value ? "bg-foreground text-background border-foreground" : "hover:bg-accent"}`}><div className="font-medium mb-1">{label}</div><div className="text-sm opacity-70">{description}</div></button>)}</div></div>
                  <div className="p-4 bg-accent rounded-lg mb-6"><p className="text-sm font-medium">Lossless optimization</p><p className="text-xs text-muted-foreground mt-1">Actual reduction depends on the source file. Already optimized PDFs may remain the same size.</p></div>
                  {progress && <div className="mb-5"><div className="flex justify-between text-xs mb-2"><span>{progress.stage}</span><span>{Math.round((progress.progress / Math.max(progress.total, 1)) * 100)}%</span></div><div className="h-2 bg-muted rounded-full"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(progress.progress / Math.max(progress.total, 1)) * 100}%` }} /></div></div>}
                  {error && <div className="mb-5 flex gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive" role="alert"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</div>}
                  <Button size="lg" onClick={() => void handleCompress()} disabled={processing || validating || !fileReady} className="w-full">{(processing || validating) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{validating ? "Checking PDF..." : processing ? "Compressing..." : "Compress PDF"}</Button>
                </Card>
              </section>
            )}
          </>
        ) : (
          <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-24"><Card className="p-12 text-center"><div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent mb-6"><Download className="w-5 h-5" /></div><h2 className="text-xl font-semibold mb-2">File optimized successfully</h2><p className="text-sm text-muted-foreground mb-2">{reduction ? `${reduction}% smaller` : "The original was already optimized"}</p><p className="text-sm text-muted-foreground mb-8">{formatFileSize(compressed.size)}</p><div className="flex flex-col sm:flex-row items-center justify-center gap-3"><Button size="lg" onClick={() => downloadBlob(compressed, `${file?.name.replace(/\.pdf$/i, "") || "document"}-compressed.pdf`)}><Download className="w-4 h-4 mr-2" />Download PDF</Button><Button size="lg" variant="outline" onClick={reset}>Compress another file</Button></div></Card></section>
        )}

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t"><div className="grid md:grid-cols-3 gap-12"><div><h3 className="font-semibold mb-2">Quality preserved</h3><p className="text-sm text-muted-foreground">Lossless optimization keeps document content intact</p></div><div><h3 className="font-semibold mb-2">Fast processing</h3><p className="text-sm text-muted-foreground">Compress locally with optimized browser processing</p></div><div><h3 className="font-semibold mb-2">Private</h3><p className="text-sm text-muted-foreground">Files remain on your device during processing</p></div></div></section>
      </main>
      <Footer />
    </>
  );
}
