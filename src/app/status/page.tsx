import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { ContentPage } from "@/components/content-page";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/status",
  title: "Service Status",
  description: "Current LaunchStack service and database availability.",
});

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const user = await getSession();
  let databaseAvailable = false;
  try {
    if (process.env.DATABASE_URL) {
      await db.execute(sql`select 1`);
      databaseAvailable = true;
    }
  } catch {
    databaseAvailable = false;
  }

  const indicator = (available: boolean) => (
    <span className={available ? "text-primary font-medium" : "text-destructive font-medium"}>
      {available ? "Operational" : "Unavailable"}
    </span>
  );

  return (
    <ContentPage
      user={user}
      eyebrow="System status"
      title={databaseAvailable ? "All core systems operational" : "A core service is unavailable"}
      description="Live availability for PDFPilot website services. Browser-side PDF processing can remain available even when account services are interrupted."
      sections={[
        { title: "Website", content: <div className="flex items-center justify-between gap-4"><span>Pages and browser tools</span>{indicator(true)}</div> },
        { title: "Account database", content: <div className="flex items-center justify-between gap-4"><span>Sign-in, settings, blog, and contact storage</span>{indicator(databaseAvailable)}</div> },
        { title: "Browser PDF processing", content: <div className="flex items-center justify-between gap-4"><span>Local document operations</span>{indicator(true)}</div> },
        { title: "Incident support", content: <p>If you experience a problem not reflected here, contact <a className="text-foreground underline" href="mailto:launchstack.in@gmail.com">launchstack.in@gmail.com</a> with the affected page and time of the incident.</p> },
      ]}
    />
  );
}
