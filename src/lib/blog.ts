import sanitizeHtml from "sanitize-html";
import { isStoredBlogImageUrl } from "@/lib/blog-images";

export function createSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
}

export function sanitizePostHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h2",
      "h3",
      "h4",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "code",
      "pre",
      "hr",
      "img",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "loading", "decoding"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          src: attribs.src || "",
          alt: attribs.alt || "Article image",
          loading: "lazy",
          decoding: "async",
        },
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" && !isStoredBlogImageUrl(frame.attribs.src || ""),
  }).trim();
}

export function calculateReadingTime(html: string): number {
  const plainText = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function normalizeTagNames(value: string[] | string): string[] {
  const values = Array.isArray(value) ? value : value.split(",");
  return [...new Set(values.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}
