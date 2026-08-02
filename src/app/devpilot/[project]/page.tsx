import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { DevWorkspace } from "@/components/devpilot/workspace";
import { BlankSurface } from "@/components/devpilot/surfaces/blank";
import { SnippetSurface } from "@/components/devpilot/surfaces/snippet";
import { HistorySurface } from "@/components/devpilot/surfaces/history";
import { JsonSurface } from "@/components/devpilot/surfaces/json";
import { JwtSurface } from "@/components/devpilot/surfaces/jwt";
import { Base64Surface } from "@/components/devpilot/surfaces/base64";
import { UuidSurface } from "@/components/devpilot/surfaces/uuid";
import { HashSurface } from "@/components/devpilot/surfaces/hash";
import { UrlSurface } from "@/components/devpilot/surfaces/url";
import { ApiSurface } from "@/components/devpilot/surfaces/api";
import { RegexSurface } from "@/components/devpilot/surfaces/regex";
import { DiffSurface } from "@/components/devpilot/surfaces/diff";
import { SqlSurface } from "@/components/devpilot/surfaces/sql";
import { HtmlSurface } from "@/components/devpilot/surfaces/html";
import { CssSurface } from "@/components/devpilot/surfaces/css";
import { JsSurface } from "@/components/devpilot/surfaces/js";
import { CronSurface } from "@/components/devpilot/surfaces/cron";
import { TimestampSurface } from "@/components/devpilot/surfaces/timestamp";
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
    case "json":
      return JsonSurface as unknown as SurfaceComponent;
    case "jwt":
      return JwtSurface as unknown as SurfaceComponent;
    case "base64":
      return Base64Surface as unknown as SurfaceComponent;
    case "uuid":
      return UuidSurface as unknown as SurfaceComponent;
    case "hash":
      return HashSurface as unknown as SurfaceComponent;
    case "url":
      return UrlSurface as unknown as SurfaceComponent;
    case "api":
      return ApiSurface as unknown as SurfaceComponent;
    case "regex":
      return RegexSurface as unknown as SurfaceComponent;
    case "diff":
      return DiffSurface as unknown as SurfaceComponent;
    case "sql":
      return SqlSurface as unknown as SurfaceComponent;
    case "html":
      return HtmlSurface as unknown as SurfaceComponent;
    case "css":
      return CssSurface as unknown as SurfaceComponent;
    case "javascript":
      return JsSurface as unknown as SurfaceComponent;
    case "cron":
      return CronSurface as unknown as SurfaceComponent;
    case "timestamp":
      return TimestampSurface as unknown as SurfaceComponent;
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
