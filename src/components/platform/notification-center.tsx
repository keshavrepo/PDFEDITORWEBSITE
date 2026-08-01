"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CreditCard,
  FileText,
  Loader2,
  Upload,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationEntry, NotificationCategory } from "@/lib/platform/activity";

const CATEGORY_ICON: Record<NotificationCategory, typeof Bell> = {
  conversion: FileText,
  upload: Upload,
  subscription: CreditCard,
  account: UserCog,
  system: Bell,
};

const LEVEL_TONE: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-primary",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
};

function relativeTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Notification centre.
 *
 * Reads from the shared notifications table, so any product that writes an
 * entry appears here without further work. Contents are fetched when the panel
 * opens rather than polling, which keeps the page idle-quiet.
 */
export function NotificationCenter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const data = (await response.json()) as {
        notifications: NotificationEntry[];
        unread: number;
      };
      setItems(data.notifications);
      setUnread(data.unread);
      setLoaded(true);
    } catch {
      // A failed fetch leaves the previous contents in place.
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch the unread count once so the badge is accurate before opening.
  // Deferred to a task so the effect never writes state synchronously.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const timer = loaded ? undefined : window.setTimeout(() => void load(), 0);

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loaded, load]);

  async function markAllRead() {
    // Update optimistically; the request only confirms what is already shown.
    setItems((current) => current.map((item) => ({ ...item, readAt: new Date() })));
    setUnread(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      void load();
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-accent"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && !items.length ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : !items.length ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">You are all caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Conversions, uploads and account activity appear here
                </p>
              </div>
            ) : (
              <ul>
                {items.map((item) => {
                  const Icon = CATEGORY_ICON[item.category] ?? Bell;
                  const body = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors",
                        item.href && "hover:bg-accent/50",
                        !item.readAt && "bg-primary/[0.04]"
                      )}
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon
                          className={cn("h-3.5 w-3.5", LEVEL_TONE[item.level] ?? LEVEL_TONE.info)}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{item.title}</p>
                          {!item.readAt && (
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                        {item.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {item.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.productName} · {relativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <li key={item.id} className="border-b border-border/40 last:border-0">
                      {item.href ? (
                        <Link href={item.href} onClick={() => setOpen(false)}>
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border/60 px-4 py-2.5">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              View all activity on your dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
