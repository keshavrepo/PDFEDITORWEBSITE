import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { FinanceWorkspace } from "@/components/financepilot/workspace";
import { BlankSurface } from "@/components/financepilot/surfaces/blank";
import { BlankProperties } from "@/components/financepilot/properties/blank";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "FinancePilot is LaunchStack's workspace for financial calculators. The reusable workspace is live; the first calculators ship in the next batch.";
const url = `${getAppUrl()}/financepilot`;

export const metadata: Metadata = {
  title: `FinancePilot | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `FinancePilot | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * The default FinancePilot route. The workspace shell handles its own
 * navigation rail and surfaces, so this page is just a host.
 *
 * The foundation mounts the blank surface so the shell is end-to-end
 * functional before the first real calculator lands.
 */
export default async function FinancePilotPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">FinancePilot</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <FinanceWorkspace
            kind="blank"
            Surface={BlankSurface}
            Properties={BlankProperties}
          />
        </div>
      </main>
    </>
  );
}
