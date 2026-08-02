"use client";

/**
 * Lightweight in-app toast for WebPilot.
 *
 * Mirrors the DevPilot, FinancePilot, OfficePilot and SocialPilot
 * toast pattern so every LaunchStack product shows the same
 * surface. The host is mounted once in the workspace shell; calls
 * to `useToast().toast(...)` queue a transient message that
 * auto-dismisses after a short timeout.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "info" | "error";

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Milliseconds before the toast is auto-dismissed. */
  duration?: number;
}

interface ToastEntry extends Required<Pick<ToastOptions, "tone" | "duration">> {
  id: string;
  message: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: "border-primary/40 bg-primary/10 text-foreground",
  info: "border-border bg-card text-foreground",
  error: "border-destructive/40 bg-destructive/10 text-foreground",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const handle = timers.current.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Math.random().toString(36).slice(2, 10)}`;
      const entry: ToastEntry = {
        id,
        message: options.message,
        tone: options.tone ?? "info",
        duration: Math.max(1000, options.duration ?? 3200),
      };
      setToasts((current) => [...current, entry]);
      const handle = window.setTimeout(() => {
        dismiss(id);
      }, entry.duration);
      timers.current.set(id, handle);
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) {
        window.clearTimeout(handle);
      }
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((entry) => {
          const Icon = ICON[entry.tone];
          return (
            <div
              key={entry.id}
              className={cn(
                "pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-lg",
                TONE_CLASS[entry.tone]
              )}
              role={entry.tone === "error" ? "alert" : "status"}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{entry.message}</p>
              <button
                type="button"
                onClick={() => dismiss(entry.id)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Outside a provider the toast becomes a no-op so non-workspace
    // surfaces can still call the hook without crashing.
    return { toast: () => undefined };
  }
  return context;
}

/** Mounted by the workspace shell as a sibling of the toast provider. */
export function ToastHost() {
  return null;
}
