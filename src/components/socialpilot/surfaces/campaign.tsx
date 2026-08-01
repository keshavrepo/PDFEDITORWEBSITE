"use client";

/**
 * Campaign surface — foundation entry for the future campaign tool.
 */

import type { SocialProject } from "@/lib/socialpilot";
import { PlaceholderSurface } from "./placeholder";

interface CampaignSurfaceProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

export function CampaignSurface({ project, onChange }: CampaignSurfaceProps) {
  return (
    <PlaceholderSurface
      project={project}
      onChange={onChange}
      label="Campaign"
      blurb="The campaign foundation lists the assets a multi-asset campaign contains."
      fields={["name", "start_date", "end_date", "assets"]}
    />
  );
}
