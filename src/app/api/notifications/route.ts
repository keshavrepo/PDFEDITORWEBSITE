import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  countUnreadNotifications,
  getNotifications,
  markNotificationsRead,
} from "@/lib/platform/activity";
import { isSameOrigin } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, unread] = await Promise.all([
    getNotifications(user.id, 20),
    countUnreadNotifications(user.id),
  ]);
  return Response.json({ notifications, unread });
}

const readSchema = z.object({ ids: z.array(z.string().uuid()).optional() });

/** Marks the given notifications read, or all of them when no ids are sent. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = readSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const updated = await markNotificationsRead(user.id, parsed.data.ids);
  const unread = await countUnreadNotifications(user.id);
  return Response.json({ updated, unread });
}
