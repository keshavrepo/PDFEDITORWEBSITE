import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { WebWorkspace } from "@/components/webpilot/workspace";
import { WorkspaceDashboard } from "@/components/webpilot/surfaces/workspace-dashboard";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "WebPilot is LaunchStack's web workspace. Batch 1 ships a reusable web workspace with a syntax-highlighted HTML editor, a CSS editor with auto-complete and color preview, a JavaScript editor with console preview, and a live preview that combines all three into a working browser surface. The same LaunchStack platform hosts PDFPilot, ImagePilot, OfficePilot, DevPilot, SocialPilot and FinancePilot.";
const url = `${getAppUrl()}/webpilot`;

export const metadata: Metadata = {
  title: `WebPilot | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `WebPilot | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * The default WebPilot route. The workspace shell handles its own
 * navigation rail and surfaces, so this page is just a host.
 *
 * The default surface is the Workspace Dashboard; every other tool
 * lives at `/webpilot/<slug>` and the rail links to all of them.
 *
 * Mirrors /app/devpilot/page.tsx.
 */
export default async function WebPilotPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">WebPilot</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <WebWorkspace kind="dashboard" Surface={WorkspaceDashboard} />
        </div>
      </main>
    </>
  );
}
