import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { FinanceWorkspace } from "@/components/financepilot/workspace";
import { EmiSurface } from "@/components/financepilot/surfaces/emi";
import { EmiProperties } from "@/components/financepilot/properties/emi";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "FinancePilot is LaunchStack's workspace for financial calculators. Pick the EMI, SIP, compound interest or loan calculator from the rail; everything saves automatically and exports as a PDF.";
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
 * The default surface is the EMI calculator, the most common entry
 * point for the financial calculators. Other calculators live at
 * `/financepilot/<slug>` and the rail links to all of them.
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
            kind="emi"
            Surface={EmiSurface}
            Properties={EmiProperties}
          />
        </div>
      </main>
    </>
  );
}
