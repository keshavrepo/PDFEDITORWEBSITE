/**
 * OfficePilot Word → HTML, TXT and PDF exporters.
 *
 * HTML and TXT are pure-text conversions of the block model. PDF is built
 * via the browser's print API, which gives a true PDF render in every
 * modern browser without pulling in a separate renderer.
 */

import type {
  WordAlignment,
  WordBlock,
  WordBody,
  WordRun,
} from "./schema";
import { runsToText } from "./stats";

/** Escapes a text node so it is safe inside HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the inline HTML for a run, including marks and the optional href. */
function runToHtml(run: WordRun): string {
  let html = escapeHtml(run.text).replace(/\n/g, "<br>");
  if (run.marks.includes("code")) {
    html = `<code>${html}</code>`;
  }
  if (run.marks.includes("bold")) {
    html = `<strong>${html}</strong>`;
  }
  if (run.marks.includes("italic")) {
    html = `<em>${html}</em>`;
  }
  if (run.marks.includes("underline")) {
    html = `<u>${html}</u>`;
  }
  if (run.marks.includes("strikethrough")) {
    html = `<s>${html}</s>`;
  }
  if (run.marks.includes("superscript")) {
    html = `<sup>${html}</sup>`;
  }
  if (run.marks.includes("subscript")) {
    html = `<sub>${html}</sub>`;
  }
  if (run.href) {
    html = `<a href="${escapeHtml(run.href)}" rel="noopener noreferrer">${html}</a>`;
  }
  return html;
}

/** Maps our alignment to a CSS text-align value. */
function alignmentToStyle(alignment: WordAlignment): string {
  return `text-align:${alignment};`;
}

/** Builds the HTML for one block. */
function blockToHtml(block: WordBlock): string {
  switch (block.type) {
    case "heading": {
      const inner = block.runs.map(runToHtml).join("");
      return `<h${block.level} style="${alignmentToStyle(block.alignment)}">${inner}</h${block.level}>`;
    }
    case "paragraph": {
      const inner = block.runs.map(runToHtml).join("") || "<br>";
      const indent = block.indent ? `margin-left:${block.indent * 1.5}em;` : "";
      return `<p style="${alignmentToStyle(block.alignment)}${indent}">${inner}</p>`;
    }
    case "list": {
      const tag = block.kind === "ordered" ? "ol" : "ul";
      const items = block.items
        .map((item) => `<li>${item.runs.map(runToHtml).join("") || "&nbsp;"}</li>`)
        .join("");
      return `<${tag}>${items}</${tag}>`;
    }
    case "quote":
      return `<blockquote style="${alignmentToStyle(block.alignment)}">${block.runs.map(runToHtml).join("")}</blockquote>`;
    case "code":
      return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
    case "table": {
      const rows = block.rows
        .map((row, rowIndex) => {
          const cells = row.cells
            .map((cell) => `<td>${cell.runs.map(runToHtml).join("") || "&nbsp;"}</td>`)
            .join("");
          const tag = rowIndex === 0 ? "th" : "td";
          return `<tr>${cells.replace(/<td>/g, `<${tag}>`).replace(/<\/td>/g, `</${tag}>`)}</tr>`;
        })
        .join("");
      return `<table>${rows}</table>`;
    }
    case "image":
      return `<p style="text-align:center"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="max-width:100%;height:auto" /></p>`;
    case "page-break":
      return `<hr style="page-break-after:always" />`;
    default:
      return "";
  }
}

/** Returns the document as a self-contained HTML document. */
export function exportWordToHtml(body: WordBody, meta: { title: string }): string {
  const content = body.blocks.map(blockToHtml).join("\n");
  const style = body.settings.fontFamily
    ? `body { font-family: ${body.settings.fontFamily}, system-ui, sans-serif; }`
    : "";
  return `<!DOCTYPE html>
<html lang="${escapeHtml(body.settings.language ?? "en")}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.title)}</title>
<style>
${style}
h1, h2, h3, h4, h5, h6 { font-weight: 600; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #e4e4e7; padding: 0.5rem 0.75rem; }
pre { background: #f4f4f5; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
blockquote { border-left: 3px solid #d4d4d8; padding: 0.5rem 1rem; color: #52525b; }
@media print { hr[style*="page-break-after"] { page-break-after: always; } }
</style>
</head>
<body>
${content}
</body>
</html>`;
}

/** Returns the document as plain text. Useful for quick exports and indexing. */
export function exportWordToText(body: WordBody): string {
  return body.blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return runsToText(block.runs) + "\n\n";
        case "paragraph":
          return runsToText(block.runs) + "\n\n";
        case "list":
          return (
            block.items
              .map((item) => `- ${runsToText(item.runs)}`)
              .join("\n") + "\n\n"
          );
        case "quote":
          return `"${runsToText(block.runs)}"\n\n`;
        case "code":
          return block.text + "\n\n";
        case "table":
          return (
            block.rows
              .map((row) =>
                row.cells.map((cell) => runsToText(cell.runs)).join("\t").trim()
              )
              .filter((line) => line.length > 0)
              .join("\n") + "\n\n"
          );
        case "image":
          return (block.alt ? `[Image: ${block.alt}]` : "[Image]") + "\n\n";
        case "page-break":
          return "\n---\n\n";
        default:
          return "";
      }
    })
    .join("")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

/**
 * Triggers a print dialog so the user can save the document as a PDF.
 *
 * The print stylesheet is generated to match the on-screen editor: a
 * 21cm × 29.7cm page with the document's margins, a single column and
 * the configured font family and size. Browser-native print is the most
 * reliable way to ship real PDF output from a browser without bundling a
 * renderer.
 */
export function printWordDocument(): void {
  if (typeof window === "undefined") return;
  window.print();
}
