import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { SocialWorkspace } from "@/components/socialpilot/workspace";
import { BlankSurface } from "@/components/socialpilot/surfaces/blank";
import { PostSurface } from "@/components/socialpilot/surfaces/post";
import { StorySurface } from "@/components/socialpilot/surfaces/story";
import { CarouselSurface } from "@/components/socialpilot/surfaces/carousel";
import { VideoSurface } from "@/components/socialpilot/surfaces/video";
import { ShortSurface } from "@/components/socialpilot/surfaces/short";
import { ReelSurface } from "@/components/socialpilot/surfaces/reel";
import { ThreadSurface } from "@/components/socialpilot/surfaces/thread";
import { CampaignSurface } from "@/components/socialpilot/surfaces/campaign";
import { PodcastSurface } from "@/components/socialpilot/surfaces/podcast";
import {
  focusedProjects,
  getProjectBySlug,
  type SocialProjectDefinition,
} from "@/lib/socialpilot";
import { platform } from "@/lib/products";

export const dynamic = "force-dynamic";

/**
 * One route serving every SocialPilot project. Each kind is a
 * configuration of the same workspace shell, so they share this page
 * rather than each getting a near-identical copy of it.
 */
export function generateStaticParams() {
  return focusedProjects.map((project) => ({
    project: project.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ project: string }>;
}): Promise<Metadata> {
  const { project: slug } = await params;
  const entry = getProjectBySlug(slug);
  if (!entry) return {};
  return {
    title: `${entry.name} — SocialPilot | ${platform.name}`,
    description: entry.description,
    alternates: { canonical: `/socialpilot/${entry.slug}` },
  };
}

/** Surface contract used by the workspace shell. */
type SurfaceComponent = React.ComponentType<{
  project: Parameters<typeof BlankSurface>[0]["project"];
  onChange: Parameters<typeof BlankSurface>[0]["onChange"];
}>;

/**
 * Resolves a project to its surface component.
 *
 * Future projects only need to be added here; the route stays the
 * same.
 */
function pickSurface(project: SocialProjectDefinition): SurfaceComponent {
  switch (project.kind) {
    case "post":
      return PostSurface as unknown as SurfaceComponent;
    case "story":
      return StorySurface as unknown as SurfaceComponent;
    case "carousel":
      return CarouselSurface as unknown as SurfaceComponent;
    case "video":
      return VideoSurface as unknown as SurfaceComponent;
    case "short":
      return ShortSurface as unknown as SurfaceComponent;
    case "reel":
      return ReelSurface as unknown as SurfaceComponent;
    case "thread":
      return ThreadSurface as unknown as SurfaceComponent;
    case "campaign":
      return CampaignSurface as unknown as SurfaceComponent;
    case "podcast":
      return PodcastSurface as unknown as SurfaceComponent;
    case "blank":
    default:
      return BlankSurface as unknown as SurfaceComponent;
  }
}

export default async function SocialPilotProjectPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const entry = getProjectBySlug(slug);
  if (!entry) notFound();

  const user = await getSession();
  const Surface = pickSurface(entry);

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">SocialPilot {entry.name}</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <SocialWorkspace kind={entry.kind} Surface={Surface} />
        </div>
      </main>
    </>
  );
}
