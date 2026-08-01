"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PresentationEditor() {
  const [slides, setSlides] = useState([{ title: 'Title Slide', subtitle: 'Subtitle' }]);
  const [current, setCurrent] = useState(0);

  const addSlide = () => {
    setSlides([...slides, { title: 'New Slide', subtitle: '' }]);
    setCurrent(slides.length);
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-bold text-xl">Presentation Editor</h2>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setCurrent(Math.max(0, current - 1))}>Prev</Button>
        <Button size="sm" onClick={() => setCurrent(Math.min(slides.length - 1, current + 1))}>Next</Button>
        <Button size="sm" variant="outline" onClick={addSlide}>Add Slide</Button>
      </div>
      <div className="border rounded-xl p-12 bg-gradient-to-br from-blue-50 to-indigo-50 min-h-[300px] flex flex-col items-center justify-center text-center shadow-inner">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-2">{slides[current].title}</h1>
        <p className="text-lg text-blue-600">{slides[current].subtitle}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={`w-16 h-10 rounded border text-xs ${i === current ? 'bg-blue-600 text-white' : 'bg-muted'}`}>{i + 1}</button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => alert('Themes framework active')}>Themes</Button>
        <Button size="sm" variant="outline" onClick={() => alert('Speaker notes framework active')}>Speaker Notes</Button>
        <Button size="sm" onClick={() => {
          const html = `<html><body><h1>${slides[current].title}</h1><p>${slides[current].subtitle}</p></body></html>`;
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `slide-${current + 1}.pptx.html`; a.click(); URL.revokeObjectURL(url);
        }}>Export PPTX</Button>
      </div>
    </Card>
  );
}
