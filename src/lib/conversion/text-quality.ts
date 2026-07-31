/**
 * Text-extraction quality analysis.
 *
 * Some PDFs — Election Commission forms, revenue records, older Hindi
 * documents — draw text with legacy 8-bit fonts such as Kruti Dev, Chanakya or
 * DevLys. Those fonts map byte values to Devanagari glyph shapes, so the bytes
 * stored in the file spell nothing meaningful: "भारत सरकार" is stored as
 * "Hkkjr ljdkj".
 *
 * The bytes are perfectly valid ASCII, so a naive "is this valid Unicode?"
 * check passes and the converter would emit a Word document full of garbage.
 * This module therefore combines several independent signals to decide whether
 * extracted text is genuinely readable, and reports OCR as the honest
 * alternative when it is not.
 */

import type { ExtractedPage, ExtractedTextItem } from "./pdf/pdf-extractor";

/** How a document should be converted. */
export type ConversionStrategy = "native" | "ocr-required";

export type QualityIssue =
  | "legacy-encoded-font"
  | "no-embedded-unicode-mapping"
  | "glyph-garbage"
  | "invalid-unicode"
  | "no-text-layer"
  | "scanned-document";

export interface TextQualityReport {
  strategy: ConversionStrategy;
  /** 0-1, where 1 means confidently readable text. */
  confidence: number;
  issues: QualityIssue[];
  /** Characters of extractable text found across the document. */
  characterCount: number;
  /** True when pages are mostly images with little or no text. */
  looksScanned: boolean;
  /** Font families that triggered a legacy-encoding match. */
  legacyFonts: string[];
  /** Short, user-facing explanation of the decision. */
  summary: string;
}

/**
 * Font families known to store Devanagari (and other Indic) text as 8-bit
 * glyph indices rather than Unicode.
 *
 * Matching is done on a normalised name so subset prefixes, version numbers and
 * separators do not defeat it (`ABCDEF+KrutiDev010Bold` -> `krutidev010bold`).
 */
const LEGACY_FONT_PATTERNS: RegExp[] = [
  /krutidev/,
  /kruti/,
  /devlys/,
  /chanakya/,
  /shreelipi|shree ?lipi/,
  /shivaji/,
  /agra(?!ndir)/,
  /walkman ?chanakya/,
  /^(?:ajay|amber|arjun|richa|priya|sanskrit ?99)/,
  /aparajita ?legacy/,
  /dvb[-_ ]?tt|dv[-_ ]?tt(?:surekh|yogesh|divyae|ttyogesh)/,
  /^bhasha/,
  /millennium/,
  /^ism[-_ ]/,
  /apsdv|akrutidev|akruti/,
  /^gist[-_ ]?(?:dv|or|pn|bn|gj|tm|tl|kn|ml)/,
  /subak|susha/,
  /^xdvng|xdv/,
  /jagran|naidunia/,
  /^mangal ?legacy/,
];

/**
 * Scripts whose text is meaningless when rendered through a legacy 8-bit font.
 * Used to detect the "looks like Latin but should be Indic" case.
 */
const INDIC_RANGE = /[\u0900-\u0DFF]/;

/** Unicode replacement, unassigned and private-use characters. */
const REPLACEMENT_CHARACTER = /\uFFFD/;
const PRIVATE_USE = /[\uE000-\uF8FF]/;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/** Below this, a page is treated as having no meaningful text layer. */
const MIN_CHARACTERS_PER_PAGE = 12;
/** A document with fewer characters than this overall is not worth converting. */
const MIN_DOCUMENT_CHARACTERS = 20;

export function normalizeFontName(name: string): string {
  return name
    .replace(/^[A-Z]{6}\+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** True when a font family is a known legacy glyph-encoded font. */
export function isLegacyEncodedFont(fontFamily: string): boolean {
  const normalized = normalizeFontName(fontFamily);
  if (!normalized) return false;
  return LEGACY_FONT_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Heuristic for "this looks like Latin letters but reads as nonsense".
 *
 * Legacy Devanagari fonts produce very distinctive output: dense runs of
 * lowercase letters with unusual consonant clusters and stray punctuation
 * (`Hkkjr ljdkj`, `dk;kZy;`, `la[;k`). Ordinary English does not look like
 * this, so the check is deliberately conservative and requires several
 * independent oddities before flagging.
 */
export function scoreGlyphGarbage(text: string): number {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 24) return 0;

  // Only Latin-script text can be legacy-encoded Indic; real Indic text is fine.
  if (INDIC_RANGE.test(cleaned)) return 0;

  const words = cleaned.split(/\s+/).filter((word) => /[a-zA-Z]/.test(word));
  if (words.length < 4) return 0;

  let suspicious = 0;
  for (const word of words) {
    const letters = word.replace(/[^a-zA-Z]/g, "");
    if (letters.length < 3) continue;

    const lower = letters.toLowerCase();
    const vowels = (lower.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowels / lower.length;

    // Punctuation embedded inside a word (`dk;kZy;`, `la[;k`).
    const innerPunctuation = /[a-zA-Z][;:[\]{}<>^~`|\\/@#$%&*+=][a-zA-Z]/.test(word);
    // Case flips mid-word (`kZ`, `jktLo`) that natural text rarely produces.
    const midWordCaps = /[a-z][A-Z]/.test(letters) && !/^[A-Z][a-z]+$/.test(letters);
    // Consonant clusters that are implausible in English.
    const hardCluster = /[bcdfghjklmnpqrstvwxz]{4,}/.test(lower);
    // Legacy Devanagari output is vowel-poor because vowels become matras.
    const vowelStarved = lower.length >= 4 && vowelRatio < 0.2;

    const flags =
      Number(innerPunctuation) + Number(midWordCaps) + Number(hardCluster) + Number(vowelStarved);
    if (flags >= 1) suspicious++;
  }

  return suspicious / words.length;
}

/** Fraction of characters that can never render meaningfully. */
export function scoreInvalidUnicode(text: string): number {
  if (!text.length) return 0;
  let invalid = 0;
  for (const character of text) {
    if (
      REPLACEMENT_CHARACTER.test(character) ||
      PRIVATE_USE.test(character) ||
      CONTROL_CHARACTERS.test(character)
    ) {
      invalid++;
    }
  }
  return invalid / text.length;
}

/** Per-item signals collected during extraction. */
export interface FontQualitySignal {
  fontFamily: string;
  /** pdf.js could not find an embedded font program. */
  missingFile: boolean;
  /** Font declares a symbolic (non-standard) encoding. */
  symbolic: boolean;
  /** The font provides a usable ToUnicode CMap. */
  hasUnicodeMap: boolean;
  /** Characters drawn with this font. */
  characterCount: number;
}

export interface QualityInput {
  pages: ExtractedPage[];
  fontSignals: FontQualitySignal[];
}

function collectText(pages: ExtractedPage[]): string {
  const parts: string[] = [];
  for (const page of pages) {
    for (const item of page.items) parts.push(item.text);
  }
  return parts.join(" ");
}

function countImageArea(page: ExtractedPage): number {
  return page.images.reduce((sum, image) => sum + image.width * image.height, 0);
}

/**
 * Decides how a PDF should be converted.
 *
 * The rule is deliberately biased towards honesty: when the text layer cannot
 * be trusted, the converter reports that OCR is required instead of producing
 * a document full of garbage.
 */
export function analyzeTextQuality({ pages, fontSignals }: QualityInput): TextQualityReport {
  const issues: QualityIssue[] = [];
  const text = collectText(pages);
  const characterCount = text.replace(/\s/g, "").length;

  /* ---------------------------------------------------------------------- */
  /* 1. No usable text layer at all -> scanned document                      */
  /* ---------------------------------------------------------------------- */

  const pagesWithText = pages.filter(
    (page) => page.items.reduce((sum, item) => sum + item.text.trim().length, 0) >= MIN_CHARACTERS_PER_PAGE
  ).length;
  const imageHeavyPages = pages.filter((page) => {
    const pageArea = page.width * page.height;
    return pageArea > 0 && countImageArea(page) > pageArea * 0.45;
  }).length;

  const looksScanned =
    pages.length > 0 &&
    pagesWithText === 0 &&
    (imageHeavyPages > 0 || characterCount < MIN_DOCUMENT_CHARACTERS);

  if (looksScanned) {
    issues.push(imageHeavyPages > 0 ? "scanned-document" : "no-text-layer");
    return {
      strategy: "ocr-required",
      confidence: 0,
      issues,
      characterCount,
      looksScanned: true,
      legacyFonts: [],
      summary:
        imageHeavyPages > 0
          ? "This PDF contains scanned page images with no selectable text."
          : "This PDF has no extractable text layer.",
    };
  }

  if (characterCount < MIN_DOCUMENT_CHARACTERS) {
    issues.push("no-text-layer");
    return {
      strategy: "ocr-required",
      confidence: 0,
      issues,
      characterCount,
      looksScanned: false,
      legacyFonts: [],
      summary: "This PDF has almost no extractable text.",
    };
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Legacy glyph-encoded fonts                                           */
  /* ---------------------------------------------------------------------- */

  const legacyFonts = new Set<string>();
  let legacyCharacters = 0;
  let unmappedCharacters = 0;
  let totalFontCharacters = 0;

  for (const signal of fontSignals) {
    totalFontCharacters += signal.characterCount;

    if (isLegacyEncodedFont(signal.fontFamily)) {
      legacyFonts.add(signal.fontFamily);
      legacyCharacters += signal.characterCount;
      continue;
    }

    // A symbolic font with no embedded program and no ToUnicode map cannot be
    // decoded reliably: the byte values are glyph indices, not characters.
    if (signal.symbolic && signal.missingFile && !signal.hasUnicodeMap) {
      unmappedCharacters += signal.characterCount;
    }
  }

  const legacyRatio = totalFontCharacters ? legacyCharacters / totalFontCharacters : 0;
  const unmappedRatio = totalFontCharacters ? unmappedCharacters / totalFontCharacters : 0;

  /* ---------------------------------------------------------------------- */
  /* 3. Text-shape analysis                                                  */
  /* ---------------------------------------------------------------------- */

  const garbageRatio = scoreGlyphGarbage(text);
  const invalidRatio = scoreInvalidUnicode(text);

  /* ---------------------------------------------------------------------- */
  /* 4. Decision                                                             */
  /* ---------------------------------------------------------------------- */

  // A known legacy font is conclusive on its own.
  if (legacyRatio > 0.15) issues.push("legacy-encoded-font");
  // Unmapped symbolic fonts are conclusive when they dominate and the text
  // also fails the shape test — either alone produces too many false positives.
  if (unmappedRatio > 0.4 && garbageRatio > 0.3) issues.push("no-embedded-unicode-mapping");
  if (garbageRatio > 0.55) issues.push("glyph-garbage");
  if (invalidRatio > 0.12) issues.push("invalid-unicode");

  const strategy: ConversionStrategy = issues.length ? "ocr-required" : "native";

  // Confidence degrades with each independent signal.
  const penalty =
    Math.min(1, legacyRatio * 1.4) * 0.55 +
    Math.min(1, unmappedRatio) * 0.2 +
    Math.min(1, garbageRatio) * 0.3 +
    Math.min(1, invalidRatio * 4) * 0.25;
  const confidence = Math.max(0, Math.min(1, 1 - penalty));

  return {
    strategy,
    confidence: Math.round(confidence * 100) / 100,
    issues,
    characterCount,
    looksScanned: false,
    legacyFonts: [...legacyFonts],
    summary:
      strategy === "native"
        ? "Text layer is readable and can be converted directly."
        : legacyFonts.size
          ? `Text is drawn with ${legacyFonts.size > 1 ? "legacy fonts" : "a legacy font"} (${[...legacyFonts].join(", ")}) that ${legacyFonts.size > 1 ? "store" : "stores"} glyph codes rather than Unicode.`
          : "Text could not be decoded into readable Unicode.",
  };
}

/** Aggregates per-item font usage into the signals used by the analyser. */
export function buildFontSignals(
  items: ExtractedTextItem[],
  fontInfo: Map<string, { missingFile: boolean; symbolic: boolean; hasUnicodeMap: boolean }>
): FontQualitySignal[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.font.family;
    counts.set(key, (counts.get(key) || 0) + item.text.replace(/\s/g, "").length);
  }

  return [...counts].map(([fontFamily, characterCount]) => {
    const info = fontInfo.get(fontFamily);
    return {
      fontFamily,
      characterCount,
      missingFile: info?.missingFile ?? false,
      symbolic: info?.symbolic ?? false,
      hasUnicodeMap: info?.hasUnicodeMap ?? true,
    };
  });
}
