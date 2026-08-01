"use client";

/**
 * OfficePilot Spreadsheet editor surface.
 *
 * The real Spreadsheet editor. The shell mounts this surface; everything
 * else (toolbar, status bar, properties, save lifecycle) lives in the
 * shell and is reused unchanged.
 */

import type { OfficeDocument } from "@/lib/officepilot";
import { SpreadsheetEditor } from "@/components/officepilot/spreadsheet/editor";

interface SpreadsheetSurfaceProps {
  document: OfficeDocument;
  onChange: (next: OfficeDocument) => void;
}

export function SpreadsheetSurface({ document, onChange }: SpreadsheetSurfaceProps) {
  return <SpreadsheetEditor document={document} onChange={onChange} />;
}
