import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { OfficeWorkspace } from "@/components/officepilot/workspace";
import { WordSurface } from "@/components/officepilot/surfaces/word";
import { WordProperties } from "@/components/officepilot/properties/word";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "OfficePilot is LaunchStack's workspace for Word, Excel and PowerPoint. Write documents, build spreadsheets and assemble slide decks, with autosave and a shared template library, all in your browser.";
const url = `${getAppUrl()}/officepilot`;

export const metadata: Metadata = {
  title: `Word Editor — OfficePilot | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `Word Editor — OfficePilot | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * The default OfficePilot route. The workspace shell handles its own
 * navigation rail and surfaces, so this page is just a host.
 */
export default async function OfficePilotPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">OfficePilot Word editor</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <OfficeWorkspace kind="word" Surface={WordSurface} Properties={WordProperties} />
        </div>
      </main>
    </>
  );
}
