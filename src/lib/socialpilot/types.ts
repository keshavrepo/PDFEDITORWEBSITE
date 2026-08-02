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
  | "caption"
  | "hashtag"
  | "calendar"
  | "note"
  | "queue"
  | "profile"
  | "media"
  | "brand"
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

/* -------------------------------------------------------------------------- */
/* Batch 2: core creator tools                                               */
/* -------------------------------------------------------------------------- */

/**
 * A rich-text run, the atomic unit of the Post Creator and Notes
 * editors. The format mirrors a tiny subset of the common rich-text
 * representation: a string with optional marks (bold, italic, code,
 * link, mention, hashtag).
 */
export interface SocialRichTextMark {
  type: "bold" | "italic" | "code" | "link" | "mention" | "hashtag";
  /** Optional URL for links. */
  href?: string;
  /** Optional label, e.g. the username for a mention. */
  label?: string;
  /** Character offset into the run text. */
  start: number;
  /** Character offset (exclusive) into the run text. */
  end: number;
}

/** A single paragraph in the rich-text body. */
export interface SocialRichTextParagraph {
  /** Optional list-item prefix, e.g. "-" for bullet, "1." for ordered. */
  listKind?: "bullet" | "ordered" | "checklist";
  /** Whether the check is filled in (only for checklist lists). */
  checked?: boolean;
  /** Run text. Marks are applied in order; overlapping marks are allowed. */
  text: string;
  marks: SocialRichTextMark[];
}

/**
 * The Post Creator body. A draft has a plain-text mirror so the
 * character counter, search and caption-manager import can work
 * without parsing rich text, and a structured representation so the
 * rich-text editor can render bold / italic / links / mentions /
 * hashtags faithfully.
 */
export interface SocialPostBody {
  /** "plain" or "rich". */
  format: "plain" | "rich";
  /** Plain-text mirror, always populated. */
  plainText: string;
  /** Rich-text structure, only used when format === "rich". */
  paragraphs: SocialRichTextParagraph[];
  /** Hashtags, derived from the body or typed manually. */
  hashtags: string[];
  /** Mentions, derived from the body or typed manually. */
  mentions: string[];
  /** Optional call to action. */
  callToAction: string;
  /** Linked media-asset ids, drawn from the media library. */
  mediaIds: string[];
  /** Target platform (e.g. "Instagram"). Used by the character limit. */
  platform: string;
  /** Optional category (mirrors the caption-manager vocabulary). */
  category: string;
}

/**
 * A saved caption. Captions are first-class projects so they reuse
 * the autosave loop, search index, recent mirror and favourites
 * flag, but the body is constrained to the caption-manager schema.
 */
export interface SocialCaptionBody {
  /** The caption text. */
  text: string;
  /** Free-form category, e.g. "Launches", "Promos", "Behind the scenes". */
  category: string;
  /** Optional tags for finer-grained search. */
  tags: string[];
  /** Favourite flag; the dedicated favourites table mirrors it. */
  isFavorite: boolean;
}

/**
 * A saved hashtag group. Hashtag groups are first-class projects so
 * they reuse the autosave loop, search index and favourites flag.
 */
export interface SocialHashtagGroupBody {
  /** Group name, e.g. "Launches" or "Always-on". */
  name: string;
  /** Free-form category. */
  category: string;
  /** The hashtags in the group. */
  tags: string[];
  /** Favourite flag. */
  isFavorite: boolean;
}

/**
 * A single plan in the Content Calendar. The calendar is a
 * first-class project; the body holds the ordered list of plans.
 */
export interface SocialContentPlan {
  id: string;
  /** Display title, shown in the calendar cell. */
  title: string;
  /** Target platform, e.g. "Instagram", "TikTok", "YouTube", "X". */
  platform: string;
  /** ISO date for the plan, anchored to midnight in the user's locale. */
  date: string;
  /** Optional time of day, "HH:MM" 24h. */
  time: string;
  /** Notes about the plan, free-form. */
  notes: string;
  /** Color label, one of a fixed palette; maps to a CSS class. */
  color: "primary" | "blue" | "green" | "yellow" | "pink" | "purple" | "orange";
  /** Whether the plan is published (a manual toggle, not a real publish). */
  published: boolean;
}

/** The Content Calendar body. */
export interface SocialContentCalendarBody {
  /** The plans. */
  plans: SocialContentPlan[];
  /** Default view, persisted between sessions. */
  view: "month" | "week" | "day";
  /** Default platform filter, persisted between sessions. */
  platform: string;
}

/**
 * A creator note. Notes are first-class projects so they reuse the
 * autosave loop, search index and favourites flag.
 */
export interface SocialNoteBody {
  /** "plain" or "rich". */
  format: "plain" | "rich";
  /** Plain-text mirror, always populated. */
  plainText: string;
  /** Rich-text structure, only used when format === "rich". */
  paragraphs: SocialRichTextParagraph[];
  /** Whether the note is a checklist. When true, every paragraph is rendered as a checklist row. */
  isChecklist: boolean;
  /** Free-form tags. */
  tags: string[];
  /** Favourite flag. */
  isFavorite: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batch 3: professional creator workspace                                   */
/* -------------------------------------------------------------------------- */

/** A platform key. One of the eight supported social networks. */
export type SocialPlatformKey =
  | "facebook"
  | "instagram"
  | "x"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "threads"
  | "pinterest";

/** Human-readable platform label. */
export interface SocialPlatformMeta {
  key: SocialPlatformKey;
  name: string;
  /** Brand colour used by the chip. */
  color: string;
  /** Two-letter initials shown in the chip. */
  initials: string;
}

/** A single platform profile. */
export interface SocialPlatformProfile {
  id: string;
  platform: SocialPlatformKey;
  /** Display name, e.g. "Personal" or "Brand: Acme". */
  name: string;
  /** Optional handle, e.g. "@acme". */
  handle: string;
  /** Optional profile URL. */
  url: string;
  /** Optional notes. */
  notes: string;
  /** Whether this profile is the default for its platform. */
  isDefault: boolean;
}

/** A single watermark on a brand. Watermarks are stored as data URLs. */
export interface SocialBrandWatermark {
  id: string;
  name: string;
  dataUrl: string;
  /** Optional opacity, 0-1. */
  opacity: number;
  /** Optional placement hint, e.g. "bottom-right". */
  placement: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
}

/** A single template on a brand. Templates are reusable caption / body starters. */
export interface SocialBrandTemplate {
  id: string;
  name: string;
  description: string;
  body: string;
}

/**
 * A brand. The user can have multiple brands (e.g. "Personal",
 * "Acme Inc."). Each brand has its own logos, colours, fonts,
 * watermarks, templates, default hashtags and default captions.
 */
export interface SocialBrand {
  id: string;
  name: string;
  /** Free-form description. */
  description: string;
  logos: SocialBrandLogo[];
  colors: SocialBrandColor[];
  fonts: SocialBrandFont[];
  watermarks: SocialBrandWatermark[];
  templates: SocialBrandTemplate[];
  /** Default hashtag groups for this brand. */
  defaultHashtags: string[];
  /** Default captions for this brand. */
  defaultCaptions: string[];
  /** The id of the default platform profile, if any. */
  defaultProfileId: string;
  createdAt: string;
  updatedAt: string;
}

/** A publishing-queue status. */
export type SocialQueueStatus = "draft" | "ready" | "scheduled" | "published" | "failed";

/** A single publishing-queue item. */
export interface SocialQueueItem {
  id: string;
  /** Title shown in the queue. */
  title: string;
  /** Optional project id this item is generated from. */
  projectId: string;
  /** Target platform, drawn from the platform profiles. */
  platform: SocialPlatformKey | "";
  /** Status. */
  status: SocialQueueStatus;
  /** Lower number = higher priority. */
  priority: number;
  /** Optional ISO date the item is scheduled for. */
  scheduledFor: string;
  /** Free-form notes. */
  notes: string;
  /** Optional media-asset ids attached to the item. */
  mediaIds: string[];
  /** Optional failure reason when status is "failed". */
  failureReason: string;
}

/** The publishing-queue body. */
export interface SocialQueueBody {
  items: SocialQueueItem[];
  /** Default filter applied to the queue view. */
  statusFilter: SocialQueueStatus | "all";
  /** Default search term. */
  search: string;
}

/** A media-asset collection. Collections group assets across projects. */
export interface SocialMediaCollection {
  id: string;
  name: string;
  description: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
}
