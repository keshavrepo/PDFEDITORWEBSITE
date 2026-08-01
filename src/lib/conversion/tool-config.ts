/**
 * Declarative configuration for the four document conversion tools.
 *
 * Keeping the definitions in one place means the tool pages, the tools
 * directory, metadata, breadcrumbs and structured data all stay in sync.
 */

import { DOCX_ACCEPT, EXCEL_ACCEPT, PDF_ACCEPT, PPTX_ACCEPT } from "./constants";
import type { ConversionFormat } from "./validation";

export type ConversionToolId =
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-to-powerpoint"
  | "powerpoint-to-pdf"
  | "pdf-to-excel"
  | "excel-to-pdf";

export interface ConversionToolConfig {
  id: ConversionToolId;
  name: string;
  /** Short description used in the tools directory. */
  description: string;
  /** Longer description used on the tool page and in metadata. */
  longDescription: string;
  href: string;
  input: ConversionFormat;
  output: ConversionFormat;
  /** Native accept attribute for the file picker. */
  accept: string;
  inputLabel: string;
  outputExtension: string;
  outputMimeType: string;
  /** Suffix appended to the source file name. */
  outputSuffix: string;
  /** Bullet points shown under the uploader. */
  highlights: string[];
  faqs: Array<{ question: string; answer: string }>;
  keywords: string[];
}

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const conversionTools: ConversionToolConfig[] = [
  {
    id: "pdf-to-excel",
    name: "PDF to Excel",
    description: "Extract PDF tables into a spreadsheet",
    longDescription:
      "Turn PDF tables into an editable Excel workbook. Rows and columns are detected from the page layout, numbers stay numeric, and each page becomes its own worksheet.",
    href: "/tools/pdf-to-excel",
    input: "pdf",
    output: "excel",
    accept: PDF_ACCEPT,
    inputLabel: "PDF",
    outputExtension: "xlsx",
    outputMimeType: XLSX_MIME,
    outputSuffix: "tables",
    highlights: [
      "Detects tables into real rows and columns",
      "Numbers stay numeric and computable",
      "One worksheet per page, in order",
    ],
    faqs: [
      {
        question: "Will my table structure be preserved?",
        answer:
          "PDFPilot analyses the page layout to find column boundaries, including tables drawn without visible borders, and rebuilds them as real spreadsheet rows and columns.",
      },
      {
        question: "Are numbers still usable in formulas?",
        answer:
          "Yes. Values that are genuinely numeric are written as numbers, so you can sum and chart them immediately. Codes with leading zeros are kept as text so nothing is lost.",
      },
      {
        question: "What happens with multi-page PDFs?",
        answer:
          "Every page becomes its own worksheet, named in page order, so a long report stays organised and easy to navigate.",
      },
    ],
    keywords: ["PDF to Excel", "PDF to XLSX", "extract PDF tables", "PDF table converter"],
  },
  {
    id: "excel-to-pdf",
    name: "Excel to PDF",
    description: "Convert spreadsheets to printable PDF",
    longDescription:
      "Convert Excel workbooks into clean, printable PDFs. Column widths, merged cells, alignment, fonts, fills and number formatting are preserved, and wide sheets are split across pages just like Excel's own print output.",
    href: "/tools/excel-to-pdf",
    input: "excel",
    output: "pdf",
    accept: EXCEL_ACCEPT,
    inputLabel: "Excel workbook",
    outputExtension: "pdf",
    outputMimeType: PDF_MIME,
    outputSuffix: "converted",
    highlights: [
      "Supports .xlsx and legacy .xls",
      "Keeps merged cells and alignment",
      "Printable, page-ready output",
    ],
    faqs: [
      {
        question: "Are .xls files supported?",
        answer:
          "Yes. Both modern .xlsx workbooks and legacy Excel 97-2003 .xls files are read directly in your browser, with no need to convert them first.",
      },
      {
        question: "Is formatting preserved?",
        answer:
          "Column widths, merged cells, text alignment, bold and italic fonts, cell fills and number formats such as currency, percentages and dates are all carried into the PDF.",
      },
      {
        question: "What happens to very wide sheets?",
        answer:
          "Wide sheets are split across multiple pages horizontally, the same way Excel prints them, so no columns are cut off.",
      },
    ],
    keywords: ["Excel to PDF", "XLSX to PDF", "XLS to PDF", "spreadsheet to PDF"],
  },
  {
    id: "pdf-to-word",
    name: "PDF to Word",
    description: "Convert PDF to editable DOCX",
    longDescription:
      "Convert PDF documents into fully editable Microsoft Word files. Text, headings, fonts, colours, images, tables and page order are reconstructed so you can keep working in Word.",
    href: "/tools/pdf-to-word",
    input: "pdf",
    output: "docx",
    accept: PDF_ACCEPT,
    inputLabel: "PDF",
    outputExtension: "docx",
    outputMimeType: DOCX_MIME,
    outputSuffix: "converted",
    highlights: [
      "Editable text, not page images",
      "Keeps headings, lists, tables and images",
      "Preserves fonts, colours and page order",
    ],
    faqs: [
      {
        question: "Is the converted Word file editable?",
        answer:
          "Yes. PDFPilot rebuilds a real Word document with selectable paragraphs, headings, lists and tables. It does not paste page screenshots into the file.",
      },
      {
        question: "Are images and tables preserved?",
        answer:
          "Images are extracted and embedded at their original position, and tabular layouts are detected and rebuilt as native Word tables wherever the source layout makes them identifiable.",
      },
      {
        question: "Does my file get uploaded to a server?",
        answer:
          "No. The conversion runs entirely in your browser, so the document never leaves your device.",
      },
    ],
    keywords: ["PDF to Word", "PDF to DOCX", "convert PDF to Word", "PDF converter", "editable Word"],
  },
  {
    id: "word-to-pdf",
    name: "Word to PDF",
    description: "Convert DOCX to a shareable PDF",
    longDescription:
      "Turn Microsoft Word documents into polished PDFs. Page size, margins, fonts, styles, images, lists and tables are laid out faithfully, ready for sharing, printing or archiving.",
    href: "/tools/word-to-pdf",
    input: "docx",
    output: "pdf",
    accept: DOCX_ACCEPT,
    inputLabel: "Word document",
    outputExtension: "pdf",
    outputMimeType: PDF_MIME,
    outputSuffix: "converted",
    highlights: [
      "Keeps page size, margins and styling",
      "Renders images, tables and lists",
      "Real text you can search and select",
    ],
    faqs: [
      {
        question: "Which Word files are supported?",
        answer:
          "Modern .docx files created by Word, Google Docs, LibreOffice and Pages exports are supported. Legacy .doc files must be saved as .docx first.",
      },
      {
        question: "Will my fonts look the same?",
        answer:
          "PDFPilot maps your fonts to metric-compatible standard PDF fonts, so spacing and layout stay faithful. Text remains fully selectable and searchable in the PDF.",
      },
      {
        question: "Are page breaks respected?",
        answer:
          "Yes. Explicit page breaks, section geometry and page orientation from the Word document are all carried into the PDF.",
      },
    ],
    keywords: ["Word to PDF", "DOCX to PDF", "convert Word to PDF", "document converter"],
  },
  {
    id: "pdf-to-powerpoint",
    name: "PDF to PowerPoint",
    description: "Convert PDF pages to editable slides",
    longDescription:
      "Convert a PDF into an editable PowerPoint deck. Every page becomes a slide of matching size, with real text boxes, pictures and tables you can rearrange and restyle.",
    href: "/tools/pdf-to-powerpoint",
    input: "pdf",
    output: "pptx",
    accept: PDF_ACCEPT,
    inputLabel: "PDF",
    outputExtension: "pptx",
    outputMimeType: PPTX_MIME,
    outputSuffix: "slides",
    highlights: [
      "One slide per page, in order",
      "Editable text boxes and native tables",
      "Images placed where they appeared",
    ],
    faqs: [
      {
        question: "Are the slides editable?",
        answer:
          "Yes. Each text block becomes a real PowerPoint text box, so you can edit wording, restyle text and move content freely.",
      },
      {
        question: "Do slide dimensions match my PDF?",
        answer:
          "The deck uses the exact page size of your PDF, so nothing is cropped or stretched during conversion.",
      },
      {
        question: "What happens to scanned PDFs?",
        answer:
          "Scanned pages contain pictures rather than text, so their images are placed on the slides. Text recognition (OCR) is not performed.",
      },
    ],
    keywords: ["PDF to PowerPoint", "PDF to PPTX", "convert PDF to slides", "presentation converter"],
  },
  {
    id: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    description: "Convert PPTX slides to PDF",
    longDescription:
      "Export PowerPoint presentations to PDF with one page per slide. Slide size, backgrounds, text styling, images and tables are preserved for reliable sharing and printing.",
    href: "/tools/powerpoint-to-pdf",
    input: "pptx",
    output: "pdf",
    accept: PPTX_ACCEPT,
    inputLabel: "PowerPoint presentation",
    outputExtension: "pdf",
    outputMimeType: PDF_MIME,
    outputSuffix: "converted",
    highlights: [
      "One PDF page per slide, in order",
      "Keeps slide size and backgrounds",
      "Preserves images, tables and text styling",
    ],
    faqs: [
      {
        question: "Which presentations are supported?",
        answer:
          "Modern .pptx files from PowerPoint, Google Slides, Keynote exports and LibreOffice Impress are supported. Legacy .ppt files must be saved as .pptx first.",
      },
      {
        question: "Do animations carry over?",
        answer:
          "PDF is a static format, so animations and transitions are not included. Each slide is exported in its final appearance.",
      },
      {
        question: "Is the PDF text searchable?",
        answer:
          "Yes. Slide text is written as real text, so the resulting PDF stays searchable and selectable.",
      },
    ],
    keywords: ["PowerPoint to PDF", "PPTX to PDF", "convert slides to PDF", "presentation to PDF"],
  },
];

export const conversionToolMap = new Map<string, ConversionToolConfig>(
  conversionTools.map((tool) => [tool.id, tool])
);

export function getConversionTool(id: string): ConversionToolConfig | undefined {
  return conversionToolMap.get(id);
}

/** Builds the download file name for a converted document. */
export function buildOutputName(inputName: string, tool: ConversionToolConfig): string {
  const base =
    inputName.replace(/\.[^.]+$/, "").replace(/[^\w\-. ]+/g, "-").trim() || "document";
  return `${base}.${tool.outputExtension}`;
}
