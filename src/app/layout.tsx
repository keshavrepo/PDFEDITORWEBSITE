import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { platform } from "@/lib/products";

/**
 * Platform-level defaults. Individual pages override the title and
 * description, so PDFPilot's tool pages keep their own PDF-focused SEO while
 * the surrounding site is branded as LaunchStack.
 */
export const metadata: Metadata = {
  title: {
    default: `${platform.name} — ${platform.tagline}`,
    // Product and tool pages supply their own full title.
    template: `%s`,
  },
  description: platform.description,
  applicationName: platform.name,
  keywords: [
    "LaunchStack",
    "productivity platform",
    "PDFPilot",
    "PDF tools",
    "PDF converter",
    "PDF editor",
  ],
  authors: [{ name: "Keshav Labs", url: "https://github.com/keshavrepo/" }],
  creator: "Keshav",
  publisher: "Keshav Labs",
  openGraph: {
    title: `${platform.name} — ${platform.tagline}`,
    description: platform.description,
    siteName: platform.name,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
