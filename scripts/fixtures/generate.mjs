/**
 * Builds the real documents used by the conversion test suite.
 *
 * Fixtures are generated rather than committed so the repository stays small
 * and the inputs remain reproducible. They deliberately cover the awkward
 * cases: multi-page flow, images, tables, mixed fonts, large documents and
 * deliberately damaged files.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import PptxGenJS from "pptxgenjs";
import { loadConversionCore } from "../conversion-harness.mjs";

export const FIXTURE_DIR = new URL("./generated/", import.meta.url).pathname;

/** Deterministic RGBA test image with sharp edges and flat colour regions. */
async function makeImage(width, height, seed = 0) {
  const { encodePng } = await loadConversionCore();
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const inCircle =
        (x - width / 2) ** 2 + (y - height / 2) ** 2 < (Math.min(width, height) / 3) ** 2;
      rgba[index] = inCircle ? 250 : (40 + seed * 30) % 256;
      rgba[index + 1] = inCircle ? 200 : (90 + seed * 20) % 256;
      rgba[index + 2] = inCircle ? 90 : 200;
      rgba[index + 3] = 255;
    }
  }
  return Buffer.from(await encodePng(rgba, width, height));
}

/* -------------------------------------------------------------------------- */
/* PDF fixtures                                                               */
/* -------------------------------------------------------------------------- */

async function buildSimplePdf() {
  const pdf = await PDFDocument.create();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const courier = await pdf.embedFont(StandardFonts.Courier);

  const page = pdf.addPage([595.28, 841.89]);
  page.drawText("Quarterly Report 2026", {
    x: 56, y: 780, size: 24, font: bold, color: rgb(0.1, 0.1, 0.4),
  });
  page.drawText("Prepared by the Finance Team", { x: 56, y: 748, size: 12, font: italic });
  page.drawText("This paragraph is ordinary body copy used to verify text extraction.", {
    x: 56, y: 716, size: 11, font: helvetica,
  });
  page.drawText("monospaced_code_sample()", { x: 56, y: 692, size: 10, font: courier });

  // A borderless grid, which must still be recognised as a table.
  const columns = [56, 220, 350, 470];
  const rows = [640, 620, 600, 580, 560];
  const data = [
    ["Region", "Q1", "Q2", "Total"],
    ["North", "1200", "1400", "2600"],
    ["South", "900", "1100", "2000"],
    ["East", "1500", "1600", "3100"],
    ["West", "1100", "1250", "2350"],
  ];
  data.forEach((row, rowIndex) =>
    row.forEach((cell, columnIndex) =>
      page.drawText(cell, {
        x: columns[columnIndex],
        y: rows[rowIndex],
        size: 10,
        font: rowIndex === 0 ? bold : helvetica,
      })
    )
  );

  const second = pdf.addPage([595.28, 841.89]);
  second.drawText("Second Page Heading", { x: 56, y: 780, size: 18, font: bold });
  second.drawText("\u2022 First bullet point", { x: 76, y: 748, size: 11, font: helvetica });
  second.drawText("\u2022 Second bullet point", { x: 76, y: 726, size: 11, font: helvetica });
  second.drawText("1. Numbered item one", { x: 76, y: 700, size: 11, font: helvetica });
  second.drawText("2. Numbered item two", { x: 76, y: 678, size: 11, font: helvetica });

  return pdf.save();
}

async function buildImagePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595.28, 841.89]);

  page.drawText("Document With Images", { x: 56, y: 790, size: 18, font });
  const png = await pdf.embedPng(await makeImage(240, 160, 1));
  page.drawImage(png, { x: 56, y: 590, width: 240, height: 160 });
  const second = await pdf.embedPng(await makeImage(180, 180, 2));
  page.drawImage(second, { x: 330, y: 590, width: 160, height: 160 });
  page.drawText("Caption below both images", { x: 56, y: 560, size: 11, font });

  return pdf.save();
}

/** Multi-page document with varied fonts, used for large-input testing. */
async function buildLargePdf(pageCount = 60) {
  const pdf = await PDFDocument.create();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const times = await pdf.embedFont(StandardFonts.TimesRoman);

  for (let index = 0; index < pageCount; index++) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText(`Chapter ${index + 1}`, { x: 56, y: 780, size: 20, font: bold });
    for (let line = 0; line < 28; line++) {
      page.drawText(
        `Page ${index + 1} line ${line + 1}: the quick brown fox jumps over the lazy dog.`,
        { x: 56, y: 740 - line * 24, size: 11, font: line % 2 ? times : helvetica }
      );
    }
  }
  return pdf.save();
}

/** Landscape page plus a rotated page, to exercise geometry handling. */
async function buildRotatedPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const landscape = pdf.addPage([841.89, 595.28]);
  landscape.drawText("Landscape page content", { x: 56, y: 520, size: 16, font });

  const rotated = pdf.addPage([595.28, 841.89]);
  rotated.drawText("Rotated page content", { x: 56, y: 780, size: 16, font });
  rotated.setRotation({ type: "degrees", angle: 90 });

  return pdf.save();
}

/* -------------------------------------------------------------------------- */
/* Text-quality fixtures                                                      */
/* -------------------------------------------------------------------------- */

const HINDI_LINES = [
  "भारत सरकार",
  "राजस्व विभाग कार्यालय",
  "यह हिंदी यूनिकोड दस्तावेज़ है।",
  "आवेदन संख्या 12345",
];

const toHex = (value) => value.toString(16).padStart(4, "0").toUpperCase();

/**
 * Proper Unicode Hindi PDF: an Identity-H composite font carrying a real
 * ToUnicode CMap, exactly as a modern Word or LaTeX export produces. Text is
 * fully recoverable, so this must convert natively.
 */
async function buildUnicodeHindiPdf() {
  const characters = [...new Set(HINDI_LINES.join("").split(""))];
  const cids = new Map(characters.map((character, index) => [character, index + 1]));

  const bfChar = [...cids]
    .map(([character, cid]) => `<${toHex(cid)}> <${toHex(character.codePointAt(0))}>`)
    .join("\n");

  const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CMapName /PDFPilot-H def
/CMapType 2 def
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${cids.size} beginbfchar
${bfChar}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;

  const pdf = await PDFDocument.create();
  const context = pdf.context;
  const page = pdf.addPage([595.28, 841.89]);

  const descriptor = context.obj({
    Type: "FontDescriptor",
    FontName: "NotoSansDevanagari",
    Flags: 4,
    ItalicAngle: 0,
    Ascent: 1069,
    Descent: -293,
    CapHeight: 714,
    StemV: 80,
    FontBBox: context.obj([-1000, -500, 2000, 1100]),
  });
  const descendant = context.obj({
    Type: "Font",
    Subtype: "CIDFontType2",
    BaseFont: "NotoSansDevanagari",
    CIDSystemInfo: context.obj({ Registry: "Adobe", Ordering: "Identity", Supplement: 0 }),
    FontDescriptor: context.register(descriptor),
    DW: 600,
  });
  const font = context.obj({
    Type: "Font",
    Subtype: "Type0",
    BaseFont: "NotoSansDevanagari",
    Encoding: "Identity-H",
    DescendantFonts: context.obj([context.register(descendant)]),
    ToUnicode: context.register(context.flateStream(cmap)),
  });
  page.node.set(PDFName.of("Resources"), context.obj({ Font: context.obj({ F1: context.register(font) }) }));

  const encode = (line) => [...line].map((character) => toHex(cids.get(character))).join("");
  let y = 780;
  const operations = HINDI_LINES.map((line, index) => {
    const size = index === 0 ? 22 : 14;
    const operation = `BT /F1 ${size} Tf 56 ${y} Td <${encode(line)}> Tj ET`;
    y -= 40;
    return operation;
  });
  page.node.set(PDFName.of("Contents"), context.register(context.flateStream(operations.join("\n"))));

  return pdf.save();
}

/**
 * Government-style legacy PDF: a symbolic TrueType font named Kruti Dev with no
 * embedded font program and no ToUnicode map.
 *
 * The bytes spell "Hkkjr ljdkj", which renders as "भारत सरकार" only because the
 * font remaps glyphs. Extraction yields valid ASCII that means nothing, which
 * is precisely the case the quality gate must catch.
 */
async function buildLegacyGovernmentPdf() {
  const pdf = await PDFDocument.create();
  const context = pdf.context;
  const page = pdf.addPage([595.28, 841.89]);

  const font = context.obj({
    Type: "Font",
    Subtype: "TrueType",
    BaseFont: "ABCDEF+KrutiDev010",
    FirstChar: 32,
    LastChar: 255,
    Widths: context.obj(Array.from({ length: 224 }, () => 500)),
    Encoding: "WinAnsiEncoding",
    FontDescriptor: context.obj({
      Type: "FontDescriptor",
      FontName: "ABCDEF+KrutiDev010",
      // Flag 4 marks the font symbolic: its encoding is font-specific.
      Flags: 4,
      ItalicAngle: 0,
      Ascent: 750,
      Descent: -250,
      CapHeight: 700,
      StemV: 80,
      FontBBox: context.obj([-100, -250, 1000, 750]),
    }),
  });
  page.node.set(PDFName.of("Resources"), context.obj({ Font: context.obj({ F1: context.register(font) }) }));

  const lines = [
    "BT /F1 18 Tf 56 780 Td (Hkkjr ljdkj) Tj ET",
    "BT /F1 14 Tf 56 750 Td (jktLo foHkkx dk;kZy;) Tj ET",
    "BT /F1 12 Tf 56 720 Td (vkosnu i= la[;k 12345) Tj ET",
    "BT /F1 12 Tf 56 690 Td (fnukad 15@08@2026 dks tkjh fd;k x;k) Tj ET",
    "BT /F1 12 Tf 56 660 Td (izek.k i= la[;k RJ&2026&8871) Tj ET",
  ];
  page.node.set(PDFName.of("Contents"), context.register(context.flateStream(lines.join("\n"))));

  return pdf.save();
}

/**
 * Scanned document: full-page raster images and no text layer at all, the way
 * a flatbed scanner or phone camera capture arrives.
 */
async function buildScannedPdf(pageCount = 2) {
  const width = 850;
  const height = 1100;
  const rgba = new Uint8Array(width * height * 4).fill(255);

  const ink = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const index = (y * width + x) * 4;
        rgba[index] = 30;
        rgba[index + 1] = 30;
        rgba[index + 2] = 30;
      }
    }
  };
  // Draw text-like bars so the page looks like a scan of a written document.
  for (let line = 0; line < 24; line++) {
    let x = 90;
    const y = 120 + line * 38;
    for (let word = 0; word < 7 + ((line * 3) % 5); word++) {
      const wordWidth = 22 + ((line * 7 + word * 13) % 46);
      ink(x, y, wordWidth, 10);
      x += wordWidth + 12;
      if (x > width - 140) break;
    }
  }

  const { encodePng } = await loadConversionCore();
  const png = Buffer.from(await encodePng(rgba, width, height));

  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(png);
  for (let index = 0; index < pageCount; index++) {
    const page = pdf.addPage([612, 792]);
    page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  }
  return pdf.save();
}

/** Valid PDF structure containing no text or images at all. */
async function buildEmptyContentPdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([595.28, 841.89]);
  return pdf.save();
}

/* -------------------------------------------------------------------------- */
/* DOCX fixtures                                                              */
/* -------------------------------------------------------------------------- */

async function buildRichDocx() {
  const image = await makeImage(240, 160, 3);

  const document = new Document({
    creator: "PDFPilot Test Suite",
    title: "Employee Handbook",
    subject: "Conversion fixture",
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            text: "Employee Handbook",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Revision 4.2 \u2014 Confidential",
                italics: true,
                color: "777777",
                font: "Georgia",
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "1. Introduction", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({ text: "Welcome aboard. ", font: "Times New Roman", size: 24 }),
              new TextRun({ text: "This span is bold, ", bold: true, font: "Times New Roman", size: 24 }),
              new TextRun({ text: "this one italic, ", italics: true, font: "Times New Roman", size: 24 }),
              new TextRun({ text: "this underlined", underline: {}, font: "Times New Roman", size: 24 }),
              new TextRun({ text: ", and this red.", color: "CC0000", font: "Times New Roman", size: 24 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: "A deliberately long justified paragraph exercises the line breaking engine. ".repeat(8),
                font: "Calibri",
                size: 22,
              }),
            ],
          }),
          new Paragraph({ text: "2. Benefits", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: "Health insurance", numbering: { reference: "bullets", level: 0 } }),
          new Paragraph({ text: "Dental coverage", numbering: { reference: "bullets", level: 0 } }),
          new Paragraph({ text: "Retirement plan", numbering: { reference: "bullets", level: 0 } }),
          new Paragraph({ text: "Submit the form", numbering: { reference: "numbers", level: 0 } }),
          new Paragraph({ text: "Wait for approval", numbering: { reference: "numbers", level: 0 } }),
          new Paragraph({ text: "3. Compensation", heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6 },
              bottom: { style: BorderStyle.SINGLE, size: 6 },
              left: { style: BorderStyle.SINGLE, size: 6 },
              right: { style: BorderStyle.SINGLE, size: 6 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4 },
              insideVertical: { style: BorderStyle.SINGLE, size: 4 },
            },
            rows: [
              new TableRow({
                children: ["Level", "Title", "Base", "Bonus"].map(
                  (heading) =>
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: "DDEEFF" },
                      children: [new Paragraph({ children: [new TextRun({ text: heading, bold: true })] })],
                    })
                ),
              }),
              ...[
                ["L3", "Engineer", "$120,000", "10%"],
                ["L4", "Senior Engineer", "$150,000", "15%"],
                ["L5", "Staff Engineer", "$185,000", "20%"],
              ].map(
                (row) =>
                  new TableRow({
                    children: row.map((cell) => new TableCell({ children: [new Paragraph(cell)] })),
                  })
              ),
            ],
          }),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({ text: "4. Company Logo", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [
              new ImageRun({ type: "png", data: image, transformation: { width: 240, height: 160 } }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Unicode: \u201csmart quotes\u201d \u2014 em-dash\u2026 caf\u00e9 na\u00efve r\u00e9sum\u00e9 \u00a3\u20ac\u00a5 \u00bd \u00a9\u00ae\u2122",
                font: "Calibri",
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Superscript x", size: 22 }),
              new TextRun({ text: "2", superScript: true, size: 22 }),
              new TextRun({ text: " and subscript H", size: 22 }),
              new TextRun({ text: "2", subScript: true, size: 22 }),
              new TextRun({ text: "O", size: 22 }),
            ],
          }),
          ...Array.from(
            { length: 40 },
            (_, index) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Overflow paragraph ${index + 1}: additional content that forces pagination across several pages.`,
                    size: 22,
                  }),
                ],
              })
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}

/** Landscape section with a wide table, for geometry checks. */
async function buildLandscapeDocx() {
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 16838, height: 11906, orientation: "landscape" },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({ text: "Landscape Report", heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: Array.from(
              { length: 6 },
              (_, rowIndex) =>
                new TableRow({
                  children: Array.from(
                    { length: 6 },
                    (_, columnIndex) =>
                      new TableCell({
                        children: [new Paragraph(`R${rowIndex + 1}C${columnIndex + 1}`)],
                      })
                  ),
                })
            ),
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}

/**
 * Pathological content: empty paragraphs, an unbreakable string, a table row
 * taller than the page and oversized text. These exercise the pagination
 * guards that prevent infinite page generation.
 */
async function buildStressDocx() {
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({ text: "Stress Test", heading: HeadingLevel.HEADING_1 }),
          ...Array.from({ length: 12 }, () => new Paragraph({ children: [] })),
          new Paragraph({
            children: [new TextRun({ text: `${"A".repeat(400)}`, size: 22 })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "https://example.com/an/extremely/long/url/that/cannot/be/broken/at/spaces/because/it/has/none/whatsoever/and/keeps/going",
                size: 22,
              }),
            ],
          }),
          new Paragraph({ children: [new TextRun({ text: "Huge", size: 320 })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: Array.from(
                      { length: 90 },
                      (_, index) => new Paragraph(`Tall row line ${index + 1}`)
                    ),
                  }),
                  new TableCell({ children: [new Paragraph("Second column")] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("After the tall row")] }),
                  new TableCell({ children: [new Paragraph("Still here")] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "Final paragraph after the stress content." }),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}

/** Minimal single-paragraph document. */
async function buildMinimalDocx() {
  const document = new Document({
    sections: [{ children: [new Paragraph("Just one short line of text.")] }],
  });
  return Packer.toBuffer(document);
}

/* -------------------------------------------------------------------------- */
/* PPTX fixtures                                                              */
/* -------------------------------------------------------------------------- */

async function buildRichPptx() {
  const image = await makeImage(240, 160, 4);
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_16x9";
  presentation.author = "PDFPilot Test Suite";
  presentation.title = "Quarterly Business Review";

  const title = presentation.addSlide();
  title.background = { color: "F2F6FC" };
  title.addText("Quarterly Business Review", {
    x: 0.5, y: 1.6, w: 9, h: 1, fontSize: 40, bold: true, color: "1F3864",
    align: "center", fontFace: "Georgia",
  });
  title.addText("Finance Team \u2014 Q3 2026", {
    x: 0.5, y: 2.7, w: 9, h: 0.5, fontSize: 20, color: "666666", align: "center", italic: true,
  });

  const bullets = presentation.addSlide();
  bullets.addText("Key Highlights", {
    x: 0.5, y: 0.35, w: 9, h: 0.8, fontSize: 32, bold: true, color: "1F3864",
  });
  bullets.addText(
    [
      { text: "Revenue grew 24% year over year", options: { bullet: true, breakLine: true, fontSize: 18 } },
      { text: "Churn reduced to 1.8%", options: { bullet: true, breakLine: true, fontSize: 18 } },
      { text: "Two new enterprise regions launched", options: { bullet: true, breakLine: true, fontSize: 18 } },
      {
        text: "Underlined and coloured sample",
        options: { bullet: true, fontSize: 18, underline: { style: "sng" }, color: "C00000" },
      },
    ],
    { x: 0.8, y: 1.4, w: 8.5, h: 2.5 }
  );
  bullets.addImage({
    data: `image/png;base64,${image.toString("base64")}`,
    x: 6.6, y: 3.6, w: 2.6, h: 1.73,
  });

  const table = presentation.addSlide();
  table.addText("Regional Performance", {
    x: 0.5, y: 0.35, w: 9, h: 0.8, fontSize: 32, bold: true, color: "1F3864",
  });
  table.addTable(
    [
      ["Region", "Q2", "Q3", "Growth"].map((heading) => ({
        text: heading,
        options: { bold: true, fill: { color: "DDEEFF" } },
      })),
      ["North America", "$1.20M", "$1.48M", "+23%"],
      ["EMEA", "$0.86M", "$1.05M", "+22%"],
      ["APAC", "$0.54M", "$0.72M", "+33%"],
    ],
    {
      x: 0.6, y: 1.4, w: 8.8, colW: [3.0, 1.9, 1.9, 2.0], fontSize: 16,
      border: { type: "solid", pt: 1, color: "999999" },
    }
  );

  const wrapping = presentation.addSlide();
  wrapping.addText("Long Text Wrapping", {
    x: 0.5, y: 0.35, w: 9, h: 0.8, fontSize: 32, bold: true,
  });
  wrapping.addText(
    "This paragraph is intentionally long so the converter must wrap it inside the shape frame instead of letting it overflow the slide boundary. ".repeat(4),
    { x: 0.6, y: 1.3, w: 8.8, h: 3.5, fontSize: 16 }
  );

  return Buffer.from(await presentation.write({ outputType: "arraybuffer" }));
}

/** Many slides, for large-input testing. */
async function buildLargePptx(slideCount = 40) {
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_16x9";

  for (let index = 0; index < slideCount; index++) {
    const slide = presentation.addSlide();
    slide.addText(`Slide ${index + 1}`, {
      x: 0.5, y: 0.4, w: 9, h: 0.9, fontSize: 30, bold: true,
    });
    slide.addText(
      Array.from({ length: 6 }, (_, line) => ({
        text: `Point ${line + 1} on slide ${index + 1}`,
        options: { bullet: true, breakLine: true, fontSize: 16 },
      })),
      { x: 0.8, y: 1.5, w: 8.4, h: 3.4 }
    );
  }
  return Buffer.from(await presentation.write({ outputType: "arraybuffer" }));
}

/* -------------------------------------------------------------------------- */
/* Invalid and corrupted inputs                                               */
/* -------------------------------------------------------------------------- */

function buildCorruptedPdf(valid) {
  // Keep the header so it passes signature checks, then destroy the xref.
  const copy = Uint8Array.from(valid);
  copy.fill(0x00, Math.floor(copy.length * 0.35), Math.floor(copy.length * 0.85));
  return copy;
}

function buildTruncatedZip(valid) {
  return Uint8Array.from(valid).slice(0, Math.floor(valid.length * 0.4));
}

/** Writes every fixture and returns their absolute paths. */
export async function generateFixtures() {
  await mkdir(FIXTURE_DIR, { recursive: true });

  const simplePdf = await buildSimplePdf();
  const richDocx = await buildRichDocx();
  const richPptx = await buildRichPptx();

  const files = {
    "simple.pdf": simplePdf,
    "images.pdf": await buildImagePdf(),
    "large.pdf": await buildLargePdf(),
    "rotated.pdf": await buildRotatedPdf(),
    "blank.pdf": await buildEmptyContentPdf(),
    "hindi-unicode.pdf": await buildUnicodeHindiPdf(),
    "gov-legacy-hindi.pdf": await buildLegacyGovernmentPdf(),
    "scanned.pdf": await buildScannedPdf(),
    "corrupted.pdf": buildCorruptedPdf(simplePdf),
    "rich.docx": richDocx,
    "landscape.docx": await buildLandscapeDocx(),
    "minimal.docx": await buildMinimalDocx(),
    "stress.docx": await buildStressDocx(),
    "corrupted.docx": buildTruncatedZip(richDocx),
    "rich.pptx": richPptx,
    "large.pptx": await buildLargePptx(),
    "corrupted.pptx": buildTruncatedZip(richPptx),
    "empty.pdf": new Uint8Array(0),
    "empty.docx": new Uint8Array(0),
    "empty.pptx": new Uint8Array(0),
    "notapdf.pdf": new TextEncoder().encode("This is plain text pretending to be a PDF.\n"),
    "notadocx.docx": new TextEncoder().encode("Plain text pretending to be a Word file.\n"),
    "image.png": await makeImage(64, 64, 5),
  };

  const paths = {};
  for (const [name, data] of Object.entries(files)) {
    const path = join(FIXTURE_DIR, name);
    await writeFile(path, Buffer.from(data));
    paths[name] = path;
  }
  return paths;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const paths = await generateFixtures();
  console.log(`Generated ${Object.keys(paths).length} fixtures in ${FIXTURE_DIR}`);
}
