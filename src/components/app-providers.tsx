"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
