/**
 * Maps document font families onto embeddable PDF fonts.
 *
 * pdf-lib's standard 14 fonts cover the metric-compatible equivalents of the
 * fonts used by the overwhelming majority of Office documents (Arial/Helvetica,
 * Times/Georgia, Courier/Consolas). They are WinAnsi-encoded, so text outside
 * that range is transliterated rather than silently dropped.
 */

import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";

export type FontStyleKey = "regular" | "bold" | "italic" | "boldItalic";

type FontClass = "sans" | "serif" | "mono";

const SERIF_PATTERN =
  /(times|georgia|garamond|cambria|book|roman|palatino|minion|serif|constantia|caslon|baskerville|didot|merriweather|playfair|lora|source serif|pt serif|noto serif|libre baskerville)/i;
const MONO_PATTERN = /(mono|courier|consol|menlo|monaco|typewriter|code|source code)/i;

const STANDARD_FONTS: Record<FontClass, Record<FontStyleKey, StandardFonts>> = {
  sans: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique,
  },
  serif: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic,
  },
  mono: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique,
  },
};

export function classifyFamily(family: string): FontClass {
  if (MONO_PATTERN.test(family)) return "mono";
  if (SERIF_PATTERN.test(family)) return "serif";
  return "sans";
}

export function styleKey(bold: boolean, italic: boolean): FontStyleKey {
  if (bold && italic) return "boldItalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "regular";
}

/**
 * Lazily embeds and caches PDF fonts for a document.
 *
 * Embedding each standard font once keeps output small and avoids pdf-lib
 * re-encoding the same font program per run.
 */
export class FontRegistry {
  private readonly cache = new Map<string, PDFFont>();

  constructor(private readonly document: PDFDocument) {}

  async get(family: string, bold: boolean, italic: boolean): Promise<PDFFont> {
    const fontClass = classifyFamily(family);
    const key = `${fontClass}:${styleKey(bold, italic)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const font = await this.document.embedFont(STANDARD_FONTS[fontClass][styleKey(bold, italic)], {
      subset: false,
    });
    this.cache.set(key, font);
    return font;
  }
}

/* -------------------------------------------------------------------------- */
/* Text sanitisation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Characters outside WinAnsi that have a faithful ASCII/WinAnsi equivalent.
 * Without this, common Office punctuation would throw during encoding.
 */
const TRANSLITERATIONS: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201A": ",", "\u201B": "'",
  "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"',
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-", "\u2015": "-",
  "\u2026": "...", "\u2032": "'", "\u2033": '"',
  "\u2039": "<", "\u203A": ">", "\u2044": "/",
  "\u00A0": " ", "\u2002": " ", "\u2003": " ", "\u2004": " ", "\u2005": " ",
  "\u2006": " ", "\u2007": " ", "\u2008": " ", "\u2009": " ", "\u200A": " ",
  "\u202F": " ", "\u205F": " ", "\u3000": " ",
  "\u200B": "", "\u200C": "", "\u200D": "", "\uFEFF": "",
  "\u2022": "\u2022", "\u25CF": "\u2022", "\u25E6": "\u00B0", "\u25AA": "\u2022",
  "\u2043": "-", "\u2219": "\u2022", "\u00B7": "\u00B7",
  "\u2192": "->", "\u2190": "<-", "\u2194": "<->", "\u21D2": "=>",
  "\u2264": "<=", "\u2265": ">=", "\u2260": "!=", "\u00D7": "x", "\u00F7": "/",
  "\u2122": "(TM)", "\u2117": "(P)", "\u2120": "(SM)",
  "\u0192": "f", "\u02C6": "^", "\u02DC": "~",
  "\u2211": "S", "\u220F": "P", "\u221A": "sqrt", "\u221E": "inf",
  "\u2248": "~", "\u2261": "=", "\u00B1": "+/-",
  "\uF0B7": "\u2022", "\uF0A7": "\u2022", "\uF06C": "\u2022", "\uF0D8": "\u2022",
};

/** WinAnsi (CP1252) covers Latin-1 plus a handful of code points in 0x80-0x9F. */
const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function isEncodable(codePoint: number): boolean {
  if (codePoint === 0x0a || codePoint === 0x09) return true;
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true;
  return WIN_ANSI_EXTRA.has(codePoint);
}

/**
 * Makes text safe for WinAnsi encoding.
 *
 * Unsupported glyphs (CJK, emoji, most symbol fonts) are replaced with a
 * placeholder so the surrounding document still converts, instead of failing
 * the whole job on one character.
 */
export function sanitizeForPdf(text: string): string {
  let output = "";

  for (const character of text) {
    const replacement = TRANSLITERATIONS[character];
    if (replacement !== undefined) {
      output += replacement;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    if (isEncodable(codePoint)) {
      output += character;
    } else {
      // Keep spacing plausible rather than deleting the glyph outright.
      output += "?";
    }
  }

  return output;
}
