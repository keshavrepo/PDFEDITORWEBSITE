/**
 * GET /api/analytics/summary
 *
 * Returns the dashboard analytics payload assembled by
 * `getDashboardAnalytics`. The route is unauthenticated for the platform-
 * wide aggregates (page views, active users, performance) so the public
 * health / status surface can read them; the per-user slice is only filled
 * in when the caller is signed in.
 */

import { getSession } from "@/lib/auth";
import { getDashboardAnalytics } from "@/lib/platform/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  try {
    const summary = await getDashboardAnalytics(user?.id ?? null);
    return Response.json({ summary });
  } catch (error) {
    console.error("Analytics summary failed", error);
    return Response.json({ error: "Unable to load analytics" }, { status: 500 });
  }
}
