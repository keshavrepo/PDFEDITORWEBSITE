"use client";

/**
 * Story surface — foundation entry for the future story tool.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface StorySurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function StorySurface({ project, onChange }: StorySurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Story"
      blurb="The story foundation holds a small set of fields a vertical story always needs. The future story tool will replace this with a real editor."
      fields={["headline", "sticker_text", "call_to_action"]}
    />
  );
}
