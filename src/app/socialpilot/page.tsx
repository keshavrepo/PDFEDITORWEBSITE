import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { SocialWorkspace } from "@/components/socialpilot/workspace";
import { BlankSurface } from "@/components/socialpilot/surfaces/blank";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "SocialPilot is LaunchStack's creator workspace. The foundation is live: a reusable workspace shell, a project system, a media library and a brand kit. Future batches add the creator tools (post designer, video editor, scheduler, AI assistant) on top of the same shell.";
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
 * The default surface is the "blank" project; every future tool lives
 * at `/socialpilot/<slug>` and the rail links to all of them.
 */
export default async function SocialPilotPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">SocialPilot</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <SocialWorkspace kind="blank" Surface={BlankSurface} />
        </div>
      </main>
    </>
  );
}
