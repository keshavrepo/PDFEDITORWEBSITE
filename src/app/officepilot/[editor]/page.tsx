import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { OfficeWorkspace } from "@/components/officepilot/workspace";
import { WordSurface } from "@/components/officepilot/surfaces/word";
import { WordProperties } from "@/components/officepilot/properties/word";
import { SpreadsheetSurface } from "@/components/officepilot/surfaces/spreadsheet";
import { SpreadsheetProperties } from "@/components/officepilot/properties/spreadsheet";
import { PresentationSurface } from "@/components/officepilot/surfaces/presentation";
import { PresentationProperties } from "@/components/officepilot/properties/presentation";
import { getEditorBySlug, editors } from "@/lib/officepilot";
import { platform } from "@/lib/products";

export const dynamic = "force-dynamic";

/**
 * One route serving every OfficePilot editor kind. Each kind is a
 * configuration of the same workspace shell, so they share this page
 * rather than each getting a near-identical copy of it.
 */
export function generateStaticParams() {
  return editors
    .filter((editor) => editor.kind !== "word")
    .map((editor) => ({ editor: editor.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ editor: string }>;
}): Promise<Metadata> {
  const { editor: slug } = await params;
  const editor = getEditorBySlug(slug);
  if (!editor) return {};
  return {
    title: `${editor.name} — OfficePilot | ${platform.name}`,
    description: editor.description,
    alternates: { canonical: `/officepilot/${editor.slug}` },
  };
}

export default async function OfficePilotEditorPage({
  params,
}: {
  params: Promise<{ editor: string }>;
}) {
  const { editor: slug } = await params;
  const editor = getEditorBySlug(slug);
  if (!editor) notFound();

  const user = await getSession();

  const { Surface, Properties } = pickSurface(editor.kind);

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">OfficePilot {editor.name}</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <OfficeWorkspace kind={editor.kind} Surface={Surface} Properties={Properties} />
        </div>
      </main>
    </>
  );
}

function pickSurface(kind: "word" | "spreadsheet" | "presentation") {
  switch (kind) {
    case "word":
      return { Surface: WordSurface, Properties: WordProperties };
    case "spreadsheet":
      return { Surface: SpreadsheetSurface, Properties: SpreadsheetProperties };
    case "presentation":
      return { Surface: PresentationSurface, Properties: PresentationProperties };
  }
}
