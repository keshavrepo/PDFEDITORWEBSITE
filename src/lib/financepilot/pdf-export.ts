/**
 * FinancePilot PDF export.
 *
 * The platform does not ship a client-side PDF renderer, so the
 * "Export PDF" action opens a styled HTML window and calls
 * `window.print()`. The browser's "Save as PDF" destination produces
 * a real PDF that matches what the user sees on screen.
 *
 * The same pattern is used by OfficePilot's `printWordDocument`. The
 * export deliberately relies on the browser's built-in print pipeline
 * so the foundation stays lightweight and never has to bundle a
 * renderer.
 */

import type {
  FinanceCalculation,
  FinanceChartSeries,
  FinanceEvaluation,
  FinanceScheduleRow,
} from "./types";

interface PdfExportInput {
  calculation: FinanceCalculation;
  evaluation: FinanceEvaluation;
  /** A short headline shown above the calculation summary. */
  title: string;
  /** A short subtitle (e.g. "EMI Calculator" or "Loan Calculator"). */
  subtitle: string;
  /** Human-readable labels for the input fields, in display order. */
  inputs: Array<{ label: string; value: string }>;
}

const CURRENCY = "₹";

/**
 * Builds the printable HTML for a calculation. Returns a string so
 * callers can decide how to deliver it (open a new window, embed in
 * a hidden iframe, etc.).
 */
export function buildFinancePrintHtml(input: PdfExportInput): string {
  const { calculation, evaluation, title, subtitle, inputs } = input;
  const updatedAt = calculation.meta.autosavedAt ?? calculation.meta.updatedAt;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #0a0a0a; margin: 0; padding: 32px; }
header { border-bottom: 1px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 24px; }
.eyebrow { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #737373; }
h1 { font-size: 24px; margin: 4px 0 0 0; font-weight: 600; }
h2 { font-size: 16px; margin: 0; font-weight: 500; color: #525252; }
.meta { font-size: 11px; color: #737373; margin-top: 8px; }
section { margin-bottom: 24px; }
section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #737373; margin: 0 0 8px 0; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: left; font-variant-numeric: tabular-nums; }
th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #737373; font-weight: 600; }
td.num { text-align: right; font-family: ui-monospace, SFMono-Regular, monospace; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
dl { margin: 0; display: grid; grid-template-columns: 1fr auto; row-gap: 4px; }
dt { color: #525252; }
dd { margin: 0; font-family: ui-monospace, SFMono-Regular, monospace; font-variant-numeric: tabular-nums; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.chart-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; }
footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #737373; }
@media print {
  body { padding: 0; }
  section { page-break-inside: avoid; }
}
</style>
</head>
<body>
<header>
<p class="eyebrow">FinancePilot</p>
<h1>${escapeHtml(title)}</h1>
<h2>${escapeHtml(subtitle)}</h2>
<p class="meta">${updatedAt ? `Generated ${escapeHtml(new Date(updatedAt).toLocaleString())}` : "Generated just now"}</p>
</header>

<section>
<h3>Inputs</h3>
<dl>
${inputs
  .map(
    (entry) =>
      `<dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd>`
  )
  .join("")}
</dl>
</section>

<section>
<h3>Result</h3>
${
  evaluation.ok
    ? `<dl>${evaluation.lines
        .map(
          (line) =>
            `<dt>${escapeHtml(line.label)}</dt><dd>${escapeHtml(line.value)}</dd>`
        )
        .join("")}</dl>`
    : `<p>${escapeHtml(evaluation.error ?? "No result.")}</p>`
}
</section>

${renderScheduleSection(evaluation.schedule)}
${renderChartSection(evaluation.series)}

<footer>
FinancePilot · Generated client-side. The browser's "Save as PDF" print
destination produces the PDF file.
</footer>
</body>
</html>`;
}

function renderScheduleSection(schedule: FinanceScheduleRow[] | undefined): string {
  if (!schedule || schedule.length === 0) return "";
  // Cap at 60 rows so the printout stays on a sensible number of pages.
  const rows = schedule.slice(0, 60);
  const isAmortisation = rows[0]?.payment > 0;
  return `<section>
<h3>Schedule${isAmortisation ? "" : " (yearly)"}</h3>
<table>
<thead>
<tr>
<th>Period</th>
${isAmortisation ? "<th class='num'>Payment</th>" : ""}
<th class='num'>Interest</th>
${isAmortisation ? "<th class='num'>Principal</th><th class='num'>Balance</th>" : "<th class='num'>Balance</th>"}
</tr>
</thead>
<tbody>
${rows
  .map(
    (row) =>
      `<tr><td>${row.period}</td>${isAmortisation ? `<td class='num'>${formatCurrency(row.payment)}</td>` : ""}<td class='num'>${formatCurrency(row.interest)}</td>${isAmortisation ? `<td class='num'>${formatCurrency(row.principal)}</td><td class='num'>${formatCurrency(row.balance)}</td>` : `<td class='num'>${formatCurrency(row.balance)}</td>`}</tr>`
  )
  .join("")}
</tbody>
</table>
${
  schedule.length > 60
    ? `<p class="meta">Showing the first 60 of ${schedule.length} rows.</p>`
    : ""
}
</section>`;
}

function renderChartSection(series: FinanceChartSeries[] | undefined): string {
  if (!series || series.length === 0) return "";
  return `<section>
<h3>Chart</h3>
<div class="chart-card">
${renderSparkSvg(series)}
</div>
</section>`;
}

/**
 * A tiny inline SVG spark chart so the printed PDF always has a
 * visual even when the browser strips the interactive line chart.
 */
function renderSparkSvg(series: FinanceChartSeries[]): string {
  const width = 480;
  const height = 160;
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  const maxValue = all.length === 0 ? 1 : Math.max(...all, 1);
  const palette = ["#0a0a0a", "#737373", "#0ea5e9", "#22c55e"];
  const paths = series
    .map((entry, index) => {
      const color = palette[index % palette.length];
      const len = entry.points.length;
      if (len === 0) return "";
      const step = len === 1 ? 0 : (width - 24) / (len - 1);
      const d = entry.points
        .map(
          (point, pointIndex) => {
            const x = 12 + pointIndex * step;
            const y = height - 12 - ((height - 24) * point.value) / maxValue;
            return `${pointIndex === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
          }
        )
        .join(" ");
      return `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" />`;
    })
    .join("");
  const legend = series
    .map(
      (entry, index) =>
        `<tspan x="${index * 130}" fill="${palette[index % palette.length]}">● ${escapeHtml(entry.name)}</tspan>`
    )
    .join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths}<text x="12" y="${height - 1}" font-size="10" font-family="ui-monospace, SFMono-Regular, monospace">${legend}</text></svg>`;
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${CURRENCY}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Opens a new window with the printable HTML and triggers the
 * browser's print dialog. The user can pick "Save as PDF" as the
 * destination to produce a real PDF file.
 */
export function printFinanceCalculation(input: PdfExportInput): void {
  if (typeof window === "undefined") return;
  const html = buildFinancePrintHtml(input);
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    // The popup was blocked. Fall back to a hidden iframe so the user
    // still gets a print dialog.
    const frame = window.document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.setAttribute("aria-hidden", "true");
    window.document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      frame.contentWindow?.addEventListener("load", () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      });
      window.setTimeout(() => {
        window.document.body.removeChild(frame);
      }, 30_000);
    }
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener("load", () => {
    win.focus();
    win.print();
  });
  // Some browsers do not fire `load` after `document.write`; queue a
  // fallback so the dialog still opens.
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // The window may have been closed by the user.
    }
  }, 400);
}
