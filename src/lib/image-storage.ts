import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { del, put } from "@vercel/blob";
import { nanoid } from "nanoid";
import sharp from "sharp";
import {
  BLOG_IMAGE_ACCEPTED_TYPES,
  BLOG_IMAGE_MAX_BYTES,
  isStoredBlogImageUrl,
  type BlogImagePurpose,
} from "@/lib/blog-images";

interface StoredImage {
  url: string;
  width: number;
  height: number;
  size: number;
  contentType: "image/webp";
}

export async function optimizeAndStoreBlogImage(
  file: File,
  purpose: BlogImagePurpose
): Promise<StoredImage> {
  if (!BLOG_IMAGE_ACCEPTED_TYPES.includes(file.type as (typeof BLOG_IMAGE_ACCEPTED_TYPES)[number])) {
    throw new Error("Choose a JPEG, PNG, or WebP image");
  }
  if (!file.size || file.size > BLOG_IMAGE_MAX_BYTES) {
    throw new Error("Image must be between 1 byte and 8MB");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const source = sharp(input, {
    failOn: "error",
    limitInputPixels: 40_000_000,
    animated: false,
  });
  const metadata = await source.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error("The uploaded file does not contain a supported image");
  }
  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions");
  }

  const sourceAspectRatio = metadata.width / metadata.height;
  const featuredWidth =
    sourceAspectRatio >= 16 / 9
      ? Math.min(1600, Math.round(metadata.height * (16 / 9)))
      : Math.min(1600, metadata.width);
  const featuredHeight = Math.round(featuredWidth * (9 / 16));
  const resize =
    purpose === "featured"
      ? {
          width: featuredWidth,
          height: featuredHeight,
          fit: "cover" as const,
          withoutEnlargement: true,
        }
      : { width: 1600, height: 1600, fit: "inside" as const, withoutEnlargement: true };
  const optimized = await source
    .rotate()
    .resize(resize)
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  const now = new Date();
  const relativePath = `blog/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${nanoid(18)}.webp`;
  let url: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(relativePath, optimized.data, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "image/webp",
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
    });
    url = blob.url;
  } else {
    if (process.env.VERCEL) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required for image uploads on Vercel");
    }
    const publicPath = path.join(process.cwd(), "public", "uploads", relativePath);
    await mkdir(path.dirname(publicPath), { recursive: true });
    await writeFile(publicPath, optimized.data);
    url = `/uploads/${relativePath}`;
  }

  return {
    url,
    width: optimized.info.width,
    height: optimized.info.height,
    size: optimized.info.size,
    contentType: "image/webp",
  };
}

export function extractStoredBlogImageUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)) {
    if (match[1] && isStoredBlogImageUrl(match[1])) urls.add(match[1]);
  }
  return [...urls];
}

export async function deleteStoredBlogImage(url: string): Promise<void> {
  if (!isStoredBlogImageUrl(url)) return;
  if (url.startsWith("https://")) {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }
    return;
  }

  const relative = url.replace(/^\//, "");
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads", "blog");
  const filePath = path.resolve(process.cwd(), "public", relative);
  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) return;
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function deleteUnusedBlogImages(
  previous: Array<string | null | undefined>,
  current: Array<string | null | undefined>
): Promise<void> {
  const currentSet = new Set(current.filter((value): value is string => Boolean(value)));
  const unused = [
    ...new Set(
      previous.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0 && !currentSet.has(value)
      )
    ),
  ];
  await Promise.all(
    unused.map((url) =>
      deleteStoredBlogImage(url).catch((error) => {
        console.error("Unable to remove unused blog image", error);
      })
    )
  );
}
