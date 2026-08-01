"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        devResetUrl?: string;
      };
      if (!response.ok) throw new Error(result.error || "Unable to submit request");
      setMessage(result.message || "Check your email for a reset link.");
      setDevResetUrl(result.devResetUrl || null);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to submit request"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (message) {
    return (
      <div className="space-y-4 text-sm">
        <div className="flex gap-3 rounded-lg bg-primary/10 p-4 text-primary">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{message}</p>
        </div>
        {devResetUrl && (
          <Link href={devResetUrl} className="block font-medium hover:underline">
            Open development reset link
          </Link>
        )}
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={255}
          required
          disabled={submitting}
        />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button className="w-full" size="lg" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is missing its token"
  );
  const [completed, setCompleted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    if (password !== formData.get("confirmPassword")) {
      setError("Passwords do not match");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to reset password");
      setCompleted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to reset password"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          Your password has been updated. You can now log in.
        </p>
        <Button className="w-full" asChild>
          <Link href="/login">Continue to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">New password</label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          disabled={submitting || !token}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          disabled={submitting || !token}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Use at least 8 characters, including a letter and number.
      </p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button className="w-full" size="lg" disabled={submitting || !token}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}
