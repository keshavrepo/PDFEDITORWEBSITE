import { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getAdmin } from "@/lib/admin";
import { BLOG_IMAGE_MAX_BYTES, type BlogImagePurpose } from "@/lib/blog-images";
import { optimizeAndStoreBlogImage } from "@/lib/image-storage";
import {
  checkRateLimit,
  getClientIp,
  isSameOrigin,
  rateLimitResponse,
} from "@/lib/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const rateLimit = checkRateLimit(`blog-upload:${admin.id}`, 60, 60 * 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > BLOG_IMAGE_MAX_BYTES + 512_000) {
    return Response.json({ error: "Image must be 8MB or smaller" }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedPurpose = formData.get("purpose");
    const purpose: BlogImagePurpose =
      requestedPurpose === "content" ? "content" : "featured";
    if (!(file instanceof File)) {
      return Response.json({ error: "Select an image to upload" }, { status: 400 });
    }

    const stored = await optimizeAndStoreBlogImage(file, purpose);
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: "blog.image_uploaded",
      resourceType: "blog_image",
      resourceId: stored.url,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        purpose,
        originalType: file.type,
        originalSize: file.size,
        optimizedSize: stored.size,
        width: stored.width,
        height: stored.height,
      },
    });

    return Response.json(
      {
        image: stored,
        message: "Image uploaded and optimized",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload image";
    const isValidationError =
      message.includes("8MB") ||
      message.includes("JPEG") ||
      message.includes("supported image") ||
      message.includes("dimensions");
    const isConfigurationError = message.includes("BLOB_READ_WRITE_TOKEN");
    console.error("Blog image upload failed", error);
    return Response.json(
      {
        error:
          isValidationError || isConfigurationError
            ? message
            : "Unable to upload and optimize image",
      },
      { status: isValidationError ? 400 : isConfigurationError ? 503 : 500 }
    );
  }
}
