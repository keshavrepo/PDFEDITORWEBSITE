export const BLOG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const BLOG_IMAGE_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type BlogImagePurpose = "featured" | "content";

export function isStoredBlogImageUrl(value: string): boolean {
  if (/^\/uploads\/blog\/[a-zA-Z0-9/_-]+\.webp$/.test(value)) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com") &&
      /^\/blog\/[a-zA-Z0-9/_-]+\.webp$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isPreviewableBlogImageUrl(value: string): boolean {
  return value.startsWith("blob:") || isStoredBlogImageUrl(value);
}
