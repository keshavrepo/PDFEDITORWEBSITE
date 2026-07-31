import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  deleteFile,
  recordFileDownload,
  renameFile,
  toggleFileFavorite,
} from "@/lib/platform/files";
import { isSameOrigin } from "@/lib/request";

export const dynamic = "force-dynamic";

const patchSchema = z.union([
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(255) }),
  z.object({ action: z.literal("favorite") }),
  z.object({ action: z.literal("download") }),
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Rename, favourite or record a download for one file. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.action === "rename") {
    const file = await renameFile(user.id, id, parsed.data.name);
    if (!file) return Response.json({ error: "File not found" }, { status: 404 });
    return Response.json({ file });
  }

  if (parsed.data.action === "favorite") {
    const isFavorite = await toggleFileFavorite(user.id, id);
    if (isFavorite === null) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }
    return Response.json({ isFavorite });
  }

  const recorded = await recordFileDownload(user.id, id);
  if (!recorded) return Response.json({ error: "File not found" }, { status: 404 });
  return Response.json({ ok: true });
}

/** Soft-deletes a file so related history stays intact. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteFile(user.id, id);
  if (!deleted) return Response.json({ error: "File not found" }, { status: 404 });
  return Response.json({ ok: true });
}
