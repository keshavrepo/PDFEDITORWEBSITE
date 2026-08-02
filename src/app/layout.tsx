import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { platform } from "@/lib/products";
import { appOrigin, appUrl, launchstackOrganizationGraph } from "@/lib/seo";

/**
 * Platform-level defaults.
 *
 * Individual pages override title, description, OG, Twitter, canonical
 * and robots via `buildPageMetadata` (see src/lib/seo.ts). The
 * metadata exported here is the inheritance fallback: anything a
 * page does not declare, the platform fills in.
 */
const origin = appOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: `${platform.name} — ${platform.tagline}`,
    template: `%s | ${platform.name}`,
  },
  description: platform.description,
  applicationName: platform.name,
  keywords: [
    "LaunchStack",
    "productivity platform",
    "PDFPilot",
    "ImagePilot",
    "AudioPilot",
    "OfficePilot",
    "DevPilot",
    "SocialPilot",
    "FinancePilot",
    "WebPilot",
    "PDF tools",
    "image editor",
    "audio workspace",
    "browser tools",
    "privacy-first tools",
  ],
  authors: [{ name: "Keshav Labs", url: "https://github.com/keshavrepo/" }],
  creator: "Keshav",
  publisher: "Keshav Labs",
  alternates: {
    canonical: appUrl("/"),
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: `${platform.name} — ${platform.tagline}`,
    description: platform.description,
    url: appUrl("/"),
    siteName: platform.name,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: appUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: `${platform.name} — ${platform.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${platform.name} — ${platform.tagline}`,
    description: platform.description,
    images: [appUrl("/opengraph-image")],
    creator: "@keshavrepo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "Technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Site-wide Organization + WebSite graph. Pages extend it with
            their own BreadcrumbList / SoftwareApplication / WebPage nodes. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(launchstackOrganizationGraph()),
          }}
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
