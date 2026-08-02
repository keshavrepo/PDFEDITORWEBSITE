/**
 * Professional Search helpers.
 *
 * Pure functions that the Search surface uses to find text inside
 * the project and to replace matches in place. The search shares
 * the same match logic with the in-editor find bar (regex, match
 * case, whole word) so the user can move between the two without
 * re-learning the controls.
 *
 * Every match is a `WebSearchMatch` so the surface can render the
 * match list with file path, line number and a preview.
 */

import type {
  WebProjectFile,
  WebSearchMatch,
  WebWorkspaceClosedTab,
} from "../types";
import { findAllInText, replaceInText, type FindOptions } from "./code-editor";

export function buildFileMatches(
  file: WebProjectFile,
  query: string,
  options: FindOptions
): WebSearchMatch[] {
  if (!query) return [];
  const matches = findAllInText(file.source, query, options);
  return matches.map((entry) => {
    const lineStart = file.source.lastIndexOf("\n", entry.start - 1) + 1;
    const lineEnd =
      file.source.indexOf("\n", entry.end) === -1
        ? file.source.length
        : file.source.indexOf("\n", entry.end);
    const lineText = file.source.slice(lineStart, lineEnd);
    const column = entry.start - lineStart;
    return {
      path: file.path,
      fileKind: file.kind,
      line:
        file.source.slice(0, lineStart).split("\n").length,
      column,
      lineText,
      matchStart: column,
      matchEnd: column + (entry.end - entry.start),
    };
  });
}

export function buildProjectMatches(
  files: WebProjectFile[],
  query: string,
  options: FindOptions
): WebSearchMatch[] {
  if (!query) return [];
  const out: WebSearchMatch[] = [];
  for (const file of files) {
    out.push(...buildFileMatches(file, query, options));
  }
  return out;
}

export interface ApplyReplaceResult {
  file: WebProjectFile;
  replacements: number;
}

export function applyReplaceInFile(
  file: WebProjectFile,
  query: string,
  replacement: string,
  options: FindOptions & { replaceAll: boolean }
): ApplyReplaceResult {
  const { next, count } = replaceInText(file.source, query, replacement, {
    caseSensitive: options.caseSensitive,
    wholeWord: options.wholeWord,
    regex: options.regex,
    replaceAll: options.replaceAll,
  });
  if (count === 0) return { file, replacements: 0 };
  return {
    file: {
      ...file,
      source: next,
      updatedAt: new Date().toISOString(),
    },
    replacements: count,
  };
}

export function applyReplaceAll(
  files: WebProjectFile[],
  query: string,
  replacement: string,
  options: FindOptions
): { files: WebProjectFile[]; replacements: number } {
  if (!query) return { files, replacements: 0 };
  let total = 0;
  const next = files.map((file) => {
    const result = applyReplaceInFile(file, query, replacement, {
      ...options,
      replaceAll: true,
    });
    total += result.replacements;
    return result.file;
  });
  return { files: next, replacements: total };
}

/* -------------------------------------------------------------------------- */
/* Tab history (close / reopen)                                              */
/* -------------------------------------------------------------------------- */

export function pushClosedTab(
  closedTabs: WebWorkspaceClosedTab[],
  path: string,
  fileKind: "html" | "css" | "javascript"
): WebWorkspaceClosedTab[] {
  if (!path) return closedTabs;
  const entry: WebWorkspaceClosedTab = {
    path,
    fileKind,
    closedAt: new Date().toISOString(),
  };
  const next = [entry, ...closedTabs.filter((other) => other.path !== path)];
  return next.slice(0, 20);
}

export function popClosedTab(
  closedTabs: WebWorkspaceClosedTab[]
): { tab: WebWorkspaceClosedTab | null; rest: WebWorkspaceClosedTab[] } {
  if (closedTabs.length === 0) return { tab: null, rest: closedTabs };
  return { tab: closedTabs[0]!, rest: closedTabs.slice(1) };
}
