import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { DevWorkspace } from "@/components/devpilot/workspace";
import { WorkspaceDashboard } from "@/components/devpilot/surfaces/workspace-dashboard";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "DevPilot is LaunchStack's developer workspace. Batch 1 ships the foundation: a reusable developer workspace with sessions, snippets, history, autosave, search and dashboard integration. The same LaunchStack platform hosts OfficePilot, SocialPilot and FinancePilot.";
const url = `${getAppUrl()}/devpilot`;

export const metadata: Metadata = {
  title: `DevPilot | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `DevPilot | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * The default DevPilot route. The workspace shell handles its own
 * navigation rail and surfaces, so this page is just a host.
 *
 * The default surface is the Workspace Dashboard; every other tool
 * lives at `/devpilot/<slug>` and the rail links to all of them.
 *
 * Mirrors /app/socialpilot/page.tsx.
 */
export default async function DevPilotPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">DevPilot</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <DevWorkspace kind="dashboard" Surface={WorkspaceDashboard} />
        </div>
      </main>
    </>
  );
}
