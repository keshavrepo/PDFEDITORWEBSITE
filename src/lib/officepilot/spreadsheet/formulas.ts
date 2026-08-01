/**
 * OfficePilot Spreadsheet formula engine.
 *
 * A small but real formula evaluator. Supports:
 *
 *  - Cell references: `A1`, `B2`, `$A$1`, ranges like `A1:B5`
 *  - Sheet-qualified references: `Sheet1!A1`, `'Sheet name'!A1:B5`
 *  - Operators: + - * / ^ %, comparisons = <> < > <= >=
 *  - String concatenation with `&`
 *  - Functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, ROUND, ABS,
 *    TODAY, NOW, CONCAT, CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER,
 *    TRIM, SQRT, POWER, MOD, INT, AND, OR, NOT, IFERROR, SUMIF, COUNTIF
 *
 * The engine resolves dependencies so editing a cell invalidates the
 * cached values of any cell that depends on it. Cached values are stored
 * back on the cell; the editor's "no-op autosave" check sees a stable
 * body once everything is resolved.
 */

import {
  cellKey,
  columnLetter,
  fromA1,
  getCell,
  toA1,
  type CellAddress,
  type Sheet,
  type SheetBody,
  type SheetCell,
  type CellValueType,
} from "./schema";
import { getActiveSheet } from "./cells";

/** An evaluator error. */
export class FormulaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "FormulaError";
  }
}

/** A token produced by the tokenizer. */
type Token =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "error"; value: string }
  | { kind: "ref"; value: RefTarget }
  | { kind: "name"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "colon" }
  | { kind: "bang" }
  | { kind: "op"; value: Operator }
  | { kind: "percent" }
  | { kind: "concat" };

type Operator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">=";

/** A target of a reference: a single cell, a range, or a cross-sheet ref. */
export type RefTarget =
  | { kind: "cell"; sheet: string | null; address: CellAddress }
  | { kind: "range"; sheet: string | null; start: CellAddress; end: CellAddress };

/** Resolved value. */
export type ResolvedValue = string | number | boolean | null;

/* -------------------------------------------------------------------------- */
/* Tokenizer                                                                  */
/* -------------------------------------------------------------------------- */

/** Tokenises a formula expression. The leading `=` is optional. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const formula = input.trim();
  if (formula.startsWith("=")) {
    i = 1;
    while (i < formula.length && /[ \t]/.test(formula[i] ?? "")) i++;
  }
  while (i < formula.length) {
    const ch = formula[i] ?? "";
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i++;
      continue;
    }
    if (ch === ":") {
      tokens.push({ kind: "colon" });
      i++;
      continue;
    }
    if (ch === "&") {
      tokens.push({ kind: "concat" });
      i++;
      continue;
    }
    if (ch === "%") {
      tokens.push({ kind: "percent" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      tokens.push({ kind: "op", value: ch as Operator });
      i++;
      continue;
    }
    if (ch === "=" || ch === "<" || ch === ">") {
      const next = formula[i + 1] ?? "";
      if (ch === "<" && next === ">") {
        tokens.push({ kind: "op", value: "<>" });
        i += 2;
        continue;
      }
      if (ch === "<" && next === "=") {
        tokens.push({ kind: "op", value: "<=" });
        i += 2;
        continue;
      }
      if (ch === ">" && next === "=") {
        tokens.push({ kind: "op", value: ">=" });
        i += 2;
        continue;
      }
      tokens.push({ kind: "op", value: ch as Operator });
      i++;
      continue;
    }
    if (ch === "!") {
      tokens.push({ kind: "bang" });
      i++;
      continue;
    }
    if (ch === '"') {
      let value = "";
      i++;
      while (i < formula.length) {
        const c = formula[i] ?? "";
        if (c === '"') {
          if (formula[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += c;
        i++;
      }
      tokens.push({ kind: "string", value });
      continue;
    }
    if (ch === "'") {
      // Quoted sheet name.
      let value = "";
      i++;
      while (i < formula.length) {
        const c = formula[i] ?? "";
        if (c === "'") {
          if (formula[i + 1] === "'") {
            value += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += c;
        i++;
      }
      tokens.push({ kind: "name", value });
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let value = "";
      while (i < formula.length) {
        const c = formula[i] ?? "";
        if (/[0-9.]/.test(c)) {
          value += c;
          i++;
          continue;
        }
        break;
      }
      const n = Number(value);
      if (Number.isNaN(n)) {
        throw new FormulaError("#NUM!", `Invalid number '${value}'`);
      }
      tokens.push({ kind: "number", value: n });
      continue;
    }
    if (ch === "$" || /[A-Za-z]/.test(ch)) {
      // Could be a sheet name, a name, or a cell reference.
      let value = "";
      while (i < formula.length) {
        const c = formula[i] ?? "";
        if (c === "$" || /[A-Za-z0-9_]/.test(c)) {
          value += c;
          i++;
          continue;
        }
        break;
      }
      const upper = value.toUpperCase();
      if (upper === "TRUE") {
        tokens.push({ kind: "boolean", value: true });
        continue;
      }
      if (upper === "FALSE") {
        tokens.push({ kind: "boolean", value: false });
        continue;
      }
      // Check if this is followed by a digit (cell reference) or a colon.
      // Look ahead to decide.
      const ahead = formula[i] ?? "";
      const looksLikeRef = /[0-9]/.test(value) || (value.replace(/\$/g, "").match(/[A-Z]+[0-9]+/i) !== null);
      if (looksLikeRef || (ahead === "!" || (ahead === ":" && fromA1(value.replace(/\$/g, "")) !== null))) {
        tokens.push({ kind: "ref", value: parseRef(value) });
        continue;
      }
      tokens.push({ kind: "name", value });
      continue;
    }
    // Error literal: #DIV/0! etc.
    if (ch === "#") {
      let value = "#";
      i++;
      while (i < formula.length) {
        const c = formula[i] ?? "";
        if (c === "!" || /[A-Z0-9_\-/]/i.test(c)) {
          value += c;
          i++;
          continue;
        }
        break;
      }
      tokens.push({ kind: "error", value });
      continue;
    }
    throw new FormulaError("#NAME?", `Unexpected character '${ch}'`);
  }
  return tokens;
}

/** Parses a reference (A1, $A$1, A1:B2). */
function parseRef(value: string): RefTarget {
  const cleaned = value.replace(/\$/g, "");
  const [startStr, endStr] = cleaned.split(":");
  const start = fromA1(startStr ?? "");
  if (!start) throw new FormulaError("#REF!", `Invalid reference '${value}'`);
  if (!endStr) {
    return { kind: "cell", sheet: null, address: start };
  }
  const end = fromA1(endStr);
  if (!end) throw new FormulaError("#REF!", `Invalid reference '${value}'`);
  return {
    kind: "range",
    sheet: null,
    start: { row: Math.min(start.row, end.row), column: Math.min(start.column, end.column) },
    end: { row: Math.max(start.row, end.row), column: Math.max(start.column, end.column) },
  };
}

/* -------------------------------------------------------------------------- */
/* Parser                                                                     */
/* -------------------------------------------------------------------------- */

interface Parser {
  tokens: Token[];
  position: number;
  body: SheetBody;
  activeSheetId: string;
}

class ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParserError";
  }
}

/** Parses a formula into an AST node. */
type AstNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "error"; code: string }
  | { type: "ref"; target: RefTarget }
  | { type: "binary"; op: Operator | "&"; left: AstNode; right: AstNode }
  | { type: "unary"; op: "-" | "%"; operand: AstNode }
  | { type: "function"; name: string; args: AstNode[] };

/** Top-level entry. */
function parse(formula: string, body: SheetBody): AstNode {
  const tokens = tokenize(formula);
  const parser: Parser = {
    tokens,
    position: 0,
    body,
    activeSheetId: body.settings.activeSheetId,
  };
  const node = parseExpression(parser);
  if (parser.position < parser.tokens.length) {
    const token = parser.tokens[parser.position];
    if (token) {
      throw new FormulaError("#VALUE!", `Unexpected token: ${describeToken(token)}`);
    }
  }
  return node;
}

function describeToken(token: Token): string {
  switch (token.kind) {
    case "number":
      return String(token.value);
    case "string":
      return `"${token.value}"`;
    case "boolean":
      return token.value ? "TRUE" : "FALSE";
    case "error":
      return token.value;
    case "ref":
      return JSON.stringify(token.value);
    case "name":
      return token.value;
    case "lparen":
      return "(";
    case "rparen":
      return ")";
    case "comma":
      return ",";
    case "colon":
      return ":";
    case "bang":
      return "!";
    case "op":
      return token.value;
    case "percent":
      return "%";
    case "concat":
      return "&";
  }
}

function peek(parser: Parser): Token | undefined {
  return parser.tokens[parser.position];
}

function consume(parser: Parser): Token {
  const token = parser.tokens[parser.position];
  if (!token) throw new FormulaError("#VALUE!", "Unexpected end of formula");
  parser.position += 1;
  return token;
}

function parseExpression(parser: Parser): AstNode {
  return parseComparison(parser);
}

function parseComparison(parser: Parser): AstNode {
  let left = parseConcat(parser);
  while (true) {
    const token = peek(parser);
    if (!token || token.kind !== "op") break;
    if (
      token.value === "=" ||
      token.value === "<>" ||
      token.value === "<" ||
      token.value === ">" ||
      token.value === "<=" ||
      token.value === ">="
    ) {
      const op = token.value;
      consume(parser);
      const right = parseConcat(parser);
      left = { type: "binary", op, left, right };
      continue;
    }
    break;
  }
  return left;
}

function parseConcat(parser: Parser): AstNode {
  let left = parseAddSub(parser);
  while (true) {
    const token = peek(parser);
    if (token?.kind === "concat") {
      consume(parser);
      const right = parseAddSub(parser);
      left = { type: "binary", op: "&", left, right };
      continue;
    }
    break;
  }
  return left;
}

function parseAddSub(parser: Parser): AstNode {
  let left = parseMulDiv(parser);
  while (true) {
    const token = peek(parser);
    if (!token || token.kind !== "op") break;
    if (token.value === "+" || token.value === "-") {
      const op = token.value;
      consume(parser);
      const right = parseMulDiv(parser);
      left = { type: "binary", op, left, right };
      continue;
    }
    break;
  }
  return left;
}

function parseMulDiv(parser: Parser): AstNode {
  let left = parsePower(parser);
  while (true) {
    const token = peek(parser);
    if (!token || token.kind !== "op") break;
    if (token.value === "*" || token.value === "/") {
      const op = token.value;
      consume(parser);
      const right = parsePower(parser);
      left = { type: "binary", op, left, right };
      continue;
    }
    break;
  }
  return left;
}

function parsePower(parser: Parser): AstNode {
  let left = parsePercent(parser);
  while (true) {
    const token = peek(parser);
    if (token?.kind === "op" && token.value === "^") {
      consume(parser);
      const right = parsePercent(parser);
      left = { type: "binary", op: "^", left, right };
      continue;
    }
    break;
  }
  return left;
}

function parsePercent(parser: Parser): AstNode {
  let node = parseUnary(parser);
  while (peek(parser)?.kind === "percent") {
    consume(parser);
    node = { type: "unary", op: "%", operand: node };
  }
  return node;
}

function parseUnary(parser: Parser): AstNode {
  const token = peek(parser);
  if (token?.kind === "op" && token.value === "-") {
    consume(parser);
    const operand = parseUnary(parser);
    return { type: "unary", op: "-", operand };
  }
  return parsePrimary(parser);
}

function parsePrimary(parser: Parser): AstNode {
  const token = peek(parser);
  if (!token) throw new FormulaError("#VALUE!", "Unexpected end of formula");
  if (token.kind === "number") {
    consume(parser);
    return { type: "number", value: token.value };
  }
  if (token.kind === "string") {
    consume(parser);
    return { type: "string", value: token.value };
  }
  if (token.kind === "boolean") {
    consume(parser);
    return { type: "boolean", value: token.value };
  }
  if (token.kind === "error") {
    consume(parser);
    return { type: "error", code: token.value };
  }
  if (token.kind === "lparen") {
    consume(parser);
    const node = parseExpression(parser);
    if (peek(parser)?.kind !== "rparen") {
      throw new FormulaError("#VALUE!", "Expected closing parenthesis");
    }
    consume(parser);
    return node;
  }
  if (token.kind === "ref") {
    consume(parser);
    let target = token.value;
    // Range expression: ref : ref.
    if (peek(parser)?.kind === "colon") {
      consume(parser);
      const next = peek(parser);
      if (!next || next.kind !== "ref") {
        throw new FormulaError("#REF!", "Expected reference after ':'");
      }
      consume(parser);
      const nextTarget = next.value;
      if (target.kind !== "cell" || nextTarget.kind !== "cell") {
        throw new FormulaError("#REF!", "Range endpoints must be cells");
      }
      return {
        type: "ref",
        target: {
          kind: "range",
          sheet: null,
          start: {
            row: Math.min(target.address.row, nextTarget.address.row),
            column: Math.min(target.address.column, nextTarget.address.column),
          },
          end: {
            row: Math.max(target.address.row, nextTarget.address.row),
            column: Math.max(target.address.column, nextTarget.address.column),
          },
        },
      };
    }
    return { type: "ref", target };
  }
  if (token.kind === "name") {
    // Could be a sheet name (followed by !), a function, or an error.
    consume(parser);
    if (peek(parser)?.kind === "bang") {
      consume(parser);
      const refToken = peek(parser);
      if (!refToken || refToken.kind !== "ref") {
        throw new FormulaError("#REF!", "Expected reference after sheet name");
      }
      consume(parser);
      const inner = refToken.value;
      if (inner.kind === "cell") {
        return { type: "ref", target: { ...inner, sheet: token.value } };
      }
      return { type: "ref", target: { ...inner, sheet: token.value } };
    }
    if (peek(parser)?.kind === "lparen") {
      consume(parser);
      const args: AstNode[] = [];
      if (peek(parser)?.kind !== "rparen") {
        args.push(parseExpression(parser));
        while (peek(parser)?.kind === "comma") {
          consume(parser);
          args.push(parseExpression(parser));
        }
      }
      if (peek(parser)?.kind !== "rparen") {
        throw new FormulaError("#VALUE!", "Expected closing parenthesis in function call");
      }
      consume(parser);
      return { type: "function", name: token.value.toUpperCase(), args };
    }
    // Bare name — treat as #NAME?.
    throw new FormulaError("#NAME?", `Unknown name '${token.value}'`);
  }
  throw new FormulaError("#VALUE!", `Unexpected token: ${describeToken(token)}`);
}

/* -------------------------------------------------------------------------- */
/* Evaluator                                                                  */
/* -------------------------------------------------------------------------- */

/** Evaluates a formula and returns the resolved value. */
export function evaluate(formula: string, body: SheetBody): ResolvedValue {
  const ast = parse(formula, body);
  return evaluateNode(ast, body, new Set());
}

/** Recursively evaluates an AST node. */
function evaluateNode(node: AstNode, body: SheetBody, visited: Set<string>): ResolvedValue {
  switch (node.type) {
    case "number":
      return node.value;
    case "string":
      return node.value;
    case "boolean":
      return node.value;
    case "error":
      throw new FormulaError(node.code, node.code);
    case "ref":
      return evaluateRef(node.target, body, visited);
    case "unary": {
      const value = evaluateNode(node.operand, body, visited);
      if (node.op === "-") {
        if (typeof value !== "number") throw new FormulaError("#VALUE!", "Expected number");
        return -value;
      }
      if (node.op === "%") {
        if (typeof value !== "number") throw new FormulaError("#VALUE!", "Expected number");
        return value / 100;
      }
      return value;
    }
    case "binary": {
      const left = evaluateNode(node.left, body, visited);
      const right = evaluateNode(node.right, body, visited);
      if (node.op === "&") {
        return concatValues(left, right);
      }
      if (node.op === "=" || node.op === "<>" || node.op === "<" || node.op === ">" || node.op === "<=" || node.op === ">=") {
        return compareValues(left, right, node.op);
      }
      return arithmetic(left, right, node.op as Exclude<Operator, "=" | "<>" | "<" | ">" | "<=" | ">=" >);
    }
    case "function":
      return evaluateFunction(node.name, node.args, body, visited);
    default:
      throw new FormulaError("#VALUE!", "Unknown node");
  }
}

function evaluateRef(target: RefTarget, body: SheetBody, visited: Set<string>): ResolvedValue {
  if (target.kind === "cell") {
    const cell = resolveCell(target.sheet, target.address, body);
    if (!cell) return null;
    return cellValue(cell, body, new Set(visited));
  }
  // Range: implicit intersection takes the top-left cell for our uses
  // except in function arguments, which handle ranges themselves.
  const cell = resolveCell(target.sheet, target.start, body);
  if (!cell) return null;
  return cellValue(cell, body, new Set(visited));
}

function resolveCell(sheetName: string | null, address: CellAddress, body: SheetBody): SheetCell | null {
  const sheet = sheetName ? findSheet(body, sheetName) : null;
  if (sheetName && !sheet) throw new FormulaError("#REF!", `Unknown sheet '${sheetName}'`);
  const target = sheet ?? getActiveSheet(body);
  return getCell(target, address.row, address.column);
}

function findSheet(body: SheetBody, name: string): Sheet | null {
  const stripped = name.replace(/^'|'$/g, "");
  return body.sheets.find((sheet) => sheet.name.toLowerCase() === stripped.toLowerCase()) ?? null;
}

function cellValue(cell: SheetCell, body: SheetBody, visited: Set<string>): ResolvedValue {
  if (cell.value !== undefined) return cell.value;
  if (cell.formula) {
    const key = `${body.settings.activeSheetId}:${cell.raw ?? cell.formula}`;
    if (visited.has(key)) {
      throw new FormulaError("#REF!", "Circular reference");
    }
    visited.add(key);
    try {
      return evaluate(cell.formula, body);
    } finally {
      visited.delete(key);
    }
  }
  if (cell.raw === undefined) return null;
  const raw = cell.raw.trim();
  if (raw === "") return "";
  // Try to coerce.
  if (raw.toUpperCase() === "TRUE") return true;
  if (raw.toUpperCase() === "FALSE") return false;
  const num = Number(raw);
  if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(raw)) {
    return num;
  }
  return cell.raw;
}

/** Concatenates two values for the `&` operator. */
function concatValues(a: ResolvedValue, b: ResolvedValue): string {
  return `${stringify(a)}${stringify(b)}`;
}

/** Compares two values with the given operator. */
function compareValues(a: ResolvedValue, b: ResolvedValue, op: Operator): boolean {
  if (op === "=") return stringify(a) === stringify(b);
  if (op === "<>") return stringify(a) !== stringify(b);
  const left = coerceNumber(a);
  const right = coerceNumber(b);
  if (left === null || right === null) {
    return op === "<" ? stringify(a) < stringify(b) : op === ">" ? stringify(a) > stringify(b) : false;
  }
  if (op === "<") return left < right;
  if (op === ">") return left > right;
  if (op === "<=") return left <= right;
  if (op === ">=") return left >= right;
  return false;
}

function arithmetic(a: ResolvedValue, b: ResolvedValue, op: Operator): number {
  const left = coerceNumber(a);
  const right = coerceNumber(b);
  if (left === null || right === null) {
    throw new FormulaError("#VALUE!", "Arithmetic on non-numeric value");
  }
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0) throw new FormulaError("#DIV/0!", "Division by zero");
      return left / right;
    case "^":
      return Math.pow(left, right);
    default:
      throw new FormulaError("#VALUE!", "Unsupported operator");
  }
}

function coerceNumber(value: ResolvedValue): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    if (Number.isNaN(num)) return null;
    return num;
  }
  return null;
}

function stringify(value: ResolvedValue): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

/* -------------------------------------------------------------------------- */
/* Functions                                                                  */
/* -------------------------------------------------------------------------- */

function evaluateFunction(name: string, args: AstNode[], body: SheetBody, visited: Set<string>): ResolvedValue {
  type Arg = ResolvedValue | ResolvedValue[];
  const handlers: Record<string, (...argList: Arg[]) => ResolvedValue> = {
    SUM: (...args) => sumArgs(args as ResolvedValue[]),
    AVERAGE: (...args) => averageArgs(args as ResolvedValue[]),
    MIN: (...args) => minArgs(args as ResolvedValue[]),
    MAX: (...args) => maxArgs(args as ResolvedValue[]),
    COUNT: (...args) => countArgs(args as ResolvedValue[]),
    COUNTA: (...args) => countAArgs(args as ResolvedValue[]),
    IF: (cond, whenTrue, whenFalse) => (cond ? (whenTrue as ResolvedValue) ?? false : (whenFalse as ResolvedValue) ?? false),
    ROUND: (value, digits) => roundValue(value as ResolvedValue, digits as ResolvedValue),
    ABS: (value) => Math.abs(coerceNumber(value as ResolvedValue) ?? 0),
    INT: (value) => Math.trunc(coerceNumber(value as ResolvedValue) ?? 0),
    MOD: (value, divisor) => modValue(value as ResolvedValue, divisor as ResolvedValue),
    SQRT: (value) => Math.sqrt(coerceNumber(value as ResolvedValue) ?? 0),
    POWER: (base, exponent) => Math.pow(coerceNumber(base as ResolvedValue) ?? 0, coerceNumber(exponent as ResolvedValue) ?? 0),
    CONCAT: (...args) => args.flat().map((v) => stringify(v as ResolvedValue)).join(""),
    CONCATENATE: (...args) => args.flat().map((v) => stringify(v as ResolvedValue)).join(""),
    LEFT: (text, count) => leftValue(text as ResolvedValue, count as ResolvedValue),
    RIGHT: (text, count) => rightValue(text as ResolvedValue, count as ResolvedValue),
    MID: (text, start, count) => midValue(text as ResolvedValue, start as ResolvedValue, count as ResolvedValue),
    LEN: (text) => stringify(text as ResolvedValue).length,
    UPPER: (text) => stringify(text as ResolvedValue).toUpperCase(),
    LOWER: (text) => stringify(text as ResolvedValue).toLowerCase(),
    TRIM: (text) => stringify(text as ResolvedValue).trim(),
    TODAY: () => dateOnly(new Date()),
    NOW: () => new Date().toISOString(),
    AND: (...args) => args.flat().every((v) => Boolean(v)),
    OR: (...args) => args.flat().some((v) => Boolean(v)),
    NOT: (value) => !value,
    IFERROR: (value, fallback) => (value && typeof value === "object" && "code" in value ? fallback as ResolvedValue : value as ResolvedValue),
    SUMIF: (range, criteria) => sumIf(range, criteria as ResolvedValue, body, visited),
    COUNTIF: (range, criteria) => countIf(range, criteria as ResolvedValue, body, visited),
  };
  const handler = handlers[name];
  if (!handler) {
    throw new FormulaError("#NAME?", `Unknown function '${name}'`);
  }
  const values = args.map((arg) => evaluateArg(arg, body, visited));
  return handler(...(values as Arg[]));
}

/** Evaluates an AST node, expanding range references into value arrays. */
function evaluateArg(node: AstNode, body: SheetBody, visited: Set<string>): ResolvedValue | ResolvedValue[] {
  if (node.type === "ref") {
    return expandRef(node.target, body, visited);
  }
  return evaluateNode(node, body, visited);
}

function expandRef(target: RefTarget, body: SheetBody, visited: Set<string>): ResolvedValue | ResolvedValue[] {
  if (target.kind === "cell") {
    const cell = resolveCell(target.sheet, target.address, body);
    if (!cell) return null;
    return cellValue(cell, body, new Set(visited));
  }
  const sheet = target.sheet ? findSheet(body, target.sheet) ?? getActiveSheet(body) : getActiveSheet(body);
  const [start, end] = normaliseRangeLocal(target.start, target.end);
  const result: ResolvedValue[] = [];
  for (let row = start.row; row <= end.row; row++) {
    for (let column = start.column; column <= end.column; column++) {
      const cell = getCell(sheet, row, column);
      if (!cell) {
        result.push(null);
        continue;
      }
      result.push(cellValue(cell, body, new Set(visited)));
    }
  }
  return result;
}

function normaliseRangeLocal(start: CellAddress, end: CellAddress): [CellAddress, CellAddress] {
  return [
    { row: Math.min(start.row, end.row), column: Math.min(start.column, end.column) },
    { row: Math.max(start.row, end.row), column: Math.max(start.column, end.column) },
  ];
}

function sumArgs(values: ResolvedValue[]): number {
  let sum = 0;
  for (const v of values) {
    if (Array.isArray(v)) sum += sumArgs(v);
    else {
      const n = coerceNumber(v);
      if (n !== null) sum += n;
    }
  }
  return sum;
}

function averageArgs(values: ResolvedValue[]): number {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Array.isArray(v)) {
      const sub = averageArgs(v);
      // We can't easily extract count from sub; do it manually.
      const subSum = sumArgs(v);
      const subCount = countArgs(v);
      sum += subSum;
      count += subCount;
      continue;
    }
    const n = coerceNumber(v);
    if (n !== null) {
      sum += n;
      count += 1;
    }
  }
  if (count === 0) throw new FormulaError("#DIV/0!", "AVERAGE of empty range");
  return sum / count;
}

function minArgs(values: ResolvedValue[]): number {
  let min: number | null = null;
  for (const v of values) {
    if (Array.isArray(v)) {
      const sub = minArgs(v);
      if (sub !== null) min = min === null ? sub : Math.min(min, sub);
      continue;
    }
    const n = coerceNumber(v);
    if (n !== null) min = min === null ? n : Math.min(min, n);
  }
  if (min === null) throw new FormulaError("#VALUE!", "MIN of empty range");
  return min;
}

function maxArgs(values: ResolvedValue[]): number {
  let max: number | null = null;
  for (const v of values) {
    if (Array.isArray(v)) {
      const sub = maxArgs(v);
      if (sub !== null) max = max === null ? sub : Math.max(max, sub);
      continue;
    }
    const n = coerceNumber(v);
    if (n !== null) max = max === null ? n : Math.max(max, n);
  }
  if (max === null) throw new FormulaError("#VALUE!", "MAX of empty range");
  return max;
}

function countArgs(values: ResolvedValue[]): number {
  let count = 0;
  for (const v of values) {
    if (Array.isArray(v)) count += countArgs(v);
    else if (coerceNumber(v) !== null) count += 1;
  }
  return count;
}

function countAArgs(values: ResolvedValue[]): number {
  let count = 0;
  for (const v of values) {
    if (Array.isArray(v)) count += countAArgs(v);
    else if (v !== null && v !== "" && v !== undefined) count += 1;
  }
  return count;
}

function roundValue(value: ResolvedValue, digits: ResolvedValue): number {
  const n = coerceNumber(value);
  const d = coerceNumber(digits);
  if (n === null) throw new FormulaError("#VALUE!", "ROUND expects numeric value");
  const factor = Math.pow(10, d ?? 0);
  return Math.round(n * factor) / factor;
}

function modValue(value: ResolvedValue, divisor: ResolvedValue): number {
  const a = coerceNumber(value);
  const b = coerceNumber(divisor);
  if (a === null || b === null || b === 0) throw new FormulaError("#DIV/0!", "MOD");
  return ((a % b) + b) % b;
}

function leftValue(text: ResolvedValue, count: ResolvedValue): string {
  const str = stringify(text);
  const n = Math.max(0, Math.floor(coerceNumber(count) ?? 1));
  return str.slice(0, n);
}

function rightValue(text: ResolvedValue, count: ResolvedValue): string {
  const str = stringify(text);
  const n = Math.max(0, Math.floor(coerceNumber(count) ?? 1));
  return str.slice(-n);
}

function midValue(text: ResolvedValue, start: ResolvedValue, count: ResolvedValue): string {
  const str = stringify(text);
  const s = Math.max(1, Math.floor(coerceNumber(start) ?? 1));
  const c = Math.max(0, Math.floor(coerceNumber(count) ?? 0));
  return str.slice(s - 1, s - 1 + c);
}

function dateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCriteria(criteria: ResolvedValue): { op: "=" | "<>" | "<" | ">" | "<=" | ">="; value: ResolvedValue } | null {
  const text = stringify(criteria);
  const match = /^(<=|>=|<>|<|>|=)?\s*(.*)$/.exec(text);
  if (!match) return null;
  const op = (match[1] || "=") as "=" | "<>" | "<" | ">" | "<=" | ">=";
  const valueStr = match[2]?.trim() ?? "";
  if (valueStr === "") return null;
  const asNumber = Number(valueStr);
  const value: ResolvedValue = !Number.isNaN(asNumber) && /^-?\d+(\.\d+)?$/.test(valueStr) ? asNumber : valueStr;
  return { op, value };
}

function sumIf(range: ResolvedValue | ResolvedValue[], criteria: ResolvedValue, body: SheetBody, visited: Set<string>): number {
  const list: ResolvedValue[] = Array.isArray(range) ? range : [range];
  const parsed = parseCriteria(criteria);
  const matches = (value: ResolvedValue): boolean => {
    if (Array.isArray(value)) return value.some(matches);
    if (parsed) {
      const left = coerceNumber(value);
      const right = coerceNumber(parsed.value);
      if (left !== null && right !== null) {
        switch (parsed.op) {
          case "=": return left === right;
          case "<>": return left !== right;
          case "<": return left < right;
          case ">": return left > right;
          case "<=": return left <= right;
          case ">=": return left >= right;
        }
      }
      return compareValues(value, parsed.value, parsed.op);
    }
    return stringify(value) === stringify(criteria);
  };
  let sum = 0;
  for (const v of list) {
    if (matches(v)) {
      const n = coerceNumber(v);
      if (n !== null) sum += n;
    }
  }
  return sum;
}

function countIf(range: ResolvedValue | ResolvedValue[], criteria: ResolvedValue, body: SheetBody, visited: Set<string>): number {
  const list: ResolvedValue[] = Array.isArray(range) ? range : [range];
  const parsed = parseCriteria(criteria);
  const matches = (value: ResolvedValue): boolean => {
    if (Array.isArray(value)) return value.some(matches);
    if (parsed) {
      const left = coerceNumber(value);
      const right = coerceNumber(parsed.value);
      if (left !== null && right !== null) {
        switch (parsed.op) {
          case "=": return left === right;
          case "<>": return left !== right;
          case "<": return left < right;
          case ">": return left > right;
          case "<=": return left <= right;
          case ">=": return left >= right;
        }
      }
      return compareValues(value, parsed.value, parsed.op);
    }
    return stringify(value) === stringify(criteria);
  };
  let count = 0;
  for (const v of list) {
    if (matches(v)) count += 1;
  }
  return count;
}

/* -------------------------------------------------------------------------- */
/* Sheet evaluation                                                           */
/* -------------------------------------------------------------------------- */

/** Returns the value type for a resolved value. */
export function valueType(value: ResolvedValue): CellValueType {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") {
    // ISO date detection.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
    return "text";
  }
  return "empty";
}

/** Evaluates every formula in a sheet and writes the result back. */
export function evaluateSheet(sheet: Sheet, body: SheetBody): Sheet {
  const nextCells: Record<string, SheetCell> = { ...sheet.cells };
  for (const key of Object.keys(nextCells)) {
    const cell = nextCells[key];
    if (!cell) continue;
    if (cell.formula) {
      try {
        const value = evaluate(cell.formula, body);
        const display = formatDisplay(value, cell.style?.numberFormat);
        nextCells[key] = {
          ...cell,
          value,
          valueType: valueType(value),
          display,
        };
      } catch (error) {
        const code = error instanceof FormulaError ? error.code : "#ERROR!";
        nextCells[key] = {
          ...cell,
          value: code,
          valueType: "error",
          display: code,
        };
      }
    } else if (cell.raw !== undefined) {
      const raw = cell.raw;
      const trimmed = raw.trim();
      if (trimmed === "") {
        nextCells[key] = { ...cell, value: "", valueType: "empty", display: "" };
      } else if (trimmed.toUpperCase() === "TRUE") {
        nextCells[key] = { ...cell, value: true, valueType: "boolean", display: "TRUE" };
      } else if (trimmed.toUpperCase() === "FALSE") {
        nextCells[key] = { ...cell, value: false, valueType: "boolean", display: "FALSE" };
      } else {
        const num = Number(trimmed);
        if (!Number.isNaN(num) && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(trimmed)) {
          nextCells[key] = {
            ...cell,
            value: num,
            valueType: "number",
            display: formatDisplay(num, cell.style?.numberFormat),
          };
        } else {
          nextCells[key] = { ...cell, value: raw, valueType: "text", display: raw };
        }
      }
    }
  }
  return { ...sheet, cells: nextCells };
}

/** Formats a value for display given a number format. */
export function formatDisplay(value: ResolvedValue, format?: string | null): string {
  if (value === null || value === undefined) return "";
  if (format === undefined || format === null || format === "general") {
    return defaultDisplay(value);
  }
  return formatByFormat(value, format);
}

function defaultDisplay(value: ResolvedValue): string {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return Number(value.toFixed(10)).toString();
  }
  return stringify(value);
}

function formatByFormat(value: ResolvedValue, format: string): string {
  if (typeof value !== "number") return stringify(value);
  switch (format) {
    case "number":
      return value.toFixed(2);
    case "number-2dp":
      return value.toFixed(2);
    case "number-4dp":
      return value.toFixed(4);
    case "integer":
      return Math.trunc(value).toString();
    case "thousands":
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    case "currency": {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    }
    case "currency-eur": {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(value);
    }
    case "currency-gbp": {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "GBP" }).format(value);
    }
    case "percentage":
      return `${(value * 100).toFixed(0)}%`;
    case "percentage-2dp":
      return `${(value * 100).toFixed(2)}%`;
    case "scientific":
      return value.toExponential(2);
    case "date":
      return formatDate(serialNumberToDate(value));
    case "time":
      return formatTime(serialNumberToDate(value));
    case "datetime":
      return `${formatDate(serialNumberToDate(value))} ${formatTime(serialNumberToDate(value))}`;
    default:
      return defaultDisplay(value);
  }
}

/** Excel-style serial date to JS Date. Day 1 = 1900-01-01. */
function serialNumberToDate(serial: number): Date {
  // Account for Excel's 1900 leap year bug (Feb 29, 1900 never existed).
  const adjusted = serial >= 60 ? serial - 1 : serial;
  const epoch = Date.UTC(1899, 11, 31);
  return new Date(epoch + adjusted * 86_400_000);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Recomputes the body by evaluating all sheets. */
export function evaluateBody(body: SheetBody): SheetBody {
  let next = body;
  for (const sheet of next.sheets) {
    next = { ...next, sheets: next.sheets.map((s) => (s.id === sheet.id ? evaluateSheet(sheet, next) : s)) };
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/* Dependency tracking                                                        */
/* -------------------------------------------------------------------------- */

interface ReferenceCollector {
  body: SheetBody;
  refs: Array<{ sheet: string | null; address: CellAddress }>;
  ranges: Array<{ sheet: string | null; start: CellAddress; end: CellAddress }>;
}

function collectReferences(node: AstNode, body: SheetBody): ReferenceCollector {
  const collector: ReferenceCollector = { body, refs: [], ranges: [] };
  visit(node, collector);
  return collector;
}

function visit(node: AstNode, collector: ReferenceCollector): void {
  switch (node.type) {
    case "ref":
      if (node.target.kind === "cell") {
        collector.refs.push({ sheet: node.target.sheet, address: node.target.address });
      } else {
        collector.ranges.push({ sheet: node.target.sheet, start: node.target.start, end: node.target.end });
      }
      return;
    case "binary":
      visit(node.left, collector);
      visit(node.right, collector);
      return;
    case "unary":
      visit(node.operand, collector);
      return;
    case "function":
      for (const arg of node.args) visit(arg, collector);
      return;
    default:
      return;
  }
}

/** Returns the cell keys in `body` that depend on the cell at `key`. */
export function getDependents(body: SheetBody, sheetId: string, key: string): Set<string> {
  const dependents = new Set<string>();
  const sheet = body.sheets.find((s) => s.id === sheetId);
  if (!sheet) return dependents;
  const target = sheet.cells[key];
  if (!target) return dependents;
  for (const [candidateKey, candidateCell] of Object.entries(sheet.cells)) {
    if (!candidateCell.formula) continue;
    try {
      const ast = parse(candidateCell.formula, body);
      const collector = collectReferences(ast, body);
      for (const ref of collector.refs) {
        const refSheet = ref.sheet ? findSheet(body, ref.sheet) : null;
        const targetSheet = ref.sheet ? findSheet(body, ref.sheet) : null;
        const refSheetId = targetSheet?.id ?? body.settings.activeSheetId;
        if (refSheetId !== sheetId) continue;
        if (cellKey(ref.address.row, ref.address.column) === key) {
          dependents.add(candidateKey);
        }
      }
      for (const range of collector.ranges) {
        const rangeSheet = range.sheet ? findSheet(body, range.sheet) : null;
        const rangeSheetId = rangeSheet?.id ?? body.settings.activeSheetId;
        if (rangeSheetId !== sheetId) continue;
        const [start, end] = normaliseRangeLocal(range.start, range.end);
        for (let row = start.row; row <= end.row; row++) {
          for (let column = start.column; column <= end.column; column++) {
            if (cellKey(row, column) === key) dependents.add(candidateKey);
          }
        }
      }
    } catch {
      // Parse errors are not interesting here.
    }
  }
  return dependents;
}

export { columnLetter, toA1, fromA1 };
