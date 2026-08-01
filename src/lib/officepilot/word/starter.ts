/**
 * OfficePilot Word starter bodies.
 *
 * Real starter content for every category that has a working template.
 * The bodies are produced by the same `WordBody` shape the editor and
 * the rest of the engine read, so a template opens straight into the
 * editor with no conversion step.
 *
 * Categories whose template is still on the roadmap call `reservedBody`
 * and surface a \"Coming soon\" badge in the UI; the rest use
 * `build<Name>Body` so the editor shows a real, editable document.
 */

import type {
  WordBlock,
  WordBody,
  WordDocumentSettings,
  WordRun,
} from "./schema";
import { DEFAULT_SETTINGS, DEFAULT_WORD_BODY } from "./schema";
import { makeBlockId } from "./blocks";

/** A plain text run. */
function run(text: string, marks: WordRun["marks"] = []): WordRun {
  return { text, marks };
}

/** A heading block. */
function heading(level: 1 | 2 | 3, text: string, alignment: "left" | "center" = "left"): WordBlock {
  return {
    id: makeBlockId(`h${level}`),
    type: "heading",
    level,
    runs: [run(text)],
    alignment,
  };
}

/** A paragraph block. */
function paragraph(
  text: string,
  options: { alignment?: "left" | "center" | "right" | "justify"; indent?: number; runs?: WordRun[] } = {}
): WordBlock {
  return {
    id: makeBlockId("p"),
    type: "paragraph",
    runs: options.runs ?? [run(text)],
    alignment: options.alignment ?? "left",
    indent: options.indent ?? 0,
  };
}

/** A bullet list block. */
function bulletList(items: string[]): WordBlock {
  return {
    id: makeBlockId("list"),
    type: "list",
    kind: "unordered",
    items: items.map((item) => ({ id: makeBlockId("item"), runs: [run(item)] })),
  };
}

/** A numbered list block. */
function numberedList(items: string[]): WordBlock {
  return {
    id: makeBlockId("list"),
    type: "list",
    kind: "ordered",
    items: items.map((item) => ({ id: makeBlockId("item"), runs: [run(item)] })),
  };
}

/** A checklist block. */
function checklist(items: string[]): WordBlock {
  return {
    id: makeBlockId("list"),
    type: "list",
    kind: "checklist",
    items: items.map((item) => ({ id: makeBlockId("item"), runs: [run(item)] })),
  };
}

/** A block quote. */
function quote(text: string): WordBlock {
  return { id: makeBlockId("quote"), type: "quote", runs: [run(text)], alignment: "left" };
}

/** A page break. */
function pageBreak(): WordBlock {
  return { id: makeBlockId("pb"), type: "page-break" };
}

/** A table with a header row. */
function table(rows: string[][]): WordBlock {
  return {
    id: makeBlockId("table"),
    type: "table",
    rows: rows.map((row, rowIndex) => ({
      id: `row-${rowIndex}-${Math.random().toString(36).slice(2, 6)}`,
      cells: row.map((cell) => ({
        id: makeBlockId("cell"),
        runs: [run(cell, rowIndex === 0 ? ["bold"] : [])],
      })),
    })),
  };
}

/** Builds a fresh word body from a list of blocks. */
function body(blocks: WordBlock[], settings: Partial<WordDocumentSettings> = {}): WordBody {
  return {
    ...DEFAULT_WORD_BODY,
    blocks,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

/** Empty body for the blank template. */
export function buildBlankBody(): WordBody {
  return body([]);
}

/** Reserved body used while a real template is pending implementation. */
export function reservedBody(): WordBody {
  return {
    ...DEFAULT_WORD_BODY,
    blocks: [
      {
        id: makeBlockId("placeholder"),
        type: "heading",
        level: 2,
        runs: [run("Template coming soon")],
        alignment: "left",
      },
      paragraph("This template is on the roadmap and will land in a follow-up batch."),
    ],
  };
}

/** A one-page resume with summary, experience, education and skills. */
export function buildResumeBody(): WordBody {
  return body([
    heading(1, "Alex Carter", "center"),
    paragraph("Senior product designer · alex@example.com · Delhi, India", {
      alignment: "center",
    }),
    paragraph(""),
    heading(2, "Summary"),
    paragraph(
      "Product designer with eight years of experience leading design systems and end-to-end product work for B2B SaaS. Comfortable translating qualitative research into shipping decisions and partnering with engineering on every stage of the build."
    ),
    heading(2, "Experience"),
    bulletList([
      "Lead designer, Linear (2022–present): owned the navigation and command-palette work, partnering with engineering on every stage of the build.",
      "Senior designer, Notion (2019–2022): drove the block-level architecture work that shaped the templates feature.",
      "Designer, Figma (2017–2019): contributed to the first version of the multi-player editing surface.",
    ]),
    heading(2, "Skills"),
    paragraph(
      "Design systems, Figma, prototyping, motion, qualitative research, HTML/CSS basics, technical writing."
    ),
    heading(2, "Education"),
    paragraph("B.Des, Industrial Design — National Institute of Design, 2017."),
    pageBreak(),
    heading(2, "Selected projects"),
    table([
      ["Year", "Project", "Role"],
      ["2024", "Linear iOS", "Lead designer"],
      ["2023", "Templates 2.0", "Senior designer"],
      ["2021", "Block engine", "Designer"],
    ]),
  ]);
}

/** A formal letter with sender, recipient, date, subject, body and sign-off. */
export function buildLetterBody(): WordBody {
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return body([
    paragraph(today, { alignment: "right" }),
    paragraph(""),
    paragraph("Recipient name", { runs: [run("Recipient name", ["bold"])] }),
    paragraph("Recipient role"),
    paragraph("Recipient organisation"),
    paragraph("Recipient address line 1"),
    paragraph("Recipient address line 2"),
    paragraph(""),
    paragraph("Subject: Project proposal for the new analytics workspace", {
      runs: [
        run("Subject: ", ["bold"]),
        run("Project proposal for the new analytics workspace"),
      ],
    }),
    paragraph(""),
    paragraph("Dear Recipient,"),
    paragraph(""),
    paragraph(
      "I am writing to follow up on our conversation at last week's product council. I would like to share a short proposal covering the goals, scope, timeline and budget for the analytics workspace work we discussed."
    ),
    paragraph(
      "The attached document is a first draft. I would welcome your review and the team's feedback before I take it to the wider engineering group next week."
    ),
    paragraph(""),
    paragraph("Kind regards,"),
    paragraph("Your name"),
    paragraph("Your role · Your team"),
  ]);
}

/** A formal business letter on company letterhead. */
export function buildBusinessLetterBody(): WordBody {
  return body([
    paragraph("Your Company", { alignment: "right", runs: [run("Your Company", ["bold"])] }),
    paragraph("123 Market Street, Suite 400, San Francisco, CA 94103", { alignment: "right" }),
    paragraph("hello@yourcompany.com · +1 (415) 555-0123", { alignment: "right" }),
    paragraph(""),
    paragraph(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })),
    paragraph(""),
    paragraph("Mr. Daniel Cohen", { runs: [run("Mr. Daniel Cohen", ["bold"])] }),
    paragraph("Director of Operations"),
    paragraph("Northwind Industries"),
    paragraph("500 Howard Street"),
    paragraph("San Francisco, CA 94105"),
    paragraph(""),
    paragraph("Re: Renewal of the annual service agreement", { runs: [run("Re: ", ["bold"]), run("Renewal of the annual service agreement")] }),
    paragraph(""),
    paragraph("Dear Mr. Cohen,"),
    paragraph(""),
    paragraph(
      "I hope you are well. Our records show that the annual service agreement between Your Company and Northwind Industries is set to expire on 31 March. I am writing to confirm the renewal terms and to ask whether you would like to schedule a brief call to review the arrangement."
    ),
    paragraph(
      "The renewal keeps the same scope of services and pricing tier as last year. If you would like to expand coverage or add new services, we would be happy to put together an updated proposal."
    ),
    paragraph(""),
    paragraph("Please let me know a time that works for a short call, or feel free to respond by email."),
    paragraph(""),
    paragraph("Sincerely,"),
    paragraph("Alex Morgan", { runs: [run("Alex Morgan", ["bold"])] }),
    paragraph("Account Director, Your Company"),
  ]);
}

/** A cover letter for a job application. */
export function buildCoverLetterBody(): WordBody {
  return body([
    paragraph("Your name", { runs: [run("Your name", ["bold"])] }),
    paragraph("your.email@example.com · +1 (555) 123-4567"),
    paragraph("your-city, your-state"),
    paragraph(""),
    paragraph(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })),
    paragraph(""),
    paragraph("Hiring Manager", { runs: [run("Hiring Manager", ["bold"])] }),
    paragraph("Acme Software, Inc."),
    paragraph("1 Acme Way"),
    paragraph("Anytown, USA"),
    paragraph(""),
    paragraph("Re: Senior Frontend Engineer application", { runs: [run("Re: ", ["bold"]), run("Senior Frontend Engineer application")] }),
    paragraph(""),
    paragraph("Dear Hiring Manager,"),
    paragraph(""),
    paragraph(
      "I am writing to apply for the Senior Frontend Engineer role advertised on your careers page. I have spent the last six years building browser-first tools for content teams, including rich text editors, spreadsheets and presentation builders, and I would love the opportunity to bring that experience to your team."
    ),
    paragraph(
      "Most recently, I shipped a production-quality rich text editor with real DOCX round-trip at my current role. The work involved careful attention to block-based content models, undo/redo history, and the small details of cross-platform typography. I would be happy to walk you through the technical decisions in more depth during an interview."
    ),
    paragraph(
      "Thank you for considering my application. I have attached my résumé and portfolio, and I look forward to hearing from you."
    ),
    paragraph(""),
    paragraph("Warm regards,"),
    paragraph("Your name"),
  ]);
}

/** A meeting note template with agenda, attendees, notes and action items. */
export function buildMeetingNotesBody(): WordBody {
  return body([
    heading(1, "Meeting notes"),
    paragraph(""),
    paragraph("Date: ", { runs: [run("Date: ", ["bold"]), run(new Date().toLocaleDateString())] }),
    paragraph("Location: ", {
      runs: [run("Location: ", ["bold"]), run("Conference room A · video link in the description")],
    }),
    paragraph("Facilitator: ", { runs: [run("Facilitator: ", ["bold"]), run("Name")] }),
    paragraph(""),
    heading(2, "Attendees"),
    bulletList(["Alex Carter", "Jordan Patel", "Sasha Lopez", "Sam Chen"]),
    heading(2, "Agenda"),
    numberedList([
      "Review of last week's outcomes",
      "Demo of the analytics workspace prototype",
      "Discussion of the open questions in the proposal",
      "Action items and owners",
    ]),
    heading(2, "Notes"),
    paragraph(
      "The team walked through the prototype. The main feedback was around the layout of the side panel and the empty state for new workspaces."
    ),
    paragraph(
      "We agreed to defer the offline mode work until after the v1 launch and to revisit the empty state in the next design review."
    ),
    heading(2, "Action items"),
    checklist([
      "Send the prototype link to the wider team — Alex",
      "Draft the v1 scope document — Jordan",
      "Schedule the next design review — Sasha",
    ]),
  ]);
}

/** Plain blank body used by the editor's "New document" entry point. */
export const BLANK_BODY: WordBody = DEFAULT_WORD_BODY;
