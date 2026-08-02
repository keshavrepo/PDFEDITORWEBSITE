"use client";

/**
 * Workspace Dashboard — Batch 3 surface.
 *
 * A one-page summary of the user's SocialPilot workspace: recent
 * projects, recent assets, favourite assets, favourite captions,
 * favourite hashtag groups, the active brand and the publishing
 * queue summary.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  Hash,
  Image as ImageIcon,
  Palette,
  Star,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "../toast";
import { cn } from "@/lib/utils";
import { getProject } from "@/lib/socialpilot";
import {
  listSocialProjects,
  listMediaAssets,
  getMediaAsset,
  platformLabel,
} from "@/lib/socialpilot";
import type {
  SocialBrand,
  SocialMediaAsset,
  SocialMediaAssetSummary,
  SocialPlatformProfile,
  SocialProject,
  SocialProjectSummary,
} from "@/lib/socialpilot";
import {
  asCaptionBody,
  asHashtagGroupBody,
  asQueueBody,
} from "@/lib/socialpilot/bodies";
import { platformColor } from "@/lib/socialpilot/platforms";
import { QUEUE_STATUSES } from "@/lib/socialpilot/bodies";

interface WorkspaceDashboardProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

interface FavouriteCaptionSummary {
  id: string;
  title: string;
  text: string;
}
interface FavouriteHashtagSummary {
  id: string;
  title: string;
  tags: string[];
}

export function WorkspaceDashboard({ project }: WorkspaceDashboardProps) {
  const { toast } = useToast();
  const [recent, setRecent] = useState<SocialProjectSummary[]>([]);
  const [recentAssets, setRecentAssets] = useState<SocialMediaAsset[]>([]);
  const [favouriteAssets, setFavouriteAssets] = useState<SocialMediaAsset[]>(
    []
  );
  const [favouriteCaptions, setFavouriteCaptions] = useState<
    FavouriteCaptionSummary[]
  >([]);
  const [favouriteHashtags, setFavouriteHashtags] = useState<
    FavouriteHashtagSummary[]
  >([]);
  const [brands, setBrands] = useState<SocialBrand[]>([]);
  const [profiles, setProfiles] = useState<SocialPlatformProfile[]>([]);
  const [activeBrand, setActiveBrand] = useState<SocialBrand | null>(null);
  const [activeProfile, setActiveProfile] = useState<SocialPlatformProfile | null>(
    null
  );
  const [queueSummary, setQueueSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          projects,
          assetRes,
          brandRes,
          profileRes,
          stateRes,
          queueProject,
        ] = await Promise.all([
          listSocialProjects({ limit: 8 }),
          fetch("/api/socialpilot/media?limit=12"),
          fetch("/api/socialpilot/brand-profiles"),
          fetch("/api/socialpilot/platform-profiles"),
          fetch("/api/socialpilot/user-state"),
          listSocialProjects({ kind: "queue", limit: 1 }),
        ]);
        if (cancelled) return;
        setRecent(projects);

        const summaries = (await assetRes
          .json()
          .catch(() => ({ media: [] }))) as { media: SocialMediaAssetSummary[] };
        const fullAssets: SocialMediaAsset[] = [];
        for (const summary of summaries.media ?? []) {
          const asset = await getMediaAsset(summary.id);
          if (asset) fullAssets.push(asset);
        }
        if (cancelled) return;
        setRecentAssets(fullAssets);
        setFavouriteAssets(fullAssets.slice(0, 6));

        const brandsData = (await brandRes
          .json()
          .catch(() => ({ brands: [] }))) as { brands: SocialBrand[] };
        const profilesData = (await profileRes
          .json()
          .catch(() => ({ profiles: [] }))) as { profiles: SocialPlatformProfile[] };
        const stateData = (await stateRes
          .json()
          .catch(() => ({ state: { activeBrandId: "", activeProfileId: "" } }))) as {
          state: { activeBrandId: string; activeProfileId: string };
        };
        if (cancelled) return;
        setBrands(brandsData.brands ?? []);
        setProfiles(profilesData.profiles ?? []);
        const activeBrandEntry =
          (brandsData.brands ?? []).find(
            (brand) => brand.id === stateData.state?.activeBrandId
          ) ?? null;
        setActiveBrand(activeBrandEntry);
        const activeProfileEntry =
          (profilesData.profiles ?? []).find(
            (profile) => profile.id === stateData.state?.activeProfileId
          ) ?? null;
        setActiveProfile(activeProfileEntry);

        // Queue summary
        const queueEntry = queueProject[0];
        if (queueEntry) {
          const queueProjectData = await (
            await import("@/lib/socialpilot")
          ).openSocialProject(queueEntry.id);
          if (queueProjectData && !cancelled) {
            const queueBody = asQueueBody(queueProjectData.body);
            const counts: Record<string, number> = {};
            for (const status of QUEUE_STATUSES) counts[status] = 0;
            for (const item of queueBody.items) {
              counts[item.status] = (counts[item.status] ?? 0) + 1;
            }
            setQueueSummary(counts);
          }
        }

        // Favourite captions and hashtag groups: read the body
        // through the engine, which reads from IndexedDB.
        const captionProjects = await listSocialProjects({
          kind: "caption",
          limit: 50,
        });
        const hashtagProjects = await listSocialProjects({
          kind: "hashtag",
          limit: 50,
        });
        const favCaptions: FavouriteCaptionSummary[] = [];
        for (const summary of captionProjects) {
          const project = await (
            await import("@/lib/socialpilot")
          ).openSocialProject(summary.id);
          if (!project) continue;
          const body = asCaptionBody(project.body);
          if (body.isFavorite) {
            favCaptions.push({
              id: project.meta.id,
              title: project.meta.title,
              text: body.text,
            });
          }
        }
        const favHashtags: FavouriteHashtagSummary[] = [];
        for (const summary of hashtagProjects) {
          const project = await (
            await import("@/lib/socialpilot")
          ).openSocialProject(summary.id);
          if (!project) continue;
          const body = asHashtagGroupBody(project.body);
          if (body.isFavorite) {
            favHashtags.push({
              id: project.meta.id,
              title: project.meta.title || body.name,
              tags: body.tags,
            });
          }
        }
        if (cancelled) return;
        setFavouriteCaptions(favCaptions);
        setFavouriteHashtags(favHashtags);
      } catch (err) {
        if (!cancelled) {
          toast({
            message: err instanceof Error ? err.message : "Dashboard failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-2">
      <Card className="p-4">
        <SectionTitle icon={<Users className="h-4 w-4" />} title="Active brand" />
        {activeBrand ? (
          <div>
            <p className="text-base font-semibold">{activeBrand.name}</p>
            {activeBrand.description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {activeBrand.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {activeBrand.colors.slice(0, 6).map((color) => (
                <span
                  key={color.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: color.value }}
                    aria-hidden="true"
                  />
                  {color.name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No active brand.{" "}
            <Link
              href="/socialpilot/brands"
              className="text-primary hover:underline"
            >
              Open the Brand Workspace
            </Link>{" "}
            to add one.
          </p>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle
          icon={<Palette className="h-4 w-4" />}
          title="Active platform profile"
        />
        {activeProfile ? (
          <div>
            <p className="text-base font-semibold">{activeProfile.name}</p>
            <span
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                platformColor(activeProfile.platform)
              )}
            >
              {platformLabel(activeProfile.platform)}
            </span>
            {activeProfile.handle && (
              <p className="mt-1 text-xs text-muted-foreground">
                {activeProfile.handle}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No active profile.{" "}
            <Link
              href="/socialpilot/profiles"
              className="text-primary hover:underline"
            >
              Open the Platform Profiles
            </Link>{" "}
            to add one.
          </p>
        )}
      </Card>

      <Card className="p-4 xl:col-span-2">
        <SectionTitle
          icon={<CalendarDays className="h-4 w-4" />}
          title="Publishing queue summary"
        />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {QUEUE_STATUSES.map((status) => (
            <Link
              key={status}
              href="/socialpilot/queue"
              className="rounded-lg border border-border bg-background p-3 text-center transition-colors hover:bg-accent"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {status}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {queueSummary[status] ?? 0}
              </p>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle
          icon={<FileText className="h-4 w-4" />}
          title="Recent projects"
        />
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No projects yet</p>
        ) : (
          <ul className="space-y-1">
            {recent.slice(0, 6).map((entry) => {
              const project = getProject(entry.kind);
              return (
                <li key={entry.id}>
                  <Link
                    href={project?.slug ? `/socialpilot/${project.slug}` : "/socialpilot"}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    <FileText
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {project?.name ?? entry.kind} · v{entry.version}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle
          icon={<ImageIcon className="h-4 w-4" />}
          title="Recent assets"
        />
        {recentAssets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assets yet</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {recentAssets.slice(0, 6).map((asset) => (
              <li
                key={asset.id}
                className="overflow-hidden rounded border border-border bg-muted"
              >
                {asset.kind === "image" && asset.objectUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.objectUrl}
                    alt={asset.title}
                    className="h-16 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 items-center justify-center text-[10px] text-muted-foreground">
                    {asset.kind}
                  </div>
                )}
                <p className="truncate p-1 text-[10px]">{asset.title}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle
          icon={<Star className="h-4 w-4" />}
          title="Favourite assets"
        />
        {favouriteAssets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Mark assets as favourites from the Media Workspace.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {favouriteAssets.slice(0, 6).map((asset) => (
              <li
                key={asset.id}
                className="overflow-hidden rounded border border-border bg-muted"
              >
                {asset.kind === "image" && asset.objectUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.objectUrl}
                    alt={asset.title}
                    className="h-16 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 items-center justify-center text-[10px] text-muted-foreground">
                    {asset.kind}
                  </div>
                )}
                <p className="truncate p-1 text-[10px]">{asset.title}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle
          icon={<FileText className="h-4 w-4" />}
          title="Favourite captions"
        />
        {favouriteCaptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Mark captions as favourites from the Caption Manager.
          </p>
        ) : (
          <ul className="space-y-2">
            {favouriteCaptions.slice(0, 4).map((caption) => (
              <li
                key={caption.id}
                className="rounded border border-border bg-background p-2 text-xs"
              >
                <p className="line-clamp-2 whitespace-pre-wrap">
                  {caption.text}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {caption.title}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 xl:col-span-2">
        <SectionTitle icon={<Hash className="h-4 w-4" />} title="Favourite hashtag groups" />
        {favouriteHashtags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Mark hashtag groups as favourites from the Hashtag Manager.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {favouriteHashtags.map((group) => (
              <li
                key={group.id}
                className="rounded border border-border bg-background p-2 text-xs"
              >
                <p className="font-medium">{group.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {group.tags.slice(0, 8).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
      <span className="text-muted-foreground">{icon}</span>
      {title}
    </div>
  );
}
