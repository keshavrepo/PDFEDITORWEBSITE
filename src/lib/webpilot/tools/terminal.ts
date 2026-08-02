/**
 * Integrated Terminal helpers.
 *
 * Pure functions the Integrated Terminal surface uses to build a
 * small sandboxed shell. The shell is intentionally dependency-free:
 * every command is implemented against the project files and the
 * asset list the user is editing. No `eval`, no `Function`, no
 * `import()`, no network — the user can only run the commands the
 * surface explicitly registers.
 *
 * The terminal is split from the surface so the project tree, the
 * asset list, and the project's local store are reachable from a
 * single function call. The surface passes a snapshot of the
 * project / asset state on every call, so the command does not
 * capture stale references.
 */

import type {
  WebAsset,
  WebProjectFile,
  WebProjectFolder,
  WebTerminalCommand,
  WebTerminalLine,
  WebTerminalPane,
} from "../types";

/** Context the terminal can read from. */
export interface TerminalContext {
  /** The current working directory. Always a forward-slash path. */
  cwd: string;
  /** Folders in the project, by their logical path. */
  folders: WebProjectFolder[];
  /** Files in the project, by their logical path. */
  files: WebProjectFile[];
  /** Assets in the project, by their id. */
  assets: WebAsset[];
}

export interface CommandResult {
  /** Lines the shell wrote back. */
  lines: WebTerminalLine[];
  /** New cwd after the command. */
  cwd: string;
  /** Optional exit code. */
  exitCode: number;
}

function newLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeLine(
  kind: WebTerminalLine["kind"],
  text: string
): WebTerminalLine {
  return { id: newLineId(), kind, text, createdAt: new Date().toISOString() };
}

/** Tokenise a command line into its name and arguments. The
 * implementation is intentionally minimal: words are separated by
 * whitespace; quoted arguments are supported with `"` and `'`. */
export function tokeniseCommand(source: string): {
  name: string;
  args: string[];
} {
  const text = (source ?? "").trim();
  if (!text) return { name: "", args: [] };
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      if (ch === "\\" && i + 1 < text.length) {
        current += text[i + 1];
        i += 1;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  const [name, ...args] = tokens;
  return { name: name ?? "", args };
}

/** Resolve a path against the current working directory. */
export function resolvePath(cwd: string, target: string): string {
  const text = (target ?? "").trim() || ".";
  if (text.startsWith("/")) return normalisePath(text);
  const base = cwd === "/" ? "" : cwd;
  return normalisePath(base ? `${base}/${text}` : text);
}

function normalisePath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return "/" + out.join("/");
}

function listFolder(
  ctx: TerminalContext,
  folder: string
): Array<{ name: string; kind: "file" | "folder"; size?: number }> {
  const prefix = folder === "/" ? "" : folder + "/";
  const names = new Set<string>();
  const result: Array<{ name: string; kind: "file" | "folder"; size?: number }> = [];
  for (const candidate of ctx.folders) {
    if (candidate.path === folder) continue;
    if (folder === "/") {
      const top = candidate.path.split("/").filter(Boolean)[0];
      if (top && !names.has(top + "/")) {
        names.add(top + "/");
        result.push({ name: top + "/", kind: "folder" });
      }
      continue;
    }
    if (candidate.path.startsWith(prefix)) {
      const rest = candidate.path.slice(prefix.length);
      const top = rest.split("/")[0];
      if (top && !names.has(top + "/")) {
        names.add(top + "/");
        result.push({ name: top + "/", kind: "folder" });
      }
    }
  }
  for (const file of ctx.files) {
    if (folder === "/") {
      const top = file.path.split("/")[0]!;
      if (!names.has(top)) {
        names.add(top);
        result.push({ name: top, kind: "file", size: file.source.length });
      }
      continue;
    }
    if (file.path.startsWith(prefix)) {
      const rest = file.path.slice(prefix.length);
      if (rest.includes("/")) continue;
      if (!names.has(rest)) {
        names.add(rest);
        result.push({ name: rest, kind: "file", size: file.source.length });
      }
    }
  }
  return result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Run a single command against the terminal context. The function
 * is pure: it returns a `CommandResult` the surface merges into
 * the active pane. */
export function runCommand(
  ctx: TerminalContext,
  source: string
): CommandResult {
  const trimmed = (source ?? "").trim();
  if (!trimmed) {
    return { lines: [], cwd: ctx.cwd, exitCode: 0 };
  }
  const { name, args } = tokeniseCommand(trimmed);
  const lines: WebTerminalLine[] = [];
  let cwd = ctx.cwd;
  let exitCode = 0;

  switch (name) {
    case "echo": {
      lines.push(makeLine("output", args.join(" ")));
      break;
    }
    case "pwd": {
      lines.push(makeLine("output", ctx.cwd));
      break;
    }
    case "cd": {
      const target = args[0] ?? "/";
      const next = resolvePath(ctx.cwd, target);
      // Verify the target exists (either as the project root, a
      // registered folder, or a folder that contains at least one
      // file).
      if (
        next === "/" ||
        ctx.folders.some((folder) => folder.path === next) ||
        ctx.files.some((file) => file.path.startsWith(next + "/")) ||
        ctx.files.some((file) => file.path === next)
      ) {
        cwd = next;
      } else {
        lines.push(
          makeLine("error", `cd: no such file or directory: ${target}`)
        );
        exitCode = 1;
      }
      break;
    }
    case "ls": {
      const target = args[0] ?? ctx.cwd;
      const path = resolvePath(ctx.cwd, target);
      const entries = listFolder(ctx, path);
      if (entries.length === 0) {
        lines.push(makeLine("info", "(empty)"));
      } else {
        lines.push(
          makeLine(
            "output",
            entries
              .map((entry) =>
                entry.kind === "folder"
                  ? entry.name
                  : `${entry.name}${
                      entry.size !== undefined ? ` (${entry.size}B)` : ""
                    }`
              )
              .join("  ")
          )
        );
      }
      break;
    }
    case "cat": {
      if (args.length === 0) {
        lines.push(makeLine("error", "cat: missing file operand"));
        exitCode = 1;
        break;
      }
      const path = resolvePath(ctx.cwd, args[0]!);
      const file = ctx.files.find((candidate) => candidate.path === path);
      if (!file) {
        lines.push(makeLine("error", `cat: ${args[0]}: no such file`));
        exitCode = 1;
        break;
      }
      const text = file.source;
      const split = text.split("\n");
      if (split.length > 50) {
        lines.push(
          makeLine(
            "info",
            `truncated: showing first 50 of ${split.length} lines`
          )
        );
        for (const line of split.slice(0, 50)) {
          lines.push(makeLine("output", line));
        }
      } else {
        for (const line of split) {
          lines.push(makeLine("output", line));
        }
      }
      break;
    }
    case "head": {
      if (args.length === 0) {
        lines.push(makeLine("error", "head: missing file operand"));
        exitCode = 1;
        break;
      }
      const path = resolvePath(ctx.cwd, args[0]!);
      const file = ctx.files.find((candidate) => candidate.path === path);
      if (!file) {
        lines.push(makeLine("error", `head: ${args[0]}: no such file`));
        exitCode = 1;
        break;
      }
      const limit = 10;
      for (const line of file.source.split("\n").slice(0, limit)) {
        lines.push(makeLine("output", line));
      }
      break;
    }
    case "tail": {
      if (args.length === 0) {
        lines.push(makeLine("error", "tail: missing file operand"));
        exitCode = 1;
        break;
      }
      const path = resolvePath(ctx.cwd, args[0]!);
      const file = ctx.files.find((candidate) => candidate.path === path);
      if (!file) {
        lines.push(makeLine("error", `tail: ${args[0]}: no such file`));
        exitCode = 1;
        break;
      }
      const lines_ = file.source.split("\n");
      const limit = 10;
      for (const line of lines_.slice(Math.max(0, lines_.length - limit))) {
        lines.push(makeLine("output", line));
      }
      break;
    }
    case "wc": {
      if (args.length === 0) {
        lines.push(makeLine("output", "wc: missing file operand"));
        exitCode = 1;
        break;
      }
      const path = resolvePath(ctx.cwd, args[0]!);
      const file = ctx.files.find((candidate) => candidate.path === path);
      if (!file) {
        lines.push(makeLine("error", `wc: ${args[0]}: no such file`));
        exitCode = 1;
        break;
      }
      const text = file.source;
      const lines_ = text === "" ? 0 : text.split("\n").length;
      const words = text === "" ? 0 : text.split(/\s+/).filter(Boolean).length;
      const bytes = text.length;
      lines.push(
        makeLine("output", `${lines_}\t${words}\t${bytes}\t${file.path}`)
      );
      break;
    }
    case "clear": {
      // The surface treats this as a signal: it clears the buffer
      // and discards whatever the function returned.
      lines.length = 0;
      lines.push(makeLine("info", "Terminal cleared"));
      break;
    }
    case "help": {
      lines.push(
        makeLine(
          "output",
          [
            "WebPilot · Integrated Terminal",
            "",
            "Built-in commands:",
            "  echo <text>      Print the arguments.",
            "  pwd              Print the current working directory.",
            "  cd <path>        Change the current working directory.",
            "  ls [path]        List a folder (default: cwd).",
            "  cat <file>       Print a file (truncated to 50 lines).",
            "  head <file>      Print the first 10 lines of a file.",
            "  tail <file>      Print the last 10 lines of a file.",
            "  wc <file>        Print line, word and byte counts.",
            "  clear            Clear the terminal buffer.",
            "  help             Print this help text.",
            "  exit             Close the active terminal pane.",
            "",
            "Keyboard shortcuts:",
            "  Ctrl/Cmd + T       Open a new terminal pane.",
            "  Ctrl/Cmd + K       Clear the active terminal pane.",
            "  Ctrl/Cmd + Shift + F   Toggle fullscreen.",
            "  Up / Down          Cycle through command history.",
            "  Enter              Run the current input.",
          ].join("\n")
        )
      );
      break;
    }
    case "exit": {
      lines.push(makeLine("info", "Use the close button to exit a pane."));
      break;
    }
    case "": {
      // Whitespace-only line: do nothing.
      break;
    }
    default: {
      lines.push(
        makeLine("error", `${name}: command not found. Type 'help' for a list.`)
      );
      exitCode = 127;
      break;
    }
  }

  return { lines, cwd, exitCode };
}

/** Add a command to the persistent command log. Newest first. */
export function pushCommand(
  commands: WebTerminalCommand[],
  source: string
): WebTerminalCommand[] {
  const trimmed = (source ?? "").trim();
  if (!trimmed) return commands;
  const { name } = tokeniseCommand(trimmed);
  if (!name) return commands;
  const entry: WebTerminalCommand = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    source: trimmed,
    runAt: new Date().toISOString(),
    isFavorite: false,
  };
  const next = [
    entry,
    ...commands.filter((other) => other.source !== trimmed),
  ].slice(0, 100);
  return next;
}

/** Build a fresh terminal pane. */
export function newPane(name: string): WebTerminalPane {
  const now = new Date().toISOString();
  return {
    id: `pane-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    lines: [
      {
        id: `line-info-${Date.now()}`,
        kind: "info",
        text: `New terminal pane: ${name}`,
        createdAt: now,
      },
    ],
    input: "",
    history: [],
    historyIndex: -1,
    cwd: "/",
  };
}
