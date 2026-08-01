"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PrintLayoutStudio() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-semibold">General Print Layout Studio</h3>
      <div className="flex gap-2">
        <Button variant={orientation === 'portrait' ? 'default' : 'outline'} onClick={() => setOrientation('portrait')}>Portrait</Button>
        <Button variant={orientation === 'landscape' ? 'default' : 'outline'} onClick={() => setOrientation('landscape')}>Landscape</Button>
      </div>
      <div className={`border rounded-xl p-8 mx-auto bg-white text-black shadow-inner ${orientation === 'landscape' ? 'w-[600px] h-[420px]' : 'w-[420px] h-[580px]'}`}>
        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
          <span className="text-4xl font-bold text-gray-300">A4</span>
          <span className="text-sm text-gray-400 mt-2">{orientation} layout</span>
        </div>
      </div>
    </Card>
  );
}
