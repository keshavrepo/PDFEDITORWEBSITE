"use client";

/**
 * Thread surface — foundation entry for the future thread tool.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface ThreadSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function ThreadSurface({ project, onChange }: ThreadSurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Thread"
      blurb="The thread foundation holds the ordered list of posts a thread will contain."
      fields={["title", "post_count", "first_post"]}
    />
  );
}
