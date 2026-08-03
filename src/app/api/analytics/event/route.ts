/**
 * POST /api/analytics/event
 *
 * Records a single analytics event. Used for tool open / close, project
 * created / deleted, export, import, save, autosave, restore, error and any
 * other behavioural event the platform wants to surface in the dashboard.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  ANALYTICS_CATEGORIES,
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
  category: z.string().trim().min(1).max(30),
  action: z.string().trim().min(1).max(60),
  productId: z.string().trim().max(50).optional(),
  toolName: z.string().trim().max(100).optional(),
  path: z.string().trim().max(500).optional(),
  fromPath: z.string().trim().max(500).optional(),
  durationMs: z.number().int().nonnegative().max(3_600_000).optional(),
  status: z.number().int().min(0).max(999).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const limit = checkRateLimit(`analytics-event:${ip}`, 240, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  if (!isAnalyticsCategory(parsed.data.category)) {
    return Response.json(
      { error: `Unknown category. Expected one of: ${ANALYTICS_CATEGORIES.join(", ")}` },
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

  await recordEvent({
    sessionId,
    userId: user?.id ?? null,
    category: parsed.data.category,
    action: parsed.data.action,
    productId: parsed.data.productId,
    toolName: parsed.data.toolName,
    path: normalisePath(parsed.data.path ?? null) ?? undefined,
    fromPath: normalisePath(parsed.data.fromPath ?? null) ?? undefined,
    durationMs: parsed.data.durationMs,
    status: parsed.data.status,
    props: parsed.data.props,
    ipAddress: ip,
    userAgent: userAgent ?? null,
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
