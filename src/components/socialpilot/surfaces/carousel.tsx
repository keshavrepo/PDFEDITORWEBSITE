"use client";

/**
 * Carousel surface — foundation entry for the future carousel tool.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface CarouselSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function CarouselSurface({ project, onChange }: CarouselSurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Carousel"
      blurb="The carousel foundation lists the slides a carousel will contain. The future tool will replace this with a real editor."
      fields={["title", "slide_count", "caption"]}
    />
  );
}
