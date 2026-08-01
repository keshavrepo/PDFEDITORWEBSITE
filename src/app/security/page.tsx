import type { Metadata } from "next";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security | PDFPilot",
  description: "PDFPilot security architecture and vulnerability reporting.",
};

export default async function SecurityPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Trust"
      title="Security at PDFPilot"
      description="Keshav Labs designs PDFPilot to minimize document exposure and protect account data with layered controls."
      sections={[
        { title: "Local-first documents", content: <p>Supported document tools process files in browser memory. Keeping document bytes on your device reduces the server-side data surface and eliminates temporary server storage for those operations.</p> },
        { title: "Account protection", content: <ContentList><li>Passwords are hashed with bcrypt and are never stored in plain text.</li><li>Sessions use signed, secure authentication cookies.</li><li>Password-reset tokens are random, stored as hashes, expire after one hour, and are single use.</li><li>Administrative routes verify an explicit administrator role on the server.</li></ContentList> },
        { title: "Infrastructure controls", content: <ContentList><li>HTTPS is required in production and security headers restrict framing, content sniffing, and unnecessary browser permissions.</li><li>Database operations use parameterized queries and versioned migrations.</li><li>Sensitive endpoints apply origin checks, validation, and rate limits.</li><li>Stripe-hosted pages handle payment details and signed webhooks synchronize subscription state.</li></ContentList> },
        { title: "Responsible disclosure", content: <p>Send vulnerability reports privately to <a className="text-foreground underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>. Include reproduction steps and potential impact, but do not access other users&apos; data, disrupt availability, or publicly disclose an unresolved issue. We will acknowledge useful reports as soon as practical.</p> },
        { title: "Scope and expectations", content: <p>No system is perfectly secure. Keep your browser and operating system current, use a unique password, verify downloads, and contact us immediately if you believe your account has been compromised.</p> },
      ]}
    />
  );
}
