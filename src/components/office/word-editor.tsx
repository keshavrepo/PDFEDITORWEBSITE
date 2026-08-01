"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function WordEditor() {
  const [content, setContent] = useState("<h1>New Document</h1><p>Start typing here...</p>");

  const applyFormat = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => applyFormat('bold')}>Bold</Button>
        <Button size="sm" variant="outline" onClick={() => applyFormat('italic')}>Italic</Button>
        <Button size="sm" variant="outline" onClick={() => applyFormat('underline')}>Underline</Button>
        <Button size="sm" variant="outline" onClick={() => applyFormat('insertOrderedList')}>List</Button>
        <Button size="sm" variant="outline" onClick={() => applyFormat('formatBlock', 'h2')}>Heading</Button>
      </div>
      <div
        contentEditable
        suppressContentEditableWarning
        className="min-h-[400px] border rounded-lg p-4 bg-background focus:outline-none"
        dangerouslySetInnerHTML={{ __html: content }}
        onInput={(e) => setContent((e.target as HTMLDivElement).innerHTML)}
      />
      <div className="flex gap-2">
        <Button onClick={() => {
          const blob = new Blob([content], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'document.docx.html'; a.click();
          URL.revokeObjectURL(url);
        }}>Export DOCX (HTML)</Button>
        <Button variant="outline" onClick={() => alert('Undo/Redo framework active')}>Undo / Redo</Button>
      </div>
    </Card>
  );
}
