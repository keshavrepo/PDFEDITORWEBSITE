"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { defaultPresets } from "@/lib/imagepilot/export-utils";
import type { ExportPreset } from "@/lib/imagepilot/export-utils";

export function ExportPresets({ file }: { file?: File }) {
  const [selected, setSelected] = useState<ExportPreset>(defaultPresets[0]);

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-semibold">Export Presets</h3>
      <div className="grid sm:grid-cols-2 gap-2">
        {defaultPresets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setSelected(preset)}
            className={`text-left p-3 rounded-lg border transition-colors ${selected.name === preset.name ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            <div className="font-medium">{preset.name}</div>
            <div className="text-xs opacity-80">{preset.format.toUpperCase()} · Scale ×{preset.scale}</div>
          </button>
        ))}
      </div>
      {file && (
        <Button className="w-full" onClick={() => {
          const url = URL.createObjectURL(file);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = file.name.replace(/\.[^.]+$/, '') + '-' + selected.name.toLowerCase().replace(/\s+/g, '-') + '.' + selected.format;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
        }}>
          Export as {selected.name}
        </Button>
      )}
    </Card>
  );
}
