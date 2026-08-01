/**
 * OfficePilot Presentation starter decks.
 *
 * Real starter decks for the templates shipped by OfficePilot. The
 * foundation already routes these through the templates registry; the
 * real bodies let the user open a pitch deck and see a populated
 * presentation rather than a single blank slide.
 */

import {
  type PresentationBody,
  type PresentationSlide,
  type PresentationTheme,
} from "./schema";

/** Generates a fresh slide id. */
function makeId(): string {
  return `slide-${Math.random().toString(36).slice(2, 8)}`;
}

/** Builds a slide with a title and a body of runs. */
function buildSlide(
  title: string,
  subtitle: string,
  body: Array<{ text: string; bold?: boolean; italic?: boolean }>,
  options: { notes?: string; layout?: string; transition?: "fade" | "slide" | "zoom" | "push" | "none" } = {}
): PresentationSlide {
  return {
    id: makeId(),
    title,
    subtitle,
    blocks: [{ id: makeId(), type: "text", runs: body.map((b) => ({ text: b.text, bold: b.bold, italic: b.italic })) }],
    transition: options.transition ?? "fade",
    notes: options.notes ?? "",
    layout: options.layout ?? "content",
  };
}

/** Builds a bullet slide. */
function buildBulletSlide(
  title: string,
  subtitle: string,
  items: string[][],
  options: { notes?: string } = {}
): PresentationSlide {
  return {
    id: makeId(),
    title,
    subtitle,
    blocks: [{ id: makeId(), type: "bullets", items: items.map((item) => item.map((text) => ({ text }))) }],
    transition: "fade",
    notes: options.notes ?? "",
    layout: "content",
  };
}

/** A blank deck with a single placeholder slide. */
export function buildBlankDeck(): PresentationBody {
  return {
    format: "presentation",
    slides: [
      {
        id: makeId(),
        title: "Untitled deck",
        subtitle: "",
        blocks: [{ id: makeId(), type: "text", runs: [{ text: "Click to add content" }] }],
        transition: "fade",
        notes: "",
        layout: "title",
      },
    ],
    settings: { theme: "minimal", fontFamily: "Inter", fontColor: "#0a0a0a", background: { kind: "color", color: "#ffffff" }, aspect: "16:9" },
  };
}

/** A six-slide pitch deck. */
export function buildPitchDeck(theme: PresentationTheme = "corporate"): PresentationBody {
  return {
    format: "presentation",
    slides: [
      buildSlide(
        "LaunchStack",
        "Building blocks for the AI office",
        [{ text: "A platform for documents, spreadsheets and presentations" }],
        { layout: "title", transition: "fade", notes: "Open the deck by introducing LaunchStack and the three pillars." }
      ),
      buildBulletSlide(
        "The problem",
        "Office tools are fragmented",
        [
          ["Documents, data and decks live in different apps"],
          ["Exports lose formatting on the way out"],
          ["Cloud-only editors lock work behind accounts"],
        ],
        { notes: "Set up the three problems we solve." }
      ),
      buildBulletSlide(
        "Our solution",
        "One workspace, three editors",
        [
          ["A real Word editor with DOCX round-trip"],
          ["A real spreadsheet editor with XLSX round-trip"],
          ["A real presentation editor with PPTX round-trip"],
        ],
        { notes: "Emphasise that the three editors share one workspace." }
      ),
      buildSlide(
        "Why now",
        "",
        [
          { text: "Hybrid work is permanent", bold: true },
          { text: "AI tools multiply the cost of bad inputs" },
          { text: "Browser-native is the new default" },
        ]
      ),
      buildBulletSlide(
        "Traction",
        "Numbers from the last 90 days",
        [
          ["220 conversion tests pass on every release"],
          ["Twelve OfficePilot templates ready out of the box"],
          ["Browser-first: nothing leaves your machine unless you export it"],
        ]
      ),
      buildSlide(
        "Thank you",
        "demo@launchstack.com",
        [{ text: "Questions?" }, { text: "demo@launchstack.com" }],
        { layout: "title", notes: "Pause for questions. Hand out the demo link." }
      ),
    ],
    settings: { theme, fontFamily: "Inter", fontColor: "#f1f5f9", background: { kind: "color", color: "#0f172a" }, aspect: "16:9" },
  };
}

/** A simple report deck with a table slide. */
export function buildReportDeck(): PresentationBody {
  return {
    format: "presentation",
    slides: [
      buildSlide(
        "Q3 Report",
        "Highlights, blockers and asks",
        [{ text: "Prepared by the OfficePilot team" }],
        { layout: "title", notes: "Open with the three sections." }
      ),
      buildBulletSlide(
        "Highlights",
        "",
        [
          ["Spreadsheet editor ships with XLSX round-trip"],
          ["Word editor exports real DOCX files"],
          ["Template registry now spans twelve starters"],
        ]
      ),
      {
        id: makeId(),
        title: "Numbers",
        subtitle: "",
        blocks: [
          {
            id: `block-${Math.random().toString(36).slice(2, 8)}`,
            type: "table",
            x: 5,
            y: 20,
            width: 90,
            header: true,
            headerFill: "#0a0a0a",
            rows: [
              ["Metric", "Last quarter", "This quarter"],
              ["Documents created", "1,204", "1,887"],
              ["Exports", "8,431", "12,219"],
              ["Templates opened", "342", "631"],
            ],
          },
        ],
        transition: "fade",
        notes: "Walk through each row. Highlight the exports growth.",
        layout: "content",
      },
      buildBulletSlide(
        "Blockers",
        "What is slowing us down",
        [
          ["Finalising the search index for Office documents"],
          ["Real-time collaboration is intentionally out of scope"],
          ["Awaiting design sign-off on the template centre"],
        ]
      ),
      buildSlide(
        "Asks",
        "",
        [
          { text: "Approve the v1 launch checklist" },
          { text: "Sign off on the search index plan" },
          { text: "Confirm the marketing site cut-over date" },
        ]
      ),
    ],
    settings: { theme: "minimal", fontFamily: "Inter", fontColor: "#0a0a0a", background: { kind: "color", color: "#ffffff" }, aspect: "16:9" },
  };
}
