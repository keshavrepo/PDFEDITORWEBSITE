"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { readExif } from "@/lib/imagepilot/exif-utils";
import type { ExifData } from "@/lib/imagepilot/exif-utils";

export function ExifViewer({ file }: { file?: File }) {
  const [data, setData] = useState<ExifData | null>(null);

  useEffect(() => {
    if (!file) return;
    readExif(file).then((d) => setData(d));
  }, [file]);

  if (!file) return <Card className="p-6 text-muted-foreground text-sm">Select an image to view EXIF data.</Card>;

  return (
    <Card className="p-6 space-y-3">
      <h3 className="font-semibold">Image Information</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-muted-foreground">Name</div><div>{file.name}</div>
        <div className="text-muted-foreground">Size</div><div>{file.size} bytes</div>
        <div className="text-muted-foreground">Type</div><div>{file.type || 'unknown'}</div>
        <div className="text-muted-foreground">Modified</div><div>{new Date(file.lastModified).toLocaleString()}</div>
        {data?.date && <><div className="text-muted-foreground">Date</div><div>{data.date}</div></>}
        {data?.width && <><div className="text-muted-foreground">Width</div><div>{data.width}px</div></>}
        {data?.height && <><div className="text-muted-foreground">Height</div><div>{data.height}px</div></>}
      </div>
    </Card>
  );
}
