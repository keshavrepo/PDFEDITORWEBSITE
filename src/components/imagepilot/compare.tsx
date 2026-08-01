"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ImageCompare({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [position, setPosition] = useState(50);
  const [mode, setMode] = useState<'slider' | 'side-by-side'>('slider');

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <Card className="relative overflow-hidden select-none">
      <div className="flex gap-2 px-4 pt-4">
        <Button variant={mode === 'slider' ? 'default' : 'outline'} size="sm" onClick={() => setMode('slider')}>Slider</Button>
        <Button variant={mode === 'side-by-side' ? 'default' : 'outline'} size="sm" onClick={() => setMode('side-by-side')}>Side-by-side</Button>
      </div>
      {mode === 'slider' ? (
        <div className="relative w-full h-96" onMouseMove={handleMove}>
          <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-y-0 overflow-hidden" style={{ width: `${position}%` }}>
            <img src={afterUrl} alt="After" className="absolute top-0 left-0 w-full h-full object-cover min-w-[300px]" style={{ width: `${100 / (position || 1) * 100}%`, maxWidth: 'none' }} />
          </div>
          <div className="absolute top-0 bottom-0 w-1 bg-white shadow-md cursor-ew-resize" style={{ left: `calc(${position}% - 2px)` }} />
        </div>
      ) : (
        <div className="flex w-full h-96">
          <div className="w-1/2 h-full p-2">
            <img src={beforeUrl} alt="Before" className="w-full h-full object-contain bg-black/5 rounded-lg" />
          </div>
          <div className="w-1/2 h-full p-2 border-l">
            <img src={afterUrl} alt="After" className="w-full h-full object-contain bg-black/5 rounded-lg" />
          </div>
        </div>
      )}
      <div className="flex justify-center gap-8 p-4 text-sm text-muted-foreground">
        <span>Before: {position.toFixed(0)}%</span>
        <span>After: {100 - position}%</span>
      </div>
    </Card>
  );
}
