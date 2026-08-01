"use client";

/**
 * Short surface — foundation entry for the future short-video tool.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface ShortSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function ShortSurface({ project, onChange }: ShortSurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Short"
      blurb="The short foundation holds the metadata a short-form video always needs."
      fields={["title", "hook", "description"]}
    />
  );
}
