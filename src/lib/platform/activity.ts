/**
 * Unified activity and notification helpers.
 *
 * Every LaunchStack product records activity through these functions, so the
 * timeline, notification centre and dashboard read from one place. A future
 * product only has to pass its own `productId`; nothing else needs to change.
 */

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, files, notifications, processingHistory } from "@/db/schema";
import { getProduct } from "@/lib/products";

export type ActivityKind =
  | "conversion"
  | "upload"
  | "download"
  | "login"
  | "account";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  /** Product that produced the entry, e.g. "pdfpilot". */
  productId: string;
  /** Display name resolved from the product registry. */
  productName: string;
  title: string;
  detail?: string;
  status: "completed" | "failed" | "info";
  createdAt: Date;
}

export type NotificationCategory =
  | "conversion"
  | "upload"
  | "subscription"
  | "account"
  | "system";

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface NotificationEntry {
  id: string;
  productId: string;
  productName: string;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** Resolves a product id to its display name, tolerating unknown ids. */
function productName(productId: string): string {
  if (productId === "launchstack") return "LaunchStack";
  return getProduct(productId)?.name ?? productId;
}

/** Maps an audit log action onto a timeline entry. */
function describeAuditAction(action: string): { kind: ActivityKind; title: string } | null {
  const map: Record<string, { kind: ActivityKind; title: string }> = {
    "user.login": { kind: "login", title: "Signed in" },
    "user.registered": { kind: "account", title: "Account created" },
    "user.profile_updated": { kind: "account", title: "Profile updated" },
    "user.password_changed": { kind: "account", title: "Password changed" },
    "user.password_reset": { kind: "account", title: "Password reset" },
    "user.preferences_updated": { kind: "account", title: "Preferences updated" },
    "file.downloaded": { kind: "download", title: "File downloaded" },
    "file.renamed": { kind: "account", title: "File renamed" },
    "file.deleted": { kind: "account", title: "File deleted" },
    "subscription.updated": { kind: "account", title: "Subscription updated" },
  };
  return map[action] ?? null;
}

/**
 * Builds the unified timeline.
 *
 * Conversions come from processing history, uploads from the file table and
 * everything else from the audit log; the three streams are merged and sorted
 * so products that only write audit entries still appear.
 */
export async function getActivityTimeline(
  userId: string,
  limit = 20
): Promise<ActivityEntry[]> {
  const [conversions, uploads, audits] = await Promise.all([
    db
      .select({
        id: processingHistory.id,
        productId: processingHistory.productId,
        toolName: processingHistory.toolName,
        status: processingHistory.status,
        createdAt: processingHistory.createdAt,
        errorMessage: processingHistory.errorMessage,
      })
      .from(processingHistory)
      .where(eq(processingHistory.userId, userId))
      .orderBy(desc(processingHistory.createdAt))
      .limit(limit),
    db
      .select({
        id: files.id,
        productId: files.productId,
        originalName: files.originalName,
        size: files.size,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(and(eq(files.userId, userId), isNull(files.deletedAt)))
      .orderBy(desc(files.createdAt))
      .limit(limit),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit),
  ]);

  const entries: ActivityEntry[] = [];

  for (const row of conversions) {
    entries.push({
      id: `conversion-${row.id}`,
      kind: "conversion",
      productId: row.productId,
      productName: productName(row.productId),
      title: row.toolName,
      detail: row.errorMessage ?? undefined,
      status: row.status === "failed" ? "failed" : "completed",
      createdAt: row.createdAt,
    });
  }

  for (const row of uploads) {
    entries.push({
      id: `upload-${row.id}`,
      kind: "upload",
      productId: row.productId,
      productName: productName(row.productId),
      title: row.originalName,
      detail: `${(row.size / 1024).toFixed(0)} KB`,
      status: "completed",
      createdAt: row.createdAt,
    });
  }

  for (const row of audits) {
    const described = describeAuditAction(row.action);
    if (!described) continue;
    entries.push({
      id: `audit-${row.id}`,
      kind: described.kind,
      productId: "launchstack",
      productName: "LaunchStack",
      title: described.title,
      status: "info",
      createdAt: row.createdAt,
    });
  }

  return entries
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function getNotifications(
  userId: string,
  limit = 20
): Promise<NotificationEntry[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productName: productName(row.productId),
    category: row.category as NotificationCategory,
    level: row.level as NotificationLevel,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

/**
 * Records a notification. Any product can call this; the notification centre
 * renders whatever arrives without needing to know the source.
 */
export async function createNotification(input: {
  userId: string;
  productId?: string;
  category: NotificationCategory;
  level?: NotificationLevel;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    productId: input.productId ?? "launchstack",
    category: input.category,
    level: input.level ?? "info",
    title: input.title,
    body: input.body,
    href: input.href,
  });
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[]
): Promise<number> {
  const now = new Date();
  const scope = ids?.length
    ? and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        or(...ids.map((id) => eq(notifications.id, id)))
      )
    : and(eq(notifications.userId, userId), isNull(notifications.readAt));

  const updated = await db
    .update(notifications)
    .set({ readAt: now })
    .where(scope)
    .returning({ id: notifications.id });

  return updated.length;
}
