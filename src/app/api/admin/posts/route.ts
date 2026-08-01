import { NextRequest } from "next/server";
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

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
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

    const post = await db.transaction(async (transaction) => {
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

      const [created] = await transaction
        .insert(blogPosts)
        .values({
          authorId: admin.id,
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
          publishedAt: parsed.data.status === "published" ? new Date() : null,
        })
        .returning({ id: blogPosts.id, slug: blogPosts.slug });

      for (const name of tagNames) {
        const tagSlug = createSlug(name).slice(0, 80);
        if (!tagSlug) continue;
        const [tag] = await transaction
          .insert(blogTags)
          .values({ name, slug: tagSlug })
          .onConflictDoUpdate({ target: blogTags.slug, set: { name } })
          .returning({ id: blogTags.id });
        await transaction.insert(blogPostTags).values({ postId: created.id, tagId: tag.id });
      }

      await transaction.insert(auditLogs).values({
        userId: admin.id,
        action: "blog.post_created",
        resourceType: "blog_post",
        resourceId: created.id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { status: parsed.data.status, slug },
      });
      return created;
    });

    return Response.json({ post }, { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === "23505") {
      return Response.json({ error: "That post slug is already in use" }, { status: 409 });
    }
    console.error("Creating blog post failed", error);
    return Response.json({ error: "Unable to create post" }, { status: 500 });
  }
}
