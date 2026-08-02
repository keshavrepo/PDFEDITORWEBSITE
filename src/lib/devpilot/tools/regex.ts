/**
 * Regex tool.
 *
 * Live testing of a regular expression against a text input. Returns
 * the matches (full + capture groups), a replace preview and a
 * list of common preset patterns the user can pick from.
 *
 * All matching happens in the browser. Invalid patterns surface as
 * a friendly error.
 */

export interface RegexMatch {
  /** Match index, 0-based. */
  index: number;
  /** Original match text. */
  match: string;
  /** Zero-based start offset. */
  start: number;
  /** End offset (exclusive). */
  end: number;
  /** Capture groups, in declaration order. */
  groups: Array<{ name?: string; value: string; start: number; end: number }>;
}

export interface RegexTestResult {
  ok: boolean;
  matches: RegexMatch[];
  /** Replaced output for the replace tab. */
  replaced: string | null;
  /** Compile error string, or `null` on success. */
  error: string | null;
}

const FLAGS_PATTERN = /^[gimsuy]*$/;

export function compileRegex(
  pattern: string,
  flags: string
): { ok: true; regex: RegExp } | { ok: false; error: string } {
  if (pattern === "") return { ok: false, error: "Pattern is empty" };
  if (flags && !FLAGS_PATTERN.test(flags)) {
    return { ok: false, error: "Flags must be one or more of g, i, m, s, u, y" };
  }
  try {
    return { ok: true, regex: new RegExp(pattern, flags) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid pattern" };
  }
}

export function testRegex(
  pattern: string,
  flags: string,
  input: string,
  replacement: string
): RegexTestResult {
  const compiled = compileRegex(pattern, flags);
  if (!compiled.ok) {
    return { ok: false, matches: [], replaced: null, error: compiled.error };
  }
  const regex = compiled.regex;
  const matches: RegexMatch[] = [];
  if (regex.global || regex.sticky) {
    let from = 0;
    let safety = 0;
    while (safety < 5000) {
      const result = regex.exec(input);
      if (!result) break;
      const start = result.index;
      const end = start + result[0].length;
      const groups: RegexMatch["groups"] = [];
      const resultIndices = (result as RegExpExecArray & { indices?: RegExpIndicesArray }).indices;
      for (let i = 1; i < result.length; i += 1) {
        const groupText = result[i] ?? "";
        const indexedStart = resultIndices?.[i]?.[0];
        const groupStart =
          typeof indexedStart === "number"
            ? start + indexedStart
            : (() => {
                const offset = input.slice(start, end).indexOf(groupText);
                return offset === -1 ? start : start + offset;
              })();
        const groupEnd = groupStart + groupText.length;
        groups.push({ value: groupText, start: groupStart, end: groupEnd });
        if (groupText === "" && regex.lastIndex === from) {
          // Avoid an infinite loop on zero-width matches.
          regex.lastIndex += 1;
          from = regex.lastIndex;
          continue;
        }
      }
      matches.push({ index: matches.length, match: result[0], start, end, groups });
      from = end;
      if (regex.lastIndex < from) regex.lastIndex = from;
      safety += 1;
    }
  } else {
    const result = regex.exec(input);
    if (result) {
      const start = result.index;
      const end = start + result[0].length;
      const groups: RegexMatch["groups"] = [];
      for (let i = 1; i < result.length; i += 1) {
        const groupText = result[i] ?? "";
        const offset = input.slice(start, end).indexOf(groupText);
        const groupStart = offset === -1 ? start : start + offset;
        groups.push({ value: groupText, start: groupStart, end: groupStart + groupText.length });
      }
      matches.push({ index: 0, match: result[0], start, end, groups });
    }
  }
  let replaced: string | null = null;
  if (replacement !== "") {
    try {
      replaced = input.replace(regex, replacement);
    } catch (err) {
      return { ok: false, matches, replaced: null, error: err instanceof Error ? err.message : "Replace failed" };
    }
  } else {
    replaced = input.replace(regex, (m) => `[${m}]`);
  }
  return { ok: true, matches, replaced, error: null };
}

export interface RegexPreset {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  description: string;
  sample: string;
}

export const REGEX_PRESETS: RegexPreset[] = [
  {
    id: "email",
    name: "Email",
    pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    flags: "g",
    description: "Match a basic email address.",
    sample: "Reach out to hello@example.com or support@launchstack.app for more.",
  },
  {
    id: "url",
    name: "URL",
    pattern: "https?:\\/\\/[^\\s/$.?#].[^\\s]*",
    flags: "gi",
    description: "Match HTTP and HTTPS URLs.",
    sample: "Visit https://launchstack.app or http://example.org for details.",
  },
  {
    id: "ipv4",
    name: "IPv4",
    pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    flags: "g",
    description: "Match dotted-quad IPv4 addresses.",
    sample: "Hosts: 10.0.0.1, 192.168.1.42, 8.8.8.8",
  },
  {
    id: "iso-date",
    name: "ISO date",
    pattern: "\\d{4}-\\d{2}-\\d{2}",
    flags: "g",
    description: "Match an ISO 8601 calendar date.",
    sample: "Released 2026-08-02, last updated 2026-07-31.",
  },
  {
    id: "time",
    name: "Time",
    pattern: "\\b([01]?\\d|2[0-3]):[0-5]\\d\\b",
    flags: "g",
    description: "Match 24-hour clock times.",
    sample: "Office hours 09:00 to 17:30, lunch at 12:15.",
  },
  {
    id: "hex",
    name: "Hex colour",
    pattern: "#(?:[0-9a-fA-F]{3}){1,2}\\b",
    flags: "g",
    description: "Match 3- or 6-digit hex colour codes.",
    sample: "Primary #0EA5E9, accent #f43, text #111111.",
  },
  {
    id: "semver",
    name: "Semver",
    pattern: "\\b\\d+\\.\\d+\\.\\d+(?:-[A-Za-z0-9.]+)?(?:\\+[A-Za-z0-9.-]+)?\\b",
    flags: "g",
    description: "Match a Semantic Versioning tag.",
    sample: "v1.2.3, 2.0.0-rc.1, 0.0.0+build.42",
  },
  {
    id: "slug",
    name: "Slug",
    pattern: "\\b[a-z0-9]+(?:-[a-z0-9]+)*\\b",
    flags: "g",
    description: "Match a URL slug.",
    sample: "blog/launching-devpilot, image-to-pdf, /docs/getting-started",
  },
];
