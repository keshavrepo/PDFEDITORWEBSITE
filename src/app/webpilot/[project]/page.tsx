import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { WebWorkspace } from "@/components/webpilot/workspace";
import { BlankSurface } from "@/components/webpilot/surfaces/blank";
import { HistorySurface } from "@/components/webpilot/surfaces/history";
import { HtmlSurface } from "@/components/webpilot/surfaces/html";
import { CssSurface } from "@/components/webpilot/surfaces/css";
import { JsSurface } from "@/components/webpilot/surfaces/javascript";
import { PreviewSurface } from "@/components/webpilot/surfaces/preview";
import { ProjectsSurface } from "@/components/webpilot/surfaces/projects";
import { AssetsSurface } from "@/components/webpilot/surfaces/assets";
import { WorkspaceSurface } from "@/components/webpilot/surfaces/workspace";
import { SearchSurface } from "@/components/webpilot/surfaces/search";
import { UtilitiesSurface } from "@/components/webpilot/surfaces/utilities";
import { WorkspaceDashboard } from "@/components/webpilot/surfaces/workspace-dashboard";
import {
  focusedSessions,
  getSessionBySlug,
  type WebSessionDefinition,
} from "@/lib/webpilot";
import { platform } from "@/lib/products";

export const dynamic = "force-dynamic";

/**
 * One route serving every WebPilot session. Each kind is a
 * configuration of the same workspace shell, so they share this
 * page rather than each getting a near-identical copy of it.
 *
 * Mirrors /app/devpilot/[project]/page.tsx.
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
    title: `${entry.name} — WebPilot | ${platform.name}`,
    description: entry.description,
    alternates: { canonical: `/webpilot/${entry.slug}` },
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
function pickSurface(session: WebSessionDefinition): SurfaceComponent {
  switch (session.kind) {
    case "history":
      return HistorySurface as unknown as SurfaceComponent;
    case "html":
      return HtmlSurface as unknown as SurfaceComponent;
    case "css":
      return CssSurface as unknown as SurfaceComponent;
    case "javascript":
      return JsSurface as unknown as SurfaceComponent;
    case "preview":
      return PreviewSurface as unknown as SurfaceComponent;
    case "projects":
      return ProjectsSurface as unknown as SurfaceComponent;
    case "assets":
      return AssetsSurface as unknown as SurfaceComponent;
    case "workspace":
      return WorkspaceSurface as unknown as SurfaceComponent;
    case "search":
      return SearchSurface as unknown as SurfaceComponent;
    case "utilities":
      return UtilitiesSurface as unknown as SurfaceComponent;
    case "blank":
    default:
      return WorkspaceDashboard as unknown as SurfaceComponent;
  }
}

export default async function WebPilotProjectPage({
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
        <h1 className="sr-only">WebPilot {entry.name}</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <WebWorkspace kind={entry.kind} Surface={Surface} />
        </div>
      </main>
    </>
  );
}
