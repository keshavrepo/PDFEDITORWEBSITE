"use client";

/**
 * Reel surface — foundation entry for the future reel tool.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface ReelSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function ReelSurface({ project, onChange }: ReelSurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Reel"
      blurb="The reel foundation holds the metadata a reel always needs."
      fields={["title", "caption", "audio"]}
    />
  );
}
