import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { listFiles } from "@/lib/platform/files";

export const dynamic = "force-dynamic";

/** Lists the signed-in user's files, honouring search and filters. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const files = await listFiles(user.id, {
    search: params.get("q") ?? undefined,
    productId: params.get("product") ?? undefined,
    favoritesOnly: params.get("favorites") === "1",
  });

  return Response.json({ files });
}
