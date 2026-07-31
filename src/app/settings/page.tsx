import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SettingsForms } from "@/components/settings-forms";
import { PreferencesForm } from "@/components/preferences-form";
import { parsePreferences } from "@/lib/platform/preferences";

export const dynamic = "force-dynamic";

interface SettingsPageProps {
  searchParams: Promise<{ billing?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await getSession();
  if (!user) redirect("/login");

  const [account] = await db
    .select({ passwordHash: users.passwordHash, preferences: users.preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!account) redirect("/login");

  return (
    <>
      <Navbar user={user} />
      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
          <h1 className="text-3xl md:text-4xl font-bold">Settings</h1>
        </section>
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="space-y-10">
            <SettingsForms
              user={user}
              hasPassword={Boolean(account.passwordHash)}
              billingStatus={(await searchParams).billing}
            />
            <PreferencesForm initial={parsePreferences(account.preferences)} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
