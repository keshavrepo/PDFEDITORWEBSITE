/**
 * Minimal Excel number-format renderer.
 *
 * Excel stores raw numbers and a format code; the text a user sees is produced
 * by applying that code. Reproducing the full grammar is out of scope, so this
 * covers the constructs that actually appear in real spreadsheets: thousands
 * separators, fixed decimals, percentages, currency prefixes, dates and times.
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Strips literals and colour/condition sections from a format code. */
function stripDecorations(format: string): string {
  return format
    // Bracketed sections are colours ([Red]) or conditions ([>100]).
    .replace(/\[[^\]]*\]/g, "")
    // Quoted literals and escaped characters.
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "");
}

/** True when a format code renders a date or time rather than a number. */
export function isDateFormat(format: string): boolean {
  if (!format || format === "General") return false;
  const cleaned = stripDecorations(format);
  // `m` is minutes when adjacent to h/s, but any of y/d/h/s implies date-time.
  return /[ydhs]/i.test(cleaned) && /[ymdhs]/i.test(cleaned);
}

function pad(value: number, length = 2): string {
  return String(Math.abs(value)).padStart(length, "0");
}

function formatDate(serial: number, format: string): string {
  const wholeDays = Math.floor(serial);
  const milliseconds = Math.round((serial - wholeDays) * 86_400_000);
  const date = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86_400_000 + milliseconds);

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const weekday = date.getUTCDay();
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  const cleaned = stripDecorations(format);
  const twelveHour = /am\/pm|a\/p/i.test(cleaned);
  const suffix = hours < 12 ? "AM" : "PM";
  if (twelveHour) hours = hours % 12 || 12;

  // Tokens are matched longest-first so `mmmm` wins over `mm`.
  const tokens = /yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm|a\/p/gi;
  let previousWasHour = false;

  const output = cleaned.replace(tokens, (token) => {
    const lower = token.toLowerCase();
    switch (lower) {
      case "yyyy": return String(year);
      case "yy": return pad(year % 100);
      case "mmmm": return MONTHS_LONG[month];
      case "mmm": return MONTHS_SHORT[month];
      case "mm":
        // `mm` means minutes directly after an hour token.
        return previousWasHour ? pad(minutes) : pad(month + 1);
      case "m":
        return previousWasHour ? String(minutes) : String(month + 1);
      case "dddd": return DAYS_LONG[weekday];
      case "ddd": return DAYS_SHORT[weekday];
      case "dd": return pad(day);
      case "d": return String(day);
      case "hh": previousWasHour = true; return pad(hours);
      case "h": previousWasHour = true; return String(hours);
      case "ss": return pad(seconds);
      case "s": return String(seconds);
      case "am/pm":
      case "a/p": return suffix;
      default: return token;
    }
  });

  // Re-scan so `previousWasHour` is set before the minute token is replaced.
  if (/h/i.test(cleaned) && /m/i.test(cleaned)) {
    return cleaned
      .replace(/hh/gi, pad(hours))
      .replace(/(?<=:)mm/gi, pad(minutes))
      .replace(/(?<!:)\bh\b/gi, String(hours))
      .replace(/yyyy/gi, String(year))
      .replace(/yy/gi, pad(year % 100))
      .replace(/mmmm/gi, MONTHS_LONG[month])
      .replace(/mmm/gi, MONTHS_SHORT[month])
      .replace(/dd/gi, pad(day))
      .replace(/(?<![a-z])d(?![a-z])/gi, String(day))
      .replace(/ss/gi, pad(seconds))
      .replace(/mm/gi, pad(month + 1))
      .replace(/am\/pm|a\/p/gi, suffix)
      .trim();
  }

  return output.trim();
}

function formatNumber(value: number, format: string): string {
  const cleaned = stripDecorations(format).trim();

  // Percentages scale the value before formatting.
  const isPercent = cleaned.includes("%");
  const scaled = isPercent ? value * 100 : value;

  // Decimal places come from the digits after the decimal point in the code.
  const decimalMatch = /\.([0#?]+)/.exec(cleaned);
  const decimals = decimalMatch ? decimalMatch[1].length : 0;
  const useGrouping = cleaned.includes("#,##") || cleaned.includes("#,#");

  let text = Math.abs(scaled).toFixed(decimals);
  if (useGrouping) {
    const [whole, fraction] = text.split(".");
    text = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
  }

  // Currency symbols appear before the first digit placeholder.
  const currency = /^[^#0]*?([$£€¥₹])/.exec(format);
  const prefix = currency ? currency[1] : "";
  const sign = scaled < 0 ? "-" : "";

  return `${sign}${prefix}${text}${isPercent ? "%" : ""}`;
}

/** Renders a raw cell value using its Excel number format. */
export function formatCellValue(value: number, format: string): string {
  if (!format || format === "General") {
    // General shows up to 11 significant digits without trailing zeros.
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toPrecision(11)));
  }

  // Only the positive section is applied; negative handling is folded into
  // `formatNumber` so bracketed negative sections do not leak into output.
  const section = format.split(";")[0];

  try {
    return isDateFormat(section) ? formatDate(value, section) : formatNumber(value, section);
  } catch {
    return String(value);
  }
}
