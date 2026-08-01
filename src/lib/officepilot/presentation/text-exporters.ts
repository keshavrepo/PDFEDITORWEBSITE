/**
 * OfficePilot Presentation text-based exporters.
 *
 * HTML export (which is also the print preview for PDF) and a plain
 * text export. The PDF export uses the browser's print dialog against
 * the rendered HTML.
 */

import {
  PRESENTATION_THEMES,
  type PresentationBackground,
  type PresentationBlock,
  type PresentationBody,
  type PresentationRun,
  type PresentationSlide,
} from "./schema";

/** Resolves a background to a CSS background value. */
function backgroundCss(background: PresentationBackground): string {
  if (background.kind === "color") {
    return background.color;
  }
  return `linear-gradient(${background.angle ?? 135}deg, ${background.color}, ${background.color2 ?? background.color})`;
}

/** Renders an inline run as HTML. */
function runsToHtml(runs: PresentationRun[]): string {
  return runs
    .map((run) => {
      let html = escapeHtml(run.text);
      if (run.bold) html = `<strong>${html}</strong>`;
      if (run.italic) html = `<em>${html}</em>`;
      if (run.underline) html = `<u>${html}</u>`;
      if (run.color) html = `<span style="color:${escapeHtml(run.color)}">${html}</span>`;
      if (run.font) html = `<span style="font-family:${escapeHtml(run.font)}">${html}</span>`;
      if (run.fontSize) html = `<span style="font-size:${escapeHtml(String(run.fontSize))}px">${html}</span>`;
      if (run.href) html = `<a href="${escapeHtml(run.href)}" style="color:inherit;text-decoration:underline">${html}</a>`;
      return html;
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Renders a single content block as HTML. */
function blockToHtml(block: PresentationBlock): string {
  switch (block.type) {
    case "text":
      return `<div class="slide-text">${runsToHtml(block.runs)}</div>`;
    case "bullets": {
      const items = block.items
        .map((item) => `<li>${runsToHtml(item)}</li>`)
        .join("");
      return `<ul class="slide-bullets">${items}</ul>`;
    }
    case "shape": {
      const styles = [
        `position:absolute`,
        `left:${block.x}%`,
        `top:${block.y}%`,
        `width:${block.width}%`,
        `height:${block.height}%`,
        block.fill ? `background:${block.fill}` : "",
        block.stroke ? `border:1px solid ${block.stroke}` : "",
      ].filter(Boolean).join(";");
      return `<div class="slide-shape" style="${styles}">${block.text ? runsToHtml(block.text) : ""}</div>`;
    }
    case "image": {
      return `<img class="slide-image" style="position:absolute;left:${block.x}%;top:${block.y}%;width:${block.width}%;height:${block.height}%;object-fit:cover" src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" />`;
    }
    case "table": {
      const head = block.header
        ? `<tr>${block.rows[0]?.map((cell) => `<th style="background:${block.headerFill ?? "#0a0a0a"};color:#fafafa;padding:6px 10px;text-align:left;font-weight:600">${escapeHtml(cell)}</th>`).join("") ?? ""}</tr>`
        : "";
      const body = block.header ? block.rows.slice(1) : block.rows;
      const bodyHtml = body
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td style="border-top:1px solid #e5e5e5;padding:6px 10px">${escapeHtml(cell)}</td>`).join("")}</tr>`
        )
        .join("");
      return `<table class="slide-table" style="border-collapse:collapse;width:${block.width}%;position:absolute;left:${block.x}%;top:${block.y}%;font-size:14px"><tbody>${head}${bodyHtml}</tbody></table>`;
    }
  }
}

/** Renders one slide as HTML. */
function slideToHtml(slide: PresentationSlide, deckFont: string, deckFontColor: string, defaultBackground: PresentationBackground): string {
  const background = slide.background ?? defaultBackground;
  const isDark =
    (background.kind === "color" && isLikelyDark(background.color)) ||
    (background.kind === "gradient" && isLikelyDark(background.color));
  const textColor = isDark ? "#fafafa" : deckFontColor;
  const backgroundValue = backgroundCss(background);
  return `
<section class="slide" style="position:relative;width:1280px;height:720px;margin:24px auto;background:${backgroundValue};color:${textColor};font-family:${escapeHtml(deckFont)};padding:60px 80px;box-shadow:0 12px 32px rgba(0,0,0,0.08);page-break-after:always;overflow:hidden">
  <h1 style="font-size:44px;font-weight:700;margin:0 0 12px;letter-spacing:-0.02em">${escapeHtml(slide.title)}</h1>
  ${slide.subtitle ? `<p style="font-size:18px;font-style:italic;margin:0 0 24px;opacity:0.85">${escapeHtml(slide.subtitle)}</p>` : ""}
  <div class="slide-body" style="position:relative;min-height:480px;margin-top:24px">
    ${slide.blocks.map(blockToHtml).join("")}
  </div>
  ${slide.notes ? `<aside class="slide-notes" style="position:absolute;bottom:20px;left:80px;right:80px;font-size:11px;opacity:0.65;border-top:1px solid currentColor;padding-top:8px">Notes: ${escapeHtml(slide.notes)}</aside>` : ""}
</section>`;
}

/** Returns true if the colour is dark enough that white text reads better. */
function isLikelyDark(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.55;
}

/** Returns a self-contained HTML deck for the presentation. */
export function exportPresentationToHtml(body: PresentationBody, meta: { title: string }): Blob {
  const palette = PRESENTATION_THEMES[body.settings.theme];
  const slidesHtml = body.slides
    .map((slide) => slideToHtml(slide, body.settings.fontFamily, palette.fontColor, body.settings.background))
    .join("\n");
  const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.title)}</title>
<style>
  body { margin: 0; padding: 32px; background: #f5f5f5; color: #0a0a0a; font-family: ${escapeHtml(body.settings.fontFamily)}, system-ui, sans-serif; }
  .slide-bullets { padding-left: 1.5em; font-size: 18px; line-height: 1.6; }
  .slide-bullets li { margin: 0.4em 0; }
  .slide-text { font-size: 18px; line-height: 1.6; }
  @media print {
    body { background: #fff; padding: 0; }
    .slide { box-shadow: none !important; margin: 0 !important; }
  }
</style>
</head>
<body>
  <header style="max-width:1280px;margin:0 auto 24px;text-align:center">
    <p style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;margin:0 0 4px;opacity:0.6">OfficePilot Presentation</p>
    <h2 style="font-size:18px;margin:0">${escapeHtml(meta.title)}</h2>
  </header>
  <main>${slidesHtml}</main>
</body>
</html>`;
  return new Blob([full], { type: "text/html;charset=utf-8" });
}

/** Returns a plain-text version of the deck. */
export function exportPresentationToText(body: PresentationBody): Blob {
  const lines: string[] = [];
  lines.push(`${body.slides.length} slides`);
  body.slides.forEach((slide, index) => {
    lines.push("");
    lines.push(`Slide ${index + 1}: ${slide.title}`);
    if (slide.subtitle) lines.push(slide.subtitle);
    for (const block of slide.blocks) {
      if (block.type === "text") {
        lines.push(block.runs.map((run) => run.text).join(""));
      } else if (block.type === "bullets") {
        for (const item of block.items) {
          lines.push(`- ${item.map((run) => run.text).join("")}`);
        }
      } else if (block.type === "image") {
        lines.push(`[Image: ${block.alt || "image"}]`);
      } else if (block.type === "shape") {
        lines.push(`[Shape: ${block.kind}]`);
      } else if (block.type === "table") {
        lines.push("[Table]");
        for (const row of block.rows) {
          lines.push(row.join(" | "));
        }
      }
    }
    if (slide.notes) {
      lines.push(`Notes: ${slide.notes}`);
    }
  });
  return new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
}

/** Triggers the browser print dialog with the rendered HTML. */
export function printPresentationDocument(body: PresentationBody, meta: { title: string }): void {
  if (typeof document === "undefined") return;
  const html = exportPresentationToHtml(body, meta);
  void html; // not used directly, kept for type safety
  const win = window.open("", "_blank", "width=1280,height=900");
  if (!win) return;
  void html.text().then((text) => {
    win.document.open();
    win.document.write(text);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  });
}
