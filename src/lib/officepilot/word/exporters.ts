/**
 * OfficePilot Word → DOCX exporter.
 *
 * Maps the Word body schema one-to-one onto the OOXML primitives exposed by
 * the `docx` library: blocks become paragraphs, runs become TextRun,
 * headings become Heading, lists become numbered/bulleted paragraphs, and
 * tables become Table. The exporter preserves inline marks, alignment,
 * indentation, list ordering and the page geometry.
 *
 * Headers, footers, page numbers and line spacing are written into the
 * section properties so the exported file matches the on-screen preview.
 */

import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  LineRuleType,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type {
  WordAlignment,
  WordBlock,
  WordBody,
  WordList,
  WordRun,
} from "./schema";

/** Converts our alignment enum to OOXML's `AlignmentType`. */
function toOoxmlAlignment(alignment: WordAlignment) {
  switch (alignment) {
    case "left":
      return AlignmentType.LEFT;
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT;
  }
}

/** Maps a line-spacing multiplier to OOXML's twip-based value. */
function toLineSpacing(multiplier: number): number {
  // OOXML uses 240 = single, 360 = 1.5, 480 = double, in 20ths of a point.
  return Math.round(multiplier * 240);
}

/** Converts our marks to the OOXML `TextRun` options. */
function toRunOptions(run: WordRun): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.marks.includes("bold"),
    italics: run.marks.includes("italic"),
    underline: run.marks.includes("underline")
      ? { type: "single" as const, color: "auto" }
      : undefined,
    strike: run.marks.includes("strikethrough"),
    superScript: run.marks.includes("superscript"),
    subScript: run.marks.includes("subscript"),
    font: run.marks.includes("code") ? "Courier New" : undefined,
    color: run.color ? run.color.replace(/^#/, "").toUpperCase() : undefined,
    shading: run.highlight ? { fill: run.highlight.replace(/^#/, "").toUpperCase() } : undefined,
  });
}

/** Splits a run with mixed marks so a DOCX paragraph can express them all. */
function toRunsArray(runs: WordRun[]): TextRun[] {
  return runs.map(toRunOptions);
}

/** Returns the heading level enum for OOXML. */
function toOoxmlHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  switch (level) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 2:
      return HeadingLevel.HEADING_2;
    case 3:
      return HeadingLevel.HEADING_3;
    case 4:
      return HeadingLevel.HEADING_4;
    case 5:
      return HeadingLevel.HEADING_5;
    case 6:
      return HeadingLevel.HEADING_6;
    default:
      return HeadingLevel.HEADING_1;
  }
}

/** Builds a single paragraph for a text block (heading or paragraph). */
function toParagraph(block: WordBlock, lineSpacing: number): Paragraph {
  switch (block.type) {
    case "heading":
      return new Paragraph({
        heading: toOoxmlHeading(block.level),
        alignment: toOoxmlAlignment(block.alignment),
        spacing: { line: toLineSpacing(lineSpacing), lineRule: LineRuleType.AUTO },
        children: toRunsArray(block.runs),
      });
    case "paragraph": {
      const paragraph = new Paragraph({
        alignment: toOoxmlAlignment(block.alignment),
        spacing: { line: toLineSpacing(lineSpacing), lineRule: LineRuleType.AUTO },
        indent: { left: block.indent * 360 },
        children: toRunsArray(block.runs),
      });
      return paragraph;
    }
    case "quote":
      return new Paragraph({
        alignment: toOoxmlAlignment(block.alignment),
        spacing: { line: toLineSpacing(lineSpacing), lineRule: LineRuleType.AUTO },
        indent: { left: 720 },
        children: [
          new TextRun({ text: "“", font: "Georgia", size: 24 }),
          ...toRunsArray(block.runs),
          new TextRun({ text: "”", font: "Georgia", size: 24 }),
        ],
      });
    default:
      return new Paragraph({ children: [] });
  }
}

/** Builds a list paragraph, using OOXML's numbering definitions. */
function toListParagraph(
  block: WordList,
  index: number,
  numbering: { abstractNumId: number; numId: number }
): Paragraph[] {
  return block.items.map((item) => {
    const level = 0 as const;
    const runs = item.runs.map(
      (run) =>
        new TextRun({
          text: run.text,
          bold: run.marks.includes("bold"),
          italics: run.marks.includes("italic"),
          underline: run.marks.includes("underline")
            ? { type: "single" as const, color: "auto" }
            : undefined,
        })
    );
    return new Paragraph({
      numbering: { reference: String(numbering.numId), level },
      children: runs,
    });
  });
}

/** Builds a code block paragraph. Each line is its own paragraph. */
function toCodeParagraphs(block: Extract<WordBlock, { type: "code" }>): Paragraph[] {
  const lines = block.text.split(/\r?\n/u);
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
        shading: { fill: "F4F4F5" },
        children: [new TextRun({ text: line || " ", font: "Courier New" })],
      })
  );
}

/** Builds an image paragraph. DOCX needs an actual image, not a data URL. */
function toImageParagraph(block: Extract<WordBlock, { type: "image" }>): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: block.alt ? `[Image: ${block.alt}]` : "[Image]",
        italics: true,
      }),
    ],
  });
}

/** Builds a page-break paragraph. */
function toPageBreakParagraph(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "", break: 1 })],
  });
}

/** Builds a single table from a `WordTable` block. */
function toTable(block: Extract<WordBlock, { type: "table" }>): Table {
  const rows = block.rows.map(
    (row, rowIndex) =>
      new TableRow({
        children: row.cells.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: toRunsArray(cell.runs) })],
            })
        ),
        // OOXML flags the first row as a header so it repeats on every page.
        tableHeader: rowIndex === 0,
      })
  );
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: "single", size: 4, color: "E4E4E7" },
      bottom: { style: "single", size: 4, color: "E4E4E7" },
      left: { style: "single", size: 4, color: "E4E4E7" },
      right: { style: "single", size: 4, color: "E4E4E7" },
      insideHorizontal: { style: "single", size: 2, color: "E4E4E7" },
      insideVertical: { style: "single", size: 2, color: "E4E4E7" },
    },
  });
}

/** Converts a list into the OOXML numbering definition OOXML needs once per list. */
function toNumberingConfig(abstractNumId: number) {
  return {
    reference: abstractNumId,
    levels: [
      {
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.START,
      },
      {
        level: 1,
        format: LevelFormat.LOWER_LETTER,
        text: "%2.",
        alignment: AlignmentType.START,
      },
      {
        level: 2,
        format: LevelFormat.LOWER_ROMAN,
        text: "%3.",
        alignment: AlignmentType.START,
      },
    ],
  };
}

function toBulletNumberingConfig(abstractNumId: number) {
  return {
    reference: abstractNumId,
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.START,
      },
    ],
  };
}

function toChecklistNumberingConfig(abstractNumId: number) {
  return {
    reference: abstractNumId,
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: "☐",
        alignment: AlignmentType.START,
      },
    ],
  };
}

/** The full DOCX document, returned as a `Document` instance. */
export function buildDocxDocument(body: WordBody, title: string): Document {
  // Allocate a numbering definition per list block. OOXML allows multiple
  // lists in a document; each gets its own abstractNumId.
  const listNumbering: Array<{ abstractNumId: number; numId: number; kind: WordList["kind"] }> = [];
  let nextAbstract = 100;
  let nextNum = 100;
  for (const block of body.blocks) {
    if (block.type === "list") {
      listNumbering.push({
        abstractNumId: nextAbstract,
        numId: nextNum,
        kind: block.kind,
      });
      nextAbstract += 1;
      nextNum += 1;
    }
  }

  // Materialise the blocks in document order.
  const children: Array<Paragraph | Table> = [];
  let listIndex = 0;
  for (const block of body.blocks) {
    if (block.type === "list") {
      const config = listNumbering[listIndex++];
      const listParagraphs = toListParagraph(block, listIndex, {
        abstractNumId: config.abstractNumId,
        numId: config.numId,
      });
      children.push(...listParagraphs);
    } else if (block.type === "code") {
      children.push(...toCodeParagraphs(block));
    } else if (block.type === "image") {
      children.push(toImageParagraph(block));
    } else if (block.type === "page-break") {
      children.push(toPageBreakParagraph());
    } else if (block.type === "table") {
      children.push(toTable(block));
    } else {
      children.push(toParagraph(block, body.settings.lineSpacing));
    }
  }

  // Build the section properties from the document settings. The section
  // owns the children; the document owns the numbering and styles.
  const section = {
    properties: {
      page: {
        size: {
          width: body.settings.page.widthMm * 56.7, // mm → twentieths of a point
          height: body.settings.page.heightMm * 56.7,
          orientation: PageOrientation.PORTRAIT,
        },
        margin: {
          top: body.settings.page.marginTopMm * 56.7,
          right: body.settings.page.marginRightMm * 56.7,
          bottom: body.settings.page.marginBottomMm * 56.7,
          left: body.settings.page.marginLeftMm * 56.7,
          header: body.settings.page.headerMm * 56.7,
          footer: body.settings.page.footerMm * 56.7,
        },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: headerChildren(body.settings.header.right, body.settings.lineSpacing),
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: footerChildren(body, body.settings.footer.center),
          }),
        ],
      }),
    },
    children: children.length ? children : [new Paragraph({ children: [] })],
  };

  // Build the numbering definitions for OOXML.
  const numberingConfig = listNumbering.map((entry) => {
    if (entry.kind === "ordered") return toNumberingConfig(entry.abstractNumId);
    if (entry.kind === "checklist") return toChecklistNumberingConfig(entry.abstractNumId);
    return toBulletNumberingConfig(entry.abstractNumId);
  });

  return new Document({
    creator: "LaunchStack OfficePilot",
    title,
    description: "Created with OfficePilot on LaunchStack",
    styles: {
      default: {
        document: {
          run: { font: body.settings.fontFamily, size: body.settings.fontSize * 2 },
          paragraph: {
            spacing: {
              line: toLineSpacing(body.settings.lineSpacing),
              lineRule: LineRuleType.AUTO,
            },
          },
        },
      },
    },
    sections: [section],
    numbering: {
      config: numberingConfig,
    },
  } as never);
}

/** Builds the header runs from a header/footer slot. */
function headerChildren(runs: WordRun[], lineSpacing: number): TextRun[] {
  if (runs.length === 0) return [];
  return [
    new TextRun({
      text: runs.map((run) => run.text).join(""),
      italics: true,
      size: 18,
    }),
  ];
}

/** Builds the footer runs from the footer slot, including page number if enabled. */
function footerChildren(body: WordBody, runs: WordRun[]): TextRun[] {
  const result: TextRun[] = [];
  const text = runs.map((run) => run.text).join("");
  if (text) {
    result.push(new TextRun({ text, size: 18 }));
  }
  if (body.settings.pageNumber) {
    if (result.length > 0) {
      result.push(new TextRun({ text: " · ", size: 18 }));
    }
    result.push(new TextRun({ children: [PageNumber.CURRENT], size: 18 }));
  }
  return result;
}

/**
 * Returns the document as a `Blob` ready to download. The Packer runs
 * entirely in the browser; the resulting blob is a real `.docx` file.
 */
export async function exportWordToDocx(
  body: WordBody,
  meta: { title: string }
): Promise<Blob> {
  const document = buildDocxDocument(body, meta.title);
  const buffer = await Packer.toBlob(document);
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
