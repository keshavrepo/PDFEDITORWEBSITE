"use client";

/**
 * Video surface — foundation entry for the future video editor.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface VideoSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function VideoSurface({ project, onChange }: VideoSurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Video"
      blurb="The video foundation holds the metadata a long-form video always needs."
      fields={["title", "duration", "description"]}
    />
  );
}
