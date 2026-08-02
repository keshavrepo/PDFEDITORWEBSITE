import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { DevWorkspace } from "@/components/devpilot/workspace";
import { BlankSurface } from "@/components/devpilot/surfaces/blank";
import { SnippetSurface } from "@/components/devpilot/surfaces/snippet";
import { HistorySurface } from "@/components/devpilot/surfaces/history";
import { WorkspaceDashboard } from "@/components/devpilot/surfaces/workspace-dashboard";
import {
  focusedSessions,
  getSessionBySlug,
  type DevSessionDefinition,
} from "@/lib/devpilot";
import { platform } from "@/lib/products";

export const dynamic = "force-dynamic";

/**
 * One route serving every DevPilot session. Each kind is a
 * configuration of the same workspace shell, so they share this page
 * rather than each getting a near-identical copy of it.
 *
 * Mirrors /app/socialpilot/[project]/page.tsx.
 */
export function generateStaticParams() {
  return focusedSessions.map((session) => ({
    project: session.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ project: string }>;
}): Promise<Metadata> {
  const { project: slug } = await params;
  const entry = getSessionBySlug(slug);
  if (!entry) return {};
  return {
    title: `${entry.name} — DevPilot | ${platform.name}`,
    description: entry.description,
    alternates: { canonical: `/devpilot/${entry.slug}` },
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
 * Future sessions only need to be added here; the route stays the
 * same.
 */
function pickSurface(session: DevSessionDefinition): SurfaceComponent {
  switch (session.kind) {
    case "snippet":
      return SnippetSurface as unknown as SurfaceComponent;
    case "history":
      return HistorySurface as unknown as SurfaceComponent;
    case "blank":
    default:
      return WorkspaceDashboard as unknown as SurfaceComponent;
  }
}

export default async function DevPilotProjectPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const entry = getSessionBySlug(slug);
  if (!entry) notFound();

  const user = await getSession();
  const Surface = pickSurface(entry);

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">DevPilot {entry.name}</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <DevWorkspace kind={entry.kind} Surface={Surface} />
        </div>
      </main>
    </>
  );
}
