/**
 * OfficePilot editor registry.
 *
 * One descriptor per editor kind. The workspace shell reads this to decide
 * which editor surface to mount, which tab to default to, which file
 * extension to use, and what to show in the directory.
 *
 * Mirrors the ImagePilot `workspaces.ts` shape: a small typed array, a
 * couple of lookup helpers, and a derived `focusedEditors` list for places
 * that want the directory minus the default entry.
 */

import type { OfficeEditorDefinition, OfficeEditorKind } from "./types";

export const editors: OfficeEditorDefinition[] = [
  {
    id: "word",
    kind: "word",
    slug: "word",
    name: "Word Editor",
    tagline: "Write, format and export rich documents",
    description:
      "A focused word processor for letters, resumes, meeting notes and long-form writing. Renders with the platform's typography and exports to DOCX.",
    intro:
      "Start blank or from a template, write in rich text, and export to a portable Word file when you are done.",
    extension: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    defaultCategory: "blank",
    keywords: [
      "word editor",
      "rich text",
      "docx",
      "resume",
      "letter",
      "meeting notes",
      "OfficePilot",
    ],
    highlights: ["Rich text formatting", "Templates included", "DOCX export"],
    toolCount: 4,
  },
  {
    id: "spreadsheet",
    kind: "spreadsheet",
    slug: "spreadsheet",
    name: "Spreadsheet Editor",
    tagline: "Tabular data, formulas and structured exports",
    description:
      "Work with tabular data, organise rows and columns, and export to XLSX. Templates cover budgets, planners and structured checklists.",
    intro:
      "Pick a template or start blank, then fill the cells. Export to XLSX when you are done.",
    extension: "xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    defaultCategory: "blank",
    keywords: [
      "spreadsheet",
      "xlsx",
      "budget",
      "planner",
      "checklist",
      "OfficePilot",
    ],
    highlights: ["Cell-based editing", "Number and date formats", "XLSX export"],
    toolCount: 3,
  },
  {
    id: "presentation",
    kind: "presentation",
    slug: "presentation",
    name: "Presentation Editor",
    tagline: "Slide-based layouts with structured content",
    description:
      "Build slide decks with a structured outline and export to PPTX. Templates cover the most common presentation shapes.",
    intro:
      "Outline first, then arrange slides. Export to a portable PowerPoint file when you are done.",
    extension: "pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    defaultCategory: "blank",
    keywords: [
      "presentation",
      "pptx",
      "slides",
      "deck",
      "OfficePilot",
    ],
    highlights: ["Slide-by-slide outline", "Themes included", "PPTX export"],
    toolCount: 2,
  },
];

export function getEditor(kind: OfficeEditorKind): OfficeEditorDefinition {
  return editors.find((editor) => editor.kind === kind) ?? editors[0];
}

export function getEditorBySlug(slug: string): OfficeEditorDefinition | undefined {
  return editors.find((editor) => editor.slug === slug);
}

/** Editors that are not the default word editor, used in the directory. */
export const focusedEditors = editors.filter((editor) => editor.kind !== "word");

/** Route for an editor, e.g. `/officepilot/spreadsheet`. */
export function editorHref(editor: OfficeEditorDefinition): string {
  return editor.slug ? `/officepilot/${editor.slug}` : "/officepilot";
}
