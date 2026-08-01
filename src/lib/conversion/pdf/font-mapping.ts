/**
 * Maps embedded PDF font names onto real Office font families.
 *
 * PDF font names carry a 6-letter subset prefix (`ABCDEF+Arial-BoldMT`) plus
 * style suffixes. Office needs a plain family name, with weight and slant
 * expressed as separate attributes, so both are recovered here.
 */

export interface ResolvedFont {
  family: string;
  bold: boolean;
  italic: boolean;
  monospace: boolean;
  serif: boolean;
}

/** Base-14 and common embedded names mapped to their Office equivalents. */
const FAMILY_ALIASES: Record<string, string> = {
  arial: "Arial",
  arialmt: "Arial",
  arialunicodems: "Arial",
  arialnarrow: "Arial Narrow",
  arialblack: "Arial Black",
  helvetica: "Arial",
  helveticaneue: "Arial",
  liberationsans: "Arial",
  nimbussans: "Arial",
  timesnewroman: "Times New Roman",
  timesnewromanpsmt: "Times New Roman",
  timesnewromanps: "Times New Roman",
  times: "Times New Roman",
  timesroman: "Times New Roman",
  liberationserif: "Times New Roman",
  nimbusroman: "Times New Roman",
  couriernew: "Courier New",
  couriernewpsmt: "Courier New",
  courier: "Courier New",
  liberationmono: "Courier New",
  nimbusmono: "Courier New",
  calibri: "Calibri",
  carlito: "Calibri",
  cambria: "Cambria",
  caladea: "Cambria",
  georgia: "Georgia",
  verdana: "Verdana",
  dejavusans: "DejaVu Sans",
  dejavuserif: "DejaVu Serif",
  dejavusansmono: "DejaVu Sans Mono",
  tahoma: "Tahoma",
  segoeui: "Segoe UI",
  trebuchetms: "Trebuchet MS",
  garamond: "Garamond",
  bookantiqua: "Book Antiqua",
  palatino: "Palatino Linotype",
  palatinolinotype: "Palatino Linotype",
  century: "Century",
  centurygothic: "Century Gothic",
  comicsansms: "Comic Sans MS",
  impact: "Impact",
  symbol: "Symbol",
  zapfdingbats: "Wingdings",
  wingdings: "Wingdings",
  roboto: "Roboto",
  opensans: "Open Sans",
  lato: "Lato",
  montserrat: "Montserrat",
  notosans: "Noto Sans",
  notoserif: "Noto Serif",
  inter: "Inter",
  poppins: "Poppins",
  sourcesanspro: "Source Sans Pro",
  ptsans: "PT Sans",
  ubuntu: "Ubuntu",
};

const BOLD_PATTERN = /(?:^|[-_,\s])(?:bold|black|heavy|semibold|demibold|extrabold|ultrabold|[6-9]00)(?:$|[-_,\s])/i;
const ITALIC_PATTERN = /(?:^|[-_,\s])(?:italic|oblique|it)(?:$|[-_,\s])/i;
const MONO_PATTERN = /(?:mono|courier|consol|typewriter)/i;
const SERIF_PATTERN = /(?:serif|times|georgia|garamond|cambria|book|roman|palatino|minion)/i;

/** Strips the `ABCDEF+` subset tag that PDF producers prepend. */
export function stripSubsetPrefix(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, "");
}

/**
 * Resolves a raw PDF font name into a family plus style attributes.
 *
 * `flags` come from pdf.js and are trusted over name heuristics when present,
 * because subsetted fonts frequently drop style words from the name.
 */
export function resolvePdfFont(
  rawName: string | undefined,
  flags?: { bold?: boolean; italic?: boolean; fallback?: string }
): ResolvedFont {
  const name = stripSubsetPrefix((rawName || "").trim());

  // Split off the style portion: "Arial-BoldMT" or "Arial,Bold".
  const separatorIndex = Math.min(
    ...[name.indexOf("-"), name.indexOf(",")].filter((index) => index > 0).concat([name.length])
  );
  const familyPart = name.slice(0, separatorIndex);
  const stylePart = name.slice(separatorIndex);

  const bold = flags?.bold ?? BOLD_PATTERN.test(`-${stylePart}-`) ?? false;
  const italic = flags?.italic ?? ITALIC_PATTERN.test(`-${stylePart}-`) ?? false;

  // "ArialBoldMT" style names have no separator, so also test the whole string.
  const inlineBold = bold || BOLD_PATTERN.test(`-${name}-`) || /Bold|Black|Heavy/.test(name);
  const inlineItalic = italic || ITALIC_PATTERN.test(`-${name}-`) || /Italic|Oblique/.test(name);

  const normalized = familyPart.toLowerCase().replace(/[^a-z0-9]/g, "");
  const monospace = MONO_PATTERN.test(name);
  const serif = SERIF_PATTERN.test(name);

  let family = FAMILY_ALIASES[normalized];
  if (!family) {
    // Recover a readable family from CamelCase or subset names.
    const cleaned = familyPart
      .replace(/(?:MT|PS|PSMT|Std|Pro|Regular|Roman)$/i, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
    family = cleaned || fallbackFamily(flags?.fallback, monospace, serif);
  }

  return { family, bold: inlineBold, italic: inlineItalic, monospace, serif };
}

function fallbackFamily(fallback: string | undefined, monospace: boolean, serif: boolean): string {
  if (fallback === "monospace" || monospace) return "Courier New";
  if (fallback === "serif" || serif) return "Times New Roman";
  return "Arial";
}
