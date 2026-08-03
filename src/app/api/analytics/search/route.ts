/**
 * POST /api/analytics/search
 *
 * Records a search submission. Tracks the query, the result count and the
 * latency. PII-shaped queries (emails, common credential keywords) are
 * filtered at write time in `recordSearchQuery` and never persisted.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  ANALYTICS_SESSION_COOKIE,
  newSessionId,
  readSessionIdFromCookieHeader,
  recordSearchQuery,
  recordSession,
} from "@/lib/platform/analytics";
import { checkRateLimit, getClientIp, isSameOrigin, rateLimitResponse } from "@/lib/request";

export const dynamic = "force-dynamic";

const schema = z.object({
  query: z.string().trim().min(1).max(200),
  resultsCount: z.number().int().nonnegative().max(1000).default(0),
  latencyMs: z.number().int().nonnegative().max(60_000).default(0),
  source: z.enum(["global", "command_palette", "file_manager"]).default("global"),
  firstClickHref: z.string().trim().max(1000).optional(),
  firstClickType: z.string().trim().max(30).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const limit = checkRateLimit(`analytics-search:${ip}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  let sessionId = readSessionIdFromCookieHeader(request.headers.get("cookie"));
  const mintNew = !sessionId;
  if (!sessionId) sessionId = newSessionId();

  await recordSession(
    {
      sessionId,
      userId: user?.id ?? null,
      ipAddress: ip,
      userAgent: userAgent ?? null,
    },
    false
  );

  await recordSearchQuery({
    sessionId,
    userId: user?.id ?? null,
    query: parsed.data.query,
    resultsCount: parsed.data.resultsCount,
    latencyMs: parsed.data.latencyMs,
    source: parsed.data.source,
    firstClickHref: parsed.data.firstClickHref ?? null,
    firstClickType: parsed.data.firstClickType ?? null,
  });

  const response = Response.json({ ok: true, sessionId, minted: mintNew });
  if (mintNew) {
    const maxAge = 60 * 60 * 24 * 365;
    response.headers.append(
      "Set-Cookie",
      `${ANALYTICS_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`
    );
  }
  return response;
}
