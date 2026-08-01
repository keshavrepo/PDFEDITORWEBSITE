"use client";

/**
 * OfficePilot Presentation properties panel.
 */

import { useMemo } from "react";
import type { OfficeDocument } from "@/lib/officepilot";
import { asPresentationBody } from "@/lib/officepilot/presentation/schema";
import { computePresentationStats } from "@/lib/officepilot/presentation/stats";

export function PresentationProperties({ document }: { document: OfficeDocument }) {
  const body = asPresentationBody(document.body);
  const stats = useMemo(() => computePresentationStats(body), [body]);
  const updatedAt = document.meta.autosavedAt ?? document.meta.updatedAt;
  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deck</h3>
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
            <dt className="text-muted-foreground">Last saved</dt>
            <dd className="tabular-nums">{updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Statistics</h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Slides</dt>
            <dd className="tabular-nums font-medium">{stats.slideCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Blocks</dt>
            <dd className="tabular-nums font-medium">{stats.totalBlocks}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Words</dt>
            <dd className="tabular-nums font-medium">{stats.totalWords.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Characters</dt>
            <dd className="tabular-nums font-medium">{stats.totalCharacters.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Images</dt>
            <dd className="tabular-nums font-medium">{stats.imageCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Shapes</dt>
            <dd className="tabular-nums font-medium">{stats.shapeCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Tables</dt>
            <dd className="tabular-nums font-medium">{stats.tableCount}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Theme</h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Theme</dt>
            <dd className="font-medium capitalize">{body.settings.theme}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Aspect</dt>
            <dd className="font-medium">{body.settings.aspect}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Font</dt>
            <dd className="font-medium">{body.settings.fontFamily}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
