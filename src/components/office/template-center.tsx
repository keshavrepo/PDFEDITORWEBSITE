"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const templates = [
  { name: 'Resume', type: 'word', desc: 'Professional resume layout' },
  { name: 'Invoice', type: 'spreadsheet', desc: 'Itemized billing template' },
  { name: 'Letter', type: 'word', desc: 'Formal business letter' },
  { name: 'Meeting Notes', type: 'word', desc: 'Structured meeting notes' },
  { name: 'Presentation', type: 'presentation', desc: 'Corporate pitch deck' },
  { name: 'Budget', type: 'spreadsheet', desc: 'Monthly budget planner' },
  { name: 'Planner', type: 'spreadsheet', desc: 'Weekly planner' },
  { name: 'Checklist', type: 'word', desc: 'Task checklist' },
];

export function TemplateCenter({ onSelect }: { onSelect?: (t: typeof templates[0]) => void }) {
  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-bold text-xl">Template Center</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {templates.map((t) => (
          <button
            key={t.name}
            onClick={() => onSelect?.(t)}
            className="border rounded-lg p-4 text-left hover:bg-muted transition-colors group"
          >
            <div className="font-semibold group-hover:text-blue-700">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.desc}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{t.type}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}
