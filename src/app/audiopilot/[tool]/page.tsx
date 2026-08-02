import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { AudioWorkspace } from "@/components/audiopilot/workspace";
import { BlankSurface } from "@/components/audiopilot/surfaces/blank";
import { AudioPlayerSurface } from "@/components/audiopilot/surfaces/player";
import { AudioTrimmerSurface } from "@/components/audiopilot/surfaces/trimmer";
import { AudioConverterSurface } from "@/components/audiopilot/surfaces/converter";
import { AudioRecorderSurface } from "@/components/audiopilot/surfaces/recorder";
import {
  focusedSessions,
  getSessionBySlug,
  type AudioSessionKind,
} from "@/lib/audiopilot";
import { platform } from "@/lib/products";

export const dynamic = "force-dynamic";

/**
 * One route serving every AudioPilot tool. Each kind is a
 * configuration of the same workspace shell, so they share this
 * page rather than each getting a near-identical copy of it.
 */
export function generateStaticParams() {
  return focusedSessions.map((session) => ({
    tool: session.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool: slug } = await params;
  const entry = getSessionBySlug(slug);
  if (!entry) return {};
  return {
    title: `${entry.name} — AudioPilot | ${platform.name}`,
    description: entry.description,
    alternates: { canonical: `/audiopilot/${entry.slug}` },
  };
}

/** Surface contract used by the workspace shell. */
type SurfaceComponent = React.ComponentType<{
  session: Parameters<typeof BlankSurface>[0]["session"];
  onChange: Parameters<typeof BlankSurface>[0]["onChange"];
}>;

/**
 * Resolves a session to its surface component.
 *
 * Future audio tools only need to be added here; the route stays
 * the same.
 */
function pickSessionComponents(kind: AudioSessionKind): {
  Surface: SurfaceComponent;
} | null {
  switch (kind) {
    case "player":
      return {
        Surface: AudioPlayerSurface as unknown as SurfaceComponent,
      };
    case "trimmer":
      return {
        Surface: AudioTrimmerSurface as unknown as SurfaceComponent,
      };
    case "converter":
      return {
        Surface: AudioConverterSurface as unknown as SurfaceComponent,
      };
    case "recorder":
      return {
        Surface: AudioRecorderSurface as unknown as SurfaceComponent,
      };
    default:
      return null;
  }
}

export default async function AudioPilotToolPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool: slug } = await params;
  const entry = getSessionBySlug(slug);
  if (!entry) notFound();

  const components = pickSessionComponents(entry.kind);
  // Fall back to the blank surface so the workspace never crashes
  // if a session descriptor is added without a surface.
  const Surface = components?.Surface ?? BlankSurface;

  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">AudioPilot {entry.name}</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <AudioWorkspace kind={entry.kind} Surface={Surface} />
        </div>
      </main>
    </>
  );
}
