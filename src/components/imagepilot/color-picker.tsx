"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generatePalette } from "@/lib/imagepilot/color-utils";

export function ColorPicker({ onSelect }: { onSelect?: (hex: string) => void }) {
  const [hex, setHex] = useState("#3b82f6");
  const [palette, setPalette] = useState<string[]>([]);

  const handleGenerate = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 100, 100);
    const imageData = ctx.getImageData(0, 0, 100, 100);
    setPalette(generatePalette(imageData, 5));
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="w-12 h-12 rounded-lg border p-0 overflow-hidden cursor-pointer"
        />
        <span className="font-mono text-sm">{hex}</span>
      </div>
      <Button onClick={handleGenerate}>Generate Palette</Button>
      {palette.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {palette.map((c, i) => (
            <button
              key={i}
              className="w-10 h-10 rounded-full border shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              onClick={() => { setHex(c); onSelect?.(c); }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
