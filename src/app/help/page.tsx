import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Help Center | PDFPilot",
  description: "Answers and support options for PDFPilot customers.",
};

export default async function HelpPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Support"
      title="Help Center"
      description="Find answers to common questions or contact Keshav Labs for direct support."
      sections={[
        { title: "Why is my PDF not accepted?", content: <p>PDFPilot checks the actual file header and document structure. Empty, corrupted, incorrectly renamed, oversized, or encrypted files may be rejected. Use the repair or unlock tool when appropriate.</p> },
        { title: "Where is my processed file stored?", content: <p>For browser-based operations, the result remains in temporary browser memory until you download it. PDFPilot does not retain those document bytes on its servers.</p> },
        { title: "How do I manage billing?", content: <p>Sign in, open Settings, and select Manage billing. Stripe&apos;s secure portal provides invoices, payment-method updates, and cancellation controls.</p> },
        { title: "How do I recover my account?", content: <p>Use <Link href="/forgot-password" className="text-foreground underline underline-offset-4">Forgot password</Link> from the login page. Reset links expire after one hour and can only be used once.</p> },
        { title: "Contact support", content: <p>Email <a href={`mailto:${siteConfig.supportEmail}`} className="text-foreground underline underline-offset-4">{siteConfig.supportEmail}</a> or use the <Link href="/contact" className="text-foreground underline underline-offset-4">contact form</Link>. Support hours follow India Standard Time.</p> },
      ]}
    />
  );
}
