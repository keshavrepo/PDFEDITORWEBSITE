import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, contactSubmissions } from "@/db/schema";
import { getAdmin } from "@/lib/admin";
import { getClientIp, isSameOrigin } from "@/lib/request";

const statusSchema = z.object({
  status: z.enum(["new", "in_progress", "resolved"]),
});

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = statusSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid status" }, { status: 400 });
  const { id } = await params;
  try {
    const [updated] = await db.transaction(async (transaction) => {
      const result = await transaction
        .update(contactSubmissions)
        .set({
          status: parsed.data.status,
          respondedAt: parsed.data.status === "resolved" ? new Date() : null,
        })
        .where(eq(contactSubmissions.id, id))
        .returning({ id: contactSubmissions.id });
      if (result[0]) {
        await transaction.insert(auditLogs).values({
          userId: admin.id,
          action: "contact.status_updated",
          resourceType: "contact_submission",
          resourceId: id,
          ipAddress: getClientIp(request),
          metadata: { status: parsed.data.status },
        });
      }
      return result;
    });
    if (!updated) return Response.json({ error: "Message not found" }, { status: 404 });
    return Response.json({ message: "Status updated" });
  } catch (error) {
    console.error("Contact status update failed", error);
    return Response.json({ error: "Unable to update status" }, { status: 500 });
  }
}
