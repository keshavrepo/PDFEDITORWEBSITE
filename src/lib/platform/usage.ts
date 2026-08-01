/**
 * Usage statistics for the dashboard.
 *
 * Everything here is derived from real rows the products already write. When a
 * user has done nothing yet the numbers are genuinely zero rather than sample
 * data, so the dashboard never shows figures that are not the user's own.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { favorites, processingHistory } from "@/db/schema";
import { getProduct, products } from "@/lib/products";
import { tools } from "@/lib/tools";

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
