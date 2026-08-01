"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ImageCompare({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [position, setPosition] = useState(50);

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <Card className="relative overflow-hidden select-none">
      <div className="relative w-full h-96" onMouseMove={handleMove}>
        <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-y-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img src={afterUrl} alt="After" className="absolute top-0 left-0 w-full h-full object-cover min-w-[300px]" style={{ width: `${100 / (position || 1) * 100}%`, maxWidth: 'none' }} />
        </div>
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-md cursor-ew-resize"
          style={{ left: `calc(${position}% - 2px)` }}
        />
      </div>
      <div className="flex justify-center gap-8 p-4 text-sm text-muted-foreground">
        <span>Before: {position.toFixed(0)}%</span>
        <span>After: {100 - position}%</span>
      </div>
    </Card>
  );
}
