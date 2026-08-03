/**
 * POST /api/analytics/error
 *
 * Records a client-side error: window.onerror, unhandledrejection, or a
 * try/catch inside a product. The `message` is truncated server-side and the
 * stack is dropped, so accidental PII cannot leak through the payload.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  ANALYTICS_SESSION_COOKIE,
  newSessionId,
  normalisePath,
  readSessionIdFromCookieHeader,
  recordEvent,
  recordSession,
} from "@/lib/platform/analytics";
import { checkRateLimit, getClientIp, isSameOrigin, rateLimitResponse } from "@/lib/request";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** "uncaught" | "unhandled_rejection" | "api" | "render" | "tool" */
  source: z.enum(["uncaught", "unhandled_rejection", "api", "render", "tool"]),
  message: z.string().trim().min(1).max(1000),
  path: z.string().trim().max(500).optional(),
  productId: z.string().trim().max(50).optional(),
  toolName: z.string().trim().max(100).optional(),
  status: z.number().int().min(0).max(999).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const limit = checkRateLimit(`analytics-error:${ip}`, 120, 60_000);
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

  await recordEvent({
    sessionId,
    userId: user?.id ?? null,
    category: "error",
    action: parsed.data.source,
    productId: parsed.data.productId,
    toolName: parsed.data.toolName,
    path: normalisePath(parsed.data.path ?? null) ?? undefined,
    status: parsed.data.status,
    props: {
      message: parsed.data.message.slice(0, 500),
    },
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
