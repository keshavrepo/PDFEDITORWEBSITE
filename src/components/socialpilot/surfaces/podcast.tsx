"use client";

/**
 * Podcast surface — foundation entry for the future podcast tool.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface PodcastSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function PodcastSurface({ project, onChange }: PodcastSurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Podcast"
      blurb="The podcast foundation holds the show notes an episode always needs."
      fields={["title", "episode_number", "show_notes", "guest"]}
    />
  );
}
