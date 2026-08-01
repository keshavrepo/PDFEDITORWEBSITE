"use client";

/**
 * Lightweight toast surface for FinancePilot.
 *
 * Renders one message at a time and auto-dismisses. The hook returns a
 * `toast` function and a host element; mount the host once at the root of
 * the workspace shell.
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "error";

export interface ToastInput {
  message: string;
  tone?: Tone;
  durationMs?: number;
}

interface ToastState extends ToastInput {
  id: string;
}

let counter = 0;
const listeners = new Set<(toast: ToastState) => void>();

/** Push a toast from anywhere in the client. */
export function showToast(input: ToastInput): void {
  counter += 1;
  const toast: ToastState = { id: `toast-${counter}`, ...input };
  for (const listener of listeners) listener(toast);
}

/** Hook returning a `toast` function bound to the provider. */
export function useToast(): {
  toast: (input: ToastInput) => void;
} {
  return { toast: showToast };
}

const TONE_ICON: Record<Tone, typeof CheckCircle2> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

/**
 * Provider element. Mount once in the workspace shell.
 *
 * The provider is intentionally tiny: it tracks a queue of pending toasts,
 * shows the most recent one, and auto-dismisses after the configured
 * duration. Adding it does not pull in any state management library.
 */
export function ToastHost() {
  const [current, setCurrent] = useState<ToastState | null>(null);

  useEffect(() => {
    function onToast(toast: ToastState) {
      setCurrent(toast);
      const duration = toast.durationMs ?? 2400;
      window.setTimeout(() => {
        setCurrent((prev) => (prev?.id === toast.id ? null : prev));
      }, duration);
    }
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);

  if (!current) return null;
  const Icon = TONE_ICON[current.tone ?? "info"];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-12 left-1/2 z-50 -translate-x-1/2 rounded-2xl border bg-card px-4 py-2 shadow-lg",
        current.tone === "error" ? "border-destructive/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <Icon
          className={cn(
            "h-4 w-4",
            current.tone === "error" ? "text-destructive" : "text-foreground"
          )}
          aria-hidden="true"
        />
        <span>{current.message}</span>
        <button
          type="button"
          onClick={dismiss}
          className="ml-2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
