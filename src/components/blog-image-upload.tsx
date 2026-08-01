"use client";

import { ChangeEvent, DragEvent, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeaturedImage } from "@/components/featured-image";
import type { BlogImagePurpose } from "@/lib/blog-images";
import { uploadBlogImage, validateBlogImageFile } from "@/lib/upload-blog-image";

interface BlogImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  purpose: BlogImagePurpose;
  disabled?: boolean;
  label: string;
}

export function BlogImageUpload({
  value,
  onChange,
  purpose,
  disabled = false,
  label,
}: BlogImageUploadProps) {
  const inputId = useId();
  const previewUrlRef = useRef<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  async function processFile(file?: File) {
    if (!file || disabled || uploading) return;
    const validationError = validateBlogImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const preview = URL.createObjectURL(file);
    previewUrlRef.current = preview;
    setLocalPreview(preview);
    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadBlogImage(file, purpose);
      onChange(uploaded.url);
      URL.revokeObjectURL(preview);
      previewUrlRef.current = null;
      setLocalPreview(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload image");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void processFile(event.dataTransfer.files[0]);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    void processFile(event.target.files?.[0]);
    event.target.value = "";
  }

  const preview = localPreview || value;
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium" htmlFor={inputId}>{label}</label>
      <label
        htmlFor={inputId}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
        className={`relative block rounded-xl border-2 border-dashed p-4 transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"} ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {preview ? (
          <FeaturedImage
            src={preview}
            alt="Featured image preview"
            className="aspect-video rounded-lg"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        ) : (
          <div className="aspect-video rounded-lg bg-muted/50 flex flex-col items-center justify-center text-center p-6">
            <ImagePlus className="h-9 w-9 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Drop an image here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-4 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-sm font-medium">Optimizing and uploading...</span>
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleChange}
          disabled={disabled || uploading}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP · maximum 8MB · automatically converted to WebP</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" asChild disabled={disabled || uploading}>
            <label htmlFor={inputId} className="cursor-pointer"><Upload className="mr-2 h-3.5 w-3.5" />{preview ? "Replace" : "Upload"}</label>
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")} disabled={disabled || uploading}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />Remove
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
