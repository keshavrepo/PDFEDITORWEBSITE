import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogCategories, blogPosts, blogPostTags, blogTags, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { siteConfig } from "@/lib/site";

interface BlogPostPageProps { params: Promise<{ slug: string }> }

async function findPost(slug: string) {
  const [post] = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      content: blogPosts.content,
      featuredImage: blogPosts.featuredImage,
      readingTime: blogPosts.readingTime,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      seoTitle: blogPosts.seoTitle,
      seoDescription: blogPosts.seoDescription,
      seoKeywords: blogPosts.seoKeywords,
      category: blogCategories.name,
      author: users.name,
    })
    .from(blogPosts)
    .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
    .leftJoin(users, eq(blogPosts.authorId, users.id))
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))
    .limit(1);
  return post;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await findPost((await params).slug);
  if (!post) return { title: "Article not found | PDFPilot" };
  return {
    title: post.seoTitle || `${post.title} | PDFPilot`,
    description: post.seoDescription || post.excerpt,
    keywords: post.seoKeywords?.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: post.featuredImage ? [post.featuredImage] : undefined,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [user, post] = await Promise.all([getSession(), findPost(slug)]);
  if (!post) notFound();
  const tags = await db
    .select({ name: blogTags.name, slug: blogTags.slug })
    .from(blogPostTags)
    .innerJoin(blogTags, eq(blogPostTags.tagId, blogTags.id))
    .where(eq(blogPostTags.postId, post.id));

  return (
    <>
      <Navbar user={user} />
      <main>
        <article>
          <header className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-10">
            <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">← Back to blog</Link>
            <div className="mt-8">
              {post.category && <p className="text-sm font-semibold text-primary mb-3">{post.category}</p>}
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">{post.title}</h1>
              <p className="text-lg text-muted-foreground leading-8 mb-6">{post.excerpt}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>By {post.author || siteConfig.founder}</span><span>·</span><time dateTime={post.publishedAt?.toISOString()}>{post.publishedAt?.toLocaleDateString("en-IN", { dateStyle: "long" })}</time><span>·</span><span>{post.readingTime} min read</span>
              </div>
            </div>
          </header>
          {post.featuredImage && <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10"><div className="aspect-[16/8] rounded-2xl bg-muted bg-cover bg-center" role="img" aria-label={post.title} style={{ backgroundImage: `url(${JSON.stringify(post.featuredImage)})` }} /></div>}
          <div
            className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 text-base leading-8 text-foreground/90 [&_p]:mb-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          {tags.length > 0 && <footer className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24"><div className="border-t pt-6 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag.slug} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{tag.name}</span>)}</div></footer>}
        </article>
      </main>
      <Footer />
    </>
  );
}
