"use client";

import { useState } from "react";
import { WordEditor } from "./word-editor";
import { SpreadsheetEditor } from "./spreadsheet-editor";
import { PresentationEditor } from "./presentation-editor";
import { TemplateCenter } from "./template-center";
import { Button } from "@/components/ui/button";

export function OfficeWorkspace() {
  const [tab, setTab] = useState<'work' | 'editor' | 'templates'>('editor');
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; type: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant={tab === 'editor' ? 'default' : 'outline'} onClick={() => setTab('editor')}>Editor</Button>
        <Button variant={tab === 'work' ? 'default' : 'outline'} onClick={() => setTab('work')}>Workspace</Button>
        <Button variant={tab === 'templates' ? 'default' : 'outline'} onClick={() => setTab('templates')}>Templates</Button>
      </div>

      {tab === 'editor' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <WordEditor />
          <SpreadsheetEditor />
          <PresentationEditor />
        </div>
      )}

      {tab === 'work' && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-12 shadow-2xl">
          <h2 className="text-3xl font-extrabold mb-4">OfficePilot Workspace</h2>
          <p className="text-blue-100 mb-6">One shared workspace for word processing, spreadsheets, presentations, and templates. Everything integrates into LaunchStack.</p>
          <div className="flex gap-4">
            <Button className="bg-white text-blue-900 hover:bg-blue-50" onClick={() => setTab('editor')}>Open Editors</Button>
            <Button variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => setTab('templates')}>Browse Templates</Button>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <TemplateCenter onSelect={(t) => { setSelectedTemplate(t); setTab('editor'); }} />
      )}
    </div>
  );
}
