import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ResetPasswordForm } from "@/components/password-recovery-form";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center space-x-2 mb-8">
          <Logo className="h-6 w-6" />
          <span className="text-sm font-semibold">PDFPilot</span>
        </Link>
        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Choose a new password</h1>
            <p className="text-sm text-muted-foreground">
              Your reset link can be used once and expires after one hour
            </p>
          </div>
          <ResetPasswordForm token={token} />
        </Card>
      </div>
    </main>
  );
}
