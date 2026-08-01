import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { FinanceWorkspace } from "@/components/financepilot/workspace";
import { BlankSurface } from "@/components/financepilot/surfaces/blank";
import { BlankProperties } from "@/components/financepilot/properties/blank";
import { EmiSurface } from "@/components/financepilot/surfaces/emi";
import { SipSurface } from "@/components/financepilot/surfaces/sip";
import { CompoundInterestSurface } from "@/components/financepilot/surfaces/compound-interest";
import { LoanSurface } from "@/components/financepilot/surfaces/loan";
import { BudgetSurface } from "@/components/financepilot/surfaces/budget";
import { ExpenseSurface } from "@/components/financepilot/surfaces/expense";
import { SavingsSurface } from "@/components/financepilot/surfaces/savings";
import { NetWorthSurface } from "@/components/financepilot/surfaces/net-worth";
import { EmiProperties } from "@/components/financepilot/properties/emi";
import { SipProperties } from "@/components/financepilot/properties/sip";
import { CompoundInterestProperties } from "@/components/financepilot/properties/compound-interest";
import { LoanProperties } from "@/components/financepilot/properties/loan";
import { BudgetProperties } from "@/components/financepilot/properties/budget";
import { ExpenseProperties } from "@/components/financepilot/properties/expense";
import { SavingsProperties } from "@/components/financepilot/properties/savings";
import { NetWorthProperties } from "@/components/financepilot/properties/net-worth";
import {
  getCalculatorBySlug,
  focusedCalculators,
  type FinanceCalculatorKind,
} from "@/lib/financepilot";
import { platform } from "@/lib/products";

export const dynamic = "force-dynamic";

/**
 * One route serving every FinancePilot calculator. Each kind is a
 * configuration of the same workspace shell, so they share this page
 * rather than each getting a near-identical copy of it.
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

/**
 * Resolves a calculator kind to its surface and properties components.
 *
 * Future calculators only need to be added to this map; the route
 * stays the same.
 */
function pickCalculatorComponents(kind: FinanceCalculatorKind): {
  Surface: React.ComponentType<{
    calculation: Parameters<typeof EmiSurface>[0]["calculation"];
    onChange: Parameters<typeof EmiSurface>[0]["onChange"];
  }>;
  Properties: React.ComponentType<{ calculation: Parameters<typeof EmiProperties>[0]["calculation"] }>;
} | null {
  switch (kind) {
    case "emi":
      return { Surface: EmiSurface, Properties: EmiProperties };
    case "sip":
      return { Surface: SipSurface, Properties: SipProperties };
    case "compound-interest":
      return {
        Surface: CompoundInterestSurface,
        Properties: CompoundInterestProperties,
      };
    case "loan":
      return { Surface: LoanSurface, Properties: LoanProperties };
    case "budget":
      return { Surface: BudgetSurface, Properties: BudgetProperties };
    case "expense":
      return { Surface: ExpenseSurface, Properties: ExpenseProperties };
    case "savings":
      return { Surface: SavingsSurface, Properties: SavingsProperties };
    case "net-worth":
      return { Surface: NetWorthSurface, Properties: NetWorthProperties };
    default:
      return null;
  }
}

export default async function FinancePilotCalculatorPage({
  params,
}: {
  params: Promise<{ calculator: string }>;
}) {
  const { calculator: slug } = await params;
  const calc = getCalculatorBySlug(slug);
  if (!calc) notFound();

  const components = pickCalculatorComponents(calc.kind);
  // The foundation keeps the blank surface as a fallback for any
  // calculator that has not been wired up yet, so the workspace never
  // crashes if a calculator descriptor is added without a surface.
  const Surface = components?.Surface ?? BlankSurface;
  const Properties = components?.Properties ?? BlankProperties;

  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">FinancePilot {calc.name}</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <FinanceWorkspace
            kind={calc.kind}
            Surface={Surface}
            Properties={Properties}
          />
        </div>
      </main>
    </>
  );
}
