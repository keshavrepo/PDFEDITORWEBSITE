/**
 * User preferences stored on the account.
 *
 * Kept in the existing `users.preferences` JSON column so no schema change is
 * needed, and parsed defensively because the column predates this shape.
 */

export type ThemePreference = "light" | "dark" | "system";

export interface NotificationPreferences {
  conversions: boolean;
  uploads: boolean;
  subscription: boolean;
  account: boolean;
  productUpdates: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  notifications: NotificationPreferences;
}

export const defaultPreferences: UserPreferences = {
  theme: "system",
  notifications: {
    conversions: true,
    uploads: true,
    subscription: true,
    account: true,
    productUpdates: false,
  },
};

/** Coerces whatever is stored into a complete, valid preferences object. */
export function parsePreferences(value: unknown): UserPreferences {
  if (!value || typeof value !== "object") return defaultPreferences;

  const record = value as Record<string, unknown>;
  const theme = record.theme;
  const notifications =
    record.notifications && typeof record.notifications === "object"
      ? (record.notifications as Record<string, unknown>)
      : {};

  const readFlag = (key: keyof NotificationPreferences): boolean => {
    const stored = notifications[key];
    return typeof stored === "boolean" ? stored : defaultPreferences.notifications[key];
  };

  return {
    theme:
      theme === "light" || theme === "dark" || theme === "system"
        ? theme
        : defaultPreferences.theme,
    notifications: {
      conversions: readFlag("conversions"),
      uploads: readFlag("uploads"),
      subscription: readFlag("subscription"),
      account: readFlag("account"),
      productUpdates: readFlag("productUpdates"),
    },
  };
}

/** Labels used by the settings form, kept beside the shape they describe. */
export const notificationLabels: Array<{
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}> = [
  {
    key: "conversions",
    label: "Conversions",
    description: "When a conversion finishes or fails",
  },
  {
    key: "uploads",
    label: "Uploads",
    description: "When a file is added or an upload fails",
  },
  {
    key: "subscription",
    label: "Subscription",
    description: "Plan changes, renewals and payment issues",
  },
  {
    key: "account",
    label: "Account activity",
    description: "Sign-ins, password changes and profile updates",
  },
  {
    key: "productUpdates",
    label: "Product updates",
    description: "New LaunchStack products and major releases",
  },
];
