"use client";

/**
 * OfficePilot Spreadsheet properties panel.
 *
 * Reads the active workbook and surfaces the metadata the user can see
 * at a glance: title, version, last-saved timestamp, sheet count, row
 * and column counts, formula count, cell counts, and a per-sheet
 * summary.
 *
 * The properties panel is read-only; the toolbar is the single place
 * that mutates the document.
 */

import { useMemo } from "react";
import type { OfficeDocument } from "@/lib/officepilot";
import { asSheetBody } from "@/lib/officepilot/spreadsheet/schema";
import { computeSheetStats } from "@/lib/officepilot/spreadsheet/stats";
import { getActiveSheet } from "@/lib/officepilot/spreadsheet/cells";

export function SpreadsheetProperties({ document }: { document: OfficeDocument }) {
  const body = asSheetBody(document.body);
  const stats = useMemo(() => computeSheetStats(body), [body]);
  const activeSheet = getActiveSheet(body);
  const updatedAt = document.meta.autosavedAt ?? document.meta.updatedAt;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workbook
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Title</dt>
            <dd className="truncate text-right font-medium" title={document.meta.title}>
              {document.meta.title}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium capitalize">{document.meta.category.replace("-", " ")}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="tabular-nums font-medium">v{document.meta.version}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Sheets</dt>
            <dd className="tabular-nums font-medium">{stats.sheetCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Last saved</dt>
            <dd className="tabular-nums">{updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active sheet
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="truncate text-right font-medium">{activeSheet.name}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Rows</dt>
            <dd className="tabular-nums font-medium">{stats.rows.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Columns</dt>
            <dd className="tabular-nums font-medium">{stats.columns.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Filled cells</dt>
            <dd className="tabular-nums font-medium">{stats.filledCells.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Formulas</dt>
            <dd className="tabular-nums font-medium">{stats.formulaCells.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Numeric cells</dt>
            <dd className="tabular-nums font-medium">{stats.numericCells.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Text cells</dt>
            <dd className="tabular-nums font-medium">{stats.textCells.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sheets
        </h3>
        <ul className="space-y-1.5">
          {body.sheets.map((sheet) => {
            const filled = Object.keys(sheet.cells).length;
            const isActive = sheet.id === body.settings.activeSheetId;
            return (
              <li
                key={sheet.id}
                className={
                  isActive
                    ? "rounded border border-foreground/30 bg-background px-2 py-1.5"
                    : "rounded border border-transparent px-2 py-1.5"
                }
              >
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium">{sheet.name}</span>
                  {isActive && <span className="text-[10px] text-muted-foreground">Active</span>}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{sheet.rowCount} × {sheet.columnCount}</span>
                  <span>{filled.toLocaleString()} cells</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workbook settings
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Default font</dt>
            <dd className="font-medium">{body.settings.fontFamily}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Default size</dt>
            <dd className="tabular-nums font-medium">{body.settings.fontSize}pt</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Locale</dt>
            <dd className="font-medium uppercase">{body.settings.locale}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
