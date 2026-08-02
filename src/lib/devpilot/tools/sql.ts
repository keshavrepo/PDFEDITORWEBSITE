/**
 * SQL tool.
 *
 * Format, beautify, minify and keyword-highlight a SQL string.
 * The formatter is a small dependency-free implementation that
 * inserts newlines after the standard top-level keywords and
 * indents the body of brackets.
 *
 * Recognised keyword list covers the union of statements the rest
 * of the LaunchStack editor surfaces expect to round-trip.
 */

const SQL_KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "BY",
  "ORDER",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "TABLE",
  "INDEX",
  "VIEW",
  "DROP",
  "ALTER",
  "ADD",
  "COLUMN",
  "CONSTRAINT",
  "PRIMARY",
  "KEY",
  "FOREIGN",
  "REFERENCES",
  "UNIQUE",
  "NOT",
  "NULL",
  "DEFAULT",
  "CHECK",
  "AND",
  "OR",
  "IN",
  "IS",
  "LIKE",
  "BETWEEN",
  "EXISTS",
  "DISTINCT",
  "AS",
  "ON",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "OUTER",
  "FULL",
  "CROSS",
  "UNION",
  "ALL",
  "INTERSECT",
  "EXCEPT",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "TRANSACTION",
  "IF",
]);

const MAJOR_KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "TABLE",
  "INDEX",
  "VIEW",
  "DROP",
  "ALTER",
  "ADD",
  "COLUMN",
  "CONSTRAINT",
  "PRIMARY KEY",
  "FOREIGN KEY",
  "REFERENCES",
  "UNIQUE",
  "DEFAULT",
  "CHECK",
  "AND",
  "OR",
  "IN",
  "IS",
  "LIKE",
  "BETWEEN",
  "EXISTS",
  "DISTINCT",
  "ON",
  "JOIN",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "OUTER JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "UNION",
  "ALL",
  "INTERSECT",
  "EXCEPT",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "TRANSACTION",
]);

interface SqlToken {
  type: "word" | "string" | "number" | "punct" | "ws" | "comment" | "eof";
  value: string;
}

/** Tokenise a SQL string. Handles strings, numbers, identifiers, comments. */
function tokenize(input: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j]!)) j += 1;
      tokens.push({ type: "ws", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "-" && input[i + 1] === "-") {
      let j = i + 2;
      while (j < input.length && input[j] !== "\n") j += 1;
      tokens.push({ type: "comment", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < input.length) {
        if (input[j] === quote) {
          if (input[j + 1] === quote) {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        if (input[j] === "\\" && j + 1 < input.length) {
          j += 2;
          continue;
        }
        j += 1;
      }
      tokens.push({ type: "string", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[0-9.eE+\-]/.test(input[j]!)) j += 1;
      tokens.push({ type: "number", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j]!)) j += 1;
      const value = input.slice(i, j);
      const upper = value.toUpperCase();
      tokens.push({
        type: SQL_KEYWORDS.has(upper) ? "word" : "word",
        value,
      });
      i = j;
      continue;
    }
    if ("();,*=".includes(ch)) {
      tokens.push({ type: "punct", value: ch });
      i += 1;
      continue;
    }
    tokens.push({ type: "punct", value: ch });
    i += 1;
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

export interface SqlFormatResult {
  ok: boolean;
  formatted: string;
  error: string | null;
}

/** Format / beautify a SQL string. */
export function formatSql(
  input: string,
  options: { indent?: number; uppercase?: boolean } = {}
): SqlFormatResult {
  const tokens = tokenize(input ?? "");
  const indentUnit = " ".repeat(Math.max(0, Math.min(8, options.indent ?? 2)));
  const shouldUppercase = options.uppercase !== false;
  const out: string[] = [];
  const stack: number[] = [0];
  let lastWasNewline = true;
  let pending = "";

  function flushPending() {
    if (pending) {
      out.push(pending);
      pending = "";
    }
  }

  function newline(level: number) {
    flushPending();
    out.push("\n" + indentUnit.repeat(level));
    lastWasNewline = true;
  }

  function pushToken(value: string) {
    flushPending();
    if (lastWasNewline) {
      out.push(value);
      lastWasNewline = false;
    } else {
      out.push(" " + value);
      lastWasNewline = false;
    }
  }

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.type === "eof") break;
    if (token.type === "ws") {
      i += 1;
      continue;
    }
    if (token.type === "comment") {
      flushPending();
      if (!lastWasNewline) out.push("\n");
      out.push(indentUnit.repeat(stack[stack.length - 1]!) + token.value.trimEnd());
      out.push("\n");
      lastWasNewline = true;
      i += 1;
      continue;
    }
    if (token.type === "string" || token.type === "number") {
      pushToken(token.value);
      i += 1;
      continue;
    }
    if (token.type === "punct") {
      if (token.value === "(") {
        flushPending();
        stack.push(stack[stack.length - 1]! + 1);
        out.push("(");
        lastWasNewline = false;
        i += 1;
        continue;
      }
      if (token.value === ")") {
        flushPending();
        stack.pop();
        out.push(")");
        lastWasNewline = false;
        i += 1;
        continue;
      }
      if (token.value === ",") {
        flushPending();
        out.push(",");
        newline(stack[stack.length - 1]!);
        i += 1;
        continue;
      }
      if (token.value === ";" || token.value === "*") {
        // `*` is a wildcard; emit it inline. `;` ends the statement.
        if (token.value === ";") {
          flushPending();
          out.push(";");
          newline(0);
        } else {
          pushToken(token.value);
        }
        i += 1;
        continue;
      }
      pushToken(token.value);
      i += 1;
      continue;
    }
    if (token.type === "word") {
      const upper = token.value.toUpperCase();
      const next = tokens[i + 1];
      const isBy = upper === "BY" && next && next.type === "word" &&
        (next.value.toUpperCase() === "ORDER" || next.value.toUpperCase() === "GROUP");
      const isKey = upper === "KEY" && next && next.type === "word" &&
        (next.value.toUpperCase() === "PRIMARY" || next.value.toUpperCase() === "FOREIGN");
      const isJoin = upper === "JOIN" && next && next.type === "word" &&
        ["INNER", "LEFT", "RIGHT", "OUTER", "FULL", "CROSS"].includes(next.value.toUpperCase());
      const word = shouldUppercase ? upper : token.value;

      if (MAJOR_KEYWORDS.has(upper) && !isBy && !isKey && !isJoin) {
        newline(stack[stack.length - 1]!);
        out.push(word);
        out.push(" ");
        pending = "";
        lastWasNewline = false;
        i += 1;
        continue;
      }
      if (isBy || isKey || isJoin) {
        newline(stack[stack.length - 1]!);
        out.push(shouldUppercase ? upper : token.value);
        if (next) {
          out.push(" ");
          const follow = shouldUppercase ? next.value.toUpperCase() : next.value;
          out.push(follow);
          i += 2;
        } else {
          i += 1;
        }
        lastWasNewline = false;
        continue;
      }
      // Minor keywords (AND, OR) stay inline.
      if (!lastWasNewline) {
        out.push(" ");
      }
      out.push(word);
      lastWasNewline = false;
      i += 1;
    }
  }

  flushPending();
  return { ok: true, formatted: out.join("").replace(/\n{3,}/g, "\n\n").trim() + "\n", error: null };
}

/** Minify a SQL string by removing comments and collapsing whitespace. */
export function minifySql(input: string): SqlFormatResult {
  const tokens = tokenize(input ?? "");
  const out: string[] = [];
  for (const token of tokens) {
    if (token.type === "ws" || token.type === "comment") continue;
    if (token.type === "punct" && token.value === "*") {
      // `*` is a wildcard; emit it without spaces.
      out.push("*");
      continue;
    }
    if (out.length === 0) {
      out.push(token.value);
      continue;
    }
    const prev = out[out.length - 1]!;
    const needsSpace =
      !prev.endsWith("(") &&
      !prev.endsWith(",") &&
      token.value !== "," &&
      token.value !== ")" &&
      token.value !== ";";
    if (needsSpace) out.push(" ");
    out.push(token.value);
  }
  return { ok: true, formatted: out.join("").trim(), error: null };
}

export interface SqlHighlightToken {
  text: string;
  kind: "keyword" | "string" | "number" | "comment" | "punct" | "identifier";
}

export function highlightSql(input: string): SqlHighlightToken[] {
  const tokens = tokenize(input ?? "");
  const out: SqlHighlightToken[] = [];
  for (const token of tokens) {
    if (token.type === "eof") continue;
    if (token.type === "ws") {
      out.push({ text: token.value, kind: "punct" });
      continue;
    }
    if (token.type === "string") {
      out.push({ text: token.value, kind: "string" });
      continue;
    }
    if (token.type === "number") {
      out.push({ text: token.value, kind: "number" });
      continue;
    }
    if (token.type === "comment") {
      out.push({ text: token.value, kind: "comment" });
      continue;
    }
    if (token.type === "punct") {
      out.push({ text: token.value, kind: "punct" });
      continue;
    }
    if (token.type === "word") {
      const upper = token.value.toUpperCase();
      if (SQL_KEYWORDS.has(upper)) {
        out.push({ text: token.value, kind: "keyword" });
        continue;
      }
      out.push({ text: token.value, kind: "identifier" });
    }
  }
  return out;
}
