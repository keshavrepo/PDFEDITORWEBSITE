"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createCollageGrid } from "@/lib/imagepilot/collage-engine";

export function CollageMaker({ images }: { images?: string[] }) {
  const [layout, setLayout] = useState({ rows: 2, cols: 2, gap: 8, radius: 8, background: '#ffffff' });
  const imgs = images || Array(4).fill('https://placehold.co/300x300/3b82f6/ffffff?text=Image');

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-semibold">Collage Maker</h3>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setLayout({ ...layout, rows: 2, cols: 2 })}>2×2</Button>
        <Button variant="outline" size="sm" onClick={() => setLayout({ ...layout, rows: 2, cols: 3 })}>2×3</Button>
        <Button variant="outline" size="sm" onClick={() => setLayout({ ...layout, rows: 3, cols: 3 })}>3×3</Button>
      </div>
      <div className="overflow-auto">
        <div dangerouslySetInnerHTML={{ __html: createCollageGrid(layout, imgs) }} />
      </div>
    </Card>
  );
}
