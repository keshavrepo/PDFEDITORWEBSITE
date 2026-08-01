/**
 * SocialPilot project registry.
 *
 * The foundation ships with a list of project categories. Each future
 * project registers itself in the `projects` array and gets picked up
 * by the workspace shell, the search index and the products page.
 *
 * Mirrors the FinancePilot `calculators.ts` shape: a small typed array
 * and a couple of lookup helpers, so a reader who knows one product
 * knows all of them.
 */

import type {
  SocialProjectCategory,
  SocialProjectDefinition,
  SocialProjectKind,
} from "./types";

/** Project categories in the order they appear in the new-project menu. */
export const projectCategoryOrder: SocialProjectCategory[] = [
  "blank",
  "post",
  "story",
  "carousel",
  "video",
  "short",
  "reel",
  "thread",
  "campaign",
  "podcast",
  "custom",
];

/** Human-readable label for a category. */
export const projectCategoryLabels: Record<SocialProjectCategory, string> = {
  blank: "Blank",
  post: "Post",
  story: "Story",
  carousel: "Carousel",
  video: "Video",
  short: "Short",
  reel: "Reel",
  thread: "Thread",
  campaign: "Campaign",
  podcast: "Podcast",
  custom: "Custom",
};

/** Short description for each category, used as the menu section header. */
export const projectCategoryDescriptions: Record<SocialProjectCategory, string> = {
  blank: "Start from an empty project",
  post: "Single-image social post",
  story: "Vertical short-form story",
  carousel: "Swipeable multi-image post",
  video: "Long-form video project",
  short: "Short-form vertical video",
  reel: "Reel or short clip",
  thread: "Threaded text post",
  campaign: "Multi-asset campaign",
  podcast: "Audio-first episode",
  custom: "Anything else you build",
};

/**
 * Registered projects.
 *
 * The array is the single source of truth for which projects the
 * workspace shell mounts, which projects the products page lists, and
 * which projects the search index surfaces. Adding a new project
 * means appending one descriptor here.
 *
 * Batch 1 ships the foundation: every project kind is a placeholder
 * with the right shape so the workspace shell and the navigation rail
 * show real entries out of the box. Future batches swap placeholders
 * for real editor surfaces.
 */
export const projects: SocialProjectDefinition[] = [
  {
    id: "social-blank",
    kind: "blank",
    slug: "",
    name: "Blank project",
    tagline: "Start from an empty canvas",
    description:
      "An empty SocialPilot project ready for any future tool. The workspace saves automatically, mirrors to the server, and lets you organise the project with a brand kit and media library.",
    intro:
      "Create a blank SocialPilot project. The workspace will hold the body, save it automatically, and surface it on the dashboard. Future tools (post designer, video editor, scheduler) will replace this blank with their own surface.",
    defaultCategory: "blank",
    keywords: ["blank", "project", "SocialPilot"],
    highlights: ["Empty body", "Autosaves", "Mirrored to the dashboard"],
    toolCount: 1,
  },
  {
    id: "social-post",
    kind: "post",
    slug: "post",
    name: "Social post",
    tagline: "Single-image post for any social network",
    description:
      "Foundation entry for the future social-post tool. The workspace stores the body, saves it automatically and mirrors the project to the server. The actual editor ships in a later batch.",
    intro:
      "Open the social-post foundation. The body is a small typed envelope so future tools can extend it without breaking existing projects. The workspace autosaves and mirrors the project to the server.",
    defaultCategory: "post",
    keywords: ["post", "social", "image", "SocialPilot"],
    highlights: ["Single-image body", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-story",
    kind: "story",
    slug: "story",
    name: "Social story",
    tagline: "Vertical short-form story",
    description:
      "Foundation entry for the future social-story tool. The workspace stores the body, saves it automatically and mirrors the project to the server. The actual editor ships in a later batch.",
    intro:
      "Open the social-story foundation. The body is a small typed envelope so future tools can extend it without breaking existing projects.",
    defaultCategory: "story",
    keywords: ["story", "social", "vertical", "SocialPilot"],
    highlights: ["Vertical canvas", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-carousel",
    kind: "carousel",
    slug: "carousel",
    name: "Carousel",
    tagline: "Swipeable multi-image post",
    description:
      "Foundation entry for the future carousel tool. The body holds an ordered list of slides and the workspace keeps it in sync with the server.",
    intro:
      "Open the carousel foundation. The body is a list of slide envelopes; future tools fill in the actual editor.",
    defaultCategory: "carousel",
    keywords: ["carousel", "slides", "swipe", "SocialPilot"],
    highlights: ["Slide list", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-video",
    kind: "video",
    slug: "video",
    name: "Video project",
    tagline: "Long-form video project",
    description:
      "Foundation entry for the future video editor. The body holds the source and timeline metadata.",
    intro:
      "Open the video foundation. The body is a small typed envelope so future tools can extend it without breaking existing projects.",
    defaultCategory: "video",
    keywords: ["video", "long-form", "SocialPilot"],
    highlights: ["Timeline", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-short",
    kind: "short",
    slug: "short",
    name: "Short video",
    tagline: "Short-form vertical video",
    description:
      "Foundation entry for the future short-video tool.",
    intro:
      "Open the short-video foundation. The body is a small typed envelope so future tools can extend it without breaking existing projects.",
    defaultCategory: "short",
    keywords: ["short", "vertical", "video", "SocialPilot"],
    highlights: ["Vertical canvas", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-reel",
    kind: "reel",
    slug: "reel",
    name: "Reel",
    tagline: "Reel or short clip",
    description:
      "Foundation entry for the future reel tool.",
    intro:
      "Open the reel foundation. The body is a small typed envelope so future tools can extend it without breaking existing projects.",
    defaultCategory: "reel",
    keywords: ["reel", "clip", "SocialPilot"],
    highlights: ["Short clip", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-thread",
    kind: "thread",
    slug: "thread",
    name: "Thread",
    tagline: "Threaded text post",
    description:
      "Foundation entry for the future thread tool.",
    intro:
      "Open the thread foundation. The body is an ordered list of text posts; future tools add the actual editor.",
    defaultCategory: "thread",
    keywords: ["thread", "text", "SocialPilot"],
    highlights: ["Ordered list", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-campaign",
    kind: "campaign",
    slug: "campaign",
    name: "Campaign",
    tagline: "Multi-asset campaign",
    description:
      "Foundation entry for the future campaign tool.",
    intro:
      "Open the campaign foundation. The body is a list of asset references; future tools add the actual editor.",
    defaultCategory: "campaign",
    keywords: ["campaign", "multi-asset", "SocialPilot"],
    highlights: ["Asset list", "Autosave", "Server mirror"],
    toolCount: 1,
  },
  {
    id: "social-podcast",
    kind: "podcast",
    slug: "podcast",
    name: "Podcast episode",
    tagline: "Audio-first episode",
    description:
      "Foundation entry for the future podcast tool.",
    intro:
      "Open the podcast foundation. The body is an audio-asset reference plus show notes; future tools add the actual editor.",
    defaultCategory: "podcast",
    keywords: ["podcast", "audio", "episode", "SocialPilot"],
    highlights: ["Audio reference", "Autosave", "Server mirror"],
    toolCount: 1,
  },
];

export function getProject(
  kind: SocialProjectKind
): SocialProjectDefinition | undefined {
  return projects.find((project) => project.kind === kind);
}

export function getProjectBySlug(
  slug: string
): SocialProjectDefinition | undefined {
  return projects.find((project) => project.slug === slug);
}

/** Projects that are not the default landing project, used in directory listings. */
export const focusedProjects = projects.filter((project) => project.slug !== "");

/** Route for a project, e.g. `/socialpilot/post`. */
export function projectHref(project: SocialProjectDefinition): string {
  return project.slug ? `/socialpilot/${project.slug}` : "/socialpilot";
}

/** Projects for the directory, sorted by their category order. */
export function projectsForCategory(
  category: SocialProjectCategory
): SocialProjectDefinition[] {
  return projects.filter((project) => project.defaultCategory === category);
}
