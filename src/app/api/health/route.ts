import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getMissingProductionEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const missingConfiguration = getMissingProductionEnv();
  if (!process.env.DATABASE_URL || missingConfiguration.length > 0) {
    return Response.json(
      {
        ok: false,
        service: "pdfpilot",
        checks: {
          configuration: {
            ok: false,
            missing: missingConfiguration.length
              ? missingConfiguration
              : ["DATABASE_URL"],
          },
          database: { ok: false },
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await db.execute(sql`select 1`);
    return Response.json(
      {
        ok: true,
        service: "pdfpilot",
        checks: {
          configuration: { ok: true },
          database: { ok: true },
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        ok: false,
        service: "pdfpilot",
        checks: {
          configuration: { ok: true },
          database: { ok: false },
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
