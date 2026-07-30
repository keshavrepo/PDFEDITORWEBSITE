import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { AdminPostForm } from "@/components/admin-post-form";
import { db } from "@/db";
import { blogCategories, blogPosts, blogPostTags, blogTags } from "@/db/schema";

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const [post] = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      content: blogPosts.content,
      featuredImage: blogPosts.featuredImage,
      status: blogPosts.status,
      seoTitle: blogPosts.seoTitle,
      seoDescription: blogPosts.seoDescription,
      seoKeywords: blogPosts.seoKeywords,
      category: blogCategories.name,
    })
    .from(blogPosts)
    .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
    .where(eq(blogPosts.id, id))
    .limit(1);
  if (!post) notFound();

  const [tagRows, categories] = await Promise.all([
    db
      .select({ name: blogTags.name })
      .from(blogPostTags)
      .innerJoin(blogTags, eq(blogPostTags.tagId, blogTags.id))
      .where(eq(blogPostTags.postId, id)),
    db.select({ name: blogCategories.name }).from(blogCategories).orderBy(asc(blogCategories.name)),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8"><h1 className="text-3xl font-bold">Edit post</h1><p className="text-muted-foreground mt-1">Update content, publishing, and search metadata.</p></div>
      <AdminPostForm
        post={{ ...post, tags: tagRows.map((tag) => tag.name) }}
        categories={categories.map((category) => category.name)}
      />
    </main>
  );
}
