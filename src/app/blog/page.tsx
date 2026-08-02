import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { blogCategories, blogPosts } from "@/db/schema";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeaturedImage } from "@/components/featured-image";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/blog",
  title: "Blog",
  description:
    "Productivity guides, privacy practices, and product insights from Keshav Labs and the LaunchStack team.",
});
export const dynamic = "force-dynamic";
const PAGE_SIZE = 7;

interface BlogPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const [user, params] = await Promise.all([getSession(), searchParams]);
  const search = params.q?.trim() || "";
  const page = Math.max(1, Number(params.page) || 1);
  const where = and(
    eq(blogPosts.status, "published"),
    search
      ? or(
          ilike(blogPosts.title, `%${search}%`),
          ilike(blogPosts.excerpt, `%${search}%`),
          ilike(blogPosts.seoKeywords, `%${search}%`)
        )
      : undefined
  );
  const [posts, totals] = await Promise.all([
    db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        featuredImage: blogPosts.featuredImage,
        readingTime: blogPosts.readingTime,
        publishedAt: blogPosts.publishedAt,
        category: blogCategories.name,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(where)
      .orderBy(desc(blogPosts.publishedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(blogPosts).where(where),
  ]);
  const totalPages = Math.max(1, Math.ceil((totals[0]?.value || 0) / PAGE_SIZE));
  const featured = page === 1 && !search ? posts[0] : null;
  const gridPosts = featured ? posts.slice(1) : posts;
  const pageHref = (target: number) =>
    `/blog?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(target) })}`;

  const postMeta = (post: (typeof posts)[number]) => (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {post.category && <span>{post.category}</span>}
      {post.category && <span>·</span>}
      <span>{post.publishedAt?.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
      <span>·</span><span>{post.readingTime} min read</span>
    </div>
  );

  return (
    <>
      <Navbar user={user} />
      <main className="animate-page-in">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
          <div className="max-w-2xl"><h1 className="text-4xl md:text-5xl font-bold mb-4">Blog</h1><p className="text-lg text-muted-foreground mb-7">Practical guidance for safer, faster document work.</p><form className="flex gap-3"><Input name="q" defaultValue={search} placeholder="Search articles" aria-label="Search articles" /><Button variant="outline">Search</Button></form>{user?.role === "admin" && <Link className="inline-block mt-4 text-sm underline underline-offset-4" href="/admin/posts">Manage posts</Link>}</div>
        </section>

        {featured && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <Link href={`/blog/${featured.slug}`}>
              <Card className="overflow-hidden hover:bg-accent transition-colors cursor-pointer">
                <FeaturedImage
                  src={featured.featuredImage}
                  alt={featured.title}
                  className="aspect-video"
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  priority
                />
                <div className="p-7 sm:p-9 max-w-4xl"><p className="text-sm text-primary font-medium mb-2">Latest article</p><h2 className="text-2xl md:text-3xl font-bold mb-3">{featured.title}</h2><p className="text-muted-foreground mb-5">{featured.excerpt}</p>{postMeta(featured)}</div>
              </Card>
            </Link>
          </section>
        )}

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          {search && <div className="flex items-center justify-between gap-4 mb-6"><p className="text-sm text-muted-foreground">Results for “{search}”</p><Link className="text-sm underline" href="/blog">Clear search</Link></div>}
          {gridPosts.length ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gridPosts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card className="h-full overflow-hidden hover:bg-accent transition-colors cursor-pointer">
                    <FeaturedImage
                      src={post.featuredImage}
                      alt={post.title}
                      className="aspect-video"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="p-6"><h2 className="font-semibold text-lg mb-2 line-clamp-2">{post.title}</h2><p className="text-sm text-muted-foreground mb-5 line-clamp-3">{post.excerpt}</p>{postMeta(post)}</div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center"><h2 className="font-semibold mb-2">No published articles found</h2><p className="text-sm text-muted-foreground">Try another search or check back for new guides from Keshav Labs.</p></Card>
          )}
          {totalPages > 1 && <nav className="flex justify-center items-center gap-3 mt-10" aria-label="Blog pagination"><Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}</Button><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><Button variant="outline" size="sm" asChild={page < totalPages} disabled={page >= totalPages}>{page < totalPages ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}</Button></nav>}
        </section>
      </main>
      <Footer />
    </>
  );
}
