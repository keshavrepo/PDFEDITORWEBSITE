import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  blogCategories,
  blogPosts,
  blogPostTags,
  blogTags,
} from "@/db/schema";
import { getAdmin } from "@/lib/admin";
import {
  calculateReadingTime,
  createSlug,
  normalizeTagNames,
  sanitizePostHtml,
} from "@/lib/blog";
import { blogPostInputSchema } from "@/lib/blog-validation";
import { getClientIp, isSameOrigin } from "@/lib/request";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const parsed = blogPostInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Invalid post" },
        { status: 400 }
      );
    }

    const content = sanitizePostHtml(parsed.data.content);
    if (content.length < 20) {
      return Response.json({ error: "Post content is too short" }, { status: 400 });
    }
    const slug = createSlug(parsed.data.slug || parsed.data.title);
    if (!slug) return Response.json({ error: "Enter a valid slug" }, { status: 400 });
    const tagNames = normalizeTagNames(parsed.data.tags || []);

    const updated = await db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({ status: blogPosts.status, publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.id, id))
        .limit(1);
      if (!existing) return null;

      let categoryId: string | null = null;
      if (parsed.data.category) {
        const categorySlug = createSlug(parsed.data.category);
        const [category] = await transaction
          .insert(blogCategories)
          .values({ name: parsed.data.category, slug: categorySlug })
          .onConflictDoUpdate({
            target: blogCategories.slug,
            set: { name: parsed.data.category, updatedAt: new Date() },
          })
          .returning({ id: blogCategories.id });
        categoryId = category.id;
      }

      const [post] = await transaction
        .update(blogPosts)
        .set({
          categoryId,
          title: parsed.data.title,
          slug,
          excerpt: parsed.data.excerpt,
          content,
          featuredImage: parsed.data.featuredImage || null,
          status: parsed.data.status,
          seoTitle: parsed.data.seoTitle || null,
          seoDescription: parsed.data.seoDescription || null,
          seoKeywords: parsed.data.seoKeywords || null,
          readingTime: calculateReadingTime(content),
          publishedAt:
            parsed.data.status === "published"
              ? existing.publishedAt || new Date()
              : null,
          updatedAt: new Date(),
        })
        .where(eq(blogPosts.id, id))
        .returning({ id: blogPosts.id, slug: blogPosts.slug });

      await transaction.delete(blogPostTags).where(eq(blogPostTags.postId, id));
      for (const name of tagNames) {
        const tagSlug = createSlug(name).slice(0, 80);
        if (!tagSlug) continue;
        const [tag] = await transaction
          .insert(blogTags)
          .values({ name, slug: tagSlug })
          .onConflictDoUpdate({ target: blogTags.slug, set: { name } })
          .returning({ id: blogTags.id });
        await transaction.insert(blogPostTags).values({ postId: id, tagId: tag.id });
      }

      await transaction.insert(auditLogs).values({
        userId: admin.id,
        action: "blog.post_updated",
        resourceType: "blog_post",
        resourceId: id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { previousStatus: existing.status, status: parsed.data.status, slug },
      });
      return post;
    });

    if (!updated) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post: updated });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === "23505") {
      return Response.json({ error: "That post slug is already in use" }, { status: 409 });
    }
    console.error("Updating blog post failed", error);
    return Response.json({ error: "Unable to update post" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const [deleted] = await db.transaction(async (transaction) => {
      const result = await transaction
        .delete(blogPosts)
        .where(eq(blogPosts.id, id))
        .returning({ id: blogPosts.id, slug: blogPosts.slug });
      if (result[0]) {
        await transaction.insert(auditLogs).values({
          userId: admin.id,
          action: "blog.post_deleted",
          resourceType: "blog_post",
          resourceId: id,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
          metadata: { slug: result[0].slug },
        });
      }
      return result;
    });

    if (!deleted) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ message: "Post deleted" });
  } catch (error) {
    console.error("Deleting blog post failed", error);
    return Response.json({ error: "Unable to delete post" }, { status: 500 });
  }
}
