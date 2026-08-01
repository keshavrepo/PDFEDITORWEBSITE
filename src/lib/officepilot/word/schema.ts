/**
 * OfficePilot Word document schema.
 *
 * A block-based document model. Every document is a sequence of blocks;
 * each block carries its own alignment, indent and inline formatting, and
 * the schema is small enough that the renderer, exporter and importer can
 * all share the same types.
 *
 * The shape is deliberately close to OOXML so the DOCX exporter can map
 * blocks one-to-one onto OOXML elements without lossy intermediate layers.
 * Markdown-style "paragraph with a heading" is the unit the user sees, the
 * block is the unit the engine stores.
 */

/** Inline mark supported on text runs. */
export type WordMark =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "superscript"
  | "subscript"
  | "code";

/** Text alignment for any block that supports it. */
export type WordAlignment = "left" | "center" | "right" | "justify";

/** Line-height multiplier. `1.0` is single, `1.5` is one-and-a-half, `2.0` is double. */
export type WordLineSpacing = 1 | 1.15 | 1.5 | 2;

/** Numbered list style. `ordered` for `1.`, `unordered` for bullets. */
export type WordListKind = "ordered" | "unordered" | "checklist";

/**
 * An inline run of text with formatting marks and an optional hyperlink
 * target. Runs are the unit of fine-grained formatting inside a text block.
 */
export interface WordRun {
  /** Plain text content. Newlines are soft line breaks within a paragraph. */
  text: string;
  /** Marks applied to this run. */
  marks: WordMark[];
  /** Optional hyperlink target (URL or `mailto:`). */
  href?: string;
  /** Optional inline font colour, hex (e.g. "#0a0a0a"). */
  color?: string;
  /** Optional inline background highlight colour, hex. */
  highlight?: string;
}

/** A heading block. */
export interface WordHeading {
  id: string;
  type: "heading";
  /** Level 1 to 6, matching the six HTML heading levels. */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  runs: WordRun[];
  alignment: WordAlignment;
}

/** A regular paragraph block. */
export interface WordParagraph {
  id: string;
  type: "paragraph";
  runs: WordRun[];
  alignment: WordAlignment;
  /** Zero-based indent in tab units. */
  indent: number;
}

/** A list block. */
export interface WordList {
  id: string;
  type: "list";
  kind: WordListKind;
  items: Array<{
    id: string;
    runs: WordRun[];
  }>;
}

/** A block quote. */
export interface WordQuote {
  id: string;
  type: "quote";
  runs: WordRun[];
  alignment: WordAlignment;
}

/** A monospaced code block. */
export interface WordCodeBlock {
  id: string;
  type: "code";
  language?: string;
  text: string;
}

/** A table. The body is a 2D array of cell run-arrays. */
export interface WordTable {
  id: string;
  type: "table";
  /** First row is treated as the header. */
  rows: Array<{
    id: string;
    cells: Array<{
      id: string;
      runs: WordRun[];
    }>;
  }>;
}

/** An embedded image. `src` is a data URL or a remote URL. */
export interface WordImage {
  id: string;
  type: "image";
  src: string;
  alt: string;
  /** Display width in CSS pixels; height is derived to keep the aspect ratio. */
  width: number;
}

/** A page break. */
export interface WordPageBreak {
  id: string;
  type: "page-break";
}

/** Every block kind the Word editor supports. */
export type WordBlock =
  | WordHeading
  | WordParagraph
  | WordList
  | WordQuote
  | WordCodeBlock
  | WordTable
  | WordImage
  | WordPageBreak;

/** Page geometry the document is laid out for. */
export interface WordPageSettings {
  /** Page width in millimetres. */
  widthMm: number;
  /** Page height in millimetres. */
  heightMm: number;
  /** Top margin in millimetres. */
  marginTopMm: number;
  /** Right margin in millimetres. */
  marginRightMm: number;
  /** Bottom margin in millimetres. */
  marginBottomMm: number;
  /** Left margin in millimetres. */
  marginLeftMm: number;
  /** Header height in millimetres. */
  headerMm: number;
  /** Footer height in millimetres. */
  footerMm: number;
}

/** The header or footer block: plain text runs. */
export interface WordHeaderFooter {
  left: WordRun[];
  center: WordRun[];
  right: WordRun[];
}

/** Document-wide settings the renderer and exporter read. */
export interface WordDocumentSettings {
  page: WordPageSettings;
  header: WordHeaderFooter;
  footer: WordHeaderFooter;
  /** Page-number placeholder for the footer. */
  pageNumber: boolean;
  /** Default font family for new runs. */
  fontFamily: string;
  /** Default font size in points. */
  fontSize: number;
  /** Default line spacing. */
  lineSpacing: WordLineSpacing;
  /** Optional document language. Used by spellcheck and accessibility. */
  language?: string;
}

/** The body of a Word document. */
export interface WordBody {
  format: "word";
  /** Sequential block list. */
  blocks: WordBlock[];
  /** Document-wide settings. */
  settings: WordDocumentSettings;
}

/** A short preview summary, used by the dashboard or the file manager. */
export interface WordStats {
  blocks: number;
  characters: number;
  /** Includes text inside lists, quotes, tables, code blocks and headings. */
  charactersWithSpaces: number;
  words: number;
  /** Approximate page count, derived from rendered length. */
  pages: number;
  /** Reading time in minutes, assuming 220 wpm. */
  readingTimeMinutes: number;
}

/** Default page settings for a brand-new document. */
export const DEFAULT_PAGE: WordPageSettings = {
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 25,
  marginRightMm: 25,
  marginBottomMm: 25,
  marginLeftMm: 25,
  headerMm: 12,
  footerMm: 12,
};

/** Default document settings for a brand-new document. */
export const DEFAULT_SETTINGS: WordDocumentSettings = {
  page: DEFAULT_PAGE,
  header: { left: [], center: [], right: [] },
  footer: { left: [], center: [{ text: "Page ", marks: [] }], right: [] },
  pageNumber: true,
  fontFamily: "Inter",
  fontSize: 11,
  lineSpacing: 1.5,
  language: "en",
};

/** Default body for a brand-new Word document. */
export const DEFAULT_WORD_BODY: WordBody = {
  format: "word",
  blocks: [
    {
      id: "block-heading-1",
      type: "heading",
      level: 1,
      runs: [{ text: "Untitled document", marks: [] }],
      alignment: "left",
    },
    {
      id: "block-paragraph-1",
      type: "paragraph",
      runs: [{ text: "Start writing here…", marks: [] }],
      alignment: "left",
      indent: 0,
    },
  ],
  settings: DEFAULT_SETTINGS,
};

/** Type guard for a Word body. */
export function isWordBody(body: unknown): body is WordBody {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as { format?: unknown; blocks?: unknown; settings?: unknown };
  if (candidate.format !== "word") return false;
  if (!Array.isArray(candidate.blocks)) return false;
  if (typeof candidate.settings !== "object" || candidate.settings === null) return false;
  return true;
}

/** Coerces an unknown body into a Word body, falling back to the default. */
export function asWordBody(body: unknown): WordBody {
  if (isWordBody(body)) return body;
  return {
    ...DEFAULT_WORD_BODY,
    blocks: [...DEFAULT_WORD_BODY.blocks],
    settings: { ...DEFAULT_SETTINGS, page: { ...DEFAULT_PAGE } },
  };
}
