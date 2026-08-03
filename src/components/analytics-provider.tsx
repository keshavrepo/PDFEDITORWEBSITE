"use client";

/**
 * Analytics provider.
 *
 * Mounts the client-side tracker exactly once, on every page, so the rest of
 * the platform can call `trackEvent`, `trackPerformance`, etc. without
 * worrying about installation. Rendered in the root layout alongside the
 * existing `SessionProvider` and `ThemeProvider`; renders no UI.
 */

import { useEffect } from "react";
import { installAnalytics, setAnalyticsContext } from "@/lib/platform/analytics-client";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setAnalyticsContext({ productId: "launchstack" });
    const uninstall = installAnalytics();
    return uninstall;
  }, []);

  return <>{children}</>;
}
