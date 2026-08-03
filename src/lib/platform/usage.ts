/**
 * Usage statistics for the dashboard.
 *
 * Everything here is derived from real rows the products already write. When a
 * user has done nothing yet the numbers are genuinely zero rather than sample
 * data, so the dashboard never shows figures that are not the user's own.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, favorites, files, processingHistory } from "@/db/schema";
import { getProduct, products } from "@/lib/products";
import { tools } from "@/lib/tools";
import {
  getActiveUsersSummary,
  getPageViewSummary,
  getPerformanceSummary,
  getProductUsageSummary,
  getSearchUsageSummary,
  type ActiveUsersSummary,
  type PageViewSummary,
  type PerformanceSummary,
  type ProductUsageSummary,
  type SearchUsageSummary,
} from "@/lib/platform/analytics";

export interface UsageStatistics {
  totalOperations: number;
  operationsThisMonth: number;
  successfulOperations: number;
  failedOperations: number;
  /** 0-100, rounded. Null when nothing has run yet. */
  successRate: number | null;
  /** Most-used tools, highest first. */
  topTools: Array<{ toolName: string; href: string | null; count: number }>;
  /** Operations grouped by product. */
  byProduct: Array<{ productId: string; productName: string; count: number }>;
}

export interface FavoriteEntry {
  /** Tool id or product id. */
  identifier: string;
  name: string;
  href: string;
  kind: "tool" | "product";
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Aggregates a user's processing history into dashboard statistics. */
export async function getUsageStatistics(userId: string): Promise<UsageStatistics> {
  const [totals, monthly, perTool, perProduct] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        succeeded: sql<number>`count(*) filter (where ${processingHistory.status} <> 'failed')::int`,
        failed: sql<number>`count(*) filter (where ${processingHistory.status} = 'failed')::int`,
      })
      .from(processingHistory)
      .where(eq(processingHistory.userId, userId)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(processingHistory)
      .where(
        and(
          eq(processingHistory.userId, userId),
          gte(processingHistory.createdAt, startOfMonth())
        )
      ),
    db
      .select({
        toolName: processingHistory.toolName,
        count: sql<number>`count(*)::int`,
      })
      .from(processingHistory)
      .where(eq(processingHistory.userId, userId))
      .groupBy(processingHistory.toolName)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db
      .select({
        productId: processingHistory.productId,
        count: sql<number>`count(*)::int`,
      })
      .from(processingHistory)
      .where(eq(processingHistory.userId, userId))
      .groupBy(processingHistory.productId)
      .orderBy(desc(sql`count(*)`)),
  ]);

  const totalOperations = totals[0]?.total ?? 0;
  const successfulOperations = totals[0]?.succeeded ?? 0;
  const failedOperations = totals[0]?.failed ?? 0;

  // Tool names are stored as free text, so match them back to the registry by
  // name to recover a link where one exists.
  const toolsByName = new Map(tools.map((tool) => [tool.name.toLowerCase(), tool]));

  return {
    totalOperations,
    operationsThisMonth: monthly[0]?.total ?? 0,
    successfulOperations,
    failedOperations,
    successRate: totalOperations
      ? Math.round((successfulOperations / totalOperations) * 100)
      : null,
    topTools: perTool.map((row) => ({
      toolName: row.toolName,
      href: toolsByName.get(row.toolName.toLowerCase())?.href ?? null,
      count: row.count,
    })),
    byProduct: perProduct.map((row) => ({
      productId: row.productId,
      productName:
        row.productId === "launchstack"
          ? "LaunchStack"
          : getProduct(row.productId)?.name ?? row.productId,
      count: row.count,
    })),
  };
}

/** Reads a user's favourited tools and products. */
export async function getFavorites(userId: string): Promise<{
  tools: FavoriteEntry[];
  products: FavoriteEntry[];
}> {
  const rows = await db
    .select({ identifier: favorites.toolName, kind: favorites.kind })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));

  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  const productsById = new Map(products.map((product) => [product.id, product]));

  const favoriteTools: FavoriteEntry[] = [];
  const favoriteProducts: FavoriteEntry[] = [];

  for (const row of rows) {
    if (row.kind === "product") {
      const product = productsById.get(row.identifier);
      // Skip entries whose target no longer exists, rather than linking nowhere.
      if (!product) continue;
      favoriteProducts.push({
        identifier: product.id,
        name: product.name,
        href: product.href ?? "/products",
        kind: "product",
      });
      continue;
    }

    const tool = toolsById.get(row.identifier);
    if (!tool) continue;
    favoriteTools.push({
      identifier: tool.id,
      name: tool.name,
      href: tool.href,
      kind: "tool",
    });
  }

  return { tools: favoriteTools, products: favoriteProducts };
}

/** Adds or removes a favourite and reports the resulting state. */
export async function toggleFavorite(
  userId: string,
  identifier: string,
  kind: "tool" | "product"
): Promise<boolean> {
  const existing = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.toolName, identifier)))
    .limit(1);

  if (existing.length) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return false;
  }

  await db.insert(favorites).values({ userId, toolName: identifier, kind });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Dashboard analytics — extends the existing usage statistics with the       */
/* rows the analytics event log captures. No UI depends on this yet; the      */
/* payload is shaped so the next pass can drop it straight into cards.        */
/* -------------------------------------------------------------------------- */

export interface DashboardAnalytics {
  /** Page view totals / uniques / top paths, platform-wide. */
  pageViews: PageViewSummary;
  /** Active sessions over 5 / 60 / 1440 minute windows. */
  activeUsers: ActiveUsersSummary;
  /** Per-product event volume for the last 30 days. */
  productUsage: ProductUsageSummary[];
  /** Performance summary: slow pages, recent errors, failed requests. */
  performance: PerformanceSummary;
  /** Search usage. */
  search: SearchUsageSummary;
  /** Per-user activity summary so the signed-in user's own analytics mirror. */
  forUser: {
    pageViews: number;
    toolEvents: number;
    errorEvents: number;
    lastEventAt: Date | null;
    exportCount: number;
    /** Storage usage, derived from the file table the dashboard already shows. */
    storage: {
      usedBytes: number;
      fileCount: number;
      favoriteCount: number;
    };
  };
}

/**
 * Single read for the dashboard's analytics cards. Combines the platform-
 * wide aggregates (page views, active users, performance, search) with a
 * per-user slice so the signed-in user can see their own funnel without a
 * second round trip.
 */
export async function getDashboardAnalytics(userId: string | null): Promise<DashboardAnalytics> {
  const [pageViews, activeUsers, productUsage, performance, search, userTotals, storage] =
    await Promise.all([
      getPageViewSummary(),
      getActiveUsersSummary(),
      getProductUsageSummary(),
      getPerformanceSummary(),
      getSearchUsageSummary(),
      userId ? loadUserEventTotals(userId) : null,
      userId ? loadUserStorage(userId) : null,
    ]);

  return {
    pageViews,
    activeUsers,
    productUsage,
    performance,
    search,
    forUser: {
      pageViews: userTotals?.pageViews ?? 0,
      toolEvents: userTotals?.toolEvents ?? 0,
      errorEvents: userTotals?.errorEvents ?? 0,
      lastEventAt: userTotals?.lastEventAt ?? null,
      exportCount: userTotals?.exportCount ?? 0,
      storage: storage ?? { usedBytes: 0, fileCount: 0, favoriteCount: 0 },
    },
  };
}

async function loadUserEventTotals(userId: string): Promise<{
  pageViews: number;
  toolEvents: number;
  errorEvents: number;
  lastEventAt: Date | null;
  exportCount: number;
}> {
  const rows = await db
    .select({
      category: analyticsEvents.category,
      count: sql<number>`count(*)::int`,
      last: sql<Date | null>`max(${analyticsEvents.createdAt})`,
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.userId, userId))
    .groupBy(analyticsEvents.category);

  let pageViews = 0;
  let toolEvents = 0;
  let errorEvents = 0;
  let lastEventAt: Date | null = null;

  for (const row of rows) {
    if (row.last && (!lastEventAt || row.last > lastEventAt)) lastEventAt = row.last;
    if (row.category === "pageview") pageViews = row.count;
    else if (row.category === "tool" || row.category === "project" || row.category === "export" || row.category === "import" || row.category === "save") toolEvents += row.count;
    else if (row.category === "error") errorEvents = row.count;
  }

  const [exportCountRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.userId, userId),
        eq(analyticsEvents.category, "export")
      )
    );

  return {
    pageViews,
    toolEvents,
    errorEvents,
    lastEventAt,
    exportCount: exportCountRow?.value ?? 0,
  };
}

async function loadUserStorage(userId: string): Promise<{
  usedBytes: number;
  fileCount: number;
  favoriteCount: number;
}> {
  const [row] = await db
    .select({
      usedBytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint`,
      fileCount: sql<number>`count(*)::int`,
      favoriteCount: sql<number>`count(*) filter (where ${files.isFavorite})::int`,
    })
    .from(files)
    .where(and(eq(files.userId, userId), sql`${files.deletedAt} is null`));
  return {
    usedBytes: Number(row?.usedBytes ?? 0) || 0,
    fileCount: row?.fileCount ?? 0,
    favoriteCount: row?.favoriteCount ?? 0,
  };
}
