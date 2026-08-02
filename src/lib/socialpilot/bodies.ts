/**
 * Body-schema helpers for the SocialPilot Batch 2 surfaces.
 *
 * Every Batch 2 surface coerces an unknown body into a typed
 * envelope. The helpers live here so each surface reads as
 * "render the typed body" and the type guards / normalisers do not
 * have to be duplicated.
 */

import type {
  SocialBrand,
  SocialBrandColor,
  SocialBrandFont,
  SocialBrandLogo,
  SocialBrandTemplate,
  SocialBrandWatermark,
  SocialCaptionBody,
  SocialContentCalendarBody,
  SocialContentPlan,
  SocialHashtagGroupBody,
  SocialMediaCollection,
  SocialMediaKind,
  SocialNoteBody,
  SocialPlatformKey,
  SocialPlatformProfile,
  SocialPostBody,
  SocialQueueBody,
  SocialQueueItem,
  SocialQueueStatus,
  SocialRichTextMark,
  SocialRichTextParagraph,
} from "./types";

export type {
  SocialBrand,
  SocialBrandColor,
  SocialBrandFont,
  SocialBrandLogo,
  SocialBrandTemplate,
  SocialBrandWatermark,
  SocialCaptionBody,
  SocialContentCalendarBody,
  SocialContentPlan,
  SocialHashtagGroupBody,
  SocialMediaCollection,
  SocialMediaKind,
  SocialNoteBody,
  SocialPlatformKey,
  SocialPlatformMeta,
  SocialPlatformProfile,
  SocialPostBody,
  SocialQueueBody,
  SocialQueueItem,
  SocialQueueStatus,
  SocialRichTextMark,
  SocialRichTextParagraph,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Rich-text                                                                  */
/* -------------------------------------------------------------------------- */

const MARK_TYPES = ["bold", "italic", "code", "link", "mention", "hashtag"] as const;
type MarkType = (typeof MARK_TYPES)[number];

function isMarkType(value: unknown): value is MarkType {
  return typeof value === "string" && (MARK_TYPES as readonly string[]).includes(value);
}

function asParagraph(value: unknown): SocialRichTextParagraph | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.text !== "string") return null;
  const marks: SocialRichTextMark[] = [];
  if (Array.isArray(record.marks)) {
    for (const m of record.marks) {
      if (!m || typeof m !== "object") continue;
      const mr = m as Record<string, unknown>;
      if (!isMarkType(mr.type)) continue;
      if (typeof mr.start !== "number" || typeof mr.end !== "number") continue;
      const start = Math.max(0, Math.floor(mr.start));
      const end = Math.max(start, Math.floor(mr.end));
      const mark: SocialRichTextMark = {
        type: mr.type,
        start,
        end,
        ...(typeof mr.href === "string" ? { href: mr.href } : {}),
        ...(typeof mr.label === "string" ? { label: mr.label } : {}),
      };
      marks.push(mark);
    }
  }
  const listKind =
    record.listKind === "bullet" ||
    record.listKind === "ordered" ||
    record.listKind === "checklist"
      ? record.listKind
      : undefined;
  return {
    text: record.text,
    marks,
    ...(listKind ? { listKind } : {}),
    ...(typeof record.checked === "boolean" ? { checked: record.checked } : {}),
  };
}

export function asParagraphs(value: unknown): SocialRichTextParagraph[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asParagraph(entry))
    .filter((entry): entry is SocialRichTextParagraph => Boolean(entry));
}

export function emptyParagraphs(checklist = false): SocialRichTextParagraph[] {
  return checklist
    ? [{ text: "", marks: [], listKind: "checklist", checked: false }]
    : [{ text: "", marks: [] }];
}

export function paragraphsToPlainTextLocal(paragraphs: SocialRichTextParagraph[]): string {
  return paragraphs
    .map((paragraph) => {
      if (paragraph.listKind === "checklist") {
        return `${paragraph.checked ? "[x]" : "[ ]"} ${paragraph.text}`;
      }
      if (paragraph.listKind === "bullet") {
        return `- ${paragraph.text}`;
      }
      if (paragraph.listKind === "ordered") {
        return `1. ${paragraph.text}`;
      }
      return paragraph.text;
    })
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* Post Creator                                                               */
/* -------------------------------------------------------------------------- */

export const DEFAULT_POST_BODY: SocialPostBody = {
  format: "plain",
  plainText: "",
  paragraphs: [],
  hashtags: [],
  mentions: [],
  callToAction: "",
  mediaIds: [],
  platform: "",
  category: "",
};

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of list) {
    const key = entry.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}

export function deriveHashtags(text: string): string[] {
  const out: string[] = [];
  const re = /#([\p{L}\p{N}_]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]!);
  }
  return uniq(out);
}

export function deriveMentions(text: string): string[] {
  const out: string[] = [];
  const re = /@([\p{L}\p{N}_]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]!);
  }
  return uniq(out);
}

export function asPostBody(value: unknown): SocialPostBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_POST_BODY };
  const record = value as Record<string, unknown>;
  const format = record.format === "rich" ? "rich" : "plain";
  const paragraphs = asParagraphs(record.paragraphs);
  const plainText =
    typeof record.plainText === "string"
      ? record.plainText
      : paragraphsToPlainTextLocal(paragraphs);
  const hashtags = Array.isArray(record.hashtags)
    ? uniq(
        (record.hashtags as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      )
    : deriveHashtags(plainText);
  const mentions = Array.isArray(record.mentions)
    ? uniq(
        (record.mentions as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      )
    : deriveMentions(plainText);
  const mediaIds = Array.isArray(record.mediaIds)
    ? (record.mediaIds as unknown[]).filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  return {
    format,
    plainText,
    paragraphs,
    hashtags,
    mentions,
    callToAction:
      typeof record.callToAction === "string" ? record.callToAction : "",
    mediaIds: uniq(mediaIds),
    platform: typeof record.platform === "string" ? record.platform : "",
    category: typeof record.category === "string" ? record.category : "",
  };
}

/* -------------------------------------------------------------------------- */
/* Caption manager                                                            */
/* -------------------------------------------------------------------------- */

export const DEFAULT_CAPTION_BODY: SocialCaptionBody = {
  text: "",
  category: "",
  tags: [],
  isFavorite: false,
};

export function asCaptionBody(value: unknown): SocialCaptionBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_CAPTION_BODY };
  const record = value as Record<string, unknown>;
  return {
    text: typeof record.text === "string" ? record.text : "",
    category: typeof record.category === "string" ? record.category : "",
    tags: Array.isArray(record.tags)
      ? uniq(
          (record.tags as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          )
        )
      : [],
    isFavorite: record.isFavorite === true,
  };
}

/* -------------------------------------------------------------------------- */
/* Hashtag manager                                                            */
/* -------------------------------------------------------------------------- */

export const DEFAULT_HASHTAG_BODY: SocialHashtagGroupBody = {
  name: "",
  category: "",
  tags: [],
  isFavorite: false,
};

export function asHashtagGroupBody(value: unknown): SocialHashtagGroupBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_HASHTAG_BODY };
  const record = value as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : "",
    category: typeof record.category === "string" ? record.category : "",
    tags: Array.isArray(record.tags)
      ? uniq(
          (record.tags as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          ).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        )
      : [],
    isFavorite: record.isFavorite === true,
  };
}

/* -------------------------------------------------------------------------- */
/* Content calendar                                                           */
/* -------------------------------------------------------------------------- */

export const PLAN_COLORS: Array<SocialContentPlan["color"]> = [
  "primary",
  "blue",
  "green",
  "yellow",
  "pink",
  "purple",
  "orange",
];

export const PLAN_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "X",
  "LinkedIn",
  "Facebook",
  "Pinterest",
  "Threads",
  "Bluesky",
  "Other",
];

export const DEFAULT_CALENDAR_BODY: SocialContentCalendarBody = {
  plans: [],
  view: "month",
  platform: "",
};

function asPlan(value: unknown): SocialContentPlan | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.date !== "string" ||
    typeof record.id !== "string"
  ) {
    return null;
  }
  const color =
    PLAN_COLORS.find((c) => c === record.color) ?? "primary";
  return {
    id: record.id,
    title: record.title,
    platform:
      typeof record.platform === "string" ? record.platform : "Other",
    date: record.date,
    time: typeof record.time === "string" ? record.time : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    color,
    published: record.published === true,
  };
}

export function asCalendarBody(value: unknown): SocialContentCalendarBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_CALENDAR_BODY };
  const record = value as Record<string, unknown>;
  const plans = Array.isArray(record.plans)
    ? (record.plans as unknown[])
        .map((entry) => asPlan(entry))
        .filter((entry): entry is SocialContentPlan => Boolean(entry))
    : [];
  const view: SocialContentCalendarBody["view"] =
    record.view === "week" || record.view === "day" ? record.view : "month";
  return {
    plans,
    view,
    platform: typeof record.platform === "string" ? record.platform : "",
  };
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export const DEFAULT_NOTE_BODY: SocialNoteBody = {
  format: "plain",
  plainText: "",
  paragraphs: [],
  isChecklist: false,
  tags: [],
  isFavorite: false,
};

export function asNoteBody(value: unknown): SocialNoteBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_NOTE_BODY };
  const record = value as Record<string, unknown>;
  const paragraphs = asParagraphs(record.paragraphs);
  const plainText =
    typeof record.plainText === "string"
      ? record.plainText
      : paragraphsToPlainTextLocal(paragraphs);
  return {
    format: record.format === "rich" ? "rich" : "plain",
    plainText,
    paragraphs,
    isChecklist: record.isChecklist === true,
    tags: Array.isArray(record.tags)
      ? uniq(
          (record.tags as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          )
        )
      : [],
    isFavorite: record.isFavorite === true,
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 3: publishing queue                                                  */
/* -------------------------------------------------------------------------- */

export const QUEUE_STATUSES = ["draft", "ready", "scheduled", "published", "failed"] as const;

export const DEFAULT_QUEUE_BODY: SocialQueueBody = {
  items: [],
  statusFilter: "all",
  search: "",
};

function asQueueStatus(value: unknown): SocialQueueStatus {
  if (typeof value !== "string") return "draft";
  return (QUEUE_STATUSES as readonly string[]).includes(value)
    ? (value as SocialQueueStatus)
    : "draft";
}

function asPlatformKey(value: unknown): SocialPlatformKey | "" {
  if (typeof value !== "string") return "";
  const allowed: SocialPlatformKey[] = [
    "facebook",
    "instagram",
    "x",
    "linkedin",
    "youtube",
    "tiktok",
    "threads",
    "pinterest",
  ];
  return (allowed as string[]).includes(value) ? (value as SocialPlatformKey) : "";
}

function asQueueItem(value: unknown): SocialQueueItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || typeof record.id !== "string") return null;
  return {
    id: record.id,
    title: record.title,
    projectId: typeof record.projectId === "string" ? record.projectId : "",
    platform: asPlatformKey(record.platform),
    status: asQueueStatus(record.status),
    priority:
      typeof record.priority === "number" && Number.isFinite(record.priority)
        ? Math.max(0, Math.floor(record.priority))
        : 0,
    scheduledFor:
      typeof record.scheduledFor === "string" ? record.scheduledFor : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    mediaIds: Array.isArray(record.mediaIds)
      ? (record.mediaIds as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
    failureReason:
      typeof record.failureReason === "string" ? record.failureReason : "",
  };
}

export function asQueueBody(value: unknown): SocialQueueBody {
  if (!value || typeof value !== "object") return { ...DEFAULT_QUEUE_BODY };
  const record = value as Record<string, unknown>;
  return {
    items: Array.isArray(record.items)
      ? (record.items as unknown[])
          .map((entry) => asQueueItem(entry))
          .filter((entry): entry is SocialQueueItem => Boolean(entry))
      : [],
    statusFilter:
      record.statusFilter === "all" || asQueueStatus(record.statusFilter) === (record.statusFilter as SocialQueueStatus)
        ? (record.statusFilter as SocialQueueBody["statusFilter"])
        : "all",
    search: typeof record.search === "string" ? record.search : "",
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 3: platform profiles (per-project body for the foundation entry)     */
/* -------------------------------------------------------------------------- */

export const DEFAULT_PROFILE_BODY: SocialPlatformProfile[] = [];

export function asProfileBody(value: unknown): SocialPlatformProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.name !== "string") {
        return null;
      }
      return {
        id: record.id,
        platform: asPlatformKey(record.platform) as SocialPlatformKey,
        name: record.name,
        handle: typeof record.handle === "string" ? record.handle : "",
        url: typeof record.url === "string" ? record.url : "",
        notes: typeof record.notes === "string" ? record.notes : "",
        isDefault: record.isDefault === true,
      };
    })
    .filter((entry): entry is SocialPlatformProfile => Boolean(entry));
}

/* -------------------------------------------------------------------------- */
/* Batch 3: media workspace                                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MEDIA_BODY = {
  view: "grid" as "grid" | "list",
  search: "",
  kindFilter: "all" as SocialMediaKind | "all",
  collectionFilter: "all" as string,
  selectedIds: [] as string[],
};

export function asMediaBody(value: unknown): typeof DEFAULT_MEDIA_BODY {
  if (!value || typeof value !== "object") return { ...DEFAULT_MEDIA_BODY };
  const record = value as Record<string, unknown>;
  return {
    view: record.view === "list" ? "list" : "grid",
    search: typeof record.search === "string" ? record.search : "",
    kindFilter:
      record.kindFilter === "image" ||
      record.kindFilter === "video" ||
      record.kindFilter === "audio" ||
      record.kindFilter === "all"
        ? (record.kindFilter as SocialMediaKind | "all")
        : "all",
    collectionFilter:
      typeof record.collectionFilter === "string" ? record.collectionFilter : "all",
    selectedIds: Array.isArray(record.selectedIds)
      ? (record.selectedIds as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
  };
}

/* -------------------------------------------------------------------------- */
/* Batch 3: brand workspace (per-project body for the foundation entry)       */
/* -------------------------------------------------------------------------- */

export const DEFAULT_BRAND_BODY: Omit<SocialBrand, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  description: "",
  logos: [],
  colors: [],
  fonts: [],
  watermarks: [],
  templates: [],
  defaultHashtags: [],
  defaultCaptions: [],
  defaultProfileId: "",
};

export function asBrandBody(
  value: unknown
): Omit<SocialBrand, "id" | "createdAt" | "updatedAt"> {
  if (!value || typeof value !== "object") return { ...DEFAULT_BRAND_BODY };
  const record = value as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : "",
    logos: Array.isArray(record.logos) ? (record.logos as SocialBrandLogo[]) : [],
    colors: Array.isArray(record.colors) ? (record.colors as SocialBrandColor[]) : [],
    fonts: Array.isArray(record.fonts) ? (record.fonts as SocialBrandFont[]) : [],
    watermarks: Array.isArray(record.watermarks)
      ? (record.watermarks as SocialBrandWatermark[])
      : [],
    templates: Array.isArray(record.templates)
      ? (record.templates as SocialBrandTemplate[])
      : [],
    defaultHashtags: Array.isArray(record.defaultHashtags)
      ? (record.defaultHashtags as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
    defaultCaptions: Array.isArray(record.defaultCaptions)
      ? (record.defaultCaptions as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
    defaultProfileId:
      typeof record.defaultProfileId === "string" ? record.defaultProfileId : "",
  };
}
