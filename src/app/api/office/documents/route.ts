/**
 * Recent-documents index for OfficePilot.
 *
 * The browser is the source of truth for the full document body; this route
 * is only the small server-side mirror used by the dashboard, the file
 * manager and the search endpoint to know what the user has been working on.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isSameOrigin, checkRateLimit, rateLimitResponse } from "@/lib/request";
import {
  listRecentDocuments,
  recordRecentDocument,
} from "@/lib/officepilot/recent";

export const dynamic = "force-dynamic";

/** Lists the user's recent OfficePilot documents. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const kind = request.nextUrl.searchParams.get("kind") ?? undefined;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 50, 200) : 50;

  const documents = await listRecentDocuments(user.id, {
    kind: kind === "word" || kind === "spreadsheet" || kind === "presentation" ? kind : undefined,
    limit,
  });
  return Response.json({ documents });
}

const recordSchema = z.object({
  id: z.string().trim().min(1).max(80),
  kind: z.enum(["word", "spreadsheet", "presentation"]),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(30),
  version: z.number().int().nonnegative().max(1_000_000),
  size: z.number().int().nonnegative().max(64 * 1024 * 1024),
  updatedAt: z.string().trim().min(1).max(40),
});

/** Upserts a recent-document row. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`office-recents:${user.id}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = recordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  await recordRecentDocument(user.id, {
    meta: {
      id: data.id,
      kind: data.kind,
      title: data.title,
      // The recent index only stores the slug; the editor restores the
      // proper category from the body when the document is opened.
      category: data.category as never,
      createdAt: data.updatedAt,
      updatedAt: data.updatedAt,
      autosavedAt: data.updatedAt,
      version: data.version,
      size: data.size,
    },
  });

  return Response.json({ ok: true });
}
