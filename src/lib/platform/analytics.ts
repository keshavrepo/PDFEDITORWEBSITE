/**
 * Analytics infrastructure.
 *
 * Provides the read/write helpers that back the analytics API routes and the
 * dashboard aggregations. The split mirrors the rest of the platform: writes
 * come from the API routes (rate-limited, same-origin guarded, anonymous-
 * friendly) and reads are derived from the same tables the products already
 * populate, so the dashboard never has to invent figures.
 *
 * Three tables back this module:
 * - `analyticsSessions`   one row per visitor session (cookie-issued id)
 * - `analyticsEvents`     generic event log: pageviews, tool opens, exports,
 *                          performance, errors, navigation flow
 * - `analyticsSearchQueries` one row per search submission
 *
 * All helpers are best-effort: a failure to record an event must never block
 * a user action or surface in the UI.
 */

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, analyticsSearchQueries, analyticsSessions } from "@/db/schema";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export const ANALYTICS_CATEGORIES = [
  "pageview",
  "tool",
  "project",
  "export",
  "import",
  "save",
  "performance",
  "error",
  "navigation",
  "funnel",
  "engagement",
] as const;
export type AnalyticsCategory = (typeof ANALYTICS_CATEGORIES)[number];

/** Tracked dimensions kept short to fit the column lengths. */
export interface AnalyticsEventInput {
  sessionId?: string | null;
  userId?: string | null;
  category: AnalyticsCategory;
  action: string;
  productId?: string;
  toolName?: string;
  path?: string;
  fromPath?: string;
  durationMs?: number;
  status?: number;
  /** Small free-form payload. Must be JSON-serialisable and < 8 KB. */
  props?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AnalyticsSessionInput {
  sessionId: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  locale?: string | null;
}

export interface AnalyticsSearchInput {
  sessionId?: string | null;
  userId?: string | null;
  query: string;
  resultsCount: number;
  latencyMs: number;
  source?: string;
  firstClickHref?: string | null;
  firstClickType?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Read-side aggregates (used by the dashboard)                               */
/* -------------------------------------------------------------------------- */

export interface PageViewSummary {
  total: number;
  uniqueSessions: number;
  today: number;
  /** Last 7 days, oldest first. */
  last7Days: number[];
  /** Top paths, highest first. */
  topPaths: Array<{ path: string; count: number }>;
}

export interface ActiveUsersSummary {
  /** Distinct sessions seen in the last 5 minutes. */
  last5Minutes: number;
  /** Distinct sessions seen in the last hour. */
  lastHour: number;
  /** Distinct sessions seen in the last 24 hours. */
  lastDay: number;
}

export interface ProductUsageSummary {
  productId: string;
  productName: string;
  events: number;
  sessions: number;
}

export interface PerformanceSummary {
  /** Pages slower than the threshold in the last 24h. */
  slowPages: Array<{ path: string; avgMs: number; p95Ms: number; count: number }>;
  /** Recent error events. */
  recentErrors: Array<{ action: string; path: string | null; status: number | null; message: string | null; createdAt: Date }>;
  failedRequestCount: number;
}

export interface SearchUsageSummary {
  totalQueries: number;
  uniqueQueries: number;
  topQueries: Array<{ query: string; count: number }>;
  zeroResultQueries: Array<{ query: string; count: number }>;
  averageLatencyMs: number;
}

export interface FunnelStep {
  name: string;
  count: number;
}

/* -------------------------------------------------------------------------- */
/* Writers                                                                    */
/* -------------------------------------------------------------------------- */

/** Upserts a session row and bumps the page count. */
export async function recordSession(input: AnalyticsSessionInput, isNewPage = true): Promise<void> {
  try {
    await db
      .insert(analyticsSessions)
      .values({
        sessionId: input.sessionId,
        userId: input.userId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 1000) ?? null,
        referrer: input.referrer?.slice(0, 1000) ?? null,
        locale: input.locale ?? null,
        pageCount: 1,
      })
      .onConflictDoUpdate({
        target: analyticsSessions.sessionId,
        set: {
          userId: input.userId ?? sql`${analyticsSessions.userId}`,
          lastSeenAt: new Date(),
          pageCount: isNewPage
            ? sql`${analyticsSessions.pageCount} + 1`
            : sql`${analyticsSessions.pageCount}`,
        },
      });
  } catch {
    // Tracking is never allowed to fail the calling request.
  }
}

/** Records one analytics event. */
export async function recordEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    // Truncate the payload aggressively — this is a metrics log, not a database
    // mirror, and a runaway event with a multi-megabyte props blob would
    // dominate the table.
    const props = input.props
      ? (JSON.parse(JSON.stringify(input.props)) as Record<string, unknown>)
      : null;
    if (props) {
      for (const key of Object.keys(props)) {
        const value = props[key];
        if (typeof value === "string" && value.length > 500) {
          props[key] = value.slice(0, 500) + "…";
        }
      }
    }

    await db.insert(analyticsEvents).values({
      sessionId: input.sessionId?.slice(0, 64) ?? null,
      userId: input.userId ?? null,
      category: input.category,
      action: input.action.slice(0, 60),
      productId: (input.productId ?? "launchstack").slice(0, 50),
      toolName: input.toolName?.slice(0, 100) ?? null,
      path: input.path?.slice(0, 500) ?? null,
      fromPath: input.fromPath?.slice(0, 500) ?? null,
      durationMs: input.durationMs ?? null,
      status: input.status ?? null,
      props,
      ipAddress: input.ipAddress?.slice(0, 45) ?? null,
      userAgent: input.userAgent?.slice(0, 1000) ?? null,
    });
  } catch {
    // See above.
  }
}

/** Records one search submission. PII-heavy queries are filtered at write time. */
export async function recordSearchQuery(input: AnalyticsSearchInput): Promise<void> {
  try {
    const query = input.query.trim().slice(0, 200);
    if (!query) return;
    // Don't store obvious credentials / emails / long tokens. The query
    // column is varchar(200) so anything longer would already be truncated,
    // but we also explicitly drop the common patterns.
    if (query.includes("@") && /\.[a-z]{2,}$/i.test(query)) return;
    if (/(password|secret|token|api[_-]?key)/i.test(query)) return;

    await db.insert(analyticsSearchQueries).values({
      sessionId: input.sessionId?.slice(0, 64) ?? null,
      userId: input.userId ?? null,
      query,
      resultsCount: Math.max(0, Math.min(1000, input.resultsCount | 0)),
      latencyMs: Math.max(0, Math.min(60_000, input.latencyMs | 0)),
      source: (input.source ?? "global").slice(0, 30),
      firstClickHref: input.firstClickHref?.slice(0, 1000) ?? null,
      firstClickType: input.firstClickType?.slice(0, 30) ?? null,
    });
  } catch {
    // See above.
  }
}

/* -------------------------------------------------------------------------- */
/* Read-side aggregates                                                       */
/* -------------------------------------------------------------------------- */

function startOfDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

/** Page view, unique session, and top-path summary. */
export async function getPageViewSummary(): Promise<PageViewSummary> {
  const [totals, today, daily, top] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        uniqueSessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.category, "pageview")),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.category, "pageview"), gte(analyticsEvents.createdAt, startOfDay()))),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${analyticsEvents.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.category, "pageview"), gte(analyticsEvents.createdAt, daysAgo(7))))
      .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
      .orderBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`),
    db
      .select({
        path: analyticsEvents.path,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.category, "pageview"), gte(analyticsEvents.createdAt, daysAgo(30))))
      .groupBy(analyticsEvents.path)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
  ]);

  // Backfill any days with no traffic so the chart is continuous.
  const dailyMap = new Map(daily.map((row) => [row.day, row.count]));
  const last7Days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    last7Days.push(dailyMap.get(key) ?? 0);
  }

  return {
    total: totals[0]?.total ?? 0,
    uniqueSessions: totals[0]?.uniqueSessions ?? 0,
    today: today[0]?.value ?? 0,
    last7Days,
    topPaths: top
      .filter((row) => row.path !== null)
      .map((row) => ({ path: row.path as string, count: row.count })),
  };
}

/** Distinct active sessions over the last 5 / 60 / 1440 minutes. */
export async function getActiveUsersSummary(): Promise<ActiveUsersSummary> {
  const rows = await db
    .select({
      window: sql<string>`case
        when ${analyticsSessions.lastSeenAt} >= ${minutesAgo(5)} then '5m'
        when ${analyticsSessions.lastSeenAt} >= ${minutesAgo(60)} then '1h'
        when ${analyticsSessions.lastSeenAt} >= ${minutesAgo(1440)} then '24h'
        else null
      end`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsSessions)
    .where(gte(analyticsSessions.lastSeenAt, minutesAgo(1440)))
    .groupBy(sql`1`);

  const map = new Map(rows.map((row) => [row.window ?? "", row.count]));
  return {
    last5Minutes: map.get("5m") ?? 0,
    lastHour: map.get("1h") ?? 0,
    lastDay: map.get("24h") ?? 0,
  };
}

/** Product-level event volume for the last 30 days. */
export async function getProductUsageSummary(limit = 20): Promise<ProductUsageSummary[]> {
  const rows = await db
    .select({
      productId: analyticsEvents.productId,
      events: sql<number>`count(*)::int`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, daysAgo(30)))
    .groupBy(analyticsEvents.productId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((row) => ({
    productId: row.productId,
    productName: productDisplayName(row.productId),
    events: row.events,
    sessions: row.sessions,
  }));
}

/** Slow pages, recent errors, and failed request counts. */
export async function getPerformanceSummary(): Promise<PerformanceSummary> {
  const [slow, errors, failed] = await Promise.all([
    db
      .select({
        path: analyticsEvents.path,
        avgMs: sql<number>`coalesce(avg(${analyticsEvents.durationMs}), 0)::int`,
        p95Ms: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${analyticsEvents.durationMs}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.category, "performance"),
          gte(analyticsEvents.createdAt, daysAgo(1))
        )
      )
      .groupBy(analyticsEvents.path)
      .orderBy(desc(sql`avg(${analyticsEvents.durationMs})`))
      .limit(10),
    db
      .select({
        action: analyticsEvents.action,
        path: analyticsEvents.path,
        status: analyticsEvents.status,
        message: sql<string | null>`(${analyticsEvents.props} ->> 'message')`,
        createdAt: analyticsEvents.createdAt,
      })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.category, "error"))
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(20),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.category, "performance"),
          sql`${analyticsEvents.status} is not null and ${analyticsEvents.status} >= 400`
        )
      ),
  ]);

  return {
    slowPages: slow
      .filter((row) => row.path !== null)
      .map((row) => ({
        path: row.path as string,
        avgMs: row.avgMs,
        p95Ms: row.p95Ms,
        count: row.count,
      })),
    recentErrors: errors.map((row) => ({
      action: row.action,
      path: row.path,
      status: row.status,
      message: row.message,
      createdAt: row.createdAt,
    })),
    failedRequestCount: failed[0]?.value ?? 0,
  };
}

/** Search usage. */
export async function getSearchUsageSummary(): Promise<SearchUsageSummary> {
  const [totals, top, zero, latency] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        unique: sql<number>`count(distinct lower(${analyticsSearchQueries.query}))::int`,
      })
      .from(analyticsSearchQueries)
      .where(gte(analyticsSearchQueries.createdAt, daysAgo(30))),
    db
      .select({
        query: analyticsSearchQueries.query,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsSearchQueries)
      .where(gte(analyticsSearchQueries.createdAt, daysAgo(30)))
      .groupBy(analyticsSearchQueries.query)
      .orderBy(desc(sql`count(*)`))
      .limit(15),
    db
      .select({
        query: analyticsSearchQueries.query,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsSearchQueries)
      .where(
        and(
          eq(analyticsSearchQueries.resultsCount, 0),
          gte(analyticsSearchQueries.createdAt, daysAgo(30))
        )
      )
      .groupBy(analyticsSearchQueries.query)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({ value: sql<number>`coalesce(avg(${analyticsSearchQueries.latencyMs}), 0)::int` })
      .from(analyticsSearchQueries)
      .where(gte(analyticsSearchQueries.createdAt, daysAgo(30))),
  ]);

  return {
    totalQueries: totals[0]?.total ?? 0,
    uniqueQueries: totals[0]?.unique ?? 0,
    topQueries: top.map((row) => ({ query: row.query, count: row.count })),
    zeroResultQueries: zero.map((row) => ({ query: row.query, count: row.count })),
    averageLatencyMs: latency[0]?.value ?? 0,
  };
}

/**
 * Funnel helper.
 *
 * Counts how many distinct sessions triggered each event in the given
 * `actions` list. The caller decides the order, the helper just returns
 * the matching counts. This is the data layer the conversion-funnel
 * dashboard will eventually render against; no UI exists yet.
 */
export async function getFunnelSummary(
  productId: string,
  actions: string[],
  sinceDays = 30
): Promise<FunnelStep[]> {
  if (actions.length === 0) return [];

  const rows = await db
    .select({
      action: analyticsEvents.action,
      count: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.productId, productId),
        gte(analyticsEvents.createdAt, daysAgo(sinceDays))
      )
    )
    .groupBy(analyticsEvents.action);

  const map = new Map(rows.map((row) => [row.action, row.count]));
  return actions.map((action) => ({ name: action, count: map.get(action) ?? 0 }));
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Resolves a product id to its display name, falling back to the id. Mirrors
 * the `productName` helper in `activity.ts` so analytics labels match the
 * timeline.
 */
function productDisplayName(productId: string): string {
  if (productId === "launchstack") return "LaunchStack";
  return productId.charAt(0).toUpperCase() + productId.slice(1);
}

/** Anonymous-friendly session id. The client uses the same algorithm. */
export function newSessionId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** Cookie name for the visitor session id. */
export const ANALYTICS_SESSION_COOKIE = "ls_analytics_sid";

/** Read a session id from a cookie header. Returns null when not present. */
export function readSessionIdFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const piece of cookieHeader.split(";")) {
    const [rawName, ...rest] = piece.split("=");
    if (rawName && rawName.trim() === ANALYTICS_SESSION_COOKIE) {
      return decodeURIComponent(rest.join("=").trim());
    }
  }
  return null;
}

/** Type guard for the narrow list of categories a client is allowed to send. */
export function isAnalyticsCategory(value: string): value is AnalyticsCategory {
  return (ANALYTICS_CATEGORIES as readonly string[]).includes(value);
}

/** Sanitises a path so it can't be used to pollute the analytics table. */
export function normalisePath(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://placeholder.invalid");
    return `${url.pathname}${url.search}`.slice(0, 500);
  } catch {
    return value.slice(0, 500);
  }
}

/** Lightweight "should I track this?" — false in non-browser / server contexts. */
export function isClientAnalyticsEnabled(): boolean {
  return typeof window !== "undefined";
}
