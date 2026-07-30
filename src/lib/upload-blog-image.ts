"use client";

import {
  BLOG_IMAGE_ACCEPTED_TYPES,
  BLOG_IMAGE_MAX_BYTES,
  type BlogImagePurpose,
} from "@/lib/blog-images";

export interface UploadedBlogImage {
  url: string;
  width: number;
  height: number;
  size: number;
  contentType: "image/webp";
}

export function validateBlogImageFile(file: File): string | null {
  if (!BLOG_IMAGE_ACCEPTED_TYPES.includes(file.type as (typeof BLOG_IMAGE_ACCEPTED_TYPES)[number])) {
    return "Choose a JPEG, PNG, or WebP image";
  }
  if (!file.size || file.size > BLOG_IMAGE_MAX_BYTES) {
    return "Image must be 8MB or smaller";
  }
  return null;
}

export async function uploadBlogImage(
  file: File,
  purpose: BlogImagePurpose
): Promise<UploadedBlogImage> {
  const validationError = validateBlogImageFile(file);
  if (validationError) throw new Error(validationError);

  const formData = new FormData();
  formData.set("file", file);
  formData.set("purpose", purpose);
  const response = await fetch("/api/admin/uploads", {
    method: "POST",
    body: formData,
  });
  const result = (await response.json()) as {
    image?: UploadedBlogImage;
    error?: string;
  };
  if (!response.ok || !result.image) {
    throw new Error(result.error || "Unable to upload image");
  }
  return result.image;
}
