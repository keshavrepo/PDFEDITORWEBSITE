import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getFavorites, toggleFavorite } from "@/lib/platform/usage";
import { isSameOrigin } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getFavorites(user.id));
}

const toggleSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
  kind: z.enum(["tool", "product"]),
});

/** Adds or removes a favourite tool or product. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const isFavorite = await toggleFavorite(
    user.id,
    parsed.data.identifier,
    parsed.data.kind
  );
  return Response.json({ isFavorite });
}
