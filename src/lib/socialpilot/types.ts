/**
 * Shared types for the SocialPilot workspace.
 *
 * SocialPilot is a creator workspace that hosts many future tools (post
 * designer, scheduler, AI assistant) on top of one engine. The engine
 * only cares about an abstract `SocialProject`; each tool kind
 * declares its own input schema and result shape through the project
 * descriptor. The workspace shell, storage layer and search index are
 * all keyed off these types.
 */

/** The project kinds SocialPilot can host. */
export type SocialProjectKind = string;

/** A category for a project, surfaced in the new-project menu. */
export type SocialProjectCategory =
  | "blank"
  | "post"
  | "story"
  | "video"
  | "carousel"
  | "short"
  | "campaign"
  | "reel"
  | "thread"
  | "podcast"
  | "custom";

/** A media-asset kind: image, video or audio. */
export type SocialMediaKind = "image" | "video" | "audio";

/** A single logo entry on a brand kit. */
export interface SocialBrandLogo {
  id: string;
  name: string;
  /** A data URL for the logo image. Kept small so it fits in the row. */
  dataUrl: string;
}

/** A single brand colour entry on a brand kit. */
export interface SocialBrandColor {
  id: string;
  name: string;
  /** CSS-style hex value, e.g. "#0EA5E9". */
  value: string;
}

/** A single font entry on a brand kit. */
export interface SocialBrandFont {
  id: string;
  name: string;
  family: string;
  weight: number;
}

/** A default social profile link on a brand kit. */
export interface SocialBrandProfile {
  id: string;
  platform: string;
  handle: string;
  url: string;
}

/** The body of a brand kit. The row stores these four arrays. */
export interface SocialBrandKit {
  id: "default";
  name: string;
  logos: SocialBrandLogo[];
  colors: SocialBrandColor[];
  fonts: SocialBrandFont[];
  profiles: SocialBrandProfile[];
}

/** A media asset stored in the SocialPilot media library. */
export interface SocialMediaAsset {
  id: string;
  kind: SocialMediaKind;
  title: string;
  filename: string;
  mimeType: string | null;
  /** Bytes. */
  size: number;
  /** Object URL created with `URL.createObjectURL` for in-browser preview. */
  objectUrl: string | null;
  /** Optional project id this asset is grouped with. */
  projectId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** A short summary of a media asset, used in lists and the library. */
export interface SocialMediaAssetSummary {
  id: string;
  kind: SocialMediaKind;
  title: string;
  filename: string;
  mimeType: string | null;
  size: number;
  projectId: string | null;
  tags: string[];
  updatedAt: string;
  createdAt: string;
}

/** Persistent metadata stored alongside the project body. */
export interface SocialProjectMeta {
  /** Stable id; used as the IndexedDB key and the audit trail. */
  id: string;
  /** Project kind this project belongs to. */
  kind: SocialProjectKind;
  /** Free-text title shown in tabs and the file manager. */
  title: string;
  /** Project category, used for templates and the new-project menu. */
  category: SocialProjectCategory;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the last user edit. */
  updatedAt: string;
  /**
   * ISO timestamp of the last successful autosave. Separated from
   * `updatedAt` so the version-ready architecture can compare what the user
   * touched against what was committed to storage.
   */
  autosavedAt: string | null;
  /**
   * Monotonically increasing version. Bumped on every save (manual or
   * automatic) so a future history UI can render diffs without a bespoke
   * engine — the body itself is the source of truth.
   */
  version: number;
  /** Bytes of the in-memory body. Approximate; for status readouts only. */
  size: number;
  /** Optional user tags, lowercase, free-text. */
  tags?: string[];
  /** Whether the user has favourited this project. */
  isFavorite: boolean;
}

/**
 * A project stored in SocialPilot.
 *
 * The body is intentionally `unknown` because each project kind shapes
 * it differently. Every project guard the shape at the boundary.
 */
export interface SocialProject {
  meta: SocialProjectMeta;
  body: unknown;
}

/** A short summary of a project used in lists and the file manager. */
export interface SocialProjectSummary {
  id: string;
  kind: SocialProjectKind;
  title: string;
  category: SocialProjectCategory;
  updatedAt: string;
  autosavedAt: string | null;
  version: number;
  size: number;
  isFavorite: boolean;
}

/** Static template descriptor. Bodies are loaded lazily. */
export interface SocialTemplate {
  id: string;
  kind: SocialProjectKind;
  category: SocialProjectCategory;
  name: string;
  description: string;
  /** Whether a starter body is available locally. */
  hasStarter: boolean;
  /** Marketing-grade highlights shown on the template card. */
  highlights: string[];
}

/**
 * A project descriptor.
 *
 * Each future project registers one of these. The workspace shell reads
 * the array to decide which surface to mount, which tab to default to,
 * and what to show in the directory.
 */
export interface SocialProjectDefinition {
  id: string;
  kind: SocialProjectKind;
  /** Route segment under `/socialpilot`. Empty for the default. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  /** Default category when the user starts a blank project. */
  defaultCategory: SocialProjectCategory;
  /** Search keywords, mirroring the rest of the platform. */
  keywords: string[];
  /** Short bullets shown on the product page. */
  highlights: string[];
  /** Marketing-grade count for the product card. */
  toolCount: number;
}
