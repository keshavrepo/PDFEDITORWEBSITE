/**
 * PDF -> Word (.docx) conversion.
 *
 * The PDF is parsed into positioned text and images, analysed into logical
 * blocks (paragraphs, headings, lists, tables), then written as a real
 * WordprocessingML document with an editable text flow — not page images.
 *
 * Page geometry, margins, fonts, colours, alignment and page order are carried
 * across so the result opens as a genuinely editable document.
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import { extractPdf, type ExtractedImage, type ExtractedPage } from "./pdf/pdf-extractor";
import { analyzePage, lineToRuns, type AnalyzedBlock, type AnalyzedParagraph, type AnalyzedTable } from "./pdf/layout-analyzer";
import { pointsToTwips, pointsToHalfPoints, pointsToPixels } from "./constants";
import { conversionErrors } from "./errors";
import { analyzeTextQuality, buildFontSignals } from "./text-quality";
import type { ConversionProgressCallback, HorizontalAlignment, TextRunModel } from "./types";

export interface PdfToWordOptions {
  /** Embed images found in the PDF. Enabled by default. */
  includeImages?: boolean;
  /**
   * Skip the text-quality gate. Only used by diagnostics; production callers
   * must leave this off so unreadable PDFs never yield a garbage document.
   */
  skipQualityCheck?: boolean;
  signal?: AbortSignal;
}

const ALIGNMENT: Record<HorizontalAlignment, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

const BULLET_REFERENCE = "pdfpilot-bullet";
const NUMBER_REFERENCE = "pdfpilot-number";

function toTextRun(run: TextRunModel): TextRun {
  return new TextRun({
    text: run.text,
    font: run.fontFamily,
    size: pointsToHalfPoints(run.fontSize),
    bold: run.bold || undefined,
    italics: run.italic || undefined,
    color: run.color === "000000" ? undefined : run.color,
    underline: run.underline ? { type: UnderlineType.SINGLE } : undefined,
    strike: run.strike || undefined,
    superScript: run.superscript || undefined,
    subScript: run.subscript || undefined,
  });
}

/**
 * Word's page margins are derived from the content bounding box, because PDFs
 * do not record margins. Clamping keeps pathological layouts printable.
 */
function deriveMargins(page: ExtractedPage, blocks: AnalyzedBlock[], images: ExtractedImage[]) {
  const lefts: number[] = [];
  const rights: number[] = [];
  const tops: number[] = [];
  const bottoms: number[] = [];

  for (const block of blocks) {
    lefts.push(block.left);
    rights.push(block.right);
    tops.push(block.top);
    bottoms.push(block.bottom);
  }
  for (const image of images) {
    lefts.push(image.x);
    rights.push(image.x + image.width);
    tops.push(image.y);
    bottoms.push(image.y + image.height);
  }

  if (!lefts.length) {
    const fallback = Math.min(72, page.width * 0.1);
    return { top: fallback, right: fallback, bottom: fallback, left: fallback };
  }

  const clamp = (value: number, max: number) => Math.max(18, Math.min(value, max));
  return {
    left: clamp(Math.min(...lefts), page.width * 0.25),
    right: clamp(page.width - Math.max(...rights), page.width * 0.25),
    top: clamp(Math.min(...tops), page.height * 0.25),
    bottom: clamp(page.height - Math.max(...bottoms), page.height * 0.25),
  };
}

function paragraphToDocx(
  block: AnalyzedParagraph,
  marginLeft: number,
  bodyFontSize: number
): Paragraph {
  const isList = Boolean(block.list);
  const runs: TextRunModel[] = [];

  block.lines.forEach((line, index) => {
    const lineRuns = lineToRuns(line, isList && index === 0);
    if (index > 0 && lineRuns.length && runs.length) {
      // Lines inside a paragraph are a single flow; keep the word separation.
      const previous = runs[runs.length - 1];
      if (!/\s$/.test(previous.text) && !/^\s/.test(lineRuns[0].text)) {
        // Hyphenated line breaks are joined without a space.
        if (/[\u2010-]$/.test(previous.text)) previous.text = previous.text.replace(/[\u2010-]$/, "");
        else previous.text += " ";
      }
    }
    runs.push(...lineRuns);
  });

  if (!runs.length) return new Paragraph({ children: [] });

  // Indentation is relative to the page margin, which Word applies separately.
  const indentLeft = Math.max(0, block.indentLeft - marginLeft);
  const firstLine = Math.max(0, block.indentFirstLine);
  const hangingIndent = block.indentFirstLine < -1 ? Math.abs(block.indentFirstLine) : 0;

  return new Paragraph({
    children: runs.map(toTextRun),
    alignment: ALIGNMENT[block.align],
    heading: block.headingLevel ? HEADINGS[block.headingLevel - 1] : undefined,
    numbering: block.list
      ? { reference: block.list.ordered ? NUMBER_REFERENCE : BULLET_REFERENCE, level: block.list.level }
      : undefined,
    indent: isList
      ? undefined
      : {
          left: indentLeft > 1 ? pointsToTwips(indentLeft) : undefined,
          firstLine: firstLine > 1 ? pointsToTwips(firstLine) : undefined,
          hanging: hangingIndent > 1 ? pointsToTwips(hangingIndent) : undefined,
        },
    spacing: {
      before: block.spaceBefore > 1 ? pointsToTwips(Math.min(block.spaceBefore, 36)) : undefined,
      after: pointsToTwips(bodyFontSize * 0.35),
      line: lineSpacing(block),
    },
  });
}

/** Reproduces the source leading as a Word "exact multiple" line rule. */
function lineSpacing(block: AnalyzedParagraph): number | undefined {
  if (block.lines.length < 2) return undefined;
  const gaps: number[] = [];
  for (let index = 1; index < block.lines.length; index++) {
    gaps.push(block.lines[index].baseline - block.lines[index - 1].baseline);
  }
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const ratio = average / block.lines[0].fontSize;
  // Ignore implausible values produced by overlapping text.
  if (!Number.isFinite(ratio) || ratio < 0.85 || ratio > 3) return undefined;
  return Math.round(ratio * 240);
}

function tableToDocx(block: AnalyzedTable, availableWidth: number): Table {
  const columnCount = Math.max(1, block.columnEdges.length - 1);
  const widths = Array.from({ length: columnCount }, (_, index) => {
    const width = block.columnEdges[index + 1] - block.columnEdges[index];
    return Math.max(width, 12);
  });
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) || availableWidth;

  const rows = block.rows.map(
    (cells) =>
      new TableRow({
        children: Array.from({ length: columnCount }, (_, index) => {
          const cellLines = cells[index] || [];
          const paragraphs = cellLines.length
            ? cellLines.map(
                (line) =>
                  new Paragraph({
                    children: lineToRuns(line).map(toTextRun),
                    spacing: { before: 0, after: 0 },
                  })
              )
            : [new Paragraph({ children: [] })];

          return new TableCell({
            children: paragraphs,
            width: {
              size: Math.round((widths[index] / totalWidth) * 100 * 50) / 50,
              type: WidthType.PERCENTAGE,
            },
            margins: {
              top: convertMillimetersToTwip(0.8),
              bottom: convertMillimetersToTwip(0.8),
              left: convertMillimetersToTwip(1.5),
              right: convertMillimetersToTwip(1.5),
            },
          });
        }),
      })
  );

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths.map((width) => pointsToTwips((width / totalWidth) * availableWidth)),
  });
}

function imageToDocx(image: ExtractedImage, availableWidth: number): Paragraph {
  // Keep the aspect ratio and never overflow the text column.
  const scale = Math.min(1, availableWidth / image.width);
  return new Paragraph({
    children: [
      new ImageRun({
        type: "png",
        data: image.image.data,
        transformation: {
          width: Math.round(pointsToPixels(image.width * scale)),
          height: Math.round(pointsToPixels(image.height * scale)),
        },
      }),
    ],
    spacing: { before: 120, after: 120 },
  });
}

/**
 * Interleaves images with text blocks by vertical position, so pictures land
 * in the same reading order as the original page.
 */
function orderPageContent(
  blocks: AnalyzedBlock[],
  images: ExtractedImage[]
): Array<{ type: "block"; value: AnalyzedBlock } | { type: "image"; value: ExtractedImage }> {
  const entries = [
    ...blocks.map((value) => ({ type: "block" as const, value, top: value.top })),
    ...images.map((value) => ({ type: "image" as const, value, top: value.y })),
  ];
  entries.sort((a, b) => a.top - b.top);
  return entries.map(({ type, value }) =>
    type === "block"
      ? { type: "block" as const, value: value as AnalyzedBlock }
      : { type: "image" as const, value: value as ExtractedImage }
  );
}

/** Converts PDF bytes into a Word document. */
export async function convertPdfToWord(
  data: Uint8Array,
  options: PdfToWordOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  const includeImages = options.includeImages !== false;

  const extracted = await extractPdf(
    data,
    { includeImages, signal: options.signal, maxImagePixels: 1600 },
    (progress) =>
      onProgress?.({
        stage: progress.stage,
        progress: progress.progress,
        total: progress.total * 2,
      })
  );

  const pageCount = extracted.pages.length;
  const hasContent = extracted.pages.some((page) => page.items.length > 0 || page.images.length > 0);
  if (!hasContent) {
    throw conversionErrors.noContent("PDF");
  }

  // Refuse to emit a document whose text cannot be read. This guard lives in
  // the converter itself so no caller — UI, API or script — can bypass it.
  if (!options.skipQualityCheck) {
    const items = extracted.pages.flatMap((page) => page.items);
    const quality = analyzeTextQuality({
      pages: extracted.pages,
      fontSignals: buildFontSignals(items, extracted.fontEncodings),
    });
    if (quality.strategy !== "native") throw conversionErrors.ocrRequired(quality.summary);
  }

  const sections = extracted.pages.map((page, pageIndex) => {
    onProgress?.({
      stage: `Building page ${pageIndex + 1} of ${pageCount}`,
      progress: pageCount + pageIndex,
      total: pageCount * 2,
    });

    const { blocks, bodyFontSize } = analyzePage(page);
    const margins = deriveMargins(page, blocks, page.images);
    const availableWidth = page.width - margins.left - margins.right;

    const children: Array<Paragraph | Table> = [];
    for (const entry of orderPageContent(blocks, page.images)) {
      if (entry.type === "image") {
        children.push(imageToDocx(entry.value, availableWidth));
      } else if (entry.value.kind === "table") {
        children.push(tableToDocx(entry.value, availableWidth));
        // Word requires a paragraph between consecutive tables.
        children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
      } else {
        children.push(paragraphToDocx(entry.value, margins.left, bodyFontSize));
      }
    }

    if (!children.length) children.push(new Paragraph({ children: [] }));

    return {
      properties: {
        page: {
          size: { width: pointsToTwips(page.width), height: pointsToTwips(page.height) },
          margin: {
            top: pointsToTwips(margins.top),
            right: pointsToTwips(margins.right),
            bottom: pointsToTwips(margins.bottom),
            left: pointsToTwips(margins.left),
          },
        },
      },
      children,
    };
  });

  const document = new Document({
    creator: extracted.metadata.author || "PDFPilot",
    title: extracted.metadata.title,
    subject: extracted.metadata.subject,
    keywords: extracted.metadata.keywords?.join(", "),
    description: "Converted from PDF by PDFPilot",
    numbering: {
      config: [
        {
          reference: BULLET_REFERENCE,
          levels: Array.from({ length: 5 }, (_, level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ["\u2022", "\u25E6", "\u25AA", "\u2022", "\u25E6"][level],
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } },
            },
          })),
        },
        {
          reference: NUMBER_REFERENCE,
          levels: Array.from({ length: 5 }, (_, level) => ({
            level,
            format: [
              LevelFormat.DECIMAL,
              LevelFormat.LOWER_LETTER,
              LevelFormat.LOWER_ROMAN,
              LevelFormat.DECIMAL,
              LevelFormat.LOWER_LETTER,
            ][level],
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } },
            },
          })),
        },
      ],
    },
    sections,
  });

  onProgress?.({ stage: "Writing Word document", progress: pageCount * 2 - 1, total: pageCount * 2 });
  const buffer = await Packer.toBuffer(document);
  onProgress?.({ stage: "Completed", progress: pageCount * 2, total: pageCount * 2 });
  return new Uint8Array(buffer);
}

export { PageBreak };
