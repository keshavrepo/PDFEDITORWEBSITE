import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/auth-form";
import { isGoogleAuthConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSession();
  
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center space-x-2 mb-8">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="14 2 14 8 20 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm font-semibold">PDFPilot</span>
        </Link>

        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Create account</h1>
            <p className="text-sm text-muted-foreground">
              Get started with PDFPilot
            </p>
          </div>

          <AuthForm
            mode="register"
            googleEnabled={isGoogleAuthConfigured()}
          />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-foreground hover:underline font-medium"
            >
              Log in
            </Link>
          </p>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
