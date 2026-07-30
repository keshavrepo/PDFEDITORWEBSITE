"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface BillingButtonProps extends Omit<ButtonProps, "onClick"> {
  mode: "checkout" | "portal";
  plan?: "pro" | "business";
  children: React.ReactNode;
}

export function BillingButton({
  mode,
  plan,
  children,
  disabled,
  ...buttonProps
}: BillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openBilling() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        mode === "checkout" ? "/api/stripe/checkout" : "/api/stripe/portal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: mode === "checkout" ? JSON.stringify({ plan }) : undefined,
        }
      );
      const result = (await response.json()) as { url?: string; error?: string };
      if (response.status === 401) {
        window.location.assign(`/login?callbackUrl=${encodeURIComponent("/pricing")}`);
        return;
      }
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open billing");
      }
      window.location.assign(result.url);
    } catch (billingError) {
      setError(
        billingError instanceof Error
          ? billingError.message
          : "Unable to open billing"
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        {...buttonProps}
        type="button"
        onClick={openBilling}
        disabled={disabled || loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
