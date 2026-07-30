import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ForgotPasswordForm } from "@/components/password-recovery-form";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center space-x-2 mb-8">
          <Logo className="h-6 w-6" />
          <span className="text-sm font-semibold">PDFPilot</span>
        </Link>
        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Reset password</h1>
            <p className="text-sm text-muted-foreground">
              We&apos;ll send a secure reset link to your email
            </p>
          </div>
          <ForgotPasswordForm />
        </Card>
      </div>
    </main>
  );
}
