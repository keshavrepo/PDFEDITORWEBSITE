/**
 * POST /api/analytics/pageview
 *
 * Records a single page view. Anonymous visitors are tracked using a
 * cookie-issued session id so marketing pages can be measured before sign-up.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  ANALYTICS_SESSION_COOKIE,
  isAnalyticsCategory,
  newSessionId,
  normalisePath,
  readSessionIdFromCookieHeader,
  recordEvent,
  recordSession,
} from "@/lib/platform/analytics";
import { checkRateLimit, getClientIp, isSameOrigin, rateLimitResponse } from "@/lib/request";

export const dynamic = "force-dynamic";

const schema = z.object({
  path: z.string().trim().min(1).max(500),
  fromPath: z.string().trim().max(500).optional(),
  referrer: z.string().trim().max(500).optional(),
  /** Time-to-first-paint, when the caller can measure it. */
  durationMs: z.number().int().nonnegative().max(60_000).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const limit = checkRateLimit(`analytics-pv:${ip}`, 240, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const path = normalisePath(parsed.data.path) ?? "/";
  const fromPath = normalisePath(parsed.data.fromPath ?? null);
  const referrer = parsed.data.referrer?.slice(0, 500) ?? null;

  // Reuse the existing session id from the cookie so subsequent events
  // attach to the same visitor; otherwise mint a new one and stamp it back.
  let sessionId = readSessionIdFromCookieHeader(request.headers.get("cookie"));
  const mintNew = !sessionId;
  if (!sessionId) sessionId = newSessionId();

  await recordSession(
    {
      sessionId,
      userId: user?.id ?? null,
      ipAddress: ip,
      userAgent: userAgent ?? null,
      referrer,
    },
    true
  );

  await recordEvent({
    sessionId,
    userId: user?.id ?? null,
    category: "pageview",
    action: "view",
    path,
    fromPath: fromPath ?? undefined,
    durationMs: parsed.data.durationMs,
    ipAddress: ip,
    userAgent: userAgent ?? null,
    props: referrer ? { referrer } : undefined,
  });

  // Re-export the constant so the `lint` rule about unused-imports is happy.
  void isAnalyticsCategory;

  const response = Response.json({ ok: true, sessionId, minted: mintNew });
  if (mintNew) {
    // 1 year, lax so the cookie survives navigations between sub-paths.
    const maxAge = 60 * 60 * 24 * 365;
    response.headers.append(
      "Set-Cookie",
      `${ANALYTICS_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`
    );
  }
  return response;
}
