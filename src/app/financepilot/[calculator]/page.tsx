import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { FinanceWorkspace } from "@/components/financepilot/workspace";
import { BlankSurface } from "@/components/financepilot/surfaces/blank";
import { BlankProperties } from "@/components/financepilot/properties/blank";
import { getCalculatorBySlug, calculators, focusedCalculators } from "@/lib/financepilot";
import { platform } from "@/lib/products";

export const dynamic = "force-dynamic";

/**
 * One route serving every FinancePilot calculator. Each kind is a
 * configuration of the same workspace shell, so they share this page
 * rather than each getting a near-identical copy of it.
 *
 * The foundation has no calculators registered yet, so this page is
 * effectively inert — it always renders a 404 — but the routing shape
 * is in place for the first calculator to plug in.
 */
export function generateStaticParams() {
  return focusedCalculators.map((calculator) => ({
    calculator: calculator.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ calculator: string }>;
}): Promise<Metadata> {
  const { calculator: slug } = await params;
  const calc = getCalculatorBySlug(slug);
  if (!calc) return {};
  return {
    title: `${calc.name} — FinancePilot | ${platform.name}`,
    description: calc.description,
    alternates: { canonical: `/financepilot/${calc.slug}` },
  };
}

export default async function FinancePilotCalculatorPage({
  params,
}: {
  params: Promise<{ calculator: string }>;
}) {
  const { calculator: slug } = await params;
  const calc = getCalculatorBySlug(slug);
  if (!calc) notFound();

  // The foundation still mounts the blank surface. The first real
  // calculator will switch this to its own surface and properties
  // components using the `calc.kind` discriminator.
  void calculators;

  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">FinancePilot {calc.name}</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <FinanceWorkspace
            kind={calc.kind}
            Surface={BlankSurface}
            Properties={BlankProperties}
          />
        </div>
      </main>
    </>
  );
}
