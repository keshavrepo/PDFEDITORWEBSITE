"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { encodeIco } from "@/lib/imagepilot/ico-encoder";
import { Button } from "@/components/ui/button";

const sizes = [16, 32, 48, 64, 180, 192, 512];

export function FaviconGenerator() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const draw = useCallback((size: number) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${size * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IP', size / 2, size / 2);
    setCanvas(c);
  }, []);

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-semibold">Favicon & App Icon Generator</h3>
      <div className="flex gap-2 flex-wrap">
        {sizes.map((s) => (
          <Button key={s} variant="outline" size="sm" onClick={() => draw(s)}>
            Generate {s}px
          </Button>
        ))}
      </div>
      {canvas && (
        <div className="flex gap-3 flex-wrap items-center">
          <img src={canvas.toDataURL('image/png')} alt="Generated icon" className="w-12 h-12 rounded-lg border" />
          <Button onClick={() => {
            const link = document.createElement('a');
            link.download = `icon-${canvas?.width}x${canvas?.height}.png`;
            link.href = canvas?.toDataURL('image/png') || '';
            link.click();
          }}>Download PNG</Button>
          <Button variant="outline" onClick={() => {
            const pngBlob = new Blob([new Uint8Array(atob((canvas?.toDataURL('image/png') || '').split(',')[1] || '').split('').map(c => c.charCodeAt(0)))], { type: 'image/png' });
            const ico = encodeIco([{ size: 16, pngData: new Uint8Array(pngBlob.arrayBuffer()) }, { size: 32, pngData: new Uint8Array(pngBlob.arrayBuffer()) }, { size: 48, pngData: new Uint8Array(pngBlob.arrayBuffer()) }, { size: 64, pngData: new Uint8Array(pngBlob.arrayBuffer()) }, { size: 128, pngData: new Uint8Array(pngBlob.arrayBuffer()) }, { size: 256, pngData: new Uint8Array(pngBlob.arrayBuffer()) }]);
            const url = URL.createObjectURL(new Blob([ico], { type: 'image/x-icon' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'icon.ico';
            a.click();
            URL.revokeObjectURL(url);
          }}>Download .ico</Button>
        </div>
      )}
    </Card>
  );
}
