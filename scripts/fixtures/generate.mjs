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
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";
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


/* -------------------------------------------------------------------------- */
/* Spreadsheet and image fixtures                                             */
/* -------------------------------------------------------------------------- */

/**
 * A realistic .xlsx workbook with a merged title, styled header row, numeric
 * cells, a percentage, a date and a second sheet. Written with the project's
 * own writer so the fixture needs no extra dependency.
 */
async function buildSalesXlsx() {
  const { writeXlsx } = await loadConversionCore();

  const bold = { bold: true };
  const header = { bold: true, fill: "DDEEFF" };
  const cell = (row, column, text, value, type, style) => ({ row, column, text, value, type, style });

  const sheet1 = {
    name: "Sales",
    cells: [
      cell(0, 0, "Annual Sales Report 2026", "Annual Sales Report 2026", "string", {
        bold: true,
        fontSize: 16,
        color: "1F3864",
        horizontal: "center",
      }),
      ...["Region", "Q1", "Q2", "Total"].map((label, column) =>
        cell(1, column, label, label, "string", header)
      ),
      ...[
        ["North", 1200.5, 1400.25, 2600.75],
        ["South", 900, 1100, 2000],
        ["East", 1500, 1600, 3100],
        ["West", 1100, 1250, 2350],
      ].flatMap((row, index) =>
        row.map((value, column) =>
          typeof value === "number"
            ? cell(index + 2, column, String(value), value, "number", {
                numberFormat: "#,##0.00",
              })
            : cell(index + 2, column, value, value, "string")
        )
      ),
      cell(6, 0, "Total", "Total", "string", bold),
      cell(6, 3, "10050.75", 10050.75, "number", { ...bold, numberFormat: "#,##0.00" }),
    ],
    merges: [{ firstRow: 0, lastRow: 0, firstColumn: 0, lastColumn: 3 }],
    columnWidths: new Map([[0, 22], [1, 14], [2, 14], [3, 16]]),
    rowHeights: new Map([[0, 26]]),
    rowCount: 7,
    columnCount: 4,
  };

  const sheet2 = {
    name: "Notes",
    cells: [
      cell(0, 0, "Prepared by", "Prepared by", "string", bold),
      cell(0, 1, "Finance Team", "Finance Team", "string"),
      cell(1, 0, "Confidential", "Confidential", "string", bold),
      cell(1, 1, "TRUE", true, "boolean"),
    ],
    merges: [],
    columnWidths: new Map([[0, 18], [1, 24]]),
    rowHeights: new Map(),
    rowCount: 2,
    columnCount: 2,
  };

  return writeXlsx([sheet1, sheet2], { title: "Annual Sales", author: "PDFPilot Tests" });
}

/**
 * A genuine Excel 97-2003 (.xls) file: an OLE2 container holding a BIFF8
 * Workbook stream. Written by hand so the legacy reader is exercised against a
 * real binary rather than a stand-in.
 */
function buildLegacyXls() {
  const records = [];
  const record = (id, payload) => {
    const buffer = new Uint8Array(4 + payload.length);
    const view = new DataView(buffer.buffer);
    view.setUint16(0, id, true);
    view.setUint16(2, payload.length, true);
    buffer.set(payload, 4);
    records.push(buffer);
  };

  const u16 = (...values) => {
    const buffer = new Uint8Array(values.length * 2);
    const view = new DataView(buffer.buffer);
    values.forEach((value, index) => view.setUint16(index * 2, value, true));
    return buffer;
  };
  /** BIFF8 short unicode string: 1-byte length, 1 flag byte, then characters. */
  const shortString = (text) => {
    const buffer = new Uint8Array(2 + text.length);
    buffer[0] = text.length;
    buffer[1] = 0;
    for (let index = 0; index < text.length; index++) buffer[2 + index] = text.charCodeAt(index);
    return buffer;
  };
  const concat = (parts) => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  };

  const rows = [
    ["Legacy Inventory Report", null, null, null],
    ["SKU", "Item", "Qty", "Price"],
    ["A-100", "Widget", 25, 19.99],
    ["A-200", "Gadget", 10, 149.5],
    ["A-300", "Doohickey", 7, 8.25],
    [null, "TOTAL", 42, null],
  ];

  // Shared string table, in first-seen order.
  const strings = [];
  for (const row of rows) {
    for (const value of row) {
      if (typeof value === "string" && !strings.includes(value)) strings.push(value);
    }
  }

  /* Globals substream. */
  record(0x0809, concat([u16(0x0600, 0x0005), u16(0x0dbb, 0x07cc), u16(0x00c1, 0x0000), u16(0x0006, 0x0000)]));
  // Two fonts: default, then bold. BIFF8 FONT layout is height(0), attributes(2),
  // colour(4), weight(6), escapement(8), then byte fields before the name.
  const fontRecord = (weight) =>
    concat([
      u16(200, 0x0000, 0x7fff, weight, 0x0000),
      new Uint8Array([0, 0, 0, 0]),
      shortString("Arial"),
    ]);
  record(0x0031, fontRecord(400));
  record(0x0031, fontRecord(700));
  // XF 0: plain. XF 1: bold font, centred.
  record(0x00e0, concat([u16(0, 0, 0), new Uint8Array([0x00, 0x00]), u16(0, 0, 0, 0)]));
  record(0x00e0, concat([u16(1, 0, 0), new Uint8Array([0x02, 0x00]), u16(0, 0, 0, 0)]));

  const sstPayload = [u16(strings.length, strings.length).slice(0, 0)];
  const sstHeader = new Uint8Array(8);
  const sstView = new DataView(sstHeader.buffer);
  sstView.setUint32(0, strings.length, true);
  sstView.setUint32(4, strings.length, true);
  sstPayload.push(sstHeader);
  for (const text of strings) {
    const buffer = new Uint8Array(3 + text.length);
    const view = new DataView(buffer.buffer);
    view.setUint16(0, text.length, true);
    buffer[2] = 0;
    for (let index = 0; index < text.length; index++) buffer[3 + index] = text.charCodeAt(index);
    sstPayload.push(buffer);
  }
  record(0x00fc, concat(sstPayload));

  const boundSheetIndex = records.length;
  record(0x0085, concat([u16(0, 0), new Uint8Array([0x00, 0x00]), shortString("Inventory")]));
  record(0x000a, new Uint8Array(0));

  const globalsLength = records.reduce((sum, part) => sum + part.length, 0);

  /* Worksheet substream. */
  const sheetRecords = [];
  const sheetRecord = (id, payload) => {
    const buffer = new Uint8Array(4 + payload.length);
    const view = new DataView(buffer.buffer);
    view.setUint16(0, id, true);
    view.setUint16(2, payload.length, true);
    buffer.set(payload, 4);
    sheetRecords.push(buffer);
  };

  sheetRecord(0x0809, concat([u16(0x0600, 0x0010), u16(0x0dbb, 0x07cc), u16(0x00c1, 0x0000), u16(0x0006, 0x0000)]));
  sheetRecord(0x0200, concat([u16(0, 0), u16(rows.length, 0), u16(0, 4), u16(0, 0)]));
  // Column widths, in 1/256 character units.
  [12, 20, 8, 12].forEach((chars, column) => {
    sheetRecord(0x007d, concat([u16(column, column, chars * 256, 0), u16(0, 0)]));
  });

  rows.forEach((row, rowIndex) => {
    row.forEach((value, column) => {
      if (value === null) return;
      const xf = rowIndex <= 1 ? 1 : 0;
      if (typeof value === "number") {
        const buffer = new Uint8Array(14);
        const view = new DataView(buffer.buffer);
        view.setUint16(0, rowIndex, true);
        view.setUint16(2, column, true);
        view.setUint16(4, xf, true);
        view.setFloat64(6, value, true);
        sheetRecord(0x0203, buffer);
      } else {
        const buffer = new Uint8Array(10);
        const view = new DataView(buffer.buffer);
        view.setUint16(0, rowIndex, true);
        view.setUint16(2, column, true);
        view.setUint16(4, xf, true);
        view.setUint32(6, strings.indexOf(value), true);
        sheetRecord(0x00fd, buffer);
      }
    });
  });

  // Merge the title across all four columns.
  sheetRecord(0x00e5, concat([u16(1), u16(0, 0, 0, 3)]));
  sheetRecord(0x000a, new Uint8Array(0));

  // Patch the BOUNDSHEET stream position now that the globals length is known.
  const boundSheet = records[boundSheetIndex];
  new DataView(boundSheet.buffer).setUint32(4, globalsLength, true);

  const workbookStream = concat([...records, ...sheetRecords]);
  return buildOleContainer(workbookStream);
}

/**
 * Wraps a byte stream in a minimal OLE2 compound document named "Workbook".
 *
 * Streams below the 4096-byte cutoff must be stored in the mini stream, which
 * is itself held by the Root Entry, so both the mini FAT and the mini stream
 * are written. Keeping the standard cutoff means strict readers accept the
 * file, which is the whole point of using a real container in the fixtures.
 */
function buildOleContainer(stream) {
  const SECTOR = 512;
  const MINI_SECTOR = 64;
  const CUTOFF = 4096;

  const miniSectorCount = Math.max(1, Math.ceil(stream.length / MINI_SECTOR));
  // The mini stream is stored in ordinary sectors, referenced by Root Entry.
  const miniStreamBytes = new Uint8Array(miniSectorCount * MINI_SECTOR);
  miniStreamBytes.set(stream, 0);
  const miniStreamSectorCount = Math.max(1, Math.ceil(miniStreamBytes.length / SECTOR));

  const fatSector = 0;
  const directorySector = 1;
  const miniFatSector = 2;
  const firstMiniStreamSector = 3;
  const totalSectors = firstMiniStreamSector + miniStreamSectorCount;

  const output = new Uint8Array(SECTOR * (1 + totalSectors));
  const view = new DataView(output.buffer);

  output.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  view.setUint16(24, 0x003e, true);
  view.setUint16(26, 0x0003, true);
  view.setUint16(28, 0xfffe, true);
  view.setUint16(30, 9, true);
  view.setUint16(32, 6, true);
  view.setUint32(44, 1, true);
  view.setUint32(48, directorySector, true);
  view.setUint32(56, CUTOFF, true);
  view.setUint32(60, miniFatSector, true);
  view.setUint32(64, 1, true);
  view.setUint32(68, 0xfffffffe, true);
  view.setUint32(72, 0, true);
  view.setUint32(76, fatSector, true);
  for (let index = 1; index < 109; index++) view.setUint32(76 + index * 4, 0xffffffff, true);

  // Main FAT.
  const fatOffset = SECTOR * (1 + fatSector);
  for (let index = 0; index < SECTOR / 4; index++) {
    view.setUint32(fatOffset + index * 4, 0xffffffff, true);
  }
  view.setUint32(fatOffset + fatSector * 4, 0xfffffffd, true);
  view.setUint32(fatOffset + directorySector * 4, 0xfffffffe, true);
  view.setUint32(fatOffset + miniFatSector * 4, 0xfffffffe, true);
  for (let index = 0; index < miniStreamSectorCount; index++) {
    const sector = firstMiniStreamSector + index;
    const next = index === miniStreamSectorCount - 1 ? 0xfffffffe : sector + 1;
    view.setUint32(fatOffset + sector * 4, next, true);
  }

  // Mini FAT: one chain covering the whole workbook stream.
  const miniFatOffset = SECTOR * (1 + miniFatSector);
  for (let index = 0; index < SECTOR / 4; index++) {
    view.setUint32(miniFatOffset + index * 4, 0xffffffff, true);
  }
  for (let index = 0; index < miniSectorCount; index++) {
    const next = index === miniSectorCount - 1 ? 0xfffffffe : index + 1;
    view.setUint32(miniFatOffset + index * 4, next, true);
  }

  // Directory.
  const directoryOffset = SECTOR * (1 + directorySector);
  const writeEntry = (index, name, type, start, size, child) => {
    const base = directoryOffset + index * 128;
    for (let position = 0; position < name.length; position++) {
      view.setUint16(base + position * 2, name.charCodeAt(position), true);
    }
    view.setUint16(base + 64, (name.length + 1) * 2, true);
    output[base + 66] = type;
    output[base + 67] = 1;
    view.setUint32(base + 68, 0xffffffff, true);
    view.setUint32(base + 72, 0xffffffff, true);
    view.setUint32(base + 76, child, true);
    view.setUint32(base + 116, start, true);
    view.setUint32(base + 120, size, true);
  };
  // Root Entry owns the mini stream.
  writeEntry(0, "Root Entry", 5, firstMiniStreamSector, miniStreamBytes.length, 1);
  // The workbook lives at mini-sector 0.
  writeEntry(1, "Workbook", 2, 0, stream.length, 0xffffffff);
  for (let index = 2; index < 4; index++) {
    const base = directoryOffset + index * 128;
    output[base + 66] = 0;
    view.setUint32(base + 68, 0xffffffff, true);
    view.setUint32(base + 72, 0xffffffff, true);
    view.setUint32(base + 76, 0xffffffff, true);
  }

  output.set(miniStreamBytes, SECTOR * (1 + firstMiniStreamSector));
  return output;
}

/**
 * A minimal but valid baseline JPEG.
 *
 * Encoding one by hand keeps the fixtures dependency-free: a single flat 8x8
 * block is enough to prove the JPEG path embeds without re-encoding.
 */
async function makeJpeg() {
  const quantisation = new Uint8Array(64).fill(16);
  const segments = [
    [0xff, 0xd8],
    [0xff, 0xdb, 0x00, 0x43, 0x00, ...quantisation],
    [0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00],
    [0xff, 0xc4, 0x00, 0x1f, 0x00, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0x0a, 0x0b],
    [0xff, 0xc4, 0x00, 0x14, 0x10, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00],
    [0x54, 0xff, 0xd9],
  ];
  return Buffer.from(segments.flat());
}

/** A PDF whose pages are a clean table, used to test PDF to Excel. */
async function buildTablePdf() {
  const pdf = await PDFDocument.create();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const columns = [56, 200, 320, 440];
  const data = [
    ["Product", "Units", "Price", "Revenue"],
    ["Widget", "1200", "19.99", "23988.00"],
    ["Gadget", "850", "149.50", "127075.00"],
    ["Doohickey", "430", "8.25", "3547.50"],
    ["Thingamajig", "275", "62.00", "17050.00"],
  ];

  for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText(`Revenue Summary — Part ${pageIndex + 1}`, {
      x: 56, y: 780, size: 16, font: bold,
    });
    data.forEach((row, rowIndex) => {
      row.forEach((value, column) => {
        page.drawText(value, {
          x: columns[column],
          y: 720 - rowIndex * 22,
          size: 10,
          font: rowIndex === 0 ? bold : helvetica,
        });
      });
    });
  }
  return pdf.save();
}

/**
 * A fillable AcroForm covering every field type the tool supports, including a
 * signature field added at the object level because pdf-lib has no helper for
 * creating one.
 */
async function buildFormPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const form = pdf.getForm();

  page.drawText("Employment Application", { x: 56, y: 780, size: 18, font: bold });

  page.drawText("Full name", { x: 56, y: 735, size: 11, font });
  form.createTextField("applicant.name").addToPage(page, { x: 56, y: 710, width: 300, height: 22 });

  page.drawText("Notes", { x: 56, y: 675, size: 11, font });
  const notes = form.createTextField("applicant.notes");
  notes.enableMultiline();
  notes.addToPage(page, { x: 56, y: 605, width: 400, height: 60 });

  page.drawText("Reference (read-only)", { x: 56, y: 575, size: 11, font });
  const reference = form.createTextField("applicant.reference");
  reference.setText("REF-2026-0001");
  reference.enableReadOnly();
  reference.addToPage(page, { x: 56, y: 550, width: 200, height: 22 });

  page.drawText("Subscribe", { x: 80, y: 512, size: 11, font });
  form.createCheckBox("prefs.subscribe").addToPage(page, { x: 56, y: 509, width: 16, height: 16 });

  page.drawText("Employment type", { x: 56, y: 478, size: 11, font });
  const radio = form.createRadioGroup("prefs.employment");
  ["Full-time", "Part-time", "Contract"].forEach((option, index) => {
    radio.addOptionToPage(option, page, { x: 56 + index * 120, y: 451, width: 14, height: 14 });
    page.drawText(option, { x: 76 + index * 120, y: 453, size: 10, font });
  });

  page.drawText("Country", { x: 56, y: 418, size: 11, font });
  const country = form.createDropdown("applicant.country");
  country.addOptions(["India", "United States", "United Kingdom", "Germany"]);
  country.addToPage(page, { x: 56, y: 393, width: 200, height: 22 });

  page.drawText("Skills", { x: 56, y: 360, size: 11, font });
  const skills = form.createOptionList("applicant.skills");
  skills.addOptions(["TypeScript", "Rust", "Go", "Python"]);
  skills.addToPage(page, { x: 56, y: 290, width: 200, height: 60 });

  page.drawText("Signature", { x: 56, y: 258, size: 11, font });

  // A signature widget, registered directly because pdf-lib exposes no builder.
  const context = pdf.context;
  const signature = context.obj({
    FT: PDFName.of("Sig"),
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Widget"),
    T: PDFString.of("applicant.signature"),
    Rect: context.obj([56, 205, 300, 250]),
    F: 4,
    P: page.ref,
  });
  const signatureRef = context.register(signature);
  page.node.Annots().push(signatureRef);
  pdf.catalog.lookup(PDFName.of("AcroForm")).lookup(PDFName.of("Fields")).push(signatureRef);

  return pdf.save();
}

/** A page with a wide white border, used to test white-margin detection. */
async function buildMarginPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595.28, 841.89]);
  // Content sits well inside the page so there is a clear margin to remove.
  page.drawRectangle({ x: 150, y: 400, width: 300, height: 200, color: rgb(0.1, 0.2, 0.6) });
  page.drawText("Content block", { x: 165, y: 610, size: 14, font });
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
    "tables.pdf": await buildTablePdf(),
    "form.pdf": await buildFormPdf(),
    "margins.pdf": await buildMarginPdf(),
    "sales.xlsx": await buildSalesXlsx(),
    "legacy.xls": buildLegacyXls(),
    "photo.jpg": await makeJpeg(),
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
