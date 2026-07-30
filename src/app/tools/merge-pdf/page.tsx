"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload,
  X,
  Download,
  Loader2,
  GripVertical,
  FileText,
  Check,
  Shield,
  Zap,
  AlertCircle,
} from "lucide-react";
import { mergePDFs, downloadBlob, validatePDF, type ProcessingProgress } from "@/lib/pdf-utils";

export default function MergePDFPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [mergedPDF, setMergedPDF] = useState<Blob | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf"
    );
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file) => file.type === "application/pdf"
      );
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    setProcessing(true);
    setError(null);
    setProgress(null);
    
    try {
      // Validate all files first
      for (const file of files) {
        const validation = await validatePDF(file);
        if (!validation.valid) {
          throw new Error(`${file.name}: ${validation.error}`);
        }
      }
      
      // Merge PDFs
      const merged = await mergePDFs(files, (p) => setProgress(p));
      setMergedPDF(merged);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge PDFs');
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  };

  const handleDownload = () => {
    if (mergedPDF) {
      downloadBlob(mergedPDF, 'merged.pdf');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <>
      <Navbar />
      
      <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Header */}
        <section className="max-w-5xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-6">
            <FileText className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Merge PDF Files
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Combine multiple PDF files into one document. Fast, secure, and easy to use.
          </p>
        </section>

        {!completed ? (
          <>
            {/* Upload Area */}
            <section className="max-w-4xl mx-auto px-6 lg:px-8 pb-12">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed p-16 transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border/60 hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 transition-all ${
                    isDragging
                      ? "bg-primary/20 scale-110"
                      : "bg-primary/10"
                  }`}>
                    <Upload className={`w-8 h-8 ${
                      isDragging ? "text-primary" : "text-primary/70"
                    }`} />
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-2">
                    {isDragging ? "Drop files here" : "Upload PDF files"}
                  </h3>
                  <p className="text-muted-foreground mb-8">
                    Drag and drop or click to browse
                  </p>
                  
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button size="lg" asChild>
                      <span className="cursor-pointer">
                        Choose files
                      </span>
                    </Button>
                  </label>
                  
                  <p className="text-sm text-muted-foreground mt-6">
                    Maximum file size: 100MB per file
                  </p>
                </div>
              </div>
            </section>

            {/* File List */}
            {files.length > 0 && (
              <section className="max-w-4xl mx-auto px-6 lg:px-8 pb-24">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {files.length} {files.length === 1 ? "file" : "files"} selected
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Drag to reorder • Files will be merged in this order
                    </p>
                  </div>
                  <button
                    onClick={() => setFiles([])}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>

                <div className="space-y-3 mb-8">
                  {files.map((file, index) => (
                    <Card
                      key={index}
                      className="p-5 flex items-center justify-between group hover:scale-[1.01] transition-all"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0 cursor-move" />
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-2 hover:bg-accent rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </Card>
                  ))}
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">Error</p>
                      <p className="text-sm text-destructive/90 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                {progress && (
                  <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{progress.stage}</span>
                      <span className="text-sm text-muted-foreground">
                        {progress.progress}/{progress.total}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${(progress.progress / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={handleMerge}
                  disabled={files.length < 2 || processing}
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {progress ? progress.stage : 'Merging files...'}
                    </>
                  ) : (
                    `Merge ${files.length} files`
                  )}
                </Button>
              </section>
            )}
          </>
        ) : (
          /* Success State */
          <section className="max-w-3xl mx-auto px-6 lg:px-8 pb-24">
            <Card className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Files merged successfully</h3>
              <p className="text-muted-foreground mb-10">
                Your merged PDF is ready to download
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" onClick={handleDownload}>
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setFiles([]);
                    setCompleted(false);
                    setMergedPDF(null);
                    setError(null);
                  }}
                >
                  Merge more files
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Features */}
        <section className="py-24 border-t bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Fast processing</h3>
                <p className="text-sm text-muted-foreground">
                  Merge PDFs in seconds with our optimized infrastructure
                </p>
              </div>
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Secure</h3>
                <p className="text-sm text-muted-foreground">
                  Files are encrypted and automatically deleted after processing
                </p>
              </div>
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">No limits</h3>
                <p className="text-sm text-muted-foreground">
                  Merge unlimited PDFs with no file size restrictions
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
