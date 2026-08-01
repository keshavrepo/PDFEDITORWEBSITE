import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { searchStatic, type SearchResult } from "@/lib/platform/search";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Global search across products, tools, documentation and blog articles.
 *
 * Static entries are matched in memory so results feel instant; only the
 * article lookup touches the database, and it is bounded and indexed.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ results: [] });

  // Search is unauthenticated, so it is rate limited per client.
  const limit = checkRateLimit(`search:${getClientIp(request)}`, 60, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const results: SearchResult[] = searchStatic(query, 20);

  try {
    const term = `%${query}%`;
    const articles = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.status, "published"),
          or(ilike(blogPosts.title, term), ilike(blogPosts.excerpt, term))
        )
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(8);

    for (const article of articles) {
      results.push({
        id: `article-${article.id}`,
        type: "article",
        title: article.title,
        description: article.excerpt,
        href: `/blog/${article.slug}`,
        context: "Article",
        // Sits below an exact tool or product match but above weak fuzzy hits.
        score: 5,
      });
    }
  } catch {
    // Search must keep working when the database is unavailable; static
    // results are still returned.
  }

  results.sort((a, b) => b.score - a.score);
  return Response.json({ results: results.slice(0, 24) });
}
