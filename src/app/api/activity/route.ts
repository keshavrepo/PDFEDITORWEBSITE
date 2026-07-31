import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { files, processingHistory } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getActivityTimeline, createNotification } from "@/lib/platform/activity";
import { parsePreferences } from "@/lib/platform/preferences";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit, isSameOrigin, rateLimitResponse } from "@/lib/request";

export const dynamic = "force-dynamic";

/** Returns the signed-in user's unified activity timeline. */
export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ activity: await getActivityTimeline(user.id, 25) });
}

const recordSchema = z.object({
  productId: z.string().trim().min(1).max(50).default("pdfpilot"),
  toolName: z.string().trim().min(1).max(100),
  status: z.enum(["completed", "failed"]).default("completed"),
  /** Result file name, when the operation produced one. */
  fileName: z.string().trim().max(255).optional(),
  fileSize: z.number().int().nonnegative().max(2_000_000_000).optional(),
  mimeType: z.string().trim().max(100).optional(),
  inputFileSize: z.number().int().nonnegative().max(2_000_000_000).optional(),
  processingTime: z.number().int().nonnegative().max(3_600_000).optional(),
  errorMessage: z.string().trim().max(500).optional(),
});

/**
 * Records a completed or failed operation.
 *
 * Any LaunchStack product posts here after finishing work, which is what keeps
 * the file manager, timeline and dashboard statistics in sync from a single
 * implementation. Files are recorded by name and size only: PDFPilot processes
 * documents in the browser, so no content is ever sent.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = checkRateLimit(`activity:${user.id}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const parsed = recordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    const fileId = await db.transaction(async (transaction) => {
      let createdFileId: string | null = null;

      if (input.fileName && input.status === "completed") {
        const [created] = await transaction
          .insert(files)
          .values({
            userId: user.id,
            productId: input.productId,
            filename: input.fileName,
            originalName: input.fileName,
            size: input.fileSize ?? 0,
            mimeType: input.mimeType,
            status: "completed",
          })
          .returning({ id: files.id });
        createdFileId = created?.id ?? null;
      }

      await transaction.insert(processingHistory).values({
        userId: user.id,
        productId: input.productId,
        toolName: input.toolName,
        fileId: createdFileId,
        inputFileSize: input.inputFileSize,
        outputFileSize: input.fileSize,
        processingTime: input.processingTime,
        status: input.status,
        errorMessage: input.errorMessage,
      });

      return createdFileId;
    });

    // Notify only if the user has left that category enabled.
    const [account] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const preferences = parsePreferences(account?.preferences);

    if (input.status === "failed" && preferences.notifications.conversions) {
      await createNotification({
        userId: user.id,
        productId: input.productId,
        category: "conversion",
        level: "error",
        title: `${input.toolName} failed`,
        body: input.errorMessage || "The operation could not be completed.",
      });
    } else if (input.status === "completed" && preferences.notifications.conversions) {
      await createNotification({
        userId: user.id,
        productId: input.productId,
        category: "conversion",
        level: "success",
        title: `${input.toolName} completed`,
        body: input.fileName ? `${input.fileName} is ready.` : undefined,
        href: "/files",
      });
    }

    return Response.json({ ok: true, fileId });
  } catch (error) {
    console.error("Activity recording failed", error);
    return Response.json({ error: "Unable to record activity" }, { status: 500 });
  }
}
