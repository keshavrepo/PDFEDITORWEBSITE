import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { SocialWorkspace } from "@/components/socialpilot/workspace";
import { WorkspaceDashboard } from "@/components/socialpilot/surfaces/workspace-dashboard";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "SocialPilot is LaunchStack's creator workspace. Batch 3 ships the professional creator workspace: Publishing Queue, Platform Profiles, Media Workspace, Brand Workspace and the Workspace Dashboard. The reusable workspace shell, autosave, search, dashboard and storage are reused from the LaunchStack platform.";
const url = `${getAppUrl()}/socialpilot`;

export const metadata: Metadata = {
  title: `SocialPilot | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `SocialPilot | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * The default SocialPilot route. The workspace shell handles its own
 * navigation rail and surfaces, so this page is just a host.
 *
 * The default surface is the Workspace Dashboard; every other tool
 * lives at `/socialpilot/<slug>` and the rail links to all of them.
 */
export default async function SocialPilotPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">SocialPilot</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <SocialWorkspace kind="dashboard" Surface={WorkspaceDashboard} />
        </div>
      </main>
    </>
  );
}
