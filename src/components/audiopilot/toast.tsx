"use client";

/**
 * Lightweight in-app toast for AudioPilot.
 *
 * Mirrors the WebPilot, DevPilot, FinancePilot, OfficePilot and
 * SocialPilot toast pattern so every LaunchStack product shows the
 * same surface. The host is mounted once in the workspace shell;
 * calls to `useToast().toast(...)` queue a transient message that
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
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
        duration: options.duration ?? 3200,
      };
      setToasts((current) => [...current, entry]);
      const handle = window.setTimeout(() => remove(id), entry.duration);
      timers.current.set(id, handle);
    },
    [remove]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) window.clearTimeout(handle);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHostView toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (options) => {
        if (typeof console !== "undefined") {
          console.warn("Toast invoked without a ToastProvider", options.message);
        }
      },
    };
  }
  return ctx;
}

export function ToastHost() {
  // The actual toast host is rendered inside the provider so the
  // queue and the dismiss handler are kept in the same closure.
  return null;
}

interface ToastHostProps {
  toasts: ToastEntry[];
  onDismiss: (id: string) => void;
}

function ToastHostView({ toasts, onDismiss }: ToastHostProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((entry) => (
        <div
          key={entry.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg",
            entry.tone === "success" && "border-primary/40",
            entry.tone === "error" && "border-destructive/60",
            entry.tone === "info" && "border-border"
          )}
        >
          <span
            className={cn(
              "mt-0.5",
              entry.tone === "success" && "text-primary",
              entry.tone === "error" && "text-destructive",
              entry.tone === "info" && "text-muted-foreground"
            )}
            aria-hidden="true"
          >
            {entry.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : entry.tone === "error" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
          </span>
          <p className="flex-1 text-foreground">{entry.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(entry.id)}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
