/**
 * Per-asset recent-media operations.
 *
 * Used by the editor to remove a row from the server-side index when
 * the user deletes a media asset locally. Asset binary deletion is
 * the browser's job; this endpoint only manages the mirror.
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isSameOrigin } from "@/lib/request";
import { deleteRecentMedia } from "@/lib/socialpilot/recent";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || id.length > 80) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  await deleteRecentMedia(user.id, id);
  return Response.json({ ok: true });
}
