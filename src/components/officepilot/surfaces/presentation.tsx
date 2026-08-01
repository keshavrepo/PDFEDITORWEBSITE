"use client";

/**
 * OfficePilot Presentation editor surface.
 *
 * The real Presentation editor. The shell mounts this surface;
 * everything else (toolbar, status bar, properties, save lifecycle)
 * lives in the shell and is reused unchanged.
 */

import type { OfficeDocument } from "@/lib/officepilot";
import { PresentationEditor } from "@/components/officepilot/presentation/editor";

interface PresentationSurfaceProps {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

export function PresentationSurface({ document, onChange }: PresentationSurfaceProps) {
  return <PresentationEditor document={document} onChange={onChange} />;
}
