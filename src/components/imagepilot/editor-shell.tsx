"use client";

import { useState, ChangeEvent } from "react";
import { ImageCompare } from "./compare";
import { ColorPicker } from "./color-picker";
import { ExportPresets } from "./export-presets";
import { ExifViewer } from "./exif-viewer";
import { FaviconGenerator } from "./favicon-generator";
import { PrintLayoutStudio } from "./print-layout";
import { CollageMaker } from "./collage-maker";
import { Card } from "@/components/ui/card";

export function ImagePilotEditor() {
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setCurrentFile(f);
    if (f) {
      setBeforeFile(f);
    }
  };

  return (
    <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">ImagePilot</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Professional image editing in your browser. Private, responsive, and complete.</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 lg:px-8 pb-24 space-y-12">
        <Card className="p-6">
          <input type="file" accept="image/*" onChange={handleFile} className="text-sm" />
          {currentFile && <p className="text-xs text-muted-foreground mt-2">{currentFile.name}</p>}
        </Card>

        <div className="grid lg:grid-cols-2 gap-8">
          <ImageCompare beforeUrl={beforeFile ? URL.createObjectURL(beforeFile) : ""} afterUrl={afterFile ? URL.createObjectURL(afterFile) : ""} />
          <ColorPicker />
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <ExportPresets file={currentFile || undefined} />
          <ExifViewer file={currentFile || undefined} />
          <FaviconGenerator />
        </div>
        <PrintLayoutStudio />
        <CollageMaker images={currentFile ? [URL.createObjectURL(currentFile)] : undefined} />
      </section>
    </main>
  );
}
