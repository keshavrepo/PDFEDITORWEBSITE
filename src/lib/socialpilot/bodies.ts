/**
 * Body-schema helpers for the SocialPilot Batch 2 surfaces.
 *
 * Every Batch 2 surface coerces an unknown body into a typed
 * envelope. The helpers live here so each surface reads as
 * "render the typed body" and the type guards / normalisers do not
 * have to be duplicated.
 */

import type {
  SocialCaptionBody,
  SocialContentCalendarBody,
  SocialContentPlan,
  SocialHashtagGroupBody,
  SocialNoteBody,
  SocialPostBody,
  SocialRichTextMark,
  SocialRichTextParagraph,
} from "./types";

export type {
  SocialCaptionBody,
  SocialContentCalendarBody,
  SocialContentPlan,
  SocialHashtagGroupBody,
  SocialNoteBody,
  SocialPostBody,
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
