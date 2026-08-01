"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  notificationLabels,
  type NotificationPreferences,
  type ThemePreference,
  type UserPreferences,
} from "@/lib/platform/preferences";

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Theme and notification preferences.
 *
 * The theme is applied immediately through next-themes so the change is
 * visible at once, and persisted to the account so it follows the user to
 * another device.
 */
export function PreferencesForm({ initial }: { initial: UserPreferences }) {
  const { setTheme } = useTheme();
  const [theme, setThemeState] = useState<ThemePreference>(initial.theme);
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    initial.notifications
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Align the active theme with the stored preference on first render.
  useEffect(() => {
    setTheme(initial.theme);
  }, [initial.theme, setTheme]);

  async function persist(next: Partial<UserPreferences>) {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Unable to save your preferences");
      }
      setStatus("Preferences saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }

  function chooseTheme(value: ThemePreference) {
    setThemeState(value);
    // Apply first so the UI responds instantly, then persist.
    setTheme(value);
    void persist({ theme: value });
  }

  function toggleNotification(key: keyof NotificationPreferences) {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    void persist({ notifications: next });
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
          Appearance
        </h2>
        <Card className="p-8">
          <fieldset disabled={busy}>
            <legend className="text-sm font-medium mb-1">Theme</legend>
            <p className="text-sm text-muted-foreground mb-4">
              Applies across every LaunchStack product on this account.
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseTheme(option.value)}
                  aria-pressed={theme === option.value}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors",
                    theme === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-accent"
                  )}
                >
                  <option.icon className="h-4 w-4" aria-hidden="true" />
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
          Notifications
        </h2>
        <Card className="p-8">
          <p className="text-sm text-muted-foreground mb-5">
            Choose which events appear in your notification centre.
          </p>
          <fieldset disabled={busy} className="space-y-4">
            {notificationLabels.map((entry) => (
              <label key={entry.key} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={notifications[entry.key]}
                  onChange={() => toggleNotification(entry.key)}
                  className="h-4 w-4 mt-0.5 rounded border-input"
                />
                <span>
                  {entry.label}
                  <span className="block text-xs text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="mt-6 flex items-center gap-3 min-h-6" role="status" aria-live="polite">
            {busy && (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving
              </span>
            )}
            {!busy && status && <span className="text-sm text-primary">{status}</span>}
            {!busy && error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </Card>
      </section>
    </div>
  );
}
