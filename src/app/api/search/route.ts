import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, officeDocuments, financeCalculations, socialProjects } from "@/db/schema";
import { searchStatic, type SearchResult } from "@/lib/platform/search";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/request";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Global search across products, tools, documentation, blog articles and
 * the signed-in user's recent office documents.
 *
 * Static entries are matched in memory so results feel instant; only the
 * article and office-document lookups touch the database, and both are
 * bounded and indexed.
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

  // Recent office documents (only when the user is signed in).
  const user = await getSession();
  if (user) {
    try {
      const term = `%${query}%`;
      const recent = await db
        .select({
          id: officeDocuments.id,
          title: officeDocuments.title,
          kind: officeDocuments.kind,
          category: officeDocuments.category,
          updatedAt: officeDocuments.updatedAt,
        })
        .from(officeDocuments)
        .where(
          and(
            eq(officeDocuments.userId, user.id),
            ilike(officeDocuments.title, term)
          )
        )
        .orderBy(desc(officeDocuments.updatedAt))
        .limit(8);
      for (const entry of recent) {
        const href =
          entry.kind === "word"
            ? "/officepilot"
            : `/officepilot/${entry.kind}`;
        results.push({
          id: `recent-${entry.id}`,
          type: "recent",
          title: entry.title,
          description: `${entry.kind} · ${entry.category.replace(/-/g, " ")}`,
          href,
          context: "Your recent documents",
          score: 4,
        });
      }

      const recentFinance = await db
        .select({
          id: financeCalculations.id,
          title: financeCalculations.title,
          kind: financeCalculations.kind,
          category: financeCalculations.category,
          updatedAt: financeCalculations.updatedAt,
        })
        .from(financeCalculations)
        .where(
          and(
            eq(financeCalculations.userId, user.id),
            ilike(financeCalculations.title, term)
          )
        )
        .orderBy(desc(financeCalculations.updatedAt))
        .limit(8);
      for (const entry of recentFinance) {
        results.push({
          id: `recent-finance-${entry.id}`,
          type: "recent",
          title: entry.title,
          description: `${entry.kind} · ${entry.category.replace(/-/g, " ")}`,
          href: entry.kind === "blank" ? "/financepilot" : `/financepilot/${entry.kind}`,
          context: "Your recent calculations",
          score: 4,
        });
      }

      const recentSocial = await db
        .select({
          id: socialProjects.id,
          title: socialProjects.title,
          kind: socialProjects.kind,
          category: socialProjects.category,
          updatedAt: socialProjects.updatedAt,
        })
        .from(socialProjects)
        .where(
          and(
            eq(socialProjects.userId, user.id),
            ilike(socialProjects.title, term)
          )
        )
        .orderBy(desc(socialProjects.updatedAt))
        .limit(8);
      for (const entry of recentSocial) {
        results.push({
          id: `recent-social-${entry.id}`,
          type: "recent",
          title: entry.title,
          description: `${entry.kind} · ${entry.category.replace(/-/g, " ")}`,
          href: entry.kind === "blank" ? "/socialpilot" : `/socialpilot/${entry.kind}`,
          context: "Your recent projects",
          score: 4,
        });
      }
    } catch {
      // Continue without the recent mirror.
    }
  }

  results.sort((a, b) => b.score - a.score);
  return Response.json({ results: results.slice(0, 24) });
}
