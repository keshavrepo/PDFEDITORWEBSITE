"use client";

/**
 * OfficePilot Word editor surface.
 *
 * The real Word editor. The shell mounts this surface; everything else
 * (toolbar, status bar, properties, save lifecycle) lives in the shell
 * and is reused unchanged.
 */

import type { OfficeDocument } from "@/lib/officepilot";
import { WordEditor } from "@/components/officepilot/word/editor";

interface WordSurfaceProps {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

export function WordSurface({ document, onChange }: WordSurfaceProps) {
  return <WordEditor document={document} onChange={onChange} />;
}
