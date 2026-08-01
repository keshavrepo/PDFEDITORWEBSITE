/**
 * OfficePilot template registry.
 *
 * The template list is product metadata: it tells the new-document menu what
 * is available, what category it belongs to, and what the starter body looks
 * like. Starter bodies are loaded lazily from a separate module so the
 * directory stays small and an editor never imports a body it does not need.
 *
 * Word categories have real starter bodies (resume, letter, meeting notes);
 * the other categories are reserved for a later batch. The registry flags
 * `hasStarter: false` so the UI can show a "Coming soon" badge.
 */

import {
  BLANK_BODY,
  buildBlankBody,
  buildBusinessLetterBody,
  buildCoverLetterBody,
  buildLetterBody,
  buildMeetingNotesBody,
  buildResumeBody,
  reservedBody,
} from "./word/starter";
import {
  buildBlankSheetBody,
  buildBudgetSheetBody,
  buildChecklistSheetBody,
  buildInvoiceSheetBody,
  buildMonthlyPlannerSheetBody,
  buildPlannerSheetBody,
} from "./spreadsheet/starter";
import {
  buildBlankDeck,
  buildPitchDeck,
  buildReportDeck,
} from "./presentation/starter";
import type {
  OfficeDocumentCategory,
  OfficeEditorKind,
  OfficeTemplate,
} from "./types";

/** Template categories in the order they appear in the new-document menu. */
export const templateCategoryOrder: OfficeDocumentCategory[] = [
  "blank",
  "resume",
  "invoice",
  "letter",
  "business-letter",
  "cover-letter",
  "meeting-notes",
  "budget",
  "planner",
  "monthly-planner",
  "checklist",
  "presentation",
  "report",
];

/** Human-readable label for a category. */
export const templateCategoryLabels: Record<OfficeDocumentCategory, string> = {
  blank: "Blank",
  resume: "Resume",
  invoice: "Invoice",
  letter: "Letter",
  "business-letter": "Business letter",
  "cover-letter": "Cover letter",
  "meeting-notes": "Meeting notes",
  budget: "Budget",
  planner: "Weekly planner",
  "monthly-planner": "Monthly planner",
  checklist: "Checklist",
  presentation: "Presentation",
  report: "Report",
};

/** Short description for each category, used as the menu section header. */
export const templateCategoryDescriptions: Record<OfficeDocumentCategory, string> = {
  blank: "Start with an empty document",
  resume: "CV and résumé structures",
  invoice: "Billable line items with totals",
  letter: "Letters, cover notes and formal correspondence",
  "business-letter": "Formal letters on company letterhead",
  "cover-letter": "Cover letters for job applications",
  "meeting-notes": "Agendas, attendees and action items",
  budget: "Income, expenses and balances",
  planner: "Weekly planners with days and hours",
  "monthly-planner": "Monthly planners with weeks and days",
  checklist: "Reusable task lists",
  presentation: "Structured slide decks",
  report: "Slide-based reports with tables and bullets",
};

/**
 * Static template descriptors. The starter bodies are added in a follow-up
 * batch, so every entry is metadata-only for now.
 */
export const templates: OfficeTemplate[] = [
  // Word
  {
    id: "word-blank",
    kind: "word",
    category: "blank",
    name: "Blank document",
    description: "An empty page with the platform's default typography.",
    hasStarter: true,
    highlights: ["Single page", "Default body font", "12pt paragraph spacing"],
  },
  {
    id: "word-resume",
    kind: "word",
    category: "resume",
    name: "Resume",
    description: "A one-page resume with summary, experience and skills sections.",
    hasStarter: true,
    highlights: ["Header block", "Experience list", "Skills matrix"],
  },
  {
    id: "word-letter",
    kind: "word",
    category: "letter",
    name: "Letter",
    description: "A formal letter with sender and recipient blocks.",
    hasStarter: true,
    highlights: ["Sender block", "Date line", "Signature area"],
  },
  {
    id: "word-meeting-notes",
    kind: "word",
    category: "meeting-notes",
    name: "Meeting notes",
    description: "Agenda, attendees, decisions and action items.",
    hasStarter: true,
    highlights: ["Agenda list", "Attendees", "Action items"],
  },
  {
    id: "word-business-letter",
    kind: "word",
    category: "business-letter",
    name: "Business letter",
    description: "A formal business letter on company letterhead.",
    hasStarter: true,
    highlights: ["Letterhead", "Recipient block", "Signature area"],
  },
  {
    id: "word-cover-letter",
    kind: "word",
    category: "cover-letter",
    name: "Cover letter",
    description: "A cover letter for a job application.",
    hasStarter: true,
    highlights: ["Header", "Role summary", "Closing"],
  },
  // Spreadsheet
  {
    id: "spreadsheet-blank",
    kind: "spreadsheet",
    category: "blank",
    name: "Blank workbook",
    description: "A single sheet, ready for your data.",
    hasStarter: true,
    highlights: ["100 rows", "26 columns", "Default cell format"],
  },
  {
    id: "spreadsheet-budget",
    kind: "spreadsheet",
    category: "budget",
    name: "Budget",
    description: "Income, expenses and a running balance.",
    hasStarter: true,
    highlights: ["Income and expense rows", "Running balance", "Totals row"],
  },
  {
    id: "spreadsheet-planner",
    kind: "spreadsheet",
    category: "planner",
    name: "Weekly planner",
    description: "Days of the week down the rows, hours across the columns.",
    hasStarter: true,
    highlights: ["Seven day rows", "Hour columns", "Notes column"],
  },
  {
    id: "spreadsheet-monthly-planner",
    kind: "spreadsheet",
    category: "monthly-planner",
    name: "Monthly planner",
    description: "Weeks across the columns, days of the week down the rows.",
    hasStarter: true,
    highlights: ["Five week columns", "Seven day rows", "Notes area"],
  },
  {
    id: "spreadsheet-checklist",
    kind: "spreadsheet",
    category: "checklist",
    name: "Checklist",
    description: "A tickable task list with status and due date columns.",
    hasStarter: true,
    highlights: ["Task column", "Status column", "Due date column"],
  },
  {
    id: "spreadsheet-invoice",
    kind: "spreadsheet",
    category: "invoice",
    name: "Invoice",
    description: "Line items, subtotals, tax and grand total.",
    hasStarter: true,
    highlights: ["Itemised lines", "Tax calculation", "Subtotal and total"],
  },
  // Presentation
  {
    id: "presentation-blank",
    kind: "presentation",
    category: "blank",
    name: "Blank deck",
    description: "A single blank slide ready to be filled in.",
    hasStarter: true,
    highlights: ["Title slide", "16:9 aspect", "Default theme"],
  },
  {
    id: "presentation-pitch",
    kind: "presentation",
    category: "presentation",
    name: "Pitch deck",
    description: "A six-slide pitch deck: problem, solution, traction and ask.",
    hasStarter: true,
    highlights: ["Six slides", "Corporate theme", "Closing ask slide"],
  },
  {
    id: "presentation-report",
    kind: "presentation",
    category: "report",
    name: "Report deck",
    description: "A report deck with bullets, a table slide and an ask.",
    hasStarter: true,
    highlights: ["Highlights", "Numbers table", "Blockers and asks"],
  },
];

/** Templates for one editor kind, in the canonical category order. */
export function templatesForKind(kind: OfficeEditorKind): OfficeTemplate[] {
  const filtered = templates.filter((template) => template.kind === kind);
  return filtered.sort(
    (a, b) =>
      templateCategoryOrder.indexOf(a.category) -
      templateCategoryOrder.indexOf(b.category)
  );
}

/** All templates in one category, across editor kinds. */
export function templatesForCategory(
  category: OfficeDocumentCategory
): OfficeTemplate[] {
  return templates.filter((template) => template.category === category);
}

export function getTemplate(id: string): OfficeTemplate | undefined {
  return templates.find((template) => template.id === id);
}

/**
 * Returns a starter body for a template.
 *
 * The "blank" category returns a real starter so the editor does not open
 * to a runtime error before the user has typed anything. For the categories
 * with real templates the body is loaded from the starter module; every
 * other category is reserved for a later batch.
 */
export function loadTemplateBody(template: OfficeTemplate): unknown {
  if (template.hasStarter) {
    if (template.id === "word-blank") return buildBlankBody();
    if (template.id === "word-resume") return buildResumeBody();
    if (template.id === "word-letter") return buildLetterBody();
    if (template.id === "word-business-letter") return buildBusinessLetterBody();
    if (template.id === "word-cover-letter") return buildCoverLetterBody();
    if (template.id === "word-meeting-notes") return buildMeetingNotesBody();
    if (template.id === "spreadsheet-blank") return buildBlankSheetBody();
    if (template.id === "spreadsheet-budget") return buildBudgetSheetBody();
    if (template.id === "spreadsheet-planner") return buildPlannerSheetBody();
    if (template.id === "spreadsheet-monthly-planner") return buildMonthlyPlannerSheetBody();
    if (template.id === "spreadsheet-checklist") return buildChecklistSheetBody();
    if (template.id === "spreadsheet-invoice") return buildInvoiceSheetBody();
    if (template.id === "presentation-blank") return buildBlankDeck();
    if (template.id === "presentation-pitch") return buildPitchDeck();
    if (template.id === "presentation-report") return buildReportDeck();
    if (template.kind === "word") return buildBlankBody();
    if (template.kind === "spreadsheet") return buildBlankSheetBody();
    if (template.kind === "presentation") return buildBlankDeck();
  }
  return reservedBody();
}

/** Default body for a brand-new document of a given kind. */
export function createBlankBody(kind: OfficeEditorKind): unknown {
  switch (kind) {
    case "word":
      return BLANK_BODY;
    case "spreadsheet":
      return buildBlankSheetBody();
    case "presentation":
      return buildBlankDeck();
    default:
      return {};
  }
}
