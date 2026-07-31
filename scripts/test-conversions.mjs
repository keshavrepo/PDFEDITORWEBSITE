/**
 * End-to-end conversion tests running the production code paths against real
 * documents.
 *
 * The conversion core is deliberately isomorphic, so the exact modules shipped
 * to the browser are exercised here in Node. Assertions check real document
 * structure — extracted text, paragraph counts, tables, embedded media, page
 * geometry and page order — not merely that bytes were produced.
 *
 * Run with: npm run test:conversions
 */

import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { cleanConversionBuild, loadConversionCore } from "./conversion-harness.mjs";
import { FIXTURE_DIR, generateFixtures } from "./fixtures/generate.mjs";
import {
  assertValidPackage,
  assertWellFormedXml,
  summarizeDocx,
  summarizePptx,
} from "./ooxml-inspect.mjs";

const results = { passed: 0, failed: 0, failures: [] };
let currentSuite = "";

function suite(name) {
  currentSuite = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

async function test(name, run) {
  try {
    await run();
    results.passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (error) {
    results.failed++;
    results.failures.push({ suite: currentSuite, name, error });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${error.message}\x1b[0m`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack, needle, label) {
  assert(
    haystack.includes(needle),
    `${label}: expected to find ${JSON.stringify(needle)}`
  );
}

/** Asserts a conversion rejects an input, and that the message is useful. */
async function assertRejects(run, expectation, label) {
  let threw = false;
  let message = "";
  try {
    await run();
  } catch (error) {
    threw = true;
    message = error?.message || String(error);
  }
  assert(threw, `${label}: expected the conversion to fail`);
  assert(
    expectation.test(message),
    `${label}: message ${JSON.stringify(message)} did not match ${expectation}`
  );
}

const core = await loadConversionCore();
const fixtures = await generateFixtures();
const read = async (name) => new Uint8Array(await readFile(fixtures[name]));

/** Loads pdf.js for verifying generated PDFs. */
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function inspectPdf(bytes) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
  });
  const document = await task.promise;

  const pages = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      width: viewport.width,
      height: viewport.height,
      text: content.items.map((item) => item.str ?? "").join(""),
    });
    page.cleanup();
  }
  const text = pages.map((page) => page.text).join("\n");
  // Destroying the loading task releases the document and its transport.
  await task.destroy();
  return { pageCount: pages.length, pages, text };
}

/* -------------------------------------------------------------------------- */

suite("Validation — invalid, empty and corrupted inputs");

await test("empty PDF is rejected before conversion", async () => {
  const file = new File([await read("empty.pdf")], "empty.pdf", { type: "application/pdf" });
  const result = await core.validateConversionInput(file, "pdf");
  assert(!result.valid, "empty PDF should be invalid");
  assert(/empty/i.test(result.error), `unhelpful message: ${result.error}`);
});

await test("empty DOCX and PPTX are rejected", async () => {
  for (const [name, format] of [["empty.docx", "docx"], ["empty.pptx", "pptx"]]) {
    const file = new File([await read(name)], name);
    const result = await core.validateConversionInput(file, format);
    assert(!result.valid, `${name} should be invalid`);
    assert(/empty/i.test(result.error), `unhelpful message for ${name}: ${result.error}`);
  }
});

await test("text file renamed to .pdf is rejected", async () => {
  const file = new File([await read("notapdf.pdf")], "notapdf.pdf", { type: "application/pdf" });
  const result = await core.validateConversionInput(file, "pdf");
  assert(!result.valid, "a text file must not pass PDF validation");
  assert(/not a PDF/i.test(result.error), `unhelpful message: ${result.error}`);
});

await test("text file renamed to .docx is rejected", async () => {
  const file = new File([await read("notadocx.docx")], "notadocx.docx");
  const result = await core.validateConversionInput(file, "docx");
  assert(!result.valid, "a text file must not pass DOCX validation");
});

await test("PNG offered to the Word converter is rejected", async () => {
  const file = new File([await read("image.png")], "image.png", { type: "image/png" });
  const result = await core.validateConversionInput(file, "docx");
  assert(!result.valid, "an image must not pass DOCX validation");
});

await test("corrupted PDF fails with a clear message", async () => {
  await assertRejects(
    async () => core.convertPdfToWord(await read("corrupted.pdf")),
    /damaged|could not be converted|no readable content/i,
    "corrupted PDF"
  );
});

await test("corrupted DOCX fails with a clear message", async () => {
  await assertRejects(
    async () => core.convertWordToPdf(await read("corrupted.docx")),
    /damaged|could not be converted/i,
    "corrupted DOCX"
  );
});

await test("corrupted PPTX fails with a clear message", async () => {
  await assertRejects(
    async () => core.convertPowerPointToPdf(await read("corrupted.pptx")),
    /damaged|could not be converted/i,
    "corrupted PPTX"
  );
});

await test("PDF with no readable content is reported, not silently empty", async () => {
  await assertRejects(
    async () => core.convertPdfToWord(await read("blank.pdf")),
    /no readable content/i,
    "blank PDF"
  );
});

await test("valid inputs pass validation", async () => {
  const checks = [
    ["simple.pdf", "pdf"],
    ["rich.docx", "docx"],
    ["rich.pptx", "pptx"],
  ];
  for (const [name, format] of checks) {
    const file = new File([await read(name)], name);
    const result = await core.validateConversionInput(file, format);
    assert(result.valid, `${name} should be valid: ${result.error}`);
  }
});

/* -------------------------------------------------------------------------- */

suite("PDF to Word");

let simpleDocx;

await test("produces a valid, well-formed .docx package", async () => {
  simpleDocx = await core.convertPdfToWord(await read("simple.pdf"));
  await assertValidPackage(simpleDocx, ["word/document.xml"]);
});

await test("preserves all text content", async () => {
  const summary = await summarizeDocx(simpleDocx);
  for (const expected of [
    "Quarterly Report 2026",
    "Prepared by the Finance Team",
    "monospaced_code_sample()",
    "Second Page Heading",
  ]) {
    assertIncludes(summary.text, expected, "PDF to Word text");
  }
});

await test("preserves page order across pages", async () => {
  const summary = await summarizeDocx(simpleDocx);
  const first = summary.text.indexOf("Quarterly Report 2026");
  const second = summary.text.indexOf("Second Page Heading");
  assert(first >= 0 && second > first, "page 2 content must follow page 1 content");
});

await test("detects the borderless table and rebuilds it", async () => {
  const summary = await summarizeDocx(simpleDocx);
  assert(summary.tableCount >= 1, `expected a table, found ${summary.tableCount}`);
  assert(summary.rowCount >= 5, `expected 5 rows, found ${summary.rowCount}`);
  for (const value of ["Region", "North", "2600", "West"]) {
    assertIncludes(summary.text, value, "table cell");
  }
});

await test("preserves fonts and text colour", async () => {
  const summary = await summarizeDocx(simpleDocx);
  assertIncludes(summary.fonts.join(","), "Arial", "font mapping");
  assert(
    summary.fonts.some((font) => /Times New Roman|Courier New/.test(font)),
    `expected serif or mono fonts, found ${summary.fonts.join(", ")}`
  );
  assert(summary.colors.includes("1A1A66"), `expected the heading colour, found ${summary.colors}`);
});

await test("detects headings and bold runs", async () => {
  const summary = await summarizeDocx(simpleDocx);
  assert(summary.headings.length > 0, "expected at least one heading");
  assert(summary.boldRuns > 0, "expected bold runs to be preserved");
});

await test("creates one Word section per PDF page", async () => {
  const summary = await summarizeDocx(simpleDocx);
  assert(summary.sectionCount >= 2, `expected 2 sections, found ${summary.sectionCount}`);
});

await test("extracts and embeds images", async () => {
  const output = await core.convertPdfToWord(await read("images.pdf"));
  await assertValidPackage(output, ["word/document.xml"]);
  const summary = await summarizeDocx(output);
  assert(summary.imageCount >= 2, `expected 2 images, found ${summary.imageCount}`);
  assert(
    summary.media.every((name) => /\.(png|jpe?g)$/i.test(name)),
    `media parts must be images, found ${summary.media.join(", ")}`
  );
  assertIncludes(summary.text, "Document With Images", "image document text");
  assertIncludes(summary.text, "Caption below both images", "image caption");
});

await test("handles landscape and rotated pages", async () => {
  const output = await core.convertPdfToWord(await read("rotated.pdf"));
  await assertValidPackage(output, ["word/document.xml"]);
  const summary = await summarizeDocx(output);
  assertIncludes(summary.text, "Landscape page content", "rotated document");
  assertIncludes(summary.text, "Rotated page content", "rotated document");
});

await test("converts a 60-page document with all pages intact", async () => {
  const started = Date.now();
  const output = await core.convertPdfToWord(await read("large.pdf"));
  const seconds = (Date.now() - started) / 1000;
  await assertValidPackage(output, ["word/document.xml"]);

  const summary = await summarizeDocx(output);
  assertIncludes(summary.text, "Chapter 1", "large document");
  assertIncludes(summary.text, "Chapter 60", "large document last page");
  assert(summary.sectionCount >= 60, `expected 60 sections, found ${summary.sectionCount}`);
  console.log(`      (${seconds.toFixed(1)}s, ${(output.length / 1024).toFixed(0)}KB)`);
});

await test("reports progress from start to finish", async () => {
  const updates = [];
  await core.convertPdfToWord(await read("simple.pdf"), {}, (progress) => updates.push(progress));
  assert(updates.length > 0, "expected progress callbacks");
  const last = updates.at(-1);
  assert(last.progress === last.total, "final progress must reach the total");
});

/* -------------------------------------------------------------------------- */

suite("Word to PDF");

let richPdf;

await test("produces a readable PDF", async () => {
  richPdf = await core.convertWordToPdf(await read("rich.docx"));
  assert(
    new TextDecoder("latin1").decode(richPdf.slice(0, 8)).startsWith("%PDF-"),
    "output must start with a PDF header"
  );
  const inspected = await inspectPdf(richPdf);
  assert(inspected.pageCount >= 2, `expected multiple pages, found ${inspected.pageCount}`);
});

await test("preserves headings, body text and styling", async () => {
  const inspected = await inspectPdf(richPdf);
  for (const expected of [
    "Employee Handbook",
    "1. Introduction",
    "Welcome aboard.",
    "This span is bold,",
    "3. Compensation",
  ]) {
    assertIncludes(inspected.text, expected, "Word to PDF text");
  }
});

await test("preserves list content", async () => {
  const inspected = await inspectPdf(richPdf);
  for (const item of ["Health insurance", "Dental coverage", "Submit the form"]) {
    assertIncludes(inspected.text, item, "list item");
  }
});

await test("preserves table cells", async () => {
  const inspected = await inspectPdf(richPdf);
  for (const cell of ["Level", "Staff Engineer", "$185,000", "20%"]) {
    assertIncludes(inspected.text, cell, "table cell");
  }
});

await test("honours the declared page size", async () => {
  const inspected = await inspectPdf(richPdf);
  // A4 portrait is 595.3 x 841.9 points.
  assert(
    Math.abs(inspected.pages[0].width - 595.3) < 2 &&
      Math.abs(inspected.pages[0].height - 841.9) < 2,
    `expected A4, found ${inspected.pages[0].width} x ${inspected.pages[0].height}`
  );
});

await test("honours explicit page breaks", async () => {
  const inspected = await inspectPdf(richPdf);
  const logoPage = inspected.pages.findIndex((page) => page.text.includes("4. Company Logo"));
  assert(logoPage > 0, "the page-break section must start on a later page");
});

await test("transliterates unicode punctuation instead of failing", async () => {
  const inspected = await inspectPdf(richPdf);
  assertIncludes(inspected.text, "caf", "accented text");
  assertIncludes(inspected.text, "sum", "accented text");
  assert(!inspected.text.includes("\ufffd"), "no replacement characters expected");
});

await test("embeds images from the document", async () => {
  const asText = new TextDecoder("latin1").decode(richPdf);
  assert(asText.includes("/Image"), "expected an embedded image XObject");
});

await test("handles landscape sections and wide tables", async () => {
  const output = await core.convertWordToPdf(await read("landscape.docx"));
  const inspected = await inspectPdf(output);
  assert(
    inspected.pages[0].width > inspected.pages[0].height,
    `expected landscape, found ${inspected.pages[0].width} x ${inspected.pages[0].height}`
  );
  assertIncludes(inspected.text, "R6C6", "wide table content");
});

await test("handles a minimal single-paragraph document", async () => {
  const output = await core.convertWordToPdf(await read("minimal.docx"));
  const inspected = await inspectPdf(output);
  assert(inspected.pageCount === 1, `expected 1 page, found ${inspected.pageCount}`);
  assertIncludes(inspected.text, "Just one short line of text.", "minimal document");
});

await test("paginates long documents without dropping content", async () => {
  const inspected = await inspectPdf(richPdf);
  assertIncludes(inspected.text, "Overflow paragraph 1:", "first overflow paragraph");
  assertIncludes(inspected.text, "Overflow paragraph 40:", "last overflow paragraph");
});

await test("survives pathological content without runaway pagination", async () => {
  // Empty paragraphs, unbreakable strings, oversized text and a table row
  // taller than the page must all terminate and stay within a sane page count.
  const output = await core.convertWordToPdf(await read("stress.docx"));
  const inspected = await inspectPdf(output);
  assert(inspected.pageCount > 0, "expected at least one page");
  assert(inspected.pageCount < 40, `runaway pagination: ${inspected.pageCount} pages`);
  assertIncludes(inspected.text, "Stress Test", "stress heading");
  assertIncludes(inspected.text, "Final paragraph after the stress content.", "content after the tall row");
  assertIncludes(inspected.text, "AAAA", "unbreakable string was wrapped, not dropped");
  assertIncludes(inspected.text, "example.com", "long URL retained");
});

/* -------------------------------------------------------------------------- */

suite("PDF to PowerPoint");

let simplePptx;

await test("produces a valid, well-formed .pptx package", async () => {
  simplePptx = await core.convertPdfToPowerPoint(await read("simple.pdf"));
  await assertValidPackage(simplePptx, ["ppt/presentation.xml", "ppt/slides/slide1.xml"]);
});

await test("creates one slide per page, in order", async () => {
  const summary = await summarizePptx(simplePptx);
  assert(summary.slideCount === 2, `expected 2 slides, found ${summary.slideCount}`);
  assertIncludes(summary.slides[0].text.join(" "), "Quarterly Report 2026", "slide 1");
  assertIncludes(summary.slides[1].text.join(" "), "Second Page Heading", "slide 2");
});

await test("slide dimensions match the PDF page size", async () => {
  const summary = await summarizePptx(simplePptx);
  // A4 portrait in EMU: 595.28pt and 841.89pt at 12700 EMU per point.
  const widthPoints = summary.slideWidthEmu / 12700;
  const heightPoints = summary.slideHeightEmu / 12700;
  assert(
    Math.abs(widthPoints - 595.28) < 2 && Math.abs(heightPoints - 841.89) < 2,
    `expected A4 slides, found ${widthPoints.toFixed(1)} x ${heightPoints.toFixed(1)} points`
  );
});

await test("emits editable text boxes rather than page images", async () => {
  const summary = await summarizePptx(simplePptx);
  assert(summary.slides[0].shapeCount >= 2, "expected multiple text shapes");
  assert(summary.slides[0].pictureCount === 0, "a text-only page must not contain pictures");
});

await test("rebuilds tables as native PowerPoint tables", async () => {
  const summary = await summarizePptx(simplePptx);
  assert(summary.slides[0].tableCount >= 1, "expected a native table");
  assert(summary.slides[0].rowCount >= 5, `expected 5 rows, found ${summary.slides[0].rowCount}`);
});

await test("preserves fonts and bold styling", async () => {
  const summary = await summarizePptx(simplePptx);
  const fonts = summary.slides.flatMap((slide) => slide.fonts);
  assert(fonts.includes("Arial"), `expected Arial, found ${fonts.join(", ")}`);
  assert(summary.slides[0].bold > 0, "expected bold runs");
});

await test("embeds images on the correct slide", async () => {
  const output = await core.convertPdfToPowerPoint(await read("images.pdf"));
  await assertValidPackage(output, ["ppt/presentation.xml"]);
  const summary = await summarizePptx(output);
  assert(summary.slides[0].pictureCount >= 2, `expected 2 pictures, found ${summary.slides[0].pictureCount}`);
  assert(summary.media.length >= 2, "expected media parts in the package");
});

await test("converts a 60-page PDF into 60 ordered slides", async () => {
  const started = Date.now();
  const output = await core.convertPdfToPowerPoint(await read("large.pdf"));
  const seconds = (Date.now() - started) / 1000;
  const summary = await summarizePptx(output);
  assert(summary.slideCount === 60, `expected 60 slides, found ${summary.slideCount}`);
  assertIncludes(summary.slides[0].text.join(" "), "Chapter 1", "first slide");
  assertIncludes(summary.slides[59].text.join(" "), "Chapter 60", "last slide");
  console.log(`      (${seconds.toFixed(1)}s, ${(output.length / 1024).toFixed(0)}KB)`);
});

/* -------------------------------------------------------------------------- */

suite("PowerPoint to PDF");

let deckPdf;

await test("produces a readable PDF", async () => {
  deckPdf = await core.convertPowerPointToPdf(await read("rich.pptx"));
  assert(
    new TextDecoder("latin1").decode(deckPdf.slice(0, 8)).startsWith("%PDF-"),
    "output must start with a PDF header"
  );
});

await test("creates one page per slide, in presentation order", async () => {
  const inspected = await inspectPdf(deckPdf);
  assert(inspected.pageCount === 4, `expected 4 pages, found ${inspected.pageCount}`);
  assertIncludes(inspected.pages[0].text, "Quarterly Business Review", "slide 1");
  assertIncludes(inspected.pages[1].text, "Key Highlights", "slide 2");
  assertIncludes(inspected.pages[2].text, "Regional Performance", "slide 3");
});

await test("page size matches the 16:9 slide size", async () => {
  const inspected = await inspectPdf(deckPdf);
  assert(
    Math.abs(inspected.pages[0].width - 720) < 2 && Math.abs(inspected.pages[0].height - 405) < 2,
    `expected 720x405 points, found ${inspected.pages[0].width} x ${inspected.pages[0].height}`
  );
});

await test("preserves bullet text and decoded bullet glyphs", async () => {
  const inspected = await inspectPdf(deckPdf);
  assertIncludes(inspected.text, "Revenue grew 24% year over year", "bullet text");
  assertIncludes(inspected.text, "\u2022", "decoded bullet glyph");
  assert(!inspected.text.includes("&#x"), "character references must be decoded");
});

await test("preserves table content", async () => {
  const inspected = await inspectPdf(deckPdf);
  for (const cell of ["North America", "$1.48M", "+33%", "Growth"]) {
    assertIncludes(inspected.text, cell, "table cell");
  }
});

await test("embeds slide images", async () => {
  const asText = new TextDecoder("latin1").decode(deckPdf);
  assert(asText.includes("/Image"), "expected an embedded image XObject");
});

await test("wraps long text inside its shape", async () => {
  const inspected = await inspectPdf(deckPdf);
  assertIncludes(inspected.pages[3].text, "Long Text Wrapping", "wrapping slide");
  assertIncludes(inspected.pages[3].text, "overflow the slide boundary", "wrapped body text");
});

await test("converts a 40-slide deck with every slide present", async () => {
  const started = Date.now();
  const output = await core.convertPowerPointToPdf(await read("large.pptx"));
  const seconds = (Date.now() - started) / 1000;
  const inspected = await inspectPdf(output);
  assert(inspected.pageCount === 40, `expected 40 pages, found ${inspected.pageCount}`);
  assertIncludes(inspected.pages[0].text, "Slide 1", "first slide");
  assertIncludes(inspected.pages[39].text, "Slide 40", "last slide");
  console.log(`      (${seconds.toFixed(1)}s, ${(output.length / 1024).toFixed(0)}KB)`);
});

/* -------------------------------------------------------------------------- */

suite("Text quality detection");

await test("normal English PDF is detected as natively convertible", async () => {
  const analysis = await core.analyzePdfForConversion(await read("simple.pdf"));
  assert(analysis.badge === "native", `expected native badge, got ${analysis.badge}`);
  assert(analysis.canConvertNatively, "English PDF must convert natively");
  assert(analysis.engine?.id === "native-pdf", `expected native engine, got ${analysis.engine?.id}`);
  assert(analysis.quality.issues.length === 0, `unexpected issues: ${analysis.quality.issues}`);
  assert(analysis.quality.confidence >= 0.8, `low confidence: ${analysis.quality.confidence}`);
});

await test("Unicode Hindi PDF is detected as natively convertible", async () => {
  const analysis = await core.analyzePdfForConversion(await read("hindi-unicode.pdf"));
  assert(analysis.badge === "native", `expected native badge, got ${analysis.badge}`);
  assert(analysis.canConvertNatively, "Unicode Hindi must convert natively");
  assert(
    analysis.quality.issues.length === 0,
    `Devanagari text must not be flagged: ${analysis.quality.issues}`
  );
});

await test("Unicode Hindi PDF converts with Devanagari text intact", async () => {
  const output = await core.convertPdfToWord(await read("hindi-unicode.pdf"));
  await assertValidPackage(output, ["word/document.xml"]);
  const summary = await summarizeDocx(output);
  assertIncludes(summary.text, "भारत सरकार", "Hindi heading");
  assertIncludes(summary.text, "आवेदन", "Hindi body text");
  assert(
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(summary.text),
    "output must not contain XML-illegal control characters"
  );
});

await test("Government legacy-font PDF is detected as requiring OCR", async () => {
  const analysis = await core.analyzePdfForConversion(await read("gov-legacy-hindi.pdf"));
  assert(analysis.badge === "ocr-required", `expected ocr-required, got ${analysis.badge}`);
  assert(!analysis.canConvertNatively, "legacy-font PDF must not convert natively");
  assert(analysis.engine === null, "no engine should accept a legacy-font PDF yet");
  assert(
    analysis.quality.issues.includes("legacy-encoded-font"),
    `expected legacy-encoded-font, got ${analysis.quality.issues}`
  );
  assert(
    analysis.quality.legacyFonts.some((font) => /kruti/i.test(font)),
    `expected Kruti Dev to be named, got ${analysis.quality.legacyFonts}`
  );
});

await test("Government legacy-font PDF shows the exact required message", async () => {
  const analysis = await core.analyzePdfForConversion(await read("gov-legacy-hindi.pdf"));
  assert(
    analysis.blockedReason === core.OCR_REQUIRED_MESSAGE,
    `unexpected message: ${analysis.blockedReason}`
  );
  assert(
    core.OCR_REQUIRED_MESSAGE ===
      "This PDF uses embedded or legacy fonts that cannot be converted directly into editable text. OCR is required for accurate conversion.",
    "the user-facing message must match the agreed wording exactly"
  );
});

await test("scanned PDF is detected as requiring OCR", async () => {
  const analysis = await core.analyzePdfForConversion(await read("scanned.pdf"));
  assert(analysis.badge === "ocr-required", `expected ocr-required, got ${analysis.badge}`);
  assert(analysis.quality.looksScanned, "scanned document must be recognised as scanned");
  assert(
    analysis.quality.issues.includes("scanned-document"),
    `expected scanned-document, got ${analysis.quality.issues}`
  );
});

await test("no broken document is generated for legacy or scanned PDFs", async () => {
  // The guard lives inside the converters, so even a direct API call refuses.
  for (const name of ["gov-legacy-hindi.pdf", "scanned.pdf"]) {
    await assertRejects(
      async () => core.convertPdfToWord(await read(name)),
      /OCR is required for accurate conversion/,
      `${name} to Word`
    );
    await assertRejects(
      async () => core.convertPdfToPowerPoint(await read(name)),
      /OCR is required for accurate conversion/,
      `${name} to PowerPoint`
    );
  }
});

await test("existing English and image PDFs are never falsely flagged", async () => {
  for (const name of ["simple.pdf", "images.pdf", "large.pdf", "rotated.pdf"]) {
    const analysis = await core.analyzePdfForConversion(await read(name));
    assert(
      analysis.badge === "native",
      `${name} was wrongly flagged as ${analysis.badge} (${analysis.quality.issues})`
    );
  }
});

await test("legacy font names are recognised across vendors and subset tags", async () => {
  const legacy = [
    "KrutiDev010", "ABCDEF+Kruti Dev 010", "DevLys 010", "Chanakya",
    "Shree-Lipi", "Shivaji01", "AkrutiDev Priya", "DV-TTYogesh", "Millennium",
  ];
  for (const font of legacy) {
    assert(core.isLegacyEncodedFont(font), `${font} should be recognised as legacy`);
  }

  const modern = [
    "Arial", "Times New Roman", "Calibri", "Noto Sans Devanagari",
    "Mangal", "Nirmala UI", "Helvetica", "Georgia", "Courier New",
  ];
  for (const font of modern) {
    assert(!core.isLegacyEncodedFont(font), `${font} must not be treated as legacy`);
  }
});

await test("glyph-garbage scoring separates legacy output from English prose", async () => {
  const garbage = "Hkkjr ljdkj jktLo foHkkx dk;kZy; vkosnu i= la[;k izek.k";
  const english =
    "The quarterly report summarises revenue growth across every region and highlights the outlook.";

  assert(core.scoreGlyphGarbage(garbage) > 0.5, "legacy output should score high");
  assert(core.scoreGlyphGarbage(english) < 0.2, "English prose should score low");
  // Real Devanagari must never be treated as garbage.
  assert(
    core.scoreGlyphGarbage("भारत सरकार राजस्व विभाग कार्यालय आवेदन संख्या") === 0,
    "Unicode Devanagari must score zero"
  );
});

/* -------------------------------------------------------------------------- */

suite("Conversion engine architecture");

await test("native engine is registered and reports its capabilities", async () => {
  const engine = core.getEngine("native-pdf");
  assert(engine, "native engine must be registered");
  assert(await engine.isAvailable(), "native engine must be available");
  assert(engine.capabilities.privacyPreserving, "native engine runs on-device");
  assert(!engine.capabilities.opticalCharacterRecognition, "native engine is not an OCR engine");
  assert(engine.capabilities.outputs.includes("docx"), "native engine must support docx");
});

await test("native engine declines documents that need OCR", async () => {
  const engine = core.getEngine("native-pdf");
  const good = { strategy: "native", issues: [] };
  const bad = { strategy: "ocr-required", issues: ["legacy-encoded-font"] };

  assert(engine.canHandle({ output: "docx", quality: good }), "should accept readable text");
  assert(!engine.canHandle({ output: "docx", quality: bad }), "should decline unreadable text");
  assert(!engine.canHandle({ output: "pdf", quality: good }), "should decline unsupported output");
});

await test("a future OCR engine can be plugged in without UI changes", async () => {
  // Proves the registry contract: registering an OCR engine makes previously
  // blocked documents convertible, with no change to the calling code.
  const calls = [];
  core.registerEngine({
    id: "tesseract-ocr",
    name: "Tesseract OCR",
    description: "Test double",
    environment: "browser",
    capabilities: {
      outputs: ["docx", "pptx"],
      opticalCharacterRecognition: true,
      privacyPreserving: true,
      relativeSpeed: "slow",
    },
    async isAvailable() {
      return true;
    },
    canHandle({ output }) {
      return output === "docx" || output === "pptx";
    },
    async convert({ output }) {
      calls.push(output);
      return { data: new Uint8Array([1, 2, 3]), engine: "tesseract-ocr" };
    },
  });

  try {
    const analysis = await core.analyzePdfForConversion(await read("gov-legacy-hindi.pdf"));
    // The badge still reports OCR, but an engine is now available for it.
    assert(analysis.badge === "ocr-required", "badge should still report OCR");
    assert(analysis.engine?.id === "tesseract-ocr", `expected OCR engine, got ${analysis.engine?.id}`);

    const result = await analysis.engine.convert({ data: new Uint8Array(), output: "docx" });
    assert(result.engine === "tesseract-ocr", "OCR engine should have run");
    assert(calls.length === 1, "engine convert should be invoked once");

    // Readable PDFs must still prefer the faster native engine.
    const readable = await core.analyzePdfForConversion(await read("simple.pdf"));
    assert(
      readable.engine?.id === "native-pdf",
      `readable PDFs must stay native, got ${readable.engine?.id}`
    );
  } finally {
    // Restore the registry so later assertions see the shipped configuration.
    core.registerEngine({
      id: "tesseract-ocr",
      name: "Tesseract OCR",
      description: "Not installed",
      environment: "browser",
      capabilities: {
        outputs: [],
        opticalCharacterRecognition: true,
        privacyPreserving: true,
        relativeSpeed: "slow",
      },
      async isAvailable() {
        return false;
      },
      canHandle() {
        return false;
      },
      async convert() {
        throw new Error("not installed");
      },
    });
  }
});

await test("quality analysis stays fast on scanned documents", async () => {
  // Analysis must not decode page pixels; a slow pre-flight would be a
  // regression users feel on every upload.
  const started = Date.now();
  await core.analyzePdfForConversion(await read("scanned.pdf"));
  const seconds = (Date.now() - started) / 1000;
  assert(seconds < 5, `analysis took ${seconds.toFixed(1)}s, expected well under 5s`);
  console.log(`      (${seconds.toFixed(2)}s)`);
});

/* -------------------------------------------------------------------------- */

suite("Round trips");

await test("PDF to Word to PDF keeps the text intact", async () => {
  const docx = await core.convertPdfToWord(await read("simple.pdf"));
  const pdf = await core.convertWordToPdf(docx);
  const inspected = await inspectPdf(pdf);
  assertIncludes(inspected.text, "Quarterly Report 2026", "round-trip heading");
  assertIncludes(inspected.text, "Second Page Heading", "round-trip page 2");
  assertIncludes(inspected.text, "North", "round-trip table");
});

await test("PowerPoint to PDF to PowerPoint keeps slide count and text", async () => {
  const pdf = await core.convertPowerPointToPdf(await read("rich.pptx"));
  const pptx = await core.convertPdfToPowerPoint(pdf);
  const summary = await summarizePptx(pptx);
  assert(summary.slideCount === 4, `expected 4 slides, found ${summary.slideCount}`);
  assertIncludes(summary.slides[0].text.join(" "), "Quarterly Business Review", "round-trip slide 1");
});

/* -------------------------------------------------------------------------- */

suite("Output integrity");

await test("every generated OOXML part is well-formed XML", async () => {
  const outputs = [
    ["pdf-to-word", await core.convertPdfToWord(await read("images.pdf"))],
    ["pdf-to-powerpoint", await core.convertPdfToPowerPoint(await read("images.pdf"))],
  ];
  for (const [label, bytes] of outputs) {
    const zip = await assertValidPackage(
      bytes,
      label === "pdf-to-word" ? ["word/document.xml"] : ["ppt/presentation.xml"]
    );
    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
      assertWellFormedXml(await zip.file(name).async("string"), `${label}:${name}`);
    }
  }
});

await test("generated PDFs re-open cleanly in a PDF reader", async () => {
  for (const bytes of [richPdf, deckPdf]) {
    const inspected = await inspectPdf(bytes);
    assert(inspected.pageCount > 0, "expected at least one readable page");
    assert(inspected.text.trim().length > 0, "expected extractable text");
  }
});

/* -------------------------------------------------------------------------- */

console.log(
  `\n\x1b[1mResults\x1b[0m  ${results.passed} passed, ${results.failed} failed\n`
);

if (results.failures.length) {
  console.log("\x1b[31mFailures:\x1b[0m");
  for (const failure of results.failures) {
    console.log(`  ${failure.suite} › ${failure.name}`);
    console.log(`    ${failure.error.stack?.split("\n").slice(0, 3).join("\n    ")}`);
  }
}

// Keep the working tree clean: generated fixtures and build output are
// artifacts, not source.
await cleanConversionBuild();
await rm(join(FIXTURE_DIR), { recursive: true, force: true });

process.exit(results.failed > 0 ? 1 : 0);
