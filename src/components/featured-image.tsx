"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPreviewableBlogImageUrl } from "@/lib/blog-images";

interface FeaturedImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

function ImageWithFallback({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ImagePlaceholder />;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      quality={82}
      unoptimized={src.startsWith("blob:")}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function ImagePlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
      <ImageIcon className="h-8 w-8" aria-hidden="true" />
      <span className="text-xs font-medium">PDFPilot</span>
    </div>
  );
}

export function FeaturedImage({
  src,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
}: FeaturedImageProps) {
  const usableSource = src && isPreviewableBlogImageUrl(src) ? src : null;
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {usableSource ? (
        <ImageWithFallback
          key={usableSource}
          src={usableSource}
          alt={alt}
          sizes={sizes}
          priority={priority}
        />
      ) : (
        <ImagePlaceholder />
      )}
    </div>
  );
}
