"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload,
  Download,
  Loader2,
} from "lucide-react";

export default function CompressPDFPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState<"low" | "medium" | "high">("medium");

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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleCompress = async () => {
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setProcessing(false);
    setCompleted(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getCompressedSize = (originalSize: number) => {
    const ratios = { low: 0.85, medium: 0.6, high: 0.4 };
    return originalSize * ratios[compressionLevel];
  };

  return (
    <>
      <Navbar />
      
      <main>
        {/* Header */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Compress PDF
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Reduce file size while maintaining quality
            </p>
          </div>
        </section>

        {!completed ? (
          <>
            {/* Upload Area */}
            <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-16 transition-colors ${
                  isDragging
                    ? "border-foreground bg-accent"
                    : "border-input"
                }`}
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent mb-4">
                    <Upload className="w-5 h-5" />
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2">
                    {isDragging ? "Drop file here" : "Upload PDF file"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Drag and drop or click to browse
                  </p>
                  
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button size="lg" asChild>
                      <span className="cursor-pointer">
                        Choose file
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </section>

            {/* Compression Options */}
            {file && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <Card className="p-6 mb-6">
                  <div className="mb-6">
                    <p className="font-medium mb-1">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <label className="text-sm font-medium">Compression level</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setCompressionLevel("low")}
                        className={`p-4 border rounded-lg text-left transition-colors ${
                          compressionLevel === "low"
                            ? "bg-foreground text-background border-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="font-medium mb-1">Low</div>
                        <div className="text-sm opacity-70">~15% smaller</div>
                      </button>

                      <button
                        onClick={() => setCompressionLevel("medium")}
                        className={`p-4 border rounded-lg text-left transition-colors ${
                          compressionLevel === "medium"
                            ? "bg-foreground text-background border-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="font-medium mb-1">Medium</div>
                        <div className="text-sm opacity-70">~40% smaller</div>
                      </button>

                      <button
                        onClick={() => setCompressionLevel("high")}
                        className={`p-4 border rounded-lg text-left transition-colors ${
                          compressionLevel === "high"
                            ? "bg-foreground text-background border-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="font-medium mb-1">High</div>
                        <div className="text-sm opacity-70">~60% smaller</div>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-accent rounded-lg mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Estimated size</p>
                      <p className="font-semibold">
                        {formatFileSize(getCompressedSize(file.size))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">You save</p>
                      <p className="font-semibold">
                        {formatFileSize(file.size - getCompressedSize(file.size))}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleCompress}
                    disabled={processing}
                    className="w-full"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Compressing...
                      </>
                    ) : (
                      "Compress PDF"
                    )}
                  </Button>
                </Card>
              </section>
            )}
          </>
        ) : (
          /* Success State */
          <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
            <Card className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent mb-6">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold mb-2">File compressed successfully</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Reduced by {Math.round((1 - (compressionLevel === "low" ? 0.85 : compressionLevel === "medium" ? 0.6 : 0.4)) * 100)}%
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                {file && formatFileSize(getCompressedSize(file.size))}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setCompleted(false);
                  }}
                >
                  Compress another file
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Info */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h3 className="font-semibold mb-2">Quality preserved</h3>
              <p className="text-sm text-muted-foreground">
                Advanced compression maintains document quality
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Fast processing</h3>
              <p className="text-sm text-muted-foreground">
                Compress files in seconds with our optimized infrastructure
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Secure</h3>
              <p className="text-sm text-muted-foreground">
                Files are encrypted and deleted after processing
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
