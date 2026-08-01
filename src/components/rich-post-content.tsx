"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface RichPostContentProps {
  html: string;
  className?: string;
}

export function RichPostContent({ html, className }: RichPostContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const images = Array.from(containerRef.current?.querySelectorAll("img") || []);
    const cleanups = images.map((image) => {
      const handleError = () => {
        const placeholder = document.createElement("div");
        placeholder.className =
          "my-8 aspect-video w-full rounded-xl bg-muted text-muted-foreground flex items-center justify-center text-sm";
        placeholder.textContent = "Article image unavailable";
        placeholder.setAttribute("role", "img");
        placeholder.setAttribute("aria-label", image.alt || "Article image unavailable");
        image.replaceWith(placeholder);
      };
      image.addEventListener("error", handleError, { once: true });
      if (image.complete && image.naturalWidth === 0) handleError();
      return () => image.removeEventListener("error", handleError);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 text-base leading-8 text-foreground/90",
        "[&_p]:mb-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4",
        "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5",
        "[&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        "[&_a]:underline [&_a]:underline-offset-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4",
        "[&_img]:my-8 [&_img]:aspect-video [&_img]:w-full [&_img]:rounded-xl [&_img]:object-cover",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
