"use client";

/**
 * OfficePilot Word properties panel.
 *
 * Reads the active document and surfaces the metadata the user can see at
 * a glance: title, version, last-saved timestamp, character / word /
 * paragraph / page / reading-time counts and document-wide settings.
 *
 * The settings (font family, font size, line spacing, page size, language
 * and page numbering) are read-only in the panel so the user can see
 * them without accidentally changing them — the toolbar is the single
 * place that mutates them.
 */

import { useMemo } from "react";
import type { OfficeDocument } from "@/lib/officepilot";
import { asWordBody, type WordBody } from "@/lib/officepilot/word/schema";
import { computeWordStats } from "@/lib/officepilot/word/stats";

interface WordPropertiesProps {
  document: OfficeDocument;
}

export function WordProperties({ document }: WordPropertiesProps) {
  const body: WordBody = asWordBody(document.body);
  const stats = useMemo(() => computeWordStats(body), [body]);
  const updatedAt = document.meta.autosavedAt ?? document.meta.updatedAt;
  const { settings } = body;

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Document
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
            <dd className="font-medium capitalize">
              {document.meta.category.replace("-", " ")}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="tabular-nums font-medium">v{document.meta.version}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Pages</dt>
            <dd className="tabular-nums font-medium">{stats.pages}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Last saved</dt>
            <dd className="tabular-nums">
              {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Statistics
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Characters</dt>
            <dd className="tabular-nums font-medium">{stats.characters.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Characters (with spaces)</dt>
            <dd className="tabular-nums font-medium">
              {stats.charactersWithSpaces.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Words</dt>
            <dd className="tabular-nums font-medium">{stats.words.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Blocks</dt>
            <dd className="tabular-nums font-medium">{stats.blocks}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Reading time</dt>
            <dd className="tabular-nums font-medium">
              {stats.readingTimeMinutes} min
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Page
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="font-medium">
              {settings.page.widthMm} × {settings.page.heightMm} mm
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Margins</dt>
            <dd className="text-right font-medium">
              {settings.page.marginTopMm}/{settings.page.marginRightMm}/
              <br />
              {settings.page.marginBottomMm}/{settings.page.marginLeftMm} mm
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Page numbers</dt>
            <dd className="font-medium">{settings.pageNumber ? "On" : "Off"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Typography
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Font</dt>
            <dd className="font-medium">{settings.fontFamily}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="tabular-nums font-medium">{settings.fontSize}pt</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Line spacing</dt>
            <dd className="tabular-nums font-medium">{settings.lineSpacing.toFixed(2)}×</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Language</dt>
            <dd className="font-medium uppercase">{settings.language ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
