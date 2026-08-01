import Link from "next/link";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { blogCategories, blogPosts } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AdminPostsPageProps {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}

const PAGE_SIZE = 10;

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() || "";
  const status = params.status === "draft" || params.status === "published" ? params.status : "";
  const page = Math.max(1, Number(params.page) || 1);
  const searchFilter = search
    ? or(ilike(blogPosts.title, `%${search}%`), ilike(blogPosts.slug, `%${search}%`))
    : undefined;
  const where = and(searchFilter, status ? eq(blogPosts.status, status) : undefined);

  const [posts, totalResult] = await Promise.all([
    db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        status: blogPosts.status,
        readingTime: blogPosts.readingTime,
        updatedAt: blogPosts.updatedAt,
        category: blogCategories.name,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(where)
      .orderBy(desc(blogPosts.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(blogPosts).where(where),
  ]);
  const total = totalResult[0]?.value || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const queryFor = (targetPage: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (status) query.set("status", status);
    query.set("page", String(targetPage));
    return `/admin/posts?${query.toString()}`;
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div><h1 className="text-3xl font-bold">Blog posts</h1><p className="text-muted-foreground mt-1">Create, publish, and maintain PDFPilot content.</p></div>
        <Button asChild><Link href="/admin/posts/new">New post</Link></Button>
      </div>

      <Card className="p-4 mb-6">
        <form className="flex flex-col sm:flex-row gap-3">
          <Input name="q" defaultValue={search} placeholder="Search title or slug" aria-label="Search posts" />
          <select name="status" defaultValue={status} className="h-10 rounded-lg border border-input bg-background px-3 text-sm sm:w-44" aria-label="Filter by status">
            <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option>
          </select>
          <Button type="submit" variant="outline">Filter</Button>
        </form>
      </Card>

      {posts.length ? (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="font-semibold truncate">{post.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${post.status === "published" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{post.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">/{post.slug} · {post.category || "Uncategorized"} · {post.readingTime} min read</p>
                  <p className="text-xs text-muted-foreground mt-1">Updated {post.updatedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {post.status === "published" && <Button size="sm" variant="outline" asChild><Link href={`/blog/${post.slug}`}>View</Link></Button>}
                  <Button size="sm" asChild><Link href={`/admin/posts/${post.id}`}>Edit</Link></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center"><h2 className="font-semibold mb-2">No posts found</h2><p className="text-sm text-muted-foreground mb-5">Create the first post or adjust your filters.</p><Button asChild><Link href="/admin/posts/new">Create post</Link></Button></Card>
      )}

      {pages > 1 && <nav className="flex justify-center items-center gap-3 mt-8" aria-label="Post pagination"><Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={queryFor(page - 1)}>Previous</Link> : <span>Previous</span>}</Button><span className="text-sm text-muted-foreground">Page {page} of {pages}</span><Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>{page < pages ? <Link href={queryFor(page + 1)}>Next</Link> : <span>Next</span>}</Button></nav>}
    </main>
  );
}
